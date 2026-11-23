import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreComplexity, pickModel } from '../src/services/openrouter/modelRouter.js';
import { config } from '../src/lib/config.js';

test('scoreComplexity rises with meal load', () => {
  const low = scoreComplexity({ days: 1, mealSlots: ['dinner'] });
  const high = scoreComplexity({
    days: 7,
    mealSlots: ['breakfast', 'lunch', 'dinner'],
    allergyCount: 4,
  });
  assert.ok(high > low);
});

test('pickModel uses env tiers only', () => {
  const simple = pickModel(0);
  assert.equal(simple.model, config.routeSimpleModel);
  const complex = pickModel(1);
  assert.equal(complex.model, config.routeComplexModel);
});
