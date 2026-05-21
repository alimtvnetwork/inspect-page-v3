# CI Templates Inventory

> **Version:** 1.0.0
> **Updated:** 2026-04-19

Ready-to-paste workflow files per CI platform. All call the same
`linters-cicd/run-all.sh` and consume the same SARIF output, so behavior
is identical across platforms.

---

## Shipped templates

| Platform | File | Findings surface as |
|----------|------|---------------------|
| GitHub Actions | `linters-cicd/ci/github-actions.yml` | Code Scanning (Security tab) + PR annotations |
| GitHub composite | `linters-cicd/action.yml` | Same as above, one-liner via `uses:` |
| GitLab CI | `linters-cicd/ci/gitlab-ci.yml` | Code Quality MR widget + SAST report |
| Azure DevOps | `linters-cicd/ci/azure-pipelines.yml` | SARIF SAST extension |
| Bitbucket Pipelines | `linters-cicd/ci/bitbucket-pipelines.yml` | Pipeline log + report artifact |
| Jenkins | `linters-cicd/ci/Jenkinsfile` | Warnings-NG plugin |
| Pre-commit hook | `linters-cicd/ci/pre-commit-hook.sh` | Local block before push |

---

## Other platforms (CircleCI, TeamCity, Drone, …)

Not shipped as templates. Users wire them themselves using the contract:

```bash
# 1. Install
curl -fsSL https://github.com/alimtvnetwork/coding-guidelines-v23/releases/latest/download/install.sh | bash

# 2. Run
./linters-cicd/run-all.sh --path . --format sarif --output coding-guidelines.sarif

# 3. Upload artifact + fail build on exit code 1
```

---

## GitHub composite Action — usage

```yaml
- uses: alimtvnetwork/coding-guidelines-v23/linters-cicd@v3.9.0
  with:
    path: .
    languages: go,typescript     # optional, default: auto-detect
    severity: error              # optional, default: error
    fail-on-warning: false       # optional, default: false
```

---

*Part of [CI/CD Integration](./00-overview.md)*
