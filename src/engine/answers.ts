/** Monta as respostas (texto curto + dados do card) a partir da base de conhecimento. */
import type { Drop, Farm, Recipe, Trade } from '../data/types';
import {
  GAME_SOURCE,
  VERSION,
  biomes,
  brewingRecipes,
  curatedEnchantments,
  curatedMobs,
  curatedOres,
  curatedPotions,
  curatedStructures,
  enchantments,
  farmById,
  farms,
  farmsByProduct,
  itemName,
  items,
  loot,
  lootByItem,
  mobName,
  novidades,
  oreByItem,
  potions,
  professions,
  recipesByResult,
  recipesUsing,
  spawnBiomes,
  structures,
  tips,
  trades,
  tradesByItem,
  workstations,
} from '../lib/kb';
import type { Entity } from './entities';
import type { Intent } from './intents';

export interface ClarifyOption {
  label: string;
  query: string;
  icon?: string;
}

export interface BrewStep {
  input: string;
  inputItem: string;
  reagent: string;
  output: string;
  outputItem: string;
}

export interface OreLocation {
  ore: string;
  icon: string;
  yIdeal: number;
  yExtra: number[];
  ranges: { min: number; max: number; peak?: [number, number]; kind: 'trapezoid' | 'uniform'; biomes: string[] }[];
  dimension: string;
  dica: string;
}

export interface DropSource {
  kind: 'mob' | 'block' | 'gameplay' | 'chest';
  id: string;
  label: string;
  icon?: string;
  drop: Drop;
}

export type Answer =
  | { type: 'recipe'; item: string; recipes: Recipe[]; quantity: number; text: string[]; source: string }
  | { type: 'smelt'; item: string; recipes: Recipe[]; asInput: boolean; text: string[]; source: string }
  | { type: 'location'; title: string; icon?: string; ore?: OreLocation; biomes?: string[]; text: string[]; source: string }
  | { type: 'drops'; title: string; icon?: string; drops: Drop[]; text: string[]; source: string }
  | { type: 'dropped_by'; item: string; sources: DropSource[]; text: string[]; source: string }
  | { type: 'farm'; farm: Farm; text: string[]; source: string }
  | { type: 'info'; title: string; icon?: string; badge?: string; stats: { label: string; value: string }[]; items?: string[]; text: string[]; source: string }
  | { type: 'potion'; potion: string; steps: BrewStep[]; variants: { label: string; reagent: string; result: string }[]; text: string[]; source: string }
  | { type: 'trades'; title: string; icon?: string; rows: { profession: string; level: string; trade: Trade; sells: boolean }[]; text: string[]; source: string }
  | { type: 'uses'; item: string; recipes: Recipe[]; total: number; text: string[]; source: string }
  | { type: 'list'; title: string; entries: { label: string; query: string; icon?: string; hint?: string }[]; text: string[]; source: string }
  | { type: 'clarify'; text: string[]; options: ClarifyOption[]; source: string }
  | { type: 'not_understood'; text: string[]; suggestions: string[]; source: string };

const LEVEL_NAMES: Record<string, string> = { '1': 'Novato', '2': 'Aprendiz', '3': 'Profissional', '4': 'Especialista', '5': 'Mestre' };
export const levelName = (l: string) => LEVEL_NAMES[l] ?? l;

const STATION_LABEL: Record<string, string> = {
  crafting: 'bancada de trabalho',
  smelting: 'fornalha',
  blasting: 'alto-forno',
  smoking: 'defumador',
  campfire: 'fogueira',
  stonecutting: 'cortador de pedras',
  smithing: 'bancada de ferraria',
  brewing: 'suporte de poções',
};
export const stationLabel = (s: string) => STATION_LABEL[s] ?? s;
const FEMININE = new Set(['crafting', 'smelting', 'campfire', 'smithing']);
/** "da fornalha", "do alto-forno"... */
export const fromStation = (s: string) => `${FEMININE.has(s) ? 'da' : 'do'} ${b(stationLabel(s))}`;

const b = (s: string) => `**${s}**`;
const fmtY = (y: number) => (y < 0 ? `−${Math.abs(y)}` : `${y}`);

/* ------------------------------------------------------------------ */

