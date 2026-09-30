import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { stripNs, type Jar } from './util.ts';

/* ------------------------------------------------------------------ */
/* Texturas                                                             */
/* ------------------------------------------------------------------ */

interface Texture {
  w: number;
  h: number;
  data: Uint8Array; // RGBA
}

class TextureStore {
  private cache = new Map<string, Texture | null>();
  constructor(private jar: Jar) {}
  get(ref: string): Texture | null {
    const id = stripNs(ref);
    if (this.cache.has(id)) return this.cache.get(id)!;
    const file = `assets/minecraft/textures/${id}.png`;
    let tex: Texture | null = null;
    if (this.jar.has(file)) {
      const png = PNG.sync.read(this.jar.buffer(file));
      let h = png.height;
      let offset = 0;
      // Textura animada: usa o primeiro quadro declarado no .mcmeta.
      const meta = this.jar.tryJson<any>(`${file}.mcmeta`);
      if (meta?.animation && png.height > png.width) {
        const fw = meta.animation.width ?? png.width;
        const fh = meta.animation.height ?? fw;
        h = fh;
        const first = meta.animation.frames?.[0];
        const index = typeof first === 'number' ? first : (first?.index ?? 0);
        offset = index * fh * png.width * 4;
      }
      tex = { w: png.width, h, data: new Uint8Array(png.data.buffer, png.data.byteOffset + offset, png.width * h * 4) };
    }
    this.cache.set(id, tex);
    return tex;
  }
}

function sample(tex: Texture, u: number, v: number): [number, number, number, number] {
  const x = Math.min(tex.w - 1, Math.max(0, Math.floor(u * tex.w)));
  const y = Math.min(tex.h - 1, Math.max(0, Math.floor(v * tex.h)));
  const i = (y * tex.w + x) * 4;
  return [tex.data[i], tex.data[i + 1], tex.data[i + 2], tex.data[i + 3]];
}

/* ------------------------------------------------------------------ */
/* Modelos                                                              */
/* ------------------------------------------------------------------ */

type Dir = 'up' | 'down' | 'north' | 'south' | 'west' | 'east';

interface Face {
  texture: string;
  uv?: [number, number, number, number];
  rotation?: number;
  tintindex?: number;
}

interface Element {
  from: [number, number, number];
  to: [number, number, number];
  rotation?: { origin: [number, number, number]; axis: 'x' | 'y' | 'z'; angle: number; rescale?: boolean };
  faces: Partial<Record<Dir, Face>>;
  shade?: boolean;
}

interface ResolvedModel {
  textures: Record<string, string>;
  elements?: Element[];
  generated: boolean;
  gui?: { rotation: [number, number, number]; translation: [number, number, number]; scale: [number, number, number] };
}

interface Tint {
  type: string;
  value?: number;
  default?: number;
  temperature?: number;
  downfall?: number;
}

function loadModel(jar: Jar, ref: string, depth = 0): ResolvedModel {
  const id = stripNs(ref);
  if (depth > 20) throw new Error(`Modelo com herança muito profunda: ${id}`);
  if (id === 'builtin/generated') return { textures: {}, generated: true };
  const json = jar.tryJson<any>(`assets/minecraft/models/${id}.json`);
  if (!json) return { textures: {}, generated: false };
  const parent: ResolvedModel = json.parent ? loadModel(jar, json.parent, depth + 1) : { textures: {}, generated: false };
  const own: Record<string, string> = {};
  for (const [k, v] of Object.entries<any>(json.textures ?? {})) own[k] = typeof v === 'string' ? v : v.sprite;
  return {
    textures: { ...parent.textures, ...own },
    elements: json.elements ?? parent.elements,
    generated: parent.generated && !json.elements,
    gui: json.display?.gui ?? parent.gui,
  };
}

function resolveTexture(model: ResolvedModel, ref: string): string | undefined {
  // Referência sem "#" (ex.: "all") também aponta para a tabela de texturas do modelo.
  let r = !ref.startsWith('#') && !ref.includes('/') && model.textures[ref] ? `#${ref}` : ref;
  for (let i = 0; i < 10 && r.startsWith('#'); i++) r = model.textures[r.slice(1)] ?? '';
  return r && !r.startsWith('#') ? r : undefined;
}

/* ------------------------------------------------------------------ */
/* Definição de item (assets/minecraft/items/*.json)                    */
/* ------------------------------------------------------------------ */

