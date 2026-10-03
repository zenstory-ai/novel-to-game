# Production delivery: responsibility and evidence

The three example sites have native Vercel Git production deployments. The
existing `deploy.yml` also runs a Vercel CLI producer, so production currently has
two paths. This change **does not remove either producer or change platform
settings**. Hosted main merges are held until that production-policy boundary is
approved and read back.

## Chosen target, not yet enabled

Use native Vercel Git integration as the single producer. Configure Vercel
Deployment Checks against exact source CI before production custom-domain
promotion, then verify the project/check configuration and only then retire the
Actions CLI producer. Vercel may build/deploy before checks complete; these checks
are a promotion gate, not a pre-deployment barrier. Do not treat this target as
already enabled. No CI-owned alternative deploy path is activated here.

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

Before claiming production delivery alignment, read back each canonical Vercel
project's repository, main branch, root directory, deployment ID/source SHA,
Deployment Check binding and successful check/promotion state. Enabling that
platform policy requires the separately requested production-rule approval; it
does not authorize a tag, public package release or deliberate redeployment.
