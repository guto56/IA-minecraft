import { stripNs, type Jar } from './util.ts';
import type { Lang } from './lang.ts';
import type { TagMap } from './tags.ts';

export type Dimension = 'overworld' | 'nether' | 'end';

export interface MobSpawn {
  mob: string;
  category: string;
  weight: number;
  min: number;
  max: number;
}

export interface Biome {
  id: string;
  name: string;
  nameEn: string;
  dimension: Dimension;
  temperature: number;
  spawns: MobSpawn[];
  structures: string[];
}

export interface Structure {
  id: string;
  /** Agrupa variantes (village_plains -> village). */
  family: string;
  biomes: string[];
}

export interface OrePlacement {
  feature: string;
  distribution: 'trapezoid' | 'uniform';
  min: number;
  max: number;
  /** Pico da distribuição trapezoidal (limitado ao mundo). */
  peak?: [number, number];
  /** Tentativas por chunk (count) ou 1/rarity. */
  perChunk: number;
  size: number;
  airExposureDiscard: number;
  /** Biomas onde a feature é gerada; ['*'] = todos da dimensão. */
  biomes: string[];
  dimension: Dimension;
}

export interface Ore {
  /** Bloco principal do minério (ex.: diamond_ore). */
  id: string;
  blocks: string[];
  placements: OrePlacement[];
}

const DIM_Y: Record<Dimension, { min: number; top: number }> = {
  overworld: { min: -64, top: 319 },
  nether: { min: 0, top: 255 },
  end: { min: 0, top: 255 },
};

function anchor(a: any, dim: Dimension): number {
  if ('absolute' in a) return a.absolute;
  if ('above_bottom' in a) return DIM_Y[dim].min + a.above_bottom;
  if ('below_top' in a) return DIM_Y[dim].top - a.below_top;
  throw new Error(`Âncora vertical desconhecida: ${JSON.stringify(a)}`);
}

