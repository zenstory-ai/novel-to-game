# Production delivery

The three example sites (`jinpingmei`, `xiyouji`, `project-plateau`) deploy only
through Vercel's native Git integration from `main`. Repository workflows hold no
Vercel token and run no deploy command; the GitHub Actions deploy workflow
(`deploy.yml`) was retired on 2026-10-03, and `tests/test_production_delivery.py`
keeps it out.

## Promotion gate

Each Vercel project requires two GitHub checks, `repository` and
`ClawHub inventory validation / distribute`, before it promotes a deployment to
its production custom domain. Vercel may build and deploy before the checks
finish; the checks gate promotion, not the build. Vercel operators can still
force-promote past them.

## Observing a deployment

After a merge to `main`, run the read-only observation for that commit:

```bash
gh workflow run deployment-readiness.yml --ref main -f source_sha=<40-character main commit>
gh run download <run-id> -n deployment-observation-<run-id>-<attempt>
```

The **Public deployment observation** workflow confirms that the commit's `main`
product and inventory CI passed, that each project's latest production deployment
was created by Vercel for that commit with a success status, and that the three
public origins answer HTTP 200 without credentials or redirects. The artifact
holds `ci-proof.json` and `deployment-receipt.json`, with GitHub deployment,
status and CI run IDs. Any missing deployment, wrong source commit, non-success status, API
error or non-200 response fails the run.

The receipt's `kind` is `POST_DEPLOYMENT_OBSERVATION`, and `providerGate` and
`customDomainSourceBinding` stay `NOT_VERIFIED`: an HTTP 200 shows the domain is
up, not which commit it serves. To confirm promotion itself, read the Vercel
project's deployment ID, source commit and check state. When a merge leaves the
example files unchanged, Vercel may skip the build; the latest production
deployment then still reports the earlier commit and the observation fails for
that project, which is the expected result to report.
