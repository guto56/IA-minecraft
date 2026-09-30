import type { Recipe } from '../data/types';
import { items, recipesByResult, tags } from './kb';

export interface MaterialLine {
  /** ID do item ou "#tag" quando qualquer item da tag serve. */
  key: string;
  qty: number;
}

/** Conta quantas vezes cada ingrediente aparece em uma receita (por craft). */
export function ingredientCounts(r: Recipe): { key: string; items: string[]; qty: number }[] {
  const counts = new Map<number, number>();
  if (r.grid) {
    for (const g of r.grid) if (g !== null) counts.set(g, (counts.get(g) ?? 0) + 1);
  } else {
    r.ingredients.forEach((_, i) => counts.set(i, 1));
  }
  return [...counts.entries()].map(([i, qty]) => {
    const ing = r.ingredients[i];
    const key = ing.tag && ing.items.length > 1 ? `#${ing.tag}` : ing.items[0];
    return { key, items: ing.items, qty };
  });
}

/** Materiais diretos para produzir `qty` unidades com a receita (arredonda para crafts inteiros). */
export function directMaterials(r: Recipe, qty: number): { crafts: number; lines: MaterialLine[] } {
  const crafts = Math.ceil(qty / r.result.count);
  return { crafts, lines: ingredientCounts(r).map((c) => ({ key: c.key, qty: c.qty * crafts })) };
}

function craftingRecipe(id: string, stack: string[]): Recipe | undefined {
  for (const r of recipesByResult.get(id) ?? []) {
    if (r.station !== 'crafting' || (r.kind !== 'shaped' && r.kind !== 'shapeless')) continue;
    // Evita ciclos de armazenamento (lingote <-> bloco <-> pepita) e receitas que "desfazem" blocos.
    const ingIds = r.ingredients.flatMap((i) => (i.tag && i.items.length > 1 ? [] : i.items));
    if (ingIds.some((i) => stack.includes(i))) continue;
    const reverse = ingIds.some((i) => (recipesByResult.get(i) ?? []).some((rr) => rr.ingredients.some((ing) => ing.items.includes(id))));
    if (reverse) continue;
    return r;
  }
  return undefined;
}

/** Expande até materiais básicos (sem receita de bancada, tags ou ciclos). */
export function rawMaterials(r: Recipe, qty: number): MaterialLine[] {
  const totals = new Map<string, number>();
  const leftovers = new Map<string, number>();
  const walk = (key: string, need: number, stack: string[], depth: number) => {
    if (key.startsWith('#') || depth > 8) {
      totals.set(key, (totals.get(key) ?? 0) + need);
      return;
    }
    const spare = leftovers.get(key) ?? 0;
    const use = Math.min(spare, need);
    leftovers.set(key, spare - use);
    need -= use;
    if (need <= 0) return;
    const rec = craftingRecipe(key, stack);
    if (!rec) {
      totals.set(key, (totals.get(key) ?? 0) + need);
      return;
    }
    const crafts = Math.ceil(need / rec.result.count);
    leftovers.set(key, (leftovers.get(key) ?? 0) + crafts * rec.result.count - need);
    for (const c of ingredientCounts(rec)) walk(c.key, c.qty * crafts, [...stack, key], depth + 1);
  };
  const { crafts } = directMaterials(r, qty);
  for (const c of ingredientCounts(r)) walk(c.key, c.qty * crafts, [r.result.id], 0);
  return [...totals.entries()].map(([key, q]) => ({ key, qty: q })).sort((a, b) => b.qty - a.qty);
}

/** Nome para uma chave de material (item ou tag). */
export function materialLabel(key: string): string {
  if (!key.startsWith('#')) return items[key]?.name ?? key;
  const tag = key.slice(1);
  const TAG_NAMES: Record<string, string> = {
    planks: 'Tábuas (qualquer madeira)',
    logs: 'Troncos (qualquer)',
    wool: 'Lã (qualquer cor)',
    stone_crafting_materials: 'Pedregulho, ardosiabissal ou pedra-negra',
    stone_tool_materials: 'Pedregulho, ardosiabissal ou pedra-negra',
    wooden_slabs: 'Lajes de madeira',
    coals: 'Carvão ou carvão vegetal',
    metal_nuggets: 'Qualquer pepita',
    soul_fire_base_blocks: 'Areia ou terra das almas',
    wooden_tool_materials: 'Tábuas (qualquer madeira)',
    iron_tool_materials: 'Lingote de Ferro',
    diamond_tool_materials: 'Diamante',
    gold_tool_materials: 'Lingote de Ouro',
    copper_tool_materials: 'Lingote de Cobre',
    netherite_tool_materials: 'Lingote de Netherita',
    dyes: 'Qualquer corante',
    trim_materials: 'Material de enfeite',
    trimmable_armor: 'Armadura',
  };
  if (TAG_NAMES[tag]) return TAG_NAMES[tag];
  const first = tags[tag]?.[0];
  return first ? `${items[first]?.name ?? first} (ou similar)` : tag;
}

/** Item representativo de uma chave (para o ícone). */
export function materialIcon(key: string): string {
  if (!key.startsWith('#')) return key;
  return tags[key.slice(1)]?.[0] ?? 'barrier';
}
