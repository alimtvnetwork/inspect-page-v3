# Decision: ignore `linters-cicd/**/fixtures/**` in ESLint

`linters-cicd/checks/_template/fixtures/dirty.ts` is a **fixture** that intentionally contains a `debugger` statement to trigger TEMPLATE-001 in the project's own linter tests. ESLint's `no-debugger` was flagging it as a real error.

**Fix:** Added `linters-cicd/**/fixtures/**` to the `ignores` list in `eslint.config.js`.

**Never repeat:** Do not "clean up" violations in any fixture under `linters-cicd/`. Those files MUST stay dirty.
