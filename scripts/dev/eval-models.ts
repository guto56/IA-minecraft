/**
 * Avaliação de modelos da OpenRouter no fluxo real do CraftBot (prompt + ferramentas + dados).
 * Uso: npx tsx scripts/dev/eval-models.ts modelo1 modelo2 ...   (lê OPENROUTER_API_KEY do .env.local)
 */
import fs from 'node:fs';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { handleChat } from '../../api/_lib/chat';
import { runAgent, type ChatMessage } from '../../src/ai/agent';

if (process.env.HTTPS_PROXY) setGlobalDispatcher(new EnvHttpProxyAgent());
const key = /OPENROUTER_API_KEY=(.+)/.exec(fs.readFileSync('.env.local', 'utf8'))?.[1].trim();

interface Case {
  name: string;
  turns: string[];
  /** Regex que o texto final precisa ter. */
  must?: RegExp[];
  /** Regex que NÃO pode aparecer (invenção). */
  mustNot?: RegExp[];
  /** A última consulta da ferramenta precisa casar com isto (contexto). */
  query?: RegExp;
  needsTool?: boolean;
}

const CASES: Case[] = [
  { name: 'contexto farm', turns: ['como faço uma farm de ferro?', 'e de melancia?'], query: /melancia/i, must: [/melancia/i], needsTool: true },
  { name: 'contexto material', turns: ['como faz picareta de diamante', 'e a de ferro?'], query: /picareta de ferro|iron pickaxe/i, must: [/ferro/i], needsTool: true },
  { name: 'receita pistão', turns: ['como faz pistão'], must: [/pedregulho/i, /redstone/i], mustNot: [/obsidiana/i], needsTool: true },
  { name: 'conta baldes', turns: ['quantos lingotes de ferro preciso pra fazer 3 baldes?'], must: [/\b9\b/], needsTool: true },
  { name: 'composta creeper', turns: ['o que o creeper dropa e quanto de vida ele tem?'], must: [/p[óo]lvora/i, /\b20\b/], needsTool: true },
  { name: 'altura diamante', turns: ['qual a melhor altura pra achar diamante?'], must: [/-?59|−59/], needsTool: true },
  { name: 'nao inventa (lava)', turns: ['como fazer farm de lava'], must: [/n[ãa]o (tenho|encontrei|achei|sei|h[áa])|sem (essa|informa)/i], mustNot: [/gotejamento|estalactite|caldeir[ãa]o|dripstone|cauldron/i], needsTool: true },
  { name: 'fora do jogo', turns: ['qual a capital da França?'], must: [/minecraft/i], mustNot: [/paris/i] },
];

async function runCase(model: string, c: Case) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/chat') return handleChat(new Request('http://local/api/chat', { ...init, headers: { ...(init?.headers as Record<string, string>), origin: 'http://local' } }), { key, model });
    return realFetch(input, init);
  }) as typeof fetch;
  const history: ChatMessage[] = [];
  let text = '';
  let lastQuery = '';
  let tools = 0;
  const t0 = Date.now();
  try {
    for (const q of c.turns) {
      const r = await runAgent(history, q, () => {});
      text = r.text;
      tools += r.runs.length;
      const consult = r.runs.filter((x) => x.name === 'consultar_jogo');
      if (consult.length) lastQuery = consult.map((x) => String(x.args.pergunta)).join(' | ');
      history.push({ role: 'user', content: q }, { role: 'assistant', content: r.text });
    }
  } catch (e) {
    return { ok: false, why: `erro: ${(e as Error).message}`, ms: Date.now() - t0, text: '' };
  }
  const fails: string[] = [];
  if (c.needsTool && !tools) fails.push('não usou ferramenta');
  for (const m of c.must ?? []) if (!m.test(text)) fails.push(`faltou ${m}`);
  for (const m of c.mustNot ?? []) if (m.test(text)) fails.push(`inventou ${m}`);
  if (c.query && !c.query.test(lastQuery)) fails.push(`consulta "${lastQuery}"`);
  return { ok: !fails.length, why: fails.join('; '), ms: Date.now() - t0, text };
}

const realFetch = globalThis.fetch;
const models = process.argv.slice(2);
const summary: string[] = [];
for (const model of models) {
  let ok = 0;
  let ms = 0;
  for (const c of CASES) {
    const r = await runCase(model, c);
    ms += r.ms;
    if (r.ok) ok++;
    console.log(`${model} | ${c.name} | ${r.ok ? 'OK' : 'FALHA ' + r.why} | ${(r.ms / 1000).toFixed(1)}s | ${r.text.replace(/\s+/g, ' ').slice(0, 140)}`);
  }
  summary.push(`${model}: ${ok}/${CASES.length} em ${(ms / 1000).toFixed(0)}s`);
}
globalThis.fetch = realFetch;
console.log('\n' + summary.join('\n'));
