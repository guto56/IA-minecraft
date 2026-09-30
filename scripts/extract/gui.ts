import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import type { Jar } from './util.ts';

/** Copia sprites da interface do jogo usados nos cards (setas, chama, bolhas). */
export function extractGui(jar: Jar, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const sprites: Record<string, string> = {
    'flame.png': 'assets/minecraft/textures/gui/sprites/container/furnace/lit_progress.png',
    'arrow-progress.png': 'assets/minecraft/textures/gui/sprites/container/furnace/burn_progress.png',
    'brew-progress.png': 'assets/minecraft/textures/gui/sprites/container/brewing_stand/brew_progress.png',
    'bubbles.png': 'assets/minecraft/textures/gui/sprites/container/brewing_stand/bubbles.png',
    'blaze-fuel.png': 'assets/minecraft/textures/gui/sprites/container/brewing_stand/fuel_length.png',
  };
  for (const [name, src] of Object.entries(sprites)) fs.writeFileSync(path.join(outDir, name), jar.buffer(src));

  // Seta vazia da bancada: recorte da textura do contêiner.
  const crop = (src: string, x: number, y: number, w: number, h: number, name: string) => {
    const png = PNG.sync.read(jar.buffer(src));
    const scale = png.width / 256;
    const out = new PNG({ width: w * scale, height: h * scale });
    PNG.bitblt(png, out, x * scale, y * scale, w * scale, h * scale, 0, 0);
    // O fundo cinza do contêiner (#C6C6C6) vira transparente: sobra só o desenho.
    for (let i = 0; i < out.data.length; i += 4) {
      if (out.data[i] === 0xc6 && out.data[i + 1] === 0xc6 && out.data[i + 2] === 0xc6) out.data[i + 3] = 0;
    }
    fs.writeFileSync(path.join(outDir, name), PNG.sync.write(out));
  };
  crop('assets/minecraft/textures/gui/container/crafting_table.png', 89, 34, 24, 17, 'arrow.png');
  crop('assets/minecraft/textures/gui/container/furnace.png', 56, 36, 14, 14, 'flame-empty.png');
}

/** Ícones do app (favicon e PWA) a partir do ícone isométrico da bancada. */
export function writeAppIcons(atlasFile: string, index: number, columns: number, outDir: string) {
  const atlas = PNG.sync.read(fs.readFileSync(atlasFile));
  const S = 64;
  const icon = new PNG({ width: S, height: S });
  PNG.bitblt(atlas, icon, (index % columns) * S, Math.floor(index / columns) * S, S, S, 0, 0);
  fs.writeFileSync(path.join(outDir, 'favicon.png'), PNG.sync.write(icon));
  for (const size of [192, 512]) {
    const out = new PNG({ width: size, height: size });
    // Fundo Deepslate, ícone ampliado sem suavizar e com margem para o recorte "maskable".
    for (let i = 0; i < out.data.length; i += 4) out.data.set([0x14, 0x15, 0x17, 0xff], i);
    const scale = Math.floor((size * 0.62) / S);
    const off = Math.floor((size - S * scale) / 2);
    for (let y = 0; y < S * scale; y++)
      for (let x = 0; x < S * scale; x++) {
        const si = (Math.floor(y / scale) * S + Math.floor(x / scale)) * 4;
        const a = icon.data[si + 3] / 255;
        if (!a) continue;
        const di = ((off + y) * size + off + x) * 4;
        for (let c = 0; c < 3; c++) out.data[di + c] = Math.round(icon.data[si + c] * a + out.data[di + c] * (1 - a));
      }
    fs.writeFileSync(path.join(outDir, `app-${size}.png`), PNG.sync.write(out));
  }
}