/** Transformação de uma parte de modelo composto (T * L * S * R, em blocos). */
interface PartTransform {
  translation: [number, number, number];
  left: [number, number, number, number];
  right: [number, number, number, number];
  scale: [number, number, number];
}

const IDENTITY: PartTransform = { translation: [0, 0, 0], left: [0, 0, 0, 1], right: [0, 0, 0, 1], scale: [1, 1, 1] };

function quatRotate(q: [number, number, number, number], v: [number, number, number]): [number, number, number] {
  const [x, y, z, w] = q;
  const [vx, vy, vz] = v;
  // v' = v + 2w(q×v) + 2q×(q×v)
  const cx = y * vz - z * vy;
  const cy = z * vx - x * vz;
  const cz = x * vy - y * vx;
  const ccx = y * cz - z * cy;
  const ccy = z * cx - x * cz;
  const ccz = x * cy - y * cx;
  return [vx + 2 * (w * cx + ccx), vy + 2 * (w * cy + ccy), vz + 2 * (w * cz + ccz)];
}

function applyPart(t: PartTransform, p: [number, number, number]): [number, number, number] {
  let v: [number, number, number] = [p[0] / 16, p[1] / 16, p[2] / 16];
  v = quatRotate(t.right, v);
  v = [v[0] * t.scale[0], v[1] * t.scale[1], v[2] * t.scale[2]];
  v = quatRotate(t.left, v);
  return [(v[0] + t.translation[0]) * 16, (v[1] + t.translation[1]) * 16, (v[2] + t.translation[2]) * 16];
}

interface Picked {
  model?: string;
  tints: Tint[];
  special?: any;
  parts?: { model: string; tints: Tint[]; transform: PartTransform }[];
}

function pick(node: any): Picked {
  const t = stripNs(node?.type ?? '');
  switch (t) {
    case 'model':
      return { model: node.model, tints: node.tints ?? [] };
    case 'special':
      return { model: node.base, tints: [], special: node.model };
    case 'composite': {
      const parts = node.models.map((m: any) => {
        const p = pick(m);
        const t = m.transformation ?? {};
        const transform: PartTransform = {
          translation: t.translation ?? IDENTITY.translation,
          left: t.left_rotation ?? IDENTITY.left,
          right: t.right_rotation ?? IDENTITY.right,
          scale: t.scale ?? IDENTITY.scale,
        };
        return { model: p.model!, tints: p.tints, transform };
      });
      return { tints: [], parts };
    }
    case 'condition':
      return pick(node.on_false);
    case 'select': {
      if (stripNs(node.property ?? '') === 'display_context') {
        const gui = node.cases.find((c: any) => [c.when].flat().includes('gui'));
        if (gui) return pick(gui.model);
      }
      return pick(node.fallback ?? node.cases[0].model);
    }
    case 'range_dispatch':
      return pick(node.fallback ?? node.entries[0].model);
    default:
      return { tints: [] };
  }
}

/* ------------------------------------------------------------------ */
/* Canvas                                                               */
/* ------------------------------------------------------------------ */

class Canvas {
  data: Float32Array;
  depth: Float32Array;
  constructor(public size: number) {
    this.data = new Float32Array(size * size * 4);
    this.depth = new Float32Array(size * size).fill(-Infinity);
  }
  blend(x: number, y: number, z: number, r: number, g: number, b: number, a: number) {
    const i = y * this.size + x;
    if (a >= 0.999) {
      if (z < this.depth[i]) return;
      this.depth[i] = z;
      this.data.set([r, g, b, 1], i * 4);
      return;
    }
    if (z < this.depth[i]) return;
    const o = i * 4;
    const da = this.data[o + 3];
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    this.data[o] = (r * a + this.data[o] * da * (1 - a)) / oa;
    this.data[o + 1] = (g * a + this.data[o + 1] * da * (1 - a)) / oa;
    this.data[o + 2] = (b * a + this.data[o + 2] * da * (1 - a)) / oa;
    this.data[o + 3] = oa;
  }
  toPng(): Buffer {
    const png = new PNG({ width: this.size, height: this.size });
    for (let i = 0; i < this.size * this.size; i++) {
      png.data[i * 4] = Math.round(Math.min(255, this.data[i * 4]));
      png.data[i * 4 + 1] = Math.round(Math.min(255, this.data[i * 4 + 1]));
      png.data[i * 4 + 2] = Math.round(Math.min(255, this.data[i * 4 + 2]));
      png.data[i * 4 + 3] = Math.round(this.data[i * 4 + 3] * 255);
    }
    return PNG.sync.write(png);
  }
  isEmpty() {
    for (let i = 3; i < this.data.length; i += 4) if (this.data[i] > 0) return false;
    return true;
  }
}

