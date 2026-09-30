/** Tipos dos JSON gerados por `npm run extract` e da curadoria em src/data/curated. */

export interface Item {
  id: string;
  name: string;
  nameEn: string;
  stack: number;
  rarity: string;
  durability?: number;
  food?: { nutrition: number; saturation: number };
  fuel?: number;
  block: boolean;
  detail?: string;
  detailEn?: string;
}

export interface Ingredient {
  items: string[];
  tag?: string;
}

export type Station = 'crafting' | 'smelting' | 'blasting' | 'smoking' | 'campfire' | 'stonecutting' | 'smithing' | 'brewing';

export interface Recipe {
  id: string;
  station: Station;
  kind: string;
  grid?: (number | null)[];
  width?: number;
  height?: number;
  ingredients: Ingredient[];
  result: { id: string; count: number; potion?: string };
  xp?: number;
  time?: number;
  inputPotion?: string;
  group?: string;
  category?: string;
}

export interface Drop {
  item: string;
  min: number;
  max: number;
  chance: number;
  looting?: boolean;
  fortune?: boolean;
  silkTouch?: boolean;
  shears?: boolean;
  playerKill?: boolean;
  cookedOnFire?: boolean;
  special?: string;
  anyOf?: number;
  anyOfTag?: string;
}

export interface LootTable {
  id: string;
  kind: 'entity' | 'block' | 'gameplay' | 'chest';
  drops: Drop[];
}

export interface TradeStack {
  item: string;
  min: number;
  max: number;
}

export interface Trade {
  wants: TradeStack;
  wants2?: TradeStack;
  gives: TradeStack;
  maxUses: number;
  xp?: number;
  notes: string[];
  villagerTypes?: string[];
}

export interface TradeLevel {
  level: string;
  amount: number;
  trades: Trade[];
}

export interface Enchantment {
  id: string;
  name: string;
  nameEn: string;
  maxLevel: number;
  weight: number;
  anvilCost: number;
  supportedTag?: string;
  supported: string[];
  primaryTag?: string;
  exclusiveWith: string[];
  slots: string[];
  treasure: boolean;
  curse: boolean;
  inTable: boolean;
  tradeable: boolean;
}

export interface MobSpawn {
  mob: string;
  category: string;
  weight: number;
  min: number;
  max: number;
}

export interface Biome {
  id: string;
  name: string;
  nameEn: string;
  dimension: 'overworld' | 'nether' | 'end';
  temperature: number;
  spawns: MobSpawn[];
  structures: string[];
}

export interface Structure {
  id: string;
  family: string;
  biomes: string[];
}

export interface OrePlacement {
  feature: string;
  distribution: 'trapezoid' | 'uniform';
  min: number;
  max: number;
  peak?: [number, number];
  perChunk: number;
  size: number;
  airExposureDiscard: number;
  biomes: string[];
  dimension: 'overworld' | 'nether' | 'end';
}

export interface Ore {
  id: string;
  blocks: string[];
  placements: OrePlacement[];
}

export interface Mob {
  id: string;
  name: string;
  nameEn: string;
  spawnEgg: boolean;
  loot: boolean;
}

export interface Named {
  id: string;
  name: string;
  nameEn: string;
}

/* ------------------------------ curadoria ------------------------------ */

export interface Farm {
  id: string;
  nome: string;
  apelidos: string[];
  dificuldade: number;
  rende: { texto: string; fonte: string };
  materiais: { item: string; qtd: number }[];
  requisitos: string[];
  passos: string[];
  erros_comuns: string[];
  video: string;
  video_titulo: string;
  alimenta: string[];
  produz: string[];
  fonte: string[];
}

export interface CuratedMob {
  id: string;
  mob: string;
  vida: number;
  comportamento: 'hostil' | 'neutro' | 'passivo';
  dano: string;
  onde: string;
  como_matar: string;
  descricao: string;
  fonte: string;
}

export interface CuratedPotion {
  id: string;
  pocao: string;
  duracao: string | null;
  duracao_estendida: string | null;
  duracao_fortalecida: string | null;
  descricao: string;
  apelidos: string[];
  fonte: string;
}

export interface CuratedOre {
  id: string;
  item: string;
  y_ideal: number;
  y_extra: number[] | null;
  dica: string;
  fonte: string;
}

export interface CuratedEnchantment {
  id: string;
  encantamento: string;
  descricao: string;
  fonte: string;
}

export interface CuratedProfession {
  id: string;
  profissao: string;
  item: string;
  fonte: string;
}

export interface CuratedStructure {
  id: string;
  familia: string;
  nome: string;
  apelidos: string[];
  descricao: string;
  item: string;
  fonte: string;
}

export interface Tip {
  id: string;
  titulo: string;
  apelidos: string[];
  texto: string[];
  itens: string[];
  fonte: string;
}

export interface Novidade {
  id: string;
  versao: string;
  nome: string;
  data: string;
  destaques: string[];
  itens: string[];
  apelidos: string[];
  fonte: string;
}
