# Grolisto deployment plan (free / limited)

## What must be wired (APIs)

| Service | Free path | Env | Notes |
|---|---|---|---|
| **OpenRouter** | Free models ≤50 req/day; paid for better tiers | `OPENROUTER_API_KEY`, `ROUTE_*_MODEL`, thresholds | Tier router picks model by complexity; set `ROUTE_FALLBACK_MODEL` to a free/auto model |
| **Scotr / Kroger** | Free developer app (Certification API) | `KROGER_CLIENT_ID`, `KROGER_CLIENT_SECRET`, `KROGER_API_BASE` | Or `SCOTR_USE_MOCK=true` + seed JSON |
| **Open Prices** (optional enrich) | Keyless crowd prices | future `OPEN_PRICES_BASE` | Backup when Kroger misses SKUs |
| **Qdrant Cloud** | Free single-node forever (prototype) | `QDRANT_URL`, `QDRANT_API_KEY` | Or `docker compose up qdrant` |
| **Embeddings / rerank** | Via OpenRouter | `EMBEDDING_MODEL`, `RERANK_MODEL` | No model IDs in code |
| **Prefs / learning** | Local disk or volume | `PREFS_PATH`, `NOVELTY_*` | Continuous taste updates |

Copy `.env.example` → `.env` on every host. **Never** commit `.env`.

## Recommended free hosting topology

```
Browser ──► Render free web service (Express / grolisto)
                │
                ├── OpenRouter API (chat + embeddings)
                ├── Kroger API (live) or mock seed
                └── Qdrant Cloud free cluster
```

### Render (best Express free tier today)

- Free web service: ~750 instance-hours/mo; sleeps after ~15 min idle
- Deploy from `jrb00013/grolisto` (private OK with Render GitHub app)
- Set all env vars in Render dashboard (mirror `.env.example`)
- Build: `npm install` · Start: `npm start`
- Pair with **Qdrant Cloud free** (not on Render disk — ephemeral)

### Railway Free

- $1/mo credit; services sleep 5–10 min idle — fine for demos, tight for always-on
- Can run Node + optional sidecar; still prefer external Qdrant Cloud

### Avoid for this stack (2026)

- Fly.io: no real free tier for new orgs (trial only)
- Hugging Face Docker Spaces: free Docker often needs PRO

## Local / self-host (still free)

```bash
cp .env.example .env
docker compose up -d qdrant
npm install && npm run seed && npm start
```

## Launch checklist

1. Create OpenRouter key → set `ROUTE_*` models you actually have access to
2. Register Kroger developer app **or** leave `SCOTR_USE_MOCK=true`
3. Create Qdrant Cloud cluster → paste URL + API key
4. `npm run index:recipes` once against that cluster
5. Deploy Render service from `main`
6. Smoke: `/api/health`, `/api/stores?zip=…`, POST `/api/plan`

## Cost control

- Keep `ROUTE_COMPLEXITY_*` thresholds so most plans hit the cheap tier
- Cache Scotr responses (`SCOTR_CACHE_TTL_MS`)
- Prefer free OpenRouter models for chat until product-market fit
