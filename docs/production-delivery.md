# Production delivery: responsibility and evidence

The three example sites use native Vercel Git integration as their single
production producer. The duplicate Actions CLI producer (`deploy.yml`) is
retired after the owner's production-policy approval and authenticated readback
of all three projects' production checks on 2026-10-03. No Vercel token or
deployment command is required by repository workflows.

## Configured production promotion policy

Each canonical project (`jinpingmei`, `xiyouji`, `project-plateau`) retains its
existing repository, main branch, root directory, Git deployment integration
and automatic production-domain assignment. Vercel Deployment Checks require
both `repository` and `ClawHub inventory validation / distribute` from GitHub
before production custom-domain promotion. Both check bindings were verified
after reloading each project's settings page.

Vercel may build/deploy before checks complete: this is a promotion gate, not a
pre-deployment barrier. Configuration readback is not proof of a new deployment's
promotion behavior. Do not force a deployment solely to manufacture that proof;
record the next applicable native Git deployment and its check/promotion state.
Ordinary push-triggered GitHub checks do not need a `repository_dispatch` status
action. No CI-owned alternative deploy path is activated here.

## Read-only observation

`Public deployment observation` is a main-only manual workflow. It proves the
exact commit's protected-main product and inventory CI, requires the latest
Vercel-reported production deployment and status for each project to match that
SHA, and probes only the three fixed public origins without credentials or
redirects. It records GitHub deployment/status IDs and exact CI run/attempt IDs.

The result remains `POST_DEPLOYMENT_OBSERVATION`, with `providerGate` and
`customDomainSourceBinding` both `NOT_VERIFIED`. A public HTTP 200 is not proof
that a custom domain serves the requested commit. An older successful deployment
cannot conceal a newer failed/pending/wrong-source deployment. Missing metadata,
API/auth/rate errors or non-200 readiness are failures, never absence-as-success.

## Remaining platform evidence

Before claiming live production promotion has been exercised, read back each
canonical Vercel project's deployment ID/source SHA, Deployment Check binding
and successful check/promotion state. If unchanged example files make native
Git skip a build, report that explicitly; do not pretend the previously deployed
SHA is the new main commit. The approval permits these hosted main merges, not
a tag or public package release. Platform operators can force-promote and bypass
checks, so repository observation does not claim an unbypassable guarantee.
