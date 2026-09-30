import Fuse from 'fuse.js';
import {
  biomes,
  curatedPotions,
  curatedStructures,
  enchantments,
  farms,
  items,
  mobs,
  novidades,
  potions,
  professions,
  tips,
} from '../lib/kb';
import { applySynonyms, canonical, phonetic } from './normalize';

export type EntityKind = 'item' | 'mob' | 'biome' | 'structure' | 'enchantment' | 'potion' | 'farm' | 'tip' | 'novidade' | 'profession';

export interface Entity {
  kind: EntityKind;
  id: string;
  label: string;
  /** Item usado como ícone. */
  icon?: string;
}

interface Key {
  key: string;
  /** Versão fonética da chave (busca fuzzy). */
  ph: string;
  entity: Entity;
  /** Peso da chave: nome oficial pt > inglês > apelido > id. */
  weight: number;
}

const keys: Key[] = [];
const exact = new Map<string, Key[]>();

function add(entity: Entity, names: (string | undefined)[], weight: number) {
  for (const n of names) {
    if (!n) continue;
    const k = canonical(applySynonyms(canonical(n)));
    if (!k) continue;
    const entry = { key: k, ph: phonetic(k), entity, weight };
    keys.push(entry);
    const list = exact.get(k) ?? [];
    if (!list.some((e) => e.entity.kind === entity.kind && e.entity.id === entity.id)) list.push(entry);
    exact.set(k, list);
  }
}

// Itens: nome pt, nome en, nome + detalhe (disco "Bounce", molde "Enfeite de Fluxo"), id.
for (const it of Object.values(items)) {
  const e: Entity = { kind: 'item', id: it.id, label: it.detail ? `${it.name} (${it.detail})` : it.name, icon: it.id };
  if (it.detail) {
    add(e, [`${it.name} ${it.detail}`, `${it.nameEn} ${it.detailEn}`, it.detail, it.detailEn], 1);
    add(e, [it.detail.replace(/^.*— /, ''), it.detailEn?.replace(/^.*— /, '')], 0.8);
  } else {
    add(e, [it.name], 1);
    add(e, [it.nameEn], 0.95);
  }
  add(e, [it.id.replace(/_/g, ' ')], 0.9);
}

for (const m of Object.values(mobs)) {
  if (m.id === 'player' || m.id === 'armor_stand' || m.id === 'mannequin') continue;
  const icon = items[`${m.id}_spawn_egg`] ? `${m.id}_spawn_egg` : undefined;
  add({ kind: 'mob', id: m.id, label: m.name, icon }, [m.name, m.nameEn, m.id.replace(/_/g, ' ')], 1.05);
}

for (const b of Object.values(biomes)) add({ kind: 'biome', id: b.id, label: b.name }, [b.name, b.nameEn, `bioma ${b.name}`], 0.9);

for (const s of curatedStructures) add({ kind: 'structure', id: s.familia, label: s.nome, icon: s.item }, [s.nome, ...s.apelidos], 0.95);

for (const e of Object.values(enchantments)) add({ kind: 'enchantment', id: e.id, label: e.name, icon: 'enchanted_book' }, [e.name, e.nameEn], 1);

const potionIcon = 'potion';
for (const cp of Object.values(curatedPotions)) {
  const p = potions[cp.pocao];
  add({ kind: 'potion', id: cp.pocao, label: p?.name ?? cp.pocao, icon: potionIcon }, [p?.name, p?.nameEn, ...cp.apelidos.map((a) => `pocao de ${a}`)], 1.02);
  add({ kind: 'potion', id: cp.pocao, label: p?.name ?? cp.pocao, icon: potionIcon }, cp.apelidos, 0.75);
}
for (const base of ['awkward', 'thick', 'mundane']) {
  const p = potions[base];
  if (p) add({ kind: 'potion', id: base, label: p.name, icon: potionIcon }, [p.name, p.nameEn], 1);
}

for (const f of farms) add({ kind: 'farm', id: f.id, label: f.nome, icon: f.produz[0] }, [f.nome, ...f.apelidos], 1.1);

for (const t of tips) add({ kind: 'tip', id: t.id, label: t.titulo, icon: t.itens[0] }, [t.titulo, ...t.apelidos], 0.85);

for (const n of novidades) {
  add({ kind: 'novidade', id: n.id, label: `${n.versao} · ${n.nome}`, icon: n.itens[0] }, [n.nome, n.versao, `versao ${n.versao}`], 1);
  add({ kind: 'novidade', id: n.id, label: `${n.versao} · ${n.nome}`, icon: n.itens[0] }, n.apelidos, 0.85);
}

