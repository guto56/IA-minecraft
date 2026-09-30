# CraftBot

> Fonte: brief do dono do projeto (prompt inicial). Itens marcados *(inferido)* saíram do brief, sem entrevista.

## Produto
Assistente estilo chat (ChatGPT/Claude) especializado em **Minecraft Java Edition 26.3** ("Wilderness Bound", 15/09/2026). Uso pessoal, sem login.

## Usuário e contexto
- Jogador de Minecraft Java que pergunta em pt-BR (com gíria, erro de digitação, sem acento, às vezes em inglês) enquanto joga ou planeja: receitas, farms, onde achar minérios, drops, poções, encantamentos, trocas e novidades.
- Uso típico: segunda tela ao lado do jogo, desktop ou celular *(inferido)*.

## Diferencial
- **Sem IA/LLM.** Motor de regras + busca fuzzy sobre dados extraídos dos arquivos oficiais do jogo.
- Nunca inventa: se não entende, diz que não entendeu e sugere perguntas.
- Toda resposta cita a fonte (`Java 26.3 · fonte: arquivos do jogo` ou a URL da curadoria).

## Restrições
- Respostas curtas (≤ ~6 linhas + card visual).
- Funciona offline (PWA); tudo é local.
- Texturas são da Mojang: uso pessoal. Se virar público, revisar as Usage Guidelines e não usar "Minecraft" no nome.
- Acessibilidade: contraste AA, foco visível, alt nos ícones, navegação por teclado.

## Plataforma
web (SPA estática, Cloudflare Pages).

## Stack
Vite + React + TypeScript, Tailwind v4, Motion, Fuse.js, Zustand, html-to-image, Vitest, Playwright (definido no brief).
