from __future__ import annotations


class Expedition:
    """Tiny deterministic loop used only to exercise the evidence contract."""

    def __init__(self) -> None:
        self.restart()

    def snapshot(self) -> dict[str, object]:
        return {
            "phase": self.phase,
            "proof": self.proof,
            "outcome": self.outcome,
        }

    def observe(self) -> dict[str, object]:
        if self.phase != "arrival":
            raise RuntimeError("observation is only available on arrival")
        self.proof = True
        self.phase = "route_open"
        return self.snapshot()

    def extract(self) -> dict[str, object]:
        if self.phase != "route_open" or not self.proof:
            raise RuntimeError("extraction requires proof")
        self.phase = "complete"
        self.outcome = "extracted_with_proof"
        return self.snapshot()

    def restart(self) -> dict[str, object]:
        self.phase = "arrival"
        self.proof = False
        self.outcome = None
        return self.snapshot()
