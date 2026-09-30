import fs from 'node:fs';
import path from 'node:path';
import { readJson, stripNs, type Jar } from './util.ts';
import type { Lang } from './lang.ts';

export interface Item {
  id: string;
  name: string;
  nameEn: string;
  stack: number;
  rarity: string;
  durability?: number;
  food?: { nutrition: number; saturation: number };
  /** Tempo de queima em ticks (fornalha comum). */
  fuel?: number;
  /** true se o item é um bloco (item_name vem de block.minecraft.*). */
  block: boolean;
  /** Presente (true) quando o pt_br.json não tem tradução e o nome veio do en_us. */
  noPt?: boolean;
}

/** Avalia um context_int_provider simples (constante ou div com fator normal). */
function evalIntProvider(jar: Jar, ref: unknown, depth = 0): number | undefined {
  if (depth > 8) return undefined;
  if (typeof ref === 'number') return ref;
  if (typeof ref === 'string') {
    const json = jar.tryJson(`data/minecraft/context_int_provider/${stripNs(ref)}.json`);
    return json === undefined ? undefined : evalIntProvider(jar, json, depth + 1);
  }
  if (ref && typeof ref === 'object') {
    const o = ref as Record<string, unknown>;
    if (o.type === 'minecraft:div') {
      const l = evalIntProvider(jar, o.left, depth + 1);
      const r = evalIntProvider(jar, o.right, depth + 1);
      return l !== undefined && r ? Math.floor(l / r) : undefined;
    }
    if (o.type === 'minecraft:conditional') return evalIntProvider(jar, o.on_false, depth + 1);
    if (o.type === 'minecraft:constant') return evalIntProvider(jar, o.value, depth + 1);
  }
  return undefined;
}

export function extractItems(jar: Jar, generated: string, lang: Lang): Record<string, Item> {
  const registries = readJson(path.join(generated, 'reports/registries.json'));
  const ids = Object.keys(registries['minecraft:item'].entries).map(stripNs).filter((id) => id !== 'air');
  const compDir = path.join(generated, 'reports/minecraft/components/item');
  const items: Record<string, Item> = {};
  for (const id of ids) {
    const file = path.join(compDir, `${id}.json`);
    if (!fs.existsSync(file)) throw new Error(`Sem componentes para ${id}`);
    const c = readJson(file).components as Record<string, any>;
    const key: string = c['minecraft:item_name']?.translate ?? `item.minecraft.${id}`;
    const nameEn = lang.en[key];
    if (!nameEn) throw new Error(`Sem tradução en_us para ${id} (${key})`);
    const item: Item = {
      id,
      name: lang.pt[key] ?? nameEn,
      nameEn,
      stack: c['minecraft:max_stack_size'] ?? 64,
      rarity: c['minecraft:rarity'] ?? 'common',
      block: key.startsWith('block.'),
    };
    if (!lang.pt[key]) item.noPt = true;
    if (c['minecraft:max_damage']) item.durability = c['minecraft:max_damage'];
    if (c['minecraft:food']) item.food = { nutrition: c['minecraft:food'].nutrition, saturation: c['minecraft:food'].saturation };
    if (c['minecraft:cooking_fuel']) {
      const t = evalIntProvider(jar, c['minecraft:cooking_fuel'].burn_time);
      if (t) item.fuel = t;
    }
    items[id] = item;
  }
  return items;
}
