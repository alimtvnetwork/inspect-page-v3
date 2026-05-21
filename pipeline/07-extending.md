# 07 — Extending the Pipeline

Every extension point lives in a single, well-known location. Adding a
new artifact, validator, or workflow should never require editing
unrelated files.

## Adding a validator

1. Create `scripts/ci/check-<thing>.mjs`. Conventions:
   - Pure Node 20 (no dependencies).
   - Print a one-line `OK` summary on success.
   - Print a multi-line diagnosis on failure and `process.exit(1)`.
   - Accept `--expect <value>` when applicable.
2. Add a row to `pipeline/04-validation-scripts.md`.
3. Add the invocation to the `verify` job in `.github/workflows/ci.yml`
   and to the `release` job in `.github/workflows/release.yml`.
4. Optionally run it locally first: `node scripts/ci/check-<thing>.mjs`.

## Adding a release asset

1. Produce the asset in a build step that writes to `public/<name>`.
2. Add a sibling `public/<name>.sha256` and teach
   `check-zip-freshness.mjs` about it (extend the `FILES` array).
3. Update `release.yml` → `release` job → asset upload list.
4. Document the asset in `pipeline/03-release-workflow.md` §"Asset
   Naming".

## Adding a new workflow

1. New file under `.github/workflows/`.
2. Pin every action to a major version (`@v4`, not `@latest`).
3. Use the same Bun + Node + cache pattern as `ci.yml` so cache keys
   stay compatible.
4. Document the workflow in `pipeline/readme.md` under "Quick Overview"
   and reference it from this file.

## Adding a new target (third artifact)

If a future artifact is added (for example a Firefox build):

1. Pick a target slug: `ext-ff`, `wp-pro`, etc.
2. Extend the ref-pattern table in
   `pipeline/03-release-workflow.md` §"Ref Pattern → Target Resolution".
3. Add a matching build job to `release.yml` gated on
   `if: needs.setup.outputs.target == '<slug>'`.
4. Add `.gitmap/release/<slug>-vX.Y.Z.json` schema rows (the writer in
   `release-watcher.yml` already infers from the tag, so no code change
   needed there).

## Updating the Bun / Node version

1. Bump `oven-sh/setup-bun@v2` `bun-version` in every workflow.
2. Bump `actions/setup-node@v4` `node-version` in every workflow.
3. Bump the matching versions in `pipeline/01-architecture.md` §
   "Technology Stack" and `pipeline/02-ci-workflow.md` §"Job
   Descriptions / setup".
4. Update `package.json` `engines` if defined.
5. Run the full CI on a feature branch once before merging.

## Updating a banned-dependency pin

1. Edit `security-notes/<pkg>-pin.md`.
2. Mirror the change in `scripts/ci/check-<pkg>-version.mjs`.
3. CI will start failing the moment a `package.json` violates the new
   rule.