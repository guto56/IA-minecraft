// Monta uma folha de contato com ícones do atlas (uso em desenvolvimento).
import fs from 'node:fs';
import { PNG } from 'pngjs';

const icons = JSON.parse(fs.readFileSync('src/data/icons.json', 'utf8'));
const atlas = PNG.sync.read(fs.readFileSync('public/icons/atlas-64.png'));
const ids = process.argv[3].split(',');
const S = 64;
const cols = 8;
const rows = Math.ceil(ids.length / cols);
const out = new PNG({ width: cols * S, height: rows * S });
for (let i = 0; i < out.data.length; i += 4) out.data.set([139, 139, 139, 255], i);
ids.forEach((id, k) => {
  const idx = icons.index[id];
  if (idx === undefined) return;
  const sx = (idx % icons.columns) * S;
  const sy = Math.floor(idx / icons.columns) * S;
  const ox = (k % cols) * S;
  const oy = Math.floor(k / cols) * S;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const si = ((sy + y) * atlas.width + sx + x) * 4;
      const a = atlas.data[si + 3] / 255;
      const di = ((oy + y) * out.width + ox + x) * 4;
      for (let c = 0; c < 3; c++) out.data[di + c] = atlas.data[si + c] * a + out.data[di + c] * (1 - a);
    }
});
fs.writeFileSync(process.argv[2], PNG.sync.write(out));
