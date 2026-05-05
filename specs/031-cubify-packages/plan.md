# Implementation Plan: Feature 031 — cubify-packages

**Branch**: `main` | **Date**: 2026-05-04 | **Spec**: [spec.md](spec.md)

## Summary

Restructure the cubify repo as an npm workspace (`packages/cubify/` + `packages/cubify-react/`), add a `tsc` build producing `dist/` for each package, publish both to GitHub Packages on a version tag, and migrate cfop-app from the local Vite alias to the published packages. Both packages version lockstep; `three` and `cubing.js` are peer deps.

## Technical Context

| Item | Value |
|------|-------|
| Language | TypeScript (ESM `.ts` / `.tsx`) |
| Package manager | npm workspaces |
| Build | `tsc -p tsconfig.build.json` → `dist/` per package (JS + declarations) |
| Registry | GitHub Packages (`npm.pkg.github.com`) |
| Versioning | Lockstep — single `v*.*.*` tag publishes both packages |
| Peer deps | `three ^0.170.0`, `cubing ^0.63.3` (both); `react ^18\|\|^19`, `react-dom` (cubify-react only) |
| CI publish | cubify repo `publish.yml` — tag-triggered, `GITHUB_TOKEN` auth |
| CI install | cfop `deploy.yml` — `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` |

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| No build step in core library | DEVIATION — JUSTIFIED | Build step added for npm packaging only; source stays Vite-served TS for harness/dev. Constitution written for 022–026; 031 is the deliberate packaging evolution. |
| Public API surface only | PASS | Packages expose only existing public API; no internals leaked |
| cubing.js not re-exported | PASS | Stays internal; listed as peerDep to avoid version conflicts |
| Module responsibility boundaries | PASS | No boundary changes |
| 60 fps animation | PASS | No rendering changes |

## Project Structure

See [data-model.md](data-model.md) for full layout and package.json shapes.

```
cubify/
  package.json                    <- UPDATE: workspaces + root scripts
  packages/
    cubify/                       <- @andyjudson/cubify (NEW package dir)
      src/                        <- MOVE from root src/
      test/                       <- MOVE from root test/
      dist/                       <- tsc output (gitignored)
      package.json / tsconfig.build.json  <- NEW
    cubify-react/                 <- @andyjudson/cubify-react (NEW)
      src/                        <- MOVE from cfop-app/src/lib/cubify/
      dist/                       <- tsc output (gitignored)
      package.json / tsconfig.build.json  <- NEW
  cubify-harness/                 <- stays at root; update src import path
  cubify-scripts/                 <- stays at root; unchanged
  scripts/version-bump.sh         <- NEW
  .github/workflows/publish.yml   <- NEW

cfop/
  cfop-app/.npmrc                 <- NEW
  cfop-app/package.json           <- UPDATE: add scoped packages
  cfop-app/vite.config.ts         <- UPDATE: CUBIFY_LOCAL conditional alias
  cfop-app/src/lib/cubify/        <- DELETE
  .github/workflows/deploy.yml    <- UPDATE: add auth
```

---

## Implementation Phases

### Phase 1 — Workspace restructure (cubify repo)

**T01** — Update root `package.json` to workspace root

Remove `main`, `types`, `exports`, `peerDependencies` from root. Add:
```json
{
  "name": "cubify-workspace",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "vitest run",
    "dev": "cd cubify-harness && vite",
    "typecheck": "npm run typecheck --workspaces"
  }
}
```
Move `cubing`, `three`, `typescript`, `vite`, `vitest`, `sharp` to root `devDependencies`.

---

**T02** — Create `packages/cubify/` with `package.json` + `tsconfig.build.json`

See [data-model.md](data-model.md) for full package.json shape. Key points:
- `"name": "@andyjudson/cubify"`, `"version": "1.0.0"`
- `"publishConfig": { "registry": "https://npm.pkg.github.com" }`
- `"exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } }`
- `"files": ["dist"]`
- `"peerDependencies": { "cubing": "^0.63.3", "three": "^0.170.0" }`

`tsconfig.build.json` emits JS + declarations into `dist/`. No `paths` overrides — deps resolve from workspace root `node_modules`.

---

**T03** — Move `src/` → `packages/cubify/src/`; clean up root stubs

Move all `.ts` files. Internal relative imports are unchanged.
Add `packages/cubify/tsconfig.json` for IDE/typecheck (extends root tsconfig).

