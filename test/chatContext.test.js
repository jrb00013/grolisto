import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptySession, appendMessage, mergeWorkingMemory } from '../src/services/chat/sessions.js';
import { buildContextLayers, packMessages, detectIntent } from '../src/services/chat/contextPack.js';
import { splitAssistantPayload } from '../src/services/chat/memory.js';
import { estimateTokens } from '../src/services/chat/tokenize.js';

test('detectIntent classifies swaps and allergies', () => {
  assert.equal(detectIntent('swap Friday dinner'), 'swap');
  assert.equal(detectIntent("I'm allergic to peanuts"), 'preference');
});

test('packMessages stays within token budget', () => {
  const session = createEmptySession({ userId: 't' });
  mergeWorkingMemory(session, { budget: 80, days: 5, meals: ['dinner'], storeId: 's1' });
  for (let i = 0; i < 40; i += 1) {
    appendMessage(session, { role: i % 2 ? 'assistant' : 'user', content: `turn ${i} ${'x'.repeat(200)}` });
  }
  const layers = buildContextLayers({
    session,
    prefs: { likes: ['beans'], allergies: ['shellfish'], recentRecipeIds: ['r1'] },
  });
  const budget = 800;
  const packed = packMessages(layers, { budgetTokens: budget, recentTurns: 12 });
  assert.ok(packed.usage.estimatedTokens <= budget + 20);
  assert.ok(packed.messages.some((m) => m.role === 'system'));
  assert.ok(packed.messages.some((m) => m.role === 'user' || m.role === 'assistant'));
});

test('splitAssistantPayload extracts memory JSON', () => {
  const raw = `Try black bean tacos Friday.\n\`\`\`json\n{"type":"grolisto.memory","intent":"swap","prefsUpdate":{"likes":["beans"],"allergies":[],"dislikes":[]}}\n\`\`\``;
  const { visible, memory } = splitAssistantPayload(raw);
  assert.match(visible, /black bean/i);
  assert.equal(memory.intent, 'swap');
  assert.deepEqual(memory.prefsUpdate.likes, ['beans']);
});

test('estimateTokens scales with length', () => {
  assert.ok(estimateTokens('abcd') >= 1);
  assert.ok(estimateTokens('a'.repeat(40)) >= estimateTokens('a'.repeat(8)));
});