/* ------------------------------------------------------------------ */
/* Cores de tinta                                                       */
/* ------------------------------------------------------------------ */

function argb(n: number): [number, number, number] {
  const u = n >>> 0;
  return [(u >> 16) & 255, (u >> 8) & 255, u & 255];
}

class Tints {
  private grass: Texture | null;
  private foliage: Texture | null;
  constructor(textures: TextureStore) {
    this.grass = textures.get('colormap/grass');
    this.foliage = textures.get('colormap/foliage');
  }
  color(t: Tint | undefined): [number, number, number] {
    if (!t) return [255, 255, 255];
    const type = stripNs(t.type);
    if (type === 'constant' && t.value !== undefined) return argb(t.value);
    if ((type === 'grass' || type === 'foliage') && t.temperature !== undefined) {
      const map = type === 'grass' ? this.grass : this.foliage;
      if (map) {
        const temp = Math.min(1, Math.max(0, t.temperature));
        const rain = Math.min(1, Math.max(0, t.downfall ?? 0)) * temp;
        const [r, g, b] = sample(map, 1 - temp, 1 - rain);
        return [r, g, b];
      }
    }
    if (t.default !== undefined) return argb(t.default);
    if (t.value !== undefined) return argb(t.value);
    return [255, 255, 255];
  }
}

/* ------------------------------------------------------------------ */
/* Renderização 3D (projeção ortográfica igual ao slot do inventário)  */
/* ------------------------------------------------------------------ */

type V3 = [number, number, number];

const FACE_CORNERS: Record<Dir, (f: V3, t: V3) => [V3, V3, V3, V3]> = {
  north: (f, t) => [[t[0], t[1], f[2]], [f[0], t[1], f[2]], [f[0], f[1], f[2]], [t[0], f[1], f[2]]],
  south: (f, t) => [[f[0], t[1], t[2]], [t[0], t[1], t[2]], [t[0], f[1], t[2]], [f[0], f[1], t[2]]],
  west: (f, t) => [[f[0], t[1], f[2]], [f[0], t[1], t[2]], [f[0], f[1], t[2]], [f[0], f[1], f[2]]],
  east: (f, t) => [[t[0], t[1], t[2]], [t[0], t[1], f[2]], [t[0], f[1], f[2]], [t[0], f[1], t[2]]],
  up: (f, t) => [[f[0], t[1], f[2]], [t[0], t[1], f[2]], [t[0], t[1], t[2]], [f[0], t[1], t[2]]],
  down: (f, t) => [[f[0], f[1], t[2]], [t[0], f[1], t[2]], [t[0], f[1], f[2]], [f[0], f[1], f[2]]],
};

function defaultUv(dir: Dir, f: V3, t: V3): [number, number, number, number] {
  switch (dir) {
    case 'up':
      return [f[0], f[2], t[0], t[2]];
    case 'down':
      return [f[0], 16 - t[2], t[0], 16 - f[2]];
    case 'north':
      return [16 - t[0], 16 - t[1], 16 - f[0], 16 - f[1]];
    case 'south':
      return [f[0], 16 - t[1], t[0], 16 - f[1]];
    case 'west':
      return [f[2], 16 - t[1], t[2], 16 - f[1]];
    case 'east':
      return [16 - t[2], 16 - t[1], 16 - f[2], 16 - f[1]];
  }
}

function rotateAxis(p: V3, axis: 'x' | 'y' | 'z', deg: number, origin: V3): V3 {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const x = p[0] - origin[0];
  const y = p[1] - origin[1];
  const z = p[2] - origin[2];
  let r: V3;
  if (axis === 'x') r = [x, y * c - z * s, y * s + z * c];
  else if (axis === 'y') r = [x * c + z * s, y, -x * s + z * c];
  else r = [x * c - y * s, x * s + y * c, z];
  return [r[0] + origin[0], r[1] + origin[1], r[2] + origin[2]];
}

const SHADE: Record<Dir, number> = { up: 1, down: 0.5, north: 0.8, south: 0.8, east: 0.6, west: 0.6 };

interface DrawItem {
  model: ResolvedModel;
  tints: Tint[];
  transform: PartTransform;
}

