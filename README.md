# CraftBot

Assistente estilo chat para **Minecraft Java Edition 26.3** ("Wilderness Bound"). Pergunte em português (com gíria, sem acento ou em inglês) e receba receitas, farms, alturas de minério, drops, poções, encantamentos, trocas de aldeões e novidades.

**IA presa aos dados reais.** As respostas são escritas por uma IA (via OpenRouter) que só pode usar o que as ferramentas devolvem: os dados extraídos dos arquivos oficiais do jogo e a curadoria com fontes. Ela entende o contexto da conversa ("como faço uma farm de ferro?" → "e de melancia?"), e quando os dados não têm a resposta ela diz que não sabe. Sem internet ou sem IA configurada, o app responde com o motor de regras local (mesmos dados).

### Como a IA funciona

1. O navegador manda a conversa para `/api/chat` (função da Vercel em `api/chat.ts`), que adiciona a chave, o prompt do sistema e as ferramentas (`src/ai/prompt.ts`) e repassa para a OpenRouter em stream.
2. A IA chama as ferramentas `consultar_jogo` e `buscar_nomes`, que rodam no navegador sobre `src/data/` (`src/ai/tools.ts`, usando o motor de `src/engine/`).
3. O resultado das ferramentas vira card na tela e volta para a IA, que escreve a resposta curta (`src/ai/agent.ts`).

### Pesquisa fora dos dados (só quando precisa)

As fontes têm ordem fixa, garantida no código (`Turn` em `src/ai/tools.ts`) e não só no prompt:

| Ordem | Ferramenta | Fonte | Custo |
|---|---|---|---|
| 1 | `consultar_jogo` | arquivos do jogo + curadoria | grátis |
| 2 | `pesquisar_wiki` | minecraft.wiki (`/api/wiki`, API MediaWiki) | grátis |
| 3 | `pesquisar_web` | OpenRouter web search (Exa) em minecraft.wiki, minecraft.net, YouTube e Reddit (`/api/web`) | ~US$ 0,008 por busca |

- A wiki só roda depois de consultar os dados do jogo; a web só depois da wiki, e no máximo uma vez por pergunta.
- Perguntas respondidas pelos dados do jogo não chamam wiki nem web.
- Resultados ficam guardados no navegador por 7 dias (a mesma busca não é paga de novo).
- Respostas pesquisadas aparecem com o card "Pesquisado na Minecraft Wiki/na web", os links, o vídeo (quando houver) e o aviso "fora dos arquivos do jogo".
- Nomes de itens citados em inglês são trocados pelos nomes oficiais pt-BR do jar.

### Configurar a chave

- **Vercel:** em *Project → Settings → Environment Variables*, crie `OPENROUTER_API_KEY` (e, se quiser trocar o modelo, `OPENROUTER_MODEL`; padrão `deepseek/deepseek-v4.1-flash`, com `google/gemini-2.5-flash` como reserva; compare modelos com `npx tsx scripts/dev/eval-models.ts <modelo...>`).
- **Local:** crie `.env.local` com `OPENROUTER_API_KEY=...` (o arquivo é ignorado pelo git). `npm run dev` e `npm run preview` já servem o `/api/chat`.
- A chave nunca vai para o código do site: fica só no servidor.

## Segurança

**Site**
- Cabeçalhos em `vercel.json` (também aplicados no `vite preview`): CSP restrita (só scripts do próprio site, com hash para o script inline; frames só do YouTube sem cookies; nada de `eval`), HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP.
- Respostas da IA são texto puro (sem HTML, links clicáveis ou imagens); links para fora de minecraft.wiki/minecraft.net/YouTube/Reddit são removidos do texto e dos cards.

**APIs (`api/_lib/guard.ts`)**
- Só aceitam chamadas do próprio site (Origin / Sec-Fetch-Site).
- Limite por IP: IA 40/min e 400/h; wiki 40/min; web (paga) 8 a cada 10 min e 40/dia.
- A conversa recebida é reconstruída campo a campo: sem `system`, só as ferramentas da lista, tamanhos máximos por mensagem e no total. Modelo, prompt, ferramentas e `max_tokens` são definidos só no servidor.
- Erros não devolvem detalhes internos (ficam só no log).

