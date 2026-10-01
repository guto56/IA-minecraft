import meta from '../data/meta.json';
import { useChat, useTheme } from '../store/chat';
import { motion } from 'motion/react';
import { ItemIcon } from './ItemIcon';
import { IconMoon, IconPlus, IconSearch, IconSidebar, IconSun, IconTrash } from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
  onAsk: (q: string) => void;
  onSearch: () => void;
  mobile: boolean;
}

function groupLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const diff = Math.floor((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (diff <= 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 7) return 'Últimos 7 dias';
  return 'Mais antigas';
}

export function Sidebar({ open, onClose, onAsk, onSearch, mobile }: Props) {
  const { conversations, activeId, favorites, select, newConversation, remove } = useChat();
  const { theme, toggle } = useTheme();
  const groups = new Map<string, typeof conversations>();
  for (const c of conversations) {
    const g = groupLabel(c.updatedAt);
    groups.set(g, [...(groups.get(g) ?? []), c]);
  }
  const after = () => mobile && onClose();

  return (
    <aside
      aria-label="Conversas"
      className={`flex h-full w-[260px] shrink-0 flex-col border-r border-line bg-surface ${mobile ? `fixed inset-y-0 left-0 z-40 shadow-card transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${open ? 'translate-x-0' : '-translate-x-full'}` : ''}`}
      inert={mobile && !open ? true : undefined}
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <a href="/" onClick={(e) => { e.preventDefault(); newConversation(); after(); }} className="flex items-center gap-2 rounded-lg px-1.5 py-1 no-underline">
          <ItemIcon id="crafting_table" size={28} label="" />
          <span className="font-pixel text-[20px] font-semibold tracking-[0.01em] text-fg">CraftBot</span>
        </a>
        <button type="button" onClick={onClose} aria-label="Recolher barra lateral" title="Recolher" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
          <IconSidebar />
        </button>
      </div>
      <div className="grid gap-1 px-3 pb-3">
        <button type="button" onClick={() => { newConversation(); after(); }} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] text-fg hover:bg-surface-2">
          <IconPlus /> Nova conversa
        </button>
        <button type="button" onClick={() => { onSearch(); after(); }} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] text-fg hover:bg-surface-2">
          <IconSearch /> Buscar item
          <kbd className="ml-auto rounded border border-line px-1.5 font-mono text-[11px] text-muted">Ctrl K</kbd>
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {favorites.length ? (
          <section className="mb-4">
            <h2 className="px-2.5 pb-1 text-[12px] font-medium text-muted">Favoritos</h2>
            <ul>
              {favorites.map((f) => (
                <li key={f.key}>
                  <button type="button" onClick={() => { onAsk(f.query); after(); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[14px] text-fg hover:bg-surface-2">
                    <ItemIcon id={f.icon} size={20} label="" />
                    <span className="truncate">{f.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {conversations.length === 0 ? <p className="px-2.5 text-[13px] text-muted">Suas conversas ficam salvas aqui, só neste navegador.</p> : null}
        {[...groups.entries()].map(([label, list]) => (
          <section key={label} className="mb-4">
            <h2 className="px-2.5 pb-1 text-[12px] font-medium text-muted">{label}</h2>
            <ul>
              {list.map((c) => (
                <motion.li
                  key={c.id}
                  layout="position"
                  initial={Date.now() - c.createdAt < 2000 ? { opacity: 0, x: -10 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                  className="group relative"
                >
                  <button
                    type="button"
                    onClick={() => { select(c.id); after(); }}
                    aria-current={c.id === activeId ? 'page' : undefined}
                    className={`w-full truncate rounded-lg py-1.5 pr-8 pl-2.5 text-left text-[14px] ${c.id === activeId ? 'bg-surface-2 text-fg' : 'text-fg/85 hover:bg-surface-2'}`}
                  >
                    {c.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    aria-label={`Apagar conversa: ${c.title}`}
                    className="absolute top-1/2 right-1 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-redstone focus:opacity-100"
                  >
                    <IconTrash width={16} height={16} />
                  </button>
                </motion.li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-3">
        <span className="inline-flex items-center gap-2 rounded-md border border-emerald/40 bg-emerald/10 px-2 py-1 font-mono text-[12px] text-emerald" title={`${meta.dropName} · dados extraídos em ${meta.extractedAt}`}>
          <span className="h-1.5 w-1.5 bg-emerald" aria-hidden="true" />
          Java {meta.version}
        </span>
        <button type="button" onClick={toggle} aria-label={theme === 'dark' ? 'Usar tema claro (Calcita)' : 'Usar tema escuro (Deepslate)'} title={theme === 'dark' ? 'Tema Calcita' : 'Tema Deepslate'} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
      </div>
    </aside>
  );
}
