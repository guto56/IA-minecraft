# CraftBot

Assistente estilo chat para **Minecraft Java Edition 26.3** ("Wilderness Bound"). Pergunte em português (com gíria, sem acento ou em inglês) e receba receitas, farms, alturas de minério, drops, poções, encantamentos, trocas de aldeões e novidades.

**Não tem IA.** O entendimento é um motor de regras + busca fuzzy sobre dados extraídos dos arquivos oficiais do jogo. Quando não entende, ele diz que não entendeu e sugere perguntas. Nunca inventa resposta.

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
| `npm test` | Vitest: 20+ receitas conhecidas e 145 perguntas do motor + 20 fora do assunto |
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
src/components/        chat, composer, sidebar, cards
e2e/                   testes Playwright
```

## De onde vêm os dados

- **Arquivos do jogo** (client.jar/server.jar 26.3): receitas, alquimia, tags, drops, trocas, encantamentos, biomas, estruturas, faixas de altura dos minérios, nomes pt_br/en_us, ícones.
- **Curadoria** (`src/data/curated/`, com URL de fonte em cada entrada): farms (com vídeos de tutorial da 26.x), ficha dos mobs (vida/dano), duração das poções, Y ideal dos minérios, descrição dos encantamentos, dicas e novidades da 26.1/26.2/26.3.

## Aviso

As texturas são da Mojang e o projeto é para uso pessoal. Se um dia virar público ou comercial, revise as [Usage Guidelines da Mojang](https://www.minecraft.net/usage-guidelines) e não use "Minecraft" no nome do produto.
