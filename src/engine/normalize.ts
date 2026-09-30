import sinonimos from './sinonimos.json';

const SYNONYMS: [RegExp, string][] = (sinonimos.trocas as [string, string][]).map(([re, to]) => [new RegExp(re, 'g'), to]);

/** Minúsculas, sem acentos, sem pontuação. Números de versão (26.3) viram 26_3. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(\d+)[.,](\d+)/g, '$1_$2')
    .replace(/[^a-z0-9_\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Aplica gírias/abreviações (sinonimos.json) sobre um texto já normalizado. */
export function applySynonyms(normalized: string): string {
  let s = ` ${normalized} `;
  for (const [re, to] of SYNONYMS) s = s.replace(re, to);
  return s.replace(/\s+/g, ' ').trim();
}

/** Singular aproximado do português (e do inglês) para comparar nomes. */
export function singular(token: string): string {
  if (token.length <= 3 || /\d/.test(token)) return token;
  if (token.endsWith('oes') || token.endsWith('aes')) return token.slice(0, -3) + 'ao';
  if (token.endsWith('ais')) return token.slice(0, -2) + 'l';
  if (token.endsWith('eis')) return token.slice(0, -3) + 'el';
  if (token.endsWith('ns')) return token.slice(0, -2) + 'm';
  if (token.endsWith('res') || token.endsWith('zes')) return token.slice(0, -2);
  if (token.endsWith('ss')) return token;
  if (token.endsWith('s')) return token.slice(0, -1);
  return token;
}

/** Aproxima grafias parecidas (tosha/tocha, pistam/pistao) para a busca fuzzy. */
export function phonetic(text: string): string {
  return text
    .replace(/sh|ch|x/g, 'x')
    .replace(/ss|ç/g, 's')
    .replace(/rr/g, 'r')
    .replace(/lh/g, 'li')
    .replace(/nh/g, 'ni')
    .replace(/qu(?=[ei])/g, 'k')
    .replace(/c(?=[aou])/g, 'k')
    .replace(/(?<=[aeiou])z(?=[aeiou])/g, 's')
    .replace(/y/g, 'i')
    .replace(/w/g, 'u')
    .replace(/am\b/g, 'ao')
    .replace(/(\w)\1/g, '$1');
}

/** Forma canônica usada nas chaves de busca: normalizada + singular por palavra. */
export function canonical(text: string): string {
  return normalize(text)
    .split(' ')
    .filter(Boolean)
    .map(singular)
    .join(' ');
}

export const STOPWORDS = new Set(
  (
    'a o as os um uma uns umas de da do das dos d e ou em no na nos nas num numa pra pro para por com sem que q qual quais ' +
    'como onde quando quanto quanta quantos quantas eu me mim meu minha meus minhas voce vc tu te se ser ta tah esta estou tem ter ' +
    'ai la aqui isso isto esse essa este esta ele ela eles elas ja so mais muito pouco bem mesmo tipo vou vai fica ficar ' +
    'mc minecraft java jogo game favor pf pfv porfavor ola oi opa eai salve mano cara brother bro please pls ' +
    'the of to is a an in on for how what where which do does can i my you it and or with from tell about show give list explain please get'
  ).split(' '),
);
