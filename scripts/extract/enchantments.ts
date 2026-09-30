import { stripNs, type Jar } from './util.ts';
import type { Lang } from './lang.ts';
import type { TagMap } from './tags.ts';

export interface Enchantment {
  id: string;
  name: string;
  nameEn: string;
  maxLevel: number;
  weight: number;
  anvilCost: number;
  /** Tag de itens que aceitam (bigorna/livro). */
  supportedTag?: string;
  /** Todos os itens que aceitam o encantamento (bigorna/livro). */
  supported: string[];
  /** Tag de itens que recebem na mesa de encantamento. */
  primaryTag?: string;
  exclusiveWith: string[];
  slots: string[];
  treasure: boolean;
  curse: boolean;
  inTable: boolean;
  tradeable: boolean;
}

export function extractEnchantments(jar: Jar, lang: Lang, itemTags: TagMap, enchTags: TagMap): Record<string, Enchantment> {
  const out: Record<string, Enchantment> = {};
  const prefix = 'data/minecraft/enchantment/';
  const tagOf = (v: unknown) => (typeof v === 'string' && v.startsWith('#') ? stripNs(v.slice(1)) : undefined);
  const itemsOf = (v: unknown): string[] => {
    if (typeof v === 'string') return v.startsWith('#') ? (itemTags[stripNs(v.slice(1))] ?? []) : [stripNs(v)];
    if (Array.isArray(v)) return v.flatMap(itemsOf);
    return [];
  };
  for (const file of jar.list(prefix)) {
    const id = file.slice(prefix.length, -5);
    const e = jar.json<any>(file);
    const key = e.description?.translate ?? `enchantment.minecraft.${id}`;
    const supported = itemsOf(e.supported_items);
    let exclusiveWith: string[] = [];
    if (typeof e.exclusive_set === 'string') {
      exclusiveWith = e.exclusive_set.startsWith('#') ? (enchTags[stripNs(e.exclusive_set.slice(1))] ?? []) : [stripNs(e.exclusive_set)];
    } else if (Array.isArray(e.exclusive_set)) exclusiveWith = e.exclusive_set.map(stripNs);
    out[id] = {
      id,
      name: lang.pt[key] ?? lang.en[key],
      nameEn: lang.en[key],
      maxLevel: e.max_level,
      weight: e.weight,
      anvilCost: e.anvil_cost,
      supportedTag: tagOf(e.supported_items),
      supported,
      primaryTag: tagOf(e.primary_items),
      exclusiveWith: exclusiveWith.filter((x) => x !== id),
      slots: e.slots ?? [],
      treasure: (enchTags['treasure'] ?? []).includes(id),
      curse: (enchTags['curse'] ?? []).includes(id),
      inTable: (enchTags['in_enchanting_table'] ?? []).includes(id),
      tradeable: (enchTags['tradeable'] ?? []).includes(id),
    };
  }
  return out;
}
