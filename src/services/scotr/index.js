import { config } from '../../lib/config.js';
import { createTtlCache } from './cache.js';
import { loadMockCatalog } from './mockCatalog.js';
import { krogerFindStores, krogerSearchProducts } from './kroger.js';

const cache = createTtlCache({ ttlMs: config.scotrCacheTtlMs });

function normalizeIngredientKey(ingredient) {
  if (ingredient == null) return '';
  if (typeof ingredient === 'string') {
    return ingredient.trim().toLowerCase().replace(/\s+/g, '_');
  }
  const raw = ingredient.key ?? ingredient.name ?? ingredient.term ?? '';
  return String(raw).trim().toLowerCase().replace(/\s+/g, '_');
}

function ingredientTerm(ingredient) {
  if (typeof ingredient === 'string') return ingredient;
  return ingredient.key ?? ingredient.name ?? ingredient.term ?? String(ingredient);
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function mockFindNearbyStores({ zip, lat, lng, radiusMiles, limit } = {}) {
  const { stores } = await loadMockCatalog();
  let list = [...stores];

  const useZip = zip || (lat == null && lng == null ? config.scotrDefaultZip : undefined);
  if (useZip) {
    const matched = list.filter((s) => String(s.zip) === String(useZip));
    if (matched.length) list = matched;
  }

  if (lat != null && lng != null) {
    list = list.map((s) => ({
      ...s,
      distanceMiles:
        s.lat != null && s.lng != null
          ? haversineMiles(lat, lng, s.lat, s.lng)
          : s.distanceMiles,
    }));
    list.sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity));
    if (radiusMiles != null) {
      list = list.filter((s) => (s.distanceMiles ?? Infinity) <= radiusMiles);
    }
  } else {
    list.sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity));
  }

  if (limit != null) list = list.slice(0, limit);
  return list.map((s) => ({ ...s, source: 'mock' }));
}

async function liveFindNearbyStores({ zip, lat, lng, radiusMiles, limit } = {}) {
  return krogerFindStores({
    zip: zip || (lat == null && lng == null ? config.scotrDefaultZip : zip),
    lat,
    lng,
    ...(radiusMiles != null ? { radiusMiles } : {}),
    ...(limit != null ? { limit } : {}),
  });
}

/**
 * @param {{ zip?: string, lat?: number, lng?: number, radiusMiles?: number, limit?: number }} opts
 */
export async function findNearbyStores(opts = {}) {
  const key = `stores:${JSON.stringify(opts)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const stores = config.scotrUseMock
    ? await mockFindNearbyStores(opts)
    : await liveFindNearbyStores(opts);

  cache.set(key, stores);
  return stores;
}

function lookupMockPrice(prices, storeId, ingredientKey) {
  const storeMap = prices[storeId] || {};
  const fallback = prices._default || {};
  const row = storeMap[ingredientKey] ?? fallback[ingredientKey];
  if (!row) return null;
  return {
    ingredient: ingredientKey,
    matchedName: row.product ?? ingredientKey,
    price: row.price,
    unit: row.unit,
    product: row.product,
    inStock: true,
    source: 'mock',
    confidence: storeMap[ingredientKey] ? 1 : 0.6,
  };
}

async function mockGetPrices(storeId, ingredients) {
  const { prices } = await loadMockCatalog();
  return ingredients.map((ing) => {
    const key = normalizeIngredientKey(ing);
    const found = lookupMockPrice(prices, storeId, key);
    if (found) return found;
    return {
      ingredient: key || ingredientTerm(ing),
      matchedName: null,
      price: null,
      unit: null,
      product: null,
      inStock: false,
      source: 'mock',
      confidence: 0,
      missing: true,
    };
  });
}

async function liveGetPrices(storeId, ingredients) {
  const results = [];
  for (const ing of ingredients) {
    const term = ingredientTerm(ing);
    const key = normalizeIngredientKey(ing);
    const products = await krogerSearchProducts({ locationId: storeId, term, limit: 1 });
    const top = products[0];
    if (!top || top.price == null) {
      results.push({
        ingredient: key || term,
        matchedName: top?.description ?? null,
        price: null,
        unit: top?.size ?? null,
        product: top?.description ?? null,
        inStock: false,
        source: 'kroger',
        confidence: 0,
        missing: true,
      });
      continue;
    }
    results.push({
      ingredient: key || term,
      matchedName: top.description,
      upc: top.productId,
      price: top.price,
      unit: top.size,
      product: top.description,
      inStock: top.stockLevel !== 'TEMPORARILY_OUT_OF_STOCK',
      observedAt: new Date().toISOString(),
      source: 'kroger',
      confidence: 0.9,
    });
  }
  return results;
}

/**
 * @param {string} storeId
 * @param {Array<string|{key?:string,name?:string,term?:string}>} ingredients
 */
export async function getPrices(storeId, ingredients = []) {
  const keys = ingredients.map(normalizeIngredientKey);
  const cacheKey = `prices:${storeId}:${keys.join(',')}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const lines = config.scotrUseMock
    ? await mockGetPrices(storeId, ingredients)
    : await liveGetPrices(storeId, ingredients);

  cache.set(cacheKey, lines);
  return lines;
}

/**
 * @param {string[]} storeIds
 * @param {Array<string|{key?:string,name?:string,term?:string}>} ingredients
 */
export async function compareStores(storeIds = [], ingredients = []) {
  const byStore = {};
  let cheapestStoreId = null;
  let cheapestSubtotal = Infinity;
  let maxSubtotal = -Infinity;

  for (const storeId of storeIds) {
    const lines = await getPrices(storeId, ingredients);
    const missing = lines.filter((l) => l.missing || l.price == null).map((l) => l.ingredient);
    const subtotal = lines.reduce((sum, l) => sum + (typeof l.price === 'number' ? l.price : 0), 0);
    byStore[storeId] = { lines, subtotal, missing };

    if (missing.length === 0 && subtotal < cheapestSubtotal) {
      cheapestSubtotal = subtotal;
      cheapestStoreId = storeId;
    }
    if (subtotal > maxSubtotal) maxSubtotal = subtotal;
  }

  const savingsVsMax =
    cheapestStoreId != null && maxSubtotal > -Infinity
      ? Math.max(0, maxSubtotal - cheapestSubtotal)
      : 0;

  return { byStore, cheapestStoreId, savingsVsMax };
}

export function clearScotrCache() {
  cache.clear();
}
