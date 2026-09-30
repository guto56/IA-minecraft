import { useRef, useState } from 'react';
import type { Recipe } from '../../data/types';
import { itemName, items } from '../../lib/kb';
import { directMaterials, materialIcon, materialLabel, rawMaterials } from '../../lib/materials';
import { copyPng, downloadPng, slug } from '../../lib/exportImage';
import { stationLabel } from '../../engine/answers';
import { useChat } from '../../store/chat';
import { useAsk } from '../AskContext';
import { ItemIcon } from '../ItemIcon';
import { Slot } from '../Slot';
import { IconCheck, IconCopy, IconDownload, IconStar } from '../Icons';
import { CardShell, IconButton } from './CardShell';

interface Props {
  item: string;
  recipes: Recipe[];
  quantity: number;
  /** Anima os ingredientes entrando nos slots. */
  animate?: boolean;
}

/** Combustíveis comuns (todos têm o componente de combustível no jar). */
const FUELS = ['coal', 'charcoal', 'coal_block', 'lava_bucket', 'blaze_rod', 'oak_planks'].filter((id) => items[id]?.fuel);

const tagText = (r: Recipe, i: number) => {
  const ing = r.ingredients[i];
  return ing?.tag && ing.items.length > 1 ? materialLabel(`#${ing.tag}`) : undefined;
};

function Arrow({ progress }: { progress?: boolean }) {
  return <img src={progress ? '/gui/arrow-progress.png' : '/gui/arrow.png'} alt="" className="pixelated h-[17px] w-[24px] sm:h-[22px] sm:w-[32px]" />;
}

export function RecipeGrid({ r, animate, onPick }: { r: Recipe; animate?: boolean; onPick: (id: string) => void }) {
  const stagger = 0.04;
  const slot = (i: number | null, k: number) =>
    i === null ? <Slot key={k} /> : <Slot key={k} items={r.ingredients[i].items} tagLabel={tagText(r, i)} onPick={onPick} animate={animate} delay={k * stagger} />;
  const result = <Slot items={[r.result.id]} count={r.result.count} result animate={animate} delay={0.4} />;

  if (r.station === 'crafting') {
    const grid = r.grid ?? Array(9).fill(null);
    return (
      <div className="flex items-center gap-3 sm:gap-5">
        <div className="grid grid-cols-3">{grid.map((g, k) => slot(g, k))}</div>
        <Arrow />
        {result}
      </div>
    );
  }
  if (r.station === 'smelting' || r.station === 'blasting' || r.station === 'smoking') {
    return (
      <div className="flex items-center gap-3 sm:gap-5">
        <div className="flex flex-col items-center gap-1">
          {slot(0, 0)}
          <img src="/gui/flame.png" alt="" className="pixelated h-[21px] w-[21px]" />
          <Slot items={FUELS} tagLabel="Combustível" animate={animate} delay={stagger} />
        </div>
        <Arrow progress />
        {result}
      </div>
    );
  }
  if (r.station === 'campfire') {
    return (
      <div className="flex items-center gap-3 sm:gap-5">
        {slot(0, 0)}
        <ItemIcon id="campfire" size={36} />
        <Arrow />
        {result}
      </div>
    );
  }
  if (r.station === 'stonecutting') {
    return (
      <div className="flex items-center gap-3 sm:gap-5">
        {slot(0, 0)}
        <ItemIcon id="stonecutter" size={36} />
        <Arrow />
        {result}
      </div>
    );
  }
  // ferraria: molde + base + material
  return (
    <div className="flex items-center gap-3 sm:gap-5">
      <div className="flex">{[0, 1, 2].map((i) => slot(i, i))}</div>
      <Arrow />
      {r.kind === 'smithing_trim' ? <Slot items={r.ingredients[1].items} result animate={animate} delay={0.4} tagLabel="Com o enfeite aplicado" /> : result}
    </div>
  );
}

