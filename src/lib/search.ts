import Fuse from 'fuse.js';
import { allEntities, type Entity } from '../engine/entities';
import { canonical, phonetic } from '../engine/normalize';

/** Busca de itens/entidades para o autocomplete e o Ctrl+K. */
const entities = allEntities();
const docs = entities.map((e) => ({ e, key: phonetic(canonical(e.label)), raw: canonical(e.label) }));
const fuse = new Fuse(docs, { keys: ['key', 'raw'], threshold: 0.3, ignoreLocation: true, minMatchCharLength: 2 });

const KIND_ORDER: Record<Entity['kind'], number> = { item: 0, mob: 1, farm: 2, potion: 3, enchantment: 4, structure: 5, biome: 6, profession: 7, tip: 8, novidade: 9 };

export function searchEntities(query: string, limit = 8, kinds?: Entity['kind'][]): Entity[] {
  const q = canonical(query);
  if (q.length < 2) return [];
  const pool = fuse.search(phonetic(q), { limit: limit * 4 }).map((r) => r.item);
  // Nomes que começam com o que foi digitado vêm primeiro.
  const starts = docs.filter((d) => d.raw.startsWith(q)).slice(0, limit * 2);
  const seen = new Set<string>();
  const out: Entity[] = [];
  for (const d of [...starts, ...pool]) {
    const k = `${d.e.kind}:${d.e.id}`;
    if (seen.has(k) || (kinds && !kinds.includes(d.e.kind))) continue;
    seen.add(k);
    out.push(d.e);
  }
  return out.sort((a, b) => Number(!canonical(b.label).startsWith(q)) - Number(!canonical(a.label).startsWith(q)) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]).slice(0, limit);
}

export const KIND_LABEL: Record<Entity['kind'], string> = {
  item: 'item',
  mob: 'mob',
  farm: 'farm',
  potion: 'poção',
  enchantment: 'encantamento',
  structure: 'estrutura',
  biome: 'bioma',
  profession: 'aldeão',
  tip: 'dica',
  novidade: 'novidade',
};

/** Pergunta padrão ao escolher uma entidade na busca. */
export function defaultQuestion(e: Entity): string {
  switch (e.kind) {
    case 'item':
      return `Como faz ${e.label}?`;
    case 'mob':
      return `O que é ${e.label}?`;
    case 'structure':
    case 'biome':
      return `Onde fica ${e.label}?`;
    case 'profession':
      return `Trocas do ${e.label}`;
    default:
      return e.label;
  }
}
