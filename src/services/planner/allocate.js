import { config } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { retrieveRecipes } from '../rag/retrieve.js';
import { getPrices } from '../scotr/index.js';
import { routedChat } from '../openrouter/modelRouter.js';
import { loadPrefs, savePrefs } from '../prefs/store.js';
import { noveltyPenalty, scoreRecipe, recordPlan } from '../prefs/learn.js';

/**
 * Budget allocation math (see docs/MATH.md):
 *   N = days * |meals|
 *   perMealBudget = budget / N
 * Hard: allergy filter, coverage of every slot, C ≤ B
 * Soft: novelty from prefs (decay/floor from config)
 */

function buildSlots(days, meals) {
  const slots = [];
  for (let d = 1; d <= days; d += 1) {
    for (const meal of meals) {
      slots.push({ day: d, meal });
    }
  }
  return slots;
}

function intersectsAllergy(recipe, allergies) {
  if (!allergies?.length) return false;
  const set = new Set(allergies.map((a) => String(a).toLowerCase().trim()));
  const allergens = (recipe.allergens || recipe.payload?.allergens || []).map((a) =>
    String(a).toLowerCase().trim(),
  );
  const tags = (recipe.tags || recipe.payload?.tags || []).map((t) =>
    String(t).toLowerCase().trim(),
  );
  const title = String(recipe.title || recipe.payload?.title || '').toLowerCase();
  const ingredients = (recipe.ingredients || recipe.payload?.ingredients || []).map((i) =>
    String(i).toLowerCase(),
  );

  for (const a of set) {
    if (!a) continue;
    if (allergens.some((x) => x.includes(a) || a.includes(x))) return true;
    if (tags.some((x) => x.includes(a))) return true;
    if (title.includes(a)) return true;
    if (ingredients.some((x) => x.includes(a))) return true;
  }
  return false;
}

function recipeId(r) {
  return String(r.id || r.payload?.id || r.title || r.payload?.title || '');
}

function normalizeCandidate(r) {
  const payload = r.payload || r;
  return {
    id: recipeId(r),
    title: payload.title || r.title || recipeId(r),
    meals: payload.meals || r.meals || [],
    ingredients: payload.ingredients || r.ingredients || [],
    tags: payload.tags || r.tags || [],
    allergens: payload.allergens || r.allergens || [],
    steps: payload.steps || r.steps || [],
    estServings: payload.estServings || r.estServings || 2,
    score: r.score ?? r.rerankScore ?? 0,
  };
}

function ingredientKey(ing) {
  if (ing == null) return '';
  if (typeof ing === 'string') return ing.toLowerCase().trim().replace(/\s+/g, '_');
  const raw = ing.key ?? ing.name ?? ing.term ?? '';
  return String(raw).toLowerCase().trim().replace(/\s+/g, '_');
}

function estimateRecipeCost(recipe, priceRows) {
  const byIng = new Map(
    (priceRows || []).map((p) => [String(p.ingredient).toLowerCase().trim().replace(/\s+/g, '_'), p]),
  );
  let total = 0;
  let priced = 0;
  for (const ing of recipe.ingredients || []) {
    const key = ingredientKey(ing);
    const hit =
      byIng.get(key) ||
      [...byIng.entries()].find(([k]) => key.includes(k) || k.includes(key))?.[1];
    if (hit?.price != null && Number.isFinite(Number(hit.price))) {
      total += Number(hit.price);
      priced += 1;
    }
  }
  return { cost: priced ? total : null, priced, totalIngredients: (recipe.ingredients || []).length };
}

