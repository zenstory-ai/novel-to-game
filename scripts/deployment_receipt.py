#!/usr/bin/env python3
"""Read-only source-associated deployment observation, never a deployment gate."""
import argparse
import json
import os
from pathlib import Path
import re
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen

REPOSITORY = "zenstory-ai/novel-to-game"
SITES = {
    "jinpingmei": "https://jinpingmei.vibecoco.ai",
    "xiyouji": "https://xiyouji.vibecoco.ai",
    "project-plateau": "https://plateau.vibecoco.ai",
}


def select_deployment(rows, project, sha):
    matches = [x for x in rows if x.get("environment") == "Production – " + project]
    if not matches:
        raise ValueError("missing production deployment for " + project)
    latest = max(matches, key=lambda x: int(x["id"]))
    if latest.get("sha") != sha or latest.get("creator", {}).get("login") != "vercel[bot]":
        raise ValueError("latest production deployment source/producer disagrees for " + project)
    return latest


def select_status(rows):
    if not rows:
        raise ValueError("production deployment status missing")
    latest = max(rows, key=lambda x: int(x["id"]))
    if latest.get("state") != "success" or latest.get("creator", {}).get("login") != "vercel[bot]":
        raise ValueError("latest production deployment status is not Vercel success")
    return latest


def make_receipt(sha, ci, projects):
    return {"schemaVersion": 1, "repository": REPOSITORY, "sourceSha": sha,
            "kind": "POST_DEPLOYMENT_OBSERVATION", "ci": ci, "projects": projects,
            "providerGate": "NOT_VERIFIED", "customDomainSourceBinding": "NOT_VERIFIED",
            "note": "GitHub reports source-associated deployment IDs. Public reachability is not proof that custom domains serve those exact bytes, nor a pre-promotion CI gate."}


def github(path):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "zenstory-readiness/1",
               "X-GitHub-Api-Version": "2022-11-28"}
    if os.getenv("GH_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["GH_TOKEN"]
    # No caller-supplied host; this credential is used only for GitHub reads.
    with urlopen(Request("https://api.github.com/repos/" + REPOSITORY + path, headers=headers), timeout=30) as response:
        return json.load(response)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def reachable(origin):
    # Fixed public origins, no credentials or redirect following.
    with build_opener(NoRedirect()).open(Request(origin, method="HEAD"), timeout=20) as response:
        if response.status != 200:
            raise ValueError("public origin is not HTTP 200")
        return response.status


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sha", required=True)
    parser.add_argument("--ci-proof", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not re.fullmatch("[0-9a-f]{40}", args.sha):
        raise ValueError("source must be a full commit SHA")
    proof = json.loads(args.ci_proof.read_text())
    if proof.get("repository") != REPOSITORY or proof.get("sourceSha") != args.sha or not proof.get("ci"):
        raise ValueError("preceding exact source CI proof disagrees")
    rows = github("/deployments?per_page=100")
    projects = []
    for project, origin in SITES.items():
        deployment = select_deployment(rows, project, args.sha)
        status = select_status(github(f"/deployments/{deployment['id']}/statuses?per_page=100"))
        projects.append({"project": project, "githubDeploymentId": deployment["id"],
                         "githubStatusId": status["id"], "reportedSourceSha": deployment["sha"],
                         "origin": origin, "httpStatus": reachable(origin)})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(make_receipt(args.sha, proof["ci"], projects), indent=2) + "\n")


if __name__ == "__main__":
    main()
