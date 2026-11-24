"""Optional cross-encoder / LLM rerank helper."""

from __future__ import annotations

import os
from typing import Any, Sequence


def rerank_model() -> str:
    model = os.environ.get("RERANK_MODEL")
    if not model:
        raise RuntimeError("RERANK_MODEL is required")
    return model


def rerank(query: str, candidates: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Rerank candidates for a query.

    Stub: Node retrieve already supports LLM listwise rerank via RERANK_MODEL.
    """
    _ = (query, rerank_model())
    return list(candidates)
