import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

/** Abre/fecha com a altura animada (sem saltos), para "Como cheguei nisso", passos etc. */
export function Collapse({ open, children, className = '' }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="c"
          className={`overflow-hidden ${className}`}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ height: { duration: 0.28, ease: [0.32, 0.72, 0, 1] }, opacity: { duration: 0.18 } }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
