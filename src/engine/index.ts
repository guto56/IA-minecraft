/**
 * Motor de entendimento (sem IA): normaliza, detecta intenção por regras com peso,
 * extrai a entidade por nome exato ou busca fuzzy e monta a resposta com os dados do jogo.
 */
import { farmsByProduct, items, loot, lootByItem, oreByItem, recipesByResult } from '../lib/kb';
import {
  type Answer,
  barterAnswer,
  clarify,
  enchantmentsForItem,
  dropsAnswer,
  droppedBy,
  enchantmentAnswer,
  farmAnswer,
  farmList,
  infoAnswer,
  locationAnswer,
  mobAnswer,
  notUnderstood,
  novidadeAnswer,
  potionAnswer,
  potionList,
  questionFor,
  recipeAnswer,
  smeltAnswer,
  tipAnswer,
  tradesForItem,
  tradesForProfession,
  usesAnswer,
} from './answers';
import { type Entity, type EntityMatch, entityKey, exactMatches, fuzzyMatches, prefixMatches } from './entities';
import { INTENT_LABEL, INTENT_WORDS, type Intent, scoreIntents } from './intents';
import { STOPWORDS, applySynonyms, canonical, normalize, singular } from './normalize';

export type { Answer } from './answers';
export type { Entity } from './entities';
export type { Intent } from './intents';

export interface Context {
  intent?: Intent;
  entity?: Entity;
}

export interface Trace {
  question: string;
  intent: Intent | null;
  intentLabel: string;
  entity: Entity | null;
  confidence: number;
  source: string;
}

export type RankedMatch = EntityMatch & { rank: number };

export interface Understanding {
  intent: Intent | null;
  intentScore: number;
  match: EntityMatch | null;
  candidates: RankedMatch[];
  quantity: number;
  unknown: string[];
  followUp: boolean;
  /** A regra de receita também disparou (para desempatar com "fundir"). */
  receitaAlso: boolean;
  /** Texto normalizado (com sinônimos). */
  norm: string;
}

export interface EngineResult {
  answers: Answer[];
  traces: Trace[];
  context: Context;
}

const MIN_ENTITY_SCORE = 0.6;
const AMBIGUITY_GAP = 0.035;

const MATERIALS: Record<string, string[]> = {
  madeira: ['wooden'],
  pedra: ['stone'],
  ferro: ['iron'],
  ouro: ['golden', 'gold'],
  diamante: ['diamond'],
  netherita: ['netherite'],
  cobre: ['copper'],
  couro: ['leather'],
  malha: ['chainmail'],
};
const MATERIAL_PREFIX = /^(wooden|stone|iron|golden|gold|diamond|netherite|copper|leather|chainmail)_/;

/** Afinidade entre intenção e tipo de entidade (desempate). */
const AFFINITY: Partial<Record<Intent, Partial<Record<Entity['kind'], number>>>> = {
  drop: { mob: 0.08, item: 0.02 },
  mob_info: { mob: 0.1 },
  farm: { farm: 0.2, item: 0.02 },
  pocao: { potion: 0.15 },
  encantamento: { enchantment: 0.15 },
  troca_aldeao: { profession: 0.1, item: 0.02 },
  onde_achar: { structure: 0.04, biome: 0.04, mob: 0.02, item: 0.03 },
  dica: { tip: 0.2 },
  novidade: { novidade: 0.2 },
  receita: { item: 0.05 },
  fundir: { item: 0.05 },
  usos: { item: 0.05 },
  info: { item: 0.02 },
};

const STOP_CANON = new Set([...STOPWORDS].map(singular));
const INTENT_CANON = new Set([...INTENT_WORDS].map(singular));

function isStop(tok: string) {
  return STOPWORDS.has(tok) || STOP_CANON.has(tok) || /^\d+$/.test(tok) || tok === 'x';
}

