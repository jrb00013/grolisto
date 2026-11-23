# Grolisto

Private meal planner: budget + neighboring store prices (Scotr) + allergies/likes + chat, with Qdrant RAG and OpenRouter model-tier routing.

## Quick start

```bash
cp .env.example .env   # fill keys — nothing is hardcoded in the app
npm install
docker compose up -d qdrant   # optional local vector DB
npm run seed
npm run dev
```

Open `PUBLIC_BASE_URL` (default from `.env`).

## What you configure

| Concern | Env |
|---|---|
| OpenRouter | `OPENROUTER_API_KEY`, `ROUTE_*_MODEL`, complexity thresholds |
| Scotr prices | `KROGER_*` or `SCOTR_USE_MOCK=true` + `data/seed/*` |
| Qdrant | `QDRANT_URL`, `QDRANT_COLLECTION_*`, `EMBEDDING_MODEL`, `RERANK_MODEL` |
| Learning | `PREFS_PATH`, `NOVELTY_DECAY`, `NOVELTY_FLOOR` |

See `.env.example` and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Stack

- Express one-page UI + chat API
- Scotr → Kroger Locations/Products (mock seed fallback)
- RAG → Qdrant hybrid retrieve + rerank
- Planner math → [docs/MATH.md](docs/MATH.md)

## License

MIT
