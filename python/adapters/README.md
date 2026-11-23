# Grolisto preference adapters (LoRA / PEFT stubs)

Train small adapters offline; export a JSON sidecar and point runtime at it:

```bash
export ADAPTER_WEIGHTS_PATH=./data/adapters/tag_bias.json
```

Expected JSON shape (no secrets):

```json
{ "tagBias": { "budget": 0.2, "vegan": 0.1 } }
```

Full PEFT training scripts can live here later; runtime loads via `src/services/adapters/loraStub.js`.
