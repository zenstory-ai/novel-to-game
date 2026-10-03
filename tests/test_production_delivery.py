"""Keep native Vercel Git integration as the only production producer."""
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).parents[1]


class ProductionDeliveryTests(unittest.TestCase):
    def test_duplicate_actions_cli_producer_is_retired(self):
        workflows = ROOT / ".github/workflows"
        self.assertFalse((workflows / "deploy.yml").exists())
        for path in sorted(workflows.glob("*.y*ml")):
            with self.subTest(workflow=path.name):
                self.assertIsNone(re.search(
                    r"\bvercel\s+(?:deploy\s+)?--prod\b",
                    path.read_text(encoding="utf-8"),
                ))


if __name__ == "__main__":
    unittest.main()
