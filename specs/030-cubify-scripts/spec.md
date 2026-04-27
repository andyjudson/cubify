# Feature 030 — cubify-scripts (Migrate to cubify API)

## Summary

Replace TwistyPlayer in `cubify-scripts/` with the cubify `CubeExporter` API. Remove the esbuild bundling step and the cfop-app rendering dependency. Add stickering controls (`--stickering`, `--masked`, `--dim`) to the CLI and update the `/cubify` agent skill accordingly.

---

## Motivation

`cubify-scripts/lib/renderer.mjs` currently:
1. Bundles `TwistyPlayer` from `cfop-app/node_modules` via esbuild
2. Serves the bundle via an in-process HTTP server
3. Launches headful Chromium (Playwright), injects a TwistyPlayer instance, waits 3s
4. Screenshots the WebGL canvas via shadow DOM intercepts

This means `cubify-scripts` depends on `cfop-app` existing on disk just to generate images.
Now that `CubeExporter.toPNG()` is built (`src/CubeExporter.ts`, Features 026+028), the scripts can call it directly — same Playwright headful constraint, none of the bundling complexity.

---

## Current vs Target

| Aspect | Current | Target |
|--------|---------|--------|
| Renderer | TwistyPlayer (cubing.js) | cubify `CubeExporter.toPNG()` |
| Bundling | esbuild from cfop-app | None — cubify ES modules direct |
| cfop-app dep | Required for bundling | Not required for rendering |
| Stickering CLI | None | `--stickering <preset\|orbitstring>`, `--masked`, `--dim` |
| Stickering API | Raw orbit strings in masks.mjs | MASK_PRESETS labels via `CubeStickering` |
| Output | Playwright screenshot of WebGL canvas | data URL from `CubeExporter` → write file |
| Agent skill | References TwistyPlayer path | References cubify API + new flags |

---

## CLI Interface

Existing flags unchanged:

```bash
node cubify.mjs R U R' U'                    # alg
node cubify.mjs --case oll_sune              # case lookup
node cubify.mjs --file algs-cfop-oll.json   # batch JSON
node cubify.mjs --2d                         # 2D flat-net output
node cubify.mjs --3d                         # 3D WebGL render (default)
node cubify.mjs --setup z2                   # explicit setup alg
```

New stickering flags:

```bash
node cubify.mjs --case oll_sune --stickering oll         # preset name from MASK_PRESETS
node cubify.mjs --case oll_sune --stickering 'EDGES:...' # raw orbit string
node cubify.mjs --case oll_sune --masked                  # auto-derive mask from case method
node cubify.mjs --case oll_sune --dim                     # dim variant of the derived mask
```

Flag precedence: `--stickering` > `--masked`/`--dim` > case-derived mask from JSON `mask` field.

---

## Technical Approach

### Renderer replacement

New `renderer.mjs` serves a minimal page that imports cubify from `../src/` as ES modules. Playwright (headful — WebGL still required for 3D on macOS) loads the page, evaluates `CubeExporter.toPNG(alg, options)`, and returns the data URL. The script then base64-decodes and writes to the output file. No esbuild step, no TwistyPlayer, no shadow DOM intercepts.

For `--2d`: `CubeRenderer2D.toSVG()` runs in Node.js directly (no browser) — Playwright only needed for 3D.

### Stickering resolution

`masks.mjs` currently returns raw orbit strings. After migration it returns MASK_PRESETS labels (e.g. `'oll'`, `'oll-dim'`, `'f2l'`), which `CubeExporter` resolves internally via `CubeStickering`. This keeps `masks.mjs` as a thin mapping — cubify owns the orbit string detail.

`--dim` flag selects the `-dim` variant of the preset label when available (e.g. `'oll'` → `'oll-dim'`).

### Data files (lookup.mjs)

`lookup.mjs` still reads from `CFOP_APP_DIR/public/data/` by default — configurable via env var. The cfop-app dependency is removed only for rendering; case ID lookup still relies on the JSON data files from that repo.

---

## Module Changes

| File | Change |
|------|--------|
| `cubify-scripts/lib/renderer.mjs` | Full rewrite — cubify CubeExporter path; remove TwistyPlayer/esbuild |
| `cubify-scripts/lib/masks.mjs` | Return MASK_PRESETS labels instead of raw orbit strings |
| `cubify-scripts/cubify.mjs` | Add `--stickering`, `--masked`, `--dim` arg parsing |
| `.claude/commands/cubify.md` | Update docs — new flags, cubify API, no cfop-app dep for rendering |

---

## Dependencies

- Feature 026 (CubeExporter) ✅ — `toPNG()` implemented
- Feature 028 (library API) ✅ — `src/` at repo root, public API in place
- Playwright — already a dep in `cubify-scripts/`

---

## Acceptance Criteria

- [ ] `node cubify.mjs R U R'` generates PNG via cubify CubeExporter — no TwistyPlayer or esbuild
- [ ] `node cubify.mjs --case oll_sune` outputs correctly masked OLL image
- [ ] `node cubify.mjs --file algs-cfop-oll.json` batch-processes all cases
- [ ] `--stickering oll` applies the `oll` MASK_PRESET
- [ ] `--stickering 'EDGES:...'` accepts a raw orbit string
- [ ] `--masked` derives the correct mask from the case method automatically
- [ ] `--dim` applies the dim variant of the derived/specified mask
- [ ] `--2d` output uses `CubeRenderer2D` — no browser required
- [ ] No reference to `cfop-app/node_modules` in renderer path
- [ ] `.claude/commands/cubify.md` documents all new flags accurately
- [ ] Output quality comparable to TwistyPlayer renders
