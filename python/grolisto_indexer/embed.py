"""Embedding helpers — model IDs come from EMBEDDING_MODEL env only."""

from __future__ import annotations

import os
from typing import Sequence


def embedding_model() -> str:
    model = os.environ.get("EMBEDDING_MODEL")
    if not model:
        raise RuntimeError("EMBEDDING_MODEL is required")
    return model


def embed_texts(texts: Sequence[str]) -> list[list[float]]:
    """
    Embed texts via OpenRouter-compatible API.

    Stub: raises until OPENROUTER_API_KEY and httpx client are wired.
    """
    if not os.environ.get("OPENROUTER_API_KEY"):
        raise RuntimeError("OPENROUTER_API_KEY is required for embeddings")
    if not texts:
        return []
    raise NotImplementedError(
        "Wire OpenRouter embeddings here; Node path: npm run index:recipes"
    )
