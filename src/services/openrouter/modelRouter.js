import { config } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { openRouterChat } from './client.js';

/**
 * OpenRouter tier router for Grolisto.
 * Complexity ∈ [0,1] from task signals; model IDs come only from env (ROUTE_*).
 */

export function scoreComplexity(task = {}) {
  const {
    days = 1,
    mealSlots = [],
    allergyCount = 0,
    likedCount = 0,
    storeCount = 1,
    chatTurns = 0,
    force = null,
  } = task;

  if (force === 'simple' || force === 'standard' || force === 'complex') {
    return force === 'simple' ? 0.2 : force === 'standard' ? 0.5 : 0.9;
  }

  const slotN = Array.isArray(mealSlots) ? mealSlots.length : 0;
  const mealLoad = Math.min(1, (days * Math.max(1, slotN)) / 21);
  const constraintLoad = Math.min(1, (allergyCount + likedCount * 0.15) / 8);
  const storeLoad = Math.min(1, (storeCount - 1) * 0.2);
  const chatLoad = Math.min(1, chatTurns / 12);

  const score =
    0.4 * mealLoad + 0.25 * constraintLoad + 0.15 * storeLoad + 0.2 * chatLoad;
  return Math.max(0, Math.min(1, score));
}

export function pickModel(complexity) {
  const c = Number(complexity);
  if (Number.isNaN(c)) throw new Error('complexity must be a number');
  if (c <= config.routeSimpleMax) return { tier: 'simple', model: config.routeSimpleModel };
  if (c <= config.routeStandardMax) return { tier: 'standard', model: config.routeStandardModel };
  return { tier: 'complex', model: config.routeComplexModel };
}

export async function routedChat({ task, messages, temperature, responseFormat }) {
  const complexity = scoreComplexity(task);
  let { tier, model } = pickModel(complexity);

  logger.info('model_route', { complexity, tier, model });

  try {
    return {
      ...(await openRouterChat({ model, messages, temperature, responseFormat })),
      tier,
      complexity,
    };
  } catch (err) {
    const fallback = config.routeFallbackModel;
    if (!fallback || fallback === model) throw err;
    logger.warn('model_route_fallback', {
      from: model,
      to: fallback,
      err: String(err.message || err),
    });
    return {
      ...(await openRouterChat({
        model: fallback,
        messages,
        temperature,
        responseFormat,
      })),
      tier: 'fallback',
      complexity,
      fallbackFrom: model,
    };
  }
}
