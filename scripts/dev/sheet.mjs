import fs from 'node:fs';
import { PNG } from 'pngjs';
const ids = process.argv[3].split(',');
const S = 64, cols = 8, rows = Math.ceil(ids.length / cols);
const out = new PNG({ width: cols * S, height: rows * S });
for (let i = 0; i < out.data.length; i += 4) { out.data[i] = 139; out.data[i+1] = 139; out.data[i+2] = 139; out.data[i+3] = 255; }
ids.forEach((id, k) => {
  const f = `public/icons/64/${id}.png`;
  if (!fs.existsSync(f)) return;
  const p = PNG.sync.read(fs.readFileSync(f));
  const ox = (k % cols) * S, oy = Math.floor(k / cols) * S;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const si = (y * S + x) * 4, a = p.data[si + 3] / 255, di = ((oy + y) * out.width + ox + x) * 4;
    for (let c = 0; c < 3; c++) out.data[di + c] = p.data[si + c] * a + out.data[di + c] * (1 - a);
  }
});
fs.writeFileSync(process.argv[2], PNG.sync.write(out));
