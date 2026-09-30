import { stripNs, type Jar } from './util.ts';
import type { TagMap } from './tags.ts';

export interface Drop {
  item: string;
  min: number;
  max: number;
  /** Probabilidade (0-1) de dropar pelo menos 1, sem encantamentos. */
  chance: number;
  looting?: boolean;
  fortune?: boolean;
  silkTouch?: boolean;
  shears?: boolean;
  playerKill?: boolean;
  /** Vira a versão cozida se o mob morrer em chamas. */
  cookedOnFire?: boolean;
  /** Só dropa sob condição específica (ex.: morto por esqueleto). */
  special?: string;
}

export interface LootTable {
  id: string;
  kind: 'entity' | 'block' | 'gameplay' | 'chest' | 'other';
  drops: Drop[];
}

interface Flags {
  chance: number;
  looting?: boolean;
  fortune?: boolean;
  silkTouch?: boolean;
  shears?: boolean;
  playerKill?: boolean;
  special?: string;
  noSilk?: boolean;
}

function asArray<T>(v: T | T[] | undefined): T[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

function numberRange(v: any): [number, number] {
  if (typeof v === 'number') return [v, v];
  if (!v || typeof v !== 'object') return [1, 1];
  const t = stripNs(v.type ?? 'uniform');
  if (t === 'constant') return numberRange(v.value);
  if (t === 'uniform') return [numberRange(v.min)[0], numberRange(v.max)[1]];
  if (t === 'binomial') return [0, numberRange(v.n)[1]];
  return [1, 1];
}

export function extractLoot(jar: Jar, itemTags: TagMap, itemIds: Set<string>): Record<string, LootTable> {
  const predicates = new Map<string, any>();
  for (const f of jar.list('data/minecraft/predicate/')) predicates.set(f.slice('data/minecraft/predicate/'.length, -5), jar.json(f));

  const applyCondition = (cond: any, flags: Flags): Flags => {
    if (typeof cond === 'string') {
      const p = predicates.get(stripNs(cond));
      if (stripNs(cond) === 'tool/can_silk_touch') return { ...flags, silkTouch: true };
      if (stripNs(cond) === 'tool/can_shear') return { ...flags, shears: true };
      return p ? applyCondition(p, flags) : flags;
    }
    const t = stripNs(cond.type ?? '');
    switch (t) {
      case 'random_chance':
        return { ...flags, chance: flags.chance * numberRange(cond.chance)[0] };
      case 'random_chance_with_enchanted_bonus':
        return { ...flags, chance: flags.chance * (numberRange(cond.unenchanted_chance)[0] || 0), looting: true };
      case 'table_bonus':
        return { ...flags, chance: flags.chance * (cond.chances?.[0] ?? 1), fortune: true };
      case 'killed_by_player':
        return { ...flags, playerKill: true };
      case 'match_tool': {
        const s = JSON.stringify(cond.predicate ?? {});
        if (s.includes('silk_touch')) return { ...flags, silkTouch: true };
        if (s.includes('shears')) return { ...flags, shears: true };
        return flags;
      }
      case 'inverted': {
        if (JSON.stringify(cond.term).includes('frog')) return flags;
        const inner = applyCondition(cond.term, { chance: 1 });
        if (inner.silkTouch) return { ...flags, noSilk: true };
        return flags;
      }
      case 'all_of':
        return asArray(cond.terms).reduce((f, c) => applyCondition(c, f), flags);
      case 'any_of': {
        const inner = asArray(cond.terms).map((c) => applyCondition(c, { chance: 1 }));
        if (inner.some((f) => f.silkTouch) && inner.some((f) => f.shears)) return { ...flags, shears: true, special: 'tesoura ou Toque Suave' };
        if (inner.every((f) => f.silkTouch)) return { ...flags, silkTouch: true };
        if (inner.every((f) => f.shears)) return { ...flags, shears: true };
        return flags;
      }
      case 'entity_properties': {
        const s = JSON.stringify(cond.predicate ?? {});
        if (cond.entity === 'attacker' && s.includes('skeleton')) return { ...flags, special: 'morto por flecha de esqueleto' };
        if (cond.entity === 'attacker' && s.includes('frog')) return { ...flags, special: 'comido por um sapo' };
        if (s.includes('charged') || s.includes('powered')) return { ...flags, special: 'morto por creeper carregado' };
        if (s.includes('is_baby') && s.includes('chicken')) return { ...flags, special: 'zumbi bebê montado em galinha' };
        if (s.includes('sheep/color')) {
          const color = /"minecraft:sheep\/color":"([a-z_]+)"/.exec(s)?.[1];
          return { ...flags, special: color ? `ovelha da cor ${color}` : 'depende da cor da ovelha' };
        }
        if (s.includes('zombie_horse')) return { ...flags, special: 'montado em cavalo zumbi' };
        if (s.includes('camel_husk')) return { ...flags, special: 'montado em camelo zumbi' };
        if (s.includes('cube_mob') && s.includes('"size":1')) return { ...flags, special: 'só o menor tamanho' };
        if (s.includes('cube_mob')) return { ...flags, special: 'não dropa do menor tamanho' };
        if (s.includes('chicken/variant')) {
          const v = /chicken\/variant":"minecraft:([a-z]+)"/.exec(s)?.[1];
          return { ...flags, special: `galinha ${v === 'warm' ? 'quente' : v === 'cold' ? 'fria' : 'temperada'}` };
        }
        if (s.includes('is_captain')) return { ...flags, special: 'capitão de patrulha/invasão' };
        if (s.includes('in_open_water')) return { ...flags, special: 'pesca em água aberta (tesouro)' };
        if (s === '{}') return flags;
        if (s.includes('is_on_fire')) return flags;
        return { ...flags, special: flags.special ?? 'condição especial' };
      }
      case 'damage_source_properties': {
        const s = JSON.stringify(cond.predicate ?? {});
        if (s.includes('frog/variant')) {
          const v = /frog\/variant":"minecraft:([a-z]+)"/.exec(s)?.[1];
          return { ...flags, special: `comido por sapo ${v === 'warm' ? 'quente (branco)' : v === 'cold' ? 'frio (verde)' : 'temperado (laranja)'}` };
        }
        if (s.includes('frog')) return { ...flags, special: 'comido por um sapo' };
        if (s.includes('is_lightning')) return { ...flags, special: 'morto por raio' };
        if (s.includes('fireball')) return { ...flags, special: 'morto pela própria bola de fogo rebatida' };
        if (s.includes('creeper') || s.includes('is_explosion')) return { ...flags, special: 'morto por explosão de creeper carregado' };
        return { ...flags, special: flags.special ?? 'condição especial' };
      }
      default:
        return flags;
    }
  };

  const tables = new Map<string, any>();
  for (const f of jar.list('data/minecraft/loot_table/')) tables.set(f.slice('data/minecraft/loot_table/'.length, -5), jar.json(f));

  const collect = (tableId: string, out: Drop[], parentFlags: Flags, depth: number) => {
    const table = tables.get(tableId);
    if (!table || depth > 5) return;
    for (const pool of asArray<any>(table.pools)) {
      let pf = { ...parentFlags };
      for (const c of [...asArray(pool.condition), ...asArray(pool.conditions)]) pf = applyCondition(c, pf);
      const [rMin, rMax] = numberRange(pool.rolls);
      const rolls = (rMin + rMax) / 2 || 1;
      const entries = asArray<any>(pool.entries);
      // Entradas com condição própria costumam ser mutuamente exclusivas (ex.: variante do sapo):
      // cada uma disputa o peso só com as entradas sem condição.
      const hasCond = (e: any) => e.condition !== undefined || e.conditions !== undefined;
      const free = entries.filter((e) => !hasCond(e)).reduce((s, e) => s + (e.weight ?? 1), 0);
      for (const e of entries) {
        const total = (hasCond(e) ? free + (e.weight ?? 1) : free) || 1;
        const w = (e.weight ?? 1) / total;
        let single = w;
        if (w < 1) single = 1 - Math.pow(1 - w, rolls);
        handleEntry(e, out, { ...pf, chance: pf.chance * single }, depth);
      }
    }
  };

  const handleEntry = (e: any, out: Drop[], flags: Flags, depth: number) => {
    let f = flags;
    for (const c of [...asArray(e.condition), ...asArray(e.conditions)]) f = applyCondition(c, f);
    const t = stripNs(e.type ?? '');
    if (t === 'alternatives' || t === 'group' || t === 'sequence') {
      const children = asArray<any>(e.children);
      children.forEach((child, i) => {
        // Em "alternatives", os filhos depois de um filho com Toque Suave valem quando NÃO há Toque Suave.
        const prev = children.slice(0, i).map((c) => [...asArray(c.condition), ...asArray(c.conditions)].reduce((ff: Flags, cc) => applyCondition(cc, ff), { chance: 1 }));
        const childFlags = t === 'alternatives' && prev.some((p) => p.silkTouch || p.shears) ? { ...f, noSilk: true } : f;
        handleEntry(child, out, childFlags, depth);
      });
      return;
    }
    if (t === 'loot_table') {
      if (typeof e.value === 'string') collect(stripNs(e.value), out, f, depth + 1);
      return;
    }
    if (t === 'empty') return;
    let names: string[] = [];
    if (t === 'item') names = [stripNs(e.name)];
    if (t === 'tag') {
      names = itemTags[stripNs(String(e.name ?? e.items).replace('#', ''))] ?? [];
      // expand=true: sorteia UM item da tag.
      if (e.expand && names.length) f = { ...f, chance: f.chance / names.length };
    }
    let min = 1;
    let max = 1;
    let looting = f.looting;
    let fortune = f.fortune;
    let cooked = false;
    for (const m of [...asArray<any>(e.modifier), ...asArray<any>(e.functions)]) {
      const mt = stripNs(m.type ?? m.function ?? '');
      if (mt === 'set_count') {
        const [a, b] = numberRange(m.count);
        if (m.add) {
          min += a;
          max += b;
        } else {
          min = a;
          max = b;
        }
      } else if (mt === 'enchanted_count_increase' || mt === 'looting_enchant') looting = true;
      else if (mt === 'apply_bonus' && String(m.enchantment).includes('fortune')) fortune = true;
      else if (mt === 'furnace_smelt') cooked = true;
      else if (mt === 'limit_count' && m.limit?.max !== undefined) max = Math.min(max, numberRange(m.limit.max)[1]);
    }
    let chance = f.chance;
    if (min <= 0 && max > 0) {
      // set_count uniforme sorteia um inteiro em [min, max]: chance de sair pelo menos 1.
      chance = f.chance * (max / (max - min + 1));
      min = 0;
    }
    for (const name of names) {
      if (!itemIds.has(name)) continue;
      const d: Drop = { item: name, min: Math.max(0, min), max: Math.max(0, max), chance: Math.round(Math.min(1, chance) * 10000) / 10000 };
      if (looting) d.looting = true;
      if (fortune) d.fortune = true;
      if (f.silkTouch) d.silkTouch = true;
      if (f.shears) d.shears = true;
      if (f.playerKill) d.playerKill = true;
      if (cooked) d.cookedOnFire = true;
      if (f.special) d.special = f.special;
      out.push(d);
    }
  };

  const result: Record<string, LootTable> = {};
  for (const id of tables.keys()) {
    const kind: LootTable['kind'] = id.startsWith('entities/')
      ? 'entity'
      : id.startsWith('blocks/')
        ? 'block'
        : id.startsWith('gameplay/')
          ? 'gameplay'
          : id.startsWith('chests/')
            ? 'chest'
            : 'other';
    if (kind === 'other') continue;
    if (kind === 'entity' && id.split('/').length > 2) continue;
    const drops: Drop[] = [];
    collect(id, drops, { chance: 1 }, 0);
    // Une entradas iguais do mesmo item (mesmas condições).
    const merged = new Map<string, Drop>();
    for (const d of drops) {
      const k = [d.item, d.silkTouch, d.shears, d.special, d.playerKill].join('|');
      const prev = merged.get(k);
      if (prev) {
        prev.max = Math.max(prev.max, d.max);
        prev.min = Math.min(prev.min, d.min);
        prev.chance = Math.min(1, Math.round((1 - (1 - prev.chance) * (1 - d.chance)) * 10000) / 10000);
        prev.looting ||= d.looting;
        prev.fortune ||= d.fortune;
      } else merged.set(k, { ...d });
    }
    // Lã da ovelha: uma entrada por cor vira uma só (a cor da ovelha decide).
    const wool = [...merged.entries()].filter(([, d]) => d.special?.startsWith('ovelha da cor'));
    if (wool.length > 1) {
      for (const [k] of wool) merged.delete(k);
      const white = wool.find(([, d]) => d.item === 'white_wool')?.[1] ?? wool[0][1];
      merged.set('wool', { ...white, special: 'lã da mesma cor da ovelha' });
    }
    // Toque Suave que devolve o mesmo item de um drop normal é redundante.
    const list = [...merged.values()].filter(
      (d) => !(d.silkTouch && [...merged.values()].some((o) => o !== d && o.item === d.item && !o.silkTouch && !o.shears)),
    );
    if (kind === 'block') {
      const blockId = id.slice('blocks/'.length);
      const trivial = list.length <= 1 && (list.length === 0 || (list[0].item === blockId && !list[0].silkTouch && list[0].chance === 1 && list[0].max === 1));
      if (trivial) continue;
    }
    result[id] = { id, kind, drops: list };
  }
  return result;
}