function isFiller(tok: string) {
  return isStop(tok) || INTENT_WORDS.has(tok) || INTENT_CANON.has(tok);
}

/** Pontuação mínima do fuzzy conforme o tamanho: palavras curtas erram fácil. */
function fuzzyFloor(phrase: string) {
  const n = phrase.replace(/ /g, '').length;
  return n <= 4 ? 0.86 : n <= 6 ? 0.76 : n <= 8 ? 0.72 : 0.66;
}

/** Procura entidades em todas as janelas de palavras (maior primeiro). */
function findEntities(tokens: string[], intent: Intent | null): { best: RankedMatch | null; candidates: RankedMatch[] } {
  const found: EntityMatch[] = [];
  const n = tokens.length;
  // 1) nomes exatos
  for (let len = Math.min(n, 8); len >= 1; len--) {
    for (let i = 0; i + len <= n; i++) {
      const win = tokens.slice(i, i + len);
      if (win.every(isStop)) continue;
      const phrase = win.join(' ');
      for (const m of exactMatches(phrase)) found.push({ ...m, span: [i, i + len] });
    }
    if (found.length) break;
  }
  // 2) começo de nome ("cama" -> camas de todas as cores)
  if (!found.length) {
    for (let len = Math.min(n, 4); len >= 1 && !found.length; len--) {
      for (let i = 0; i + len <= n; i++) {
        const win = tokens.slice(i, i + len);
        if (win.every(isFiller)) continue;
        for (const m of prefixMatches(win.join(' '))) found.push({ ...m, span: [i, i + len] });
      }
    }
  }
  // 3) fuzzy sobre as palavras de conteúdo
  if (!found.length) {
    const content = tokens.map((t, i) => ({ t, i })).filter((x) => !isFiller(x.t));
    for (let len = Math.min(content.length, 5); len >= 1; len--) {
      for (let i = 0; i + len <= content.length; i++) {
        const win = content.slice(i, i + len);
        const phrase = win.map((x) => x.t).join(' ');
        const floor = fuzzyFloor(phrase);
        for (const m of fuzzyMatches(phrase, 6)) {
          if (m.score < floor) continue;
          // Frases maiores explicam mais o texto: leve bônus por cobertura.
          const coverage = len / Math.max(1, content.length);
          found.push({ ...m, score: m.score * (0.85 + 0.15 * coverage), span: [win[0].i, win[win.length - 1].i + 1] });
        }
      }
    }
  }
  if (!found.length) return { best: null, candidates: [] };
  const affinity = (m: EntityMatch) => (intent ? (AFFINITY[intent]?.[m.entity.kind] ?? 0) : 0);
  const byKey = new Map<string, RankedMatch>();
  for (const m of found) {
    const rank = m.score + affinity(m) + (m.span[1] - m.span[0]) * 0.01;
    const k = entityKey(m.entity);
    const prev = byKey.get(k);
    if (!prev || rank > prev.rank) byKey.set(k, { ...m, rank });
  }
  let sorted = [...byKey.values()].sort((a, b) => b.rank - a.rank);
  // Um item cujo nome é só palavra de intenção ("fornalha" em "vidro na fornalha") perde para os outros.
  const onlyIntent = (m: RankedMatch) => tokens.slice(m.span[0], m.span[1]).every((t) => INTENT_WORDS.has(t) || INTENT_CANON.has(t));
  if (sorted.some((m) => !onlyIntent(m)) && sorted.some(onlyIntent)) {
    const rest = sorted.filter((m) => !onlyIntent(m));
    if (rest[0].score >= MIN_ENTITY_SCORE) sorted = [...rest, ...sorted.filter(onlyIntent).map((m) => ({ ...m, rank: m.rank - 1 }))];
  }
  return { best: sorted[0], candidates: sorted.slice(0, 6) };
}

