/**
 * Ferramentas que a IA chama. Rodam no navegador, sobre os dados extraídos do jar e a curadoria.
 * Devolvem um JSON enxuto para a IA (só fatos dos dados) e as respostas do motor para os cards.
 */
import { ask } from '../engine';
import type { Answer } from '../engine';
import { potionLabel, levelName, stationLabel } from '../engine/answers';
import { professionLabel } from '../engine/entities';
import { itemName } from '../lib/kb';
import { directMaterials, materialLabel as materialName, rawMaterials } from '../lib/materials';
import { searchEntities } from '../lib/search';
import { KIND_LABEL as KIND_LABEL_PT } from '../lib/useSearch';
import type { Recipe } from '../data/types';

const plain = (s: string) => s.replace(/\*\*/g, '');
const pct = (c: number) => `${Math.round(c * 1000) / 10}%`;
const qty = (a: number, b: number) => (a === b ? `${a}` : `${a}-${b}`);

function recipeFacts(r: Recipe, quantity: number) {
  const direct = directMaterials(r, quantity);
  const base: Record<string, unknown> = {
    estacao: stationLabel(r.station),
    resultado: `${r.result.count}x ${itemName(r.result.id)}`,
  };
  if (r.station === 'crafting' || r.station === 'smithing') {
    base.materiais_por_craft = directMaterials(r, r.result.count).lines.map((l) => `${l.qty}x ${materialName(l.key)}`);
    if (quantity > 1) {
      base.para_quantidade = quantity;
      base.crafts = direct.crafts;
      base.materiais_total = direct.lines.map((l) => `${l.qty}x ${materialName(l.key)}`);
    }
    if (r.station === 'crafting') base.materiais_brutos = rawMaterials(r, quantity).map((l) => `${l.qty}x ${materialName(l.key)}`);
    if (r.kind === 'shapeless') base.formato = 'sem forma (qualquer posição)';
  } else {
    base.entrada = r.ingredients.map((i) => i.items.slice(0, 3).map(itemName).join(' ou '));
    if (r.xp) base.xp = r.xp;
    if (r.time) base.tempo_segundos = r.time / 20;
  }
  return base;
}