export function RecipeCard({ item, recipes, quantity, animate }: Props) {
  const [idx, setIdx] = useState(0);
  const [raw, setRaw] = useState(false);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const ask = useAsk();
  const favorites = useChat((s) => s.favorites);
  const toggleFavorite = useChat((s) => s.toggleFavorite);
  const r = recipes[idx];
  const name = itemName(item);
  const favKey = `recipe:${item}`;
  const isFav = favorites.some((f) => f.key === favKey);
  const pick = (id: string) => ask(`Como faz ${items[id]?.name ?? id}?`);
  const showMaterials = r.station === 'crafting' || r.station === 'smithing';
  const direct = directMaterials(r, quantity);
  const lines = raw ? rawMaterials(r, quantity) : direct.lines;
  const meta: string[] = [stationLabel(r.station)];
  if (r.time) meta.push(`${r.time / 20}s`);
  if (r.xp) meta.push(`${String(r.xp).replace('.', ',')} XP`);

  const onCopy = async () => {
    if (!exportRef.current) return;
    try {
      const ok = await copyPng(exportRef.current);
      setCopied(ok ? 'ok' : 'fail');
    } catch {
      setCopied('fail');
    }
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <CardShell
      title={name}
      subtitle={meta.join(' · ')}
      icon={item}
      actions={
        <>
          <IconButton label={isFav ? 'Remover dos favoritos' : 'Fixar nos favoritos'} active={isFav} onClick={() => toggleFavorite({ key: favKey, label: name, icon: item, query: `Como faz ${name}?` })}>
            <IconStar filled={isFav} />
          </IconButton>
          <IconButton label={copied === 'ok' ? 'Copiado' : copied === 'fail' ? 'Seu navegador não permite copiar imagem' : 'Copiar como imagem'} onClick={onCopy}>
            {copied === 'ok' ? <IconCheck className="text-emerald" /> : <IconCopy />}
          </IconButton>
          <IconButton label="Baixar PNG" onClick={() => exportRef.current && downloadPng(exportRef.current, `craftbot-${slug(name)}`)}>
            <IconDownload />
          </IconButton>
        </>
      }
    >
      <div ref={exportRef} className="flex flex-col items-start gap-3 bg-surface">
        <div className="mc-panel inline-flex max-w-full p-3 sm:p-4">
          <RecipeGrid r={r} animate={animate} onPick={pick} />
        </div>
        {recipes.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1.5" data-export-ignore="true" role="tablist" aria-label="Outras receitas">
            {recipes.map((x, k) => (
              <button
                key={x.id}
                role="tab"
                aria-selected={k === idx}
                onClick={() => setIdx(k)}
                className={`rounded-md border px-2 py-1 text-[12px] transition-colors duration-150 ease-out ${k === idx ? 'border-emerald text-fg' : 'border-line text-muted hover:border-muted hover:text-fg'}`}
              >
                {k + 1}. {stationLabel(x.station)}
              </button>
            ))}
          </div>
        ) : null}
        {showMaterials ? (
          <div className="w-full">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[13px] text-muted">
                {quantity > 1 ? (
                  <>
                    Para <strong className="tabular font-semibold text-fg">{quantity}</strong> ({direct.crafts} craft{direct.crafts > 1 ? 's' : ''})
                  </>
                ) : (
                  'Materiais'
                )}
              </p>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted select-none" data-export-ignore="true">
                <input type="checkbox" checked={raw} onChange={(e) => setRaw(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--emerald)]" />
                Materiais brutos
              </label>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {lines.map((l) => (
                <li key={l.key} className="flex items-center gap-2 text-[14px]">
                  <ItemIcon id={materialIcon(l.key)} size={24} label="" />
                  <span className="tabular font-mono text-[13px] text-fg">{l.qty}×</span>
                  <span className="text-muted">{materialLabel(l.key)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </CardShell>
  );
}
