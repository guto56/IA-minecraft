import fs from 'node:fs';
import path from 'node:path';
import { DATA_OUT, ICON_OUT, Jar, config, log, readJson, stripNs, writeJson } from './util.ts';
import { downloadVersion, ensureJava, runDataGenerator } from './download.ts';
import { loadLang } from './lang.ts';
import { resolveTags } from './tags.ts';
import { extractItems } from './items.ts';
import { extractRecipes } from './recipes.ts';
import { extractLoot } from './loot.ts';
import { extractTrades } from './trades.ts';
import { extractEnchantments } from './enchantments.ts';
import { extractWorld } from './world.ts';
import { renderIcons } from './icons.ts';
import { extractGui, writeAppIcons } from './gui.ts';

async function main() {
  const dl = await downloadVersion();
  const java = await ensureJava(dl.versionJson.javaVersion?.majorVersion ?? 25);
  const generated = runDataGenerator(java, dl.serverJar, dl.dir);
  log('jar', 'lendo client.jar');
  const jar = new Jar(dl.clientJar);
  const lang = loadLang(jar, dl.ptBr);

  const itemTags = resolveTags(jar, 'item');
  const biomeTags = resolveTags(jar, 'worldgen/biome');
  const enchTags = resolveTags(jar, 'enchantment');
  const entityTags = resolveTags(jar, 'entity_type');

  const items = extractItems(jar, generated, lang);
  const itemIds = new Set(Object.keys(items));
  log('itens', `${itemIds.size} itens`);

  const skipped: string[] = [];
  const recipes = extractRecipes(jar, itemTags, itemIds, skipped);
  log('receitas', `${recipes.length} receitas (${skipped.length} especiais sem grade fixa ignoradas)`);

  const loot = extractLoot(jar, itemTags, itemIds);
  log('drops', `${Object.keys(loot).length} loot tables`);

  const trades = extractTrades(jar);
  log('trocas', `${Object.keys(trades).length} profissões`);

  const enchantments = extractEnchantments(jar, lang, itemTags, enchTags);
  log('encantamentos', `${Object.keys(enchantments).length}`);

  const world = extractWorld(jar, lang, biomeTags);
  log('mundo', `${Object.keys(world.biomes).length} biomas, ${Object.keys(world.structures).length} estruturas, ${Object.keys(world.ores).length} minérios`);

  // Mobs (registro de entidades com nome traduzido e loot table).
  const registries = readJson(path.join(generated, 'reports/registries.json'));
  const mobs: Record<string, { id: string; name: string; nameEn: string; spawnEgg: boolean; loot: boolean }> = {};
  for (const full of Object.keys(registries['minecraft:entity_type'].entries)) {
    const id = stripNs(full);
    const key = `entity.minecraft.${id}`;
    if (!lang.en[key]) continue;
    const hasLoot = !!loot[`entities/${id}`];
    const spawnEgg = itemIds.has(`${id}_spawn_egg`);
    if (!hasLoot && !spawnEgg) continue;
    mobs[id] = { id, name: lang.pt[key] ?? lang.en[key], nameEn: lang.en[key], spawnEgg, loot: hasLoot };
  }
  log('mobs', `${Object.keys(mobs).length}`);

  // Poções e efeitos
  const potions: Record<string, { id: string; name: string; nameEn: string; base: string }> = {};
  for (const full of Object.keys(registries['minecraft:potion'].entries)) {
    const id = stripNs(full);
    const base = id.replace(/^(long|strong)_/, '');
    const key = `item.minecraft.potion.effect.${base}`;
    if (!lang.en[key]) continue;
    potions[id] = { id, name: lang.pt[key] ?? lang.en[key], nameEn: lang.en[key], base };
  }
  const effects: Record<string, { id: string; name: string; nameEn: string }> = {};
  for (const full of Object.keys(registries['minecraft:mob_effect'].entries)) {
    const id = stripNs(full);
    const key = `effect.minecraft.${id}`;
    effects[id] = { id, name: lang.pt[key] ?? lang.en[key], nameEn: lang.en[key] };
  }

  // Profissões de aldeão (nome traduzido)
  const professions: Record<string, { id: string; name: string; nameEn: string }> = {};
  for (const full of Object.keys(registries['minecraft:villager_profession'].entries)) {
    const id = stripNs(full);
    const key = `entity.minecraft.villager.${id}`;
    if (lang.en[key]) professions[id] = { id, name: lang.pt[key] ?? lang.en[key], nameEn: lang.en[key] };
  }
  professions['wandering_trader'] = { id: 'wandering_trader', name: lang.pt['entity.minecraft.wandering_trader'], nameEn: lang.en['entity.minecraft.wandering_trader'] };

  // Só as tags usadas por receitas (para a grade alternar os itens).
  const usedTags: Record<string, string[]> = {};
  for (const r of recipes) for (const i of r.ingredients) if (i.tag) usedTags[i.tag] = i.items;

  const meta = {
    version: config.minecraftVersion,
    dropName: config.dropName,
    releaseDate: config.releaseDate,
    javaVersion: dl.versionJson.javaVersion?.majorVersion,
    extractedAt: new Date().toISOString().slice(0, 10),
    clientSha1: dl.versionJson.downloads.client.sha1,
    counts: {
      items: itemIds.size,
      recipes: recipes.length,
      loot: Object.keys(loot).length,
      mobs: Object.keys(mobs).length,
      enchantments: Object.keys(enchantments).length,
      biomes: Object.keys(world.biomes).length,
    },
    entityTags: { skeletons: entityTags['skeletons'] ?? [] },
  };

  fs.mkdirSync(DATA_OUT, { recursive: true });
  writeJson(path.join(DATA_OUT, 'items.json'), items);
  writeJson(path.join(DATA_OUT, 'recipes.json'), recipes);
  writeJson(path.join(DATA_OUT, 'tags.json'), usedTags);
  writeJson(path.join(DATA_OUT, 'loot.json'), loot);
  writeJson(path.join(DATA_OUT, 'trades.json'), trades);
  writeJson(path.join(DATA_OUT, 'enchantments.json'), enchantments);
  writeJson(path.join(DATA_OUT, 'biomes.json'), world.biomes);
  writeJson(path.join(DATA_OUT, 'structures.json'), world.structures);
  writeJson(path.join(DATA_OUT, 'ores.json'), world.ores);
  writeJson(path.join(DATA_OUT, 'mobs.json'), mobs);
  writeJson(path.join(DATA_OUT, 'potions.json'), { potions, effects });
  writeJson(path.join(DATA_OUT, 'professions.json'), professions);
  writeJson(path.join(DATA_OUT, 'meta.json'), meta);

  if (!process.argv.includes('--no-icons')) {
    log('ícones', 'renderizando');
    fs.rmSync(ICON_OUT, { recursive: true, force: true });
    const report = renderIcons(jar, [...itemIds], ICON_OUT);
    log('ícones', `${report.rendered} gerados ${JSON.stringify(report.kinds)}; sem ícone: ${report.missing.length}`);
    writeJson(path.join(DATA_OUT, 'icons.json'), { columns: report.columns, sizes: [32, 64], index: report.index, iso: report.iso, missing: report.missing });
    writeAppIcons(path.join(ICON_OUT, 'atlas-64.png'), report.index['crafting_table'], report.columns, path.dirname(ICON_OUT));
  }
  extractGui(jar, path.join(path.dirname(ICON_OUT), 'gui'));
  log('ok', `dados de ${config.minecraftVersion} em src/data/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
