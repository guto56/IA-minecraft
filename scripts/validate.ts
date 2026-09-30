/**
 * Valida os dados extraídos e a curadoria:
 * - toda receita/drop/troca/minério referencia IDs que existem;
 * - todo item tem ícone no atlas;
 * - todo item tem nome em pt_br;
 * - toda entrada de curadoria tem fonte e só usa IDs reais.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'src/data');
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));

const errors: string[] = [];
const warn: string[] = [];
const items: Record<string, { name: string; noPt?: boolean }> = read('items.json');
const has = (id: string) => id in items;
const need = (id: string, where: string) => {
  if (!has(id)) errors.push(`${where}: item inexistente "${id}"`);
};

// Receitas
const recipes: any[] = read('recipes.json');
for (const r of recipes) {
  need(r.result.id, `receita ${r.id} (resultado)`);
  r.ingredients.forEach((ing: any, i: number) => {
    if (!ing.items.length) errors.push(`receita ${r.id}: ingrediente ${i} vazio`);
    for (const it of ing.items) need(it, `receita ${r.id}`);
  });
  if (r.grid) for (const g of r.grid) if (g !== null && !r.ingredients[g]) errors.push(`receita ${r.id}: grade aponta para ingrediente ${g} inexistente`);
}

// Ícones
const icons = read('icons.json');
for (const id of Object.keys(items)) if (icons.index[id] === undefined) errors.push(`sem ícone: ${id}`);
for (const size of icons.sizes) if (!fs.existsSync(path.join(ROOT, `public/icons/atlas-${size}.png`))) errors.push(`atlas ${size}px ausente`);

// Traduções
for (const [id, it] of Object.entries(items)) if (it.noPt) errors.push(`sem tradução pt_br: ${id}`);

// Drops, trocas, minérios, encantamentos
const loot: Record<string, any> = read('loot.json');
for (const t of Object.values(loot)) for (const d of t.drops) need(d.item, `drop ${t.id}`);
const trades: Record<string, any[]> = read('trades.json');
for (const [p, levels] of Object.entries(trades))
  for (const l of levels)
    for (const t of l.trades) {
      need(t.wants.item, `troca ${p}`);
      need(t.gives.item, `troca ${p}`);
      if (t.wants2) need(t.wants2.item, `troca ${p}`);
    }
const ores: Record<string, any> = read('ores.json');
for (const o of Object.values(ores)) for (const b of o.blocks) need(b, `minério ${o.id}`);
const ench: Record<string, any> = read('enchantments.json');
for (const e of Object.values(ench)) {
  if (!e.name) errors.push(`encantamento sem nome: ${e.id}`);
  for (const x of e.exclusiveWith) if (!ench[x]) errors.push(`encantamento ${e.id}: incompatível com inexistente ${x}`);
}

// Curadoria
const curatedDir = path.join(DATA, 'curated');
if (fs.existsSync(curatedDir)) {
  const mobs = read('mobs.json');
  const biomes = read('biomes.json');
  const potions = read('potions.json');
  for (const file of fs.readdirSync(curatedDir).filter((f) => f.endsWith('.json'))) {
    const json = JSON.parse(fs.readFileSync(path.join(curatedDir, file), 'utf8'));
    const list: any[] = Array.isArray(json) ? json : (json.entries ?? []);
    for (const e of list) {
      const where = `curadoria ${file}#${e.id ?? '?'}`;
      if (!e.fonte || !(Array.isArray(e.fonte) ? e.fonte.length : String(e.fonte).startsWith('http'))) errors.push(`${where}: sem fonte`);
      for (const m of e.materiais ?? []) need(m.item, where);
      for (const it of e.itens ?? []) need(it, where);
      if (e.item) need(e.item, where);
      if (e.mob && !mobs[e.mob]) errors.push(`${where}: mob inexistente ${e.mob}`);
      for (const b of e.biomas ?? []) if (!biomes[b]) errors.push(`${where}: bioma inexistente ${b}`);
      if (e.pocao && !potions.potions[e.pocao]) errors.push(`${where}: poção inexistente ${e.pocao}`);
    }
  }
} else warn.push('pasta src/data/curated ainda não existe');

for (const w of warn) console.warn(`aviso: ${w}`);
if (errors.length) {
  console.error(errors.slice(0, 50).join('\n'));
  console.error(`\n${errors.length} erro(s) de validação`);
  process.exit(1);
}
console.log(`ok: ${Object.keys(items).length} itens, ${recipes.length} receitas, ${Object.keys(loot).length} loot tables validados`);
