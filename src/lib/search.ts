import Fuse from 'fuse.js';
import { allEntities, type Entity } from '../engine/entities';
import { applySynonyms, canonical, normalize, phonetic } from '../engine/normalize';

/** Busca de itens/entidades para o autocomplete e o Ctrl+K. */
const entities = allEntities();
const docs = entities.map((e) => ({ e, key: phonetic(canonical(e.label)), raw: canonical(e.label) }));
const fuse = new Fuse(docs, { keys: ['key', 'raw'], threshold: 0.3, ignoreLocation: true, minMatchCharLength: 2, includeScore: true });

const KIND_ORDER: Record<Entity['kind'], number> = { item: 0, mob: 1, farm: 2, potion: 3, enchantment: 4, structure: 5, biome: 6, profession: 7, tip: 8, novidade: 9 };

export function searchEntities(query: string, limit = 8, kinds?: Entity['kind'][]): Entity[] {
  if (normalize(query).length < 2) return [];
  // Gírias valem na busca também (dima → diamante), mas sem trocar palavras soltas por nomes compostos.
  const syn = canonical(applySynonyms(normalize(query)));
  const q = syn.split(' ').length <= canonical(query).split(' ').length + 1 ? syn : canonical(query);
  // Nomes que começam com o que foi digitado (ou com uma palavra dele) vêm primeiro.
  const starts = docs.filter((d) => d.raw.startsWith(q)).slice(0, limit * 2);
  const wordStarts = docs.filter((d) => !d.raw.startsWith(q) && d.raw.includes(` ${q}`)).slice(0, limit * 2);
  // Fuzzy só completa a lista quando há poucos nomes que batem de verdade (erros de digitação).
  const pool =
    starts.length + wordStarts.length >= limit
      ? []
      : fuse
          .search(phonetic(q), { limit: limit * 4 })
          .filter((r) => (r.score ?? 1) < 0.2)
          .map((r) => r.item);
  const seen = new Set<string>();
  const out: Entity[] = [];
  for (const d of [...starts, ...wordStarts, ...pool]) {
    const k = `${d.e.kind}:${d.e.id}`;
    if (seen.has(k) || (kinds && !kinds.includes(d.e.kind))) continue;
    seen.add(k);
    out.push(d.e);
  }
  const rank = (e: Entity) => {
    const l = canonical(e.label);
    return l === q ? 0 : l.startsWith(q) ? 1 : 2;
  };
  return out.sort((a, b) => rank(a) - rank(b) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.label.length - b.label.length).slice(0, limit);
}

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
