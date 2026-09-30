---
name: CraftBot
description: Chat de Minecraft Java sóbrio, com detalhes do inventário do jogo.
colors:
  deepslate-bg: "#141517"
  deepslate-surface: "#1c1d21"
  deepslate-surface-2: "#25272c"
  deepslate-border: "#2f3238"
  bone-text: "#e8e6e1"
  ash-muted: "#9a9890"
  emerald: "#3fbf6b"
  xp-green: "#7cd13b"
  gold: "#e8b93a"
  redstone: "#d8433a"
  redstone-ink: "#f06a60"
  diamond: "#5ed3d1"
  calcite-bg: "#f4f2ee"
  calcite-surface: "#ffffff"
  calcite-surface-2: "#ebe8e2"
  calcite-border: "#dcd8cf"
  calcite-text: "#1c1d21"
  calcite-muted: "#5f5d56"
  calcite-emerald: "#1d7a41"
  inventory-panel: "#c6c6c6"
  inventory-slot: "#8b8b8b"
  slot-bevel-dark: "#373737"
  slot-bevel-light: "#ffffff"
  tooltip-bg: "#100010"
  tooltip-border: "#28006b"
  tooltip-inner: "#5000c8"
  tooltip-sub: "#a8a8a8"
  panel-bevel-shadow: "#555555"
  panel-outline: "#000000"
  pixel-shadow: "#3f3f3f"
  xp-highlight: "#b7ff5c"
  xp-shade: "#4f8f1d"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Pixelify Sans, Geist, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    fontFeature: "tnum"
  slot-count:
    fontFamily: "Pixelify Sans, Geist, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  empty-title-mobile:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
  logo:
    fontFamily: "Pixelify Sans, Geist, sans-serif"
    fontSize: "20px"
    fontWeight: 600
  pixel-operator:
    fontFamily: "Pixelify Sans, Geist, sans-serif"
    fontSize: "18px"
  input-search:
    fontSize: "16px"
  body-sm:
    fontSize: "14px"
  label-strong:
    fontSize: "13.5px"
  meta:
    fontSize: "12.5px"
  caption:
    fontSize: "12px"
  micro:
    fontSize: "11.5px"
  kbd:
    fontSize: "11px"
  chart-axis:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "10px"
  stat-y:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "56px"
    fontWeight: 500
    letterSpacing: "-0.03em"
  stat-y-mobile:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "44px"
  stat-unit:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "28px"
rounded:
  slot: "0px"
  panel: "3px"
  focus: "6px"
  chip: "8px"
  scrollbar: "10px"
  control: "12px"
  card: "14px"
  composer: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "32px"
components:
  card:
    backgroundColor: "{colors.deepslate-surface}"
    rounded: "{rounded.card}"
    padding: "16px"
  chip:
    backgroundColor: "{colors.deepslate-surface-2}"
    textColor: "{colors.bone-text}"
    rounded: "{rounded.chip}"
    padding: "6px 10px"
  button-send:
    backgroundColor: "{colors.emerald}"
    rounded: "{rounded.control}"
    size: "36px"
  composer:
    backgroundColor: "{colors.deepslate-surface-2}"
    rounded: "{rounded.composer}"
    padding: "8px 8px 8px 16px"
  inventory-slot:
    backgroundColor: "{colors.inventory-slot}"
    rounded: "{rounded.slot}"
    size: "36px"
  inventory-result-slot:
    backgroundColor: "{colors.inventory-slot}"
    rounded: "{rounded.slot}"
    size: "52px"
---

# Design System: CraftBot

## Overview

**Creative North Star: "A bancada ao lado do chat"**

Uma interface de chat moderna e silenciosa, no molde dos assistentes de texto, onde o Minecraft aparece só nos objetos que o jogador reconhece de olhos fechados: a grade cinza do inventário, o slot chanfrado, a quantidade pixelada no canto do slot, o tooltip roxo, a barra de XP. O resto (tipografia, espaçamento, cores de fundo) é sóbrio e fica fora do caminho.

A densidade é de ferramenta: respostas curtas (até ~6 linhas) e um card visual por resposta. O modo escuro "Deepslate" é o padrão, pensado para uma segunda tela ao lado do jogo. O claro "Calcita" usa os mesmos acentos, um pouco mais escuros para passar no contraste AA.

**Key Characteristics:**
- Chat sóbrio + artefatos fiéis do inventário do jogo.
- Um acento principal (esmeralda); ouro, redstone, diamante e XP com papéis fixos.
- Ícones sempre pixelados (`image-rendering: pixelated`), extraídos do jar oficial.
- Pixelify Sans só no logo, nos títulos curtos de card e na quantidade dos slots.

## Colors

Neutros quentes de ardósia com um acento esmeralda e quatro cores de minério, cada uma com um só papel.

