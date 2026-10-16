# Agent instructions

## PR policy

- Open draft pull requests. Push in batches. Keep at most 3 open pull requests per agent. Bundle small changes into one pull request.
- Do not run full local builds or tests. CI is the check.
- Self-merge with squash only when CI is fully green and the change is application code, content, or docs. Do not self-merge workflows, deploy or infrastructure, secrets or env, or major dependency bumps. A human merges those.
- Delete the branch after merge. Close or rebase pull requests that have been stale for more than 3 days.

## CI

`.github/workflows/demos1.yml` is the pull-request fast tier.

- Path filters limit runs to `apps/demos1/**`, `packages/**`, the workspace manifests, the lockfile, and this workflow file. A demos1 change still builds the whole hosted app, because the demos are one Vite program. Example-only paths do not start this workflow.
- Draft pull requests skip the build. Mark the pull request ready when it should be checked.
- In-progress runs are cancelled only for `pull_request`. Pushes to `main` are not cancelled.
- The build job times out at 10 minutes. Deploy stays `workflow_dispatch` with `deploy=true`, on `ubuntu-latest`, and does not change secrets.
