import { config } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { routedChat } from '../openrouter/modelRouter.js';
import { loadPrefs, savePrefs } from '../prefs/store.js';
import { recordFeedback } from '../prefs/learn.js';
import { retrieveRecipes } from '../rag/retrieve.js';
import {
  loadSession,
  saveSession,
  appendMessage,
  mergeWorkingMemory,
  createSession,
} from './sessions.js';
import { buildContextLayers, packMessages, detectIntent } from './contextPack.js';
import { splitAssistantPayload, maybeSummarizeSession, applyMemoryToSession } from './memory.js';

function assertMessage(content) {
  const text = String(content || '').trim();
  if (!text) {
    const err = new Error('message content required');
    err.status = 400;
    throw err;
  }
  if (text.length > config.chatMaxMessageChars) {
    const err = new Error(`message exceeds CHAT_MAX_MESSAGE_CHARS (${config.chatMaxMessageChars})`);
    err.status = 400;
    throw err;
  }
  return text;
}

async function syncPrefsFromPinned(userId, session, prefs) {
  const pinned = session.pinnedFacts || {};
  const next = {
    ...prefs,
    likes: [...new Set([...(prefs.likes || []), ...(pinned.likes || [])])],
    allergies: [...new Set([...(prefs.allergies || []), ...(pinned.allergies || [])])],
    dislikes: [...new Set([...(prefs.dislikes || []), ...(pinned.dislikes || [])])],
  };
  return savePrefs(userId, next);
}

/**
 * Server-owned turn: append user message → pack context → model → memory → persist.
 */
export async function handleUserTurn({
  sessionId,
  userId = 'default',
  content,
  workingMemoryPatch = null,
  feedback = null,
}) {
  if (!config.openRouterApiKey) {
    const err = new Error('OPENROUTER_API_KEY not configured');
    err.status = 503;
    throw err;
  }

  let session = await loadSession(sessionId);
  if (!session) {
    const err = new Error('session not found');
    err.status = 404;
    throw err;
  }
  if (session.userId && userId && session.userId !== userId && session.userId !== 'default') {
    // allow default→user binding on first authed turn
    if (session.userId === 'default') session.userId = userId;
    else {
      const err = new Error('session belongs to another user');
      err.status = 403;
      throw err;
    }
  }

  const text = assertMessage(content);
  if (workingMemoryPatch) mergeWorkingMemory(session, workingMemoryPatch);

  const intent = detectIntent(text);
  session.meta.lastIntent = intent;

  appendMessage(session, { role: 'user', content: text, meta: { intent } });
  await maybeSummarizeSession(session);

  const prefs = await loadPrefs(userId);
  let ragSnippets = [];
  try {
    ragSnippets = await retrieveRecipes({
      query: text,
      meals: session.workingMemory?.meals || [],
      allergies: [
        ...(prefs.allergies || []),
        ...(session.pinnedFacts?.allergies || []),
        ...(session.workingMemory?.allergies || []),
      ],
      likes: [...(prefs.likes || []), ...(session.workingMemory?.likes || [])],
      prefs,
      limit: 5,
    });
  } catch (err) {
    logger.warn('chat_rag_skip', { err: String(err.message || err) });
  }

  let weekCard = null;
  try {
    const { loadCurrentWeek } = await import('../weeks/load.js');
    weekCard = await loadCurrentWeek();
  } catch {
    /* optional */
  }

  const layers = buildContextLayers({ session, prefs, ragSnippets, weekCard });
  const packed = packMessages(layers);

  const routed = await routedChat({
    task: {
      days: session.workingMemory?.days || 1,
      mealSlots: session.workingMemory?.meals || ['dinner'],
      allergyCount: layers.profile.allergies.length,
      likedCount: layers.profile.likes.length,
      chatTurns: session.messages.length,
      force: intent === 'plan_edit' || intent === 'swap' ? 'standard' : null,
    },
    messages: packed.messages,
    temperature: 0.4,
  });

  const { visible, memory } = splitAssistantPayload(routed.content);
  applyMemoryToSession(session, memory);
  appendMessage(session, {
    role: 'assistant',
    content: visible,
    meta: {
      intent: memory?.intent || intent,
      model: routed.model,
      tier: routed.tier,
      memory: memory || null,
    },
  });

  session.meta.lastRoute = {
    model: routed.model,
    tier: routed.tier,
    complexity: routed.complexity,
  };

  await syncPrefsFromPinned(userId, session, prefs);

  if (feedback?.recipeId) {
    await recordFeedback(userId, {
      recipeId: feedback.recipeId,
      tags: feedback.tags || [],
      liked: Boolean(feedback.liked),
    });
  }

  await saveSession(session);

  return {
    sessionId: session.id,
    reply: visible,
    intent: memory?.intent || intent,
    memory: memory || null,
    route: session.meta.lastRoute,
    pack: packed.usage,
    workingMemory: session.workingMemory,
    pinnedFacts: session.pinnedFacts,
    summary: session.rollingSummary || null,
  };
}

export async function openSession({ userId, workingMemory, title } = {}) {
  return createSession({ userId, workingMemory, title });
}

export async function patchSessionContext(sessionId, { userId, workingMemory }) {
  const session = await loadSession(sessionId);
  if (!session) {
    const err = new Error('session not found');
    err.status = 404;
    throw err;
  }
  if (userId) session.userId = userId;
  if (workingMemory) mergeWorkingMemory(session, workingMemory);
  // Auto-title from first useful signal
  if (!session.title || session.title === 'Kitchen chat') {
    const bits = [
      workingMemory?.zip,
      workingMemory?.budget != null ? `$${workingMemory.budget}` : null,
    ].filter(Boolean);
    if (bits.length) session.title = `Plan ${bits.join(' · ')}`;
  }
  return saveSession(session);
}
