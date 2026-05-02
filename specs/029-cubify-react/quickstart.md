# Quickstart — Feature 029: cubify-react

## Setup

### 1. Add Vite alias in `cfop-app/vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  base: '/cfop/',
  worker: { format: 'es' },
  resolve: {
    alias: {
      cubify: resolve(__dirname, '../../../cubify/src/index.ts'),
    },
    // REQUIRED when sourcing cubify directly (not published).
    // Vite will otherwise bundle two separate cubing.js copies — one from
    // cubify/node_modules and one from cfop-app/node_modules — causing
    // "unknown AlgNode" errors because instanceof checks fail across instances.
    dedupe: ['cubing'],
  },
})
```

### 2. Add TypeScript paths in `cfop-app/tsconfig.json`

```json
{
  "compilerOptions": {
    "paths": {
      "cubify": ["../../../cubify/src/index.ts"]
    }
  }
}
```

---

## Usage scenarios

### Animated algorithm player (VisualizerModal replacement)

```tsx
import { CubePlayer } from '../lib/cubify';

function AlgorithmVisualizer({ alg, stickering }: { alg: string; stickering: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <>
      <CubePlayer
        alg={alg}
        stickering={stickering}
        theme="modern"
        anchor="end"
        playing={playing}
        speed={1.0}
        onComplete={() => setPlaying(false)}
        style={{ width: 320, height: 320 }}
      />
      <button onClick={() => setPlaying(p => !p)}>
        {playing ? 'Pause' : 'Play'}
      </button>
    </>
  );
}
```

### Scramble preview (ScrambleCubePreview replacement)

```tsx
import { CubeState } from '../lib/cubify';

function ScramblePreview({ scramble }: { scramble: string }) {
  return (
    <CubeState
      alg={scramble}
      style={{ width: 120, height: 120 }}
    />
  );
}
```

### Controlled step-through (case study view)

```tsx
import { CubePlayer } from '../lib/cubify';

function StepVisualizer({ alg }: { alg: string }) {
  const [step, setStep] = useState(0);

  return (
    <>
      <CubePlayer
        alg={alg}
        stickering="oll-face-dim"
        theme="modern"
        stepIndex={step}
        style={{ width: 280, height: 280 }}
      />
      <button onClick={() => setStep(s => s - 1)}>← Prev</button>
      <button onClick={() => setStep(s => s + 1)}>Next →</button>
    </>
  );
}
```

### OLL case display (static, stickered)

```tsx
import { CubeState } from '../lib/cubify';

function OllCase({ caseAlg }: { caseAlg: string }) {
  return (
    <CubeState
      alg={caseAlg}
      stickering="oll-face-dim"
      theme="modern"
      style={{ width: 80, height: 80 }}
    />
  );
}
```

---

## Independent test criteria

To validate each component works before wiring into cfop-app:

1. **CubePlayer mounts**: Render `<CubePlayer alg="R U R' U'" style={{ width: 300, height: 300 }} />` in a minimal HTML page — cube should appear, no console errors.

2. **Play/pause**: Add `playing={true}` — cube should animate through the alg. Add `playing={false}` — animation pauses.

3. **Alg change**: Change `alg` prop — cube resets and loads the new alg.

4. **Theme switch**: Change `theme` prop from `'modern'` to `'rubiks'` — cube updates appearance without remount.

5. **CubeState display**: Render `<CubeState alg="R U R' U'" />` — cube should show the pre-case state (not solved, not fully scrambled).

6. **Stickering**: Add `stickering="oll-face-dim"` to CubeState — U face and top side stickers visible, rest grey.

7. **Unmount**: Remove either component from the tree — no Three.js `requestAnimationFrame` continues running (check via browser devtools).

---

## Stickering preset labels

Pass any of these as the `stickering` prop. Labels are resolved by `CubePlayer` and `CubeRenderer3D` — do **not** invent unlisted labels (they produce no masking).

| Group  | Label               | Description                                    |
|--------|---------------------|------------------------------------------------|
| basic  | `full`              | All stickers visible                           |
| basic  | `cross`             | Cross pieces only                              |
| basic  | `cross-dim`         | Cross pieces + dim others                      |
| basic  | `f2l`               | F2L slots                                      |
| basic  | `f2l-dim`           | F2L slots + dim others                         |
| oll    | `oll-face`          | U-face + top-layer sides visible               |
| oll    | `oll-face-dim-gry`  | OLL face visible, lower layers grey            |
| oll    | `oll-face-dim`  | OLL face state-colored, all others dimmed      |
| oll    | `oll-cross`         | Cross edges + corners hidden                   |
| oll    | `oll-cross-dim`     | Cross edges + dim corners                      |
| pll    | `pll-corn`          | Corners visible, edges on U face               |
| pll    | `pll-corn-dim`      | U corners + dim rest                           |
| pll    | `pll-edge-dim`      | U edges + dim rest                             |
| pll    | `pll-face`          | Full PLL face visible + dim others             |
| pll    | `pll-face-dim`      | PLL face state-colored, all others dimmed      |

Export: `import { MASK_PRESETS } from 'cubify'` for runtime access to all labels and their orbit strings.
