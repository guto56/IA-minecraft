import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { KIND_LABEL, useSearch } from '../lib/useSearch';
import { useChat } from '../store/chat';
import { AnimatePresence, motion } from 'motion/react';
import { ItemIcon } from './ItemIcon';
import { warmEngine } from '../lib/warm';
import { IconClose, IconImage, IconSend, IconStop } from './Icons';
import { firstImage, ImageError, prepareImage } from '../lib/image';
import { VERSION } from '../config';

export interface ComposerHandle {
  focus: () => void;
  /** Anexa uma imagem (arrastar e soltar na tela). */
  attach: (file: File) => void;
}

interface Props {
  onSend: (text: string, image?: string) => void;
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
  const [image, setImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');
  const [loadingImage, setLoadingImage] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const animatingId = useChat((s) => s.animatingId);
  const finish = useChat((s) => s.finishAnimation);

  const attach = async (file: File) => {
    setImageError('');
    setLoadingImage(true);
    try {
      setImage(await prepareImage(file));
      requestAnimationFrame(() => ta.current?.focus());
    } catch (e) {
      setImageError(e instanceof ImageError ? e.message : 'Não consegui usar essa imagem.');
    } finally {
      setLoadingImage(false);
    }
  };
  useImperativeHandle(ref, () => ({ focus: () => ta.current?.focus(), attach: (f) => void attach(f) }));

  useEffect(() => {
    if (!imageError) return;
    const t = setTimeout(() => setImageError(''), 4000);
    return () => clearTimeout(t);
  }, [imageError]);

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

  const canSend = !!value.trim() || !!image;
  const submit = (text = value) => {
    if (!text.trim() && !image) return;
    onSend(text, image ?? undefined);
    setValue('');
    setImage(null);
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
      <AnimatePresence>
        {open ? (
        <motion.ul
          key="sugestoes"
          initial={{ opacity: 0, y: 6, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          role="listbox" id="composer-suggestions" aria-label="Sugestões de itens" className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-card">
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
        </motion.ul>
        ) : null}
      </AnimatePresence>
      <div
        className={`rounded-2xl border border-line bg-surface-2 transition-colors duration-150 focus-within:border-emerald/60 ${big ? 'min-h-[64px]' : ''}`}
      >
        <AnimatePresence initial={false}>
          {image || loadingImage ? (
            <motion.div
              key="anexo"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
            >
              <div className="px-3 pt-3">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  className="relative inline-block"
                >
                  {image ? (
                    <img src={image} alt="Imagem anexada" className="h-16 w-16 rounded-lg border border-line object-cover" />
                  ) : (
                    <span className="grid h-16 w-16 place-items-center rounded-lg border border-line bg-surface" aria-label="Preparando imagem">
                      <span className="flex gap-1" aria-hidden="true">
                        <span className="pixel-dot" />
                        <span className="pixel-dot" />
                        <span className="pixel-dot" />
                      </span>
                    </span>
                  )}
                  {image ? (
                    <button
                      type="button"
                      onClick={() => setImage(null)}
                      aria-label="Remover imagem"
                      title="Remover imagem"
                      className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full border border-line bg-surface text-muted shadow-card transition-colors hover:text-fg"
                    >
                      <IconClose width={12} height={12} />
                    </button>
                  ) : null}
                </motion.div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="flex items-end gap-1.5 p-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const f = firstImage(e.target.files);
            if (f) void attach(f);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          aria-label="Anexar imagem"
          title="Anexar imagem (ou cole / arraste)"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted transition-colors duration-150 hover:bg-surface hover:text-fg"
        >
          <IconImage />
        </button>
        <label htmlFor="composer" className="sr-only">
          Pergunte sobre Minecraft Java {VERSION}
        </label>
        <textarea
          id="composer"
          ref={ta}
          rows={1}
          maxLength={1000}
          value={value}
          placeholder={image ? 'Pergunte algo sobre a imagem (opcional)…' : 'Pergunte sobre receitas, farms, drops…'}
          aria-autocomplete="list"
          onFocus={() => {
            setFocused(true);
            warmEngine();
          }}
          onBlur={() => setFocused(false)}
          onPaste={(e) => {
            const f = firstImage(e.clipboardData?.items);
            if (f) {
              e.preventDefault();
              void attach(f);
            }
          }}
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
          className="max-h-[200px] flex-1 resize-none self-center bg-transparent py-1.5 pl-1 text-[15px] leading-6 text-fg outline-none placeholder:text-muted focus-visible:outline-none"
        />
        {animatingId ? (
          <button type="button" onClick={() => finish(animatingId)} aria-label="Parar" title="Parar" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-fg text-bg transition-transform duration-150 hover:scale-105">
            <IconStop />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => submit()}
            disabled={!canSend || loadingImage}
            aria-label="Enviar"
            title="Enviar (Enter)"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald text-emerald-ink transition-[opacity,transform] duration-150 enabled:hover:-translate-y-px disabled:opacity-35"
          >
            <IconSend />
          </button>
        )}
        </div>
      </div>
      <AnimatePresence>
        {imageError ? (
          <motion.p
            key="erro"
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-full mt-1 text-center text-[12.5px] text-redstone-ink"
          >
            {imageError}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
});
