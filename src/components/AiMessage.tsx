import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { BotMessage as Msg } from '../store/chat';
import { useAsk } from './AskContext';
import { useChat } from '../store/chat';
import { useSmoothText } from '../hooks/useSmoothText';
import { VERSION } from '../config';
import { AnswerCard } from './AnswerView';
import { ItemIcon } from './ItemIcon';
import { Markdown } from './Markdown';
import { IconChevron } from './Icons';
import { Collapse } from './Collapse';
import { ShareButton, SourceLine } from './BotMessage';

/** Resposta escrita pela IA a partir das ferramentas (dados do jar e curadoria). */
export function AiMessage({ msg }: { msg: Msg }) {
  const ai = msg.ai!;
  const finish = useChat((s) => s.finishAnimation);
  const ask = useAsk();
  const reduce = useReducedMotion();
  const working = ai.status === 'thinking' || ai.status === 'writing';
  const shown = useSmoothText(ai.text, !!msg.animate && !reduce);
  const caughtUp = shown.length >= ai.text.length;

  // Terminou de chegar e de aparecer: encerra a "animação" (libera o botão Enviar).
  useEffect(() => {
    if (msg.animate && !working && caughtUp) finish(msg.id);
  }, [msg.animate, working, caughtUp, finish, msg.id]);

  const cards = msg.result.answers;
  const sources = [...new Set(cards.map((a) => a.source))];
  const lastStep = ai.steps[ai.steps.length - 1];

  return (
    <article className="flex gap-3 sm:gap-4" aria-busy={working}>
      <div className="mt-0.5 shrink-0">
        <ItemIcon id="crafting_table" size={32} label="CraftBot" />
      </div>
      <div className="min-w-0 flex-1">
        {working && !ai.text ? (
          <div className="mb-3 grid gap-2 text-[14px] text-muted" role="status" aria-live="polite">
            <div className="flex flex-wrap items-center gap-3">
              {!lastStep ? (
                <>
                  <span className="flex gap-1" aria-hidden="true">
                    <span className="pixel-dot" />
                    <span className="pixel-dot" />
                    <span className="pixel-dot" />
                  </span>
                  <span>Entendendo a pergunta…</span>
                </>
              ) : (
                <>
                  <span>Consultando os dados da {VERSION}:</span>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[12.5px] text-fg">{lastStep.label}</span>
                </>
              )}
            </div>
            {lastStep ? (
              <div className="xp-bar" aria-hidden="true">
                <motion.span initial={{ width: '10%' }} animate={{ width: `${Math.min(92, 25 + ai.steps.length * 22)}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
              </div>
            ) : null}
          </div>
        ) : (
          <Steps msg={msg} />
        )}

        {shown ? <Markdown text={shown} /> : null}
        {ai.status === 'stopped' && !ai.text ? <p className="text-[14px] text-muted">Resposta interrompida.</p> : null}
        {ai.status === 'error' ? (
          <div className="mt-1 grid gap-2">
            <p className="text-[14px] text-redstone-ink">Não consegui terminar a resposta: {ai.error}</p>
            <div>
              <button type="button" onClick={() => ask(msg.question)} className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[13.5px] hover:border-muted">
                Tentar de novo
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-3 grid gap-4">
          <AnimatePresence initial={false}>
            {cards.map((a, i) => (
              <motion.div
                key={`${a.type}-${i}`}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <AnswerCard a={a} animate={!!msg.animate} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {!working ? (
          <div className="mt-3 flex items-center gap-3 text-[12px] text-muted">
            <p>
              {sources.length ? <SourceLine source={sources[0]} /> : `Java ${VERSION} · fonte: arquivos do jogo`}
              {' · '}texto por IA a partir desses dados
            </p>
            <ShareButton question={msg.question} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** "Como cheguei nisso": o que a IA consultou. */
function Steps({ msg }: { msg: Msg }) {
  const [open, setOpen] = useState(false);
  const ai = msg.ai!;
  if (!ai.steps.length && !ai.model) return null;
  return (
    <div className="mb-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1 text-[13px] text-muted hover:text-fg">
        <IconChevron width={14} height={14} className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        Como cheguei nisso
      </button>
      <Collapse open={open}>
        <ol className="mt-2 grid gap-1.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px]">
          {ai.steps.map((s, i) => (
            <li key={i} className="grid grid-cols-[18px_1fr] gap-x-2">
              <span className="tabular font-mono text-emerald">{i + 1}</span>
              <span>
                <span className="text-muted">{s.name === 'buscar_nomes' ? 'Busquei nomes' : 'Consultei os dados'}:</span> “{s.query}” → <span className={s.found ? 'text-fg' : 'text-redstone-ink'}>{s.found ? s.label : 'nada encontrado'}</span>
              </span>
            </li>
          ))}
          {!ai.steps.length ? <li className="text-muted">Respondi sem consultar os dados (pergunta fora do jogo ou de conversa).</li> : null}
          {ai.model ? <li className="pt-1 text-[12px] text-muted">Modelo: {ai.model}</li> : null}
        </ol>
      </Collapse>
    </div>
  );
}
