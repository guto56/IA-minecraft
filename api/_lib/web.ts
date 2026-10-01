/**
 * Busca na web pela OpenRouter (plugin "web", motor Exa). Só roda quando a IA pede
 * "pesquisar_web", depois de os dados do jogo e a wiki não terem a resposta.
 * Devolve só os resultados (título, link, trecho); a IA escreve a resposta na rodada seguinte.
 */
import { WEB_SEARCH } from '../../src/ai/prompt';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_QUERY = 200;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

interface Annotation {
  type?: string;
  url_citation?: { url?: string; title?: string; content?: string };
}

export async function handleWeb(req: Request, env: { key?: string; referer?: string }): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  if (!env.key) return json(503, { error: 'Busca na web não configurada no servidor (OPENROUTER_API_KEY).' });
  let body: { q?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'JSON inválido' });
  }
  const q = typeof body.q === 'string' ? body.q.trim().slice(0, MAX_QUERY) : '';
  if (!q) return json(400, { error: 'Sem busca' });

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.key}`,
        'content-type': 'application/json',
        'http-referer': env.referer ?? 'https://craftbot-seven.vercel.app',
        'x-title': 'CraftBot',
      },
      body: JSON.stringify({
        model: WEB_SEARCH.model,
        messages: [{ role: 'user', content: `Minecraft Java Edition: ${q}` }],
        // Só os resultados interessam: 1 token de saída e sem raciocínio.
        max_tokens: 1,
        reasoning: { enabled: false },
        plugins: [{ id: 'web', engine: 'exa', max_results: WEB_SEARCH.maxResults, include_domains: WEB_SEARCH.domains }],
      }),
    });
  } catch {
    return json(502, { error: 'Não consegui falar com a OpenRouter.' });
  }
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return json(502, { error: `OpenRouter respondeu ${upstream.status}`, detail: detail.slice(0, 500) });
  }
  const data = (await upstream.json().catch(() => ({}))) as { choices?: { message?: { annotations?: Annotation[] } }[] };
  const seen = new Set<string>();
  const results = (data.choices?.[0]?.message?.annotations ?? [])
    .map((a) => a.url_citation)
    .filter((c): c is { url: string; title?: string; content?: string } => !!c?.url && /^https:\/\//.test(c.url))
    .filter((c) => !seen.has(c.url) && !!seen.add(c.url))
    .map((c) => ({ title: (c.title ?? c.url).slice(0, 200), url: c.url, content: (c.content ?? '').slice(0, 4000) }));
  return json(200, { results });
}