function extractQuantity(norm: string): number {
  const m = /\b(?:quero|preciso(?: de)?|fazer|faco|craftar|queria|pra fazer|para fazer)?\s*(\d{1,4})\s*(?:x\b)?\s*[a-z]/.exec(norm);
  if (!m) return 1;
  if (/\by\s*-?\d/.test(norm) && new RegExp(`y\\s*-?${m[1]}`).test(norm)) return 1;
  const q = Number(m[1]);
  return q >= 1 && q <= 6400 ? q : 1;
}

export function understand(question: string, ctx: Context = {}): Understanding {
  const norm = applySynonyms(normalize(question));
  const tokens = canonical(norm).split(' ').filter(Boolean);
  const scores = scoreIntents(norm);
  let intent = scores[0]?.intent ?? null;
  const intentScore = scores[0]?.score ?? 0;
  const { best, candidates } = findEntities(tokens, intent);
  const followUp = /^(e|mas e|e ai|e o|e a|e os|e as|e pra|e para|e do|e da|e de)\b/.test(norm) && tokens.length <= 6;

  let match = best;
  // "e a de ferro?" depois de uma receita: troca o material da última entidade.
  if (followUp && ctx.entity?.kind === 'item' && MATERIAL_PREFIX.test(ctx.entity.id)) {
    const mat = Object.keys(MATERIALS).find((k) => new RegExp(`\\b${k}\\b`).test(norm));
    if (mat) {
      for (const prefix of MATERIALS[mat]) {
        const id = ctx.entity.id.replace(MATERIAL_PREFIX, `${prefix}_`);
        if (items[id]) {
          match = { entity: { kind: 'item', id, label: items[id].name, icon: id }, score: 1, rank: 1, span: [0, tokens.length], exact: true };
          break;
        }
      }
    }
  }
  if (!intent && followUp && ctx.intent) intent = ctx.intent;
  if (!intent && !match && ctx.intent && tokens.length <= 3 && best) intent = ctx.intent;

  // Palavras que ninguém explicou (nem intenção, nem entidade, nem stopword).
  const covered = new Set<number>();
  if (match) for (let i = match.span[0]; i < match.span[1]; i++) covered.add(i);
  const unknown = tokens.filter((t, i) => !covered.has(i) && !isFiller(t) && !MATERIALS[t]);

  const receitaAlso = scores.some((x) => x.intent === 'receita' && x.score >= 3);
  return { intent, intentScore, match, candidates, quantity: extractQuantity(norm), unknown, followUp, receitaAlso, norm };
}

const COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'pale_oak', 'mangrove', 'cherry', 'bamboo', 'crimson', 'warped', 'poplar'];
const variantBase = (id: string, list: string[]) => {
  const v = [...list].sort((a, b) => b.length - a.length).find((c) => id.startsWith(`${c}_`));
  return v ? id.slice(v.length + 1) : undefined;
};

/** Mesma coisa em cores/madeiras diferentes: escolhe a padrão (branca / carvalho). */
function familyDefault(list: RankedMatch[], preferAnyMaterial = false): RankedMatch | null {
  if (list.some((c) => c.entity.kind !== 'item')) return null;
  for (const [variants, def] of [
    [COLORS, 'white'],
    [WOODS, 'oak'],
  ] as const) {
    const bases = list.map((c) => variantBase(c.entity.id, [...variants]));
    if (bases.every((x) => x && x === bases[0])) {
      const id = `${def}_${bases[0]}`;
      if (items[id]) return { entity: { kind: 'item', id, label: items[id].name, icon: id }, score: list[0].score, rank: list[0].rank, span: list[0].span, exact: false };
    }
  }
  // Mesma ferramenta/armadura em materiais diferentes: para encantamentos o material não importa.
  const TOOL = /^(wooden|stone|iron|golden|diamond|netherite|copper|leather|chainmail)_(.+)$/;
  const suffixes = list.map((c) => TOOL.exec(c.entity.id)?.[2]);
  if (preferAnyMaterial && suffixes.every((x) => x && x === suffixes[0])) {
    const id = `diamond_${suffixes[0]}`;
    if (items[id]) return { entity: { kind: 'item', id, label: items[id].name, icon: id }, score: list[0].score, rank: list[0].rank, span: list[0].span, exact: false };
  }
  return null;
}

