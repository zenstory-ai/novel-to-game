from __future__ import annotations

import unittest

from game import Expedition


class ExpeditionTests(unittest.TestCase):
    def test_complete_run_and_restart(self) -> None:
        game = Expedition()
        self.assertEqual(game.snapshot()["phase"], "arrival")
        self.assertTrue(game.observe()["proof"])
        self.assertEqual(game.extract()["outcome"], "extracted_with_proof")
        self.assertEqual(
            game.restart(),
            {"phase": "arrival", "proof": False, "outcome": None},
        )


if __name__ == "__main__":
    unittest.main()
