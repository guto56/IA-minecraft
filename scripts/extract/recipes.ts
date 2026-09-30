import { stripNs, type Jar } from './util.ts';
import type { TagMap } from './tags.ts';

/** Um slot de ingrediente: lista de itens aceitos (tag já expandida). */
export interface Ingredient {
  items: string[];
  tag?: string;
}

export type Station =
  | 'crafting'
  | 'smelting'
  | 'blasting'
  | 'smoking'
  | 'campfire'
  | 'stonecutting'
  | 'smithing'
  | 'brewing';

export interface Recipe {
  id: string;
  station: Station;
  /** shaped | shapeless | transmute | cooking | stonecutting | smithing_transform | smithing_trim | brewing | special */
  kind: string;
  /** Para bancada: 9 posições (3x3) com índice em `ingredients` ou null. */
  grid?: (number | null)[];
  width?: number;
  height?: number;
  ingredients: Ingredient[];
  result: { id: string; count: number; potion?: string };
  /** Ferraria: template, base, adição (índices em ingredients 0,1,2). Alquimia: input 0, reagente 1. */
  xp?: number;
  /** Tempo em ticks (apenas fornalha/fogueira, onde o valor do jar é o tempo real). */
  time?: number;
  /** Poção de entrada (alquimia). */
  inputPotion?: string;
  group?: string;
  category?: string;
}

const STATION_BY_TYPE: Record<string, Station> = {
  crafting_shaped: 'crafting',
  crafting_shapeless: 'crafting',
  crafting_transmute: 'crafting',
  crafting_imbue: 'crafting',
  crafting_decorated_pot: 'crafting',
  crafting_special_firework_rocket: 'crafting',
  crafting_special_firework_star: 'crafting',
  crafting_special_bookcloning: 'crafting',
  crafting_dye: 'crafting',
  smelting: 'smelting',
  blasting: 'blasting',
  smoking: 'smoking',
  campfire_cooking: 'campfire',
  stonecutting: 'stonecutting',
  smithing_transform: 'smithing',
  smithing_trim: 'smithing',
  brewing: 'brewing',
};

