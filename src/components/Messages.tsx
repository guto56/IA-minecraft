import { motion } from 'motion/react';
import type { Message } from '../store/chat';
import { AiMessage } from './AiMessage';
import { BotMessage } from './BotMessage';
import { ImageThumb } from './ImageViewer';
import '../lib/kb';

/** Distância vertical do container (pt-4 + pb-10) somada à margem do topo da pergunta. */
const CHROME = 56;

function renderMessage(m: Message) {
  if (m.role === 'user') {
    return (
      <motion.div
        key={m.id}
        data-user-message
        className="flex scroll-mt-4 flex-col items-end gap-2"
        // Só a pergunta que acabou de ser enviada entra animada (o histórico aparece parado).
        initial={Date.now() - m.at < 1500 ? { opacity: 0, y: 12, scale: 0.98 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        style={{ transformOrigin: 'bottom right' }}
      >
        {m.image ? <ImageThumb src={m.image} id={m.id} /> : null}
        {m.text ? <p className="max-w-[80%] rounded-2xl rounded-br-md bg-surface-2 px-4 py-2 text-[15px] whitespace-pre-wrap text-fg">{m.text}</p> : null}
      </motion.div>
    );
  }
  return m.ai && !m.ai.fallback ? <AiMessage key={m.id} msg={m} /> : <BotMessage key={m.id} msg={m} />;
}

/** Lista de mensagens da conversa (carregada sob demanda junto com os dados do jogo). */
export default function Messages({ messages }: { messages: Message[] }) {
  // Agrupa em turnos (pergunta + resposta).
  const turns: Message[][] = [];
  for (const m of messages) {
    if (m.role === 'user' || !turns.length) turns.push([m]);
    else turns[turns.length - 1].push(m);
  }
  return (
    <div className="mx-auto grid w-full max-w-[760px] gap-8 px-4 pt-4 pb-10">
      {turns.map((t, i) => (
        <div
          key={t[0].id}
          className="grid content-start gap-8"
          // O último turno ocupa pelo menos a altura da tela: a pergunta sobe até o topo
          // e a resposta aparece logo abaixo dela, sem o histórico antigo no meio.
          style={i === turns.length - 1 ? { minHeight: `calc(var(--chat-h, 100vh) - ${CHROME}px)` } : undefined}
        >
          {t.map(renderMessage)}
        </div>
      ))}
    </div>
  );
}