/** Resumo factual de uma resposta do motor (o que a IA pode usar). */
export function factsOf(a: Answer): Record<string, unknown> {
  const texto = a.text.map(plain);
  switch (a.type) {
    case 'recipe':
      return { tipo: 'receita', item: itemName(a.item), receitas: a.recipes.map((r) => recipeFacts(r, a.quantity)), texto };
    case 'smelt':
      return { tipo: 'fornalha', receitas: a.recipes.map((r) => recipeFacts(r, 1)), texto };
    case 'location':
      return {
        tipo: 'onde_achar',
        nome: a.title,
        ...(a.ore
          ? {
              y_ideal: a.ore.yIdeal,
              y_extra: a.ore.yExtra,
              dimensao: a.ore.dimension,
              faixas: a.ore.ranges.map((r) => ({ de: r.min, ate: r.max, distribuicao: r.kind === 'trapezoid' ? 'pico no meio' : 'uniforme', so_alguns_biomas: r.biomes[0] !== '*' })),
              dica: a.ore.dica,
            }
          : {}),
        biomas: a.biomes?.slice(0, 30),
        texto,
      };
    case 'drops':
      return {
        tipo: 'drops',
        de: a.title,
        drops: a.drops.map((d) => ({
          item: d.anyOf ? `${itemName(d.item)} (sorteia 1 de ${d.anyOf})` : itemName(d.item),
          quantidade: qty(d.min, d.max),
          chance: pct(d.chance),
          ...(d.looting ? { saque_aumenta: true } : {}),
          ...(d.fortune ? { fortuna_aumenta: true } : {}),
          ...(d.silkTouch ? { so_com_toque_suave: true } : {}),
          ...(d.shears ? { so_com_tesoura: true } : {}),
          ...(d.playerKill ? { so_se_o_jogador_matar: true } : {}),
          ...(d.special ? { condicao: d.special } : {}),
        })),
        texto,
      };
    case 'dropped_by':
      return {
        tipo: 'quem_dropa',
        item: itemName(a.item),
        fontes: a.sources.map((s) => ({ de: s.label, quantidade: qty(s.drop.min, s.drop.max), chance: pct(s.drop.chance), ...(s.drop.special ? { condicao: s.drop.special } : {}) })),
        texto,
      };
    case 'farm': {
      const f = a.farm;
      return {
        tipo: 'farm',
        nome: f.nome,
        dificuldade: `${f.dificuldade}/5`,
        rende: f.rende.texto,
        materiais: f.materiais.map((m) => `${m.qtd}x ${itemName(m.item)}`),
        requisitos: f.requisitos,
        passos: f.passos,
        erros_comuns: f.erros_comuns,
        video: `${f.video_titulo} (${f.video})`,
        fontes: f.fonte,
      };
    }
    case 'info':
      return { tipo: 'informacao', titulo: a.title, dados: a.stats, texto, ...(a.badge ? { marca: a.badge } : {}), fonte: a.source };
    case 'potion':
      return {
        tipo: 'pocao',
        pocao: potionLabel(a.potion),
        etapas: a.steps.map((s) => `${potionLabel(s.input)} + ${itemName(s.reagent)} = ${potionLabel(s.output)}`),
        variantes: a.variants.map((v) => `${v.label}: + ${itemName(v.reagent)}`),
        texto,
      };
    case 'trades':
      return {
        tipo: 'trocas',
        de: a.title,
        trocas: a.rows.slice(0, 40).map((r) => ({
          aldeao: professionLabel(r.profession),
          nivel: levelName(r.level),
          voce_da: [`${qty(r.trade.wants.min, r.trade.wants.max)}x ${itemName(r.trade.wants.item)}`, r.trade.wants2 ? `${qty(r.trade.wants2.min, r.trade.wants2.max)}x ${itemName(r.trade.wants2.item)}` : null].filter(Boolean),
          recebe: `${qty(r.trade.gives.min, r.trade.gives.max)}x ${itemName(r.trade.gives.item)}`,
          obs: r.trade.notes.filter((n) => !n.startsWith('potion:')),
        })),
        texto,
      };
    case 'uses':
      return { tipo: 'usos', item: itemName(a.item), total: a.total, usado_em: a.recipes.map((r) => itemName(r.result.id)), texto };
    case 'list':
      return { tipo: 'lista', titulo: a.title, opcoes: a.entries.map((e) => e.label), texto };
    case 'clarify':
      return { tipo: 'ambiguo', opcoes: a.options.map((o) => o.label), texto: 'Há mais de um item com esse nome. Pergunte ao usuário qual ou consulte uma das opções.' };
    case 'not_understood':
      return { tipo: 'nao_encontrado', sugestoes: a.suggestions };
  }
}

export interface ToolRun {
  name: string;
  args: Record<string, unknown>;
  /** Texto curto para a interface ("receita · Pistão"). */
  label: string;
  /** Respostas do motor para virar cards. */
  answers: Answer[];
  /** JSON devolvido para a IA. */
  output: string;
}

export function runTool(name: string, rawArgs: string): ToolRun {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(rawArgs || '{}');
  } catch {
    return { name, args, label: name, answers: [], output: JSON.stringify({ erro: 'argumentos inválidos' }) };
  }
  if (name === 'consultar_jogo') {
    const pergunta = String(args.pergunta ?? '').slice(0, 300);
    // Sem contexto: a IA já manda a pergunta completa.
    const r = ask(pergunta);
    const t = r.traces[0];
    const label = t?.entity ? `${t.intentLabel} · ${t.entity.label}` : pergunta;
    return { name, args, label, answers: r.answers, output: JSON.stringify({ pergunta, resultados: r.answers.map(factsOf) }) };
  }
  if (name === 'buscar_nomes') {
    const texto = String(args.texto ?? '').slice(0, 100);
    const found = searchEntities(texto, 10).map((e) => ({ nome: e.label, tipo: KIND_LABEL_PT[e.kind] ?? e.kind }));
    return { name, args, label: `buscar "${texto}"`, answers: [], output: JSON.stringify(found.length ? { encontrados: found } : { nao_encontrado: true }) };
  }
  return { name, args, label: name, answers: [], output: JSON.stringify({ erro: `ferramenta desconhecida: ${name}` }) };
}
