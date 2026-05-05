# Quickstart — @andyjudson/cubify packages

Published to GitHub Packages. Supersedes the local Vite alias setup from feature 029.

---

## 1. Authentication

GitHub Packages requires auth even for public packages. Add `.npmrc` to your project:

```
@andyjudson:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_AUTH_TOKEN}
```

**For local development**: create a GitHub Personal Access Token (classic) with `read:packages` scope. Set it in your shell:
```bash
export NPM_AUTH_TOKEN=ghp_your_token_here
```

**For GitHub Actions CI**: use `secrets.GITHUB_TOKEN` — it has `read:packages` for any package owned by the same GitHub account automatically. No extra secrets needed.

---

## 2. Install

```bash
# Core library
npm install @andyjudson/cubify
npm install three cubing          # peer deps

# React wrappers (optional, if using React)
npm install @andyjudson/cubify-react
npm install react react-dom        # peer deps (if not already installed)
```

---

## 3. Usage

### Import paths (post-031)

```ts
// Core library
import {
  CubeState, CubeScramble, AlgParser,
  CubeStickering, MASK_PRESETS,
  CubeTheme, THEME_PRESETS,
  CubeRenderer2D, CubeRenderer3D,
  CubePlayer, CubeExporter,
} from '@andyjudson/cubify';

// React wrappers
import {
  CubePlayer, CubeState, CubeMoveTape, CubePlayerControls,
} from '@andyjudson/cubify-react';
import type { CubePlayerHandle } from '@andyjudson/cubify-react';
```

### Animated algorithm player

```tsx
import { CubePlayer } from '@andyjudson/cubify-react';

function AlgorithmVisualizer({ alg, stickering }: { alg: string; stickering: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <>
      <CubePlayer
        alg={alg}
        stickering={stickering}
        theme="speed"
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

### Static cube snapshot

```tsx
import { CubeState } from '@andyjudson/cubify-react';

function ScramblePreview({ scramble }: { scramble: string }) {
  return <CubeState alg={scramble} style={{ width: 120, height: 120 }} />;
}
```

### OLL/PLL case display (stickered)

```tsx
import { CubeState } from '@andyjudson/cubify-react';

function OllCase({ caseAlg }: { caseAlg: string }) {
  return (
    <CubeState
      alg={caseAlg}
      stickering="oll-face-dim"
      theme="speed"
      style={{ width: 80, height: 80 }}
    />
  );
}
```

---

## 4. Vite setup (React apps)

Add `dedupe` to avoid duplicate `cubing.js` instances:

```ts
// vite.config.ts
export default defineConfig({
  resolve: {
    dedupe: ['cubing'],
  },
})
```

---

## 5. Local development workflow (cubify + cfop-app simultaneously)

When making changes to the cubify library and testing them in cfop-app **without publishing**, create a `.env.local` file in `cfop-app/`. This is gitignored by Vite by default and never committed.

**One-time setup:**
```bash
echo "CUBIFY_LOCAL=1" >> cfop-app/.env.local
```

After that, `npm run dev` works exactly as before — Vite loads `.env.local` automatically and the aliases bypass the npm registry entirely, pointing straight at the local TypeScript source with full HMR.

The `vite.config.ts` uses Vite's `loadEnv()` to read it:

```ts
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const CUBIFY_LOCAL = env.CUBIFY_LOCAL === '1';

  return {
    resolve: {
      alias: CUBIFY_LOCAL ? {
        '@andyjudson/cubify':
          resolve(__dirname, '../../cubify/packages/cubify/src/index.ts'),
        '@andyjudson/cubify-react':
          resolve(__dirname, '../../cubify/packages/cubify-react/src/index.ts'),
      } : {},
      dedupe: ['cubing'],
    },
  };
});
```

CI and fresh clones never have `.env.local` so always use the published packages.

---

## 6. Stickering preset labels

| Label | Use for |
|-------|---------|
| `full` | All stickers visible |
| `cross-dim` | Cross pieces + dim others |
| `f2l-dim` | F2L slots + dim others |
| `oll-face-dim` | OLL — U face stickers coloured, lower layers dimmed |
| `oll-cross-dim` | OLL 2-look edge stage |
| `pll-face-dim` | PLL full permutation |
| `pll-corn-dim` | PLL corners-only cases |
| `pll-edge-dim` | PLL edges-only cases |

Full list: `import { MASK_PRESETS } from '@andyjudson/cubify'`

---

## Reference implementation

See `cfop-app/src/` for a full React app using both packages. The `CubifyPage` component demonstrates case selection, stickering, theme switching, and playback controls.
