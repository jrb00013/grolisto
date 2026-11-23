import { config } from '../../lib/config.js';
import { loadPrefs, savePrefs } from './store.js';

/** Exponential smoothing on taste tags; novelty from recent recipe ids. */

export function updateTaste(taste = {}, tags = [], signal = 1, lr = 0.2) {
  const next = { ...taste };
  for (const tag of tags) {
    const k = String(tag).toLowerCase();
    const prev = Number(next[k] || 0);
    next[k] = prev + lr * (signal - prev);
  }
  return next;
}

export function noveltyPenalty(recipeId, recentRecipeIds = [], decay = config.noveltyDecay) {
  const idx = recentRecipeIds.indexOf(recipeId);
  if (idx === -1) return 0;
  // More recent → higher penalty
  const age = recentRecipeIds.length - idx;
  return Math.pow(decay, age - 1);
}

export function scoreRecipe({ recipe, prefs, floor = config.noveltyFloor }) {
  const tags = recipe.tags || [];
  const taste = prefs.taste || {};
  let util = 0;
  for (const t of tags) util += Number(taste[String(t).toLowerCase()] || 0);
  const ingText = (recipe.ingredients || [])
    .map((i) => (typeof i === 'string' ? i : [i?.key, i?.name, i?.term].filter(Boolean).join(' ')))
    .join(' ')
    .toLowerCase();
  for (const like of prefs.likes || []) {
    const needle = String(like).toLowerCase();
    if (recipe.title?.toLowerCase().includes(needle)) util += 0.5;
    if (ingText.includes(needle.replace(/\s+/g, '_')) || ingText.includes(needle)) util += 0.35;
    if ((recipe.tags || []).some((t) => String(t).toLowerCase().includes(needle))) util += 0.25;
  }
  for (const d of prefs.dislikes || []) {
    const needle = String(d).toLowerCase();
    if (recipe.title?.toLowerCase().includes(needle)) util -= 0.8;
    if (ingText.includes(needle)) util -= 1.2;
    if ((recipe.tags || []).some((t) => String(t).toLowerCase().includes(needle))) util -= 0.5;
  }
  const allergens = new Set((prefs.allergies || []).map((a) => String(a).toLowerCase()));
  if ((recipe.allergens || []).some((a) => allergens.has(String(a).toLowerCase()))) {
    return { ok: false, score: -Infinity, reason: 'allergy' };
  }
  const nov = noveltyPenalty(recipe.id, prefs.recentRecipeIds || []);
  const score = util - Math.max(floor, nov);
  return { ok: true, score, novelty: nov, util };
}

export async function recordFeedback(userId, { recipeId, tags = [], liked }) {
  const prefs = await loadPrefs(userId);
  prefs.taste = updateTaste(prefs.taste, tags, liked ? 1 : -1);
  if (liked) {
    prefs.likes = [...new Set([...(prefs.likes || []), ...(tags || [])])];
  } else {
    prefs.dislikes = [...new Set([...(prefs.dislikes || []), recipeId].filter(Boolean))];
  }
  return savePrefs(userId, prefs);
}

export async function recordPlan(userId, recipeIds = []) {
  const prefs = await loadPrefs(userId);
  const recent = [...recipeIds, ...(prefs.recentRecipeIds || [])].slice(0, 64);
  const weeklyHistory = [
    { at: new Date().toISOString(), recipeIds },
    ...(prefs.weeklyHistory || []),
  ].slice(0, 12);
  return savePrefs(userId, { ...prefs, recentRecipeIds: recent, weeklyHistory });
}
