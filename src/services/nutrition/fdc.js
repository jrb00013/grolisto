import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { createTtlCache } from '../scotr/cache.js';

const seedPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../data/seed/nutrition.json',
);

const cache = createTtlCache({ ttlMs: config.fdcCacheTtlMs });
let seedCache;

async function loadSeed() {
  if (seedCache) return seedCache;
  seedCache = JSON.parse(await readFile(seedPath, 'utf8'));
  return seedCache;
}

function normalizeKey(ingredient) {
  if (ingredient == null) return '';
  if (typeof ingredient === 'string') return ingredient.trim().toLowerCase().replace(/\s+/g, '_');
  return String(ingredient.key ?? ingredient.name ?? ingredient.term ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function qtyFactor(ingredient) {
  // rough edible amount: use qty if present else assume ~100g / 1 unit
  if (ingredient && typeof ingredient === 'object' && ingredient.qty != null) {
    const q = Number(ingredient.qty);
    if (!Number.isFinite(q) || q <= 0) return 1;
    const unit = String(ingredient.unit || '').toLowerCase();
    if (unit.includes('lb')) return q * 4.54; // ~100g units
    if (unit.includes('cup')) return q * 1.5;
    if (unit.includes('tbsp')) return q * 0.15;
    if (unit.includes('clove')) return q * 0.05;
    if (unit === 'ea' || unit === 'each') return q;
    if (unit.includes('can')) return q * 2.4;
    if (unit.includes('oz')) return q * 0.28;
    return q;
  }
  return 1;
}

async function seedLookup(key) {
  const seed = await loadSeed();
  const row = seed[key] || Object.entries(seed).find(([k]) => k !== '_meta' && (key.includes(k) || k.includes(key)))?.[1];
  if (!row || typeof row !== 'object') return null;
  return { ...row, source: 'seed', key };
}

async function fdcSearch(query) {
  if (!config.fdcApiKey) return null;
  const cacheKey = `fdc:${query}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const url = new URL(`${config.fdcBaseUrl}/foods/search`);
  url.searchParams.set('api_key', config.fdcApiKey);
  url.searchParams.set('query', query);
  url.searchParams.set('pageSize', '1');
  url.searchParams.set('dataType', 'Foundation,SR Legacy');

  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn('fdc_search_failed', { status: res.status, query });
      return null;
    }
    const json = await res.json();
    const food = json.foods?.[0];
    if (!food) return null;
    const nutrients = food.foodNutrients || [];
    const find = (names) => {
      const n = nutrients.find((x) =>
        names.some((name) => String(x.nutrientName || x.nutrient?.name || '').toLowerCase().includes(name)),
      );
      return n?.value ?? n?.amount ?? null;
    };
    const kcal = find(['energy']) ?? find(['calorie']);
    const out = {
      key: query,
      kcal: kcal != null ? Number(kcal) : null,
      protein: find(['protein']),
      carbs: find(['carbohydrate']),
      fat: find(['total lipid', 'fat']),
      per: '100g',
      fdcId: food.fdcId,
      description: food.description,
      source: 'fdc',
    };
    cache.set(cacheKey, out);
    return out;
  } catch (err) {
    logger.warn('fdc_error', { err: String(err.message || err) });
    return null;
  }
}

export async function nutritionForIngredient(ingredient) {
  const key = normalizeKey(ingredient);
  if (!key) return null;
  const factor = qtyFactor(ingredient);
  let row = await fdcSearch(key.replace(/_/g, ' '));
  if (!row?.kcal) row = await seedLookup(key);
  if (!row?.kcal) return { key, kcal: null, missing: true, source: 'none' };
  return {
    key,
    kcal: Math.round(Number(row.kcal) * factor),
    protein: row.protein != null ? Math.round(Number(row.protein) * factor * 10) / 10 : null,
    carbs: row.carbs != null ? Math.round(Number(row.carbs) * factor * 10) / 10 : null,
    fat: row.fat != null ? Math.round(Number(row.fat) * factor * 10) / 10 : null,
    source: row.source,
    fdcId: row.fdcId,
  };
}

export async function nutritionForRecipe(recipe) {
  const ingredients = recipe?.ingredients || [];
  const lines = [];
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let known = 0;
  for (const ing of ingredients) {
    const n = await nutritionForIngredient(ing);
    lines.push(n);
    if (n?.kcal != null) {
      kcal += n.kcal;
      protein += n.protein || 0;
      carbs += n.carbs || 0;
      fat += n.fat || 0;
      known += 1;
    }
  }
  const servings = Number(recipe.estServings || recipe.servings || 2) || 2;
  return {
    totalKcal: Math.round(kcal),
    perServingKcal: Math.round(kcal / servings),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    coverage: ingredients.length ? known / ingredients.length : 0,
    lines,
    servings,
  };
}

export async function nutritionForPlan(plan) {
  const days = plan?.days || [];
  const meals = [];
  let totalKcal = 0;
  for (const day of days) {
    for (const m of day.meals || []) {
      const nut = await nutritionForRecipe(m);
      totalKcal += nut.totalKcal || 0;
      meals.push({
        day: day.day,
        meal: m.meal,
        recipeId: m.recipeId,
        title: m.title,
        nutrition: nut,
      });
    }
  }
  const dayCount = Math.max(1, days.length);
  return {
    totalKcal: Math.round(totalKcal),
    avgDailyKcal: Math.round(totalKcal / dayCount),
    meals,
  };
}
