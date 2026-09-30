import { type ReactNode, forwardRef } from 'react';
import { ItemIcon } from '../ItemIcon';

interface Props {
  title: string;
  subtitle?: string;
  icon?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Moldura comum dos cards de resposta. */
export const CardShell = forwardRef<HTMLDivElement, Props>(function CardShell({ title, subtitle, icon, actions, children, className = '' }, ref) {
  return (
    <section ref={ref} className={`rounded-[14px] border border-line bg-surface ${className}`} aria-label={title}>
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        {icon ? <ItemIcon id={icon} size={32} label="" /> : null}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-pixel text-[17px] leading-tight font-semibold tracking-[0.01em] text-fg">{title}</h3>
          {subtitle ? <p className="truncate text-[13px] text-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
});

export function IconButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-fg ${active ? 'text-gold' : ''}`}
    >
      {children}
    </button>
  );
}
