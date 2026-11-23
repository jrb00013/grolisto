import { config } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { routedChat } from '../openrouter/modelRouter.js';
import { mergePinnedFacts } from './sessions.js';

/**
 * Parse trailing ```json grolisto.memory block from model output.
 */
export function splitAssistantPayload(raw = '') {
  const text = String(raw);
  const fence = text.match(/```json\s*([\s\S]*?)```/i);
  let memory = null;
  let visible = text;
  if (fence) {
    visible = text.replace(fence[0], '').trim();
    try {
      const parsed = JSON.parse(fence[1]);
      if (parsed && (parsed.type === 'grolisto.memory' || parsed.prefsUpdate || parsed.intent)) {
        memory = parsed;
      }
    } catch {
      /* ignore */
    }
  }
  // fallback: bare prefsUpdate JSON line
  if (!memory) {
    const m = text.match(/\{"prefsUpdate"\s*:\s*\{[\s\S]*?\}\s*\}/);
    if (m) {
      try {
        memory = { type: 'grolisto.memory', ...JSON.parse(m[0]) };
        visible = text.replace(m[0], '').trim();
      } catch {
        /* ignore */
      }
    }
  }
  return { visible: visible || text.trim(), memory };
}

/**
 * When history grows past CHAT_SUMMARY_TRIGGER_TURNS, compress older turns
 * into rollingSummary (uses cheapest route tier via force:simple).
 */
export async function maybeSummarizeSession(session) {
  const trigger = config.chatSummaryTriggerTurns;
  const keep = config.chatRecentTurns;
  if (!config.openRouterApiKey) return session;
  if ((session.messages || []).length < trigger) return session;

  const older = session.messages.slice(0, Math.max(0, session.messages.length - keep));
  if (older.length < 4) return session;

  const transcript = older
    .map((m) => `${m.role}: ${String(m.content).slice(0, 500)}`)
    .join('\n');

  try {
    const routed = await routedChat({
      task: { force: 'simple', chatTurns: older.length },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Summarize this meal-planning chat for future context. Keep: budget, store, allergies, likes, constraints, plan decisions, open questions. Max 180 words. Plain text.',
        },
        {
          role: 'user',
          content: `Prior summary:\n${session.rollingSummary || '(none)'}\n\nNew turns:\n${transcript}`,
        },
      ],
    });
    session.rollingSummary = String(routed.content || '').trim();
    // Drop summarized turns; keep recent window only
    session.messages = session.messages.slice(-keep);
    logger.info('chat_summarized', {
      sessionId: session.id,
      summaryTokens: session.rollingSummary.length,
      kept: session.messages.length,
    });
  } catch (err) {
    logger.warn('chat_summarize_failed', { err: String(err.message || err) });
  }
  return session;
}

export function applyMemoryToSession(session, memory) {
  if (!memory) return session;
  const prefsUpdate = memory.prefsUpdate || {};
  mergePinnedFacts(session, {
    likes: prefsUpdate.likes,
    allergies: prefsUpdate.allergies,
    dislikes: prefsUpdate.dislikes,
    constraints: prefsUpdate.constraints || memory.constraints,
  });
  if (memory.planPatch && session.workingMemory) {
    session.workingMemory.activePlan = {
      ...(session.workingMemory.activePlan || {}),
      ...memory.planPatch,
    };
  }
  if (memory.intent) session.meta.lastIntent = memory.intent;
  return session;
}
