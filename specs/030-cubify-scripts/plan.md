# Implementation Plan: Feature 030 — cubify-scripts migration

## Technical Context

| Item | Value |
|------|-------|
| Language | JavaScript (ESM `.mjs`) |
| Runtime (both paths) | Playwright + Vite dev server subprocess |
| Key deps | `playwright`, `vite` (already present) |
| Entry point | `cubify-scripts/cubify.mjs` |
| Library source | `../src/index.ts` (resolved by Vite inside browser context) |

---

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| No esbuild bundle step | PASS | Vite subprocess serves existing harness |
| No cfop-app rendering dep | PASS | Rendering via Vite/cubify context |
| Public API only | PASS | `CubeExporter.toPNG({ style })`, `MASK_PRESETS` |
| Consistent PNG output | PASS | Both `--2d` and `--3d` produce PNG via same Playwright flow |
| Single renderer path | PASS | `--2d` passes `style: '2d'` to `window.cubifyRender()`; no separate module |

---

## Project Structure

```
cubify/
  cubify-scripts/
    cubify.mjs               ← entry: arg parsing, passes style: '2d'|'3d' to renderer
    lib/
      renderer.mjs           ← REWRITE: Vite subprocess + Playwright (handles both styles)
      masks.mjs              ← UPDATE: MASK_PRESETS labels not raw orbits
  cubify-harness/
    renderer.html            ← NEW: minimal page, window.cubifyRender(alg, { style, ... })
  .claude/
    commands/
      cubify.md              ← UPDATE: new flags, remove esbuild note
```

---

## Implementation Phases

### Phase 1 — Renderer page + Playwright path

**T01** — `cubify-harness/renderer.html`

Minimal HTML page (no framework). Imports cubify from `../src/index.ts` (Vite resolves this). Exposes a single entry point for both styles:

```javascript
window.cubifyRender = async function(alg, options) {
  // options: { style: '2d'|'3d', stickering, theme, size, setup }
  const exporter = new CubeExporter({ stickering: options.stickering, theme: options.theme });
  return await exporter.toPNG(alg, {
    style: options.style ?? '3d',
    size: options.size ?? 288,
    setup: options.setup,
  });
  // returns PNG data URL string
};
```

**T02** — Rewrite `cubify-scripts/lib/renderer.mjs`

Replace esbuild + TwistyPlayer with a single Playwright flow used for both styles:

1. Spawn `npm run dev` subprocess in `cubify/` root, wait for `localhost:5173`
2. Launch Playwright Chromium
3. Navigate to `http://localhost:5173/renderer.html`
4. Call `window.cubifyRender(alg, options)` — `options.style` selects `'2d'` or `'3d'`
5. Base64-decode PNG data URL and write to output file
6. Close browser, kill Vite subprocess

```javascript
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const CUBIFY_DIR = new URL('../../', import.meta.url).pathname;

async function waitForServer(url, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { await fetch(url); return; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Vite server not ready at ${url}`);
}

export async function render(alg, options) {
  const vite = spawn('npm', ['run', 'dev'], { cwd: CUBIFY_DIR, stdio: 'pipe' });
  try {
    await waitForServer('http://localhost:5173');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/renderer.html');
    const dataUrl = await page.evaluate(
      ({ alg, options }) => window.cubifyRender(alg, options),
      { alg, options }
    );
    const png = Buffer.from(dataUrl.split(',')[1], 'base64');
    writeFileSync(options.output, png);
    await browser.close();
  } finally {
    vite.kill();
  }
}
```

---

### Phase 2 — Stickering flags

**T03** — Update `cubify-scripts/lib/masks.mjs`

Replace raw orbit strings with `MASK_PRESETS` labels. Signature changes from `maskForCase(method, mask)` to `getMask(method, group, mask)` — `group` is needed for 1-look PLL where only the group field distinguishes corners-only from edges-only cases:

```javascript
export function getMask(method, group, mask) {
  if (method === 'oll') {
    return mask === 'edge' ? 'oll-cross-dim' : 'oll-face-dim';
  }
  if (method === 'pll') {
    const g = (group ?? '').toLowerCase();
    if (mask === 'corner' || g.includes('corner')) return 'pll-corn-dim';
    if (g.includes('edge'))                        return 'pll-edge-dim';
    return 'pll-face-dim';
  }
  if (method === 'f2l')   return 'f2l-dim';
  if (method === 'cross') return 'cross-dim';
  return 'full';
}
```

**T04** — Add `--stickering`, `--masked`, `--dim`, `--2d` to `cubify.mjs`

Parse new flags and pass resolved options to `render()`:
- `--stickering <label|orbitstring>` — explicit stickering override
- `--masked` — apply default mask for the case via `getMask(method, group, mask)` from case JSON
- `--dim` — append `-dim` to resolved label only when used with `--stickering` (explicit single-alg path); no-op for `--case`/`--file` where dim is already encoded in the label from `getMask()`
- `--2d` — render 2D cube net PNG (`style: '2d'`)
- `--3d` — render 3D perspective PNG (`style: '3d'`); this is the default when neither flag is given

Both flags are explicit and symmetric — no style inference from `method`. OLL/PLL cases typically use `--2d`; cross/F2L cases typically use `--3d`, but the caller decides.

Priority: `--stickering` > `--masked` > none (full).

`cubify.mjs` must forward `group` from the case JSON to `getMask()` — it's already present on case entries in all JSON files.

---

### Phase 3 — Skill update

**T05** — Update `.claude/commands/cubify.md`

- Document new flags: `--stickering`, `--masked`, `--dim`, `--2d`
- Remove esbuild dependency note
- Remove cfop-app rendering path reference

---

## Key Design Decisions

1. **Single Playwright path**: Both `--2d` and `--3d` go through `renderer.mjs` → Playwright → `renderer.html`. `--2d` passes `style: '2d'` to `window.cubifyRender()`; `CubeExporter.toPNG()` handles the rest.
2. **PNG for both styles**: Consistent output format; no separate SVG path.
3. **Port reuse**: Vite defaults to `5173`; `renderer.mjs` polls this port before launching Playwright.
4. **MASK_PRESETS as stable API**: `masks.mjs` returns labels only; cubify resolves orbit strings internally.
5. **`--dim` appending**: Check `MASK_PRESETS.find(p => p.label === label + '-dim')` — if found, use it; otherwise use base label unchanged.
