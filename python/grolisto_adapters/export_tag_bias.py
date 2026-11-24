"""Export tag-bias JSON for ADAPTER_WEIGHTS_PATH (consumed by Node loraStub)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


DEFAULT_BIAS: dict[str, Any] = {
    "tagBias": {
        "budget": 0.2,
        "vegan": 0.1,
    }
}


def export_tag_bias(out: str | Path, bias: dict[str, Any] | None = None) -> Path:
    path = Path(out)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = bias if bias is not None else DEFAULT_BIAS
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Export Grolisto tag-bias adapter JSON")
    parser.add_argument(
        "--out",
        default="../data/adapters/tag_bias.json",
        help="Output path for ADAPTER_WEIGHTS_PATH",
    )
    args = parser.parse_args(argv)
    path = export_tag_bias(args.out)
    print(f"Wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
