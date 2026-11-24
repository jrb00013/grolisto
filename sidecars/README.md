# Grolisto sidecars

Optional Python packages for the Node runtime. The Express app works without these packages;
install them when you want richer indexing or offline preference adapters.

## Layout

```
sidecars/
├── pyproject.toml
├── grolisto_indexer/     # LlamaIndex / Qdrant embedding + upsert + rerank
└── grolisto_adapters/    # PEFT / LoRA stubs → JSON sidecar for Node
```

## Install

Requires [Poetry](https://python-poetry.org/).

```bash
cd sidecars
poetry install --extras "indexer adapters"
```

Dev tools (pytest, ruff):

```bash
poetry install --extras "indexer adapters" --with dev
```

Run CLIs via Poetry:

```bash
poetry run grolisto-index --recipes ../data/seed/recipes.json
poetry run grolisto-export-adapter --out ../data/adapters/tag_bias.json
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
poetry run grolisto-index --recipes ../data/seed/recipes.json

# Export a tag-bias sidecar for ADAPTER_WEIGHTS_PATH
poetry run grolisto-export-adapter --out ../data/adapters/tag_bias.json
```
