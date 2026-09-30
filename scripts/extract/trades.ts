import { stripNs, type Jar } from './util.ts';

export interface TradeStack {
  item: string;
  min: number;
  max: number;
}

export interface Trade {
  wants: TradeStack;
  wants2?: TradeStack;
  gives: TradeStack;
  maxUses: number;
  xp?: number;
  /** Observações vindas dos modificadores (ex.: livro com encantamento aleatório). */
  notes: string[];
  /** Só aldeões destes tipos (biomas) oferecem. */
  villagerTypes?: string[];
}

export interface TradeLevel {
  level: string;
  /** Quantas trocas do grupo o aldeão sorteia. */
  amount: number;
  trades: Trade[];
}

function range(v: any): [number, number] {
  if (v === undefined) return [1, 1];
  if (typeof v === 'number') return [v, v];
  const t = stripNs(v.type ?? '');
  if (t === 'uniform') return [range(v.min_inclusive ?? v.min)[0], range(v.max_inclusive ?? v.max)[1]];
  if (t === 'constant') return range(v.value);
  if (t === 'binomial') return [0, range(v.n)[1]];
  if (t === 'add') return [0, 64];
  return [1, 1];
}

const stack = (s: any): TradeStack => {
  const [min, max] = range(s.count);
  return { item: stripNs(s.id), min, max };
};

export function extractTrades(jar: Jar): Record<string, TradeLevel[]> {
  const tagValues = (tag: string): string[] => {
    const json = jar.tryJson<{ values: string[] }>(`data/minecraft/tags/villager_trade/${tag}.json`);
    if (!json) return [];
    return json.values.flatMap((v) => (v.startsWith('#') ? tagValues(stripNs(v.slice(1))) : [stripNs(v)]));
  };
  const out: Record<string, TradeLevel[]> = {};
  const prefix = 'data/minecraft/trade_set/';
  for (const file of jar.list(prefix)) {
    const [profession, levelFile] = file.slice(prefix.length, -5).split('/');
    const set = jar.json<{ amount: number; trades: string }>(file);
    const ids = set.trades.startsWith('#') ? tagValues(stripNs(set.trades.slice(1))) : [stripNs(set.trades)];
    const trades: Trade[] = [];
    for (const id of ids) {
      const t = jar.json<any>(`data/minecraft/villager_trade/${id}.json`);
      const notes: string[] = [];
      for (const m of [t.given_item_modifier ?? []].flat()) {
        const mt = stripNs(m.type);
        if (mt === 'enchant_randomly') notes.push('encantamento aleatório');
        if (mt === 'enchant_with_levels') notes.push('vem encantado');
        if (mt === 'exploration_map') notes.push(`mapa para ${stripNs(m.decoration ?? m.destination ?? '').replace('#', '')}`);
        if (mt === 'set_random_dyes') notes.push('cor aleatória');
        if (mt === 'set_random_potion') notes.push('efeito de poção aleatório');
        if (mt === 'set_potion') notes.push(`potion:${stripNs(m.id)}`);
        if (mt === 'set_stew_effect') notes.push('efeito aleatório');
      }
      if (t.wants?.count === 0 || (typeof t.wants?.count === 'object' && stripNs(t.wants.count.type ?? '') === 'add')) notes.push('preço varia com o encantamento');
      const trade: Trade = { wants: stack(t.wants), gives: stack(t.gives), maxUses: t.max_uses ?? 12, notes };
      if (t.additional_wants) trade.wants2 = stack(t.additional_wants);
      if (t.xp) trade.xp = t.xp;
      const variants = t.merchant_predicate?.predicate?.['minecraft:predicates']?.['minecraft:villager/variant'];
      if (Array.isArray(variants)) trade.villagerTypes = variants.map(stripNs);
      trades.push(trade);
    }
    const level = levelFile.replace('level_', '');
    (out[profession] ??= []).push({ level, amount: set.amount, trades });
  }
  for (const p of Object.keys(out)) out[p].sort((a, b) => a.level.localeCompare(b.level));
  return out;
}
