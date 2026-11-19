# Production delivery

The two example sites (`jinpingmei` and `xiyouji`) deploy solely through Vercel's
native Git integration from `main`. Repository workflows hold no Vercel token and
run no deploy command; the GitHub Actions deploy workflow (`deploy.yml`) was
retired on 2026-10-03, and `tests/test_production_delivery.py` keeps it retired.

## Promotion gate

Each Vercel project requires two GitHub checks—`repository` and
`ClawHub inventory validation / distribute`—before promoting a deployment to its
production custom domain. Vercel may build and deploy while checks are still
running; the checks gate domain promotion, not the build itself. Vercel operators
can still force-promote past them.

## Observing a deployment

After merging to `main`, run the read-only observation workflow for that commit:

```bash
gh workflow run deployment-readiness.yml --ref main -f source_sha=<40-character main commit>
gh run download <run-id> -n deployment-observation-<run-id>-<attempt>
```

The **Public deployment observation** workflow verifies that `main` product and
inventory CI passed for that commit, that each project's latest production
deployment was created by Vercel for that commit with a `success` status, and
that both public origins return HTTP 200 without credentials or redirects. The
downloaded artifact holds `ci-proof.json` and `deployment-receipt.json` with the
GitHub deployment, status, and CI run IDs. Any missing deployment, mismatched
source commit, non-success status, API error, or non-200 response fails the run.

The receipt records `kind: "POST_DEPLOYMENT_OBSERVATION"`, while `providerGate`
and `customDomainSourceBinding` stay `NOT_VERIFIED`: an HTTP 200 proves the
domain is reachable, not which commit it serves. To verify promotion directly,
check the Vercel project's deployment ID, source commit, and check state. When a
merge leaves an example's files untouched, Vercel may skip rebuilding it; its
latest production deployment then still points to the earlier commit and the
observation fails for that project—report that failure as expected.
