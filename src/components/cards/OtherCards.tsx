import { useState } from 'react';
import type { Drop, Farm, Trade } from '../../data/types';
import type { Answer, BrewStep, DropSource, OreLocation } from '../../engine/answers';
import { levelName, potionLabel } from '../../engine/answers';
import { professionLabel } from '../../engine/entities';
import { farmById, itemName, items } from '../../lib/kb';
import { useChat } from '../../store/chat';
import { useAsk } from '../AskContext';
import { ItemIcon } from '../ItemIcon';
import { Slot } from '../Slot';
import { IconChevron, IconExternal, IconStar } from '../Icons';
import { VideoList } from './VideoCard';
import { Collapse } from '../Collapse';
import { trustedUrl } from '../../ai/untrusted';
import { CardShell, IconButton } from './CardShell';

const pct = (c: number) => (c >= 1 ? '100%' : c >= 0.1 ? `${Math.round(c * 100)}%` : `${String(Math.round(c * 1000) / 10).replace('.', ',')}%`);
const qty = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);
const fmtY = (y: number) => (y < 0 ? `−${Math.abs(y)}` : `${y}`);

function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'gold' | 'diamond' | 'emerald' | 'redstone' }) {
  const color = { muted: 'text-muted border-line', gold: 'text-gold border-gold/40', diamond: 'text-diamond border-diamond/40', emerald: 'text-emerald border-emerald/40', redstone: 'text-redstone-ink border-redstone/40' }[tone];
  return <span className={`inline-flex items-center rounded-md border px-1.5 py-px text-[11.5px] leading-5 whitespace-nowrap ${color}`}>{children}</span>;
}

function Chip({ label, icon, onClick, hint }: { label: string; icon?: string; onClick: () => void; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-left text-[13.5px] text-fg transition-[transform,border-color] duration-150 ease-out hover:-translate-y-px hover:border-muted"
    >
      {icon ? <ItemIcon id={icon} size={20} label="" /> : null}
      <span>{label}</span>
      {hint ? <span className="font-mono text-[11.5px] text-muted">{hint}</span> : null}
    </button>
  );
}

/* ------------------------------ Farm ------------------------------ */

function Difficulty({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Dificuldade ${n} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-3 w-3 border ${i <= n ? 'border-[#7a5a10] bg-gold' : 'border-line bg-surface-2'}`} />
      ))}
    </span>
  );
}

export function FarmCard({ farm }: { farm: Farm }) {
  const ask = useAsk();
  const [open, setOpen] = useState(true);
  const favorites = useChat((s) => s.favorites);
  const toggleFavorite = useChat((s) => s.toggleFavorite);
  const key = `farm:${farm.id}`;
  const fav = favorites.some((f) => f.key === key);
  return (
    <CardShell
      title={farm.nome}
      icon={farm.produz[0] ?? 'emerald'}
      actions={
        <IconButton label={fav ? 'Remover dos favoritos' : 'Fixar nos favoritos'} active={fav} onClick={() => toggleFavorite({ key, label: farm.nome, icon: farm.produz[0], query: farm.nome })}>
          <IconStar filled={fav} />
        </IconButton>
      }
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px]">
          <span className="flex items-center gap-2 text-muted">
            Dificuldade <Difficulty n={farm.dificuldade} />
          </span>
          <span className="text-muted">
            Rende <span className="text-fg">{farm.rende.texto}</span>
          </span>
        </div>
        <div>
          <h4 className="mb-2 text-[13px] font-medium text-muted">Materiais</h4>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {farm.materiais.map((m) => (
              <li key={m.item}>
                <button type="button" onClick={() => ask(`Como faz ${items[m.item]?.name ?? m.item}?`)} className="flex items-center gap-2 rounded text-[13.5px] hover:text-fg">
                  <ItemIcon id={m.item} size={24} label="" />
                  <span className="tabular font-mono text-[13px]">{m.qtd}×</span>
                  <span className="text-muted">{itemName(m.item)}</span>
                </button>
              </li>
            ))}
          </ul>
          {farm.requisitos.length ? <p className="mt-2 text-[13px] text-muted">Precisa: {farm.requisitos.join(' · ')}</p> : null}
        </div>
        <div>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mb-2 flex items-center gap-1 text-[13px] font-medium text-muted hover:text-fg">
            <IconChevron className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`} width={14} height={14} />
            Passo a passo ({farm.passos.length})
          </button>
          <Collapse open={open}>
            <ol className="grid gap-1.5 text-[14px]">
              {farm.passos.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span className="tabular mt-px w-5 shrink-0 text-right font-mono text-[12.5px] text-emerald">{i + 1}</span>
                  <span>{p}</span>
                </li>
              ))}
            </ol>
          </Collapse>
        </div>
        {farm.erros_comuns.length ? (
          <div>
            <h4 className="mb-1.5 text-[13px] font-medium text-muted">Erros comuns</h4>
            <ul className="grid gap-1 text-[13.5px] text-muted">
              {farm.erros_comuns.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-[9px] h-1 w-1 shrink-0 bg-redstone" aria-hidden="true" />
                  {e}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {farm.alimenta.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-muted">Alimenta:</span>
            {farm.alimenta.map((id) => {
              const f = farmById(id);
              return f ? <Chip key={id} label={f.nome} icon={f.produz[0]} onClick={() => ask(f.nome)} /> : null;
            })}
          </div>
        ) : null}
        <VideoList title="Tutorial em vídeo" videos={[{ title: farm.video_titulo, url: farm.video, description: `Passo a passo da ${farm.nome.toLowerCase()} em vídeo.` }]} />
      </div>
    </CardShell>
  );
}