Also clean up the root stubs that are now superseded:
- Delete `types/` at repo root (declarations are now generated per-package into `packages/cubify/dist/`)
- Remove `paths` overrides from root `tsconfig.json` that referenced `cubify-harness/node_modules` for `three` and `cubing` — deps now resolve from workspace root `node_modules` naturally
- Remove `main`, `types`, `exports` entries from root `tsconfig.json` if present

---

**T04** — Move `test/` → `packages/cubify/test/`

Move all test files. Import paths (`../src/...`) remain correct relative to new location.
Update root `package.json` test script to `vitest run` with root-level `vitest.config.ts` pointing at `packages/cubify/test/`.
Verify 181 tests pass.

---

**T05** — Create `packages/cubify-react/` with `package.json` + `tsconfig.build.json`

See [data-model.md](data-model.md) for full shape. Key points:
- `"name": "@andyjudson/cubify-react"`, `"version": "1.0.0"`
- `peerDependencies`: `@andyjudson/cubify ^1.0.0`, `react ^18||^19`, `react-dom`
- `devDependencies`: `"@andyjudson/cubify": "workspace:*"` (workspace link for dev)

`tsconfig.build.json` adds `"jsx": "react-jsx"`.

---

**T06** — Populate `packages/cubify-react/src/`

Copy the 4 component files + `index.ts` from `cfop-app/src/lib/cubify/`. Do not delete the cfop-app copies yet (Phase 4).

Update any `from 'cubify'` imports within wrapper files → `from '@andyjudson/cubify'`.

---

**T07** — Update `cubify-harness/` import paths

```js
// Before
import { ... } from '../src/index.ts';
// After
import { ... } from '../packages/cubify/src/index.ts';
```

Direct relative import — no Vite alias needed. Apply to both `index.html` and `renderer.html`.

---

**T08** — Update `.gitignore`

Add `packages/*/dist` (alongside existing `dist/` entry).

---

### Phase 2 — Build verification

**T09** — Verify `@andyjudson/cubify` builds

```bash
npm run build --workspace=packages/cubify
```

`packages/cubify/dist/` must contain `index.js` + `*.d.ts` for all modules. Fix any `allowImportingTsExtensions` errors (internal `.ts` extension imports must become `.js` in build tsconfig).

---

**T10** — Verify `@andyjudson/cubify-react` builds

```bash
npm run build --workspace=packages/cubify-react
```

`packages/cubify-react/dist/` must contain `index.js` + `*.d.ts`.

---

**T11** — Verify Vitest suite passes

```bash
npm test
```

181 tests, 10 skipped — all pass.

---

### Phase 3 — GitHub Actions publish workflow

**T12** — Add `.github/workflows/publish.yml` to cubify repo

```yaml
name: Publish to GitHub Packages

on:
  push:
    tags: ['v*.*.*']

permissions:
  contents: read
  packages: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          registry-url: https://npm.pkg.github.com
      - run: npm ci
      - run: npm run build --workspace=packages/cubify
      - run: npm run build --workspace=packages/cubify-react
      - run: npm publish --workspace=packages/cubify
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - run: npm publish --workspace=packages/cubify-react
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

**T13** — Add `scripts/version-bump.sh`

```bash
#!/usr/bin/env bash
set -e
VERSION=$1
[ -z "$VERSION" ] && echo "Usage: $0 <version>" && exit 1
npm version "$VERSION" --workspace=packages/cubify --no-git-tag-version
npm version "$VERSION" --workspace=packages/cubify-react --no-git-tag-version
git add packages/cubify/package.json packages/cubify-react/package.json
git commit -m "chore: release v$VERSION"
git tag "v$VERSION"
echo "Tagged v$VERSION — push with: git push && git push --tags"
```

---

### Phase 4 — cfop-app migration

**T14** — Add `cfop-app/.npmrc`

```
@andyjudson:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_AUTH_TOKEN}
```

For local dev: set `NPM_AUTH_TOKEN` to a GitHub PAT with `read:packages`.

---

**T15** — Update `cfop-app/package.json` dependencies

Add to `dependencies`:
```json
"@andyjudson/cubify": "^1.0.0",
"@andyjudson/cubify-react": "^1.0.0"
```

---

**T16** — Update `cfop-app/vite.config.ts` with `CUBIFY_LOCAL` dev override

Replace the hard-coded `cubify` alias with a `CUBIFY_LOCAL`-conditional block. Production (and CI) use the installed packages; local cross-repo development sets `CUBIFY_LOCAL=1` to bypass the registry entirely:

```ts
const CUBIFY_LOCAL = process.env.CUBIFY_LOCAL === '1';

