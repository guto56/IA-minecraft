import { expect, test } from '@playwright/test';

test('navegação por teclado: "/" foca o campo e Enter envia', async ({ page, isMobile }) => {
  test.skip(isMobile, 'teclado físico');
  await page.goto('/');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('/');
  await expect(page.getByLabel('Pergunte sobre Minecraft Java 26.3')).toBeFocused();
  await page.keyboard.type('como faz bancada');
  await page.keyboard.press('Enter');
  await expect(page.locator('article').last()).toContainText('Bancada de Trabalho');
});

test('ícones têm texto alternativo e botões têm nome', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Pergunte sobre Minecraft Java 26.3').fill('como faz pistao');
  await page.keyboard.press('Enter');
  await expect(page.locator('article').last()).toContainText('Pistão');
  const unnamed = await page.$$eval('button', (els) => els.filter((b) => !(b.getAttribute('aria-label') || b.textContent?.trim())).length);
  expect(unnamed).toBe(0);
  const imgs = await page.$$eval('[role="img"]', (els) => els.filter((e) => !e.getAttribute('aria-label')).length);
  expect(imgs).toBe(0);
});
