import { toBlob, toPng } from 'html-to-image';

const opts = (node: HTMLElement) => ({
  pixelRatio: 2,
  cacheBust: false,
  backgroundColor: getComputedStyle(document.body).backgroundColor,
  // Os ícones do atlas saem pixelados também na imagem.
  style: { imageRendering: 'pixelated' } as Partial<CSSStyleDeclaration>,
  filter: (el: Node) => !(el instanceof HTMLElement && el.dataset.exportIgnore === 'true'),
  width: node.offsetWidth,
  height: node.offsetHeight,
});

async function withFontFallback<T>(fn: (skipFonts: boolean) => Promise<T>): Promise<T> {
  try {
    return await fn(false);
  } catch {
    // CSS de fontes de outro domínio pode bloquear o embed: exporta com as fontes já carregadas.
    return fn(true);
  }
}

export async function downloadPng(node: HTMLElement, filename: string) {
  const url = await withFontFallback((skipFonts) => toPng(node, { ...opts(node), skipFonts }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.png`;
  a.click();
}

/** Copia o card como imagem. Retorna false se o navegador não suportar. */
export async function copyPng(node: HTMLElement): Promise<boolean> {
  if (!('ClipboardItem' in window) || !navigator.clipboard?.write) return false;
  const blob = await withFontFallback((skipFonts) => toBlob(node, { ...opts(node), skipFonts }));
  if (!blob) return false;
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  return true;
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
