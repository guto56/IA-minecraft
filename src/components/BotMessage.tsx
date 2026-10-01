import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { BotMessage as Msg } from '../store/chat';
import { useChat } from '../store/chat';
import { ItemIcon } from './ItemIcon';
import { RichText, wordCount } from './RichText';
import { AnswerCard, thinkingBudget } from './AnswerView';
import { IconCheck, IconChevron, IconShare } from './Icons';
import { Collapse } from './Collapse';
import { VERSION } from '../config';

type Phase = 'understanding' | 'identified' | 'searching' | 'building' | 'streaming' | 'done';
const ORDER: Phase[] = ['understanding', 'identified', 'searching', 'building', 'streaming', 'done'];

const STEP_LABEL: Record<Exclude<Phase, 'done' | 'streaming'>, string> = {
  understanding: 'Entendendo a pergunta…',
  identified: 'Identificado',
  searching: `Buscando nos dados da ${VERSION}…`,
  building: 'Montando a resposta…',
};

/** Linha de texto de uma resposta (com streaming). */
function Lines({ lines, words }: { lines: string[]; words?: number }) {
  let left = words;
  return (
    <div className="grid gap-2 text-[15px] leading-[1.6] text-fg/90">
      {lines.map((l, i) => {
        const n = l.split(/\s+/).filter(Boolean).length;
        const take = left === undefined ? undefined : Math.max(0, Math.min(n, left));
        if (left !== undefined) left -= n;
        if (take === 0) return null;
        return (
          <p key={i} className="max-w-[68ch]">
            <RichText text={l} words={take === n ? undefined : take} />
          </p>
        );
      })}
    </div>
  );
}

