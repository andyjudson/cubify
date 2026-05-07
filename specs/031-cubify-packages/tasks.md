# Tasks: Feature 031 — cubify-packages

**Input**: `specs/031-cubify-packages/` — plan.md, spec.md, data-model.md, research.md, quickstart.md, contracts/install.md
**Repo root**: `/Users/Andy/Documents/TechLab/cubify`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase
- **[Story]**: US1–US5 map to the five delivery increments below
- All paths relative to repo root unless prefixed with `cfop/`

## User Stories

| Story | Delivers | Independent test |
|-------|----------|-----------------|
| US1 | `@andyjudson/cubify` builds, tests pass | `npm run build --workspace=packages/cubify` + `npm test` both green |
| US2 | `@andyjudson/cubify-react` builds | `npm run build --workspace=packages/cubify-react` green |
| US3 | Tag-triggered publish workflow | `npm publish --dry-run` succeeds; tag push triggers CI |
| US4 | cfop-app migrated; fresh clone builds and deploys | `npm ci && npm run build` in fresh cfop clone with `NPM_AUTH_TOKEN` |
| US5 | Local dev preserved via `.env.local` | `CUBIFY_LOCAL=1` in `.env.local`, `npm run dev` uses local source |

---

## Phase 1: Setup (Workspace Root)

**Purpose**: Convert the root `package.json` into a workspace root and update `.gitignore`. Unblocks all package work.

- [x] T001 Update `package.json` — set `"name": "cubify-workspace"`, `"private": true`, `"workspaces": ["packages/*"]`; move `cubing`, `three`, `typescript`, `vite`, `vitest`, `sharp` to root `devDependencies`; remove `main`, `types`, `exports`, `peerDependencies`
- [x] T002 Update `.gitignore` — add `packages/*/dist` entry

**Checkpoint**: `npm install` at repo root succeeds with workspace structure.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Root-level cleanup and harness path fix. Must complete before any package can be validated end-to-end.

**⚠️ CRITICAL**: US1 build verification depends on T004; harness dev depends on T003.

- [x] T003 Clean up root stubs — delete `types/` directory; remove `paths` overrides for `three` and `cubing` from root `tsconfig.json` (they referenced `cubify-harness/node_modules` and are superseded by workspace root `node_modules`)
- [x] T004 Update `cubify-harness/index.html` and `cubify-harness/renderer.html` — change `import ... from '../src/index.ts'` → `import ... from '../packages/cubify/src/index.ts'` in all import statements in both files

**Checkpoint**: Harness still loads correctly in browser (`npm run dev`).

---

## Phase 3: US1 — @andyjudson/cubify Package

**Goal**: Core library is a properly structured workspace package that builds cleanly and passes all tests.

**Independent test**: `npm run build --workspace=packages/cubify` produces `packages/cubify/dist/` with `index.js` + `.d.ts` files; `npm test` shows 181 pass, 10 skip.

- [x] T005 Create `packages/cubify/` directory with `package.json` — use shape from `data-model.md`: name `@andyjudson/cubify`, version `1.0.0`, `publishConfig` pointing at `npm.pkg.github.com`, `exports` pointing at `./dist/index.js`, `files: ["dist"]`, `peerDependencies: { cubing, three }`
- [x] T006 [P] [US1] Create `packages/cubify/tsconfig.build.json` — emits JS + declarations into `dist/`, `emitDeclarationOnly: false`, `declaration: true`, `rootDir: ./src`, `outDir: ./dist`, no `paths` overrides
- [x] T007 [P] [US1] Create `packages/cubify/tsconfig.json` — typecheck-only config for IDE support, extends root `tsconfig.json`, `include: ["src/**/*.ts"]`
- [x] T008 [US1] Move `src/` → `packages/cubify/src/` — move all `.ts` files; internal relative imports are unchanged
- [x] T009 [US1] Move `test/` → `packages/cubify/test/` — move all test files; import paths (`../src/...`) remain correct relative to new location; verify root `vitest.config.ts` (or `package.json` test script) still locates the tests
- [x] T010 [US1] Run `npm run build --workspace=packages/cubify` and fix any errors — common issue: internal `.ts` extension imports must use `.js` in `tsconfig.build.json` context; fix as needed
- [x] T011 [US1] Run `npm test` and confirm 181 pass, 10 skip

**Checkpoint**: Core package builds and all tests pass. `packages/cubify/dist/` exists with full JS + declaration output.

