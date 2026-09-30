---
name: release-cli
description: Release chofex-cli and hacktheandes-cli to npm and GitHub. Use when asked to publish the CLI, and after changes that can affect the installed CLI under apps/cli, its bundled workspace dependencies, the lockfile, or its publishing workflow.
---

# Release CLI

Use `.github/workflows/publish-cli.yml` as the single release path.
The workflow publishes the same CLI under `chofex-cli` and `hacktheandes-cli`.
Both npm packages install `andes` and `chofex`.

## Gate

1. Inspect the changes since the latest GitHub release, or the repository's
   history when no release exists. Account for changes in `apps/cli`, the
   workspace packages bundled by it, `bun.lock`, and the publishing workflow.
2. Resolve the candidate's full commit SHA and show it with the CLI impact. Ask
   the user to approve that exact SHA. Record the approved SHA as an immutable
   value for every later step; do not derive it from `HEAD` again.
3. Release only committed code from the remote default branch. Keep unrelated
   working-tree files out of the release commit. If the skill was invoked by
   detected CLI work rather than a release request, this approval is the point
   where the user decides whether to release. Report other unpushed commits and
   ask before including them.

The gate is complete when the user has approved the exact commit that will be
released and that commit is the remote default branch tip.

## Run

1. Resolve the default branch and verify its remote tip still equals the
   recorded approved commit:

   ```sh
   default_branch="$(gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name')"
   approved_sha="<full SHA approved above>"
   remote_sha="$(git ls-remote origin "refs/heads/${default_branch}" | cut -f1)"
   test "$approved_sha" = "$remote_sha"
   ```

2. Give the automatic push run 30 seconds to appear:

   ```sh
   automatic_run_id=""
   for attempt in 1 2 3 4 5 6; do
     if ! automatic_run_id="$(gh run list --workflow publish-cli.yml --event push \
       --commit "$approved_sha" --limit 1 --json databaseId \
       --jq '.[0].databaseId // empty')"; then
       echo "Could not inspect automatic release runs; refusing to dispatch a duplicate." >&2
       exit 1
     fi
     if [[ -n "$automatic_run_id" ]]; then break; fi
     if [[ "$attempt" -lt 6 ]]; then sleep 5; fi
   done
   ```

3. When an automatic run exists, verify its SHA and watch it through
   completion. If it fails, follow the recovery rule below. A successful run
   can still have skipped `Publish chofex-cli`; do not treat that as a release:

   ```sh
   run_id="$automatic_run_id"
   if [[ -n "$run_id" ]]; then
     gh run view "$run_id" --json databaseId,headSha,status,conclusion,url
     test "$(gh run view "$run_id" --json headSha --jq '.headSha')" = "$approved_sha"
     gh run watch "$run_id" --exit-status
     publish_conclusion="$(gh run view "$run_id" --json jobs \
       --jq '.jobs[] | select(.name == "Publish chofex-cli") | .conclusion // empty')"
     if [[ "$publish_conclusion" == "skipped" ]]; then run_id=""; fi
     if [[ -n "$run_id" ]]; then test "$publish_conclusion" = "success"; fi
   fi
   ```

4. If no automatic run exists, or its publish job was skipped, dispatch the
   exact approved commit. `workflow_dispatch` forces the publish job after
   validating the commit against the remote default-branch tip:

   ```sh
   if [[ -z "$run_id" ]]; then
     run_url="$(gh workflow run publish-cli.yml --ref "$default_branch" \
       -f commit_sha="$approved_sha")"
     run_id="${run_url##*/}"
   fi
   test -n "$run_id"
   ```

5. Read the selected run by its captured ID and verify it uses the approved
   commit:

   ```sh
   gh run view "$run_id" \
     --json databaseId,headSha,status,conclusion,url
   ```

6. If the captured run already completed unsuccessfully, inspect it with
   `gh run view <run-id> --log-failed`. Fix the cause and obtain fresh approval.
   If the approved SHA remains the remote default-branch tip, rerun it with
   `gh run rerun <run-id>`; if the fix changed code, restart at the Gate with
   the new SHA.
7. Watch the run through completion with `gh run watch <run-id> --exit-status`.
   Verify `headSha` equals the approved SHA. Apply the same recovery rule to a
   new failure; do not keep re-watching a terminal failed run.

## Verify

Inspect GitHub's latest release, verify it targets the approved commit, then
compare its tag with both npm packages' `latest` versions:

```sh
npm_version="$(npm --prefix apps/cli --workspaces=false view chofex-cli version)"
andes_version="$(npm --prefix apps/cli --workspaces=false view hacktheandes-cli version)"
repository="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
release_tag="$(gh api "repos/${repository}/releases/latest" --jq '.tag_name')"
release_target="$(gh release view "$release_tag" --json targetCommitish --jq '.targetCommitish')"
gh release view "$release_tag" \
  --json tagName,isDraft,publishedAt,url,targetCommitish
test "$release_tag" = "v${npm_version}"
test "$andes_version" = "$npm_version"
test "$release_target" = "$approved_sha"
```

The release is complete only when the workflow succeeded, npm returns the new
version for both packages, the matching non-draft GitHub release targets the
approved commit, and GitHub marks it as latest. npm propagation may take a few minutes; use bounded
retries before reporting a mismatch. Report the version, both npm package URLs,
GitHub release URL, and workflow run URL.
