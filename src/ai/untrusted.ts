/**
 * Texto de fora (wiki, web) é dado, nunca instrução. Antes de ir para a IA:
 * - tira caracteres invisíveis e de controle (usados para esconder instruções);
 * - tira HTML, imagens e links em markdown;
 * - neutraliza frases típicas de injeção de prompt e marcadores de papel ("system:", <|im_start|>...).
 */
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
const INJECTION = [
  /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(instructions?|rules?|prompts?|messages?|context)\b/gi,
  /\b(ignore|esque[cç]a|desconsidere)\b[^.\n]{0,40}\b(instru[cç][oõ]es|regras|prompt|mensagens)\b/gi,
  /\b(system|developer)\s*(prompt|message|instructions?)\b/gi,
  /\byou are now\b|\bvoc[eê] agora [eé]\b|\bnew instructions?\b|\bnovas instru[cç][oõ]es\b/gi,
  /<\|[^|>]{0,40}\|>/g,
  /^\s*(system|assistant|developer|user|tool)\s*:/gim,
  /\[\/?(INST|SYS)\]|<\/?(system|assistant|instructions?)>/gi,
];

export function cleanExternal(text: string, max: number): string {
  let t = text.normalize('NFKC').replace(INVISIBLE, '');
  t = t
    .replace(/<[^>]{1,200}>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]{1,200})\]\([^)]*\)/g, '$1');
  for (const re of INJECTION) t = t.replace(re, '[removido]');
  // Links para fora dos sites confiáveis não chegam à IA (phishing escondido na página).
  t = t.replace(/\bhttps?:\/\/[^\s)>\]]+/gi, (url) => (trustedUrl(url) ? url : '[link removido]'));
  return t.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}

/** Domínios que podem aparecer como link nos cards e no texto da IA. */
export const TRUSTED_HOSTS = ['minecraft.wiki', 'minecraft.net', 'youtube.com', 'youtu.be', 'reddit.com', 'youtube-nocookie.com'];

export function trustedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return u.protocol === 'https:' && TRUSTED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Saída da IA: tira links para fora dos domínios confiáveis (phishing via injeção). */
export function cleanAiText(text: string): string {
  return text.replace(/\bhttps?:\/\/[^\s)>\]]+/gi, (url) => (trustedUrl(url) ? url : '[link removido]'));
}
