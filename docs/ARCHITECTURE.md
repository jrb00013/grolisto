# Grolisto architecture

```
Browser UI (public/)
    │
    ▼
Express (src/app.js)
    ├── Scotr (Kroger | mock seed)
    ├── RAG retrieve (Qdrant + seed)
    ├── Prefs learn (disk JSON)
    ├── Model tier router → OpenRouter
    ├── Planner allocate (math + greedy / LLM)
    └── Weeks / Kustie cards
         │
         └── optional sidecars/
               ├── grolisto_indexer  (embed / upsert / rerank)
               └── grolisto_adapters (tag-bias JSON for Node)
```

## Repository layout

| Path | Role |
|---|---|
| `src/` | Node/Express API and services |
| `public/` | One-page UI + Kustie week cards |
| `sidecars/` | Optional Python packages (`grolisto_indexer`, `grolisto_adapters`) |
| `data/seed/` | Offline stores, prices, recipes, weeks |
| `docs/` | API, RAG, Scotr, math, deployment |
| `scripts/` | Seed, index, smoke CLIs |
| `test/` | Node unit tests |

All secrets and model IDs live in env (see `.env.example`). See [sidecars/README.md](../sidecars/README.md) for install and CLI usage.