const MATERIAL_ORDER = ['diamond', 'iron', 'netherite', 'stone', 'wooden', 'golden', 'copper', 'leather', 'chainmail'];
function sortByMaterial(list: RankedMatch[]): RankedMatch[] {
  const rank = (m: RankedMatch) => {
    const i = MATERIAL_ORDER.findIndex((p) => m.entity.id.startsWith(`${p}_`));
    return i === -1 ? 99 : i;
  };
  return [...list].sort((a, b) => rank(a) - rank(b) || b.rank - a.rank);
}

/** Item principal ligado a um mob (slime -> bola de slime). */
function mobMainItem(mob: string): RankedMatch | null {
  const drop = loot[`entities/${mob}`]?.drops[0]?.item;
  if (!drop || !items[drop]) return null;
  return { entity: { kind: 'item', id: drop, label: items[drop].name, icon: drop }, score: 0.8, rank: 0.8, span: [0, 0], exact: false };
}

/** Intenção final considerando o tipo da entidade. */
function resolveIntent(intent: Intent | null, e: Entity, receitaAlso = false): Intent {
  switch (e.kind) {
    case 'farm':
      return 'farm';
    case 'tip':
      return 'dica';
    case 'novidade':
      return 'novidade';
    case 'profession':
      return 'troca_aldeao';
    case 'enchantment':
      return 'encantamento';
    case 'potion':
      return intent === 'onde_achar' || intent === 'drop' ? intent : 'pocao';
    case 'structure':
    case 'biome':
      return 'onde_achar';
    case 'mob':
      if (intent === 'drop' || intent === 'onde_achar' || intent === 'farm' || intent === 'troca_aldeao') return intent;
      return 'mob_info';
    case 'item':
      // "como faço uma fornalha": o nome da estação disparou "fundir", mas é pedido de receita.
      if (intent === 'fundir' && ['furnace', 'blast_furnace', 'smoker', 'campfire', 'soul_campfire'].includes(e.id) && receitaAlso) return 'receita';
      if (!intent) {
        if (oreByItem.has(e.id)) return 'onde_achar';
        if (recipesByResult.get(e.id)?.length) return 'receita';
        if (lootByItem.get(e.id)?.length) return 'drop';
        return 'info';
      }
      if (intent === 'mob_info') return 'info';
      if (intent === 'pocao' || intent === 'dica' || intent === 'novidade') return 'info';
      return intent;
  }
}

function answerFor(intent: Intent, e: Entity, u: Understanding): Answer {
  switch (intent) {
    case 'receita':
      return recipeAnswer(e.id, u.quantity);
    case 'fundir':
      return smeltAnswer(e.id);
    case 'onde_achar':
      return locationAnswer(e, u.norm);
    case 'farm':
      return farmAnswer(e);
    case 'drop':
      if (e.kind === 'mob' && e.id === 'piglin' && /\b(ouro|troca|trocar|escambo|barter)\b/.test(u.norm)) return barterAnswer();
      if (e.kind === 'item' && !isBlockWithLoot(e.id)) return droppedBy(e.id);
      return dropsAnswer(e);
    case 'mob_info':
      return mobAnswer(e.id);
    case 'encantamento':
      return e.kind === 'item' ? enchantmentsForItem(e.id) : enchantmentAnswer(e.id);
    case 'pocao':
      return potionAnswer(e.id);
    case 'troca_aldeao':
      if (e.kind === 'mob' && e.id === 'piglin') return barterAnswer();
      return e.kind === 'profession' ? tradesForProfession(e.id) : tradesForItem(e.id);
    case 'dica':
      return tipAnswer(e.id);
    case 'novidade':
      return novidadeAnswer(e.id);
    case 'usos':
      return usesAnswer(e.id);
    case 'info':
      return infoAnswer(e.id);
  }
}

