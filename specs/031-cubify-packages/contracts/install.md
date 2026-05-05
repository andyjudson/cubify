# Install & Usage Contract

## Consumer requirements

To install either package, consumers need a `.npmrc` with the GitHub Packages registry scoped to `@andyjudson`:

```
@andyjudson:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

A GitHub personal access token (classic, `read:packages` scope) or a `GITHUB_TOKEN` from Actions is sufficient.

## `@andyjudson/cubify`

```bash
npm install @andyjudson/cubify
# Peer deps — also install:
npm install three cubing
```

```ts
import {
  CubeState, CubeScramble, AlgParser,
  CubeStickering, MASK_PRESETS,
  CubeTheme, THEME_PRESETS,
  CubeRenderer2D, CubeRenderer3D,
  CubePlayer, CubeExporter,
} from '@andyjudson/cubify';
```

## `@andyjudson/cubify-react`

```bash
npm install @andyjudson/cubify-react
# Peer deps — also install:
npm install @andyjudson/cubify three cubing react react-dom
```

```tsx
import {
  CubePlayer, CubeState, CubeMoveTape, CubePlayerControls,
} from '@andyjudson/cubify-react';
import type { CubePlayerHandle } from '@andyjudson/cubify-react';
```

## Version compatibility

Both packages are published at the same version (lockstep). `@andyjudson/cubify-react@1.0.0` requires `@andyjudson/cubify@^1.0.0`.
