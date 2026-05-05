# Research: Feature 031 — cubify-packages

## Decision 1: npm workspaces structure

**Decision**: `packages/cubify/` and `packages/cubify-react/` under one workspace root. Root `package.json` declares `"workspaces": ["packages/*"]`. No third-party monorepo tooling (Turborepo, Nx) — npm workspaces alone is sufficient for two packages.

**Rationale**: npm native workspaces give symlinked cross-package resolution during development without extra tooling. After `npm install` at root, `node_modules/@andyjudson/cubify` is symlinked to `packages/cubify/`. `cubify-react` can declare `"@andyjudson/cubify": "workspace:*"` and resolve it from the link. Both packages build and publish independently from one CI job.

**Alternatives considered**:
- Two sibling `package.json` files (no workspace) — viable but `cubify-react` can't reference `cubify` cleanly during development; requires manual path aliasing.
- Single package — correct for a coupled library, but React becomes an unavoidable peer dep of the core package, polluting consumers that only need 2D/3D rendering.

---

## Decision 2: tsc build strategy

**Decision**: Each package gets its own `tsconfig.build.json` with `emitDeclarationOnly: false`, producing JS + `.d.ts` into `dist/`. The existing root `tsconfig.json` retains `emitDeclarationOnly: true` for the typecheck-only workflow used by the harness.

**Rationale**: The `exports` map in `package.json` must point at compiled JS (not `.ts` source) for consumers outside Vite. `tsc --project tsconfig.build.json` emits both JS modules and declarations in one pass — no separate bundler needed for a library that is pure ES modules with no dynamic requires.

**Key tsconfig.build.json settings per package**:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "declarationDir": "./dist",
    "emitDeclarationOnly": false,
    "declaration": true,
    "allowImportingTsExtensions": false
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

**Note**: `moduleResolution: "bundler"` is fine for source compilation. For the published package, consumers will use `moduleResolution: "node16"` or `"bundler"` — the emitted JS uses `.js` extensions in import paths (requires `verbatimModuleSyntax` or explicit `.js` in source imports).

**Alternatives considered**:
- Vite lib mode — produces a rollup bundle, eliminates peer dep tree-shaking control; overkill for a library that is already pure ESM with no dynamic imports.
- esbuild — fast but no declaration emit; would require a second `tsc --emitDeclarationOnly` pass.

---

## Decision 3: GitHub Packages publish

**Decision**: Each sub-package `package.json` declares:
```json
{
  "name": "@andyjudson/cubify",
  "publishConfig": { "registry": "https://npm.pkg.github.com" },
  "repository": { "type": "git", "url": "https://github.com/andyjudson/cubify.git" }
}
```

The `publish.yml` workflow triggers on `push` with tag matching `v*.*.*`. It uses `setup-node` with `registry-url: https://npm.pkg.github.com` and `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` — no additional secret setup needed since GitHub Actions has implicit `GITHUB_TOKEN` with `packages: write` permission on push to the repo.

**Publish workflow skeleton**:
```yaml
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

**Lockstep versioning**: A helper script `scripts/version-bump.sh <version>` updates both `packages/*/package.json` to the same version and creates the git tag. This keeps the release process a single command.

**Alternatives considered**:
- Manual `npm publish` from local — works but not reproducible; no CI gate.
- Separate publish jobs per package — adds workflow complexity for no benefit given lockstep versioning.

---

## Decision 4: cfop-app GitHub Packages auth

**Decision**: Add `.npmrc` to `cfop-app/` (not repo root to avoid affecting non-app packages):
```
@andyjudson:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_AUTH_TOKEN}
```

Update `deploy.yml` to set `NPM_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` in the Install step. GitHub Actions `GITHUB_TOKEN` has `read:packages` scope on any workflow in the same org — no additional secrets needed.

**For PRs and forks**: GitHub Actions `GITHUB_TOKEN` on a fork PR does not have `packages:read` on the source org. However `@andyjudson/cubify` is public on GitHub Packages (scoped but readable without auth by anyone), so `--legacy-peer-deps` or anonymous install may work. If not, the deploy job runs only on `push` to main — PRs do not trigger deploy, so fork auth is a non-issue for this workflow.

**Alternatives considered**:
- Separate `NPM_REGISTRY_TOKEN` secret — adds manual secret management; `GITHUB_TOKEN` is sufficient and automatic.
- Public npm registry — adds discoverability / namespace squatting risk; out of scope for now.

---

## Decision 5: Import path migration

**What changes**:

| Consumer | Before | After |
|----------|--------|-------|
| `cubify-harness/index.html` | `import ... from '../src/index.ts'` | `import ... from '../packages/cubify/src/index.ts'` (dev direct import) |
| `cubify-scripts/` | `resolve(__dirname, 'data')` + cubify not imported directly | No change to data; any cubify imports → `../../packages/cubify/src/index.ts` |
| `test/` | `import ... from '../src/...'` | Moves to `packages/cubify/test/`; `import ... from '../src/...'` unchanged relative to new location |
| `cfop-app` | `from 'cubify'` via Vite alias | `from '@andyjudson/cubify'`; `from '@andyjudson/cubify-react'` |

**Harness note**: The harness remains Vite-served. Rather than configuring Vite to resolve the workspace package, a direct relative import to `packages/cubify/src/index.ts` is simplest — avoids any workspace symlink / Vite dedupe issue. No Vite config changes needed.

---

## Decision 6: `@types/three` and declaration emit

**Finding**: `three >= 0.130` ships its own TypeScript declarations (`three/src/Three.d.ts`). The `@types/three` package is a community re-export and is now deprecated in favour of the bundled types. The current `tsconfig.json` paths override for `three` was needed because `cubify-harness/node_modules` held the installation. After workspace restructure, `packages/cubify/package.json` lists `three` as a peerDep, and `devDependencies` installs it at workspace root — `node_modules/three` is in scope and its bundled types resolve naturally without path overrides.

**Action**: Remove `paths` overrides for `three` and `cubing` from `packages/cubify/tsconfig.build.json`. Add `three` and `cubing` to `devDependencies` of `packages/cubify/package.json`.
