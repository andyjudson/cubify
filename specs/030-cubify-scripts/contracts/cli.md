# CLI Contract: cubify-scripts

## Entry Point

```
node cubify-scripts/cubify.mjs [options]
```

Both `--2d` and `--3d` paths run through Playwright + Vite dev server. No special Node.js flags required.

---

## Options

| Flag | Argument | Description |
|------|----------|-------------|
| `--alg` | `<notation>` | WCA algorithm string to render |
| `--case` | `<name>` | Look up alg from cfop-app case data |
| `--file` | `<path>` | Read alg(s) from JSON file |
| `--output` | `<path>` | Output file path (required) |
| `--stickering` | `<label\|string>` | MASK_PRESETS label or raw orbit string |
| `--masked` | — | Apply default mask for the case |
| `--dim` | — | Use dim variant of resolved stickering (if available) |
| `--2d` | — | Render 2D cube net PNG (`CubeExporter` `style: '2d'`) |
| `--3d` | — | Render 3D perspective PNG (`style: '3d'`); default when neither flag is given |
| `--theme` | `<preset>` | Theme preset name (default: `speed-dark`) |
| `--size` | `<px>` | Output pixel size (default: 288) |
| `--setup` | `<notation>` | Setup alg (applied before main alg) |

---

## Stickering Resolution

1. `--stickering <value>` is provided → use value directly (label or orbit string)
2. `--masked` and `--case` are set → look up default mask via `getMask(caseName)`, return its label
3. Neither → use `'full'` (all stickers visible)
4. If `--dim` is set → append `-dim` to resolved label if `MASK_PRESETS` contains `<label>-dim`; otherwise use base label unchanged

---

## Output Format

Both flags produce PNG binary output via the same Playwright + Vite path. `--2d` passes `style: '2d'` to `CubeExporter.toPNG()`; `--3d` (or no flag) passes `style: '3d'`. No style is inferred from `method` — the caller is always explicit.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Missing required argument or bad option |
| 2 | Alg parse error |
| 3 | Output write error |
| 4 | Playwright / Vite startup failure |

---

## Examples

```bash
# OLL case — 2D cube net, masked
node cubify-scripts/cubify.mjs \
  --case oll_sune \
  --masked \
  --2d \
  --output out/sune.png

# F2L case — 3D perspective, masked
node cubify-scripts/cubify.mjs \
  --case f2l-fr-1 \
  --masked \
  --3d \
  --output out/f2l-fr-1.png

# Single alg, explicit stickering + dim, 2D
node cubify-scripts/cubify.mjs \
  --alg "R U R' U R U2 R'" \
  --stickering oll-face \
  --dim \
  --2d \
  --output out/sune-custom.png
```