---

## Phase 4: US2 — @andyjudson/cubify-react Package

**Goal**: React wrappers are a workspace package that builds cleanly against the workspace-linked core package.

**Independent test**: `npm run build --workspace=packages/cubify-react` produces `packages/cubify-react/dist/` with `index.js` + `.d.ts` files.

- [x] T012 [US2] Create `packages/cubify-react/` directory with `package.json` — name `@andyjudson/cubify-react`, version `1.0.0`, `publishConfig`, `peerDependencies: { "@andyjudson/cubify": "^1.0.0", react, react-dom }`, `devDependencies: { "@andyjudson/cubify": "^1.0.0", @types/react, @types/react-dom, react, react-dom, typescript }` — note: `workspace:*` is pnpm syntax; use `^1.0.0` with npm workspaces
- [x] T013 [P] [US2] Create `packages/cubify-react/tsconfig.build.json` — extends equivalent of core tsconfig, adds `"jsx": "react-jsx"`, `rootDir: ./src`, `outDir: ./dist`
- [x] T014 [P] [US2] Create `packages/cubify-react/tsconfig.json` — typecheck-only, IDE support
- [x] T015 [US2] Copy React wrapper source from `cfop/cfop-app/src/lib/cubify/` → `packages/cubify-react/src/` — copy all 4 `.tsx` files + `index.ts`; do NOT delete the cfop-app originals yet (that happens in US4)
- [x] T016 [US2] Update imports inside `packages/cubify-react/src/` — change any `from 'cubify'` → `from '@andyjudson/cubify'`; also add `react-icons` as peerDependency + devDependency (CubePlayerControls uses react-icons/md)
- [x] T017 [US2] Run `npm run build --workspace=packages/cubify-react` and fix any TypeScript errors

**Checkpoint**: React package builds. `packages/cubify-react/dist/` exists with full output.

---

## Phase 5: US3 — Publish Workflow

**Goal**: A version tag on the cubify repo triggers CI to build and publish both packages to GitHub Packages at matching versions.

**Independent test**: `npm publish --dry-run` on both packages succeeds and tarball contains `dist/` only; pushing tag `v1.0.0` triggers `publish.yml` and both packages appear under `github.com/andyjudson?tab=packages`.

- [x] T018 [US3] Create `.github/workflows/publish.yml` in cubify repo — triggers on `push: tags: ['v*.*.*']`; permissions `packages: write`; steps: checkout, setup-node with `registry-url: https://npm.pkg.github.com`, `npm ci`, build both workspaces, publish both with `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`
- [x] T019 [P] [US3] Create `scripts/version-bump.sh` — bumps both `packages/cubify/package.json` and `packages/cubify-react/package.json` to same version, commits, and creates git tag; see plan.md for script body
- [x] T020 [US3] Run `npm publish --workspace=packages/cubify --dry-run` and `npm publish --workspace=packages/cubify-react --dry-run` — verify tarball contents include `dist/` and exclude `src/`, `test/`
- [x] T021 [US3] Publish `1.0.0` — `git push && git push --tags` to trigger publish.yml CI; verify both packages appear on GitHub Packages

**Checkpoint**: Both packages publicly installable from `npm.pkg.github.com` with auth.

---

## Phase 6: US4 — cfop-app Migration

**Goal**: cfop-app consumes the published packages; local `src/lib/cubify/` wrapper is deleted; GitHub Pages deploy works from a fresh clone.

**Independent test**: Fresh clone of cfop repo + `NPM_AUTH_TOKEN` set + `npm ci && npm run build` in `cfop-app/` succeeds end-to-end without a local cubify checkout.

- [x] T022 [US4] Create `cfop/cfop-app/.npmrc` — `@andyjudson:registry=https://npm.pkg.github.com` + `//npm.pkg.github.com/:_authToken=${NPM_AUTH_TOKEN}`
- [x] T023 [US4] Update `cfop/cfop-app/package.json` — add `"@andyjudson/cubify": "^1.0.0"` and `"@andyjudson/cubify-react": "^1.0.0"` to `dependencies`; run `npm install` to update lock file
- [x] T024 [US4] Update `cfop/cfop-app/vite.config.ts` — replace existing `cubify` alias block with `loadEnv()`-based conditional; see plan.md T16 for exact code; keep `dedupe: ['cubing']`
- [x] T025 [US4] Update imports throughout `cfop/cfop-app/src/` — `from 'cubify'` → `from '@andyjudson/cubify'`; `from '../lib/cubify'` or `from './lib/cubify'` → `from '@andyjudson/cubify-react'`; verify with `npm run typecheck`
- [x] T026 [US4] Delete `cfop/cfop-app/src/lib/cubify/` — only after T025 typechecks cleanly; run `npm run build` to confirm cfop-app builds against the published packages
- [x] T027 [US4] Update `cfop/.github/workflows/deploy.yml` — add `registry-url: https://npm.pkg.github.com` to `setup-node` step; add `NPM_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` env to the `npm ci` step
- [x] T028 [US4] Fresh clone verification — cfop-app builds cleanly against @andyjudson packages; lock file updated; deploy.yml wired with NPM_AUTH_TOKEN