export function extractWorld(jar: Jar, lang: Lang, biomeTags: TagMap) {
  const dimOf = (id: string): Dimension =>
    (biomeTags['is_nether'] ?? []).includes(id) ? 'nether' : (biomeTags['is_end'] ?? []).includes(id) ? 'end' : 'overworld';

  // Estruturas
  const structures: Record<string, Structure> = {};
  const sPrefix = 'data/minecraft/worldgen/structure/';
  for (const file of jar.list(sPrefix)) {
    const id = file.slice(sPrefix.length, -5);
    const s = jar.json<any>(file);
    const biomes = typeof s.biomes === 'string' && s.biomes.startsWith('#') ? (biomeTags[stripNs(s.biomes.slice(1))] ?? []) : [s.biomes].flat().map(stripNs);
    const family = id
      .replace(/^(village|abandoned_camp|ruined_portal|ocean_ruin|shipwreck|mineshaft)_.*$/, '$1')
      .replace(/^mineshaft_mesa$/, 'mineshaft');
    structures[id] = { id, family, biomes };
  }

  // Biomas
  const biomes: Record<string, Biome> = {};
  const bPrefix = 'data/minecraft/worldgen/biome/';
  const featureBiomes = new Map<string, Set<string>>();
  for (const file of jar.list(bPrefix)) {
    const id = file.slice(bPrefix.length, -5);
    const b = jar.json<any>(file);
    const key = `biome.minecraft.${id}`;
    const spawns: MobSpawn[] = [];
    const byCat = b.attributes?.['minecraft:gameplay/natural_mob_spawns']?.argument?.spawns_by_category ?? b.spawners ?? {};
    for (const [category, list] of Object.entries<any[]>(byCat)) {
      for (const s of list) {
        const c = s.count;
        const [min, max] = typeof c === 'number' ? [c, c] : c ? [c.min_inclusive ?? c.minCount ?? 1, c.max_inclusive ?? c.maxCount ?? 1] : [s.minCount ?? 1, s.maxCount ?? 1];
        spawns.push({ mob: stripNs(s.type), category, weight: s.weight, min, max });
      }
    }
    for (const step of b.features ?? []) for (const f of step) {
      const fid = stripNs(f);
      if (!featureBiomes.has(fid)) featureBiomes.set(fid, new Set());
      featureBiomes.get(fid)!.add(id);
    }
    biomes[id] = {
      id,
      name: lang.pt[key] ?? lang.en[key] ?? id,
      nameEn: lang.en[key] ?? id,
      dimension: dimOf(id),
      temperature: b.temperature,
      spawns,
      structures: Object.values(structures).filter((s) => s.biomes.includes(id)).map((s) => s.id),
    };
  }

  // Minérios: placed_feature ore_* -> feature (targets) + height_range
  const ores: Record<string, Ore> = {};
  const pPrefix = 'data/minecraft/worldgen/placed_feature/';
  for (const file of jar.list(pPrefix)) {
    const pid = file.slice(pPrefix.length, -5);
    if (!pid.startsWith('ore_')) continue;
    const placed = jar.json<any>(file);
    const featureId = typeof placed.feature === 'string' ? stripNs(placed.feature) : undefined;
    const feature = featureId ? jar.tryJson<any>(`data/minecraft/worldgen/feature/${featureId}.json`) : placed.feature;
    if (!feature || !['minecraft:ore', 'minecraft:scattered_ore'].includes(feature.type)) continue;
    const blocks = [...new Set<string>((feature.targets ?? []).map((t: any) => stripNs(typeof t.state === 'string' ? t.state : t.state.Name)))];
    if (!blocks.some((b) => b.endsWith('_ore') || b === 'ancient_debris')) continue;
    const inBiomes = [...(featureBiomes.get(pid) ?? [])];
    if (!inBiomes.length) continue;
    const dimension = dimOf(inBiomes[0]);
    const allOfDim = Object.values(biomes).filter((b) => b.dimension === dimension && b.id !== 'the_void');
    const everywhere = allOfDim.every((b) => inBiomes.includes(b.id));
    let perChunk = 1;
    let range: any;
    for (const p of placed.placement) {
      const t = stripNs(p.type);
      if (t === 'count') perChunk = typeof p.count === 'number' ? p.count : (p.count.min_inclusive + p.count.max_inclusive) / 2;
      if (t === 'rarity_filter') perChunk = 1 / p.chance;
      if (t === 'height_range') range = p.height;
    }
    if (!range) continue;
    const distribution = stripNs(range.type) === 'trapezoid' ? 'trapezoid' : 'uniform';
    const min = anchor(range.min_inclusive, dimension);
    // No Nether o teto de bedrock fica em Y 127: acima disso não há onde o minério gerar.
    const max = dimension === 'nether' ? Math.min(anchor(range.max_inclusive, dimension), 127) : anchor(range.max_inclusive, dimension);
    const placement: OrePlacement = {
      feature: pid,
      distribution,
      min,
      max,
      perChunk: Math.round(perChunk * 1000) / 1000,
      size: feature.size ?? 0,
      airExposureDiscard: feature.discard_chance_on_air_exposure ?? 0,
      biomes: everywhere ? ['*'] : inBiomes.sort(),
      dimension,
    };
    if (distribution === 'trapezoid') {
      const plateau = range.plateau ?? 0;
      const mid = (min + max) / 2;
      const lo = Math.floor(mid - plateau / 2);
      const hi = Math.ceil(mid + plateau / 2);
      placement.peak = [Math.max(lo, DIM_Y[dimension].min), Math.min(hi, DIM_Y[dimension].top)];
    }
    const main = blocks.find((b) => !b.startsWith('deepslate_')) ?? blocks[0];
    (ores[main] ??= { id: main, blocks, placements: [] }).placements.push(placement);
    for (const b of blocks) if (!ores[main].blocks.includes(b)) ores[main].blocks.push(b);
  }
  return { biomes, structures, ores };
}
