/**
 * Proteções comuns das funções /api/*:
 * - só aceita chamadas do próprio site (Origin / Sec-Fetch-Site), barrando outros sites e scripts simples;
 * - limite de requisições por IP (memória da instância; o limite forte fica no firewall da Vercel);
 * - respostas JSON com cabeçalhos seguros e sem detalhes internos.
 */
const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
};

export function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...SECURITY_HEADERS, ...headers } });
}

export const streamHeaders = { 'content-type': 'text/event-stream; charset=utf-8', ...SECURITY_HEADERS, 'cache-control': 'no-cache, no-transform' };

/** A chamada veio de uma página deste mesmo site (qualquer deploy: produção, preview, localhost). */
export function sameOrigin(req: Request): boolean {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? new URL(req.url).host;
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  // GET do próprio site não manda Origin, mas o navegador manda Sec-Fetch-Site.
  return req.headers.get('sec-fetch-site') === 'same-origin';
}

export function clientIp(req: Request): string {
  return req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
}

const buckets = new Map<string, number[]>();

/** Janela deslizante por chave. true = pode seguir. */
export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  // Evita a memória crescer sem limite.
  if (buckets.size > 5000) for (const k of [...buckets.keys()].slice(0, 1000)) buckets.delete(k);
  return true;
}

export function resetLimits() {
  buckets.clear();
}

export interface Limit {
  name: string;
  limit: number;
  windowMs: number;
}

/** Bloqueia o que não é do site ou passou do limite. Devolve a resposta de erro, ou null para seguir. */
export function guard(req: Request, limits: Limit[]): Response | null {
  if (!sameOrigin(req)) return json(403, { error: 'Acesso permitido só pelo site do CraftBot.' });
  const ip = clientIp(req);
  for (const l of limits) {
    if (!allow(`${l.name}:${ip}`, l.limit, l.windowMs)) {
      return json(429, { error: 'Muitas perguntas em pouco tempo. Espere um pouco e tente de novo.' }, { 'retry-after': String(Math.ceil(l.windowMs / 1000)) });
    }
  }
  return null;
}
