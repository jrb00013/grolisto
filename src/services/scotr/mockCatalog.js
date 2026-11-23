import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../data/seed');

let cached;

/** Load Scotr mock catalog from data/seed JSON — prices not in source. */
export async function loadMockCatalog() {
  if (cached) return cached;
  const [storesRaw, pricesRaw] = await Promise.all([
    readFile(path.join(root, 'stores.json'), 'utf8'),
    readFile(path.join(root, 'prices.json'), 'utf8'),
  ]);
  cached = {
    stores: JSON.parse(storesRaw),
    prices: JSON.parse(pricesRaw),
  };
  return cached;
}

export function clearMockCatalogCache() {
  cached = undefined;
}
