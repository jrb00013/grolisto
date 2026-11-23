import 'dotenv/config';
import { z } from 'zod';

const bool = (v) => {
  if (typeof v === 'boolean') return v;
  if (v == null || v === '') return undefined;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};

const schema = z.object({
  port: z.coerce.number().int().positive().default(3847),
  nodeEnv: z.string().default('development'),
  publicBaseUrl: z.string().url().optional(),

  openRouterApiKey: z.string().optional().default(''),
  openRouterBaseUrl: z.string().url().default('https://openrouter.ai/api/v1'),
  openRouterSiteUrl: z.string().optional().default(''),
  openRouterSiteName: z.string().optional().default('grolisto'),

  routeSimpleModel: z.string().min(1),
  routeStandardModel: z.string().min(1),
  routeComplexModel: z.string().min(1),
  routeFallbackModel: z.string().min(1),
  routeSimpleMax: z.coerce.number().min(0).max(1),
  routeStandardMax: z.coerce.number().min(0).max(1),

  krogerClientId: z.string().optional().default(''),
  krogerClientSecret: z.string().optional().default(''),
  krogerApiBase: z.string().url(),
  scotrUseMock: z.boolean(),
  scotrCacheTtlMs: z.coerce.number().int().positive(),
  scotrDefaultZip: z.string().min(3),

  qdrantUrl: z.string().url(),
  qdrantApiKey: z.string().optional().default(''),
  qdrantRecipes: z.string().min(1),
  qdrantIngredients: z.string().min(1),
  qdrantPrefs: z.string().min(1),
  qdrantPlans: z.string().min(1),
  embeddingModel: z.string().min(1),
  rerankModel: z.string().min(1),


  authJwtSecret: z.string().min(16),
  authJwtTtl: z.string().min(1),
  authUsersPath: z.string().min(1),
  defaultCalorieGoal: z.coerce.number().positive(),
  defaultWeeklyBudget: z.coerce.number().positive(),
  fdcApiKey: z.string().optional().default(''),
  fdcBaseUrl: z.string().url(),
  fdcCacheTtlMs: z.coerce.number().int().positive(),


  chatSessionsPath: z.string().min(1),
  chatContextTokenBudget: z.coerce.number().int().positive(),
  chatRecentTurns: z.coerce.number().int().positive(),
  chatSummaryTriggerTurns: z.coerce.number().int().positive(),
  chatMaxMessageChars: z.coerce.number().int().positive(),

  prefsPath: z.string().min(1),
  noveltyDecay: z.coerce.number().min(0).max(1),
  noveltyFloor: z.coerce.number().min(0).max(1),
});

function loadConfig(env = process.env) {
  const raw = {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    publicBaseUrl: env.PUBLIC_BASE_URL || undefined,

    openRouterApiKey: env.OPENROUTER_API_KEY,
    openRouterBaseUrl: env.OPENROUTER_BASE_URL,
    openRouterSiteUrl: env.OPENROUTER_SITE_URL,
    openRouterSiteName: env.OPENROUTER_SITE_NAME,

    routeSimpleModel: env.ROUTE_SIMPLE_MODEL,
    routeStandardModel: env.ROUTE_STANDARD_MODEL,
    routeComplexModel: env.ROUTE_COMPLEX_MODEL,
    routeFallbackModel: env.ROUTE_FALLBACK_MODEL,
    routeSimpleMax: env.ROUTE_COMPLEXITY_SIMPLE_MAX,
    routeStandardMax: env.ROUTE_COMPLEXITY_STANDARD_MAX,

    krogerClientId: env.KROGER_CLIENT_ID,
    krogerClientSecret: env.KROGER_CLIENT_SECRET,
    krogerApiBase: env.KROGER_API_BASE,
    scotrUseMock: bool(env.SCOTR_USE_MOCK),
    scotrCacheTtlMs: env.SCOTR_CACHE_TTL_MS,
    scotrDefaultZip: env.SCOTR_DEFAULT_ZIP,

    qdrantUrl: env.QDRANT_URL,
    qdrantApiKey: env.QDRANT_API_KEY,
    qdrantRecipes: env.QDRANT_COLLECTION_RECIPES,
    qdrantIngredients: env.QDRANT_COLLECTION_INGREDIENTS,
    qdrantPrefs: env.QDRANT_COLLECTION_PREFS,
    qdrantPlans: env.QDRANT_COLLECTION_PLANS,
    embeddingModel: env.EMBEDDING_MODEL,
    rerankModel: env.RERANK_MODEL,


    authJwtSecret: env.AUTH_JWT_SECRET,
    authJwtTtl: env.AUTH_JWT_TTL,
    authUsersPath: env.AUTH_USERS_PATH,
    defaultCalorieGoal: env.DEFAULT_CALORIE_GOAL,
    defaultWeeklyBudget: env.DEFAULT_WEEKLY_BUDGET,
    fdcApiKey: env.FDC_API_KEY,
    fdcBaseUrl: env.FDC_BASE_URL,
    fdcCacheTtlMs: env.FDC_CACHE_TTL_MS,


    chatSessionsPath: env.CHAT_SESSIONS_PATH,
    chatContextTokenBudget: env.CHAT_CONTEXT_TOKEN_BUDGET,
    chatRecentTurns: env.CHAT_RECENT_TURNS,
    chatSummaryTriggerTurns: env.CHAT_SUMMARY_TRIGGER_TURNS,
    chatMaxMessageChars: env.CHAT_MAX_MESSAGE_CHARS,

    prefsPath: env.PREFS_PATH,
    noveltyDecay: env.NOVELTY_DECAY,
    noveltyFloor: env.NOVELTY_FLOOR,
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(
      `Invalid config — set required env vars (see .env.example).\n${missing.join('\n')}`,
    );
  }
  return Object.freeze(parsed.data);
}

export const config = loadConfig();
export { loadConfig };
