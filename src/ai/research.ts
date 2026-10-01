/**
 * Pesquisa fora dos dados do jogo, usada só quando eles não têm a resposta.
 * - Wiki: API pública da minecraft.wiki, pelo servidor (/api/wiki, grátis).
 * - Web: /api/web no servidor (busca da OpenRouter, paga por busca).
 * Os resultados ficam guardados no navegador por alguns dias para não repetir a mesma busca.
 */
export interface WikiPage {
  title: string;
  url: string;
  text: string;
}

export interface WebHit {
  title: string;
  url: string;
  content: string;
}

const WEB_CHARS = 2500;
const CACHE_PREFIX = 'craftbot-research:';
const CACHE_DAYS = 7;

const key = (kind: string, q: string) => `${CACHE_PREFIX}${kind}:${q.trim().toLowerCase().replace(/\s+/g, ' ')}`;

function cached<T>(k: string): T | undefined {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return undefined;
    const { at, value } = JSON.parse(raw) as { at: number; value: T };
    if (Date.now() - at > CACHE_DAYS * 864e5) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

function store(k: string, value: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // Sem espaço ou bloqueado: só não guarda.
  }
}

/** Busca na Minecraft Wiki (pelo servidor, /api/wiki) e devolve o texto das páginas mais relevantes. */
export async function searchWiki(query: string, signal?: AbortSignal): Promise<WikiPage[]> {
  const k = key('wiki', query);
  const hit = cached<WikiPage[]>(k);
  if (hit) return hit;
  const res = await fetch(`/api/wiki?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `wiki respondeu ${res.status}`);
  }
  const { pages } = (await res.json()) as { pages: WikiPage[] };
  store(k, pages);
  return pages;
}

/** Busca na web pelo servidor (cobra créditos da OpenRouter). */
export async function searchWeb(query: string, signal?: AbortSignal): Promise<WebHit[]> {
  const k = key('web', query);
  const hit = cached<WebHit[]>(k);
  if (hit) return hit;
  const res = await fetch('/api/web', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: query }), signal });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `busca na web respondeu ${res.status}`);
  }
  const { results } = (await res.json()) as { results: WebHit[] };
  const hits = results.map((r) => ({ ...r, content: r.content.slice(0, WEB_CHARS) }));
  store(k, hits);
  return hits;
}

/** Link de vídeo do YouTube no formato que o player entende (watch?v=). */
export function youtubeWatchUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, '');
    let id: string | null | undefined;
    if (host === 'youtu.be') id = u.pathname.slice(1);
    else if (host === 'youtube.com') id = u.searchParams.get('v') ?? /^\/(?:shorts|embed|live)\/([\w-]+)/.exec(u.pathname)?.[1];
    return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : undefined;
  } catch {
    return undefined;
  }
}