function renderElements(canvas: Canvas, items: DrawItem[], textures: TextureStore, tints: Tints, gui: NonNullable<ResolvedModel['gui']>) {
  const size = canvas.size;
  const [rx, ry, rz] = gui.rotation ?? [0, 0, 0];
  const sc = gui.scale ?? [1, 1, 1];
  const tr = gui.translation ?? [0, 0, 0];
  const transform = (p: V3): V3 => {
    let q: V3 = [p[0] - 8, p[1] - 8, p[2] - 8];
    q = [q[0] * sc[0], q[1] * sc[1], q[2] * sc[2]];
    q = rotateAxis(q, 'z', rz, [0, 0, 0]);
    q = rotateAxis(q, 'y', ry, [0, 0, 0]);
    q = rotateAxis(q, 'x', rx, [0, 0, 0]);
    return [q[0] + tr[0], q[1] + tr[1], q[2] + tr[2]];
  };
  const toScreen = (q: V3): V3 => [((q[0] + 8) / 16) * size, ((8 - q[1]) / 16) * size, q[2]];

  for (const it of items) {
    for (const el of it.model.elements ?? []) {
      const f = el.from as V3;
      const t = el.to as V3;
      for (const dir of Object.keys(el.faces) as Dir[]) {
        const face = el.faces[dir]!;
        const texRef = resolveTexture(it.model, face.texture);
        if (!texRef) continue;
        const tex = textures.get(texRef);
        if (!tex) continue;
        let corners = FACE_CORNERS[dir](f, t);
        if (el.rotation) {
          const rot = el.rotation;
          corners = corners.map((c) => rotateAxis(c, rot.axis, rot.angle, rot.origin as V3)) as typeof corners;
        }
        corners = corners.map((c) => applyPart(it.transform, c)) as typeof corners;
        const world = corners.map(transform);
        const scr = world.map(toScreen);
        // Normal no espaço de visão (câmera olha para -z): descarta faces de costas.
        const e1: V3 = [world[1][0] - world[0][0], world[1][1] - world[0][1], world[1][2] - world[0][2]];
        const e2: V3 = [world[3][0] - world[0][0], world[3][1] - world[0][1], world[3][2] - world[0][2]];
        const nz = e1[0] * e2[1] - e1[1] * e2[0];
        if (nz >= -1e-6) continue;
        const uv = face.uv ?? defaultUv(dir, f, t);
        const rotSteps = ((face.rotation ?? 0) / 90) % 4;
        const tint = face.tintindex !== undefined ? tints.color(it.tints[face.tintindex]) : [255, 255, 255];
        const shade = el.shade === false ? 1 : SHADE[dir];
        const ax = scr[1][0] - scr[0][0];
        const ay = scr[1][1] - scr[0][1];
        const bx = scr[3][0] - scr[0][0];
        const by = scr[3][1] - scr[0][1];
        const det = ax * by - ay * bx;
        if (Math.abs(det) < 1e-9) continue;
        const minX = Math.max(0, Math.floor(Math.min(...scr.map((p) => p[0]))));
        const maxX = Math.min(size - 1, Math.ceil(Math.max(...scr.map((p) => p[0]))));
        const minY = Math.max(0, Math.floor(Math.min(...scr.map((p) => p[1]))));
        const maxY = Math.min(size - 1, Math.ceil(Math.max(...scr.map((p) => p[1]))));
        for (let py = minY; py <= maxY; py++) {
          for (let px = minX; px <= maxX; px++) {
            const dx = px + 0.5 - scr[0][0];
            const dy = py + 0.5 - scr[0][1];
            const s = (dx * by - dy * bx) / det;
            const q = (ax * dy - ay * dx) / det;
            if (s < 0 || s > 1 || q < 0 || q > 1) continue;
            let ss = s;
            let qq = q;
            for (let r = 0; r < rotSteps; r++) {
              const tmp = ss;
              ss = qq;
              qq = 1 - tmp;
            }
            const u = (uv[0] + (uv[2] - uv[0]) * ss) / 16;
            const v = (uv[1] + (uv[3] - uv[1]) * qq) / 16;
            const [r, g, b, a] = sample(tex, Math.min(0.99999, Math.max(0, u)), Math.min(0.99999, Math.max(0, v)));
            if (a < 26) continue;
            const z = scr[0][2] + (scr[1][2] - scr[0][2]) * s + (scr[3][2] - scr[0][2]) * q;
            canvas.blend(px, py, z, (r * tint[0] * shade) / 255, (g * tint[1] * shade) / 255, (b * tint[2] * shade) / 255, a / 255);
          }
        }
      }
    }
  }
}

