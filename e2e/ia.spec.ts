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

test('sem a resposta nos dados do jogo, a IA pesquisa na wiki e mostra a fonte', async ({ page }) => {
  const call = (name: string, args: object) => sse([{ model: 'teste/ia', choices: [{ delta: { tool_calls: [{ index: 0, id: name, function: { name, arguments: JSON.stringify(args) } }] } }] }]);
  let web = 0;
  await page.route('**/api/web', (route) => {
    web++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[]}' });
  });
  await page.route('**/api/wiki?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pages: [{ title: 'Tutorial:Lava farming', url: 'https://minecraft.wiki/w/Tutorial%3ALava_farming', text: 'Pointed dripstone under a lava source fills a cauldron.' }] }),
    }),
  );
  await page.route('**/api/chat', (route) => {
    const { messages } = route.request().postDataJSON() as { messages: { role: string; tool_call_id?: string }[] };
    const last = messages[messages.length - 1];
    if (last.role === 'user') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: call('consultar_jogo', { pergunta: 'farm de lava' }) });
    if (last.tool_call_id === 'consultar_jogo') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: call('pesquisar_wiki', { busca: 'lava farm' }) });
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: words('Segundo a Minecraft Wiki, a farm usa **Espeleotema Pontiagudo** e **Caldeirão**.') });
  });
  await page.goto('/');
  await page.getByLabel('Pergunte sobre Minecraft Java 26.3').fill('como faz farm de lava?');
  await page.keyboard.press('Enter');
  const answer = page.locator('article').last();
  await expect(answer).toContainText('Segundo a Minecraft Wiki');
  await expect(answer.getByRole('region', { name: 'Pesquisado na Minecraft Wiki' })).toBeVisible();
  await expect(answer.getByRole('link', { name: /Tutorial:Lava farming/ })).toHaveAttribute('href', 'https://minecraft.wiki/w/Tutorial%3ALava_farming');
  await expect(answer).toContainText('Pesquisado em minecraft.wiki · fora dos arquivos do jogo');
  // A web (paga) não é chamada quando a wiki já respondeu.
  expect(web).toBe(0);
});

test('vídeos aparecem como cards compactos (vários) e o player só abre ao clicar', async ({ page }) => {
  const call = (name: string, args: object) => sse([{ model: 'teste/ia', choices: [{ delta: { tool_calls: [{ index: 0, id: name, function: { name, arguments: JSON.stringify(args) } }] } }] }]);
  await page.route('**/api/wiki?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"pages":[]}' }));
  await page.route('**/api/web', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          { title: 'LAVA FARM Tutorial', url: 'https://www.youtube.com/watch?v=dAxFI1u1kkc', content: 'Join me as I build a lava farm with dripstone.' },
          { title: 'Easy Lava Farm', url: 'https://www.youtube.com/shorts/jT45KGUVkDo', content: 'Automatic lava farm.' },
          { title: 'Lava farming', url: 'https://minecraft.wiki/w/Tutorial:Lava_farming', content: 'Pointed dripstone.' },
        ],
      }),
    }),
  );
  await page.route('**/api/chat', (route) => {
    const { messages } = route.request().postDataJSON() as { messages: { role: string; tool_call_id?: string }[] };
    const last = messages[messages.length - 1];
    if (last.role === 'user') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: call('consultar_jogo', { pergunta: 'farm de lava' }) });
    if (last.tool_call_id === 'consultar_jogo') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: call('pesquisar_wiki', { busca: 'lava farm' }) });
    if (last.tool_call_id === 'pesquisar_wiki') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: call('pesquisar_web', { busca: 'lava farm video' }) });
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: words('Pesquisei na web: achei **2 vídeos** de farm de lava.') });
  });
  await page.goto('/');
  await page.getByLabel('Pergunte sobre Minecraft Java 26.3').fill('vídeo de farm de lava');
  await page.keyboard.press('Enter');
  const answer = page.locator('article').last();
  await expect(answer).toContainText('achei 2 vídeos');
  const play = answer.getByRole('button', { name: /^Assistir:/ });
  await expect(play).toHaveCount(2);
  await expect(answer).toContainText('Join me as I build a lava farm');
  // Capa pequena, não a tela toda.
  expect((await play.first().boundingBox())!.width).toBeLessThan(160);
  await expect(answer.locator('iframe')).toHaveCount(0);
  // O link da wiki continua na lista; o vídeo não se repete nela.
  await expect(answer.getByRole('link', { name: /Lava farming/ })).toBeVisible();
  await play.nth(1).click();
  await expect(answer.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/jT45KGUVkDo/);
});
