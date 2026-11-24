"""Qdrant upsert helpers — collection names from QDRANT_COLLECTION_* env."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def recipes_collection() -> str:
    name = os.environ.get("QDRANT_COLLECTION_RECIPES")
    if not name:
        raise RuntimeError("QDRANT_COLLECTION_RECIPES is required")
    return name


def load_recipes(path: str | Path) -> list[dict[str, Any]]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("recipes JSON must be a list")
    return data


def upsert_recipes(_recipes: list[dict[str, Any]], _vectors: list[list[float]]) -> int:
    """
    Upsert recipe points into Qdrant.

    Stub: prefer Node `npm run index:recipes` until this path is implemented.
    """
    url = os.environ.get("QDRANT_URL")
    if not url:
        raise RuntimeError("QDRANT_URL is required")
    raise NotImplementedError("Wire qdrant-client upsert; see docs/RAG.md")
