# Grolisto RAG

Pragmatic Node retrieve + optional Python LlamaIndex indexer. Vectors in Qdrant (Cloud free or local Docker).

## Collections (env names)

| Env | Purpose |
|---|---|
| `QDRANT_COLLECTION_RECIPES` | recipes (title, meals, ingredients, tags, allergens, steps) |
| `QDRANT_COLLECTION_INGREDIENTS` | ingredient aliases / allergens |
| `QDRANT_COLLECTION_PREFS` | user preference embeddings |
| `QDRANT_COLLECTION_PLANS` | past meal-plan summaries (novelty) |

Dense vectors sized from `EMBEDDING_MODEL` output. Sparse/BM25 optional later (`SPARSE_ENABLED` when added).

## Pipeline

1. Filter seed/Qdrant by meal slots + hard allergies  
2. Dense search when `OPENROUTER_API_KEY` + Qdrant available  
3. Preference / novelty score (`NOVELTY_DECAY`, `NOVELTY_FLOOR`)  
4. Rerank via `RERANK_MODEL` (LLM listwise) or pass-through  
5. Context pack → planner  

Code: `src/services/rag/*`. Index: `npm run index:recipes`.

## Adapters

`ADAPTER_WEIGHTS_PATH` → JSON tag bias sidecar (`src/services/adapters/loraStub.js`). PEFT training stubs under `python/adapters/`.