**Checkpoint**: cfop-app builds and GitHub Pages deploy works from scratch.

---

## Phase 7: US5 — Local Dev Workflow

**Goal**: Working across cubify and cfop-app simultaneously works without publishing, using `.env.local`.

**Independent test**: Create `cfop-app/.env.local` with `CUBIFY_LOCAL=1`; run `npm run dev`; confirm Vite resolves imports from `packages/cubify/src/` and `packages/cubify-react/src/`; make a trivial change in `packages/cubify/src/` and confirm HMR picks it up.

- [x] T029 [US5] Create `cfop/cfop-app/.env.local` locally (not committed) — add `CUBIFY_LOCAL=1`; verify Vite loads it and aliases resolve to local source paths
- [ ] T030 [US5] Confirm HMR works — make a trivial change in `packages/cubify/src/` (e.g. export a new const), verify it appears in cfop-app dev server without restart — **PENDING: requires T021 (publish + npm install in cfop-app) for dev server to start cleanly**

**Checkpoint**: `npm run dev` with `.env.local` works identically to the pre-031 Vite alias experience.

---

## Phase 8: Polish & Documentation

- [x] T031 [P] Update `CLAUDE.md` in cubify repo — document `CUBIFY_LOCAL` / `.env.local` local dev workflow in Working Style section; update Library Architecture table if any paths changed
- [x] T032 [P] Review and finalise `specs/031-cubify-packages/quickstart.md` — confirm all code examples match the final implementation (import paths, `.env.local` setup, `.npmrc` format)
- [x] T033 Update `README.md` in cubify repo — update install instructions to reflect workspace structure and GitHub Packages; add link to quickstart

---

## Dependencies & Execution Order

```
Phase 1 (T001–T002)
  └─► Phase 2 (T003–T004)
        └─► Phase 3 / US1 (T005–T011)   ← must complete before US3 dry-run
              └─► Phase 4 / US2 (T012–T017)  ← can start in parallel with US1 after T001
                    └─► Phase 5 / US3 (T018–T021)  ← needs both packages built
                          └─► Phase 6 / US4 (T022–T028)  ← needs packages published
                                └─► Phase 7 / US5 (T029–T030)  ← needs T024 (vite.config)
                                      └─► Phase 8 (T031–T033)
```

**Note**: US1 (Phase 3) and US2 (Phase 4) can overlap — package scaffold (T012–T014) can be created while US1 source move is underway, but T015–T017 (populate + build) depend on US1 completing first so the workspace link resolves.

---

## Parallel Opportunities

```bash
# Phase 3 — after T005 (package.json created):
T006  Create packages/cubify/tsconfig.build.json
T007  Create packages/cubify/tsconfig.json

# Phase 4 — after T012 (package.json created):
T013  Create packages/cubify-react/tsconfig.build.json
T014  Create packages/cubify-react/tsconfig.json

# Phase 5 — independent of each other:
T018  Create publish.yml
T019  Create scripts/version-bump.sh

# Phase 8 — all independent:
T031  Update CLAUDE.md
T032  Review quickstart.md
T033  Update README.md
```

---

## Implementation Strategy

### MVP: US1 + US2 + US3 (packages exist and are publishable)

1. Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3)
2. Stop and validate: both packages on GitHub Packages, dry-run clean
3. Then proceed to US4 (cfop migration) — the riskiest phase

### Risk order

- **Highest risk**: Phase 6 (US4) — touching cfop-app imports and deploy workflow; do last, validate with fresh clone before declaring done
- **Medium risk**: Phase 3 T010 — tsc build may need import extension fixes across all source files
- **Lowest risk**: Phase 7–8 — documentation and local dev setup