/** Apelidos das profissões (o pt_br chama armoreiro e armeiro de "Armeiro"). */
const PROFESSION_ALIASES: Record<string, { label?: string; names: string[] }> = {
  armorer: { label: 'Armeiro (armaduras)', names: ['armoreiro', 'ferreiro de armadura', 'ferreiro de armaduras', 'armeiro de armadura'] },
  weaponsmith: { label: 'Armeiro (armas)', names: ['ferreiro de armas', 'espadeiro', 'armeiro de armas'] },
  toolsmith: { names: ['ferreiro de ferramentas', 'ferreiro'] },
  farmer: { names: ['fazendeiro', 'lavrador', 'aldeao fazendeiro'] },
  librarian: { names: ['bibliotecaria', 'aldeao bibliotecario'] },
  cleric: { names: ['padre', 'sacerdote', 'clerigo'] },
  fletcher: { names: ['arqueiro', 'flecheiro'] },
  butcher: { names: ['acougueiro'] },
  cartographer: { names: ['cartografo'] },
  fisherman: { names: ['pescador'] },
  leatherworker: { names: ['coureiro', 'curtidor'] },
  mason: { names: ['pedreiro', 'mestre de obras'] },
  shepherd: { names: ['pastor'] },
  wandering_trader: { names: ['mercador ambulante', 'vendedor ambulante', 'comerciante ambulante'] },
};
export const professionLabel = (id: string) => PROFESSION_ALIASES[id]?.label ?? professions[id]?.name ?? id;

for (const p of Object.values(professions)) {
  if (p.id === 'none' || p.id === 'nitwit') continue;
  const alias = PROFESSION_ALIASES[p.id];
  const names = p.id === 'armorer' || p.id === 'weaponsmith' ? [p.nameEn] : [p.name, p.nameEn];
  add({ kind: 'profession', id: p.id, label: professionLabel(p.id), icon: 'emerald' }, [...names, ...(alias?.names ?? [])], p.id === 'wandering_trader' ? 0.98 : 1.03);
}

const fuse = new Fuse(keys, {
  keys: ['ph'],
  includeScore: true,
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 3,
});

export interface EntityMatch {
  entity: Entity;
  /** 0 (ruim) a 1 (exato). */
  score: number;
  /** Palavras do texto que a entidade explica (índices do token). */
  span: [number, number];
  exact: boolean;
}

/** Todas as entidades com o nome exatamente igual à frase (canônica). */
export function exactMatches(phrase: string): EntityMatch[] {
  return (exact.get(phrase) ?? []).map((k) => ({ entity: k.entity, score: Math.min(1, 0.96 * k.weight + 0.04), span: [0, 0] as [number, number], exact: true }));
}

/** Nomes que começam com a frase ("cama" -> "cama branca", "cama vermelha"...). */
const prefixIndex = new Map<string, Key[]>();
for (const k of keys) {
  if (k.entity.kind !== 'item' && k.entity.kind !== 'mob') continue;
  const parts = k.key.split(' ');
  for (let n = 1; n < parts.length; n++) {
    const pre = parts.slice(0, n).join(' ');
    const list = prefixIndex.get(pre) ?? [];
    list.push(k);
    prefixIndex.set(pre, list);
  }
}

export function prefixMatches(phrase: string): EntityMatch[] {
  if (phrase.length < 3) return [];
  const seen = new Set<string>();
  const out: EntityMatch[] = [];
  for (const k of prefixIndex.get(phrase) ?? []) {
    const id = entityKey(k.entity);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ entity: k.entity, score: 0.9 * Math.min(1, k.weight), span: [0, 0], exact: false });
  }
  return out;
}

/** Busca fuzzy (erros de digitação). */
export function fuzzyMatches(phrase: string, limit = 8): EntityMatch[] {
  if (phrase.length < 3) return [];
  const out: EntityMatch[] = [];
  const seen = new Set<string>();
  for (const r of fuse.search(phonetic(phrase), { limit: limit * 3 })) {
    const k = r.item;
    const id = `${k.entity.kind}:${k.entity.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    // Penaliza chaves muito maiores que a frase (ex.: "tocha" x "tocha de redstone").
    const lenRatio = Math.min(phrase.length, k.key.length) / Math.max(phrase.length, k.key.length);
    const s = (1 - (r.score ?? 1)) * (0.55 + 0.45 * lenRatio) * Math.min(1, k.weight);
    out.push({ entity: k.entity, score: s, span: [0, 0], exact: false });
    if (out.length >= limit) break;
  }
  return out.sort((a, b) => b.score - a.score);
}

export function entityKey(e: Entity) {
  return `${e.kind}:${e.id}`;
}

/** Lista de todos os itens para o autocomplete e a busca direta. */
export function allEntities(): Entity[] {
  const seen = new Set<string>();
  const out: Entity[] = [];
  for (const k of keys) {
    const id = entityKey(k.entity);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(k.entity);
  }
  return out;
}
