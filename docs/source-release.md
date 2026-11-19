# Source release

This repository publishes a tracked-source archive through the reviewed ZenStory
source-release controls.

## Contract

- `.release/policy.json` is source-bound and declares every version file, the
  dated changelog, required installable paths, excluded paths, and required
  `main` CI jobs.
- Pull requests run read-only contract and archive checks.
- `workflow_dispatch` runs only on `main`, never publishes, and verifies the
  configured CI runs for that exact commit.
- Only a stable `vX.Y.Z` tag push whose version and dated changelog match can
  publish. The tagged commit must be on protected `main` with green exact-SHA CI.
  Release assets are append-only: a same-name byte mismatch fails the job and
  never overwrites an existing asset.
- Once GitHub source assets pass anonymous byte verification, a follow-up job
  dispatches **Publish skills to ClawHub** with the exact tag and 40-character
  source SHA. Its `CLAWHUB_QUEUED` summary means only that the dispatch was
  accepted.

## Release procedure

1. Update all version files together and add a dated changelog entry.
2. Merge to `main` with green product and ClawHub inventory checks.
3. Trigger **Source release** manually on `main` as a non-publishing dry run.
4. Tag that exact green `main` commit (`vX.Y.Z`) and push the tag.
5. Check the source-release manifest and anonymous asset verification, then
   verify ClawHub publication below.

## Verifying ClawHub

Check the **Publish skills to ClawHub** run itself, not the handoff job:

```bash
gh run download <publish-run-id> -D clawhub-report
npx -y clawhub@0.23.3 inspect worldwonderer/<slug>
```

In `clawhub-report.json`, every package's `finalVerification[].status` must reach
`DISTRIBUTION_VERIFIED`. A package still waiting on the registry's security scan
reports `PENDING_PUBLICATION` and can fail the writer job even if it goes live
minutes later—run `clawhub inspect` for each slug in `.clawhub/publish.json` and
confirm `latest=` matches the manifest `version`.

## Reruns

Diagnose the failure before rerunning any workflow. An already-uploaded release
asset is accepted only when its public bytes match the candidate archive; no
workflow deletes or overwrites release assets, and any API, auth, or network
error fails the run. You can re-dispatch ClawHub for the same tag and commit:

```bash
gh workflow run publish-clawhub.yml -f mode=release -f release_tag=vX.Y.Z \
  -f source_sha=<40-character tag commit> -f dry_run=false
```

Ownership, rights, version/hash, security-scan, and anonymous-audit checks still
apply on every re-dispatch.

This repository currently pins shared source-release controls to
`d098c09a27f8fe58ccf3a13a894ecc3804747b7c`. When upgrading that pin, update all
five references together (four in `release.yml` and one in
`deployment-readiness.yml`) so the source-bound pin check passes before merge.
The ClawHub writer pin is reviewed and updated separately.
