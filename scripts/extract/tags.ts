import { stripNs, type Jar } from './util.ts';

export type TagMap = Record<string, string[]>;

/** Resolve recursivamente as tags de um registro (item, block, entity_type...). */
export function resolveTags(jar: Jar, registry: string): TagMap {
  const prefix = `data/minecraft/tags/${registry}/`;
  const raw = new Map<string, string[]>();
  for (const file of jar.list(prefix)) {
    const name = file.slice(prefix.length, -5);
    const json = jar.json<{ values: (string | { id: string; required?: boolean })[] }>(file);
    raw.set(name, json.values.map((v) => (typeof v === 'string' ? v : v.id)));
  }
  const out: TagMap = {};
  const resolve = (name: string, stack: string[] = []): string[] => {
    if (out[name]) return out[name];
    if (stack.includes(name)) throw new Error(`Tag circular: ${[...stack, name].join(' -> ')}`);
    const values = raw.get(name);
    if (!values) return [];
    const set = new Set<string>();
    for (const v of values) {
      if (v.startsWith('#')) for (const x of resolve(stripNs(v.slice(1)), [...stack, name])) set.add(x);
      else set.add(stripNs(v));
    }
    out[name] = [...set];
    return out[name];
  };
  for (const name of raw.keys()) resolve(name);
  return out;
}
