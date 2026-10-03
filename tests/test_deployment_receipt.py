"""Offline deployment-observer contracts; no production mutations."""
import importlib.util
from pathlib import Path
import unittest

P = Path(__file__).parents[1] / "scripts/deployment_receipt.py"
S = importlib.util.spec_from_file_location("deployment_receipt", P)
r = importlib.util.module_from_spec(S)
S.loader.exec_module(r)


class DeploymentReceiptTests(unittest.TestCase):
    def fixture(self):
        return [{"id": 20, "sha": "a" * 40, "environment": "Production – jinpingmei", "creator": {"login": "vercel[bot]"}},
                {"id": 10, "sha": "a" * 40, "environment": "Production – jinpingmei", "creator": {"login": "vercel[bot]"}}]

    def test_latest_exact_production_only(self):
        rows = self.fixture()
        rows.append(dict(rows[0], id=30, environment="Preview – jinpingmei"))
        self.assertEqual(20, r.select_deployment(rows, "jinpingmei", "a" * 40)["id"])

    def test_never_falls_back_from_newer_wrong_source_or_identity(self):
        for change in ({"sha": "b" * 40}, {"creator": {"login": "elsewhere"}}):
            rows = self.fixture()
            rows[0].update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                r.select_deployment(rows, "jinpingmei", "a" * 40)

    def test_latest_failed_status_blocks_old_success(self):
        with self.assertRaises(ValueError):
            r.select_status([{"id": 2, "state": "failure", "creator": {"login": "vercel[bot]"}},
                             {"id": 1, "state": "success", "creator": {"login": "vercel[bot]"}}])

    def test_missing_or_non_vercel_status_fails(self):
        for statuses in ([], [{"id": 1, "state": "success", "creator": {"login": "elsewhere"}}]):
            with self.assertRaises(ValueError):
                r.select_status(statuses)

    def test_receipt_never_claims_provider_gate_or_domain_source_binding(self):
        receipt = r.make_receipt("a" * 40, [{"workflowId": 1}], [])
        self.assertEqual("NOT_VERIFIED", receipt["providerGate"])
        self.assertEqual("NOT_VERIFIED", receipt["customDomainSourceBinding"])
        self.assertEqual("POST_DEPLOYMENT_OBSERVATION", receipt["kind"])


if __name__ == "__main__":
    unittest.main()