export default defineConfig({
  resolve: {
    alias: CUBIFY_LOCAL ? {
      '@andyjudson/cubify':
        resolve(__dirname, '../../cubify/packages/cubify/src/index.ts'),
      '@andyjudson/cubify-react':
        resolve(__dirname, '../../cubify/packages/cubify-react/src/index.ts'),
    } : {},
    dedupe: ['cubing'],
  },
})
```

Local dev workflow:
```bash
CUBIFY_LOCAL=1 npm run dev   # aliases bypass npm, point straight at source
npm run dev                  # uses installed @andyjudson/* packages
```

No `.env` file needed — the env var is set per-run. This means CI never picks it up accidentally.

---

**T17** — Update cfop-app source imports

Replace throughout `cfop-app/src/`:
- `from 'cubify'` → `from '@andyjudson/cubify'`
- `from '../lib/cubify'` or `from './lib/cubify'` → `from '@andyjudson/cubify-react'`

---

**T18** — Delete `cfop-app/src/lib/cubify/`

After T17 builds cleanly, remove the local wrapper directory.

---

**T19** — Update `cfop/.github/workflows/deploy.yml`

```yaml
- name: Setup Node
  uses: actions/setup-node@v4
  with:
    node-version: 24
    cache: npm
    cache-dependency-path: cfop-app/package-lock.json
    registry-url: https://npm.pkg.github.com

- name: Install dependencies
  run: cd cfop-app && npm ci
  env:
    NPM_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

### Phase 5 — End-to-end verification

**T20** — Dry-run publish

```bash
npm publish --workspace=packages/cubify --dry-run
npm publish --workspace=packages/cubify-react --dry-run
```

Verify tarball contains `dist/` only (not `src/` or `test/`).

---

**T21** — Publish `1.0.0`

```bash
bash scripts/version-bump.sh 1.0.0
git push && git push --tags
```

Verify both packages appear at `https://github.com/andyjudson?tab=packages`.

---

**T22** — Fresh clone verification

Clone cfop to a temp directory, set `NPM_AUTH_TOKEN`, run `npm ci` + `npm run build`. Must succeed without a local cubify checkout.

---

### Phase 6 — Documentation

**T23** — Write `specs/031-cubify-packages/quickstart.md`

Cover:
- Prerequisites: `.npmrc` setup (GitHub PAT with `read:packages` for external consumers; `GITHUB_TOKEN` sufficient in CI)
- Install: `npm install @andyjudson/cubify @andyjudson/cubify-react` + peer deps
- Usage: updated import paths (`from '@andyjudson/cubify'`, `from '@andyjudson/cubify-react'`) — carry forward the usage examples from 029 quickstart with corrected imports
- Local dev: the `CUBIFY_LOCAL=1` workflow — when to use it, how to set it, that CI never uses it
- Note for external consumers: GitHub Packages requires auth even for public packages; a PAT is needed

---

**T24** — Update `specs/029-cubify-react/quickstart.md` and CLAUDE.md

In `029/quickstart.md`: add a header note that the Vite alias + local path setup from feature 029 is superseded by feature 031; link to `specs/031-cubify-packages/quickstart.md`.

In `CLAUDE.md` (cubify repo): document the `CUBIFY_LOCAL=1` local dev workflow in the Working Style section so future sessions know it exists.

---

## Key Design Decisions

1. **Direct relative imports in harness** — the harness imports from `../packages/cubify/src/index.ts` directly rather than via workspace resolution. Simpler; avoids Vite dedupe edge cases with symlinks.

2. **Copy React wrappers before deleting cfop-app local copy** — T06 (copy + build) completes before T18 (delete). No broken intermediate state.

3. **Root devDeps hold shared tooling** — `vitest`, `vite`, `typescript`, `cubing`, `three` at workspace root. Sub-packages re-declare them as devDeps for explicitness; npm hoists to avoid duplicate installs.

4. **`workspace:*` in dev, resolved version in publish** — npm replaces `workspace:*` with the actual version on publish. `cubify-react` peer-depends on `@andyjudson/cubify ^1.0.0` in the published package.

5. **`GITHUB_TOKEN` for both publish and install** — no additional secrets. Has `packages:write` in cubify CI and implicit `packages:read` in cfop deploy CI.

6. **`CUBIFY_LOCAL=1` preserves the local dev workflow** — removing the Vite alias entirely would break simultaneous cubify + cfop-app development. The conditional alias restores the pre-031 dev experience (no build step, live TypeScript source) when set. CI never sets it so production always uses the published packages.