export function recipeAnswer(item: string, quantity = 1): Answer {
  if (item === 'potion' || item === 'splash_potion' || item === 'lingering_potion') {
    const a = potionList();
    a.text = [
      item === 'splash_potion'
        ? `Para uma ${b('Poção Arremessável')}, coloque ${b('pólvora')} numa poção pronta no suporte de poções.`
        : item === 'lingering_potion'
          ? `Para uma ${b('Poção Persistente')}, coloque ${b('bafo do dragão')} numa poção arremessável.`
          : `Poções se fazem no ${b('suporte de poções')}, a partir de frascos de água.`,
      'Escolha a poção:',
    ];
    return a;
  }
  const list = (recipesByResult.get(item) ?? []).filter((r) => r.station !== 'brewing');
  if (!list.length) return howToGet(item);
  const crafting = list.filter((r) => r.station === 'crafting');
  const main = list[0];
  const text: string[] = [];
  const name = itemName(item);
  if (main.station === 'crafting') {
    text.push(`${b(name)} se faz na ${b('bancada de trabalho')}${main.result.count > 1 ? ` e rende ${b(String(main.result.count))}` : ''}.`);
  } else {
    text.push(`${b(name)} sai ${fromStation(main.station)}.`);
  }
  if (quantity > 1) {
    const crafts = Math.ceil(quantity / main.result.count);
    text.push(`Para ${b(String(quantity))}: ${b(String(crafts))} craft${crafts > 1 ? 's' : ''}. Os materiais estão no card.`);
  }
  if (main.ingredients.some((i) => i.tag && i.items.length > 1)) text.push('Slots que alternam aceitam qualquer item daquele tipo.');
  if (list.length > 1) text.push(`Tem ${b(String(list.length))} jeitos de conseguir${crafting.length !== list.length ? ' (incluindo outras estações)' : ''}.`);
  return { type: 'recipe', item, recipes: list.slice(0, 6), quantity, text, source: GAME_SOURCE };
}

/** Item sem receita: explica de onde vem (minério, drop, troca). */
function howToGet(item: string): Answer {
  const name = itemName(item);
  const ore = oreByItem.get(item);
  if (ore) {
    const a = locationForOre(item);
    a.text.unshift(`${b(name)} não tem receita: vem da mineração.`);
    return a;
  }
  const dropped = droppedBy(item);
  if (dropped.type === 'dropped_by' && dropped.sources.length) {
    dropped.text.unshift(`${b(name)} não tem receita de craft.`);
    return dropped;
  }
  const tr = tradesByItem.get(item)?.filter((t) => t.sells);
  if (tr?.length) {
    const a = tradesForItem(item);
    a.text.unshift(`${b(name)} não tem receita: dá para comprar de aldeões.`);
    return a;
  }
  return infoAnswer(item, [`${b(name)} não tem receita de craft nos arquivos do jogo.`]);
}

export function smeltAnswer(item: string): Answer {
  const cooking = ['smelting', 'blasting', 'smoking', 'campfire'];
  const asResult = (recipesByResult.get(item) ?? []).filter((r) => cooking.includes(r.station));
  const asInput = (recipesUsing.get(item) ?? []).filter((r) => cooking.includes(r.station));
  const name = itemName(item);
  if (asInput.length) {
    const r = asInput[0];
    const res = itemName(r.result.id);
    const text = [`${b(name)} na ${b(stationLabel(r.station))} vira ${b(res)}${r.xp ? ` e dá ${b(String(r.xp).replace('.', ','))} de XP` : ''}.`];
    const fast = asInput.find((x) => x.station === 'blasting' || x.station === 'smoking');
    if (fast) text.push(`No ${b(stationLabel(fast.station))} fica pronto na metade do tempo.`);
    return { type: 'smelt', item, recipes: dedupeStations(asInput), asInput: true, text, source: GAME_SOURCE };
  }
  if (asResult.length) {
    const r = asResult[0];
    const text = [`${b(name)} sai da ${b(stationLabel(r.station))} usando ${b(itemName(r.ingredients[0].items[0]))}${r.ingredients[0].items.length > 1 ? ' (ou similar)' : ''}.`];
    return { type: 'smelt', item, recipes: dedupeStations(asResult), asInput: false, text, source: GAME_SOURCE };
  }
  const rec = recipesByResult.get(item);
  if (rec?.length) {
    const a = recipeAnswer(item);
    a.text.unshift(`${b(name)} não vai na fornalha, mas tem receita:`);
    return a;
  }
  return infoAnswer(item, [`${b(name)} não tem uso na fornalha.`]);
}

