import { describe, expect, it } from 'vitest';
import { ask, type Context } from '../index';

/** [pergunta, intenção esperada, entidade esperada "tipo:id"] */
type Caso = [string, string, string];

const casos: Caso[] = [
  // receita (com e sem acento, gíria, erro de digitação, inglês)
  ['Como faz um pistão?', 'receita', 'item:piston'],
  ['como faz pistao', 'receita', 'item:piston'],
  ['como fazer um pistão grudento', 'receita', 'item:sticky_piston'],
  ['receita de tocha', 'receita', 'item:torch'],
  ['como craftar bancada', 'receita', 'item:crafting_table'],
  ['como faço uma fornalha', 'receita', 'item:furnace'],
  ['craft de observador', 'receita', 'item:observer'],
  ['como faz obsevador', 'receita', 'item:observer'],
  ['como faz funil', 'receita', 'item:hopper'],
  ['como faz cama', 'receita', 'item:white_bed'],
  ['como faz olho do ender', 'receita', 'item:ender_eye'],
  ['receita do olho de ender', 'receita', 'item:ender_eye'],
  ['how to craft a piston', 'receita', 'item:piston'],
  ['how to make ender eye', 'receita', 'item:ender_eye'],
  ['como faz mesa de encantamento', 'receita', 'item:enchanting_table'],
  ['como fazer bigorna', 'receita', 'item:anvil'],
  ['como faz etiqueta de nome', 'receita', 'item:name_tag'],
  ['como craftar name tag', 'receita', 'item:name_tag'],
  ['como faz escada de concreto branco', 'receita', 'item:white_concrete_stairs'],
  ['como faz picareta de diamante', 'receita', 'item:diamond_pickaxe'],
  ['como faz pica de dima', 'receita', 'item:diamond_pickaxe'],
  ['como faz espada de netherite', 'receita', 'item:netherite_sword'],
  ['receita de bau', 'receita', 'item:chest'],
  ['como faz um baú', 'receita', 'item:chest'],
  ['como faço graveto', 'receita', 'item:stick'],
  ['como faz tabuas', 'receita', 'item:oak_planks'],
  ['como faz um isqueiro', 'receita', 'item:flint_and_steel'],
  ['como faz repetidor', 'receita', 'item:repeater'],
  ['como faz comparador', 'receita', 'item:comparator'],
  ['como faz tnt', 'receita', 'item:tnt'],
  ['como faço trilho elétrico', 'receita', 'item:powered_rail'],
  ['como faz carrinho de mina', 'receita', 'item:minecart'],
  ['como faz um sinalizador', 'receita', 'item:beacon'],
  ['como faz o dente de leão dourado', 'receita', 'item:golden_dandelion'],
  ['como faz cama de palha', 'receita', 'item:straw_bed'],
  ['como faz almofada branca', 'receita', 'item:white_cushion'],
  ['como faz lanterna', 'receita', 'item:lantern'],
  ['como faz andaime', 'receita', 'item:scaffolding'],
  ['como fazer escudo', 'receita', 'item:shield'],
  ['como faz um arco', 'receita', 'item:bow'],
  ['como faz livro', 'receita', 'item:book'],
  ['como faz estante', 'receita', 'item:bookshelf'],
  ['como faz balde', 'receita', 'item:bucket'],
  ['como faz o dispensador', 'receita', 'item:dispenser'],
  ['pistão', 'receita', 'item:piston'],
  ['quero 10 pistões', 'receita', 'item:piston'],
  ['materiais pra fazer um farol', 'receita', 'item:beacon'],
  ['como faço maçã dourada', 'receita', 'item:golden_apple'],
  ['como faço bolo', 'receita', 'item:cake'],
  ['como faz fogueira', 'receita', 'item:campfire'],
  // fornalha
  ['ferro bruto na fornalha', 'fundir', 'item:raw_iron'],
  ['como derreter areia', 'fundir', 'item:sand'],
  ['assar carne', 'fundir', 'item:beef'],
  ['como fazer vidro na fornalha', 'fundir', 'item:glass'],
  ['cozinhar batata', 'fundir', 'item:potato'],
  // onde achar
  ['Onde acho diamante?', 'onde_achar', 'item:diamond'],
  ['onde acho dima', 'onde_achar', 'item:diamond'],
  ['qual y do diamante', 'onde_achar', 'item:diamond'],
  ['melhor altura pra minerar ferro', 'onde_achar', 'item:iron_ingot'],
  ['onde encontro esmeralda', 'onde_achar', 'item:emerald'],
  ['em que camada fica o ouro', 'onde_achar', 'item:gold_ingot'],
  ['onde acho detritos ancestrais', 'onde_achar', 'item:ancient_debris'],
  ['onde fica netherita', 'onde_achar', 'item:netherite_ingot'],
  ['qual altura do redstone', 'onde_achar', 'item:redstone'],
  ['onde acho lapis', 'onde_achar', 'item:lapis_lazuli'],
  ['onde encontro carvao', 'onde_achar', 'item:coal'],
  ['onde fica a cidade ancestral', 'onde_achar', 'structure:ancient_city'],
  ['onde acho acampamento abandonado', 'onde_achar', 'structure:abandoned_camp'],
  ['onde fica a fortaleza do nether', 'onde_achar', 'structure:fortress'],
  ['onde nasce o blaze', 'onde_achar', 'mob:blaze'],
  ['where to find diamonds', 'onde_achar', 'item:diamond'],
  // farm
  ['Farm de ferro', 'farm', 'farm:ferro'],
  ['iron farm', 'farm', 'farm:ferro'],
  ['como faz farm de ferro', 'farm', 'farm:ferro'],
  ['farm de cana', 'farm', 'farm:cana'],
  ['farm de cana de açucar automatica', 'farm', 'farm:cana'],
  ['como fazer uma farm de bambu', 'farm', 'farm:bambu'],
  ['farm de cacto', 'farm', 'farm:cacto'],
  ['farm de abobora', 'farm', 'farm:abobora-melancia'],
  ['farm de melancia', 'farm', 'farm:abobora-melancia'],
  ['breeder de aldeao', 'farm', 'farm:breeder'],
  ['como faz villager breeder', 'farm', 'farm:breeder'],
  ['farm de xp', 'farm', 'farm:mob-xp'],
  ['farm de mob', 'farm', 'farm:mob-xp'],
  ['farm de vaca', 'farm', 'farm:vaca'],
  ['farm de galinha', 'farm', 'farm:galinha'],
  ['chicken cooker', 'farm', 'farm:galinha'],
  ['farm de creeper', 'farm', 'farm:creeper'],
  ['farm de polvora', 'farm', 'farm:creeper'],
  ['trading hall', 'farm', 'farm:trading-hall'],
  ['farm de ouro', 'farm', 'farm:ouro'],
  ['gold farm', 'farm', 'farm:ouro'],
  ['farm de blaze', 'farm', 'farm:blaze'],
  ['farm de cenoura com aldeao', 'farm', 'farm:comida-aldeao'],
  // drop
  ['O que o creeper dropa?', 'drop', 'mob:creeper'],
  ['o que o enderman dropa', 'drop', 'mob:enderman'],
  ['o que o zumbi solta', 'drop', 'mob:zombie'],
  ['drops do blaze', 'drop', 'mob:blaze'],
  ['o que a vaca dropa', 'drop', 'mob:cow'],
  ['o que o esqueleto wither dropa', 'drop', 'mob:wither_skeleton'],
  ['quem dropa polvora', 'drop', 'item:gunpowder'],
  ['o que dropa perola do ender', 'drop', 'item:ender_pearl'],
  ['o que o minerio de diamante dropa', 'drop', 'item:diamond_ore'],
  ['what does creeper drop', 'drop', 'mob:creeper'],
  // mob info
  ['o que é o warden', 'mob_info', 'mob:warden'],
  ['como matar o creeper', 'mob_info', 'mob:creeper'],
  ['quanto de vida tem o blaze', 'mob_info', 'mob:blaze'],
  ['como derrotar o dragão', 'mob_info', 'mob:ender_dragon'],
  ['o que é o cubo de enxofre', 'mob_info', 'mob:sulfur_cube'],
  ['phantom', 'mob_info', 'mob:phantom'],
  // encantamento
  ['o que faz o encantamento remendo', 'encantamento', 'enchantment:mending'],
  ['mending', 'encantamento', 'enchantment:mending'],
  ['encantamento fortuna', 'encantamento', 'enchantment:fortune'],
  ['o que faz afiação', 'encantamento', 'enchantment:sharpness'],
  ['toque suave', 'encantamento', 'enchantment:silk_touch'],
  ['encantamento inquebravel nivel maximo', 'encantamento', 'enchantment:unbreaking'],
  // poção
  ['Poção de visão noturna', 'pocao', 'potion:night_vision'],
  ['pocao de visao noturna', 'pocao', 'potion:night_vision'],
  ['como faz pocao de força', 'pocao', 'potion:strength'],
  ['poção de resistencia ao fogo', 'pocao', 'potion:fire_resistance'],
  ['como fazer pocao de cura', 'pocao', 'potion:healing'],
  ['pocao de invisibilidade', 'pocao', 'potion:invisibility'],
  ['potion of swiftness', 'pocao', 'potion:swiftness'],
  ['pocao de fraqueza', 'pocao', 'potion:weakness'],
  // trocas
  ['qual aldeão vende livro encantado', 'troca_aldeao', 'item:enchanted_book'],
  ['trocas do bibliotecario', 'troca_aldeao', 'profession:librarian'],
  ['quem compra cenoura', 'troca_aldeao', 'item:carrot'],
  ['o que o fazendeiro vende', 'troca_aldeao', 'profession:farmer'],
  ['qual profissão vende sino', 'troca_aldeao', 'item:bell'],
  // dica
  ['dicas para iniciante', 'dica', 'tip:primeiro-dia'],
  ['o que fazer primeiro', 'dica', 'tip:primeiro-dia'],
  ['como começar', 'dica', 'tip:primeiro-dia'],
  ['dica sobre piglin', 'dica', 'tip:piglin-ouro'],
  ['como achar o end', 'dica', 'tip:achar-end'],
  ['como curar aldeao zumbi', 'dica', 'tip:curar-zumbi'],
  // novidades
  ['O que tem de novo na 26.3?', 'novidade', 'novidade:26.3'],
  ['o que mudou na 26.2', 'novidade', 'novidade:26.2'],
  ['novidades da 26.1', 'novidade', 'novidade:26.1'],
  ['o que tem de novo', 'novidade', ''],
  ['wilderness bound', 'novidade', 'novidade:26.3'],
  // usos
  ['pra que serve redstone', 'usos', 'item:redstone'],
  ['pra que serve lapis lazuli', 'usos', 'item:lapis_lazuli'],
  ['onde uso ametista', 'usos', 'item:amethyst_shard'],
  ['para que serve o slime', 'usos', 'item:slime_ball'],
  ['o que posso fazer com couro', 'usos', 'item:leather'],
];

