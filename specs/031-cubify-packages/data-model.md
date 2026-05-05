# Data Model: Feature 031 — cubify-packages

This feature has no database entities. The "data model" here is the **package shape** — `package.json` contracts, exports maps, and TypeScript API surface for both published packages.

---

## Package: `@andyjudson/cubify`

### `packages/cubify/package.json`

```json
{
  "name": "@andyjudson/cubify",
  "version": "1.0.0",
  "type": "module",
  "description": "Clean-room 3×3 cube rendering and logic library",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/andyjudson/cubify.git"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "peerDependencies": {
    "cubing": "^0.63.3",
    "three": "^0.170.0"
  },
  "devDependencies": {
    "cubing": "^0.63.3",
    "three": "^0.170.0",
    "typescript": "^6.0.3"
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

### `packages/cubify/tsconfig.build.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "declaration": true,
    "emitDeclarationOnly": false,
    "rootDir": "./src",
    "outDir": "./dist",
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

### Public exports (unchanged from current `src/index.ts`)

| Export | Type |
|--------|------|
| `CubeState` | class |
| `CubeScramble` | class |
| `AlgParser` | class |
| `CubeStickering`, `MASK_PRESETS` | class, const |
| `CubeTheme`, `THEME_PRESETS`, `DEFAULT_THEME` | class, const, const |
| `CubeRenderer2D` | class |
| `CubeRenderer3D`, `MOVE_AXIS` | class, const |
| `CubePlayer` | class |
| `CubeExporter` | class |

---

## Package: `@andyjudson/cubify-react`

### `packages/cubify-react/package.json`

```json
{
  "name": "@andyjudson/cubify-react",
  "version": "1.0.0",
  "type": "module",
  "description": "React wrappers for @andyjudson/cubify",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/andyjudson/cubify.git"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "peerDependencies": {
    "@andyjudson/cubify": "^1.0.0",
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "@andyjudson/cubify": "workspace:*",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "typescript": "^6.0.3"
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

### `packages/cubify-react/tsconfig.build.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "jsx": "react-jsx",
    "declaration": true,
    "emitDeclarationOnly": false,
    "rootDir": "./src",
    "outDir": "./dist",
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

### Public exports (moved from `cfop-app/src/lib/cubify/`)

| Export | Type | Source file |
|--------|------|-------------|
| `<CubePlayer>` | React component | `CubePlayerComponent.tsx` |
| `CubePlayerHandle` | TypeScript type | `CubePlayerComponent.tsx` |
| `CubePlayerProps` | TypeScript type | `CubePlayerComponent.tsx` |
| `MoveEvent` | TypeScript type | `CubePlayerComponent.tsx` |
| `<CubePlayerControls>` | React component | `CubePlayerControls.tsx` |
| `CubePlayerControlsProps` | TypeScript type | `CubePlayerControls.tsx` |
| `<CubeMoveTape>` | React component | `CubeMoveTape.tsx` |
| `CubeMoveTapeProps` | TypeScript type | `CubeMoveTape.tsx` |
| `<CubeState>` | React component | `CubeStateComponent.tsx` |
| `CubeStateProps` | TypeScript type | `CubeStateComponent.tsx` |

---

## Workspace root `package.json`

```json
{
  "name": "cubify-workspace",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "vitest run",
    "dev": "cd cubify-harness && vite",
    "typecheck": "npm run typecheck --workspaces"
  },
  "devDependencies": {
    "cubing": "^0.63.3",
    "three": "^0.170.0",
    "typescript": "^6.0.3",
    "vite": "^8.0.8",
    "vitest": "^2.1.9",
    "sharp": "^0.34.5"
  },
  "engines": { "node": ">=18.0.0" }
}
```

---

## Repository layout after migration

```
cubify/                                  ← workspace root
  package.json                           ← workspaces: ["packages/*"]
  tsconfig.json                          ← root typecheck config (harness dev only)
  packages/
    cubify/                              ← @andyjudson/cubify
      src/                               ← moved from root src/
      dist/                              ← tsc build output (gitignored)
      test/                              ← moved from root test/
      package.json
      tsconfig.json
      tsconfig.build.json
    cubify-react/                        ← @andyjudson/cubify-react
      src/                               ← moved from cfop-app/src/lib/cubify/
      dist/                              ← tsc build output (gitignored)
      package.json
      tsconfig.json
      tsconfig.build.json
  cubify-harness/                        ← stays at root; imports from packages/cubify/src/
  cubify-scripts/                        ← stays at root
    data -> /path/to/cfop-app/public/data  ← symlink unchanged
  scripts/
    version-bump.sh                      ← NEW: bump both packages to same version + tag
  .github/
    workflows/
      publish.yml                        ← NEW: tag-triggered publish
  .gitignore                             ← add packages/*/dist

cfop/
  cfop-app/
    .npmrc                               ← NEW: @andyjudson:registry + auth token ref
    package.json                         ← add @andyjudson/cubify + @andyjudson/cubify-react
    vite.config.ts                       ← remove cubify alias
    src/lib/cubify/                      ← DELETED (moved to cubify-react package)
  .github/workflows/
    deploy.yml                           ← add NODE_AUTH_TOKEN to install step
```