export function BotMessage({ msg }: { msg: Msg }) {
  const reduce = useReducedMotion();
  const animatingId = useChat((s) => s.animatingId);
  const finish = useChat((s) => s.finishAnimation);
  const shouldAnimate = !!msg.animate && !reduce;
  const first = msg.result.answers[0];
  const budget = thinkingBudget(first);
  const [phase, setPhase] = useState<Phase>(shouldAnimate ? 'understanding' : 'done');
  const [words, setWords] = useState(0);
  const totalWords = useMemo(() => msg.result.answers.reduce((s, a) => s + wordCount(a.text), 0), [msg.result.answers]);
  const timers = useRef<number[]>([]);

  // Sequência: entendendo → identificado → buscando → montando → streaming → pronto.
  useEffect(() => {
    if (!shouldAnimate) {
      if (msg.animate) finish(msg.id);
      return;
    }
    const t = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    const u = budget * 0.28;
    t(u, () => setPhase('identified'));
    t(u * 1.9, () => setPhase('searching'));
    t(u * 2.9, () => setPhase('building'));
    t(budget, () => setPhase('streaming'));
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'streaming') return;
    if (words >= totalWords) {
      setPhase('done');
      finish(msg.id);
      return;
    }
    const id = window.setTimeout(() => setWords((w) => w + 1), 25);
    return () => clearTimeout(id);
  }, [phase, words, totalWords, finish, msg.id]);

  // Botão "Parar" (no composer) encerra a animação desta mensagem.
  useEffect(() => {
    if (shouldAnimate && animatingId !== msg.id && phase !== 'done') {
      timers.current.forEach(clearTimeout);
      setPhase('done');
    }
  }, [animatingId, msg.id, phase, shouldAnimate]);

  const idx = ORDER.indexOf(phase);
  const showCard = idx >= ORDER.indexOf('building');
  let wordsLeft = phase === 'streaming' ? words : undefined;

  return (
    <article className="flex gap-3 sm:gap-4" aria-busy={phase !== 'done'}>
      <div className="mt-0.5 shrink-0">
        <ItemIcon id="crafting_table" size={32} label="CraftBot" />
      </div>
      <div className="min-w-0 flex-1">
        {msg.ai?.fallback ? (
          <p className="mb-2 text-[12.5px] text-gold">IA indisponível agora ({msg.ai.error}). Respondi com o motor local, usando os mesmos dados do jogo.</p>
        ) : null}
        {phase !== 'done' && idx < ORDER.indexOf('streaming') ? <Progress phase={phase} msg={msg} /> : <Reasoning msg={msg} />}
        <div className="grid gap-5">
          {msg.result.answers.map((a, i) => {
            const n = wordCount(a.text);
            const take = wordsLeft;
            if (wordsLeft !== undefined) wordsLeft = Math.max(0, wordsLeft - n);
            return (
              <div key={i} className="grid gap-3">
                {showCard && phase !== 'building' ? <Lines lines={a.text} words={phase === 'streaming' ? take : undefined} /> : null}
                <AnimatePresence>
                  {showCard ? (
                    <motion.div
                      initial={shouldAnimate ? { opacity: 0, y: 6 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <AnswerCard a={a} animate={shouldAnimate && phase === 'building'} />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                {phase === 'done' ? (
                  <div className="flex items-center gap-3 text-[12px] text-muted">
                    <p>
                      <SourceLine source={a.source} />
                    </p>
                    {i === msg.result.answers.length - 1 ? <ShareButton question={msg.question} /> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}

export function ShareButton({ question }: { question: string }) {
  const [done, setDone] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}/?q=${encodeURIComponent(question)}`;
    try {
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      window.prompt('Copie o link:', url);
    }
  };
  return (
    <button type="button" onClick={share} className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-surface-2 hover:text-fg" aria-label="Copiar link desta pergunta">
      {done ? <IconCheck width={14} height={14} className="text-emerald" /> : <IconShare width={14} height={14} />}
      {done ? 'Link copiado' : 'Compartilhar'}
    </button>
  );
}

/** Linha de fonte em cinza (com link quando a fonte é uma URL). */
export function SourceLine({ source }: { source: string }) {
  const m = /(https?:\/\/\S+)/.exec(source);
  if (!m) return source;
  const url = m[1];
  const host = new URL(url).hostname.replace(/^www\./, '');
  const before = source.slice(0, m.index).replace(/\s*\+\s*$/, '');
  return (
    <>
      {before ? `${before} + ` : `Java ${VERSION} · fonte: `}
      <a href={url} target="_blank" rel="noreferrer" className="text-muted underline decoration-line hover:text-fg">
        {host}
      </a>
    </>
  );
}

function buildingLabel(msg: Msg) {
  const t = msg.result.answers[0].type;
  if (t === 'recipe' || t === 'smelt' || t === 'potion' || t === 'uses') return 'Montando a grade…';
  if (t === 'farm') return 'Separando os materiais…';
  if (t === 'location') return 'Medindo as alturas…';
  return 'Montando a resposta…';
}

function Progress({ phase, msg }: { phase: Phase; msg: Msg }) {
  const t = msg.result.traces[0];
  const pct = phase === 'understanding' ? 0 : phase === 'identified' ? 0.25 : phase === 'searching' ? 0.7 : 1;
  return (
    <div className="mb-3 grid gap-2 text-[14px] text-muted" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        {phase === 'understanding' ? (
          <span className="flex gap-1" aria-hidden="true">
            <span className="pixel-dot" />
            <span className="pixel-dot" />
            <span className="pixel-dot" />
          </span>
        ) : null}
        <span>{phase === 'identified' ? 'Identificado:' : phase === 'building' ? buildingLabel(msg) : STEP_LABEL[phase as keyof typeof STEP_LABEL]}</span>
        {phase !== 'understanding' && t ? <TraceChip trace={t} /> : null}
      </div>
      {phase === 'searching' || phase === 'building' ? (
        <div className="xp-bar" aria-hidden="true">
          <motion.span initial={{ width: '8%' }} animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} />
        </div>
      ) : null}
    </div>
  );
}

function TraceChip({ trace }: { trace: Msg['result']['traces'][number] }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[12.5px] text-fg">
      {trace.entity?.icon ? <ItemIcon id={trace.entity.icon} size={16} label="" /> : null}
      <span>{trace.intentLabel}</span>
      {trace.entity ? (
        <>
          <span className="text-muted">·</span>
          <span>{trace.entity.label}</span>
        </>
      ) : null}
    </span>
  );
}

/** "Como cheguei nisso": passos concluídos, recolhido por padrão. */
function Reasoning({ msg }: { msg: Msg }) {
  const [open, setOpen] = useState(false);
  const traces = msg.result.traces;
  return (
    <div className="mb-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1 text-[13px] text-muted hover:text-fg">
        <IconChevron width={14} height={14} className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        Como cheguei nisso
      </button>
      <Collapse open={open}>
        <dl className="mt-2 grid gap-1.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px]">
          {traces.map((t, i) => (
            <div key={i} className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-1">
              {traces.length > 1 ? (
                <>
                  <dt className="text-muted">Parte</dt>
                  <dd className="text-fg">“{t.question}”</dd>
                </>
              ) : null}
              <dt className="text-muted">Intenção</dt>
              <dd className="text-fg">{t.intentLabel}</dd>
              <dt className="text-muted">Entidade</dt>
              <dd className="text-fg">{t.entity ? `${t.entity.label} (${t.entity.kind}:${t.entity.id})` : '—'}</dd>
              <dt className="text-muted">Confiança</dt>
              <dd className="tabular font-mono text-fg">{Math.round(t.confidence * 100)}%</dd>
              <dt className="text-muted">Fonte</dt>
              <dd className="break-all text-fg">{t.source}</dd>
            </div>
          ))}
        </dl>
      </Collapse>
    </div>
  );
}