/* ------------------------------ Localização ------------------------------ */

function HeightChart({ ore }: { ore: OreLocation }) {
  const lo = ore.dimension === 'overworld' ? -64 : 0;
  const hi = ore.dimension === 'overworld' ? 320 : 128;
  const H = 200;
  const y = (v: number) => H - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * H;
  const ticks = ore.dimension === 'overworld' ? [320, 256, 128, 64, 0, -64] : [128, 64, 0];
  return (
    <svg width="112" height={H + 16} viewBox={`-40 -8 112 ${H + 16}`} role="img" aria-label={`Faixa de altura de Y ${fmtY(lo)} a Y ${fmtY(hi)}`} className="shrink-0 overflow-visible">
      {ticks.map((t) => (
        <g key={t}>
          <line x1="-4" x2="44" y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
          <text x="-8" y={y(t) + 4} textAnchor="end" className="fill-[var(--text-muted)] font-mono text-[10px]">
            {fmtY(t)}
          </text>
        </g>
      ))}
      {ore.ranges.map((r, i) => {
        const x = 6 + i * 9;
        return (
          <g key={i}>
            <rect x={x} y={y(r.max)} width="7" height={Math.max(2, y(r.min) - y(r.max))} fill={r.biomes[0] === '*' ? 'var(--diamond)' : 'var(--gold)'} opacity={0.35} />
            {r.peak ? <rect x={x} y={y(r.peak[1]) - 1.5} width="7" height="3" fill={r.biomes[0] === '*' ? 'var(--diamond)' : 'var(--gold)'} /> : null}
          </g>
        );
      })}
      <line x1="0" x2="48" y1={y(ore.yIdeal)} y2={y(ore.yIdeal)} stroke="var(--emerald)" strokeWidth="2" />
      <polygon points={`48,${y(ore.yIdeal)} 54,${y(ore.yIdeal) - 4} 54,${y(ore.yIdeal) + 4}`} fill="var(--emerald)" />
    </svg>
  );
}

