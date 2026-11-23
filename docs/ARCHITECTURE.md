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
    └── Planner allocate (math + greedy / LLM)
```

All secrets and model IDs live in env (see `.env.example`). Seed data under `data/seed/`.
