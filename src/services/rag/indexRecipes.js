import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { openRouterEmbed } from '../openrouter/client.js';
import { ensureCollections, upsertPoints } from './qdrant.js';

const seedRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../data/seed');

function recipeText(r) {
  const parts = [
    r.title,
    ...(r.meals || []),
    ...(r.tags || []),
    ...(r.ingredients || []).map((x) => (typeof x === 'string' ? x : x.name || x.key || '')),
    ...(r.steps || []).slice(0, 3),
  ];
  return parts.filter(Boolean).join(' | ');
}

/** Stable numeric/string id for Qdrant — prefer recipe id. */
function pointId(r, index) {
  if (typeof r.id === 'number' && Number.isFinite(r.id)) return r.id;
  if (typeof r.id === 'string' && /^\d+$/.test(r.id)) return Number(r.id);
  // UUID-ish strings are valid Qdrant point ids
  if (typeof r.id === 'string' && r.id.length > 0) return r.id;
  return index + 1;
}

/**
 * Load data/seed/recipes.json, embed with config.embeddingModel, upsert to config.qdrantRecipes.
 * @param {{ recipesPath?: string, batchSize?: number }} [opts]
 */
export async function indexRecipes({ recipesPath, batchSize = 8 } = {}) {
  const file = recipesPath || path.join(seedRoot, 'recipes.json');
  const raw = await readFile(file, 'utf8');
  const recipes = JSON.parse(raw);
  if (!Array.isArray(recipes) || recipes.length === 0) {
    throw new Error(`no recipes in ${file}`);
  }

  // Probe dimension from first embed — never hardcode vector size
  const probe = await openRouterEmbed({
    model: config.embeddingModel,
    input: recipeText(recipes[0]),
  });
  if (!probe.length) throw new Error('embedding probe returned empty vector');

  await ensureCollections({ vectorSize: probe.length });

  const points = [];
  // Reuse probe for first recipe
  points.push({
    id: pointId(recipes[0], 0),
    vector: probe,
    payload: {
      recipeId: recipes[0].id ?? pointId(recipes[0], 0),
      title: recipes[0].title,
      meals: recipes[0].meals ?? [],
      tags: recipes[0].tags ?? [],
      allergens: recipes[0].allergens ?? [],
      ingredients: recipes[0].ingredients ?? [],
      estServings: recipes[0].estServings ?? null,
    },
  });

  for (let i = 1; i < recipes.length; i += batchSize) {
    const batch = recipes.slice(i, i + batchSize);
    const embeds = await Promise.all(
      batch.map((r) =>
        openRouterEmbed({
          model: config.embeddingModel,
          input: recipeText(r),
        }),
      ),
    );
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j];
      const idx = i + j;
      points.push({
        id: pointId(r, idx),
        vector: embeds[j],
        payload: {
          recipeId: r.id ?? pointId(r, idx),
          title: r.title,
          meals: r.meals ?? [],
          tags: r.tags ?? [],
          allergens: r.allergens ?? [],
          ingredients: r.ingredients ?? [],
          estServings: r.estServings ?? null,
        },
      });
    }
    logger.info('index_recipes_batch', { from: i, to: i + batch.length - 1 });
  }

  const result = await upsertPoints(config.qdrantRecipes, points);
  logger.info('index_recipes_done', {
    collection: config.qdrantRecipes,
    count: result.count,
  });
  return { collection: config.qdrantRecipes, count: result.count, vectorSize: probe.length };
}

export { seedRoot };