function renderGenerated(canvas: Canvas, model: ResolvedModel, tintList: Tint[], textures: TextureStore, tints: Tints): boolean {
  let drew = false;
  for (let layer = 0; layer < 8; layer++) {
    const ref = model.textures[`layer${layer}`];
    if (!ref) break;
    const tex = textures.get(ref);
    if (!tex) continue;
    const tint = tints.color(tintList[layer]);
    const size = canvas.size;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const [r, g, b, a] = sample(tex, (x + 0.5) / size, (y + 0.5) / size);
        if (a === 0) continue;
        canvas.blend(x, y, layer, (r * tint[0]) / 255, (g * tint[1]) / 255, (b * tint[2]) / 255, a / 255);
        drew = true;
      }
  }
  return drew;
}

/* ------------------------------------------------------------------ */
/* Modelos de entidade (baús, shulkers, cabeças...)                    */
/* ------------------------------------------------------------------ */

/** Cria um elemento com UV no formato de "box" de entidade. */
function entityBox(tex: string, tw: number, th: number, u: number, v: number, from: V3, size: V3): Element {
  const [w, h, d] = size;
  const U = (x: number) => (x * 16) / tw;
  const Vv = (y: number) => (y * 16) / th;
  const r = (x1: number, y1: number, x2: number, y2: number): [number, number, number, number] => [U(x1), Vv(y1), U(x2), Vv(y2)];
  return {
    from,
    to: [from[0] + w, from[1] + h, from[2] + d],
    faces: {
      up: { texture: tex, uv: r(u + d, v, u + d + w, v + d) },
      down: { texture: tex, uv: r(u + d + w, v, u + d + w + w, v + d) },
      east: { texture: tex, uv: r(u, v + d, u + d, v + d + h) },
      north: { texture: tex, uv: r(u + d, v + d, u + d + w, v + d + h) },
      west: { texture: tex, uv: r(u + d + w, v + d, u + d + w + d, v + d + h) },
      south: { texture: tex, uv: r(u + d + w + d, v + d, u + d + w + d + w, v + d + h) },
    },
  };
}

const BLOCK_GUI = { rotation: [30, 225, 0] as V3, translation: [0, 0, 0] as V3, scale: [0.625, 0.625, 0.625] as V3 };