function isBlockWithLoot(id: string) {
  return !!loot[`blocks/${id}`];
}

const DEFAULT_SUGGESTIONS = ['Como faz um pistão?', 'Onde acho diamante?', 'Farm de ferro'];
const INTENT_SUGGESTIONS: Partial<Record<Intent, string[]>> = {
  receita: ['Como faz um pistão?', 'Receita de tocha', 'Como faz mesa de encantamentos?'],
  fundir: ['Ferro bruto na fornalha', 'Como fazer vidro?', 'Areia na fornalha'],
  onde_achar: ['Onde acho diamante?', 'Qual Y do ferro?', 'Onde fica a cidade ancestral?'],
  farm: ['Farm de ferro', 'Farm de cana', 'Farm de ouro'],
  drop: ['O que o creeper dropa?', 'O que o enderman dropa?', 'Quem dropa pólvora?'],
  mob_info: ['O que é o Warden?', 'Como matar o creeper?', 'Quanto de vida tem o blaze?'],
  encantamento: ['O que faz Remendo?', 'Encantamento Fortuna', 'Afiação ou Julgamento?'],
  pocao: ['Poção de visão noturna', 'Poção de força', 'Poção de resistência ao fogo'],
  troca_aldeao: ['Qual aldeão vende livro encantado?', 'Trocas do bibliotecário', 'Quem compra cenoura?'],
  usos: ['Pra que serve redstone?', 'Pra que serve lápis-lazúli?', 'Onde uso ametista?'],
};

function suggestionsFor(u: Understanding): string[] {
  const fromCandidates = u.candidates.filter((c) => c.score > 0.35).slice(0, 3).map((c) => questionFor(u.intent, c.entity));
  const base = (u.intent && INTENT_SUGGESTIONS[u.intent]) || DEFAULT_SUGGESTIONS;
  return [...new Set([...fromCandidates, ...base])].slice(0, 3);
}

function entityFreeAnswer(u: Understanding, norm: string): Answer | null {
  switch (u.intent) {
    case 'novidade':
      return novidadeAnswer(/26_1/.test(norm) ? '26.1' : /26_2/.test(norm) ? '26.2' : null);
    case 'dica':
      return u.unknown.length > 2 ? null : tipAnswer(null);
    case 'farm':
      return u.unknown.length > 1 ? null : farmList(['Qual farm você quer montar?']);
    case 'pocao':
      return u.unknown.length > 1 ? null : potionList();
    default:
      return null;
  }
}

/** Divide perguntas compostas: "como faz pistão e observador". */
function splitCompound(question: string): string[] {
  const norm = normalize(question);
  const parts = norm.split(/\s*(?:,|\be tambem\b|\btambem\b|\be\b|\+)\s*/).filter((p) => p.trim().length > 0);
  if (parts.length < 2 || parts.length > 4) return [question];
  // Só divide se a frase inteira não for um nome e cada parte tiver uma entidade.
  const whole = understand(question);
  if (whole.match?.exact && whole.unknown.length === 0 && whole.match.span[1] - whole.match.span[0] > 1) return [question];
  const ok = parts.every((p) => {
    const u = understand(p);
    return u.match && u.match.score >= MIN_ENTITY_SCORE;
  });
  return ok ? parts : [question];
}

