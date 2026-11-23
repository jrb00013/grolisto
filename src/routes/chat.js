import { Router } from 'express';
import { routedChat } from '../services/openrouter/modelRouter.js';
import { loadPrefs, savePrefs } from '../services/prefs/store.js';
import { recordFeedback } from '../services/prefs/learn.js';
import { config } from '../lib/config.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    if (!config.openRouterApiKey) {
      res.status(503).json({ error: 'OPENROUTER_API_KEY not configured' });
      return;
    }
    const { messages = [], userId = 'default', context = {} } = req.body || {};
    const prefs = await loadPrefs(userId);

    const system = {
      role: 'system',
      content: [
        'You are Grolisto, a budget meal-planning assistant.',
        'Parse likes, allergies, budget, meal slots, and store preferences from the user.',
        'When you learn a preference, end with a JSON line: {"prefsUpdate":{"likes":[],"allergies":[],"dislikes":[]}}',
        `Known prefs: ${JSON.stringify({
          likes: prefs.likes,
          allergies: prefs.allergies,
          recent: (prefs.recentRecipeIds || []).slice(0, 8),
        })}`,
        context && Object.keys(context).length ? `Context: ${JSON.stringify(context)}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    };

    const routed = await routedChat({
      task: {
        days: context.days || 1,
        mealSlots: context.meals || ['dinner'],
        allergyCount: (prefs.allergies || []).length,
        likedCount: (prefs.likes || []).length,
        chatTurns: messages.length,
      },
      messages: [system, ...messages],
    });

    const prefsUpdateMatch = routed.content.match(/\{"prefsUpdate"\s*:\s*\{[\s\S]*?\}\s*\}/);
    if (prefsUpdateMatch) {
      try {
        const { prefsUpdate } = JSON.parse(prefsUpdateMatch[0]);
        const merged = {
          ...prefs,
          likes: [...new Set([...(prefs.likes || []), ...(prefsUpdate.likes || [])])],
          allergies: [...new Set([...(prefs.allergies || []), ...(prefsUpdate.allergies || [])])],
          dislikes: [...new Set([...(prefs.dislikes || []), ...(prefsUpdate.dislikes || [])])],
        };
        await savePrefs(userId, merged);
      } catch {
        /* ignore partial JSON */
      }
    }

    if (context.feedback?.recipeId) {
      await recordFeedback(userId, {
        recipeId: context.feedback.recipeId,
        tags: context.feedback.tags || [],
        liked: Boolean(context.feedback.liked),
      });
    }

    res.json({
      reply: routed.content,
      route: { tier: routed.tier, model: routed.model, complexity: routed.complexity },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
