/**
 * Proxy para a OpenRouter: adiciona a chave (só no servidor), o prompt do sistema e as
 * ferramentas, e devolve o stream SSE. O cliente nunca vê a chave nem troca as instruções.
 */
import { DEFAULT_MODEL, FALLBACK_MODEL, SYSTEM_PROMPT, TOOLS } from '../../src/ai/prompt';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_MESSAGES = 40;
const MAX_CHARS = 60_000;
const ROLES = new Set(['user', 'assistant', 'tool']);

interface InMessage {
  role: string;
  content?: unknown;
  tool_calls?: unknown;
  tool_call_id?: unknown;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Mantém só os campos esperados de cada mensagem (sem "system" vindo do cliente). */
function sanitize(messages: InMessage[]) {
  return messages
    .filter((m) => ROLES.has(m.role))
    .map((m) => {
      const out: Record<string, unknown> = { role: m.role, content: typeof m.content === 'string' ? m.content : '' };
      if (m.role === 'assistant' && Array.isArray(m.tool_calls)) out.tool_calls = m.tool_calls;
      if (m.role === 'tool' && typeof m.tool_call_id === 'string') out.tool_call_id = m.tool_call_id;
      return out;
    });
}

export async function handleChat(req: Request, env: { key?: string; model?: string; referer?: string }): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  if (!env.key) return json(503, { error: 'IA não configurada no servidor (OPENROUTER_API_KEY).' });
  let body: { messages?: InMessage[] };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'JSON inválido' });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) return json(400, { error: 'Sem mensagens' });
  const messages = sanitize(body.messages.slice(-MAX_MESSAGES));
  if (JSON.stringify(messages).length > MAX_CHARS) return json(413, { error: 'Conversa grande demais' });

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
      models: [...new Set([env.model || DEFAULT_MODEL, FALLBACK_MODEL])],
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.2,
      max_tokens: 1600,
      stream: true,
    }),
    });
  } catch {
    return json(502, { error: 'Não consegui falar com a OpenRouter.' });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return json(502, { error: `OpenRouter respondeu ${upstream.status}`, detail: detail.slice(0, 500) });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform' },
  });
}