function answerOne(question: string, ctx: Context, inheritedIntent: Intent | null): { answer: Answer; trace: Trace; ctx: Context } {
  const u = understand(question, ctx);
  const norm = applySynonyms(normalize(question));
  const intent0 = u.intent ?? inheritedIntent;
  const trace: Trace = { question, intent: intent0, intentLabel: intent0 ? INTENT_LABEL[intent0] : '—', entity: u.match?.entity ?? null, confidence: 0, source: '' };

  const tooManyUnknown = u.unknown.length >= 2 && (!u.match || u.unknown.length > u.match.span[1] - u.match.span[0]);
  if (!u.match || u.match.score < MIN_ENTITY_SCORE || tooManyUnknown) {
    const free = !tooManyUnknown || u.intent === 'novidade' ? entityFreeAnswer({ ...u, intent: intent0 }, norm) : null;
    if (free && (!u.match || u.match.score < MIN_ENTITY_SCORE)) {
      trace.confidence = Math.min(1, u.intentScore / 4);
      trace.source = free.source;
      return { answer: free, trace, ctx: { intent: intent0 ?? undefined } };
    }
    const ans = notUnderstood(suggestionsFor({ ...u, intent: intent0 }));
    trace.entity = null;
    trace.confidence = u.match ? Math.round(u.match.score * 100) / 100 : 0;
    trace.source = ans.source;
    return { answer: ans, trace, ctx };
  }

  // Ambiguidade: várias entidades diferentes com pontuação parecida.
  let chosen = u.match;
  const top = u.candidates[0];
  if (!u.followUp && top && chosen === top) {
    const rivals = u.candidates.filter((c) => c !== top && top.rank - c.rank <= AMBIGUITY_GAP);
    if (rivals.length) {
      const family = familyDefault([top, ...rivals], intent0 === 'encantamento');
      if (family) chosen = family;
      else {
        const opts = sortByMaterial([top, ...rivals]).slice(0, 4);
        const ans = clarify(opts.map((c) => ({ label: c.entity.label, query: questionFor(intent0 ? resolveIntent(intent0, c.entity) : null, c.entity), icon: c.entity.icon })));
        trace.confidence = Math.round(top.score * 100) / 100;
        trace.source = ans.source;
        return { answer: ans, trace, ctx };
      }
    }
  }
  // Pergunta sobre item ("pra que serve slime") que casou com um mob de mesmo nome.
  if (chosen.entity.kind === 'mob' && intent0 && ['usos', 'receita', 'fundir', 'info'].includes(intent0)) {
    const item = u.candidates.find((c) => c.entity.kind === 'item' && c.score >= MIN_ENTITY_SCORE) ?? mobMainItem(chosen.entity.id);
    if (item) chosen = item;
  }
  u.match = chosen;

  const e = u.match.entity;
  const intent = resolveIntent(intent0, e, u.receitaAlso);
  let answer = answerFor(intent, e, u);
  // Pedido de farm para item sem farm curada: não inventa, mostra a lista.
  if (intent === 'farm' && e.kind === 'item' && !farmsByProduct.get(e.id)) answer = farmAnswer(e);
  trace.intent = intent;
  trace.intentLabel = INTENT_LABEL[intent];
  trace.entity = e;
  trace.confidence = Math.round(Math.min(1, u.match.score * (u.intent ? 1 : 0.92)) * 100) / 100;
  trace.source = answer.source;
  return { answer, trace, ctx: { intent, entity: e } };
}

/** Ponto de entrada: responde uma pergunta (com contexto da conversa). */
export function ask(question: string, ctx: Context = {}): EngineResult {
  const parts = splitCompound(question);
  const answers: Answer[] = [];
  const traces: Trace[] = [];
  let context = ctx;
  let firstIntent: Intent | null = null;
  for (const [i, p] of parts.entries()) {
    const r = answerOne(p, i === 0 ? context : { intent: firstIntent ?? undefined }, i === 0 ? null : firstIntent);
    if (i === 0) firstIntent = r.trace.intent === 'mob_info' || r.trace.intent === 'info' ? null : r.trace.intent;
    answers.push(r.answer);
    traces.push(r.trace);
    context = r.ctx;
  }
  return { answers, traces, context };
}
