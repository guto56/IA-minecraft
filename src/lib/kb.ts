/**
 * Base de conhecimento: junta os dados extraídos do jar e a curadoria,
 * e monta os índices usados pelo motor e pelos cards.
 */
import itemsJson from '../data/items.json';
import recipesJson from '../data/recipes.json';
import tagsJson from '../data/tags.json';
import lootJson from '../data/loot.json';
import tradesJson from '../data/trades.json';
import enchantmentsJson from '../data/enchantments.json';
import biomesJson from '../data/biomes.json';
import structuresJson from '../data/structures.json';
import oresJson from '../data/ores.json';
import mobsJson from '../data/mobs.json';
import potionsJson from '../data/potions.json';
import professionsJson from '../data/professions.json';
import metaJson from '../data/meta.json';
import farmsJson from '../data/curated/farms.json';
import cMobsJson from '../data/curated/mobs.json';
import cPotionsJson from '../data/curated/potions.json';
import cOresJson from '../data/curated/ores.json';
import cEnchJson from '../data/curated/enchantments.json';
import cProfJson from '../data/curated/professions.json';
import cStructJson from '../data/curated/structures.json';
import tipsJson from '../data/curated/tips.json';
import novidadesJson from '../data/curated/novidades.json';
import type {
  Biome,
  CuratedEnchantment,
  CuratedMob,
  CuratedOre,
  CuratedPotion,
  CuratedProfession,
  CuratedStructure,
  Enchantment,
  Farm,
  Item,
  LootTable,
  Mob,
  Named,
  Novidade,
  Ore,
  Recipe,
  Structure,
  Tip,
  TradeLevel,
} from '../data/types';
import { setIconNameResolver } from '../components/ItemIcon';

export const items = itemsJson as Record<string, Item>;
export const recipes = recipesJson as Recipe[];
export const tags = tagsJson as Record<string, string[]>;
export const loot = lootJson as unknown as Record<string, LootTable>;
export const trades = tradesJson as Record<string, TradeLevel[]>;
export const enchantments = enchantmentsJson as Record<string, Enchantment>;
export const biomes = biomesJson as unknown as Record<string, Biome>;
export const structures = structuresJson as Record<string, Structure>;
export const ores = oresJson as unknown as Record<string, Ore>;
export const mobs = mobsJson as Record<string, Mob>;
export const potions = (potionsJson as { potions: Record<string, Named & { base: string }>; effects: Record<string, Named> }).potions;
export const professions = professionsJson as Record<string, Named>;
export const meta = metaJson;
export const farms = farmsJson as Farm[];
export const curatedMobs = Object.fromEntries((cMobsJson as CuratedMob[]).map((m) => [m.id, m]));
export const curatedPotions = Object.fromEntries((cPotionsJson as CuratedPotion[]).map((p) => [p.id, p]));
export const curatedOres = Object.fromEntries((cOresJson as CuratedOre[]).map((o) => [o.id, o]));
export const curatedEnchantments = Object.fromEntries((cEnchJson as CuratedEnchantment[]).map((e) => [e.id, e]));
export const workstations = Object.fromEntries((cProfJson as CuratedProfession[]).map((p) => [p.profissao, p.item]));
export const curatedStructures = cStructJson as CuratedStructure[];
export const tips = tipsJson as Tip[];
export const novidades = novidadesJson as Novidade[];

export const VERSION = meta.version;
export const GAME_SOURCE = `Java ${VERSION} · fonte: arquivos do jogo`;

/* ------------------------------ índices ------------------------------ */

const STATION_ORDER: Record<string, number> = {
  crafting: 0,
  smithing: 1,
  smelting: 2,
  blasting: 3,
  smoking: 4,
  campfire: 5,
  stonecutting: 6,
  brewing: 7,
};

/** Receitas que produzem o item (bancada primeiro). */
export const recipesByResult = new Map<string, Recipe[]>();
/** Receitas que usam o item como ingrediente (índice reverso para "pra que serve"). */
export const recipesUsing = new Map<string, Recipe[]>();

