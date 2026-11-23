import { Router } from 'express';
import {
  handleUserTurn,
  openSession,
  patchSessionContext,
} from '../services/chat/orchestrate.js';
import { loadSession, listSessions, deleteSession } from '../services/chat/sessions.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

function userIdFrom(req, body = {}) {
  return req.userId || body.userId || 'default';
}

/** Create a chat session (server owns history). */
router.post('/sessions', optionalAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const session = await openSession({
      userId: userIdFrom(req, body),
      title: body.title,
      workingMemory: body.workingMemory || body.context || undefined,
    });
    res.status(201).json({
      session: {
        id: session.id,
        userId: session.userId,
        title: session.title,
        workingMemory: session.workingMemory,
        createdAt: session.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/sessions', optionalAuth, async (req, res, next) => {
  try {
    const sessions = await listSessions(userIdFrom(req, req.query), {
      limit: Number(req.query.limit) || 20,
    });
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

router.get('/sessions/:id', optionalAuth, async (req, res, next) => {
  try {
    const session = await loadSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    res.json({
      session: {
        id: session.id,
        userId: session.userId,
        title: session.title,
        messages: session.messages,
        workingMemory: session.workingMemory,
        pinnedFacts: session.pinnedFacts,
        rollingSummary: session.rollingSummary,
        meta: session.meta,
        updatedAt: session.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Patch working memory (plan, budget, store) without a chat turn. */
router.patch('/sessions/:id/context', optionalAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const session = await patchSessionContext(req.params.id, {
      userId: userIdFrom(req, body),
      workingMemory: body.workingMemory || body.context || body,
    });
    res.json({
      session: {
        id: session.id,
        workingMemory: session.workingMemory,
        title: session.title,
        updatedAt: session.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Append a user message; server packs context + returns assistant reply. */
router.post('/sessions/:id/messages', optionalAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await handleUserTurn({
      sessionId: req.params.id,
      userId: userIdFrom(req, body),
      content: body.content ?? body.message,
      workingMemoryPatch: body.workingMemory || body.context || null,
      feedback: body.feedback || null,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/sessions/:id', optionalAuth, async (req, res, next) => {
  try {
    const ok = await deleteSession(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/**
 * Backward-compatible one-shot: creates an ephemeral session, posts one message.
 * Prefer /sessions + /messages for real clients.
 */
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const userId = userIdFrom(req, body);
    const session = await openSession({
      userId,
      workingMemory: body.context || body.workingMemory,
    });

    // Seed prior client messages (except last user) into session if provided
    const prior = Array.isArray(body.messages) ? body.messages : [];
    const lastUser = [...prior].reverse().find((m) => m.role === 'user');
    const content =
      body.content ||
      body.message ||
      lastUser?.content ||
      prior.filter((m) => m.role === 'user').slice(-1)[0]?.content;

    if (!content) {
      res.status(400).json({ error: 'content or messages[].user required' });
      return;
    }

    // Persist earlier turns so packer has history
    if (prior.length) {
      const { appendMessage, saveSession } = await import('../services/chat/sessions.js');
      for (const m of prior) {
        if (m === lastUser) continue;
        if (m.role === 'user' || m.role === 'assistant') {
          appendMessage(session, { role: m.role, content: String(m.content || '') });
        }
      }
      await saveSession(session);
    }

    const result = await handleUserTurn({
      sessionId: session.id,
      userId,
      content,
      workingMemoryPatch: body.context || body.workingMemory || null,
      feedback: body.feedback || body.context?.feedback || null,
    });

    res.json({
      ...result,
      // legacy field
      reply: result.reply,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
