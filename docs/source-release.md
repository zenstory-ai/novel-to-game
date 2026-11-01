# Source release

This repository publishes a tracked-source archive through the reviewed shared
ZenStory source-release controls.

## Contract

- `.release/policy.json` is source-bound and names every version authority, the
  dated changelog, exact installable files, exclusions, and exact main CI jobs.
- Pull requests run a read-only contract/archive validation.
- `workflow_dispatch` is allowed only on `main` and never publishes. It also
  proves the exact main commit's configured CI runs.
- Only a stable `vX.Y.Z` tag push whose version and dated changelog agree can
  publish. The tag commit must be on protected `main` with successful exact-SHA
  CI. Assets are append-only; a same-name byte mismatch fails rather than
  overwriting.
- After GitHub source assets pass anonymous byte verification, a separate job
  dispatches the **Publish skills to ClawHub** workflow with the exact tag and
  40-character source SHA. Its `CLAWHUB_QUEUED` result only means the dispatch
  was accepted.

## Release procedure

1. Update all version authorities together and add a dated changelog heading.
2. Merge through the existing product and ClawHub inventory checks.
3. Run **Source release** manually on `main` as a nonpublishing dry-run.
4. Create the reviewed stable tag from that exact green main commit and push it.
5. Check the source-release manifest and anonymous asset verification, then
   verify ClawHub as below.

## Verifying ClawHub

Read the result from the **Publish skills to ClawHub** run, not from the
dispatch job:

```bash
gh run download <publish-run-id> -D clawhub-report
npx -y clawhub@0.23.3 inspect worldwonderer/<slug>
```

In the downloaded `clawhub-report.json`, each package's
`finalVerification[].status` should be `DISTRIBUTION_VERIFIED`. A package still
in the registry's publication scan shows `PENDING_PUBLICATION` and can fail the
writer job even though it publishes minutes later, so run `clawhub inspect` for
every slug in `.clawhub/publish.json` and compare its `latest=` with the
`version` there.

## Reruns

Diagnose the failing channel before rerunning a workflow attempt. An asset
already uploaded is accepted only when its public bytes match the same
candidate; no workflow deletes or overwrites release assets, and an API, auth or
network error fails the run. ClawHub can be re-dispatched for the same tag and
commit:

```bash
gh workflow run publish-clawhub.yml -f mode=release -f release_tag=vX.Y.Z \
  -f source_sha=<40-character tag commit> -f dry_run=false
```

The writer's ownership, rights, version/hash, scan and anonymous-audit checks
still apply on a re-dispatch.

The caller currently pins shared source controls to `d098c09a27f8fe58ccf3a13a894ecc3804747b7c`.
When upgrading controls, change every reference together (four in
`release.yml`, one in `deployment-readiness.yml`) and pass the source-bound pin
contract before merging. The separate ClawHub writer pin is
unchanged and remains independently reviewed.
