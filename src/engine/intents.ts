/** Intenções reconhecidas e as regras (palavras-chave + padrões com peso). */
export type Intent =
  | 'receita'
  | 'fundir'
  | 'onde_achar'
  | 'farm'
  | 'drop'
  | 'mob_info'
  | 'encantamento'
  | 'pocao'
  | 'troca_aldeao'
  | 'dica'
  | 'novidade'
  | 'usos'
  | 'info';

export const INTENT_LABEL: Record<Intent, string> = {
  receita: 'receita',
  fundir: 'fornalha',
  onde_achar: 'onde achar',
  farm: 'farm',
  drop: 'drops',
  mob_info: 'mob',
  encantamento: 'encantamento',
  pocao: 'poção',
  troca_aldeao: 'troca com aldeão',
  dica: 'dica',
  novidade: 'novidades',
  usos: 'pra que serve',
  info: 'informação',
};

interface Rule {
  intent: Intent;
  re: RegExp;
  weight: number;
}

const R = (intent: Intent, weight: number, re: RegExp): Rule => ({ intent, re, weight });

/** Regras sobre o texto normalizado (sem acento), antes do singular. */
export const RULES: Rule[] = [
  // receita
  R('receita', 3, /\b(como (e que )?(se )?(eu )?(faz|faco|fazer|faze|fas|crafta|craftar|crafto|cria|criar|crio|monta|montar|fabrica|fabricar|produz|produzir|consigo fazer|consigo craftar)|receita|receitas|craft|crafts|craftar|craftando|crafting|recipe|how (do you |to )?(make|craft))\b/),
  R('receita', 1.5, /\b(fazer|faz|faco|criar|montar|fabricar|construir|preciso de|quero|queria)\b/),
  R('receita', 2, /\b(material|materiais|ingrediente|ingredientes|o que precisa|oq precisa|o que vai|oque precisa)\b/),
  // fornalha
  R('fundir', 5, /\b(fornalha|fundir|fundo|funde|derreter|derreto|derrete|assar|asso|assa|assado|cozinhar|cozinho|cozinha|smelt|smelting|forno|alto forno|defumador|queimar|queimo)\b/),
  // onde achar
  R('onde_achar', 3.5, /\b(onde (eu )?(acho|encontro|achar|encontrar|fica|ficam|tem|nasce|nascem|spawna|spawnam|aparece|aparecem|gera|geram|consigo|pego|pegar|minero|minerar)|que altura|qual (o )?(y|altura|camada|layer|nivel)|melhor (y|altura|camada|nivel|lugar)|em que (y|altura|camada)|onde que|where (is|are|to find|do i find)|localizacao|coordenada)\b/),
  R('onde_achar', 1.5, /\b(altura|camada|layer|bioma|biomas|achar|encontrar|minerar|minerando|mineracao|spawn|spawna|nasce)\b/),
  R('onde_achar', 1, /\by\b/),
  // farm
  R('farm', 4, /\b(farm|farms|farmar|farmando|fazenda automatica|fazendinha|automatica|automatico|automatizar|breeder|trading hall|salao de trocas|infinito|infinita|afk)\b/),
  // drops
  R('drop', 4, /\b(dropa|dropam|drop|drops|dropar|droparia|solta|soltam|deixa cair|larga|loot|o que (o|a) \w+ (da|solta))\b/),
  R('drop', 1.5, /\b(ganho|ganha) (quando|ao) (mata|matar)\b/),
  // mob info
  R('mob_info', 3, /\b(como matar|como mato|como derrotar|como vencer|como enfrentar|como fugir|quanto de vida|quanta vida|vida do|vida da|dano do|dano da|e perigoso|perigoso|forte|fraqueza do)\b/),
  R('mob_info', 2, /\b(o que e (o|a|um|uma)|quem e (o|a)|what is|sobre (o|a))\b/),
  // encantamento
  R('encantamento', 4, /\b(encantamento|encantamentos|encantar|encanto|enchant|enchants|enchantment|livro encantado|nivel maximo|encantado)\b/),
  // poção
  R('pocao', 4, /\b(pocao|pocoes|pocion|potion|potions|alquimia|preparar pocao|poçao|pocao de|splash|arremessavel|persistente)\b/),
  // trocas
  R('troca_aldeao', 3.5, /\b(qual (aldeao|profissao)|quem vende|quem compra|vende|vendem|compra|compram|trocar|troca|trocas|trade|trades|profissao|profissoes|bloco de trabalho|mercador)\b/),
  R('troca_aldeao', 1.5, /\baldeao\b/),
  // dica
  R('dica', 3.5, /\b(dica|dicas|como comecar|comecar|primeiro dia|o que fazer primeiro|o que fazer|iniciante|novato|noob|guia|tutorial|help|ajuda|me ajuda|estrategia)\b/),
  // novidades
  R('novidade', 4, /\b(novidade|novidades|o que (tem|ha) de novo|o que mudou|mudou|mudancas|mudanca|update|atualizacao|atualizacoes|patch|lancou|lancamento|drop novo|ultima versao|versao nova|nova versao|changelog|what s new|whats new)\b/),
  R('novidade', 2.5, /\b26_[123]\b|\bnovo\b|\bnova\b/),
  // usos
  R('usos', 4.5, /\b(pra (que|q) serve|para (que|q) serve|serve pra|serve para|onde (eu )?uso|onde usar|usos|uso de|uso do|uso da|pra que usa|pra q usa|o que (da|posso|consigo|eu posso) (pra |para )?fazer com|utilidade|what is .* used for|uses)\b/),
  // info genérica
  R('info', 2, /\b(o que e|que e|informacao|informacoes|info|detalhes|quantos|quanto|durabilidade|empilha|stack|combustivel|queima quanto)\b/),
];