function specialModel(special: any, textures: TextureStore): { model: ResolvedModel } | undefined {
  const t = stripNs(special.type ?? '');
  const tex = (p: string) => (textures.get(p) ? p : undefined);
  if (t === 'chest') {
    const name = stripNs(special.texture ?? 'normal');
    const p = tex(`entity/chest/${name}`);
    if (!p) return undefined;
    const T = textures.get(p)!;
    return {
      model: {
        textures: {},
        generated: false,
        gui: BLOCK_GUI,
        elements: [
          entityBox(p, T.w, T.h, 0, 19, [1, 0, 1], [14, 10, 14]),
          entityBox(p, T.w, T.h, 0, 0, [1, 9, 1], [14, 5, 14]),
          entityBox(p, T.w, T.h, 0, 0, [7, 7, 0], [2, 4, 1]),
        ].map(upsideDown),
      },
    };
  }
  if (t === 'shulker_box') {
    const name = stripNs(special.texture ?? 'shulker');
    const p = tex(`entity/shulker/${name}`);
    if (!p) return undefined;
    const T = textures.get(p)!;
    return {
      model: {
        textures: {},
        generated: false,
        gui: BLOCK_GUI,
        elements: [entityBox(p, T.w, T.h, 0, 28, [0, 0, 0], [16, 8, 16]), entityBox(p, T.w, T.h, 0, 0, [0, 4, 0], [16, 12, 16])],
      },
    };
  }
  if (t === 'head' || t === 'player_head') {
    const kind = stripNs(special.kind ?? 'player');
    const map: Record<string, string> = {
      skeleton: 'entity/skeleton/skeleton',
      wither_skeleton: 'entity/skeleton/wither_skeleton',
      zombie: 'entity/zombie/zombie',
      creeper: 'entity/creeper/creeper',
      piglin: 'entity/piglin/piglin',
      dragon: 'entity/enderdragon/dragon',
      player: 'entity/player/wide/steve',
    };
    const p = tex(special.texture ? stripNs(special.texture) : (map[kind] ?? map.player));
    if (!p) return undefined;
    const T = textures.get(p)!;
    const box = kind === 'dragon' ? entityBox(p, T.w, T.h, 112, 30, [2, 2, 2], [12, 12, 12]) : entityBox(p, T.w, T.h, 0, 0, [4, 0, 4], [8, 8, 8]);
    return { model: { textures: {}, generated: false, gui: { rotation: [30, 45, 0], translation: [0, 3, 0], scale: [1, 1, 1] }, elements: [box] } };
  }
  if (t === 'conduit') {
    const p = tex('entity/conduit/base');
    if (!p) return undefined;
    const T = textures.get(p)!;
    return { model: { textures: {}, generated: false, gui: BLOCK_GUI, elements: [entityBox(p, T.w, T.h, 0, 0, [5, 5, 5], [6, 6, 6])] } };
  }
  if (t === 'decorated_pot') {
    const base = tex('entity/decorated_pot/decorated_pot_base');
    const side = tex('entity/decorated_pot/decorated_pot_side');
    if (!base || !side) return undefined;
    const S = textures.get(side)!;
    const B = textures.get(base)!;
    const body = entityBox(side, S.w, S.h, 0, 0, [1, 0, 1], [14, 16, 14]);
    const sideUv: [number, number, number, number] = [(1 * 16) / S.w, 0, (15 * 16) / S.w, (16 * 16) / S.h];
    for (const d of ['north', 'south', 'east', 'west'] as Dir[]) body.faces[d] = { texture: side, uv: sideUv };
    body.faces.up = { texture: base, uv: [0, (13 * 16) / B.h, (14 * 16) / B.w, (27 * 16) / B.h] };
    return { model: { textures: {}, generated: false, gui: BLOCK_GUI, elements: [body] } };
  }
  return undefined;
}

/** A textura do baú fica de cabeça para baixo no arquivo: troca topo/base e inverte o V das laterais. */
function upsideDown(el: Element): Element {
  const faces: Element['faces'] = {};
  for (const [dir, face] of Object.entries(el.faces) as [Dir, Face][]) {
    const uv = face.uv!;
    if (dir === 'up') faces.down = face;
    else if (dir === 'down') faces.up = face;
    else faces[dir] = { ...face, uv: [uv[0], uv[3], uv[2], uv[1]] };
  }
  return { ...el, faces };
}

function flatSpecial(canvas: Canvas, special: any, textures: TextureStore): boolean {
  const t = stripNs(special.type ?? '');
  const blit = (texRef: string, sx: number, sy: number, sw: number, sh: number, color: [number, number, number] = [255, 255, 255]) => {
    const tex = textures.get(texRef);
    if (!tex) return false;
    const size = canvas.size;
    const scale = Math.min(size / sw, size / sh) * 0.9;
    const ox = (size - sw * scale) / 2;
    const oy = (size - sh * scale) / 2;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = (x + 0.5 - ox) / scale;
        const v = (y + 0.5 - oy) / scale;
        if (u < 0 || v < 0 || u >= sw || v >= sh) continue;
        const [r, g, b, a] = sample(tex, (sx + u) / tex.w, (sy + v) / tex.h);
        if (a < 26) continue;
        canvas.blend(x, y, 0, (r * color[0]) / 255, (g * color[1]) / 255, (b * color[2]) / 255, a / 255);
      }
    return true;
  };
  if (t === 'banner') {
    const DYE: Record<string, number> = {
      white: 0xf9fffe, orange: 0xf9801d, magenta: 0xc74ebd, light_blue: 0x3ab3da, yellow: 0xfed83d, lime: 0x80c71f,
      pink: 0xf38baa, gray: 0x474f52, light_gray: 0x9d9d97, cyan: 0x169c9c, purple: 0x8932b8, blue: 0x3c44aa,
      brown: 0x835432, green: 0x5e7c16, red: 0xb02e26, black: 0x1d1d21,
    };
    const c = argb(DYE[stripNs(special.color ?? 'white')] ?? 0xffffff);
    return blit('entity/banner/banner_base', 1, 1, 20, 40, c) || blit('entity/banner_base', 1, 1, 20, 40, c);
  }
  if (t === 'shield') return blit('entity/shield/shield_base_nopattern', 1, 1, 12, 22) || blit('entity/shield_base_nopattern', 1, 1, 12, 22);
  return false;
}

