import fs from 'node:fs';
import type { Jar } from './util.ts';

export interface Lang {
  pt: Record<string, string>;
  en: Record<string, string>;
  /** Nome em pt_br com fallback para en_us. */
  t(key: string): string | undefined;
}

export function loadLang(jar: Jar, ptBrFile: string): Lang {
  const en = jar.json<Record<string, string>>('assets/minecraft/lang/en_us.json');
  const pt = JSON.parse(fs.readFileSync(ptBrFile, 'utf8')) as Record<string, string>;
  return { pt, en, t: (key) => pt[key] ?? en[key] };
}
