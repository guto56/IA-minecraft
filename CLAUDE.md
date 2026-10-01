# CraftBot — regras do projeto

Assistente estilo chat para **Minecraft Java Edition 26.3** ("Wilderness Bound"). Uso pessoal, sem login.

## Regras centrais
- **IA presa aos dados reais.** A IA (OpenRouter, via `api/chat.ts`) só responde com o que as ferramentas devolvem (`src/ai/tools.ts` → motor `src/engine/` → `src/data/`). Nunca usa conhecimento próprio para fatos do jogo.
- Se os dados não têm a resposta: a IA diz que não sabe. **Nunca inventa.** Sem IA disponível, o motor local responde ("não entendi" + 3 sugestões quando não entende).
- A chave da OpenRouter fica só no servidor (`OPENROUTER_API_KEY` na Vercel / `.env.local`). Nunca no código ou no git.
- **Fonte da verdade são os arquivos do jogo.** Nunca escrever receita/drop/número de cabeça.
  - Dados do jar: `npm run extract` gera `src/data/*.json` e `public/icons/atlas-*.png`.
  - Curadoria (o que não está no jar): `src/data/curated/*.json`, cada entrada com `fonte` (URL).
- Versão alvo definida só em `craftbot.config.json`.
- Respostas curtas: até ~6 linhas + card. Termina com `Java 26.3 · fonte: arquivos do jogo` (ou URL da curadoria).
- Sem placeholders, sem TODO, sem "resto do código aqui".

## Stack
Vite + React + TS · Tailwind v4 (tokens em CSS vars) · Motion · Fuse.js · Zustand (localStorage) · html-to-image · Vitest · Playwright. Deploy: Cloudflare Pages (estático).

## Estrutura
- `scripts/extract/` — download (manifesto Mojang → client/server.jar, pt_br), data generator (Java 25), extração e render de ícones isométricos.
- `scripts/validate.ts` — IDs, ícones, traduções e fontes da curadoria.
- `src/data/` — JSON gerado (não editar à mão) + `curated/`.
- `src/engine/` — normalização, intenções, entidades, ambiguidade, contexto. Testes em `src/engine/__tests__/`.
- `src/components/` — layout, chat, cards (Recipe/Farm/Location/Drop/Info/Clarify/NotUnderstood).

## Design
Chat sóbrio (tipo Claude) com detalhes de Minecraft. Tema escuro "Deepslate" padrão, claro "Calcita".
Fontes: Geist (UI), Geist Mono (números/IDs), Pixelify Sans (só logo, quantidade no slot, títulos curtos).
Grade fiel ao inventário: fundo `#C6C6C6`, slot `#8B8B8B`, chanfro `#373737`/`#FFFFFF`. Ícones sempre `image-rendering: pixelated`.
Respeitar `prefers-reduced-motion`.

## Comandos
`npm run extract` · `npm run validate` · `npm test` · `npm run build` · `npm run test:e2e`
