import { describe, expect, it } from 'vitest';
import recipes from '../recipes.json';

type R = (typeof recipes)[number];

/** Converte a receita extraída em linhas de texto com o 1º item de cada slot. */
function shape(r: R): string[] {
  const rows: string[] = [];
  const grid = r.grid ?? [];
  for (let y = 0; y < 3; y++) {
    const row = [0, 1, 2].map((x) => {
      const g = grid[y * 3 + x];
      if (g === null || g === undefined) return '.';
      const ing = r.ingredients[g];
      return ing.tag && ing.items.length > 1 ? `#${ing.tag}` : ing.items[0];
    });
    if (row.some((c) => c !== '.')) rows.push(row.join(' '));
  }
  // remove colunas vazias à direita
  return rows.map((row) => row.replace(/( \.)+$/, ''));
}

const byId = (id: string) => {
  const r = recipes.find((x) => x.id === id);
  if (!r) throw new Error(`receita ${id} não encontrada`);
  return r;
};

const shapeless = (r: R) => r.ingredients.map((i) => (i.tag ? `#${i.tag}` : i.items[0])).sort();

describe('receitas extraídas batem com as receitas conhecidas do jogo', () => {
  const cases: [string, string[], string, number][] = [
    ['crafting_table', ['#planks #planks', '#planks #planks'], 'crafting_table', 1],
    ['torch', ['coal', 'stick'], 'torch', 4],
    ['piston', ['#planks #planks #planks', 'cobblestone iron_ingot cobblestone', 'cobblestone redstone cobblestone'], 'piston', 1],
    ['observer', ['cobblestone cobblestone cobblestone', 'redstone redstone quartz', 'cobblestone cobblestone cobblestone'], 'observer', 1],
    ['hopper', ['iron_ingot . iron_ingot', 'iron_ingot chest iron_ingot', '. iron_ingot'], 'hopper', 1],
    ['red_bed', ['red_wool red_wool red_wool', '#planks #planks #planks'], 'red_bed', 1],
    ['enchanting_table', ['. book', 'diamond obsidian diamond', 'obsidian obsidian obsidian'], 'enchanting_table', 1],
    ['anvil', ['iron_block iron_block iron_block', '. iron_ingot', 'iron_ingot iron_ingot iron_ingot'], 'anvil', 1],
    ['name_tag', ['. #metal_nuggets', 'paper'], 'name_tag', 1],
    ['white_concrete_stairs', ['white_concrete', 'white_concrete white_concrete', 'white_concrete white_concrete white_concrete'], 'white_concrete_stairs', 4],
    ['furnace', ['#stone_crafting_materials #stone_crafting_materials #stone_crafting_materials', '#stone_crafting_materials . #stone_crafting_materials', '#stone_crafting_materials #stone_crafting_materials #stone_crafting_materials'], 'furnace', 1],
    ['chest', ['#planks #planks #planks', '#planks . #planks', '#planks #planks #planks'], 'chest', 1],
    ['stick', ['#planks', '#planks'], 'stick', 4],
    ['diamond_pickaxe', ['diamond diamond diamond', '. stick', '. stick'], 'diamond_pickaxe', 1],
    ['iron_block', ['iron_ingot iron_ingot iron_ingot', 'iron_ingot iron_ingot iron_ingot', 'iron_ingot iron_ingot iron_ingot'], 'iron_block', 1],
    ['bucket', ['iron_ingot . iron_ingot', '. iron_ingot'], 'bucket', 1],
    ['dispenser', ['cobblestone cobblestone cobblestone', 'cobblestone bow cobblestone', 'cobblestone redstone cobblestone'], 'dispenser', 1],
  ];
  for (const [id, rows, result, count] of cases) {
    it(`${id}`, () => {
      const r = byId(id);
      expect(r.kind).toBe('shaped');
      expect(shape(r)).toEqual(rows);
      expect(r.result).toMatchObject({ id: result, count });
    });
  }

  it('olho do ender (sem forma)', () => {
    const r = byId('ender_eye');
    expect(r.kind).toBe('shapeless');
    expect(shapeless(r)).toEqual(['blaze_powder', 'ender_pearl']);
  });

  it('lingote de ferro na fornalha', () => {
    const r = byId('iron_ingot_from_smelting_iron_ore');
    expect(r.station).toBe('smelting');
    expect(r.ingredients[0].items).toEqual(['iron_ore']);
    expect(r.result.id).toBe('iron_ingot');
    expect(r.time).toBe(200);
  });

  it('espada de netherita na mesa de ferraria', () => {
    const r = byId('netherite_sword_smithing');
    expect(r.station).toBe('smithing');
    expect(r.ingredients[0].items).toEqual(['netherite_upgrade_smithing_template']);
    expect(r.ingredients[1].items).toEqual(['diamond_sword']);
    expect(r.ingredients[2].items).toContain('netherite_ingot');
  });

  it('poção de visão noturna (alquimia vem do jar)', () => {
    const r = byId('brewing/potion_awkward_golden_carrot');
    expect(r.station).toBe('brewing');
    expect(r.inputPotion).toBe('awkward');
    expect(r.result.potion).toBe('night_vision');
  });
});
