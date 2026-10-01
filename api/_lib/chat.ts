/**
 * Proxy para a OpenRouter: adiciona a chave (só no servidor), o prompt do sistema e as
 * ferramentas, e devolve o stream SSE. O cliente nunca vê a chave nem troca as instruções,
 * o modelo ou os limites. A conversa que chega é validada campo a campo.
 */
import { DEFAULT_MODEL, FALLBACK_MODEL, SYSTEM_PROMPT, TOOLS } from '../../src/ai/prompt';
import { guard, json, streamHeaders } from './guard';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_MESSAGES = 40;
const MAX_CHARS = 90_000;
const MAX_USER_CHARS = 1_500;
const MAX_ASSISTANT_CHARS = 6_000;
const MAX_TOOL_CHARS = 24_000;
const MAX_TOOL_CALLS = 8;
const MAX_ARGS_CHARS = 1_000;
const TOOL_NAMES = new Set<string>(TOOLS.map((t) => t.function.name));
const LIMITS = [
  { name: 'chat-min', limit: 40, windowMs: 60_000 },
  { name: 'chat-hora', limit: 400, windowMs: 3_600_000 },
];

interface InMessage {
  role?: unknown;
  content?: unknown;
  tool_calls?: unknown;
  tool_call_id?: unknown;
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Reconstrói cada mensagem só com os campos esperados (nada de "system" ou campos extras do cliente). */
export function sanitize(messages: InMessage[]) {
  const out: Record<string, unknown>[] = [];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: str(m.content, MAX_USER_CHARS) });
    else if (m.role === 'assistant') {
      const msg: Record<string, unknown> = { role: 'assistant', content: str(m.content, MAX_ASSISTANT_CHARS) };
      if (Array.isArray(m.tool_calls)) {
        const calls = m.tool_calls
          .slice(0, MAX_TOOL_CALLS)
          .map((c: { id?: unknown; function?: { name?: unknown; arguments?: unknown } }) => ({
            id: str(c?.id, 64),
            type: 'function',
            function: { name: str(c?.function?.name, 40), arguments: str(c?.function?.arguments, MAX_ARGS_CHARS) },
          }))
          .filter((c) => c.id && TOOL_NAMES.has(c.function.name));
        if (calls.length) msg.tool_calls = calls;
      }
      out.push(msg);
    } else if (m.role === 'tool' && typeof m.tool_call_id === 'string') {
      out.push({ role: 'tool', tool_call_id: str(m.tool_call_id, 64), content: str(m.content, MAX_TOOL_CHARS) });
    }
  }
  return out;
}

export async function handleChat(req: Request, env: { key?: string; model?: string; referer?: string }): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  if (!env.key) return json(503, { error: 'IA não configurada no servidor (OPENROUTER_API_KEY).' });
  const blocked = guard(req, LIMITS);
  if (blocked) return blocked;
  if (Number(req.headers.get('content-length') ?? 0) > MAX_CHARS * 2) return json(413, { error: 'Conversa grande demais' });
  let body: { messages?: InMessage[] };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'JSON inválido' });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) return json(400, { error: 'Sem mensagens' });
  const messages = sanitize(body.messages.slice(-MAX_MESSAGES));
  if (!messages.length || messages[messages.length - 1].role === 'assistant') return json(400, { error: 'Conversa inválida' });
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
    return json(502, { error: 'Não consegui falar com a IA agora.' });
  }

  if (!upstream.ok || !upstream.body) {
    // O detalhe do erro fica só no log do servidor.
    console.error('openrouter', upstream.status, (await upstream.text().catch(() => '')).slice(0, 500));
    return json(502, { error: upstream.status === 429 ? 'A IA está ocupada. Tente de novo em instantes.' : 'A IA não respondeu agora.' });
  }
  return new Response(upstream.body, { status: 200, headers: streamHeaders });
}