for (const r of recipes) {
  if (r.station === 'brewing') continue;
  const list = recipesByResult.get(r.result.id) ?? [];
  list.push(r);
  recipesByResult.set(r.result.id, list);
  const seen = new Set<string>();
  for (const ing of r.ingredients) {
    for (const it of ing.items) {
      if (seen.has(it)) continue;
      seen.add(it);
      const u = recipesUsing.get(it) ?? [];
      u.push(r);
      recipesUsing.set(it, u);
    }
  }
}
/** Receita que "desmonta" um bloco de armazenamento (bloco de diamante -> 9 diamantes). */
export function isStorageUncraft(r: Recipe): boolean {
  if (r.station !== 'crafting') return false;
  const distinct = new Set(r.ingredients.flatMap((i) => i.items));
  if (distinct.size !== 1) return false;
  const [ing] = distinct;
  return recipes.some((o) => o.result.id === ing && o.ingredients.some((i) => i.items.includes(r.result.id)));
}
const recipeRank = (r: Recipe) => (isStorageUncraft(r) ? 10 : 0) + STATION_ORDER[r.station];
for (const list of recipesByResult.values()) list.sort((a, b) => recipeRank(a) - recipeRank(b));

export const brewingRecipes = recipes.filter((r) => r.station === 'brewing');

/** Quem dropa cada item: lista de loot tables. */
export const lootByItem = new Map<string, { table: LootTable; drop: LootTable['drops'][number] }[]>();
for (const t of Object.values(loot)) {
  for (const d of t.drops) {
    const list = lootByItem.get(d.item) ?? [];
    list.push({ table: t, drop: d });
    lootByItem.set(d.item, list);
  }
}

/** Trocas por item vendido (gives) e comprado (wants). */
export const tradesByItem = new Map<string, { profession: string; level: string; trade: TradeLevel['trades'][number]; sells: boolean }[]>();
for (const [profession, levels] of Object.entries(trades)) {
  for (const l of levels) {
    for (const t of l.trades) {
      const add = (item: string, sells: boolean) => {
        if (item === 'emerald') return;
        const list = tradesByItem.get(item) ?? [];
        list.push({ profession, level: l.level, trade: t, sells });
        tradesByItem.set(item, list);
      };
      add(t.gives.item, true);
      add(t.wants.item, false);
    }
  }
}

/** Minério pelo item do bloco ou pelo recurso (diamante -> diamond_ore). */
export const oreByItem = new Map<string, Ore>();
for (const o of Object.values(ores)) {
  for (const b of o.blocks) oreByItem.set(b, o);
  const drops = loot[`blocks/${o.id}`]?.drops ?? [];
  for (const d of drops) if (!d.silkTouch && d.item !== o.id) oreByItem.set(d.item, o);
}
// Lingotes vêm do minério bruto.
for (const [raw, ingot] of [
  ['raw_iron', 'iron_ingot'],
  ['raw_gold', 'gold_ingot'],
  ['raw_copper', 'copper_ingot'],
  ['netherite_scrap', 'netherite_scrap'],
] as const) {
  const o = oreByItem.get(raw);
  if (o && !oreByItem.has(ingot)) oreByItem.set(ingot, o);
}

/** Biomas onde cada mob nasce naturalmente. */
export const spawnBiomes = new Map<string, { biome: Biome; weight: number; category: string }[]>();
for (const b of Object.values(biomes)) {
  for (const s of b.spawns) {
    const list = spawnBiomes.get(s.mob) ?? [];
    list.push({ biome: b, weight: s.weight, category: s.category });
    spawnBiomes.set(s.mob, list);
  }
}

export const farmsByProduct = new Map<string, Farm[]>();
for (const f of farms) {
  for (const p of f.produz) {
    const list = farmsByProduct.get(p) ?? [];
    list.push(f);
    farmsByProduct.set(p, list);
  }
}

export function itemName(id: string): string {
  const it = items[id];
  if (!it) return id;
  return it.detail ? `${it.name} (${it.detail})` : it.name;
}

export function mobName(id: string): string {
  return mobs[id]?.name ?? id;
}

export function structureName(family: string): string {
  return curatedStructures.find((s) => s.familia === family)?.nome ?? family.replace(/_/g, ' ');
}

export function farmById(id: string): Farm | undefined {
  return farms.find((f) => f.id === id);
}

/** Ícone para um mob: ovo gerador, se existir. */
export function mobIcon(id: string): string | undefined {
  const egg = `${id}_spawn_egg`;
  return items[egg] ? egg : undefined;
}

setIconNameResolver((id) => items[id]?.name ?? id);
