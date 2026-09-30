import { useCallback, useEffect, useRef, useState } from 'react';
import { AskContext } from './components/AskContext';
import { BotMessage } from './components/BotMessage';
import { Composer, type ComposerHandle } from './components/Composer';
import { ItemIcon } from './components/ItemIcon';
import { ItemSearch } from './components/ItemSearch';
import { Sidebar } from './components/Sidebar';
import { IconPlus, IconSidebar } from './components/Icons';
import { useIsMobile } from './hooks/useMedia';
import { useActiveConversation, useChat } from './store/chat';

const EXAMPLES: { q: string; icon: string }[] = [
  { q: 'Como faz um pistão?', icon: 'piston' },
  { q: 'Farm de ferro', icon: 'iron_ingot' },
  { q: 'Onde acho diamante?', icon: 'diamond' },
  { q: 'O que o creeper dropa?', icon: 'gunpowder' },
  { q: 'Poção de visão noturna', icon: 'golden_carrot' },
  { q: 'O que tem de novo na 26.3?', icon: 'poplar_sapling' },
];

export default function App() {
  const mobile = useIsMobile();
  const [sidebar, setSidebar] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 640 : true));
  const [search, setSearch] = useState(false);
  const send = useChat((s) => s.send);
  const newConversation = useChat((s) => s.newConversation);
  const conv = useActiveConversation();
  const composer = useRef<ComposerHandle>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const ask = useCallback(
    (q: string) => {
      send(q);
      const url = new URL(window.location.href);
      if (url.searchParams.has('q')) {
        url.searchParams.delete('q');
        window.history.replaceState(null, '', url);
      }
    },
    [send],
  );

  // Link compartilhado: ?q=pergunta abre já respondida.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) {
      newConversation();
      send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atalhos: "/" foca o campo, Ctrl/Cmd+K abre a busca de itens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.closest('input, textarea, [contenteditable="true"]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearch(true);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        composer.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const count = conv?.messages.length ?? 0;
  useEffect(() => {
    if (!count) return;
    requestAnimationFrame(() => bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
  }, [count]);

  useEffect(() => setSidebar(!mobile), [mobile]);

  const empty = !conv || conv.messages.length === 0;

  return (
    <AskContext.Provider value={ask}>
      <div className="flex h-full">
        {sidebar || mobile ? <Sidebar open={sidebar} mobile={mobile} onClose={() => setSidebar(false)} onAsk={ask} onSearch={() => setSearch(true)} /> : null}
        {mobile && sidebar ? <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setSidebar(false)} aria-hidden="true" /> : null}

        <main className="relative flex min-w-0 flex-1 flex-col">
          <header className={`flex h-12 shrink-0 items-center gap-1 px-2 ${sidebar && !mobile ? 'sm:hidden' : ''}`}>
            {!sidebar || mobile ? (
              <button type="button" onClick={() => setSidebar(true)} aria-label="Abrir barra lateral" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
                <IconSidebar />
              </button>
            ) : null}
            {mobile || !sidebar ? <span className="font-pixel text-[17px] font-semibold text-fg">CraftBot</span> : null}
            <button type="button" onClick={newConversation} aria-label="Nova conversa" className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
              <IconPlus />
            </button>
          </header>

          {empty ? (
            <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-[12vh]">
              <div className="w-full max-w-[680px]">
                <h1 className="mb-6 text-center text-[30px] leading-tight font-semibold tracking-[-0.02em] text-fg sm:text-[34px]">O que vamos craftar?</h1>
                <Composer ref={composer} onSend={ask} big />
                <ul className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Exemplos de perguntas">
                  {EXAMPLES.map((e) => (
                    <li key={e.q}>
                      <button
                        type="button"
                        onClick={() => ask(e.q)}
                        className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[14px] text-fg transition-[transform,border-color] duration-150 ease-out hover:-translate-y-px hover:border-muted"
                      >
                        <ItemIcon id={e.icon} size={20} label="" />
                        {e.q}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-8 text-center text-[12.5px] text-muted">
                  Sem IA: respostas montadas com os arquivos do Minecraft Java 26.3. Atalhos: <kbd className="font-mono">/</kbd> escrever · <kbd className="font-mono">Ctrl K</kbd> buscar item
                </p>
              </div>
            </div>
          ) : (
            <>
              <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto grid w-full max-w-[760px] gap-8 px-4 pt-4 pb-10">
                  {conv!.messages.map((m) =>
                    m.role === 'user' ? (
                      <div key={m.id} className="flex justify-end">
                        <p className="max-w-[80%] rounded-2xl rounded-br-md bg-surface-2 px-4 py-2 text-[15px] whitespace-pre-wrap text-fg">{m.text}</p>
                      </div>
                    ) : (
                      <BotMessage key={m.id} msg={m} />
                    ),
                  )}
                  <div ref={bottom} />
                </div>
              </div>
              <div className="shrink-0 px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
                <div className="mx-auto w-full max-w-[760px]">
                  <Composer ref={composer} onSend={ask} />
                  <p className="mt-1.5 text-center text-[11.5px] text-muted">Respostas vêm dos dados do jogo. Se eu não entender, eu aviso.</p>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
      <ItemSearch open={search} onClose={() => setSearch(false)} onAsk={ask} />
    </AskContext.Provider>
  );
}