function dedupeStations(list: Recipe[]): Recipe[] {
  const seen = new Set<string>();
  return list.filter((r) => {
    const k = `${r.station}:${r.ingredients[0].items.join()}:${r.result.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ------------------------------------------------------------------ */

const worldMinOf = (d: string) => (d === 'overworld' ? -64 : 0);
const worldMaxOf = (d: string) => (d === 'overworld' ? 320 : 127);
function dedupeRanges<T extends { min: number; max: number; kind: string; biomes: string[] }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((r) => {
    const k = `${r.min}:${r.max}:${r.kind}:${r.biomes.join()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function locationForOre(item: string): Extract<Answer, { type: 'location' }> {
  const ore = oreByItem.get(item)!;
  const cur = curatedOres[ore.id];
  const dimension = ore.placements[0].dimension;
  const loc: OreLocation = {
    ore: ore.id,
    icon: ore.id,
    yIdeal: cur?.y_ideal ?? ore.placements[0].peak?.[0] ?? Math.round((ore.placements[0].min + ore.placements[0].max) / 2),
    yExtra: cur?.y_extra ?? [],
    ranges: dedupeRanges(ore.placements.map((p) => ({ min: Math.max(p.min, worldMinOf(p.dimension)), max: Math.min(p.max, worldMaxOf(p.dimension)), peak: p.peak, kind: p.distribution, biomes: p.biomes }))),
    dimension,
    dica: cur?.dica ?? '',
  };
  const min = Math.min(...ore.placements.map((p) => p.min));
  const max = Math.max(...ore.placements.map((p) => p.max));
  const worldMin = dimension === 'overworld' ? -64 : 0;
  const worldMax = dimension === 'overworld' ? 320 : 127;
  const special = ore.placements.filter((p) => p.biomes[0] !== '*');
  const text = [
    `Melhor altura para ${b(itemName(ore.id))}: ${b(`Y ${fmtY(loc.yIdeal)}`)}${loc.yExtra.length ? ` (ou ${loc.yExtra.map((y) => `Y ${fmtY(y)}`).join(', ')})` : ''}.`,
    `Gera entre ${b(`Y ${fmtY(Math.max(min, worldMin))}`)} e ${b(`Y ${fmtY(Math.min(max, worldMax))}`)}${dimension === 'nether' ? ' no Nether' : ''}.`,
  ];
  if (special.length && special.every((p) => p.biomes.length <= 12)) {
    const names = [...new Set(special.flatMap((p) => p.biomes.map((x) => biomes[x]?.name ?? x)))];
    text.push(`Extra em: ${names.slice(0, 4).join(', ')}${names.length > 4 ? '…' : ''}.`);
  }
  if (cur?.dica) text.push(cur.dica);
  return { type: 'location', title: itemName(ore.id), icon: ore.id, ore: loc, text, source: cur ? `${GAME_SOURCE} + ${cur.fonte}` : GAME_SOURCE };
}

export function locationAnswer(entity: Entity, hint = ''): Answer {
  if (entity.kind === 'item') {
    if (/\bnether\b/.test(hint) && ['gold_ingot', 'gold_nugget', 'raw_gold', 'gold_ore'].includes(entity.id)) return locationForOre('nether_gold_ore');
    if (/\bnether\b/.test(hint) && entity.id === 'quartz') return locationForOre('nether_quartz_ore');
    if (oreByItem.has(entity.id)) return locationForOre(entity.id);
    return howToGetNoRecipe(entity.id);
  }
  if (entity.kind === 'structure') {
    const cs = curatedStructures.find((s) => s.familia === entity.id);
    const variants = Object.values(structures).filter((s) => s.family === entity.id);
    const bioIds = [...new Set(variants.flatMap((v) => v.biomes))];
    const names = bioIds.map((x) => biomes[x]?.name ?? x);
    const text = [`${b(cs?.nome ?? entity.label)} aparece em ${b(String(names.length))} bioma${names.length === 1 ? '' : 's'}.`];
    if (cs) text.push(cs.descricao);
    return { type: 'location', title: cs?.nome ?? entity.label, icon: cs?.item, biomes: names, text, source: cs ? `${GAME_SOURCE} + ${cs.fonte}` : GAME_SOURCE };
  }
  if (entity.kind === 'biome') {
    const bio = biomes[entity.id];
    const dim = bio.dimension === 'overworld' ? 'Overworld' : bio.dimension === 'nether' ? 'Nether' : 'End';
    const structs = [...new Set(bio.structures.map((s) => structures[s]?.family ?? s))];
    const text = [`${b(bio.name)} fica no ${b(dim)}.`];
    if (structs.length) text.push(`Estruturas: ${structs.map((s) => curatedStructures.find((c) => c.familia === s)?.nome ?? s).join(', ')}.`);
    const mobsHere = [...new Set(bio.spawns.filter((s) => s.category === 'monster' || s.category === 'creature').map((s) => mobName(s.mob)))];
    if (mobsHere.length) text.push(`Mobs: ${mobsHere.slice(0, 6).join(', ')}.`);
    return { type: 'location', title: bio.name, biomes: [bio.name], text, source: GAME_SOURCE };
  }
  if (entity.kind === 'mob') {
    const cm = curatedMobs[entity.id];
    const spawns = spawnBiomes.get(entity.id) ?? [];
    const names = [...new Set(spawns.map((s) => s.biome.name))];
    const text = [`${b(mobName(entity.id))}: ${cm?.onde ?? (names.length ? `nasce em ${names.length} biomas.` : 'não nasce naturalmente em biomas.')}`];
    return { type: 'location', title: mobName(entity.id), icon: entity.icon, biomes: names, text, source: cm ? `${GAME_SOURCE} + ${cm.fonte}` : GAME_SOURCE };
  }
  return notUnderstood([]);
}

function howToGetNoRecipe(item: string): Answer {
  const dropped = droppedBy(item);
  if (dropped.type === 'dropped_by' && dropped.sources.length) return dropped;
  if (recipesByResult.get(item)?.length) {
    const a = recipeAnswer(item);
    a.text.unshift(`${b(itemName(item))} não é minério: dá para fazer.`);
    return a;
  }
  if (tradesByItem.get(item)?.some((t) => t.sells)) return tradesForItem(item);
  return infoAnswer(item, [`Não achei onde ${b(itemName(item))} aparece naturalmente nos dados do jogo.`]);
}

/* ------------------------------------------------------------------ */

export function dropsAnswer(entity: Entity): Answer {
  if (entity.kind === 'mob') {
    const t = loot[`entities/${entity.id}`];
    const name = mobName(entity.id);
    if (!t || !t.drops.length) return { type: 'drops', title: name, icon: entity.icon, drops: [], text: [`${b(name)} não dropa itens ao morrer.`], source: GAME_SOURCE };
    const main = t.drops.filter((d) => !d.special);
    const text = [`${b(name)} dropa ${main.length ? main.slice(0, 3).map((d) => b(itemName(d.item))).join(', ') : 'itens só em condições especiais'}${main.length > 3 ? '…' : ''}.`];
    if (t.drops.some((d) => d.looting)) text.push(`${b('Saque (Looting)')} aumenta a quantidade.`);
    if (t.drops.some((d) => d.playerKill)) text.push('Alguns itens só caem se **você** matar.');
    return { type: 'drops', title: name, icon: entity.icon, drops: t.drops, text, source: GAME_SOURCE };
  }
  if (entity.kind === 'item') {
    const t = loot[`blocks/${entity.id}`];
    if (t && t.drops.length) {
      const name = itemName(entity.id);
      const normal = t.drops.filter((d) => !d.silkTouch && !d.shears);
      const text = [`Quebrar ${b(name)} dá ${normal.length ? normal.map((d) => b(itemName(d.item))).join(', ') : 'nada sem a ferramenta certa'}.`];
      if (t.drops.some((d) => d.fortune)) text.push(`${b('Fortuna')} aumenta o drop.`);
      if (t.drops.some((d) => d.silkTouch)) text.push(`Com ${b('Toque Suave')} cai o próprio bloco.`);
      return { type: 'drops', title: name, icon: entity.id, drops: t.drops, text, source: GAME_SOURCE };
    }
    return droppedBy(entity.id);
  }
  return notUnderstood([]);
}

/** Escambo com piglin: o que ele devolve em troca de ouro. */
export function barterAnswer(): Answer {
  const t = loot['gameplay/piglin_bartering'];
  const text = [`Jogue um ${b('lingote de ouro')} perto de um ${b('Piglin')}: ele devolve um item aleatório.`, `Os mais comuns: ${[...t.drops].sort((a, c) => c.chance - a.chance).slice(0, 3).map((d) => b(itemName(d.item))).join(', ')}.`, 'Use uma peça de ouro para ele não atacar.'];
  return { type: 'drops', title: 'Escambo com piglin', icon: 'gold_ingot', drops: t.drops, text, source: GAME_SOURCE };
}

/** Quem dropa um item (mobs, blocos, escambo, pesca). */
export function droppedBy(item: string): Answer {
  const list = lootByItem.get(item) ?? [];
  const sources: DropSource[] = [];
  for (const { table, drop } of list) {
    const [kind, ...rest] = table.id.split('/');
    const id = rest.join('/');
    if (kind === 'entities') sources.push({ kind: 'mob', id, label: mobName(id), icon: items[`${id}_spawn_egg`] ? `${id}_spawn_egg` : undefined, drop });
    else if (kind === 'blocks' && id !== item) sources.push({ kind: 'block', id, label: itemName(id), icon: items[id] ? id : undefined, drop });
    else if (kind === 'gameplay') sources.push({ kind: 'gameplay', id, label: gameplayLabel(id), icon: gameplayIcon(id), drop });
    else if (kind === 'chests') sources.push({ kind: 'chest', id, label: chestLabel(id), icon: 'chest', drop });
  }
  const mobsFirst = sources.sort((a, c) => order(a.kind) - order(c.kind) || c.drop.chance - a.drop.chance);
  const name = itemName(item);
  if (!mobsFirst.length) return infoAnswer(item, [`Nada dropa ${b(name)} nos dados do jogo.`]);
  const mobSources = mobsFirst.filter((s) => s.kind === 'mob');
  const text = [
    mobSources.length
      ? `${b(name)} cai de ${mobSources.slice(0, 3).map((s) => b(s.label)).join(', ')}${mobSources.length > 3 ? ` e mais ${mobSources.length - 3}` : ''}.`
      : `${b(name)} vem de ${mobsFirst.slice(0, 3).map((s) => b(s.label)).join(', ')}.`,
  ];
  const chests = mobsFirst.filter((s) => s.kind === 'chest').length;
  if (chests) text.push(`Também aparece em ${b(String(chests))} tipo${chests > 1 ? 's' : ''} de baú de estrutura.`);
  return { type: 'dropped_by', item, sources: mobsFirst.slice(0, 12), text, source: GAME_SOURCE };
}

const order = (k: DropSource['kind']) => ({ mob: 0, block: 1, gameplay: 2, chest: 3 })[k];
const gameplayLabel = (id: string) =>
  ({
    piglin_bartering: 'Escambo com piglin',
    fishing: 'Pesca',
    'fishing/fish': 'Pesca (peixe)',
    'fishing/treasure': 'Pesca (tesouro)',
    'fishing/junk': 'Pesca (lixo)',
    cat_morning_gift: 'Presente do gato',
    chicken_lay: 'Galinha botando ovo',
    armadillo_shed: 'Tatu (escama)',
    sniffer_digging: 'Farejador cavando',
    panda_sneeze: 'Espirro do panda',
    turtle_grow: 'Tartaruga crescendo',
  })[id] ?? id.replace(/[/_]/g, ' ');
const gameplayIcon = (id: string) => (id.startsWith('fishing') ? 'fishing_rod' : id.startsWith('piglin') ? 'gold_ingot' : undefined);
function chestLabel(id: string) {
  const fam = curatedStructures.find((s) => id.includes(s.familia) || id.replace('chests/', '').startsWith(s.familia.split('_')[0]));
  return `Baú: ${fam?.nome ?? id.replace(/^chests\//, '').replace(/[/_]/g, ' ')}`;
}

/* ------------------------------------------------------------------ */

export function farmAnswer(entity: Entity | null): Answer {
  let farm: Farm | undefined;
  if (entity?.kind === 'farm') farm = farmById(entity.id);
  else if (entity?.kind === 'item') farm = farmsByProduct.get(entity.id)?.[0];
  else if (entity?.kind === 'mob') {
    const byMob: Record<string, string> = { iron_golem: 'ferro', villager: 'breeder', cow: 'vaca', chicken: 'galinha', creeper: 'creeper', blaze: 'blaze', zombified_piglin: 'ouro', zombie: 'mob-xp', skeleton: 'mob-xp', spider: 'mob-xp' };
    farm = farmById(byMob[entity.id] ?? '');
  }
  if (!farm) {
    const text = entity ? [`Ainda não tenho uma farm de ${b(entity.label)} confirmada para a ${VERSION}.`, 'Estas eu tenho:'] : ['Escolha uma farm:'];
    return farmList(text);
  }
  const text = [
    `${b(farm.nome)} · dificuldade ${b(`${farm.dificuldade}/5`)}. Rende ${farm.rende.texto}.`,
    `Materiais, passo a passo e vídeo de tutorial da 26.x no card.`,
  ];
  return { type: 'farm', farm, text, source: farm.fonte[0] };
}

export function farmList(text: string[]): Answer {
  return {
    type: 'list',
    title: 'Farms',
    entries: farms.map((f) => ({ label: f.nome, query: f.nome, icon: f.produz[0] ?? 'emerald', hint: `${f.dificuldade}/5` })),
    text,
    source: 'curadoria com fontes (minecraft.wiki + tutoriais 26.x)',
  };
}

/* ------------------------------------------------------------------ */

export function mobAnswer(id: string): Answer {
  const cm = curatedMobs[id];
  const name = mobName(id);
  const icon = items[`${id}_spawn_egg`] ? `${id}_spawn_egg` : undefined;
  if (!cm) {
    const d = dropsAnswer({ kind: 'mob', id, label: name, icon });
    d.text.unshift(`Ainda não tenho a ficha de ${b(name)}, mas os drops vêm do jogo:`);
    return d;
  }
  const hearts = cm.vida / 2;
  const stats = [
    { label: 'Vida', value: `${cm.vida} (${String(hearts).replace('.', ',')} corações)` },
    { label: 'Dano (normal)', value: cm.dano },
  ];
  const text = [`${b(name)}: ${cm.descricao}`, `${b('Onde:')} ${cm.onde}`, `${b('Dica:')} ${cm.como_matar}`];
  return { type: 'info', title: name, icon, badge: cm.comportamento, stats, text, source: cm.fonte };
}

export function infoAnswer(item: string, prefix: string[] = []): Answer {
  const it = items[item];
  const stats: { label: string; value: string }[] = [];
  if (it.stack !== 64) stats.push({ label: 'Empilha', value: String(it.stack) });
  if (it.durability) stats.push({ label: 'Durabilidade', value: String(it.durability) });
  if (it.food) stats.push({ label: 'Fome', value: `${it.food.nutrition} (${String(it.food.saturation).replace('.', ',')} sat.)` });
  if (it.fuel) stats.push({ label: 'Combustível', value: `${String(Math.round((it.fuel / 200) * 10) / 10).replace('.', ',')} itens` });
  const uses = recipesUsing.get(item)?.length ?? 0;
  const text = [...prefix];
  if (!prefix.length) text.push(`${b(itemName(item))}${it.nameEn !== it.name ? ` (${it.nameEn})` : ''}.`);
  if (uses) text.push(`É ingrediente de ${b(String(uses))} receita${uses > 1 ? 's' : ''}.`);
  return { type: 'info', title: itemName(item), icon: item, stats, text, source: GAME_SOURCE };
}

/* ------------------------------------------------------------------ */

export function enchantmentAnswer(id: string): Answer {
  const e = enchantments[id];
  const c = curatedEnchantments[id];
  const roman = ['I', 'II', 'III', 'IV', 'V'][e.maxLevel - 1] ?? String(e.maxLevel);
  const stats = [
    { label: 'Nível máx.', value: roman },
    { label: 'Mesa', value: e.inTable ? 'sim' : 'não' },
    { label: 'Aldeão', value: e.tradeable ? 'sim' : 'não' },
  ];
  const groups = groupSupported(e.supported);
  const text = [`${b(e.name)} ${roman}: ${c?.descricao ?? ''}`.trim(), `${b('Vai em:')} ${groups}.`];
  if (e.exclusiveWith.length) text.push(`${b('Não combina com:')} ${e.exclusiveWith.map((x) => enchantments[x]?.name ?? x).join(', ')}.`);
  if (e.treasure) text.push('É encantamento de **tesouro**: não sai na mesa.');
  if (e.curse) text.push('É uma **maldição**.');
  return { type: 'info', title: e.name, icon: 'enchanted_book', badge: e.curse ? 'maldição' : e.treasure ? 'tesouro' : undefined, stats, text, source: c ? `${GAME_SOURCE} + ${c.fonte}` : GAME_SOURCE };
}

const ENCH_PRIORITY = ['mending', 'unbreaking', 'sharpness', 'efficiency', 'protection', 'fortune', 'looting', 'power', 'feather_falling', 'silk_touch', 'sweeping_edge', 'fire_aspect', 'infinity', 'riptide', 'loyalty', 'multishot', 'quick_charge', 'density', 'breach', 'wind_burst', 'lunge', 'respiration', 'aqua_affinity', 'depth_strider', 'swift_sneak', 'soul_speed'];
const priority = (id: string) => {
  const i = ENCH_PRIORITY.indexOf(id);
  return i === -1 ? 99 : i;
};

/** Encantamentos que um item aceita (ex.: "melhor encantamento pra espada"). */
export function enchantmentsForItem(item: string): Answer {
  const list = Object.values(enchantments).filter((e) => e.supported.includes(item));
  const name = itemName(item);
  if (!list.length) return infoAnswer(item, [`${b(name)} não aceita encantamentos.`]);
  const good = list.filter((e) => !e.curse).sort((a, c) => priority(a.id) - priority(c.id));
  const text = [`${b(name)} aceita ${b(String(list.length))} encantamentos.`, `Os mais usados: ${good.slice(0, 4).map((e) => b(e.name)).join(', ')}.`];
  return {
    type: 'list',
    title: `Encantamentos · ${name}`,
    entries: good.map((e) => ({ label: e.name, query: `encantamento ${e.name}`, icon: 'enchanted_book', hint: ['I', 'II', 'III', 'IV', 'V'][e.maxLevel - 1] })),
    text,
    source: GAME_SOURCE,
  };
}

const GROUPS: [RegExp, string][] = [
  [/_sword$/, 'espadas'],
  [/_spear$/, 'lanças'],
  [/_axe$/, 'machados'],
  [/_pickaxe$/, 'picaretas'],
  [/_shovel$/, 'pás'],
  [/_hoe$/, 'enxadas'],
  [/_helmet$|turtle_helmet/, 'capacetes'],
  [/_chestplate$/, 'peitorais'],
  [/_leggings$/, 'calças'],
  [/_boots$/, 'botas'],
  [/^bow$/, 'arco'],
  [/^crossbow$/, 'besta'],
  [/^trident$/, 'tridente'],
  [/^mace$/, 'maça'],
  [/^fishing_rod$/, 'vara de pesca'],
  [/^elytra$/, 'élitros'],
  [/^shield$/, 'escudo'],
  [/shears$/, 'tesoura'],
];
function groupSupported(list: string[]): string {
  const found: string[] = [];
  let other = 0;
  for (const id of list) {
    const g = GROUPS.find(([re]) => re.test(id));
    if (g) {
      if (!found.includes(g[1])) found.push(g[1]);
    } else other++;
  }
  return found.join(', ') + (other ? `${found.length ? ' e ' : ''}${other} outro${other > 1 ? 's' : ''}` : '');
}

/* ------------------------------------------------------------------ */

function potionPath(target: string): BrewStep[] | undefined {
  // BFS a partir do frasco de água só por poções bebíveis.
  const drinkable = brewingRecipes.filter((r) => r.result.id === 'potion' && r.ingredients[0].items[0] === 'potion');
  const prev = new Map<string, (typeof drinkable)[number]>();
  const queue = ['water'];
  const seen = new Set(queue);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === target) break;
    for (const r of drinkable) {
      if (r.inputPotion !== cur || !r.result.potion || seen.has(r.result.potion)) continue;
      seen.add(r.result.potion);
      prev.set(r.result.potion, r);
      queue.push(r.result.potion);
    }
  }
  if (target !== 'water' && !prev.has(target)) return undefined;
  const steps: BrewStep[] = [];
  let cur = target;
  while (cur !== 'water') {
    const r = prev.get(cur)!;
    steps.unshift({ input: r.inputPotion!, inputItem: 'potion', reagent: r.ingredients[1].items[0], output: cur, outputItem: 'potion' });
    cur = r.inputPotion!;
  }
  return steps;
}

export const potionLabel = (id: string) => {
  const p = potions[id];
  if (!p) return id;
  if (id.startsWith('long_')) return `${p.name} (estendida)`;
  if (id.startsWith('strong_')) return `${p.name} II`;
  return p.name;
};

export function potionAnswer(id: string): Answer {
  const steps = potionPath(id);
  const cp = curatedPotions[id.replace(/^(long|strong)_/, '')];
  const name = potionLabel(id);
  if (!steps) return { type: 'not_understood', text: [`${b(name)} não pode ser feita no suporte de poções.`], suggestions: ['Poção de visão noturna', 'Poção de força', 'Poção de cura'], source: GAME_SOURCE };
  const variants: { label: string; reagent: string; result: string }[] = [];
  for (const r of brewingRecipes) {
    if (r.inputPotion !== id) continue;
    const reagent = r.ingredients[1].items[0];
    if (r.ingredients[0].items[0] === 'potion' && r.result.id === 'potion' && r.result.potion?.startsWith('long_')) variants.push({ label: 'Estendida', reagent, result: r.result.potion });
    if (r.ingredients[0].items[0] === 'potion' && r.result.id === 'potion' && r.result.potion?.startsWith('strong_')) variants.push({ label: 'Fortalecida (II)', reagent, result: r.result.potion });
    if (r.ingredients[0].items[0] === 'potion' && r.result.id === 'splash_potion') variants.push({ label: 'Arremessável', reagent, result: 'splash_potion' });
    if (r.ingredients[0].items[0] === 'splash_potion' && r.result.id === 'lingering_potion') variants.push({ label: 'Persistente', reagent, result: 'lingering_potion' });
  }
  const text = [`${b(name)} em ${b(String(steps.length))} etapa${steps.length > 1 ? 's' : ''} no ${b('suporte de poções')} (combustível: pó de blaze).`];
  if (cp) {
    text.push(cp.descricao);
    const dur = [cp.duracao && `normal ${cp.duracao}`, cp.duracao_estendida && `estendida ${cp.duracao_estendida}`, cp.duracao_fortalecida && `II ${cp.duracao_fortalecida}`].filter(Boolean);
    if (dur.length) text.push(`${b('Duração:')} ${dur.join(' · ')}.`);
  }
  return { type: 'potion', potion: id, steps, variants, text, source: cp ? `${GAME_SOURCE} + ${cp.fonte}` : GAME_SOURCE };
}

export function potionList(): Answer {
  return {
    type: 'list',
    title: 'Poções',
    entries: Object.values(curatedPotions)
      .filter((p) => potionPath(p.pocao))
      .map((p) => ({ label: potions[p.pocao]?.name ?? p.pocao, query: potions[p.pocao]?.name ?? p.pocao, icon: 'potion', hint: p.duracao ?? '' })),
    text: ['Qual poção?'],
    source: GAME_SOURCE,
  };
}

/* ------------------------------------------------------------------ */

export function tradesForProfession(id: string): Answer {
  const levels = trades[id] ?? [];
  const name = professions[id]?.name ?? id;
  const rows = levels.flatMap((l) => l.trades.map((t) => ({ profession: id, level: l.level, trade: t, sells: t.gives.item !== 'emerald' })));
  const ws = workstations[id];
  const text = [`${b(name)}${ws ? `: bloco de trabalho ${b(itemName(ws))}` : ''}.`, `${b(String(rows.length))} trocas possíveis em ${levels.length} níveis (sorteia algumas por nível).`];
  return { type: 'trades', title: name, icon: ws ?? 'emerald', rows, text, source: GAME_SOURCE };
}

export function tradesForItem(item: string): Extract<Answer, { type: 'trades' }> {
  const list = tradesByItem.get(item) ?? [];
  const name = itemName(item);
  const sellers = [...new Set(list.filter((t) => t.sells).map((t) => professions[t.profession]?.name ?? t.profession))];
  const buyers = [...new Set(list.filter((t) => !t.sells).map((t) => professions[t.profession]?.name ?? t.profession))];
  const text: string[] = [];
  if (sellers.length) text.push(`${b(sellers.join(', '))} ${sellers.length > 1 ? 'vendem' : 'vende'} ${b(name)}.`);
  if (buyers.length) text.push(`${b(buyers.join(', '))} ${buyers.length > 1 ? 'compram' : 'compra'} ${b(name)} por esmeraldas.`);
  if (!text.length) text.push(`Nenhum aldeão troca ${b(name)}.`);
  return { type: 'trades', title: name, icon: item, rows: list, text, source: GAME_SOURCE };
}

/* ------------------------------------------------------------------ */

export function usesAnswer(item: string): Answer {
  const list = (recipesUsing.get(item) ?? []).filter((r) => r.result.id !== item);
  const name = itemName(item);
  if (!list.length) return infoAnswer(item, [`${b(name)} não é ingrediente de nenhuma receita.`]);
  const unique = new Map<string, Recipe>();
  for (const r of list) if (!unique.has(r.result.id)) unique.set(r.result.id, r);
  const arr = [...unique.values()];
  const text = [`${b(name)} é usado em ${b(String(arr.length))} ${arr.length > 1 ? 'itens' : 'item'}.`, 'Clique num item para ver a receita.'];
  return { type: 'uses', item, recipes: arr.slice(0, 24), total: arr.length, text, source: GAME_SOURCE };
}

/* ------------------------------------------------------------------ */

export function tipAnswer(id: string | null): Answer {
  const t = id ? tips.find((x) => x.id === id) : undefined;
  if (!t) {
    return {
      type: 'list',
      title: 'Dicas',
      entries: tips.map((x) => ({ label: x.titulo, query: x.titulo, icon: x.itens[0] })),
      text: ['Sobre o que?'],
      source: 'curadoria com fontes (minecraft.wiki)',
    };
  }
  return { type: 'info', title: t.titulo, icon: t.itens[0], stats: [], items: t.itens, text: t.texto, source: t.fonte };
}

export function novidadeAnswer(id: string | null): Answer {
  const n = novidades.find((x) => x.id === (id ?? VERSION)) ?? novidades[0];
  const text = [`${b(`${n.versao} · ${n.nome}`)} (${n.data.split('-').reverse().join('/')}):`, ...n.destaques.slice(0, 5)];
  return { type: 'info', title: `${n.versao} · ${n.nome}`, icon: n.itens[0], stats: [], items: n.itens, text, source: n.fonte };
}

/* ------------------------------------------------------------------ */

export function notUnderstood(suggestions: string[], why?: string): Answer {
  return {
    type: 'not_understood',
    text: [why ?? `Não entendi essa. Eu só sei de Minecraft Java ${VERSION} e respondo com os dados do jogo.`, 'Tente perguntar assim:'],
    suggestions: suggestions.slice(0, 3),
    source: GAME_SOURCE,
  };
}

export function clarify(options: ClarifyOption[]): Answer {
  return { type: 'clarify', text: ['Você quis dizer:'], options: options.slice(0, 4), source: GAME_SOURCE };
}

/** Frase de pergunta para uma intenção + entidade (usada em chips e sugestões). */
export function questionFor(intent: Intent | null, e: Entity): string {
  const l = e.label;
  switch (intent) {
    case 'fundir':
      return `${l} na fornalha`;
    case 'onde_achar':
      return `Onde acho ${l}?`;
    case 'drop':
      return e.kind === 'mob' ? `O que ${l} dropa?` : `O que dropa ${l}?`;
    case 'usos':
      return `Pra que serve ${l}?`;
    case 'farm':
      return e.kind === 'farm' ? l : `Farm de ${l}`;
    case 'troca_aldeao':
      return e.kind === 'profession' ? `Trocas do ${l}` : `Qual aldeão vende ${l}?`;
    case 'mob_info':
      return `O que é ${l}?`;
    default:
      if (e.kind === 'mob') return `O que é ${l}?`;
      if (e.kind === 'item') return `Como faz ${l}?`;
      return l;
  }
}
