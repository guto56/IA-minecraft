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
/** Imagem: só data URL JPEG/PNG/WebP em base64, até ~2 MB, no máximo 2 por pedido. */
const MAX_IMAGE_CHARS = 2_800_000;
const MAX_IMAGES = 2;
const IMAGE_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
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

type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

/** Texto, ou texto + imagem validada. Qualquer outro tipo de parte é descartado. */
function userContent(content: unknown): string | Part[] {
  if (!Array.isArray(content)) return str(content, MAX_USER_CHARS);
  const parts: Part[] = [];
  for (const p of content.slice(0, 4) as { type?: unknown; text?: unknown; image_url?: { url?: unknown } }[]) {
    if (p?.type === 'text') parts.push({ type: 'text', text: str(p.text, MAX_USER_CHARS) });
    else if (p?.type === 'image_url' && typeof p.image_url?.url === 'string' && p.image_url.url.length <= MAX_IMAGE_CHARS && IMAGE_URL.test(p.image_url.url) && !parts.some((x) => x.type === 'image_url'))
      parts.push({ type: 'image_url', image_url: { url: p.image_url.url } });
  }
  if (!parts.some((x) => x.type === 'image_url')) return parts.filter((x) => x.type === 'text').map((x) => (x as { text: string }).text).join('\n');
  return parts;
}

const imagesIn = (messages: Record<string, unknown>[]) => messages.reduce((n, m) => n + (Array.isArray(m.content) ? m.content.filter((p: Part) => p.type === 'image_url').length : 0), 0);

/** Tamanho da conversa sem contar os bytes das imagens (que têm limite próprio). */
const textSize = (messages: Record<string, unknown>[]) =>
  JSON.stringify(messages.map((m) => (Array.isArray(m.content) ? { ...m, content: m.content.filter((p: Part) => p.type === 'text') } : m))).length;

/** Reconstrói cada mensagem só com os campos esperados (nada de "system" ou campos extras do cliente). */
export function sanitize(messages: InMessage[]) {
  const out: Record<string, unknown>[] = [];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: userContent(m.content) });
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
  if (Number(req.headers.get('content-length') ?? 0) > MAX_CHARS * 2 + MAX_IMAGE_CHARS * MAX_IMAGES) return json(413, { error: 'Conversa grande demais' });
  let body: { messages?: InMessage[] };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'JSON inválido' });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) return json(400, { error: 'Sem mensagens' });
  const messages = sanitize(body.messages.slice(-MAX_MESSAGES));
  if (!messages.length || messages[messages.length - 1].role === 'assistant') return json(400, { error: 'Conversa inválida' });
  if (textSize(messages) > MAX_CHARS) return json(413, { error: 'Conversa grande demais' });
  if (imagesIn(messages) > MAX_IMAGES) return json(413, { error: 'Imagens demais na conversa' });

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
