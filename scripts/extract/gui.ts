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
