import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ask, type Context, type EngineResult } from '../engine';

export interface UserMessage {
  id: string;
  role: 'user';
  text: string;
  at: number;
}

export interface BotMessage {
  id: string;
  role: 'bot';
  question: string;
  result: EngineResult;
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
  send: (text: string) => void;
  newConversation: () => void;
  select: (id: string) => void;
  remove: (id: string) => void;
  finishAnimation: (messageId: string) => void;
  toggleFavorite: (f: Favorite) => void;
}

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
      send: (text) => {
        const q = text.trim();
        if (!q) return;
        const state = get();
        let conv = state.conversations.find((c) => c.id === state.activeId);
        const now = Date.now();
        if (!conv) {
          conv = { id: uid(), title: titleFrom(q), createdAt: now, updatedAt: now, messages: [], context: {} };
        }
        const result = ask(q, conv.context);
        const userMsg: UserMessage = { id: uid(), role: 'user', text: q, at: now };
        const botMsg: BotMessage = { id: uid(), role: 'bot', question: q, result, at: now, animate: true };
        const updated: Conversation = {
          ...conv,
          updatedAt: now,
          messages: [...conv.messages, userMsg, botMsg],
          context: result.context,
        };
        set({
          conversations: [updated, ...state.conversations.filter((c) => c.id !== updated.id)],
          activeId: updated.id,
          animatingId: botMsg.id,
        });
      },
      newConversation: () => set({ activeId: null, animatingId: null }),
      select: (id) => set({ activeId: id, animatingId: null }),
      remove: (id) =>
        set((s) => ({
          conversations: s.conversations.filter((c) => c.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        })),
      finishAnimation: (messageId) =>
        set((s) => ({
          animatingId: s.animatingId === messageId ? null : s.animatingId,
          conversations: s.conversations.map((c) => ({
            ...c,
            messages: c.messages.map((m) => (m.id === messageId && m.role === 'bot' ? { ...m, animate: false } : m)),
          })),
        })),
      toggleFavorite: (f) =>
        set((s) => ({
          favorites: s.favorites.some((x) => x.key === f.key) ? s.favorites.filter((x) => x.key !== f.key) : [f, ...s.favorites].slice(0, 30),
        })),
    }),
    {
      name: 'craftbot-chat',
      version: 1,
      partialize: (s) => ({
        conversations: s.conversations.slice(0, 60).map((c) => ({ ...c, messages: c.messages.map((m) => (m.role === 'bot' ? { ...m, animate: false } : m)) })),
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
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#141517' : '#f4f2ee');
    try {
      localStorage.setItem('craftbot-theme', next);
    } catch {
      /* armazenamento indisponível: o tema vale só nesta aba */
    }
    set({ theme: next });
  },
}));
