# Feature 031 — cubify-packages (GitHub Packages publishing)

## Summary

Publish `@andyjudson/cubify` and `@andyjudson/cubify-react` to GitHub Packages (npm registry). Establishes a proper package boundary between the cubify library and its consumers, replacing the local Vite path alias with a versioned import.

---

## Motivation

Currently `cfop-app` consumes cubify via a Vite alias pointing at a relative path (`../../cubify/src/index.ts`). This only works when both repos are checked out side-by-side. Publishing to GitHub Packages gives:

- A clean, versioned import (`@andyjudson/cubify`) that works in any environment
- A functioning GitHub Actions deploy pipeline for `cfop-app` (currently broken on a fresh clone)
- A safe, semi-private starting point — GitHub Packages is accessible to anyone but scoped to `@andyjudson`, not indexed on npm

---

## Packages

### `@andyjudson/cubify`

Core library — plain ES modules, no React dependency. `three` and `cubing.js` are **peer dependencies** — consumers install them alongside the package.

| Export | Description |
|--------|-------------|
| `CubeState` | cubing.js KPattern wrapper |
| `CubeScramble` | Pure JS scramble generator |
| `AlgParser` | WCA notation parser |
| `CubeStickering` / `MASK_PRESETS` | CFOP masking |
| `CubeTheme` / `THEME_PRESETS` | Theme system |
| `CubeRenderer2D` | Top-down canvas/SVG renderer |
| `CubeRenderer3D` | Three.js 3D renderer (wide move support) |
| `CubePlayer` | Animation engine |
| `CubeExporter` | PNG export |

### `@andyjudson/cubify-react`

Thin React wrappers — peer-depends on React and `@andyjudson/cubify`. No CSS framework dependency (inline styles only).

| Export | Description |
|--------|-------------|
| `<CubePlayer>` | Animated algorithm player component |
| `<CubeState>` | Static snapshot component |
| `<CubeMoveTape>` | Move sequence with active/done highlight |
| `<CubePlayerControls>` | Play/pause, reset, speed controls |
| `CubePlayerHandle` | Ref type for imperative reset/resetCamera |

---

## Scope

### cubify repo changes

- Restructure as **npm workspace** — `packages/cubify/` and `packages/cubify-react/` under one root `package.json`
- `packages/cubify/`: core library source, `tsc` build → `dist/` (ES modules + declarations), `exports` pointing at `dist/`
- `packages/cubify-react/`: React wrapper components (moved from `cfop-app/src/lib/cubify/`), declares `@andyjudson/cubify` as workspace dep during development
- GitHub Actions workflow: `publish.yml` — triggers on a single version tag (e.g. `v1.2.0`), builds and publishes both packages at that version to `npm.pkg.github.com` (lockstep versioning)

### cfop-app changes

- Remove Vite alias `cubify` → relative path
- Add `.npmrc` with `@andyjudson:registry=https://npm.pkg.github.com`
- Update imports: `from '@andyjudson/cubify'` and `from '@andyjudson/cubify-react'`
- Remove local `src/lib/cubify/` wrapper directory

### GitHub Actions (cfop)

- `deploy.yml` authenticates to GitHub Packages to install `@andyjudson/cubify` and `@andyjudson/cubify-react` during build

---

## Prerequisites

- Feature 029 (React wrapper) ✅ — wrappers exist and are stable
- Feature 030 (cubify-scripts) ✅ — scripts updated before packaging

---

## Acceptance Criteria

- [ ] `npm install @andyjudson/cubify` works from a fresh directory with `.npmrc`
- [ ] `npm install @andyjudson/cubify-react` resolves peer deps correctly
- [ ] `cfop-app` builds successfully on a fresh clone (no side-by-side cubify repo required)
- [ ] GitHub Actions deploy workflow passes end-to-end
- [ ] TypeScript types resolve correctly for both packages
- [ ] Existing Vitest suite (cubify) and Playwright suite (cfop-app) pass unchanged

---

## Clarifications

### Session 2026-05-04

- Q: Package structure — monorepo workspace vs two sibling package.json files vs single package? → A: npm workspaces (`packages/cubify/` and `packages/cubify-react/` under one root)
- Q: `three` and `cubing.js` — peer dependencies or bundled? → A: peer dependencies (consumer installs both)
- Q: Package versioning — independent per-package or lockstep? → A: lockstep — one tag publishes both packages at the same version
