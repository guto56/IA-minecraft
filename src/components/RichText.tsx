import { Fragment } from 'react';

/** Renderiza **negrito** (único markdown usado nas respostas). Pode cortar em N palavras (streaming). */
export function RichText({ text, words }: { text: string; words?: number }) {
  let shown = text;
  if (words !== undefined) {
    const parts = text.split(/(\s+)/);
    let count = 0;
    let out = '';
    for (const p of parts) {
      if (/\S/.test(p)) {
        if (count >= words) break;
        count++;
      }
      out += p;
    }
    shown = out;
    // Fecha um negrito aberto no meio do streaming.
    if ((shown.match(/\*\*/g)?.length ?? 0) % 2 === 1) shown += '**';
  }
  const pieces = shown.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {pieces.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') && p.length > 4 ? (
          <strong key={i} className="font-semibold text-fg">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export const wordCount = (lines: string[]) => lines.reduce((s, l) => s + l.split(/\s+/).filter(Boolean).length, 0);
