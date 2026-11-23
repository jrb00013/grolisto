import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { openRouterChat, openRouterEmbed } from '../openrouter/client.js';
import { search } from './qdrant.js';
import { scoreRecipe } from '../prefs/learn.js';

const seedPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../data/seed/recipes.json',
);

async function loadSeedRecipes() {
  return JSON.parse(await readFile(seedPath, 'utf8'));
}

function keywordFilter(recipes, { meals = [], allergies = [], query = '' }) {
  const allergySet = new Set(allergies.map((a) => String(a).toLowerCase()));
  const mealSet = new Set(meals.map((m) => String(m).toLowerCase()));
  const q = String(query || '').toLowerCase();
  return recipes.filter((r) => {
    if (mealSet.size && !(r.meals || []).some((m) => mealSet.has(String(m).toLowerCase()))) {
      return false;
    }
    if ((r.allergens || []).some((a) => allergySet.has(String(a).toLowerCase()))) return false;
    if (!q) return true;
    const blob = `${r.title} ${(r.tags || []).join(' ')} ${(r.ingredients || []).join(' ')}`.toLowerCase();
    return blob.includes(q) || q.split(/\s+/).some((t) => t && blob.includes(t));
  });
}

async function llmRerank(candidates, query) {
  if (!config.openRouterApiKey || candidates.length <= 1) return candidates;
  try {
    const list = candidates
      .slice(0, 20)
      .map((c, i) => `${i}: ${c.title} [${(c.tags || []).join(',')}]`)
      .join('\n');
    const { content } = await openRouterChat({
      model: config.rerankModel,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'Rerank recipe candidates for the user query. Reply JSON only: {"order":[indices best-first]}',
        },
        { role: 'user', content: `Query: ${query}\nCandidates:\n${list}` },
      ],
    });
    const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
    const order = parsed.order || [];
    const reranked = order.map((i) => candidates[i]).filter(Boolean);
    const rest = candidates.filter((c) => !reranked.includes(c));
    return [...reranked, ...rest];
  } catch (err) {
    logger.warn('rerank_fallback', { err: String(err.message || err) });
    return candidates;
  }
}

/**
 * State-of-the-art-ish pragmatic retrieve:
 * seed/keyword → optional dense Qdrant → preference score → LLM rerank.
 */
export async function retrieveRecipes({
  query = '',
  meals = [],
  allergies = [],
  likes = [],
  prefs = {},
  limit = 12,
} = {}) {
  const seed = await loadSeedRecipes();
  let candidates = keywordFilter(seed, {
    meals,
    allergies: [...allergies, ...(prefs.allergies || [])],
    query: [query, ...(likes || [])].join(' '),
  });

  if (config.openRouterApiKey) {
    try {
      const vector = await openRouterEmbed({
        model: config.embeddingModel,
        input: [query, meals.join(' '), likes.join(' ')].filter(Boolean).join(' | '),
      });
      if (vector?.length) {
        const hits = await search(config.qdrantRecipes, {
          vector,
          limit: Math.max(limit, 16),
          filter: meals.length
            ? {
                must: [
                  {
                    key: 'meals',
                    match: { any: meals },
                  },
                ],
              }
            : undefined,
        });
        const byId = new Map(candidates.map((c) => [c.id, c]));
        for (const h of hits) {
          const payload = h.payload || {};
          if (payload.id && !byId.has(payload.id)) byId.set(payload.id, payload);
        }
        candidates = [...byId.values()];
      }
    } catch (err) {
      logger.warn('dense_retrieve_skip', { err: String(err.message || err) });
    }
  }

  const mergedPrefs = {
    ...prefs,
    allergies: [...new Set([...(prefs.allergies || []), ...allergies])],
    likes: [...new Set([...(prefs.likes || []), ...likes])],
  };

  candidates = candidates
    .map((r) => ({ recipe: r, ...scoreRecipe({ recipe: r, prefs: mergedPrefs }) }))
    .filter((x) => x.ok)
    .sort((a, b) => b.score - a.score)
    .map((x) => ({ ...x.recipe, _score: x.score, _novelty: x.novelty }));

  candidates = await llmRerank(candidates, query || likes.join(' ') || meals.join(' '));
  return candidates.slice(0, limit);
}
