# LlamaIndex indexer (optional sidecar)

Use when you want richer chunking / sparse retrieve than the Node `indexRecipes` script.

Suggested entrypoints (to implement against your env):

- embed recipes from `data/seed/recipes.json`
- upsert into Qdrant collections named by `QDRANT_COLLECTION_*`
- expose `/rerank` for cross-encoder scoring

Keep API keys in environment only.