function parsePlanJson(content) {
  if (!content) return null;
  const trimmed = String(content).trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) {
      try {
        return JSON.parse(fence[1].trim());
      } catch {
        /* fall through */
      }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * @param {{
 *   budget: number,
 *   days: number,
 *   meals: string[],
 *   allergies?: string[],
 *   likes?: string[],
 *   storeId: string,
 *   zip?: string,
 *   notes?: string,
 *   userId?: string,
 * }} input
 */
export async function allocatePlan(input) {
  const {
    budget,
    days,
    meals,
    allergies = [],
    likes = [],
    storeId,
    zip,
    notes = '',
    userId = 'default',
  } = input;

  const slots = buildSlots(days, meals);
  const slotCount = slots.length;
  if (slotCount === 0) throw Object.assign(new Error('no meal slots'), { status: 400 });

  const perMealBudget = budget / slotCount;
  const prefs = await loadPrefs(userId);

  const mergedAllergies = [
    ...new Set([...(prefs.allergies || []), ...allergies].map((a) => String(a).trim()).filter(Boolean)),
  ];
  const mergedLikes = [
    ...new Set([...(prefs.likes || []), ...likes].map((l) => String(l).trim()).filter(Boolean)),
  ];

  const queryParts = [
    `meal plan for ${days} days`,
    `meals: ${meals.join(', ')}`,
    mergedLikes.length ? `likes: ${mergedLikes.join(', ')}` : '',
    mergedAllergies.length ? `avoid allergens: ${mergedAllergies.join(', ')}` : '',
    notes,
  ].filter(Boolean);

  let retrieved = [];
  try {
    retrieved = await retrieveRecipes({
      query: queryParts.join('. '),
      meals,
      allergies: mergedAllergies,
      likes: mergedLikes,
      prefs,
      limit: Math.max(24, slotCount * 4),
    });
  } catch (err) {
    logger.warn('rag_retrieve_failed', { err: String(err?.message || err) });
    retrieved = [];
  }

  const recentIds = prefs.recentRecipeIds || [];
  const candidates = (Array.isArray(retrieved) ? retrieved : [])
    .map(normalizeCandidate)
    .filter((r) => r.id && !intersectsAllergy(r, mergedAllergies))
    .map((r) => {
      const scored = scoreRecipe({
        recipe: r,
        prefs: { ...prefs, allergies: mergedAllergies, likes: mergedLikes },
        floor: config.noveltyFloor,
      });
      const penalty = noveltyPenalty(r.id, recentIds, config.noveltyDecay);
      const base = scored.ok ? scored.score : (r._score ?? r.score ?? 0) - penalty;
      return {
        ...r,
        noveltyPenalty: penalty,
        adjustedScore: Number.isFinite(base) ? base : -penalty,
      };
    })
    .filter((r) => Number.isFinite(r.adjustedScore))
    .sort((a, b) => b.adjustedScore - a.adjustedScore);

  const allIngredients = [
    ...new Set(candidates.flatMap((c) => c.ingredients || []).map(ingredientKey).filter(Boolean)),
  ].slice(0, 80);

  let prices = [];
  try {
    prices = await getPrices(storeId, allIngredients);
  } catch (err) {
    logger.warn('scotr_prices_failed', { err: String(err?.message || err) });
    prices = [];
  }

  const pricedCandidates = candidates.map((c) => {
    const est = estimateRecipeCost(c, prices);
    return { ...c, estimatedCost: est.cost, priceCoverage: est };
  });

  const candidateBrief = pricedCandidates.slice(0, 30).map((c) => ({
    id: c.id,
    title: c.title,
    meals: c.meals,
    ingredients: c.ingredients,
    tags: c.tags,
    estimatedCost: c.estimatedCost,
    noveltyPenalty: c.noveltyPenalty,
    adjustedScore: c.adjustedScore,
  }));

  const allocation = {
    budget,
    days,
    meals,
    slotCount,
    perMealBudget: Math.round(perMealBudget * 100) / 100,
    targetCostIntensity: 0.9,
    noveltyDecay: config.noveltyDecay,
    noveltyFloor: config.noveltyFloor,
  };

  const system = [
    'You are Grolisto meal planner. Return ONLY valid JSON (no markdown).',
    'Fill every meal slot exactly once. Respect allergies as hard constraints.',
    'Prefer candidates with lower noveltyPenalty and estimatedCost near perMealBudget.',
    'Weekly ingredient spend must stay ≤ budget. Prefer κ = C/B near 0.9.',
    'Schema: {"days":[{"day":1,"meals":[{"meal":"lunch","recipeId":"...","title":"...","ingredients":[],"estCost":0}]}],"groceryList":[{"ingredient":"...","estPrice":0}],"totals":{"estimatedSpend":0,"budget":0,"slack":0,"kappa":0},"notes":"..."}',
  ].join('\n');

  const userMsg = {
    allocation,
    allergies: mergedAllergies,
    likes: mergedLikes,
    storeId,
    zip: zip || null,
    notes,
    slots,
    candidates: candidateBrief,
    priceSample: (prices || []).slice(0, 40),
  };

  function greedyPlan() {
    let spend = 0;
    const used = new Set();
    const byDay = new Map();
    for (const slot of slots) {
      const pool = pricedCandidates
        .filter((r) => !r.meals?.length || r.meals.includes(slot.meal))
        .filter((r) => r.estimatedCost == null || spend + r.estimatedCost <= budget * 1.02)
        .sort((a, b) => {
          const ua = used.has(a.id) ? 1 : 0;
          const ub = used.has(b.id) ? 1 : 0;
          if (ua !== ub) return ua - ub;
          return (b.adjustedScore || 0) - (a.adjustedScore || 0);
        });
      const pick = pool[0] || pricedCandidates.find((r) => !r.meals?.length || r.meals.includes(slot.meal)) || pricedCandidates[0];
      if (!pick) continue;
      used.add(pick.id);
      const cost = Number(pick.estimatedCost || 0);
      spend += cost;
      if (!byDay.has(slot.day)) byDay.set(slot.day, []);
      byDay.get(slot.day).push({
        meal: slot.meal,
        recipeId: pick.id,
        title: pick.title,
        ingredients: pick.ingredients,
        estCost: pick.estimatedCost,
      });
    }
    const groceryMap = new Map();
    for (const dayMeals of byDay.values()) {
      for (const m of dayMeals) {
        for (const ing of m.ingredients || []) {
          const key = String(ing).toLowerCase();
          if (!groceryMap.has(key)) {
            const row = (prices || []).find((p) => String(p.ingredient).toLowerCase().includes(key) || key.includes(String(p.ingredient).toLowerCase()));
            groceryMap.set(key, { ingredient: ing, estPrice: row?.price ?? null });
          }
        }
      }
    }
    const kappa = budget ? spend / budget : null;
    return {
      days: [...byDay.entries()].map(([day, meals]) => ({ day, meals })),
      groceryList: [...groceryMap.values()],
      totals: {
        estimatedSpend: Math.round(spend * 100) / 100,
        budget,
        slack: Math.round((budget - spend) * 100) / 100,
        kappa: kappa == null ? null : Math.round(kappa * 1000) / 1000,
      },
      notes: 'Local greedy allocation (no OpenRouter key or LLM fallback).',
    };
  }

  let chat = { content: '', model: null, tier: 'local', complexity: null };
  let plan = null;
  if (config.openRouterApiKey) {
    try {
      chat = await routedChat({
        task: {
          days,
          mealSlots: meals,
          allergyCount: mergedAllergies.length,
          likedCount: mergedLikes.length,
          storeCount: 1,
          force: slotCount >= 14 || mergedAllergies.length >= 3 ? 'complex' : null,
        },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(userMsg) },
        ],
        temperature: 0.3,
        responseFormat: { type: 'json_object' },
      });
      plan = parsePlanJson(chat.content);
    } catch (err) {
      logger.warn('plan_llm_failed', { err: String(err?.message || err) });
    }
  }
  if (!plan || !(plan.days || []).length) {
    plan = greedyPlan();
  }

  // Persist recent recipe ids for novelty on next plan
  const usedIds = [];
  for (const day of plan.days || []) {
    for (const m of day.meals || []) {
      if (m.recipeId) usedIds.push(String(m.recipeId));
    }
  }
  let nextPrefs = prefs;
  if (usedIds.length) {
    nextPrefs = await recordPlan(userId, usedIds);
  }
  await savePrefs(userId, {
    ...nextPrefs,
    allergies: mergedAllergies,
    likes: mergedLikes,
  });

  return {
    allocation,
    plan,
    meta: {
      candidateCount: pricedCandidates.length,
      priceRows: prices.length,
      model: chat.model,
      tier: chat.tier,
      complexity: chat.complexity,
    },
  };
}

/** Alias for callers that expect buildPlan */
export const buildPlan = allocatePlan;
export default allocatePlan;
