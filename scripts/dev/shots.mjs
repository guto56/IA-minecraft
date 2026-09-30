// Captura o último card de cada pergunta (uso em desenvolvimento).
import { chromium } from '@playwright/test';

const [, , out = '/tmp/q', width = '1100', ...qs] = process.argv;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 }, reducedMotion: 'reduce' });
await page.goto('http://localhost:4173/');
for (const [i, q] of qs.entries()) {
  await page.fill('#composer', q);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const art = page.locator('article').last();
  await art.screenshot({ path: `${out}-${i}.png` });
}
await browser.close();
