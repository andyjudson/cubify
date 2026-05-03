# Quickstart: cubify-scripts (Feature 030)

## Prerequisites

- `playwright` in `cubify/node_modules/` (`npm install` at cubify root)
- Vite present at cubify root (already configured, no config file needed)
- cubify source at `../src/` (Vite resolves TypeScript inside browser context)

---

## Scenario 1: Generate a 2D cube net PNG

```bash
cd /path/to/cubify
node cubify-scripts/cubify.mjs \
  --alg "R U R' U R U2 R'" \
  --stickering oll-dim \
  --2d \
  --output /tmp/sune-2d.png
```

Expected: Vite starts on `localhost:5173`, Playwright navigates to `renderer.html`, calls `window.cubifyRender(alg, { style: '2d', stickering: 'oll-dim' })`, writes `/tmp/sune-2d.png` (288×288 PNG with cube net layout). Vite and browser shut down after write.

---

## Scenario 2: Generate a 3D PNG

```bash
cd /path/to/cubify
node cubify-scripts/cubify.mjs \
  --alg "R U R' U R U2 R'" \
  --stickering oll-dim \
  --output /tmp/sune-3d.png
```

Expected: Same Playwright flow, `style: '3d'`. Writes `/tmp/sune-3d.png` (288×288 3D render with OLL-dim stickering).

---

## Scenario 3: Case lookup with default mask

```bash
node cubify-scripts/cubify.mjs \
  --case "Sune" \
  --masked \
  --dim \
  --output /tmp/sune-case.png
```

Expected: `masks.mjs` resolves `'Sune'` → `'oll'` label → `--dim` appends to `'oll-dim'`. Same PNG output as Scenario 2.

---

## Integration Test: cfop-app case image batch

After migration, the cfop-app image generation pipeline (if it exists) should invoke `cubify.mjs` with `--masked --dim` per case. Verify all case images round-trip correctly against the `MASK_PRESETS` labels defined in cubify.
