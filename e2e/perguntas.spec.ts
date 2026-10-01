import { expect, test } from '@playwright/test';

/** 20 perguntas reais: [pergunta, texto que precisa aparecer na resposta, título do card] */
const casos: [string, RegExp, RegExp | null][] = [
  ['Como faz um pistão?', /Pistão.*bancada de trabalho/, /Pistão/],
  ['como faz obsevador', /Observador/, /Observador/],
  ['quero 10 pistões', /Para 10/, /Pistão/],
  ['Farm de ferro', /Farm de ferro/, /Farm de ferro/],
  ['farm de cana', /cana/i, /Farm de cana/],
  ['Onde acho diamante?', /Y −59/, /Minério de Diamante/],
  ['qual y do ferro', /Minério de Ferro/, /Minério de Ferro/],
  ['O que o creeper dropa?', /Creeper.*Pólvora/, /Creeper/],
  ['quem dropa perola do ender', /Enderman/, /Pérola de Ender/],
  ['Poção de visão noturna', /Visão Noturna/, /Visão Noturna/],
  ['o que é o warden', /Defensor/, /Defensor/],
  ['encantamento remendo', /Remendo/, /Remendo/],
  ['trocas do bibliotecario', /Bibliotecário/, /Bibliotecário/],
  ['pra que serve redstone', /Pó de Redstone/, /Usos/],
  ['O que tem de novo na 26.3?', /Wilderness Bound/, /Wilderness Bound/],
  ['ferro bruto na fornalha', /Lingote de Ferro/, /Lingote de Ferro/],
  ['onde fica a cidade ancestral', /Cidade ancestral/, /Cidade ancestral/],
  ['como faz cama de palha', /Cama de Palha/, /Cama de Palha/],
  ['qual a capital da França', /Não entendi/, null],
  ['picareta', /Você quis dizer/, null],
];

for (const [q, text, card] of casos) {
  test(`responde: ${q}`, async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Pergunte sobre Minecraft Java 26.3').fill(q);
    await page.keyboard.press('Enter');
    const answer = page.locator('article').last();
    await expect(answer).toContainText(text, { timeout: 10_000 });
    if (card) await expect(answer.locator('section h3').first()).toContainText(card);
    await expect(answer).toContainText('Java 26.3');
  });
}

test('estado vazio mostra os 6 exemplos e o clique pergunta', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'O que vamos craftar?' })).toBeVisible();
  const chips = page.getByRole('list', { name: 'Exemplos de perguntas' }).getByRole('button');
  await expect(chips).toHaveCount(6);
  await chips.first().click();
  await expect(page.locator('article').last()).toContainText('Pistão');
});

test('clicar num ingrediente abre a receita dele', async ({ page, isMobile }) => {
  test.skip(isMobile, 'hover/tooltip é de desktop');
  await page.goto('/');
  await page.getByLabel('Pergunte sobre Minecraft Java 26.3').fill('como faz pistao');
  await page.keyboard.press('Enter');
  await page.locator('article').last().getByRole('button', { name: /Lingote de Ferro/ }).first().click();
  await expect(page.locator('article').last()).toContainText('Lingote de Ferro');
});

test('contexto: "e a de ferro?" depois da picareta de diamante', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel('Pergunte sobre Minecraft Java 26.3');
  await input.fill('como faz picareta de diamante');
  await page.keyboard.press('Enter');
  await expect(page.locator('article').last()).toContainText('Picareta de Diamante');
  await input.fill('e a de ferro?');
  await page.keyboard.press('Enter');
  await expect(page.locator('article').last()).toContainText('Picareta de Ferro');
});

test('link compartilhado ?q= abre já respondido', async ({ page }) => {
  await page.goto('/?q=' + encodeURIComponent('O que o creeper dropa?'));
  await expect(page.locator('article').last()).toContainText('Pólvora');
});

test('Ctrl+K abre a busca de itens', async ({ page, isMobile }) => {
  test.skip(isMobile, 'atalho de teclado');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'O que vamos craftar?' })).toBeVisible();
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Buscar item' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Buscar').fill('observador');
  await expect(dialog.getByRole('option').first()).toContainText('Observador');
  await page.keyboard.press('Enter');
  await expect(page.locator('article').last()).toContainText('Observador');
});

test('histórico fica salvo depois de recarregar', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Pergunte sobre Minecraft Java 26.3').fill('como faz tocha');
  await page.keyboard.press('Enter');
  await expect(page.locator('article').last()).toContainText('Tocha');
  await page.reload();
  await expect(page.locator('article').last()).toContainText('Tocha');
});

test.describe('com animação', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('mostra as etapas e o botão Parar pula para o resultado', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Pergunte sobre Minecraft Java 26.3').fill('como faz pistao');
    await page.keyboard.press('Enter');
    await expect(page.locator('[role="status"]').first()).toBeAttached({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Parar' }).click();
    const answer = page.locator('article').last();
    await expect(answer).toContainText('Slots que alternam aceitam qualquer item daquele tipo.');
    await expect(answer.getByRole('button', { name: 'Como cheguei nisso' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible();
  });

  test('a rolagem acompanha a resposta, para ao subir e volta pela setinha', async ({ page, isMobile }) => {
    test.skip(isMobile, 'roda do mouse');
    await page.setViewportSize({ width: 1100, height: 600 });
    await page.goto('/');
    const input = page.getByLabel('Pergunte sobre Minecraft Java 26.3');
    const gap = () => page.evaluate(() => {
      const s = document.querySelector('main .overflow-y-auto')!;
      return s.scrollHeight - s.clientHeight - s.scrollTop;
    });
    for (const q of ['farm de ferro', 'trocas do bibliotecario']) {
      await input.fill(q);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible({ timeout: 10_000 });
    }
    await expect.poll(gap).toBeLessThan(4);
    await page.mouse.move(550, 250);
    await page.mouse.wheel(0, -500);
    const toBottom = page.getByRole('button', { name: 'Ir para o fim da resposta' });
    await expect(toBottom).toBeVisible();
    await toBottom.click();
    await expect.poll(gap).toBeLessThan(4);
    await expect(toBottom).toBeHidden();
  });
});
