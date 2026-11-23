import { config } from '../../lib/config.js';
import { estimateTokens, truncateToTokens } from './tokenize.js';

/**
 * Layered context pack (priority high → low):
 * 1. system policy
 * 2. user prefs + pinned facts
 * 3. working memory (budget/store/plan)
 * 4. rolling summary
 * 5. recent turns (sliding window)
 *
 * Evicts from the bottom of the recent window first, then truncates summary.
 */

const SYSTEM_POLICY = `You are Grolisto, a budget-aware meal planning assistant.
Rules:
- Respect hard allergy constraints always.
- Stay inside the weekly budget in working memory when proposing swaps.
- Prefer novelty vs recentRecipeIds; do not suggest the same dish week after week.
- Never suggest peas if dislikes include peas.
- When an active Kustie week card is present, prefer those hand-planned meals for "what should we cook this week" and point to htmlPath / pdfPath.
- Do not only repeat household staples (tomato pasta, tikka, burgers, sloppy joes); offer twists/new plates in their cheap-to-mid lane.
- Be concise and actionable.
- When you extract lasting preferences, include a final fenced JSON block ONLY:
\`\`\`json
{"type":"grolisto.memory","intent":"preference|plan_edit|question|swap","prefsUpdate":{"likes":[],"allergies":[],"dislikes":[],"constraints":[]},"planPatch":null,"userVisible":true}
\`\`\`
- Put the human-readable answer BEFORE that JSON block. Never invent API keys or prices.`;

function compactPlan(plan) {
  if (!plan) return null;
  const days = (plan.days || plan.plan?.days || []).slice(0, 7).map((d) => ({
    day: d.day,
    meals: (d.meals || []).map((m) => ({
      meal: m.meal,
      title: m.title,
      recipeId: m.recipeId,
      estCost: m.estCost,
    })),
  }));
  const totals = plan.totals || plan.plan?.totals || null;
  return { days, totals };
}

export function buildContextLayers({ session, prefs = {}, ragSnippets = [], weekCard = null }) {
  const wm = session.workingMemory || {};
  const pinned = session.pinnedFacts || {};

  const profile = {
    likes: [...new Set([...(prefs.likes || []), ...(pinned.likes || []), ...(wm.likes || [])])],
    allergies: [
      ...new Set([...(prefs.allergies || []), ...(pinned.allergies || []), ...(wm.allergies || [])]),
    ],
    dislikes: [...new Set([...(prefs.dislikes || []), ...(pinned.dislikes || [])])],
    constraints: pinned.constraints || [],
    taste: prefs.taste || {},
    recentRecipeIds: (prefs.recentRecipeIds || []).slice(0, 12),
    staplesCookedWell: prefs.staplesCookedWell || [],
    cookingStyle: prefs.cookingStyle || {},
    householdProfile: prefs.profile || {},
    memoryBlurb: prefs.memoryBlurb || '',
  };

  const working = {
    budget: wm.budget,
    days: wm.days,
    meals: wm.meals,
    storeId: wm.storeId,
    zip: wm.zip,
    calorieGoal: wm.calorieGoal,
    notes: wm.notes || '',
    activePlan: compactPlan(wm.activePlan),
  };

  const kustie = weekCard
    ? {
        id: weekCard.id,
        label: weekCard.label,
        htmlPath: weekCard.htmlPath,
        pdfPath: weekCard.pdfPath,
        notes: weekCard.notes,
        meals: weekCard.meals,
      }
    : null;

  return {
    system: SYSTEM_POLICY,
    profile,
    working,
    kustie,
    summary: session.rollingSummary || '',
    ragSnippets: (ragSnippets || []).slice(0, 5),
    recent: (session.messages || []).filter((m) => m.role === 'user' || m.role === 'assistant'),
  };
}

/**
 * Assemble OpenAI-style messages within token budget.
 */
export function packMessages(layers, { budgetTokens = config.chatContextTokenBudget, recentTurns = config.chatRecentTurns } = {}) {
  const messages = [];
  let used = 0;

  const push = (role, content, { soft = false } = {}) => {
    const tokens = estimateTokens(content) + 4;
    if (!soft && used + tokens > budgetTokens) return false;
    if (soft && used + tokens > budgetTokens) {
      const room = Math.max(32, budgetTokens - used - 4);
      content = truncateToTokens(content, room);
    }
    messages.push({ role, content });
    used += estimateTokens(content) + 4;
    return true;
  };

  push(
    'system',
    [
      layers.system,
      '## Profile',
      JSON.stringify(layers.profile),
      '## Working memory',
      JSON.stringify(layers.working),
      layers.kustie ? `## Active Kustie week card\n${JSON.stringify(layers.kustie)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  );

  if (layers.summary) {
    push('system', `## Session summary\n${layers.summary}`, { soft: true });
  }

  if (layers.ragSnippets?.length) {
    push(
      'system',
      `## Retrieved recipes\n${layers.ragSnippets
        .map((r, i) => `${i + 1}. ${r.title || r.id} — ${(r.tags || []).join(', ')}`)
        .join('\n')}`,
      { soft: true },
    );
  }

  const recent = (layers.recent || []).slice(-Math.max(2, recentTurns));
  // Drop from the oldest recent turns until we fit
  let start = 0;
  while (start < recent.length) {
    const slice = recent.slice(start);
    const cost = slice.reduce((n, m) => n + estimateTokens(m.content) + 4, 0);
    if (used + cost <= budgetTokens || start === recent.length - 2) break;
    start += 1;
  }

  for (const m of recent.slice(start)) {
    push(m.role, m.content, { soft: true });
  }

  return {
    messages,
    usage: { estimatedTokens: used, budgetTokens, droppedTurns: start },
  };
}

export function detectIntent(text = '') {
  const t = String(text).toLowerCase();
  if (/\b(allerg|can't eat|cannot eat|intoleran)/.test(t)) return 'preference';
  if (/\b(swap|replace|instead of|change)\b/.test(t)) return 'swap';
  if (/\b(budget|cheaper|under \$|spend)\b/.test(t)) return 'plan_edit';
  if (/\b(plan|schedule|this week|meal)\b/.test(t)) return 'plan_edit';
  return 'question';
}
