import test from 'node:test';
import assert from 'node:assert/strict';
import { noveltyPenalty, scoreRecipe, updateTaste } from '../src/services/prefs/learn.js';

test('updateTaste moves toward signal', () => {
  const t = updateTaste({}, ['budget'], 1, 1);
  assert.equal(t.budget, 1);
});

test('noveltyPenalty is zero for unseen recipes', () => {
  assert.equal(noveltyPenalty('r_new', ['r_old']), 0);
});

test('scoreRecipe rejects allergens', () => {
  const r = scoreRecipe({
    recipe: { id: 'x', title: 'X', tags: [], allergens: ['dairy'], ingredients: [] },
    prefs: { allergies: ['dairy'], likes: [], taste: {}, recentRecipeIds: [] },
  });
  assert.equal(r.ok, false);
});
