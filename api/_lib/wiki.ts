/**
 * Busca na Minecraft Wiki (API MediaWiki pública, grátis) pelo servidor: o navegador às vezes
 * recebe o desafio anti-bot da wiki, o servidor se identifica com um User-Agent próprio.
 * Devolve o texto puro das páginas mais relevantes (artigos e tutoriais).
 */
const WIKI_API = 'https://minecraft.wiki/api.php';
const WIKI_PAGE = 'https://minecraft.wiki/w/';
/** Artigos (0) e tutoriais (10010). */
const NAMESPACES = '0|10010';
const PAGES = 2;
const PAGE_CHARS = 4500;
const MAX_QUERY = 120;
const USER_AGENT = 'CraftBot/1.0 (https://craftbot-seven.vercel.app; assistente pessoal de Minecraft)';

function json(status: number, body: unknown, cache = false) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...(cache ? { 'cache-control': 'public, s-maxage=86400' } : {}) },
  });
}

async function wikiApi(params: Record<string, string>) {
  const url = new URL(WIKI_API);
  for (const [k, v] of Object.entries({ ...params, format: 'json', formatversion: '2' })) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, 'api-user-agent': USER_AGENT } });
  if (!res.ok) throw new Error(`minecraft.wiki respondeu ${res.status}`);
  return res.json();
}

export async function handleWiki(req: Request): Promise<Response> {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY);
  if (!q) return json(400, { error: 'Sem busca' });
  try {
    const found = await wikiApi({ action: 'query', list: 'search', srsearch: q, srnamespace: NAMESPACES, srlimit: String(PAGES) });
    const titles: string[] = (found.query?.search ?? []).map((r: { title: string }) => r.title);
    if (!titles.length) return json(200, { pages: [] }, true);
    // O texto inteiro só vem de uma página por chamada (limite da extensão TextExtracts).
    const pages = await Promise.all(
      titles.map(async (title) => {
        const ex = await wikiApi({ action: 'query', prop: 'extracts', explaintext: '1', redirects: '1', titles: title });
        const text: string = ex.query?.pages?.[0]?.extract ?? '';
        return { title, url: WIKI_PAGE + encodeURIComponent(title.replace(/ /g, '_')), text: text.replace(/\n{3,}/g, '\n\n').slice(0, PAGE_CHARS) };
      }),
    );
    return json(200, { pages: pages.filter((p) => p.text) }, true);
  } catch (e) {
    return json(502, { error: (e as Error).message });
  }
}
