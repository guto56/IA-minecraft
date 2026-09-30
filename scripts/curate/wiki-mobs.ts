/**
 * Ferramenta de curadoria (não roda no build): busca no minecraft.wiki a vida, o dano
 * e o comportamento de cada mob extraído do jar e salva um rascunho em .cache/wiki-mobs.json.
 * A curadoria final (src/data/curated/mobs.json) é revisada à mão a partir desse rascunho.
 */
import fs from 'node:fs';
import path from 'node:path';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';

if (process.env.HTTPS_PROXY) setGlobalDispatcher(new EnvHttpProxyAgent());
const ROOT = path.resolve(import.meta.dirname, '../..');
const mobs = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/mobs.json'), 'utf8')) as Record<string, { nameEn: string }>;

const clean = (s: string) =>
  s
    .replace(/\{\{hp\|([\d.]+)\}\}/g, '$1♥')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/'''?/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const out: Record<string, unknown> = {};
for (const [id, m] of Object.entries(mobs)) {
  const title = m.nameEn.replace(/ /g, '_');
  const url = `https://minecraft.wiki/w/${encodeURIComponent(title)}`;
  const res = await fetch(`${url}?action=raw`);
  if (!res.ok) {
    out[id] = { url, error: res.status };
    continue;
  }
  let raw = await res.text();
  const redirect = /^#redirect\s*\[\[([^\]#]+)/i.exec(raw);
  let finalUrl = url;
  if (redirect) {
    finalUrl = `https://minecraft.wiki/w/${encodeURIComponent(redirect[1].replace(/ /g, '_'))}`;
    raw = await (await fetch(`${finalUrl}?action=raw`)).text();
  }
  const field = (name: string) => {
    const m2 = new RegExp(`\\|\\s*${name}\\s*=([\\s\\S]*?)\\n\\|`, 'i').exec(raw);
    return m2 ? clean(m2[1]) : undefined;
  };
  const hp = /\|\s*health\s*=\s*\{\{hp\|([\d.]+)/i.exec(raw)?.[1];
  const intro = clean(raw.split(/\n==/)[0].split('}}\n').slice(-1)[0]).slice(0, 600);
  out[id] = { url: finalUrl, health: hp ? Number(hp) : undefined, behavior: field('behavior'), damage: field('damage')?.slice(0, 300), spawn: field('spawn')?.slice(0, 200), intro };
  console.log(id, hp);
}
fs.mkdirSync(path.join(ROOT, '.cache'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.cache/wiki-mobs.json'), JSON.stringify(out, null, 1));
