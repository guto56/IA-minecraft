import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Answer, Context, EngineResult } from '../engine';
import { userContent, type ChatMessage } from '../ai/agent';

export interface UserMessage {
  id: string;
  role: 'user';
  text: string;
  /** Imagem anexada (JPEG reduzido, data URL). */
  image?: string;
  at: number;
}

export interface AiStep {
  name: string;
  /** Pergunta que a IA mandou para a ferramenta. */
  query: string;
  /** O que o motor achou ("receita · Pistão"). */
  label: string;
  found: boolean;
}

export interface AiState {
  status: 'thinking' | 'writing' | 'done' | 'stopped' | 'error';
  text: string;
  steps: AiStep[];
  model?: string;
  error?: string;
  /** A IA estava indisponível e a resposta veio do motor local. */
  fallback?: boolean;
}

export interface BotMessage {
  id: string;
  role: 'bot';
  question: string;
  result: EngineResult;
  /** Presente quando a resposta foi escrita pela IA (com base nas ferramentas). */
  ai?: AiState;
  at: number;
  /** true só enquanto a animação desta resposta não terminou (não é salvo). */
  animate?: boolean;
}

export type Message = UserMessage | BotMessage;

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  context: Context;
}

export interface Favorite {
  key: string;
  label: string;
  icon?: string;
  query: string;
}

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  favorites: Favorite[];
  /** Mensagem cuja animação está rodando (o botão Parar a encerra). */
  animatingId: string | null;
  send: (text: string, image?: string) => Promise<void>;
  newConversation: () => void;
  select: (id: string) => void;
  remove: (id: string) => void;
  finishAnimation: (messageId: string) => void;
  toggleFavorite: (f: Favorite) => void;
}

/** Requisições da IA em andamento (o botão Parar cancela). */
const controllers = new Map<string, AbortController>();

/** Histórico enxuto para a IA entender o contexto ("e de melancia?"). */
function toHistory(messages: Message[], newImage: boolean): ChatMessage[] {
  const out: ChatMessage[] = [];
  const recent = messages.slice(-16);
  // A IA continua vendo só a última imagem da conversa (e nenhuma se a pergunta nova traz outra).
  const lastImageId = newImage ? undefined : [...recent].reverse().find((m) => m.role === 'user' && m.image)?.id;
  for (const m of recent) {
    if (m.role === 'user') out.push({ role: 'user', content: m.id === lastImageId ? userContent(m.text, m.image) : m.text || '(imagem enviada antes)' });
    else {
      const text = m.ai?.text || m.result.answers.flatMap((a) => a.text).join('\n').replace(/\*\*/g, '');
      const consulted = m.ai?.steps.filter((s) => s.found).map((s) => s.label);
      out.push({ role: 'assistant', content: `${text}${consulted?.length ? `\n(consultado: ${consulted.join('; ')})` : ''}`.slice(0, 2000) });
    }
  }
  return out;
}

/** Cards da resposta: sem repetir o mesmo resultado e sem "não entendi" (a IA explica). */
function mergeCards(current: Answer[], incoming: Answer[]): Answer[] {
  const key = (a: Answer) => (a.type === 'web' ? `web:${a.source}` : `${a.type}:${a.text[0] ?? ''}`);
  const seen = new Set(current.map(key));
  const out = [...current];
  for (const a of incoming) {
    if (a.type === 'not_understood' || seen.has(key(a))) continue;
    seen.add(key(a));
    out.push(a);
  }
  return out;
}

/**
 * localStorage que não quebra quando enche (imagens ocupam espaço):
 * tira as imagens mais antigas até caber.
 */
const safeStorage = {
  getItem: (k: string) => localStorage.getItem(k),
  removeItem: (k: string) => localStorage.removeItem(k),
  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
      return;
    } catch {
      /* cheio: libera espaço abaixo */
    }
    const data = JSON.parse(v) as { state: { conversations: Conversation[] } };
    // Conversas vêm da mais recente para a mais antiga; mensagens da mais antiga para a mais recente.
    const withImage = data.state.conversations.flatMap((c) => [...c.messages].reverse().filter((m): m is UserMessage => m.role === 'user' && !!m.image));
    for (let keep = Math.min(withImage.length, 6); keep >= 0; keep--) {
      for (const m of withImage.slice(keep)) delete m.image;
      try {
        localStorage.setItem(k, JSON.stringify(data));
        return;
      } catch {
        /* ainda não coube */
      }
    }
  },
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function titleFrom(text: string) {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > 42 ? `${t.slice(0, 40)}…` : t;
}

