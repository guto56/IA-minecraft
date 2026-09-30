// Captura telas do app para inspeção visual (uso em desenvolvimento).
import { chromium } from '@playwright/test';
const [, , out = '/tmp/shot', ...qs] = process.argv;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await page.goto('http://localhost:4173/');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}-${name}-empty.png` });
  for (const [i, q] of qs.entries()) {
    await page.fill('#composer', q);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}-${name}-${i}.png`, fullPage: false });
  }
  await page.close();
}
await browser.close();