### Primary
- **Esmeralda** (#3fbf6b; claro #1d7a41): ação principal (enviar), foco, links, Y ideal, número dos passos.

### Secondary
- **Ouro** (#e8b93a; claro #8a650c): dificuldade das farms, drops que Saque/Fortuna aumentam, faixa de minério só em alguns biomas.
- **Diamante** (#5ed3d1; claro #1a7775): informação neutra, faixa de minério em todos os biomas, Toque Suave e tesoura.
- **Redstone** (#d8433a; texto #f06a60 no escuro): erro, "hostil", "maldição", erros comuns.
- **XP** (#7cd13b): só a barra de progresso segmentada.

### Neutral
- **Deepslate** (#141517 / #1c1d21 / #25272c / #2f3238): fundo, sidebar e cards, input e hover, bordas de 1px.
- **Osso** (#e8e6e1): texto. **Cinza-cinza** (#9a9890): secundário (≥5,1:1 nas superfícies).
- **Inventário** (#c6c6c6 painel, #8b8b8b slot, chanfro #373737/#ffffff): fixo nos dois temas, igual ao jogo.

### Named Rules
**A regra do minério com função.** Ouro, diamante e redstone nunca decoram: cada um marca um estado específico (bônus de encantamento, informação, erro).

## Typography

**Body Font:** Geist (400/500/600), self-hosted.
**Label/Mono Font:** Geist Mono para números, IDs, coordenadas, quantidades e chances (`tabular-nums`).
**Accent Font:** Pixelify Sans, só logo, título de card e quantidade no slot (com sombra 1px #3f3f3f).

### Hierarchy
- **Display** (600, 34px, -0.02em): só o "O que vamos craftar?" do estado vazio.
- **Title** (Pixelify 600, 17px): título dos cards.
- **Body** (400, 15px/1.6, máx. 68ch): texto das respostas, com **negrito** nos termos-chave.
- **Label** (500, 13px; 13.5px em listas de card): rótulos, "Como cheguei nisso", cabeçalhos de seção dos cards.
- **Escala de apoio** (fixa, não fluida): 14px listas e sidebar, 12.5px metadados, 12px legendas e fonte, 11.5/11px teclas e dicas, 10px eixo do gráfico de altura.
- **Data** (Geist Mono, 12.5–15px; Y ideal em 56px): números.

## Layout

Sidebar fixa de 260px (recolhível) + coluna de chat centralizada de até 760px, com o composer fixo embaixo. No estado vazio, título, composer grande e 6 exemplos centralizados em até 680px. Em até 640px a sidebar vira drawer com fundo escurecido e os slots caem de 36px para 30px. Ritmo de 4/8/16/32px; mensagens separadas por 32px.

## Elevation & Depth

Plano por padrão: profundidade por camadas de tom (bg → surface → surface-2) e bordas de 1px. Sombra só no que flutua (sugestões do autocomplete, busca Ctrl+K, drawer) e no painel do inventário.

### Shadow Vocabulary
- **Flutuante** (`0 1px 2px rgb(0 0 0/.4), 0 8px 24px -12px rgb(0 0 0/.6)`): popovers e diálogo.
- **Painel do inventário** (`0 0 0 2px #000` + chanfro de borda): só na grade do jogo.

## Shapes

Cards com 14px de raio, controles com 12px, composer com 16px, chips com 8px. Slots, tooltip, barra de XP e os pixels pulsando são retos (0px), como no jogo. A diferença entre raio (chat) e canto reto (jogo) separa as duas camadas.

## Components

- **Slot:** 36px (52px no resultado) com chanfro; hover com brilho branco a 20%; clicável quando abre a receita do item; slots de tag alternam o item a cada 1s; o tooltip roxo mostra o nome e a tag.
- **RecipeCard:** grade 3×3, fornalha (chama + combustível), fogueira, cortador de pedras, ferraria; abas por receita; materiais com o toggle "Materiais brutos"; copiar/baixar PNG em 2x.
- **Chip:** exemplos, "Você quis dizer", sugestões; sobe 1px no hover (150ms ease-out).
- **Composer:** textarea que cresce, autocomplete com ícone e setas, Enter envia, Shift+Enter quebra linha; vira botão Parar durante a animação.
- **Resposta:** entendendo (3 pixels) → identificado (chip) → buscando (barra de XP) → montando (slots com spring, stagger 40ms) → texto em streaming (25ms/palavra). Tudo pula direto com `prefers-reduced-motion`.

## Do's and Don'ts

- **Do** use ícones do atlas extraído do jar, sempre pixelados.
- **Do** termine toda resposta com a linha de fonte em cinza.
- **Don't** use fonte pixelada em texto corrido, fundo de grama, gradiente roxo genérico ou emoji no lugar de ícone.
- **Don't** invente números: o que não vem do jar vem da curadoria com `fonte`.