export function LocationCard({ a }: { a: Extract<Answer, { type: 'location' }> }) {
  const ore = a.ore;
  return (
    <CardShell title={a.title} icon={a.icon} subtitle={ore ? (ore.dimension === 'nether' ? 'Nether' : 'Overworld') : undefined}>
      {ore ? (
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="min-w-0">
            <p className="text-[13px] text-muted">Melhor altura</p>
            <p className="tabular font-mono text-[44px] leading-none font-medium tracking-[-0.03em] whitespace-nowrap text-emerald sm:text-[56px]">
              <span className="text-[28px] text-muted">Y</span> {fmtY(ore.yIdeal)}
            </p>
            {ore.yExtra.length ? <p className="mt-2 text-[13px] text-muted">Também: {ore.yExtra.map((y) => `Y ${fmtY(y)}`).join(', ')}</p> : null}
            <ul className="mt-3 grid gap-1 text-[12.5px] text-muted">
              {ore.ranges.map((r, i) => (
                <li key={i} className="tabular font-mono">
                  <span className={`mr-1.5 inline-block h-2 w-2 align-middle ${r.biomes[0] === '*' ? 'bg-diamond' : 'bg-gold'}`} aria-hidden="true" />Y {fmtY(r.min)} a {fmtY(r.max)} {r.kind === 'trapezoid' ? '(pico no meio)' : '(uniforme)'}
                  {r.biomes[0] !== '*' ? ' · só em alguns biomas' : ''}
                </li>
              ))}
            </ul>
          </div>
          <HeightChart ore={ore} />
        </div>
      ) : null}
      {a.biomes?.length ? (
        <div className={ore ? 'mt-4' : ''}>
          <p className="mb-2 text-[13px] text-muted">Biomas ({a.biomes.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {a.biomes.slice(0, 24).map((b) => (
              <Badge key={b}>{b}</Badge>
            ))}
            {a.biomes.length > 24 ? <Badge>+{a.biomes.length - 24}</Badge> : null}
          </div>
        </div>
      ) : null}
    </CardShell>
  );
}

/* ------------------------------ Drops ------------------------------ */

function dropBadges(d: Drop) {
  const out: { t: string; tone: 'gold' | 'diamond' | 'emerald' | 'muted' | 'redstone' }[] = [];
  if (d.looting) out.push({ t: 'Saque aumenta', tone: 'gold' });
  if (d.fortune) out.push({ t: 'Fortuna aumenta', tone: 'gold' });
  if (d.silkTouch) out.push({ t: 'Toque Suave', tone: 'diamond' });
  if (d.shears) out.push({ t: 'Tesoura', tone: 'diamond' });
  if (d.playerKill) out.push({ t: 'Só se você matar', tone: 'emerald' });
  if (d.cookedOnFire) out.push({ t: 'Assado se morrer em chamas', tone: 'muted' });
  if (d.special) out.push({ t: d.special, tone: 'muted' });
  if (d.anyOf) out.push({ t: `sorteia 1 de ${d.anyOf}`, tone: 'muted' });
  return out;
}

export function DropCard({ a }: { a: Extract<Answer, { type: 'drops' }> }) {
  const ask = useAsk();
  return (
    <CardShell title={a.title} icon={a.icon} subtitle={a.drops.length ? `${a.drops.length} drop${a.drops.length > 1 ? 's' : ''}` : undefined}>
      {a.drops.length ? (
        <ul className="grid gap-1">
          {[...a.drops]
            .sort((x, y) => y.chance - x.chance)
            .map((d, i) => (
              <li key={`${d.item}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-1 py-1.5 hover:bg-surface-2">
                <button type="button" onClick={() => ask(`Pra que serve ${items[d.item]?.name ?? d.item}?`)} className="flex min-w-0 items-center gap-2.5">
                  <ItemIcon id={d.item} size={28} label="" />
                  <span className="truncate text-[14px]">{d.anyOf ? `${items[d.item]?.name ?? d.item} (1 de ${d.anyOf})` : itemName(d.item)}</span>
                </button>
                <span className="tabular font-mono text-[12.5px] text-muted">×{qty(d.min, d.max)}</span>
                <span className="tabular ml-auto font-mono text-[12.5px] text-fg">{pct(d.chance)}</span>
                <span className="flex w-full flex-wrap gap-1 pl-[38px]">
                  {dropBadges(d).map((b) => (
                    <Badge key={b.t} tone={b.tone}>
                      {b.t}
                    </Badge>
                  ))}
                </span>
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-[14px] text-muted">Sem drops.</p>
      )}
      <p className="mt-3 text-[12px] text-muted">Chance por tentativa, sem encantamentos.</p>
    </CardShell>
  );
}

export function DroppedByCard({ a }: { a: Extract<Answer, { type: 'dropped_by' }> }) {
  const ask = useAsk();
  const q = (s: DropSource) => (s.kind === 'mob' ? `O que ${s.label} dropa?` : s.kind === 'block' ? `O que ${s.label} dropa?` : s.label);
  return (
    <CardShell title={itemName(a.item)} icon={a.item} subtitle="De onde vem">
      <ul className="grid gap-1">
        {a.sources.map((s, i) => (
          <li key={`${s.kind}-${s.id}-${i}`}>
            <button type="button" onClick={() => ask(q(s))} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-1 py-1.5 text-left hover:bg-surface-2">
              <ItemIcon id={s.icon} size={28} label="" />
              <span className="text-[14px]">{s.label}</span>
              <span className="tabular font-mono text-[12.5px] text-muted">×{qty(s.drop.min, s.drop.max)}</span>
              <span className="tabular ml-auto font-mono text-[12.5px]">{pct(s.drop.chance)}</span>
              {dropBadges(s.drop).length ? (
                <span className="flex w-full flex-wrap gap-1 pl-[38px]">
                  {dropBadges(s.drop).map((b) => (
                    <Badge key={b.t} tone={b.tone}>
                      {b.t}
                    </Badge>
                  ))}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

/* ------------------------------ Info ------------------------------ */

export function InfoCard({ a }: { a: Extract<Answer, { type: 'info' }> }) {
  const ask = useAsk();
  if (!a.stats.length && !a.items?.length) return null;
  return (
    <CardShell title={a.title} icon={a.icon} actions={a.badge ? <Badge tone={a.badge === 'hostil' || a.badge === 'maldição' ? 'redstone' : a.badge === 'tesouro' ? 'gold' : a.badge === 'passivo' ? 'emerald' : 'muted'}>{a.badge}</Badge> : undefined}>
      {a.stats.length ? (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {a.stats.map((s) => (
            <div key={s.label} className="rounded-lg bg-surface-2 px-3 py-2">
              <dt className="text-[12px] text-muted">{s.label}</dt>
              <dd className="tabular font-mono text-[15px] text-fg">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {a.items?.length ? (
        <div className={`flex flex-wrap gap-2 ${a.stats.length ? 'mt-3' : ''}`}>
          {a.items.map((id) => (
            <Chip key={id} label={itemName(id)} icon={id} onClick={() => ask(`Como faz ${items[id]?.name ?? id}?`)} />
          ))}
        </div>
      ) : null}
    </CardShell>
  );
}

/* ------------------------------ Poções ------------------------------ */

function BrewRow({ s, animate, delay }: { s: BrewStep; animate?: boolean; delay: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <Slot items={[s.inputItem]} tagLabel={potionLabel(s.input)} animate={animate} delay={delay} />
      <span className="font-pixel text-[18px] text-[#404040]">+</span>
      <Slot items={[s.reagent]} animate={animate} delay={delay + 0.04} />
      <img src="/gui/arrow.png" alt="" className="pixelated h-[17px] w-[24px]" />
      <Slot items={[s.outputItem]} tagLabel={potionLabel(s.output)} animate={animate} delay={delay + 0.08} />
      <span className="font-pixel text-[14px] text-[#3f3f3f]">{potionLabel(s.output)}</span>
    </div>
  );
}

export function PotionCard({ a, animate }: { a: Extract<Answer, { type: 'potion' }>; animate?: boolean }) {
  return (
    <CardShell title={potionLabel(a.potion)} icon="brewing_stand" subtitle="Suporte de poções · combustível: pó de blaze">
      <div className="mc-panel grid gap-2 p-3">
        {a.steps.map((s, i) => (
          <BrewRow key={i} s={s} animate={animate} delay={i * 0.12} />
        ))}
      </div>
      {a.variants.length ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {a.variants.map((v) => (
            <li key={v.label} className="flex items-center gap-2 text-[13.5px]">
              <ItemIcon id={v.reagent} size={24} label="" />
              <span className="text-fg">{v.label}</span>
              <span className="text-muted">+ {itemName(v.reagent)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </CardShell>
  );
}

/* ------------------------------ Trocas ------------------------------ */

function Stack({ item, min, max }: { item: string; min: number; max: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <ItemIcon id={item} size={24} />
      <span className="tabular font-mono text-[12.5px]">{min === 0 && max === 0 ? '?' : qty(min, max)}</span>
    </span>
  );
}

export function TradesCard({ a }: { a: Extract<Answer, { type: 'trades' }> }) {
  const ask = useAsk();
  const rows = a.rows.slice(0, 40);
  const byProfession = new Set(a.rows.map((r) => r.profession)).size > 1;
  return (
    <CardShell title={a.title} icon={a.icon} subtitle={`${a.rows.length} troca${a.rows.length === 1 ? '' : 's'}`}>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[420px] border-separate border-spacing-y-1 text-[13.5px]">
          <thead className="text-left text-[12px] text-muted">
            <tr>
              {byProfession ? <th className="px-1 font-normal">Aldeão</th> : null}
              <th className="px-1 font-normal">Nível</th>
              <th className="px-1 font-normal">Você dá</th>
              <th className="px-1 font-normal">Recebe</th>
              <th className="px-1 text-right font-normal">Usos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ profession, level, trade }, i) => (
              <TradeRow key={i} trade={trade} level={level} profession={byProfession ? profession : undefined} onProfession={() => ask(`Trocas do ${professionLabel(profession)}`)} />
            ))}
          </tbody>
        </table>
      </div>
    </CardShell>
  );
}

function TradeRow({ trade, level, profession, onProfession }: { trade: Trade; level: string; profession?: string; onProfession: () => void }) {
  const notes = trade.notes.filter((n) => !n.startsWith('potion:'));
  return (
    <tr className="align-middle">
      {profession ? (
        <td className="px-1">
          <button type="button" onClick={onProfession} className="text-emerald hover:underline">
            {professionLabel(profession)}
          </button>
        </td>
      ) : null}
      <td className="px-1 whitespace-nowrap text-muted">{levelName(level)}</td>
      <td className="px-1">
        <span className="flex flex-wrap items-center gap-2">
          <Stack item={trade.wants.item} min={trade.wants.min} max={trade.wants.max} />
          {trade.wants2 ? <Stack item={trade.wants2.item} min={trade.wants2.min} max={trade.wants2.max} /> : null}
        </span>
      </td>
      <td className="px-1">
        <span className="flex flex-wrap items-center gap-2">
          <Stack item={trade.gives.item} min={trade.gives.min} max={trade.gives.max} />
          {notes.length ? <span className="text-[12px] text-muted">{notes.join(', ')}</span> : null}
          {trade.villagerTypes ? <span className="text-[12px] text-muted">só alguns biomas</span> : null}
        </span>
      </td>
      <td className="tabular px-1 text-right font-mono text-[12.5px] text-muted">{trade.maxUses}</td>
    </tr>
  );
}

/* ------------------------------ Usos / listas / chips ------------------------------ */

export function UsesCard({ a }: { a: Extract<Answer, { type: 'uses' }> }) {
  const ask = useAsk();
  return (
    <CardShell title={`Usos · ${itemName(a.item)}`} icon={a.item} subtitle={`${a.total} ${a.total > 1 ? 'itens' : 'item'}`}>
      <div className="mc-panel inline-flex max-w-full flex-wrap p-2">
        {a.recipes.map((r) => (
          <Slot key={r.id} items={[r.result.id]} onPick={(id) => ask(`Como faz ${items[id]?.name ?? id}?`)} />
        ))}
      </div>
      {a.total > a.recipes.length ? <p className="mt-2 text-[12.5px] text-muted">Mostrando {a.recipes.length} de {a.total}.</p> : null}
    </CardShell>
  );
}

export function ListCard({ a }: { a: Extract<Answer, { type: 'list' }> }) {
  const ask = useAsk();
  return (
    <div className="flex flex-wrap gap-2">
      {a.entries.map((e) => (
        <Chip key={e.label} label={e.label} icon={e.icon} hint={e.hint} onClick={() => ask(e.query)} />
      ))}
    </div>
  );
}

export function ClarifyCard({ a }: { a: Extract<Answer, { type: 'clarify' }> }) {
  const ask = useAsk();
  return (
    <div className="flex flex-wrap gap-2">
      {a.options.map((o) => (
        <Chip key={o.query} label={o.label} icon={o.icon} onClick={() => ask(o.query)} />
      ))}
    </div>
  );
}

export function NotUnderstoodCard({ a }: { a: Extract<Answer, { type: 'not_understood' }> }) {
  const ask = useAsk();
  return (
    <div className="flex flex-wrap gap-2">
      {a.suggestions.map((s) => (
        <Chip key={s} label={s} onClick={() => ask(s)} />
      ))}
    </div>
  );
}

/* ------------------------- Pesquisa (wiki/web) ------------------------- */

const hostOf = (url: string) => new URL(url).hostname.replace(/^(www|m)\./, '');

export function WebCard({ a }: { a: Extract<Answer, { type: 'web' }> }) {
  const wiki = a.origin === 'wiki';
  const links = a.results.filter((r) => trustedUrl(r.url));
  return (
    <CardShell title={wiki ? 'Pesquisado na Minecraft Wiki' : 'Pesquisado na web'} subtitle={`“${a.query}”`} icon={wiki ? 'book' : 'compass'}>
      <div className="grid min-w-0 grid-cols-1 gap-3">
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <Badge tone="gold">Fora dos arquivos do jogo</Badge>
          <span>Pode descrever outra versão ou o Bedrock.</span>
        </p>
        <VideoList videos={a.videos ?? (a.video ? [a.video] : [])} />
        {links.length ? (
          <ul className="grid min-w-0 gap-1">
            {links.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-3 rounded-lg px-2 py-1.5 text-[13.5px] transition-colors duration-150 hover:bg-surface-2"
                >
                  <span className="w-[84px] shrink-0 truncate font-mono text-[11.5px] text-muted sm:w-[108px]">{hostOf(r.url)}</span>
                  <span className="min-w-0 flex-1 truncate text-fg">{r.title}</span>
                  <IconExternal width={14} height={14} className="shrink-0 text-muted transition-colors group-hover:text-fg" />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </CardShell>
  );
}
