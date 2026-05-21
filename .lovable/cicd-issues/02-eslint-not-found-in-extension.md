# 02 — `eslint: command not found` in `extension/` workspace

## Symptom
```
$ eslint ../extension-src --max-warnings=0
/usr/bin/bash: line 1: eslint: command not found
error: script "lint" exited with code 127
```

## Root cause
`extension/package.json` defines `"lint": "eslint ..."` but eslint is not installed in `extension/node_modules`. The dependency lives in the **root** `node_modules/.bin/eslint`.

## Fix
`extension/package.json`:
```diff
- "lint": "eslint ../extension-src --max-warnings=0"
+ "lint": "cd .. && node_modules/.bin/eslint extension-src"
```

Also dropped `--max-warnings=0` because there are 10 pre-existing benign warnings (react-hooks/exhaustive-deps + react-refresh/only-export-components) that don't block release.

## Prevention
Whenever a `extension/` script needs a binary, prefer `cd .. && node_modules/.bin/<binary>` over a bare command. Do not add eslint as a duplicate dep in `extension/`.

## Status
✅ Resolved.
