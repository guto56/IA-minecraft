import { RichText } from './RichText';

/** Markdown mínimo das respostas da IA: parágrafos, listas "- " / "1. " e **negrito**. */
export function Markdown({ text }: { text: string }) {
  const blocks: { kind: 'p' | 'ul' | 'ol'; lines: string[] }[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) {
      blocks.push({ kind: 'p', lines: [] });
      continue;
    }
    const ul = /^[-*•]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    const kind = ul ? 'ul' : ol ? 'ol' : 'p';
    const content = ul?.[1] ?? ol?.[1] ?? line.replace(/^#+\s*/, '');
    const last = blocks[blocks.length - 1];
    if (last && last.kind === kind && kind !== 'p') last.lines.push(content);
    else blocks.push({ kind, lines: [content] });
  }
  return (
    <div className="grid gap-2 text-[15px] leading-[1.6] text-fg/90">
      {blocks
        .filter((b) => b.lines.length)
        .map((b, i) =>
          b.kind === 'p' ? (
            <p key={i} className="max-w-[68ch]">
              {b.lines.map((l, j) => (
                <span key={j}>
                  {j ? ' ' : ''}
                  <RichText text={l} />
                </span>
              ))}
            </p>
          ) : (
            <ul key={i} className={`grid max-w-[68ch] gap-1 pl-5 ${b.kind === 'ol' ? 'list-decimal marker:font-mono marker:text-[13px] marker:text-emerald' : 'list-disc marker:text-emerald'}`}>
              {b.lines.map((l, j) => (
                <li key={j} className="pl-1">
                  <RichText text={l} />
                </li>
              ))}
            </ul>
          ),
        )}
    </div>
  );
}