/** Perguntas fora do assunto: devem cair em "não entendi". */
const foraDoAssunto = [
  'qual a capital da França',
  'me conta uma piada',
  'quem ganhou a copa de 2022',
  'qual a previsão do tempo amanhã',
  'como fazer bolo de chocolate de verdade com ovos e farinha na minha cozinha',
  'quanto é 2 mais 2',
  'escreve um poema pra mim',
  'qual o sentido da vida',
  'me recomenda um filme',
  'bom dia tudo bem com voce',
  'traduz hello para portugues',
  'qual o melhor celular',
  'como declarar imposto de renda',
  'quem é o presidente do brasil',
  'asdfgh qwerty',
  'como programar em python',
  'receita de lasanha',
  'qual time vai ganhar o brasileirao',
  'fala sobre a segunda guerra mundial',
  'xyz 123 blablabla',
];

function run(q: string, ctx: Context = {}) {
  return ask(q, ctx);
}

describe('motor: intenção + entidade', () => {
  let ok = 0;
  const falhas: string[] = [];
  for (const [q, intent, entity] of casos) {
    const r = run(q);
    const t = r.traces[0];
    const gotEntity = t.entity ? `${t.entity.kind}:${t.entity.id}` : '';
    const pass = t.intent === intent && gotEntity === entity && r.answers[0].type !== 'not_understood' && r.answers[0].type !== 'clarify';
    if (pass) ok++;
    else falhas.push(`${q} → ${t.intent}/${gotEntity} [${r.answers[0].type}] (esperado ${intent}/${entity})`);
  }
  it(`acerta pelo menos 95% de ${casos.length} perguntas`, () => {
    const rate = ok / casos.length;
    if (falhas.length) console.warn(`Falhas (${falhas.length}):\n` + falhas.join('\n'));
    expect(casos.length).toBeGreaterThanOrEqual(120);
    expect(rate).toBeGreaterThanOrEqual(0.95);
  });
});