export interface IntentScore {
  intent: Intent;
  score: number;
}

export function scoreIntents(text: string): IntentScore[] {
  const scores = new Map<Intent, number>();
  for (const r of RULES) {
    if (r.re.test(text)) scores.set(r.intent, (scores.get(r.intent) ?? 0) + r.weight);
  }
  return [...scores.entries()].map(([intent, score]) => ({ intent, score })).sort((a, b) => b.score - a.score);
}

/** Palavras que pertencem às regras de intenção (não contam como "palavra desconhecida"). */
export const INTENT_WORDS = new Set(
  (
    'como faz faco fazer faze fas crafta craftar crafto craft crafts crafting cria criar crio monta montar fabrica fabricar produz produzir consigo receita recipe make ' +
    'construir preciso quero queria material ingrediente precisa vai fornalha fundir fundo funde derreter derreto derrete assar asso assa assado cozinhar cozinho cozinha smelt forno queimar queimo ' +
    'onde acho encontro achar encontrar fica ficam tem nasce nascem spawna spawnam aparece aparecem gera geram pego pegar minero minerar altura camada layer nivel melhor lugar where find localizacao coordenada bioma mineracao minerando spawn y ' +
    'farm farmar farmando fazenda automatica automatico automatizar fazendinha infinito infinita afk ' +
    'dropa dropam drop dropar droparia solta soltam deixa cair larga loot ganho ganha mata matar mato derrotar vencer enfrentar fugir vida dano perigoso forte fraqueza quem sobre ' +
    'encantamento encantar encanto enchant enchantment maximo pocao potion alquimia preparar splash arremessavel persistente ' +
    'vende vendem compra compram trocar troca trade profissao dica comecar primeiro dia iniciante novato noob guia tutorial help ajuda estrategia ' +
    'novidade novo nova mudou mudanca update atualizacao patch lancou lancamento ultima versao changelog new whats ' +
    'serve uso usar usa utilidade use used info informacao detalhe quanto quantos durabilidade empilha stack combustivel posso e que o'
  ).split(' '),
);
