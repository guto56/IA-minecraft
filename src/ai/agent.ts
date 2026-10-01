/**
 * Laço do agente no navegador: manda a conversa para /api/chat, lê o stream,
 * executa as ferramentas sobre os dados locais e repete até a IA escrever a resposta.
 */
import type { Answer } from '../engine';
import { newTurn, runTool, type ToolRun } from './tools';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export type AgentEvent =
  | { type: 'tool'; run: ToolRun }
  | { type: 'text'; delta: string }
  /** A rodada virou chamada de ferramenta: o texto parcial dela é descartado. */
  | { type: 'reset' }
  | { type: 'model'; model: string };

export class AgentError extends Error {
  constructor(
    message: string,
    /** true quando não deu para falar com a IA (sem rede, sem chave, servidor fora). */
    readonly unavailable: boolean,
  ) {
    super(message);
  }
}

const MAX_ROUNDS = 8;
const ENDPOINT = '/api/chat';

interface Delta {
  content?: string | null;
  tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
}

/** Lê o stream SSE da OpenRouter juntando texto e chamadas de ferramenta. */
async function readStream(res: Response, onText: (t: string) => void, onModel: (m: string) => void) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  const calls: { id: string; name: string; arguments: string }[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      let chunk: { model?: string; error?: { message?: string }; choices?: { delta?: Delta }[] };
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      if (chunk.error) throw new AgentError(chunk.error.message ?? 'erro da IA', false);
      if (chunk.model) onModel(chunk.model);
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        content += delta.content;
        onText(delta.content);
      }
      for (const tc of delta.tool_calls ?? []) {
        const c = (calls[tc.index] ??= { id: '', name: '', arguments: '' });
        if (tc.id) c.id = tc.id;
        if (tc.function?.name) c.name += tc.function.name;
        if (tc.function?.arguments) c.arguments += tc.function.arguments;
      }
    }
  }
  return { content, calls: calls.filter(Boolean) };
}

export interface AgentResult {
  text: string;
  runs: ToolRun[];
  answers: Answer[];
  model?: string;
}

export async function runAgent(history: ChatMessage[], question: string, onEvent: (e: AgentEvent) => void, signal?: AbortSignal): Promise<AgentResult> {
  const messages: ChatMessage[] = [...history, { role: 'user', content: question }];
  const runs: ToolRun[] = [];
  const turn = newTurn();
  let model: string | undefined;
  let text = '';
  for (let round = 0; round < MAX_ROUNDS; round++) {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages }), signal });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      throw new AgentError('Sem conexão com o servidor da IA.', true);
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string });
      throw new AgentError(body.error ?? `Servidor respondeu ${res.status}`, res.status >= 500 || res.status === 404);
    }
    // Na rodada final o texto vai direto para a tela; nas de ferramenta ele quase sempre vem vazio.
    const { content, calls } = await readStream(
      res,
      (t) => {
        text += t;
        onEvent({ type: 'text', delta: t });
      },
      (m) => {
        if (!model) {
          model = m;
          onEvent({ type: 'model', model: m });
        }
      },
    );
    if (!calls.length) return { text: text.trim(), runs, answers: runs.flatMap((r) => r.answers), model };
    if (text) {
      text = '';
      onEvent({ type: 'reset' });
    }
    messages.push({
      role: 'assistant',
      content,
      tool_calls: calls.map((c, i) => ({ id: c.id || `call_${round}_${i}`, type: 'function', function: { name: c.name, arguments: c.arguments } })),
    });
    for (const [i, c] of calls.entries()) {
      const run = await runTool(c.name, c.arguments, turn, signal);
      runs.push(run);
      onEvent({ type: 'tool', run });
      messages.push({ role: 'tool', tool_call_id: c.id || `call_${round}_${i}`, content: run.output });
    }
  }
  throw new AgentError('A IA não terminou a resposta.', false);
}
