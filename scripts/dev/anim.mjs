// Captura a sequência de animação de uma resposta (uso em desenvolvimento).
import { chromium } from '@playwright/test';
const [, , out = '/tmp/a', q = 'Como faz um pistão?', theme = 'dark'] = process.argv;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
await page.addInitScript((t) => localStorage.setItem('craftbot-theme', t), theme);
await page.goto('http://localhost:4173/');
await page.fill('#composer', q);
await page.keyboard.press('Enter');
for (const ms of [120, 450, 800, 1100, 1500, 2600]) {
  await page.waitForTimeout(ms === 120 ? 120 : ms - [120, 450, 800, 1100, 1500, 2600][[120, 450, 800, 1100, 1500, 2600].indexOf(ms) - 1]);
  await page.screenshot({ path: `${out}-${ms}.png` });
}
await browser.close();
