import test from 'node:test';
import assert from 'node:assert/strict';
import { findNearbyStores, getPrices } from '../src/services/scotr/index.js';

test('findNearbyStores returns mock stores', async () => {
  const stores = await findNearbyStores({ zip: '10001' });
  assert.ok(Array.isArray(stores));
  assert.ok(stores.length > 0);
  assert.ok(stores[0].id);
});

test('getPrices reads seed catalog', async () => {
  const stores = await findNearbyStores({ zip: '10001' });
  const prices = await getPrices(stores[0].id, ['eggs', 'milk']);
  assert.equal(prices.length, 2);
  assert.ok(prices.some((p) => p.price != null));
});
