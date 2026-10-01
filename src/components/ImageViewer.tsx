import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { IconClose } from './Icons';

const EASE = [0.32, 0.72, 0, 1] as const;

/** Miniatura que abre em tela cheia com zoom suave (a imagem "cresce" a partir da miniatura). */
export function ImageThumb({ src, id, className = '' }: { src: string; id: string; className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Ver imagem em tela cheia" className={`block overflow-hidden rounded-xl border border-line ${className}`}>
        <motion.img layoutId={`img-${id}`} src={src} alt="Imagem enviada" className="block max-h-[200px] w-auto max-w-[200px] object-cover" transition={{ duration: 0.32, ease: EASE }} />
      </button>
      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              key="viewer"
              role="dialog"
              aria-modal="true"
              aria-label="Imagem enviada"
              className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              onClick={() => setOpen(false)}
            >
              <motion.img layoutId={`img-${id}`} src={src} alt="Imagem enviada" className="max-h-[90vh] max-w-[92vw] rounded-xl object-contain shadow-card" transition={{ duration: 0.32, ease: EASE }} />
              <button
                type="button"
                autoFocus
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <IconClose />
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
