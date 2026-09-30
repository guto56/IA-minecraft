import { useEffect, useId, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { itemName } from '../lib/kb';
import { ItemIcon } from './ItemIcon';
import { useIsMobile } from '../hooks/useMedia';

interface Props {
  /** Itens aceitos no slot; com mais de um, alterna a cada 1s (igual ao livro de receitas). */
  items?: string[];
  count?: number;
  result?: boolean;
  tagLabel?: string;
  onPick?: (item: string) => void;
  /** Atraso de entrada (animação de montagem da grade). */
  delay?: number;
  animate?: boolean;
}

export function Slot({ items = [], count, result, tagLabel, onPick, delay = 0, animate = false }: Props) {
  const [i, setI] = useState(0);
  const [hover, setHover] = useState(false);
  const reduce = useReducedMotion();
  const mobile = useIsMobile();
  const tipId = useId();
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 1000);
    return () => clearInterval(t);
  }, [items.length]);
  const item = items[i % Math.max(1, items.length)];
  const iconSize = result ? (mobile ? 32 : 40) : mobile ? 24 : 32;
  const interactive = !!item && !!onPick;
  const name = item ? itemName(item) : '';
  const content = item ? (
    <motion.span
      className="grid place-items-center"
      initial={animate && !reduce ? { scale: 0.6, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 22, delay }}
    >
      <ItemIcon id={item} size={iconSize} label="" />
    </motion.span>
  ) : null;

  const Tag = interactive ? 'button' : 'span';
  return (
    <Tag
      type={interactive ? 'button' : undefined}
      className={`mc-slot ${result ? 'is-result' : ''} ${interactive ? 'is-interactive' : ''}`}
      onClick={interactive ? () => onPick!(item!) : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      aria-label={item ? `${name}${count && count > 1 ? `, ${count}` : ''}${tagLabel ? ` (${tagLabel})` : ''}` : 'vazio'}
      aria-describedby={hover && item ? tipId : undefined}
    >
      {content}
      {item && count && count > 1 ? <span className="mc-count tabular">{count}</span> : null}
      {hover && item ? (
        <span id={tipId} role="tooltip" className="mc-tooltip absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2">
          {name}
          {tagLabel ? <span className="sub block">{tagLabel}</span> : null}
          {interactive ? <span className="sub block">Clique para ver a receita</span> : null}
        </span>
      ) : null}
    </Tag>
  );
}