export const useChat = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      favorites: [],
      animatingId: null,
      send: async (text, image) => {
        const q = text.trim();
        if (!q && !image) return;
        const state = get();
        let conv = state.conversations.find((c) => c.id === state.activeId);
        const now = Date.now();
        if (!conv) conv = { id: uid(), title: titleFrom(q || 'Imagem enviada'), createdAt: now, updatedAt: now, messages: [], context: {} };
        const history = toHistory(conv.messages, !!image);
        const userMsg: UserMessage = { id: uid(), role: 'user', text: q, ...(image ? { image } : {}), at: now };
        const botMsg: BotMessage = {
          id: uid(),
          role: 'bot',
          question: q,
          result: { answers: [], traces: [], context: conv.context },
          ai: { status: 'thinking', text: '', steps: [] },
          at: now,
          animate: true,
        };
        const convId = conv.id;
        const updated: Conversation = { ...conv, updatedAt: now, messages: [...conv.messages, userMsg, botMsg] };
        set({ conversations: [updated, ...state.conversations.filter((c) => c.id !== convId)], activeId: convId, animatingId: botMsg.id });

        const patch = (fn: (m: BotMessage) => BotMessage) =>
          set((s) => ({
            conversations: s.conversations.map((c) =>
              c.id !== convId ? c : { ...c, messages: c.messages.map((m) => (m.id === botMsg.id && m.role === 'bot' ? fn(m) : m)) },
            ),
          }));

        const controller = new AbortController();
        controllers.set(botMsg.id, controller);
        try {
          const { runAgent } = await import('../ai/agent');
          const result = await runAgent(
            history,
            q,
            (e) => {
              if (e.type === 'text') patch((m) => ({ ...m, ai: { ...m.ai!, status: 'writing', text: m.ai!.text + e.delta } }));
              if (e.type === 'reset') patch((m) => ({ ...m, ai: { ...m.ai!, text: '' } }));
              if (e.type === 'model') patch((m) => ({ ...m, ai: { ...m.ai!, model: e.model } }));
              if (e.type === 'tool' && !e.run.refused) {
                const found = e.run.found;
                // A pesquisa achou algo: o que veio antes não respondia a pergunta e sai da tela
                // (dados do jogo antes da wiki; wiki antes da web).
                const origin = found ? e.run.answers.find((a) => a.type === 'web')?.origin : undefined;
                const keep = (a: Answer) => (origin === 'wiki' ? a.type === 'web' : origin === 'web' ? a.type === 'web' && a.origin === 'web' : true);
                patch((m) => ({
                  ...m,
                  result: { ...m.result, answers: mergeCards(m.result.answers.filter(keep), e.run.answers) },
                  ai: { ...m.ai!, steps: [...m.ai!.steps, { name: e.run.name, query: String(e.run.args.pergunta ?? e.run.args.texto ?? e.run.args.busca ?? ''), label: e.run.label, found }] },
                }));
              }
            },
            controller.signal,
            image,
          );
          patch((m) => ({ ...m, ai: { ...m.ai!, status: 'done', text: result.text || m.ai!.text, model: result.model ?? m.ai!.model } }));
        } catch (err) {
          const e = err as Error & { unavailable?: boolean };
          if (e.name === 'AbortError') {
            patch((m) => ({ ...m, ai: { ...m.ai!, status: 'stopped' } }));
          } else if (e.unavailable && image) {
            // O motor local não lê imagens.
            patch((m) => ({ ...m, ai: { ...m.ai!, status: 'error', error: 'para analisar imagens preciso da IA, que está indisponível agora' } }));
          } else if (e.unavailable) {
            // IA fora do ar ou sem internet: responde com o motor local (mesmos dados, sem IA).
            const { ask } = await import('../engine');
            const local = ask(q, get().conversations.find((c) => c.id === convId)?.context ?? {});
            patch((m) => ({ ...m, result: local, ai: { status: 'done', text: '', steps: [], fallback: true, error: e.message } }));
            set((s) => ({ conversations: s.conversations.map((c) => (c.id === convId ? { ...c, context: local.context } : c)) }));
          } else {
            patch((m) => ({ ...m, ai: { ...m.ai!, status: 'error', error: e.message } }));
          }
        } finally {
          controllers.delete(botMsg.id);
          set((s) => ({ animatingId: s.animatingId === botMsg.id ? null : s.animatingId }));
        }
      },
      newConversation: () => set({ activeId: null, animatingId: null }),
      select: (id) => set({ activeId: id, animatingId: null }),
      remove: (id) =>
        set((s) => ({
          conversations: s.conversations.filter((c) => c.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        })),
      finishAnimation: (messageId) => {
        controllers.get(messageId)?.abort();
        set((s) => ({
          animatingId: s.animatingId === messageId ? null : s.animatingId,
          conversations: s.conversations.map((c) => ({
            ...c,
            messages: c.messages.map((m) => (m.id === messageId && m.role === 'bot' ? { ...m, animate: false } : m)),
          })),
        }));
      },
      toggleFavorite: (f) =>
        set((s) => ({
          favorites: s.favorites.some((x) => x.key === f.key) ? s.favorites.filter((x) => x.key !== f.key) : [f, ...s.favorites].slice(0, 30),
        })),
    }),
    {
      name: 'craftbot-chat',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        conversations: s.conversations.slice(0, 60).map((c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.role === 'bot' ? { ...m, animate: false, ai: m.ai && (m.ai.status === 'thinking' || m.ai.status === 'writing') ? { ...m.ai, status: 'stopped' as const } : m.ai } : m,
          ),
        })),
        activeId: s.activeId,
        favorites: s.favorites,
      }),
    },
  ),
);

export const useActiveConversation = () =>
  useChat((s) => s.conversations.find((c) => c.id === s.activeId) ?? null);

/* ------------------------------ tema ------------------------------ */

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

export const useTheme = create<ThemeState>()((set, get) => ({
  theme: (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark') as Theme,
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    const apply = () => {
      document.documentElement.dataset.theme = next;
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    // Crossfade suave entre Deepslate e Calcita (quando o navegador suporta).
    if (doc.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(apply);
    else apply();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#141517' : '#f4f2ee');
    try {
      localStorage.setItem('craftbot-theme', next);
    } catch {
      /* armazenamento indisponível: o tema vale só nesta aba */
    }
    set({ theme: next });
  },
}));
