import iconsJson from '../data/icons.json';
import { items } from '../lib/kb';

const icons = iconsJson as { columns: number; index: Record<string, number> };

interface Props {
  id?: string;
  size?: number;
  /** Texto alternativo; por padrão, o nome do item. Vazio = decorativo. */
  label?: string;
  className?: string;
}

/** Ícone do item recortado do atlas gerado a partir do jar (sempre pixelado). */
export function ItemIcon({ id, size = 32, label, className = '' }: Props) {
  const index = id ? icons.index[id] : undefined;
  const alt = label ?? (id ? (items[id]?.name ?? id) : '');
  if (index === undefined) {
    return <span className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size }} aria-hidden="true" />;
  }
  const col = index % icons.columns;
  const row = Math.floor(index / icons.columns);
  const atlas = size <= 32 ? '/icons/atlas-32.png' : '/icons/atlas-64.png';
  return (
    <span
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={`pixelated inline-block shrink-0 bg-no-repeat ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${atlas})`,
        backgroundSize: `${icons.columns * size}px auto`,
        backgroundPosition: `-${col * size}px -${row * size}px`,
      }}
    />
  );
}
