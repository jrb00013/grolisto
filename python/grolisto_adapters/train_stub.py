"""
PEFT / LoRA training stub.

Train offline, then call export_tag_bias to write the JSON sidecar.
Runtime loading stays in Node: src/services/adapters/loraStub.js.
"""

from __future__ import annotations

from typing import Any


def train_tag_bias(_examples: list[dict[str, Any]]) -> dict[str, float]:
    """
    Return a tagBias map from labeled preference examples.

    Stub until a real PEFT pipeline is wired.
    """
    raise NotImplementedError(
        "Implement PEFT training here; export via grolisto_adapters.export_tag_bias"
    )