describe('motor: fora do assunto', () => {
  for (const q of foraDoAssunto) {
    it(`"${q}" → não entendi`, () => {
      const r = run(q);
      expect(r.answers[0].type).toBe('not_understood');
      if (r.answers[0].type === 'not_understood') expect(r.answers[0].suggestions.length).toBe(3);
    });
  }
});

describe('motor: ambiguidade, contexto e perguntas compostas', () => {
  it('"picareta" pede esclarecimento com chips', () => {
    const r = run('picareta');
    expect(r.answers[0].type).toBe('clarify');
    if (r.answers[0].type === 'clarify') expect(r.answers[0].options.length).toBeGreaterThanOrEqual(2);
  });
  it('"e a de ferro?" usa o contexto da última receita', () => {
    const first = run('como faz picareta de diamante');
    const r = run('e a de ferro?', first.context);
    expect(r.traces[0].intent).toBe('receita');
    expect(r.traces[0].entity?.id).toBe('iron_pickaxe');
  });
  it('"e o observador?" mantém a intenção anterior', () => {
    const first = run('como faz pistao');
    const r = run('e o observador?', first.context);
    expect(r.traces[0].intent).toBe('receita');
    expect(r.traces[0].entity?.id).toBe('observer');
  });
  it('"como faz pistão e observador" gera duas respostas', () => {
    const r = run('como faz pistão e observador');
    expect(r.answers.length).toBe(2);
    expect(r.traces.map((t) => t.entity?.id)).toEqual(['piston', 'observer']);
  });
  it('"livro e pena" não é dividido', () => {
    const r = run('como faz livro e pena');
    expect(r.answers.length).toBe(1);
    expect(r.traces[0].entity?.id).toBe('writable_book');
  });
  it('quantidade: "quero 10 pistões"', () => {
    const r = run('quero 10 pistões');
    const a = r.answers[0];
    expect(a.type).toBe('recipe');
    if (a.type === 'recipe') expect(a.quantity).toBe(10);
  });
});
