# cubify — Reference & Notes

Cubify is a 3×3 cube rendering library for CFOP apps. Delegates permutation state and move application to [cubing.js](https://github.com/cubing/cubing.js) (Lucas Garron), then owns the rendering layer — typed theme system, stickering API for CFOP case visualisation, and React wrappers that expose cube state as a first-class value.

This is the general guidance file: quickstart, usage, architecture, and operational gotchas (publishing, automation). Cube-state/rendering ground truth lives in [`cubify-lessons.md`](cubify-lessons.md).

---

## Quickstart

### 1. Authentication

GitHub Packages requires auth even for public packages. Add `.npmrc` to your project:

```
@andyjudson:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_AUTH_TOKEN}
```

**Locally** — create a GitHub Personal Access Token (classic) with `read:packages` scope:
```bash
export NPM_AUTH_TOKEN=ghp_your_token_here   # add to ~/.zprofile
```

**In CI** — use `GITHUB_TOKEN`; it has `read:packages` automatically. The workflow must include `packages: read` in its `permissions` block — an explicit `permissions:` key drops all unspecified scopes.

### 2. Install

```bash
npm install @andyjudson/cubify three cubing          # core library + peer deps
npm install @andyjudson/cubify-react react react-dom react-icons  # React wrappers (if needed)
```

### 3. Import paths

```ts
import {
  CubeState, CubeScramble, AlgParser,
  CubeStickering, MASK_PRESETS,
  CubeTheme, THEME_PRESETS,
  CubeRenderer2D, CubeRenderer3D,
  CubePlayer, CubeExporter,
} from '@andyjudson/cubify';

import {
  CubePlayer, CubeState, CubeMoveTape, CubePlayerControls,
} from '@andyjudson/cubify-react';
import type { CubePlayerHandle } from '@andyjudson/cubify-react';
```

### 4. Usage examples

**Animated algorithm player**

```tsx
import { CubePlayer } from '@andyjudson/cubify-react';

function AlgorithmVisualizer({ alg, stickering }: { alg: string; stickering: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <>
      <CubePlayer
        alg={alg}
        stickering={stickering}
        theme="speed-dark"
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

**Static cube snapshot**

```tsx
import { CubeState } from '@andyjudson/cubify-react';

function ScramblePreview({ scramble }: { scramble: string }) {
  return <CubeState alg={scramble} style={{ width: 120, height: 120 }} />;
}
```

**OLL/PLL case display (stickered)**

```tsx
function OllCase({ caseAlg }: { caseAlg: string }) {
  return (
    <CubeState
      alg={caseAlg}
      stickering="oll-face-dim"
      theme="speed-dark"
      style={{ width: 80, height: 80 }}
    />
  );
}
```

### 5. Vite setup

Add `dedupe` to avoid duplicate cubing.js instances when the package is also a direct dependency:

```ts
// vite.config.ts
export default defineConfig({
  resolve: {
    dedupe: ['cubing'],
  },
})
```

### 6. Local development (cubify + consumer app simultaneously)

When making changes to the cubify library and testing them in a consumer app without publishing, add a `.env.local` file in the app root (gitignored by Vite, never committed):

```bash
echo "CUBIFY_LOCAL=1" >> cfop-app/.env.local
```

Wire it up in `vite.config.ts` using `loadEnv()`:

```ts
import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

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
      } : undefined,
      dedupe: ['cubing'],
    },
  };
});
```

With `CUBIFY_LOCAL=1`, Vite resolves imports directly from the TypeScript source with full HMR. CI and fresh clones never have `.env.local` so always use the published packages.

### 7. Stickering presets

| Label | Use for |
|-------|---------|
| `full` | All stickers visible |
| `cross-dim` | Cross pieces + dim rest |
| `f2l-dim` | F2L slots + dim rest |
| `oll-face-dim` | OLL — U face coloured, lower layers dimmed |
| `oll-cross-dim` | OLL 2-look edge stage |
| `pll-face-dim` | PLL full permutation |
| `pll-corn-dim` | PLL corners-only cases |
| `pll-edge-dim` | PLL edges-only cases |

Full list: `import { MASK_PRESETS } from '@andyjudson/cubify'`

---

## Reference implementation

`cfop-app/src/pages/CubifyPage.tsx` (cfop repo) is the canonical consumer — case selector, stickering, theme switching, step controls, and full playback. The React package source is at `packages/cubify-react/src/` in this repo.

---

## Architecture

### Workspace layout

```
cubify/
├── packages/
│   ├── cubify/
│   │   ├── src/                ← TypeScript source (the library)
│   │   │   └── index.ts        ← public entry point — re-exports full API
│   │   ├── test/               ← Vitest suite (181 pass, 10 skip)
│   │   ├── dist/               ← built output — gitignored, rebuilt by CI
│   │   ├── package.json        ← @andyjudson/cubify
│   │   ├── tsconfig.json       ← IDE / typecheck only (noEmit)
│   │   └── tsconfig.build.json ← build config (emits JS + .d.ts → dist/)
│   └── cubify-react/
│       ├── src/                ← React wrapper source
│       ├── dist/               ← built output — gitignored
│       ├── package.json        ← @andyjudson/cubify-react
│       ├── tsconfig.json
│       └── tsconfig.build.json
├── cubify-harness/             ← browser dev/test environment
├── cubify-scripts/             ← PNG export CLI
├── package.json                ← workspace root (private: true)
└── vitest.config.js
```

### Build pipeline

Each package builds independently:

```bash
npm run build --workspace=packages/cubify        # tsc -p tsconfig.build.json → dist/
npm run build --workspace=packages/cubify-react  # same
```

`tsconfig.build.json` emits both JavaScript and type declarations into `dist/`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "emitDeclarationOnly": false,
    "rootDir": "./src",
    "outDir": "./dist",
    "skipLibCheck": true
  }
}
```

