import test from 'node:test';
import assert from 'node:assert/strict';
import { allocatePlan } from '../src/services/planner/allocate.js';

test('allocatePlan fills slots under budget offline', async () => {
  const out = await allocatePlan({
    budget: 60,
    days: 2,
    meals: ['dinner'],
    allergies: ['shellfish'],
    likes: ['beans'],
    storeId: 'store_tj_chelsea',
    zip: '10001',
    userId: 'test-planner',
  });
  assert.equal(out.allocation.slotCount, 2);
  assert.ok((out.plan.days || []).length >= 1);
  assert.ok(out.plan.totals.estimatedSpend <= 60 * 1.05);
});