/* ------------------------------------------------------------------ */
/* API                                                                  */
/* ------------------------------------------------------------------ */

export interface IconReport {
  rendered: number;
  kinds: Record<string, number>;
  missing: string[];
  /** Posição de cada item no atlas (índice). */
  index: Record<string, number>;
  columns: number;
  /** Itens desenhados em 3D (bloco isométrico). */
  iso: string[];
}

export function renderIcons(jar: Jar, itemIds: string[], outDir: string, sizes = [32, 64]): IconReport {
  const textures = new TextureStore(jar);
  const tints = new Tints(textures);
  const report: IconReport = { rendered: 0, kinds: {}, missing: [], index: {}, columns: 0, iso: [] };
  const rendered = new Map<number, Map<string, Canvas>>(sizes.map((s) => [s, new Map()]));

  for (const id of itemIds) {
    const def = jar.tryJson<any>(`assets/minecraft/items/${id}.json`);
    if (!def) {
      report.missing.push(id);
      continue;
    }
    const picked = pick(def.model);
    for (const size of sizes) {
      const canvas = new Canvas(size);
      let kind = 'unknown';
      if (picked.parts) {
        const first = loadModel(jar, picked.parts[0].model);
        renderElements(
          canvas,
          picked.parts.map((p) => ({ model: loadModel(jar, p.model), tints: p.tints, transform: p.transform })),
          textures,
          tints,
          first.gui ?? BLOCK_GUI,
        );
        kind = 'composite';
      } else if (picked.special) {
        const sm = specialModel(picked.special, textures);
        if (sm) {
          renderElements(canvas, [{ model: sm.model, tints: [], transform: IDENTITY }], textures, tints, sm.model.gui!);
          kind = 'special3d';
        } else if (flatSpecial(canvas, picked.special, textures)) kind = 'special2d';
        else {
          const base = picked.model ? loadModel(jar, picked.model) : undefined;
          const particle = base ? resolveTexture(base, '#particle') : undefined;
          if (particle) {
            const cube: ResolvedModel = {
              textures: { all: particle },
              generated: false,
              gui: BLOCK_GUI,
              elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: Object.fromEntries((['up', 'north', 'east', 'south', 'west', 'down'] as Dir[]).map((d) => [d, { texture: '#all' }])) }],
            };
            renderElements(canvas, [{ model: cube, tints: [], transform: IDENTITY }], textures, tints, BLOCK_GUI);
            kind = 'special-particle';
          }
        }
      } else if (picked.model) {
        const model = loadModel(jar, picked.model);
        if (model.generated) {
          renderGenerated(canvas, model, picked.tints, textures, tints);
          kind = 'flat';
        } else if (model.elements) {
          renderElements(canvas, [{ model, tints: picked.tints, transform: IDENTITY }], textures, tints, model.gui ?? BLOCK_GUI);
          kind = 'block3d';
        }
      }
      if (canvas.isEmpty()) {
        if (size === sizes[0]) report.missing.push(id);
        continue;
      }
      if (size === sizes[0]) {
        report.kinds[kind] = (report.kinds[kind] ?? 0) + 1;
        report.rendered++;
        if (kind !== 'flat' && kind !== 'special2d') report.iso.push(id);
      }
      rendered.get(size)!.set(id, canvas);
    }
  }

  // Monta um atlas por tamanho (um único PNG é mais leve e fica em cache offline).
  const ids = [...rendered.get(sizes[0])!.keys()].sort();
  const columns = Math.ceil(Math.sqrt(ids.length));
  const rows = Math.ceil(ids.length / columns);
  ids.forEach((id, i) => (report.index[id] = i));
  report.columns = columns;
  fs.mkdirSync(outDir, { recursive: true });
  for (const size of sizes) {
    const atlas = new PNG({ width: columns * size, height: rows * size });
    atlas.data.fill(0);
    ids.forEach((id, i) => {
      const c = rendered.get(size)!.get(id);
      if (!c) return;
      const ox = (i % columns) * size;
      const oy = Math.floor(i / columns) * size;
      const src = PNG.sync.read(c.toPng());
      PNG.bitblt(src, atlas, 0, 0, size, size, ox, oy);
    });
    fs.writeFileSync(path.join(outDir, `atlas-${size}.png`), PNG.sync.write(atlas, { deflateLevel: 9 }));
  }
  return report;
}
