import { useEffect, useRef, useState } from 'react';
import { KIND_LABEL, defaultQuestion, searchEntities } from '../lib/search';
import { ItemIcon } from './ItemIcon';
import { IconSearch } from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
  onAsk: (q: string) => void;
}

/** Busca direta (Ctrl+K): qualquer item, mob, farm, poção ou encantamento. */
export function ItemSearch({ open, onClose, onAsk }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const results = searchEntities(q, 12);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setQ('');
      requestAnimationFrame(() => input.current?.focus());
    }
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => setActive(0), [q]);

  const choose = (i: number) => {
    const e = results[i];
    if (!e) return;
    onClose();
    onAsk(defaultQuestion(e));
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label="Buscar item"
      className="m-auto mt-[12vh] w-[min(560px,calc(100vw-24px))] rounded-2xl border border-line bg-surface p-0 text-fg shadow-card backdrop:bg-black/50"
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <IconSearch className="text-muted" />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              if (results.length) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length);
            }
            if (e.key === 'Enter') choose(active);
          }}
          placeholder="Buscar item, mob, farm, poção…"
          aria-label="Buscar"
          aria-controls="search-results"
          aria-activedescendant={results.length ? `res-${active}` : undefined}
          className="flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
        />
        <kbd className="rounded border border-line px-1.5 font-mono text-[11px] text-muted">Esc</kbd>
      </div>
      <ul id="search-results" role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
        {q.trim().length < 2 ? <li className="px-4 py-6 text-center text-[14px] text-muted">Digite o nome em português ou inglês.</li> : null}
        {q.trim().length >= 2 && !results.length ? <li className="px-4 py-6 text-center text-[14px] text-muted">Nada com esse nome nos dados da 26.3.</li> : null}
        {results.map((e, i) => (
          <li
            key={`${e.kind}:${e.id}`}
            id={`res-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(i)}
            className={`flex cursor-pointer items-center gap-3 px-4 py-2 ${i === active ? 'bg-surface-2' : ''}`}
          >
            <ItemIcon id={e.icon} size={32} label="" />
            <span className="flex-1 truncate text-[15px]">{e.label}</span>
            <span className="text-[12px] text-muted">{KIND_LABEL[e.kind]}</span>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