export function extractRecipes(jar: Jar, tags: TagMap, itemIds: Set<string>, skipped: string[]): Recipe[] {
  const ing = (v: unknown): Ingredient => {
    if (typeof v === 'string') {
      if (v.startsWith('#')) {
        const tag = stripNs(v.slice(1));
        const items = tags[tag];
        if (!items || !items.length) throw new Error(`Tag vazia/inexistente: ${v}`);
        return { items: items.filter((i) => itemIds.has(i)), tag };
      }
      return { items: [stripNs(v)] };
    }
    if (Array.isArray(v)) return { items: v.flatMap((x) => ing(x).items) };
    if (v && typeof v === 'object' && 'item' in (v as object)) return ing((v as { item: string }).item);
    throw new Error(`Ingrediente desconhecido: ${JSON.stringify(v)}`);
  };
  const result = (r: any) => ({ id: stripNs(r.id), count: r.count ?? 1 });

  const recipes: Recipe[] = [];
  const prefix = 'data/minecraft/recipe/';
  for (const file of jar.list(prefix)) {
    const id = file.slice(prefix.length, -5);
    const r = jar.json<any>(file);
    const type = stripNs(r.type);
    const station = STATION_BY_TYPE[type];
    if (!station) {
      skipped.push(`${id} (${type})`);
      continue;
    }
    const base = { id, station, group: r.group, category: r.category };
    switch (type) {
      case 'crafting_shaped': {
        const pattern: string[] = r.pattern;
        const keys = Object.keys(r.key);
        const ingredients = keys.map((k) => ing(r.key[k]));
        const width = Math.max(...pattern.map((p) => p.length));
        const grid: (number | null)[] = Array(9).fill(null);
        pattern.forEach((row, y) =>
          [...row].forEach((ch, x) => {
            if (ch !== ' ') grid[y * 3 + x] = keys.indexOf(ch);
          }),
        );
        recipes.push({ ...base, kind: 'shaped', grid, width, height: pattern.length, ingredients, result: result(r.result) });
        break;
      }
      case 'crafting_shapeless': {
        const ingredients = (r.ingredients as unknown[]).map(ing);
        const grid = Array.from({ length: 9 }, (_, i) => (i < ingredients.length ? i : null));
        const res = result(r.result);
        recipes.push({ ...base, kind: 'shapeless', grid, ingredients, result: res });
        break;
      }
      case 'crafting_transmute': {
        const ingredients = [ing(r.input), ing(r.material)];
        // Resultado vazio = mesmo item da entrada (ex.: clonar mapa: mapa + mapa vazio = 2 mapas).
        const res = r.result?.id
          ? result(r.result)
          : { id: ingredients[0].items[0], count: 1 + (r.add_material_count_to_result ? (r.material_count?.min ?? 1) : 0) };
        recipes.push({ ...base, kind: 'transmute', grid: [0, 1, null, null, null, null, null, null, null], ingredients, result: res });
        break;
      }
      case 'crafting_dye': {
        const ingredients = [ing(r.target), ing(r.dye)];
        recipes.push({ ...base, kind: 'shapeless', grid: [0, 1, null, null, null, null, null, null, null], ingredients, result: result(r.result) });
        break;
      }
      case 'crafting_imbue': {
        // 8 do material em volta da fonte (flecha com efeito: 8 flechas + poção persistente no centro).
        const ingredients = [ing(r.material), ing(r.source)];
        recipes.push({ ...base, kind: 'shaped', grid: [0, 0, 0, 0, 1, 0, 0, 0, 0], width: 3, height: 3, ingredients, result: result(r.result) });
        break;
      }
      case 'crafting_decorated_pot': {
        const ingredients = [ing(r.back), ing(r.left), ing(r.right), ing(r.front)];
        recipes.push({ ...base, kind: 'shaped', grid: [null, 0, null, 1, null, 2, null, 3, null], width: 3, height: 3, ingredients, result: result(r.result) });
        break;
      }
      case 'crafting_special_firework_rocket': {
        const ingredients = [ing(r.shell), ing(r.fuel)];
        recipes.push({ ...base, kind: 'shapeless', grid: [0, 1, null, null, null, null, null, null, null], ingredients, result: result(r.result) });
        break;
      }
      case 'crafting_special_firework_star': {
        const ingredients = [ing(r.fuel), ing(r.dye)];
        recipes.push({ ...base, kind: 'shapeless', grid: [0, 1, null, null, null, null, null, null, null], ingredients, result: result(r.result) });
        break;
      }
      case 'crafting_special_bookcloning': {
        const ingredients = [ing(r.source), ing(r.material)];
        recipes.push({ ...base, kind: 'shapeless', grid: [0, 1, null, null, null, null, null, null, null], ingredients, result: { id: stripNs(r.result.id), count: 1 } });
        break;
      }
      case 'smelting':
      case 'blasting':
      case 'smoking':
      case 'campfire_cooking': {
        const rec: Recipe = { ...base, kind: 'cooking', ingredients: [ing(r.ingredient)], result: result(r.result), xp: r.experience ?? 0 };
        if (type === 'smelting' || type === 'campfire_cooking') rec.time = r.cookingtime ?? 200;
        recipes.push(rec);
        break;
      }
      case 'stonecutting':
        recipes.push({ ...base, kind: 'stonecutting', ingredients: [ing(r.ingredient)], result: result(r.result) });
        break;
      case 'smithing_transform':
        recipes.push({ ...base, kind: 'smithing_transform', ingredients: [ing(r.template), ing(r.base), ing(r.addition)], result: result(r.result) });
        break;
      case 'smithing_trim': {
        const template = ing(r.template);
        recipes.push({ ...base, kind: 'smithing_trim', ingredients: [template, ing(r.base), ing(r.addition)], result: { id: template.items[0], count: 1 } });
        break;
      }
      case 'brewing': {
        const inputItem = stripNs(r.input.item);
        const inputPotion = r.input.potion_contents?.potions ? stripNs(r.input.potion_contents.potions) : undefined;
        const outPotion = r.output.components?.['minecraft:potion_contents']?.potion;
        recipes.push({
          ...base,
          kind: 'brewing',
          ingredients: [{ items: [inputItem] }, ing(r.reagent)],
          inputPotion,
          result: { id: stripNs(r.output.id), count: 1, potion: outPotion ? stripNs(outPotion) : undefined },
        });
        break;
      }
    }
  }
  return recipes;
}
