import { expect, test, type Route } from '@playwright/test';

/** Resposta SSE no formato da OpenRouter. */
const sse = (chunks: object[]) => chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n';
const toolCall = (pergunta: string) => sse([{ model: 'teste/ia', choices: [{ delta: { tool_calls: [{ index: 0, id: 't1', function: { name: 'consultar_jogo', arguments: JSON.stringify({ pergunta }) } }] } }] }]);
const words = (t: string) => sse(t.split(' ').map((w, i) => ({ choices: [{ delta: { content: (i ? ' ' : '') + w } }] })));

/**
 * IA simulada: lê o histórico que o app manda. Se a última mensagem é resultado de ferramenta, escreve
 * a resposta; senão pede a consulta (resolvendo "e de melancia?" pelo contexto, como a IA real faz).
 */
async function fakeAi(route: Route, seen: unknown[][]) {
  const { messages } = route.request().postDataJSON() as { messages: { role: string; content: string }[] };
  seen.push(messages);
  const last = messages[messages.length - 1];
  if (last.role === 'tool') {
    const r = JSON.parse(last.content).resultados[0];
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: words(`Aqui está a **${r.nome ?? r.item}**. Os detalhes estão no card.`) });
  }
  const users = messages.filter((m) => m.role === 'user').map((m) => m.content);
  const q = users[users.length - 1];
  const pergunta = /^e de (.+?)\??$/i.test(q) && users.length > 1 ? `farm de ${/^e de (.+?)\??$/i.exec(q)![1]}` : q;
  return route.fulfill({ status: 200, contentType: 'text/event-stream', body: toolCall(pergunta) });
}

test('IA consulta os dados, mostra o card e entende o contexto ("e de melancia?")', async ({ page }) => {
  const seen: unknown[][] = [];
  await page.route('**/api/chat', (route) => fakeAi(route, seen));
  await page.goto('/');
  const input = page.getByLabel('Pergunte sobre Minecraft Java 26.3');
  await input.fill('como faço uma farm de ferro?');
  await page.keyboard.press('Enter');
  const first = page.locator('article').last();
  await expect(first).toContainText('Aqui está a Farm de ferro');
  await expect(first.locator('section h3').first()).toContainText('Farm de ferro');
  await expect(first).toContainText('texto por IA a partir desses dados');

  await input.fill('e de melancia?');
  await page.keyboard.press('Enter');
  const second = page.locator('article').last();
  await expect(second).toContainText(/melancia/i);
  await expect(second.locator('section h3').first()).toContainText(/melancia/i);
  // O histórico da conversa foi junto para a IA.
  const lastReq = seen[seen.length - 2] as { role: string; content: string }[];
  expect(lastReq.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  expect(lastReq[0].content).toBe('como faço uma farm de ferro?');

  await second.getByRole('button', { name: 'Como cheguei nisso' }).click();
  await expect(second).toContainText('“farm de melancia”');
});

test('sem IA disponível o app responde com o motor local e avisa', async ({ page }) => {
  await page.route('**/api/chat', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'IA não configurada no servidor (OPENROUTER_API_KEY).' }) }));
  await page.goto('/');
  await page.getByLabel('Pergunte sobre Minecraft Java 26.3').fill('como faz pistao');
  await page.keyboard.press('Enter');
  const answer = page.locator('article').last();
  await expect(answer).toContainText('IA indisponível agora');
  await expect(answer).toContainText('Pistão se faz na bancada de trabalho');
});

test('mostra que está pensando e o botão Parar interrompe a IA', async ({ page }) => {
  // IA lenta: a resposta demora para chegar.
  await page.route('**/api/chat', async (route) => {
    await new Promise((r) => setTimeout(r, 4000));
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: words('resposta atrasada') }).catch(() => {});
  });
  await page.goto('/');
  await page.getByLabel('Pergunte sobre Minecraft Java 26.3').fill('como faz pistao');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Entendendo a pergunta…')).toBeVisible();
  await page.getByRole('button', { name: 'Parar' }).click();
  await expect(page.locator('article').last()).toContainText('Resposta interrompida.');
  await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible();
});
