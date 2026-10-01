/**
 * Imagem enviada pelo usuário: reduzida e convertida para JPEG no navegador antes de ir para a IA
 * e para o histórico (menos dados, menos custo, cabe no localStorage).
 */
export const IMAGE_MAX_SIDE = 1024;
const QUALITY = 0.82;
const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const ACCEPTED = /^image\/(png|jpe?g|webp|gif|bmp|avif)$/i;

export class ImageError extends Error {}

export async function prepareImage(file: File | Blob): Promise<string> {
  if (!ACCEPTED.test(file.type)) throw new ImageError('Formato não suportado. Use PNG, JPG ou WebP.');
  if (file.size > MAX_INPUT_BYTES) throw new ImageError('Imagem grande demais (máximo 20 MB).');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError('Não consegui abrir essa imagem.');
  }
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // Fundo escuro para PNG transparente (ícones e prints recortados) não virarem preto puro.
  ctx.fillStyle = '#1b1c1f';
  ctx.fillRect(0, 0, w, h);
  // Pixel art ampliada continua nítida.
  ctx.imageSmoothingEnabled = scale < 1;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', QUALITY);
}

/** Primeira imagem de uma lista de arquivos (input, colar ou arrastar). */
export function firstImage(files: FileList | DataTransferItemList | null | undefined): File | null {
  if (!files) return null;
  for (const f of Array.from(files as ArrayLike<File | DataTransferItem>)) {
    const file = 'getAsFile' in f ? (f.kind === 'file' ? f.getAsFile() : null) : f;
    if (file && file.type.startsWith('image/')) return file;
  }
  return null;
}
