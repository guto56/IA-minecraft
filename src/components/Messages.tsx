import type { Message } from '../store/chat';
import { BotMessage } from './BotMessage';
import '../lib/kb';

/** Lista de mensagens da conversa (carregada sob demanda junto com os dados do jogo). */
export default function Messages({ messages }: { messages: Message[] }) {
  return (
    <div className="mx-auto grid w-full max-w-[760px] gap-8 px-4 pt-4 pb-10">
      {messages.map((m) =>
        m.role === 'user' ? (
          <div key={m.id} data-user-message className="flex scroll-mt-4 justify-end">
            <p className="max-w-[80%] rounded-2xl rounded-br-md bg-surface-2 px-4 py-2 text-[15px] whitespace-pre-wrap text-fg">{m.text}</p>
          </div>
        ) : (
          <BotMessage key={m.id} msg={m} />
        ),
      )}
    </div>
  );
}
