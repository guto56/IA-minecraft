import { useEffect, useState } from 'react';
import type * as SearchModule from './search';

type Search = typeof SearchModule;
let loaded: Search | null = null;

/** Carrega a busca (e os dados do jogo) só quando o usuário começa a usar. */
export function useSearch(enabled: boolean): Search | null {
  const [mod, setMod] = useState<Search | null>(loaded);
  useEffect(() => {
    if (!enabled || mod) return;
    let alive = true;
    import('./search').then((m) => {
      loaded = m;
      if (alive) setMod(m);
    });
    return () => {
      alive = false;
    };
  }, [enabled, mod]);
  return mod;
}

export const KIND_LABEL: Record<string, string> = {
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
