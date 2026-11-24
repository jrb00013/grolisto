"""CLI entrypoint: grolisto-index."""

from __future__ import annotations

import argparse
import sys

from grolisto_indexer.upsert import load_recipes, recipes_collection


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Index Grolisto recipes into Qdrant")
    parser.add_argument(
        "--recipes",
        default="../data/seed/recipes.json",
        help="Path to recipes JSON (default: ../data/seed/recipes.json)",
    )
    args = parser.parse_args(argv)

    recipes = load_recipes(args.recipes)
    collection = recipes_collection()
    print(
        f"Loaded {len(recipes)} recipes for collection {collection}. "
        "Python upsert is a stub — use `npm run index:recipes` for the Node indexer.",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
