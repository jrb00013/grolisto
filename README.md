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

## Kustie week cards

Hand-planned lunch/dinner cards (photos + recipes + PDF) live inside Grolisto:

- UI: [`/kustie/`](public/kustie/index.html)
- PDF: [`/kustie/Kustie-Nov-23-26.pdf`](public/kustie/Kustie-Nov-23-26.pdf)
- Data: [`data/seed/weeks/`](data/seed/weeks/)
- API: `GET /api/weeks`, `GET /api/weeks/current`

`npm run seed` loads household prefs + week cards. Chat uses the active Kustie week when you ask what to cook.

## Repository layout

| Path | Role |
|---|---|
| `src/` | Express API and services |
| `public/` | UI + Kustie week cards |
| `python/` | Optional indexer + adapter packages |
| `data/seed/` | Offline stores, prices, recipes, weeks |
| `docs/` | Design and ops docs |

## Stack

- Express one-page UI + chat API + Kustie week cards
- Scotr → Kroger Locations/Products (mock seed fallback)
- RAG → Qdrant hybrid retrieve + rerank (optional Python indexer)
- Planner math → [docs/MATH.md](docs/MATH.md)

## License

MIT

## Related docs

- [API](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Scotr](docs/SCOTR.md)
- [RAG](docs/RAG.md)
- [Math](docs/MATH.md)
- [Deployment](docs/DEPLOYMENT.md)
