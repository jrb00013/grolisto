import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';

let client;

export function getQdrant() {
  if (client) return client;
  const opts = { url: config.qdrantUrl };
  if (config.qdrantApiKey) opts.apiKey = config.qdrantApiKey;
  client = new QdrantClient(opts);
  return client;
}

export async function ensureCollections(vectorSize) {
  if (!vectorSize || vectorSize < 1) {
    throw new Error('vectorSize required (from embedding model output)');
  }
  const q = getQdrant();
  const names = [
    config.qdrantRecipes,
    config.qdrantIngredients,
    config.qdrantPrefs,
    config.qdrantPlans,
  ];
  for (const name of names) {
    try {
      await q.getCollection(name);
    } catch {
      logger.info('qdrant_create_collection', { name, vectorSize });
      await q.createCollection(name, {
        vectors: { size: vectorSize, distance: 'Cosine' },
      });
    }
  }
}

export async function upsertPoints(collection, points) {
  const q = getQdrant();
  return q.upsert(collection, { wait: true, points });
}

export async function search(collection, { vector, filter, limit = 12 }) {
  const q = getQdrant();
  return q.search(collection, {
    vector,
    filter,
    limit,
    with_payload: true,
  });
}