The output is standard compiled ESM — `dist/index.js` + `dist/index.d.ts`. Consumers import the compiled JavaScript; TypeScript consumers also get the declarations for IDE autocomplete and type safety.

The workspace root `tsconfig.json` is typecheck-only (`noEmit: true`) — it covers the full source tree for IDE support without driving any build.

### package.json — exports and peers

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types":  "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "peerDependencies": {
    "cubing": "^0.63.3",
    "three":  "^0.170.0"
  }
}
```

**`files: ["dist"]`** — only the built output is included in the published tarball. Source, tests, and tsconfig files are excluded.

**`peerDependencies`** — `cubing` and `three` are peers rather than bundled dependencies. A consumer likely already has them; if cubify bundled its own copies, the consumer would end up with two instances of `three`, breaking `instanceof` checks and doubling memory. Peers stay out of the install tree and use the consumer's copy.

**`exports` map** — the `"import"` condition is what a bundler resolves at build time; `"types"` is what the TypeScript compiler reads for type checking. Both point at `dist/` — the build must exist before the package can be consumed.

### Why source files use `.js` extensions

Inside `src/`, inter-module imports look like this:

```typescript
// CubePlayer.ts
import { CubeRenderer3D } from './CubeRenderer3D.js';
import { CubeState }      from './CubeState.js';
```

The `.js` file does not exist on disk — only `CubeRenderer3D.ts` does. The extension in an import path is a **module identifier** for the runtime, not a filesystem lookup. After compilation, the file will be `CubeRenderer3D.js`; the import is written for where the file will be, not where it is now.

When `moduleResolution` is `"bundler"`, TypeScript resolves `.js` imports to the corresponding `.ts` file for type-checking. Vite does the same at dev time. The alternative — writing `.ts` extensions — is non-standard and breaks downstream tooling that processes compiled output.

Rule: **write the extension you want in the compiled output**.

### `export type`

```typescript
export { CubeState }           from './CubeState.js';   // value — exists at runtime
export type { RawPattern }     from './CubeState.js';   // type-only — erased at runtime
```

`export type` marks exports that exist only in the TypeScript type system. Bundlers tree-shake them out completely; they produce no runtime code. Interfaces and type aliases always use `export type`. Classes and functions use plain `export`.

### Why 10 tests are always skipped

**6 skipped — canvas not installed** (`cube-renderer-2d.test.ts`): The canvas-based render path (`update()` / `toDataURL()`) requires `node-canvas`. Tests are guarded with `CUBIFY_CANVAS_TESTS=1`. The SVG path runs unconditionally in `cube-renderer-2d-svg.test.ts`.

**4 skipped — WebGL requires headed browser** (`cube-renderer-3d.test.ts`): `CubeRenderer3D` uses Three.js/WebGL which cannot run in Node.js. These are placeholder stubs marking scenarios that would require a Playwright browser suite. Geometry constants (`MOVE_AXIS`) that don't need WebGL run normally.

### Test import quirk

Tests use `.ts` extensions; source files use `.js`:

```typescript
// cube-state.test.ts — imports from outside Vite root
import { CubeState } from '../src/CubeState.ts';

// CubePlayer.ts — imports within the same package
import { CubeState } from './CubeState.js';
```

Tests in `packages/cubify/test/` are outside the Vite project root (`cubify-harness/`). Vite's automatic `.js`→`.ts` remapping only applies within its configured root, so paths outside it require the explicit `.ts` extension. Both are correct — different resolution contexts.

### Publish workflow

Tag push triggers `.github/workflows/publish.yml`:

```bash
bash scripts/version-bump.sh 1.1.0   # bumps both packages, commits, tags
git push && git push --tags           # → CI builds and publishes both packages
```

The workflow requires `packages: write` (implies `read`). Any CI workflow that *installs* from GitHub Packages needs `packages: read` in its permissions block — an explicit `permissions:` key silently drops all unspecified scopes, including package read access.

---

## Operational gotchas

### GitHub Packages — publishing (read before publishing)

**`workspace:*` is pnpm/yarn syntax — not supported by npm.** Use the actual version range (`^1.0.0`) in devDependencies for sibling workspace packages. npm workspace resolution picks up the local version when it satisfies the range.

**Any workflow that installs from GitHub Packages needs `packages: read` in its permissions block.** Specifying an explicit `permissions:` key in a GitHub Actions workflow restricts `GITHUB_TOKEN` to exactly those scopes — all others are dropped. Without `packages: read`, `npm ci` gets a 403 even for packages you own.

**Never use `npm install <tarball>` to work around a missing token.** It resolves correctly locally but writes `file:/path/to/tarball.tgz` into `package-lock.json`. CI runners don't have that path and fail with `ENOENT`. Use `npm link` instead if you need a local install without publishing — it doesn't touch the lock file.

**Local installs from GitHub Packages need a classic PAT with `read:packages`.** The `gh` CLI OAuth token (`gho_...`) does not have this scope. Add to `~/.zprofile`:
```bash
export NPM_AUTH_TOKEN=<your-pat>
```

### Playwright / web component automation (read before screenshotting a component)

When automating or screenshotting a third-party web component:

1. **Inspect structure first** — write a throwaway script to dump shadow root children and bounding rects.
2. **Clip to the visualization element** — find the exact element (canvas, SVG wrapper) and use `page.screenshot({ clip: rect })`.
3. **Use `page.addInitScript()` for intercepts** — runs before any page script.
4. **`headless: false` required for WebGL on macOS** — headless Chromium blocks WebGL regardless of flags.

See `specs/017-cubify-agent-skill/research.md` for the full debugging record.
