# /cubify — Cube State Image Generator

Generate a PNG of a cube state from an algorithm, a named case, or a batch JSON file.
Uses cubify `CubeExporter.toPNG()` via Playwright + Vite dev server.

## Usage

```
/cubify <alg>
/cubify --case <case-id>
/cubify --file <path>
```

### Flags

| Flag | Description |
|------|-------------|
| `--3d` | 3D perspective PNG (default when neither flag is given) |
| `--2d` | 2D cube net PNG |
| `--setup <alg>` | Apply setup moves before the algorithm |
| `--stickering <label\|orbitstring>` | MASK_PRESETS label (e.g. `oll-face-dim`) or raw orbit string |
| `--masked` | Auto-derive mask from case method + group (dim already baked in) |
| `--dim` | Append `-dim` to explicit `--stickering` label; no-op with `--masked` |

**`--stickering` vs `--masked`**: Use `--masked` for case exports — it reads `method + group + mask` from the JSON and picks the right label automatically. Use `--stickering` to override with a specific preset for ad-hoc renders.

## How to run

Parse the arguments from the user's message after `/cubify` and run from the repo root:
```bash
node cubify-scripts/cubify.mjs [args]
```

Playwright Chromium must be installed (one-time setup):
```bash
cd cubify-scripts && npx playwright install chromium
```

## Input modes

**Raw alg** — no leading flag:
```bash
node cubify-scripts/cubify.mjs "R U R' U R U2 R'"
```

**Case lookup** — `--case <id>`:
```bash
node cubify-scripts/cubify.mjs --case oll_sune --masked --2d
```

**Batch file** — `--file <path>` (bare filename resolves relative to `cubify-scripts/data/`):
```bash
node cubify-scripts/cubify.mjs --file algs-cfop-oll.json --masked --2d
```

## Stickering labels (MASK_PRESETS)

| Label | Use for |
|-------|---------|
| `oll-face-dim` | OLL 1-look, OLL 2-look corner stage |
| `oll-cross-dim` | OLL 2-look edge stage (`mask: "edge"` in JSON) |
| `pll-face-dim` | PLL full permutation (Adjacent Swap, Diagonal Swap, G Perms) |
| `pll-corn-dim` | PLL corners-only cases + 2-look corner stage |
| `pll-edge-dim` | PLL edges-only cases + 2-look edge stage |
| `f2l-dim` | F2L cases |
| `full` | No masking (all stickers visible) |

## Output

On success the script prints the absolute path(s) of the written PNG(s) to stdout.
Report the path back to the user so they can open it.

For batch runs, print the summary line and first few filenames.

## Error handling

- Unknown case ID: the error message lists available IDs
- Chromium not found: `cd cubify-scripts && npx playwright install chromium`
- Missing file: check path is relative to `cfop-app/public/data/` or provide absolute path
- Vite timeout: ensure `npm install` has been run at cubify root

## Notes

- Output is transparent PNG written to `.tmp/` within the cubify repo root
- A visible Chromium window opens briefly — expected; WebGL requires headful mode on macOS
- If the cubify Vite dev server is already running (harness open), it is reused automatically
- After batch regeneration, copy outputs to `cfop-app/public/assets/cfop_<method>/` to update the app
- OLL/PLL cases: `z2` setup applied automatically to orient yellow on top
- F2L cases: `z2` setup applied; y-prefixed algs get `z2 y` to normalise to FR slot
