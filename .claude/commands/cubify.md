# /cubify — Cube State Image Generator

Generate a cube state image from an algorithm, a named case, or a batch JSON file.

## Usage

```
/cubify <alg>
/cubify --case <case-id>
/cubify --file <path>
```

### Optional flags

- `--2d` — force 2D top-layer visualization (experimental-2D-LL)
- `--3d` — force 3D perspective visualization (PG3D)
- `--setup <alg>` — apply setup moves before the algorithm

## How to run

Parse the arguments from the user's message after `/cubify` and run:

```bash
node cubify-scripts/cubify.mjs [args]
```

Run from the repo root (`/Users/Andy/Documents/TechLab/cubing.spec`).

### Input mode detection

1. **Raw alg** — no leading `--case` or `--file` flag:
   `node cubify-scripts/cubify.mjs R U R' U'`

2. **Case lookup** — `--case <id>`:
   `node cubify-scripts/cubify.mjs --case oll_sune`

3. **Batch file** — `--file <path>`:
   `node cubify-scripts/cubify.mjs --file algs-cfop-oll.json`

## Output

On success the script prints the absolute path(s) of the written image(s) to stdout.
Report the path back to the user so they can open it.

For batch runs, print the summary line and first few filenames.

## Error handling

If the script exits with code 1 (input error) or 2 (render error), show the error message to the user and suggest a fix:
- Invalid alg: check notation and try again
- Unknown case ID: the error message lists available IDs
- Chromium not found: `cd cfop-app && npx playwright install chromium`
- Missing file: check the path is relative to `cfop-app/public/data/` or provide an absolute path

## Notes

- All output is transparent PNG — `omitBackground: true` on Playwright screenshot; images blend with any app theme
- View mode (2D/3D) and mask are auto-selected from case type: OLL/PLL → 2D top-layer view, F2L/Cross/BGR → 3D perspective view
- OLL masking: no `mask` field = 1-look (show all top edges + corners); `mask: "edge"` = 2-look edge stage (corners hidden)
- F2L setup: `z2` applied automatically; y-prefixed algs get `z2 y` to normalise to FR slot; mid-alg rotations need explicit `setup` field in JSON
- PLL/BGR setup: `z2` orients yellow on top; add `y`/`y2`/`y'` to setup to put green front — verify empirically per case
- Output files are written to `.claude/tmp/cubify/` within the repo
- The renderer opens a visible Chromium window briefly — this is expected (WebGL requires headful mode on macOS)
- After any batch regeneration, copy outputs to `cfop-app/public/assets/cfop_<method>/` to update the app
