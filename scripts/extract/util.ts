import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const CACHE = path.join(ROOT, '.cache');
export const DATA_OUT = path.join(ROOT, 'src/data');
export const ICON_OUT = path.join(ROOT, 'public/icons');

export const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'craftbot.config.json'), 'utf8')) as {
  minecraftVersion: string;
  dropName: string;
  releaseDate: string;
};

export function log(step: string, msg: string) {
  console.log(`[${step}] ${msg}`);
}

export function stripNs(id: string): string {
  return id.startsWith('minecraft:') ? id.slice(10) : id;
}

export function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value) + '\n');
}

export function readJson<T = any>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

/** Acesso somente-leitura ao conteúdo do client.jar. */
export class Jar {
  private zip: AdmZip;
  private entries = new Map<string, AdmZip.IZipEntry>();
  constructor(file: string) {
    this.zip = new AdmZip(file);
    for (const e of this.zip.getEntries()) this.entries.set(e.entryName, e);
  }
  has(p: string) {
    return this.entries.has(p);
  }
  buffer(p: string): Buffer {
    const e = this.entries.get(p);
    if (!e) throw new Error(`Arquivo não encontrado no jar: ${p}`);
    return e.getData();
  }
  json<T = any>(p: string): T {
    return JSON.parse(this.buffer(p).toString('utf8')) as T;
  }
  tryJson<T = any>(p: string): T | undefined {
    return this.has(p) ? this.json<T>(p) : undefined;
  }
  /** Lista arquivos sob um prefixo (ex.: data/minecraft/recipe/). */
  list(prefix: string, ext = '.json'): string[] {
    const out: string[] = [];
    for (const k of this.entries.keys()) if (k.startsWith(prefix) && k.endsWith(ext)) out.push(k);
    return out.sort();
  }
}
