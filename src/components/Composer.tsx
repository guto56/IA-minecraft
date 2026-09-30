import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { KIND_LABEL, useSearch } from '../lib/useSearch';
import { useChat } from '../store/chat';
import { ItemIcon } from './ItemIcon';
import { warmEngine } from '../lib/warm';
import { IconSend, IconStop } from './Icons';

export interface ComposerHandle {
  focus: () => void;
}

interface Props {
  onSend: (text: string) => void;
  big?: boolean;
}

/** Última "palavra-frase" digitada, para sugerir nomes de itens. */
function tailQuery(text: string) {
  const m = /(?:^|\b(?:faz|fazer|faco|craft\w*|receita d[eoa]|acho|encontro|serve|dropa|farm d[eoa]|de|do|da|o|a|um|uma))\s+([^?.,!]{2,40})$/i.exec(text.trim());
  return m ? m[1] : text.trim().split(/\s+/).length <= 3 ? text.trim() : '';
}

export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ onSend, big }, ref) {
  const [value, setValue] = useState('');
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [focused, setFocused] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const animatingId = useChat((s) => s.animatingId);
  const finish = useChat((s) => s.finishAnimation);
  useImperativeHandle(ref, () => ({ focus: () => ta.current?.focus() }));

  const tail = tailQuery(value);
  const search = useSearch(focused || value.length > 0);
  const suggestions = useMemo(() => (dismissed || tail.length < 2 || !search ? [] : search.searchEntities(tail, 6)), [tail, dismissed, search]);
  const open = suggestions.length > 0 && focused;

  useEffect(() => setActive(0), [tail]);
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const submit = (text = value) => {
    if (!text.trim()) return;
    onSend(text);
    setValue('');
    setDismissed(false);
  };

  const accept = (i: number) => {
    const e = suggestions[i];
    if (!e) return;
    const idx = value.toLowerCase().lastIndexOf(tail.toLowerCase());
    const next = idx >= 0 ? value.slice(0, idx) + e.label : e.label;
    setValue(next);
    setDismissed(true);
    requestAnimationFrame(() => ta.current?.focus());
  };

  return (
    <div className="relative">
      {open ? (
        <ul role="listbox" id="composer-suggestions" aria-label="Sugestões de itens" className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-card">
          {suggestions.map((e, i) => (
            <li
              key={`${e.kind}:${e.id}`}
              id={`sug-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(ev) => {
                ev.preventDefault();
                accept(i);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-1.5 text-[14px] ${i === active ? 'bg-surface-2' : ''}`}
            >
              <ItemIcon id={e.icon} size={24} label="" />
              <span className="flex-1 truncate">{e.label}</span>
              <span className="text-[12px] text-muted">{KIND_LABEL[e.kind]}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className={`flex items-end gap-2 rounded-2xl border border-line bg-surface-2 p-2 pl-4 transition-colors duration-150 focus-within:border-muted ${big ? 'min-h-[64px]' : ''}`}>
        <label htmlFor="composer" className="sr-only">
          Pergunte sobre Minecraft Java 26.3
        </label>
        <textarea
          id="composer"
          ref={ta}
          rows={1}
          value={value}
          placeholder="Pergunte sobre receitas, farms, drops…"
          aria-autocomplete="list"
          onFocus={() => {
            setFocused(true);
            warmEngine();
          }}
          onBlur={() => setFocused(false)}
          aria-controls={open ? 'composer-suggestions' : undefined}
          aria-activedescendant={open ? `sug-${active}` : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            setDismissed(false);
          }}
          onKeyDown={(e) => {
            if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              e.preventDefault();
              setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length);
              return;
            }
            if (open && e.key === 'Tab') {
              e.preventDefault();
              accept(active);
              return;
            }
            if (open && e.key === 'Escape') {
              setDismissed(true);
              return;
            }
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className="max-h-[200px] flex-1 resize-none self-center bg-transparent py-1.5 text-[15px] leading-6 text-fg outline-none placeholder:text-muted"
        />
        {animatingId ? (
          <button type="button" onClick={() => finish(animatingId)} aria-label="Parar" title="Parar" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-fg text-bg transition-transform duration-150 hover:scale-105">
            <IconStop />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => submit()}
            disabled={!value.trim()}
            aria-label="Enviar"
            title="Enviar (Enter)"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald text-emerald-ink transition-[opacity,transform] duration-150 enabled:hover:-translate-y-px disabled:opacity-35"
          >
            <IconSend />
          </button>
        )}
      </div>
    </div>
  );
});
