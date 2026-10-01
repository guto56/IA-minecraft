import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AskContext } from './components/AskContext';
import { Composer, type ComposerHandle } from './components/Composer';
import { ItemIcon } from './components/ItemIcon';
import { ItemSearch } from './components/ItemSearch';
import { Sidebar } from './components/Sidebar';
import { IconArrowDown, IconPlus, IconSidebar } from './components/Icons';
import { AnimatePresence, motion } from 'motion/react';
import { useAutoScroll } from './hooks/useAutoScroll';
import { useIsMobile } from './hooks/useMedia';

// A conversa (cards + dados do jogo) carrega sob demanda: a tela inicial abre na hora.
const Messages = lazy(() => import('./components/Messages'));

/** Curva única das transições de layout (saída rápida, chegada suave). */
const EASE = [0.32, 0.72, 0, 1] as const;
import { useActiveConversation, useChat } from './store/chat';
import { warmEngine } from './lib/warm';
import { VERSION } from './config';

const EXAMPLES: { q: string; icon: string }[] = [
  { q: 'Como faz um pistão?', icon: 'piston' },
  { q: 'Farm de ferro', icon: 'iron_ingot' },
  { q: 'Onde acho diamante?', icon: 'diamond' },
  { q: 'O que o creeper dropa?', icon: 'gunpowder' },
  { q: 'Poção de visão noturna', icon: 'golden_carrot' },
  { q: `O que tem de novo na ${VERSION}?`, icon: 'poplar_sapling' },
];

export default function App() {
  const mobile = useIsMobile();
  const [sidebar, setSidebar] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 640 : true));
  const [search, setSearch] = useState(false);
  const send = useChat((s) => s.send);
  const newConversation = useChat((s) => s.newConversation);
  const conv = useActiveConversation();
  const composer = useRef<ComposerHandle>(null);

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
  const { scrollerRef, contentRef, showButton, follow, pin } = useAutoScroll();
  // Nova pergunta ou troca de conversa: a última pergunta sobe para o topo e fica ali.
  useEffect(() => {
    if (count) pin();
  }, [count, conv?.id, pin]);

  useEffect(() => setSidebar(!mobile), [mobile]);

  const empty = !conv || conv.messages.length === 0;

  return (
    <AskContext.Provider value={ask}>
      <div className="flex h-full">
        {mobile ? (
          <Sidebar open={sidebar} mobile onClose={() => setSidebar(false)} onAsk={ask} onSearch={() => setSearch(true)} />
        ) : (
          // Desktop: a barra encolhe/expande a largura (o chat acompanha), sem sumir de uma vez.
          <motion.div
            className="h-full shrink-0 overflow-hidden"
            initial={false}
            animate={{ width: sidebar ? 260 : 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            inert={!sidebar ? true : undefined}
            aria-hidden={!sidebar ? true : undefined}
          >
            <motion.div className="h-full w-[260px]" initial={false} animate={{ opacity: sidebar ? 1 : 0, x: sidebar ? 0 : -24 }} transition={{ duration: 0.28, ease: EASE }}>
              <Sidebar open={sidebar} mobile={false} onClose={() => setSidebar(false)} onAsk={ask} onSearch={() => setSearch(true)} />
            </motion.div>
          </motion.div>
        )}
        <AnimatePresence>
          {mobile && sidebar ? (
            <motion.div
              key="scrim"
              className="fixed inset-0 z-30 bg-black/50"
              onClick={() => setSidebar(false)}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
            />
          ) : null}
        </AnimatePresence>

        <main className="relative flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center gap-1 px-2">
            <AnimatePresence initial={false}>
              {!sidebar || mobile ? (
                <motion.div
                  key="open-sidebar"
                  className="flex items-center gap-1"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.22, ease: EASE, delay: mobile ? 0 : 0.08 }}
                >
                  <button type="button" onClick={() => setSidebar(true)} aria-label="Abrir barra lateral" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
                    <IconSidebar />
                  </button>
                  <span className="font-pixel text-[17px] font-semibold text-fg">CraftBot</span>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <button type="button" onClick={newConversation} aria-label="Nova conversa" className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
              <IconPlus />
            </button>
          </header>

          {empty ? (
            <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-[12vh]">
              <div className="w-full max-w-[680px]">
                <h1 className="mb-6 text-center text-[30px] leading-tight font-semibold tracking-[-0.02em] text-fg sm:text-[34px]">O que vamos craftar?</h1>
                <motion.div layoutId="composer" transition={{ duration: 0.42, ease: EASE }}>
                  <Composer ref={composer} onSend={ask} big />
                </motion.div>
                <ul className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Exemplos de perguntas">
                  {EXAMPLES.map((e) => (
                    <li key={e.q}>
                      <button
                        type="button"
                        onPointerEnter={warmEngine}
                        onFocus={warmEngine}
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
                  Respostas escritas por IA usando só os dados dos arquivos do Minecraft Java {VERSION}. Atalhos: <kbd className="font-mono">/</kbd> escrever · <kbd className="font-mono">Ctrl K</kbd> buscar item
                </p>
              </div>
            </div>
          ) : (
            <>
              <motion.div
                ref={scrollerRef}
                key={conv!.id}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, ease: EASE }}
              >
                <div ref={contentRef}>
                  <Suspense fallback={<div className="mx-auto max-w-[760px] px-4 pt-6 text-[14px] text-muted">Carregando os dados da {VERSION}…</div>}>
                    <Messages messages={conv!.messages} />
                  </Suspense>
                </div>
              </motion.div>
              <div className="relative shrink-0 px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
                <AnimatePresence>
                  {showButton ? (
                    <motion.button
                      key="to-bottom"
                      type="button"
                      onClick={follow}
                      aria-label="Ir para o fim da resposta"
                      title="Ir para o fim"
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.9 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute -top-12 left-1/2 z-10 -ml-[18px] grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-fg shadow-card hover:bg-surface-2"
                    >
                      <IconArrowDown width={18} height={18} />
                    </motion.button>
                  ) : null}
                </AnimatePresence>
                <div className="mx-auto w-full max-w-[760px]">
                  <motion.div layoutId="composer" transition={{ duration: 0.42, ease: EASE }}>
                    <Composer ref={composer} onSend={ask} />
                  </motion.div>
                  <p className="mt-1.5 text-center text-[11.5px] text-muted">Responde com os dados do jogo. Se faltar, pesquisa na Minecraft Wiki e na web e mostra a fonte.</p>
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
