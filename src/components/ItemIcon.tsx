import iconsJson from '../data/icons.json';

const icons = iconsJson as { columns: number; index: Record<string, number>; ui: string[] };
const uiIndex = new Map(icons.ui.map((id, i) => [id, i]));

/** Nome do item para o texto alternativo; a base de dados registra quando carrega. */
let resolveName: (id: string) => string = () => '';
export function setIconNameResolver(fn: (id: string) => string) {
  resolveName = fn;
}

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
  const alt = label ?? (id ? resolveName(id) : '');
  if (index === undefined) {
    return <span className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size }} aria-hidden="true" />;
  }
  const res = size <= 32 ? 32 : 64;
  // Ícones da tela inicial vêm de um atlas pequeno; o resto, do atlas completo.
  const ui = uiIndex.get(id!);
  const col = ui ?? index % icons.columns;
  const row = ui !== undefined ? 0 : Math.floor(index / icons.columns);
  const atlas = ui !== undefined ? `/icons/ui-${res}.png` : `/icons/atlas-${res}.png`;
  const columns = ui !== undefined ? icons.ui.length : icons.columns;
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
        backgroundSize: `${columns * size}px auto`,
        backgroundPosition: `-${col * size}px -${row * size}px`,
      }}
    />
  );
}
