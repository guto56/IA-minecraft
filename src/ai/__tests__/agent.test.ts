import { afterEach, describe, expect, it, vi } from 'vitest';
import { runAgent, type ChatMessage } from '../agent';
import { runTool } from '../tools';

/** Monta uma resposta SSE como a da OpenRouter. */
function sse(chunks: object[]) {
  const body = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n';
  return new Response(new TextEncoder().encode(body), { status: 200, headers: { 'content-type': 'text/event-stream' } });
}
const toolCall = (name: string, args: object) =>
  sse([{ model: 'teste/modelo', choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name, arguments: JSON.stringify(args) } }] } }] }]);
const text = (t: string) => sse(t.split(' ').map((w, i) => ({ choices: [{ delta: { content: (i ? ' ' : '') + w } }] })));

afterEach(() => vi.restoreAllMocks());

describe('ferramentas sobre os dados do jogo', () => {
  it('consultar_jogo devolve a receita real do jar', () => {
    const r = runTool('consultar_jogo', JSON.stringify({ pergunta: 'como faz pistão' }));
    const out = JSON.parse(r.output);
    expect(out.resultados[0].tipo).toBe('receita');
    expect(out.resultados[0].receitas[0].materiais_por_craft).toContain('4x Pedregulho');
    expect(r.answers[0].type).toBe('recipe');
  });
  it('farm de melancia cai na farm curada de abóbora e melancia', () => {
    const out = JSON.parse(runTool('consultar_jogo', JSON.stringify({ pergunta: 'farm de melancia' })).output);
    expect(out.resultados[0].tipo).toBe('farm');
    expect(out.resultados[0].nome).toMatch(/melancia/i);
    expect(out.resultados[0].passos.length).toBeGreaterThan(3);
  });
  it('pergunta fora do jogo volta como nao_encontrado (a IA não pode inventar)', () => {
    const out = JSON.parse(runTool('consultar_jogo', JSON.stringify({ pergunta: 'qual a capital da França' })).output);
    expect(out.resultados[0].tipo).toBe('nao_encontrado');
  });
  it('buscar_nomes acha nomes oficiais', () => {
    const out = JSON.parse(runTool('buscar_nomes', JSON.stringify({ texto: 'observ' })).output);
    expect(out.encontrados[0].nome).toBe('Observador');
  });
});

describe('laço do agente', () => {
  it('executa a ferramenta, devolve o resultado para a IA e transmite o texto', async () => {
    const calls: { messages: ChatMessage[] }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      calls.push(JSON.parse(String(init!.body)));
      return calls.length === 1 ? toolCall('consultar_jogo', { pergunta: 'farm de melancia' }) : text('A **farm de melancia** usa observadores e pistões.');
    });
    const history: ChatMessage[] = [
      { role: 'user', content: 'como faço uma farm de ferro?' },
      { role: 'assistant', content: 'A farm de ferro usa 3 aldeões e um zumbi.' },
    ];
    const events: string[] = [];
    const r = await runAgent(history, 'e de melancia?', (e) => events.push(e.type));
    // O histórico vai junto: é assim que a IA entende "e de melancia?".
    expect(calls[0].messages.slice(0, 2)).toEqual(history);
    expect(calls[0].messages[2]).toEqual({ role: 'user', content: 'e de melancia?' });
    // A segunda chamada leva o resultado real da ferramenta.
    const tool = calls[1].messages.find((m) => m.role === 'tool')!;
    expect(JSON.parse(tool.content).resultados[0].tipo).toBe('farm');
    expect(r.text).toBe('A **farm de melancia** usa observadores e pistões.');
    expect(r.answers.some((a) => a.type === 'farm')).toBe(true);
    expect(r.model).toBe('teste/modelo');
    expect(events).toContain('tool');
    expect(events).toContain('text');
  });

  it('sem servidor de IA avisa que está indisponível (o app cai no motor local)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'IA não configurada' }), { status: 503 }));
    await expect(runAgent([], 'como faz tocha', () => {})).rejects.toMatchObject({ unavailable: true });
  });
});
