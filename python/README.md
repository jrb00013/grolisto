# Grolisto Python

Optional sidecars for the Node runtime. The Express app works without these packages;
install them when you want richer indexing or offline preference adapters.

## Layout

```
python/
├── pyproject.toml
├── grolisto_indexer/     # LlamaIndex / Qdrant embedding + upsert + rerank
└── grolisto_adapters/    # PEFT / LoRA stubs → JSON sidecar for Node
```

## Install

```bash
cd python
python -m venv .venv
source .venv/bin/activate
pip install -e ".[indexer,adapters,dev]"
```

Keep API keys in the environment only (never in source). See the repo root `.env.example`.

## Packages

| Package | Role | Node counterpart |
|---|---|---|
| `grolisto_indexer` | Embed recipes, upsert Qdrant, optional rerank HTTP | `src/services/rag/` |
| `grolisto_adapters` | Train/export tag-bias JSON | `src/services/adapters/loraStub.js` |

## CLI

```bash
# Index seed recipes into Qdrant (requires QDRANT_* + OPENROUTER_API_KEY)
grolisto-index --recipes ../data/seed/recipes.json

# Export a tag-bias sidecar for ADAPTER_WEIGHTS_PATH
grolisto-export-adapter --out ../data/adapters/tag_bias.json
```