**IA (injeção de prompt)**
- Prompt com regras de segurança: não muda de papel, não revela instruções, não aceita "resultado de ferramenta" escrito pelo usuário, não ensina hacks/exploits, não escreve links.
- Conteúdo da wiki/web é tratado como não confiável (`src/ai/untrusted.ts`): tira caracteres invisíveis, HTML, links de fora e frases típicas de injeção, e vai marcado como "conteúdo externo não confiável".
- Ordem das fontes e limite da web garantidos em código.
- `npx tsx scripts/dev/redteam.ts` roda 9 ataques (vazar prompt, persona, falso sistema, hacks, resultado forjado, histórico forjado, injeção indireta pela wiki e pela web).

## Como rodar

Requisitos: Node 22+.

```bash
npm install
npm run dev        # http://localhost:5173
```

Os dados já extraídos estão em `src/data/` e os ícones em `public/icons/`, então não precisa rodar a extração para usar.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run extract` | Baixa client.jar, server.jar e `pt_br.json` da versão configurada, roda o data generator e gera `src/data/*.json` + atlas de ícones |
| `npm run validate` | Confere se toda receita/drop/troca usa IDs que existem, se todo item tem ícone e nome pt_br, e se a curadoria tem fonte |
| `npm test` | Vitest: receitas conhecidas, 145 perguntas do motor + 20 fora do assunto, ferramentas e laço da IA (com IA simulada), proxy `/api/chat` |
| `npm run test:e2e` | Playwright: 20 perguntas no navegador (desktop e mobile), contexto, histórico, atalhos, acessibilidade |
| `npm run build` | Build estático em `dist/` (PWA, funciona offline) |

## Atualizar para uma versão nova do Minecraft

1. Troque `minecraftVersion` (e `dropName`/`releaseDate`) em **`craftbot.config.json`**. É o único lugar com a versão: UI, título e manifesto leem dele.
2. Rode `npm run extract`. O script:
   - acha a versão no manifesto oficial (`piston-meta.mojang.com`);
   - baixa `client.jar`, `server.jar` e `pt_br.json` (com checagem de SHA1) para `.cache/<versão>/`;
   - garante um Java compatível (usa `JAVA_HOME` ou `java`; no Linux baixa o Temurin se faltar) e roda `net.minecraft.data.Main --reports --server`;
   - extrai itens, receitas (bancada, fornalhas, cortador, ferraria, **alquimia**), tags, loot tables, trocas, encantamentos, biomas, estruturas e minérios;
   - renderiza os ícones (blocos em isométrico a partir dos modelos e texturas do jar).
3. Rode `npm run validate` e `npm test`.
4. Revise a curadoria em `src/data/curated/` (o que não está no jar): novidades da versão, vídeos das farms, durações de poções, descrições. Toda entrada precisa de `fonte`.

## Estrutura

```
craftbot.config.json   versão alvo (único lugar)
scripts/extract/       download, data generator, extração e ícones
scripts/validate.ts    validação dos dados e da curadoria
scripts/curate/        ferramenta de rascunho da curadoria (wiki → .cache)
src/data/              JSON gerado + curated/ (farms, mobs, poções, dicas…)
src/engine/            motor: normalização, sinônimos, intenções, entidades, respostas
src/ai/                prompt, ferramentas e laço da IA
api/                   funções da Vercel: /api/chat (IA), /api/wiki (Minecraft Wiki), /api/web (busca na web)
src/components/        chat, composer, sidebar, cards
e2e/                   testes Playwright
```

## De onde vêm os dados

- **Arquivos do jogo** (client.jar/server.jar 26.3): receitas, alquimia, tags, drops, trocas, encantamentos, biomas, estruturas, faixas de altura dos minérios, nomes pt_br/en_us, ícones.
- **Curadoria** (`src/data/curated/`, com URL de fonte em cada entrada): farms (com vídeos de tutorial da 26.x), ficha dos mobs (vida/dano), duração das poções, Y ideal dos minérios, descrição dos encantamentos, dicas e novidades da 26.1/26.2/26.3.

## Aviso

As texturas são da Mojang e o projeto é para uso pessoal. Se um dia virar público ou comercial, revise as [Usage Guidelines da Mojang](https://www.minecraft.net/usage-guidelines) e não use "Minecraft" no nome do produto.
