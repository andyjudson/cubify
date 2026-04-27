# cubify — Library Architecture Reference

A ground-up explanation of how this library is structured, why each configuration choice was made, and what happens at each stage from TypeScript source to a consumer importing the library.

---

## What a library is (vs an application)

An **application** has an entry point that runs — a `main()` function, an HTML file that loads a script, a server process. Its code is the final consumer of everything it imports.

A **library** is a package whose purpose is to be imported by *other* code. It never runs directly. Everything it exports is an API surface for consumers.

This distinction drives most of the structural decisions below. A library:

- Must declare what it exports so consumers know the shape
- Should not bundle its dependencies — the consumer's bundler does that
- Must ship type definitions so TypeScript consumers get IDE autocomplete and type safety

---

## Repository layout

```
cubify/                          ← repo root, also the npm package
├── src/                         ← TypeScript source (the library you write)
│   ├── index.ts                 ← public barrel — re-exports the whole API
│   ├── CubeState.ts
│   ├── AlgParser.ts
│   ├── CubeScramble.ts
│   ├── CubeStickering.ts
│   ├── CubeRenderer3D.ts
│   ├── CubeRenderer2D.ts
│   ├── CubePlayer.ts
│   └── CubeExporter.ts
├── test/                        ← Vitest test suite (138 pass, 10 skip)
│   ├── cube-state.test.ts
│   ├── cube-stickering.test.ts
│   ├── cube-renderer-2d.test.ts
│   ├── cube-renderer-2d-svg.test.ts
│   ├── cube-renderer-3d.test.ts
│   ├── cube-player.test.ts
│   └── cube-exporter.test.ts
├── types/                       ← GENERATED — do not edit by hand
│   ├── index.d.ts               ← declaration mirror of src/index.ts
│   ├── CubeState.d.ts
│   └── …                        ← one .d.ts per .ts source file
├── tsconfig.json                ← TypeScript compiler config (type-check + emit)
├── package.json                 ← npm package manifest
├── .gitignore                   ← types/ and dist/ are gitignored (generated)
└── cubify-harness/              ← test runner environment
    ├── node_modules/            ← cubing, three, @types/three all live here
    └── vitest.config.js         ← include: ['../test/**/*.test.ts']
```

The `types/` directory is generated output — it is rebuilt by running `tsc` and should never be committed or edited directly.

---

## package.json — the npm manifest

```json
{
  "name": "cubify",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./types/index.d.ts",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types":  "./types/index.d.ts"
    }
  },
  "peerDependencies": {
    "cubing": "^0.63.3",
    "three":  "^0.170.0"
  }
}
```

### `"type": "module"`

Tells Node.js (and bundlers) that all `.js` files in this package use **ESM** (`import`/`export`) rather than CommonJS (`require`). Without this, `.js` files are assumed to be CommonJS.

This matters because the library imports `three` and `cubing` using ESM syntax. Setting `"type": "module"` makes that legal without any file renaming.

### `"main"` and `"exports"`

These tell consumers where the package entry point is. `"exports"` is the modern version; `"main"` is the legacy fallback.

The `"exports"` map has two conditions:

- `"import"` — resolved when a consumer writes `import { CubeState } from 'cubify'` using ESM. Points to the TypeScript source.
- `"types"` — resolved by the TypeScript compiler when it needs to type-check a consumer's use of the library. Points to the generated `.d.ts` file.

In a typical published library you would ship compiled JavaScript and point `"import"` at that. Here the library is consumed by Vite-based projects that transpile TypeScript themselves, so the source `.ts` files are the correct target.

### `"peerDependencies"` vs `"dependencies"`

**`dependencies`**: packages the library bundles or requires to be installed automatically alongside it. They become part of the install.

**`peerDependencies`**: packages the consumer is expected to already have. The library uses them but refuses to manage them. If the consumer doesn't have them, npm prints a warning.

`cubing` and `three` are peers here because:

1. They are large packages with their own release cycles and versioning concerns.
2. A consumer likely already has them in their own project.
3. If the library bundled its own copy, a consumer that also imports `three` would end up with two copies, causing subtle bugs (broken `instanceof` checks, double memory, etc.).

---

## tsconfig.json — every setting explained

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "declaration": true,
    "declarationDir": "./types",
    "emitDeclarationOnly": true,
    "rootDir": "./src",
    "outDir": "./dist",
    "skipLibCheck": true,
    "allowImportingTsExtensions": false,
    "paths": { … },
    "typeRoots": ["./cubify-harness/node_modules/@types"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "cubify-harness", "cubify-scripts"]
}
```

### `target: "ES2022"`

The JavaScript language version the compiler targets when **downlevelling** features. ES2022 supports `class fields`, `await at top-level`, and most modern syntax. Setting this high means `tsc` does minimal transformation; Vite handles further transpilation for browser compatibility if needed.

For a library with `emitDeclarationOnly` this setting matters less — no JS is emitted — but it still affects which type-checking rules apply.

### `module: "ESNext"` and `moduleResolution: "bundler"`

These two work together and control how `import` statements are interpreted.

`module: "ESNext"` — keep `import`/`export` syntax as-is in output (no CommonJS conversion).

`moduleResolution: "bundler"` — the resolution algorithm TypeScript uses to find modules. This mode mirrors how Vite and other bundlers resolve imports:

- Bare specifiers (`import ... from 'cubing/alg'`) → look in `node_modules/cubing/alg`
- Relative paths with `.js` extension (`import ... from './CubeState.js'`) → resolve to `./CubeState.ts` if the `.ts` file exists

That last point is crucial and explains the pattern you'll see throughout `src/`.

### Why source files import `.js` but are `.ts` files

This is the most confusing part of modern TypeScript library structure. Here is the direct answer first, then the explanation.

**The `.js` files are gone from disk.** `src/CubeState.js` does not exist. Only `src/CubeState.ts` does.

**Yet the import path says `.js`:**

```typescript
// Inside CubePlayer.ts
import { CubeRenderer3D } from './CubeRenderer3D.js';
import { CubeState }      from './CubeState.js';
```

This is intentional. The extension in an import path is a **module identifier**, not a filename lookup. It is the address the module system uses at runtime — and at runtime, after any compilation step, the files *would* be `.js`. The import is written for where the file will be, not where it is right now.

Think of it like a postal address written for the finished building, not the construction site.

**How TypeScript handles it:** When TypeScript sees `import from './CubeState.js'` and `moduleResolution` is `"bundler"`, it does not look for a file literally named `CubeState.js`. It checks: is there a `CubeState.ts` with the same stem? Yes — use that for type-checking. At runtime (Vite handles the actual loading), Vite applies the same logic.

**Why not just write `.ts`?** You could write `import from './CubeState.ts'` and Vite would accept it. But TypeScript would reject it when `allowImportingTsExtensions` is false (our setting). That flag is intentionally false because writing `.ts` in imports is non-standard and would break any consumer that compiles this library to plain JavaScript — the output files would be `.js` and the import would point at something that no longer exists.

The rule of thumb: **write the extension you want to see in the compiled output**. Since TypeScript compiles `.ts` → `.js`, the imports should say `.js` even though the source files are `.ts`.

### `lib: ["ES2022", "DOM"]`

Tells TypeScript which global APIs exist. `ES2022` includes `Promise`, `Map`, `Array` methods etc. `DOM` includes `document`, `HTMLCanvasElement`, `ResizeObserver`, `requestAnimationFrame`, and everything else a browser environment provides.

Without `"DOM"`, TypeScript would not know what `document.createElement` is, and `CubeRenderer3D.ts` would fail to type-check.

### `strict: true`

Enables the full suite of TypeScript's strictness checks as a single flag:

- `strictNullChecks` — `null` and `undefined` are distinct types; you must check before using
- `noImplicitAny` — every variable must have an inferable or explicit type
- `strictFunctionTypes` — function parameters are checked contravariantly
- Several others

This is the standard setting for any serious TypeScript project.

### `declaration: true` and `declarationDir: "./types"`

`declaration: true` — instruct tsc to produce `.d.ts` type declaration files alongside compilation.

`declarationDir: "./types"` — instead of placing `.d.ts` files next to their `.ts` source, place them all in the `types/` directory.

This is the mechanism by which a TypeScript library ships types to its consumers. The consumer's TypeScript compiler reads `types/index.d.ts` and learns the full shape of every export without ever seeing the source.

### `emitDeclarationOnly: true`

This is the key setting that makes this a **types-only build**. Normally, `tsc` compiles `.ts` → `.js`. With this flag, it skips all JavaScript output and only produces `.d.ts` files.

Why skip JavaScript output? Because Vite transpiles the TypeScript source directly — the raw `.ts` files are what gets served to the browser/Node. There is no need for pre-compiled JavaScript. Running `tsc` here is purely a type-declaration-generation step.

Flow:
```
src/CubeState.ts
      │
      ▼ tsc --emitDeclarationOnly
types/CubeState.d.ts   ← shape of the module (no implementation, types only)
```

The `.d.ts` file for `CubeState` looks like this:

```typescript
export interface RawOrbitData {
    pieces: number[];
    orientation: number[];
}
export declare class CubeState {
    private _kPattern;        ← private field exists but type is hidden
    static solved(): Promise<CubeState>;
    applyMove(move: string): CubeState;
    applyAlg(moves: string[] | string): CubeState;
    toFaceArray(): string[][];
    static invertAlg(moves: string[]): string[];
    toRawPattern(): RawPattern;
    isSolved(): boolean;
}
```

`declare` signals "this thing exists but the implementation is elsewhere". The private field `_kPattern` is present in the type so TypeScript knows it exists, but its type is hidden from consumers — they can see `solved()` returns a `CubeState` but cannot access internals.

### `rootDir: "./src"`

Tells tsc that all source TypeScript files live under `src/`. This determines the output directory structure: `src/CubeState.ts` → `types/CubeState.d.ts`, not `types/src/CubeState.d.ts`. Without this, tsc looks for the common ancestor of all compiled files, which may introduce an unwanted `src/` prefix in the output paths.

### `outDir: "./dist"`

Where compiled JavaScript would go. With `emitDeclarationOnly`, no JavaScript is produced so this directory is never written. It is set here for completeness — if you ever remove `emitDeclarationOnly` to produce a compiled distribution, the output would land in `dist/`.

### `skipLibCheck: true`

Skip type-checking of `.d.ts` files in `node_modules`. This dramatically speeds up compilation and avoids errors from declaration files in dependencies that may have minor inconsistencies or use features from newer TypeScript versions. For a library that is not shipping complex re-exports of dependency types, this is safe.

### `allowImportingTsExtensions: false`

Disallows writing `import from './CubeState.ts'` (`.ts` extension) inside TypeScript source files. This enforces the `.js` extension convention described earlier, keeping source imports consistent with what the compiled output will look like.

### `paths` — finding cubing and three without a root install

```json
"paths": {
  "cubing":   ["./cubify-harness/node_modules/cubing"],
  "cubing/*": ["./cubify-harness/node_modules/cubing/*"],
  "three":    ["./cubify-harness/node_modules/@types/three"],
  "three/*":  ["./cubify-harness/node_modules/@types/three/*"]
}
```

`cubing` and `three` are installed in `cubify-harness/node_modules/`, not in the root `cubify/node_modules/`. Vite finds them fine at runtime because the harness's Vite root is `cubify-harness/` — its `node_modules/` is the first place it looks, and the `src/` files outside that root are still processed by the same Vite instance.

`tsc` is different. It resolves modules relative to the `tsconfig.json` location (`cubify/`), looks in `cubify/node_modules/` first, and does not walk into sibling directories. Since the packages aren't there, `tsc` fails to find them without help.

`paths` is the fix: it redirects bare specifier resolution to an explicit directory. `"cubing/*"` catches all subpath imports like `cubing/alg`, `cubing/puzzles`, etc.

For `three`, the `paths` points at `@types/three` rather than the `three` package itself. This is because the `three` npm package does not ship its own `.d.ts` files — the community types live in `@types/three`. Pointing the module path directly at the types package makes `tsc` find the declarations immediately.

### `typeRoots`

```json
"typeRoots": ["./cubify-harness/node_modules/@types"]
```

`typeRoots` controls where `tsc` looks for ambient type packages — things like `@types/node` that add global type declarations without being explicitly imported. By default, tsc looks in `./node_modules/@types`. Since `@types/` packages live in the harness instead, this redirects the lookup.

### `include` and `exclude`

```json
"include": ["src/**/*.ts"],
"exclude": ["node_modules", "cubify-harness", "cubify-scripts"]
```

Only files under `src/` are compiled. The harness and scripts directories are excluded — they have their own build contexts.

---

## How declaration files are generated

Running from `cubify-harness/` (so tsc can find the node_modules):

```bash
npx tsc -p ../tsconfig.json
```

What happens:

1. tsc reads `cubify/tsconfig.json`
2. Collects all `src/**/*.ts` files
3. Type-checks each file, resolving imports via `paths` to find cubing and three
4. For each `.ts` file, emits a corresponding `.d.ts` into `types/`
5. No JavaScript is written (due to `emitDeclarationOnly`)

The generated `types/` directory is gitignored. It is rebuilt as part of any release workflow.

---

## What `export type` means

In `index.ts` you will see two kinds of export:

```typescript
export { CubeState } from './CubeState.js';         // value export
export type { RawPattern } from './CubeState.js';   // type-only export
```

`export type` marks exports that exist only in TypeScript's type system. At runtime (in transpiled JavaScript), these are completely erased — they produce no code. This is important for a few reasons:

- Bundlers can tree-shake type-only exports reliably
- It avoids accidentally shipping runtime code that was only meant for type checking
- TypeScript can warn if you accidentally write `export type { CubeState }` for something that has a runtime value

`RawPattern` is an interface — it has no runtime representation at all, so `export type` is correct. `CubeState` is a class — it has a constructor and methods that exist at runtime, so it uses plain `export`.

---

## The test import quirk

Test files in `test/` import source files using `.ts` extensions:

```typescript
// cube-state.test.ts
import { CubeState } from '../src/CubeState.ts';
```

Source files in `src/` import each other using `.js` extensions:

```typescript
// CubePlayer.ts
import { CubeState } from './CubeState.js';
```

These look inconsistent. Here is why each is correct in its context.

**Source files use `.js`** because, as explained above, this is the TypeScript ESM convention. TypeScript's bundler module resolution remaps `.js` → `.ts` during type-checking. The output (if there were any) would be `.js`.

**Test files use `.ts`** because they import from *outside* the Vite project root. The Vite project root is `cubify-harness/` — that is where `vitest.config.js` lives and where `node_modules/` is. The `test/` and `src/` directories are both outside this root. Vite's automatic `.js`→`.ts` remapping only applies within its configured root, so files outside it require the explicit `.ts` extension. Vite happily processes `.ts` files regardless of where they are; it just will not automatically resolve `.js` to `.ts` for paths outside the root.

---

## Why 10 tests are always skipped

Running `npm test` from `cubify-harness/` reports 138 passed and 10 skipped. The skips are intentional and fall into two categories.

**6 skipped — canvas package not installed (`cube-renderer-2d.test.ts`)**

`CubeRenderer2D` has a canvas-based rendering path (`update()` / `toDataURL()`) that requires a real 2D drawing context. In Node.js there is no built-in canvas, so these tests depend on the optional `canvas` npm package (node-canvas). They are guarded with:

```typescript
const CANVAS_ENABLED = process.env.CUBIFY_CANVAS_TESTS === '1';
describe.skipIf(!CANVAS_ENABLED)('CubeRenderer2D canvas …', () => { … });
```

To enable them: `npm install --save-dev canvas` inside `cubify-harness/`, then run `CUBIFY_CANVAS_TESTS=1 npm test`. The SVG rendering path (the other half of `CubeRenderer2D`) has no dependency and runs unconditionally in `cube-renderer-2d-svg.test.ts`.

**4 skipped — WebGL requires a headed browser (`cube-renderer-3d.test.ts`)**

`CubeRenderer3D` uses Three.js and WebGL. These cannot be exercised in a headless Node.js environment at all. The 4 skipped tests are placeholder stubs marking the scenarios that would be covered by a Playwright or Puppeteer browser test suite:

```typescript
describe.skip('CubeRenderer3D WebGL tests — requires headed browser (Playwright)', () => {
  it('stickerIndex U face: idx(x, z) formula', …);
  …
});
```

The geometry constants (`MOVE_AXIS`) that do not require WebGL are tested normally and always run.

---

## How a consumer uses this library

If another project installed cubify (e.g. `npm install ../cubify`), it would write:

```typescript
import { CubeState, CubePlayer, CubeScramble } from 'cubify';
```

Node/bundler resolution:
1. Find `cubify` in `node_modules/cubify/`
2. Read `package.json` → `"exports" → "." → "import": "./src/index.ts"`
3. Load `src/index.ts` and transpile it (Vite does this automatically)

TypeScript resolution:
1. Same `package.json` → `"exports" → "." → "types": "./types/index.d.ts"`
2. Read `types/index.d.ts` → follow re-exports to `types/CubeState.d.ts` etc.
3. Provide autocomplete and type safety from the generated declarations

The consumer never sees the source TypeScript directly — they get the type declarations for IDE support and the raw TypeScript for the bundler.

---

## The overall data flow

```
src/*.ts  ──────────────────────────────────────────────────────────────────┐
    │                                                                        │
    │  tsc --emitDeclarationOnly                                             │  Vite/Vitest (at dev/test time)
    ▼                                                                        │  transpiles directly — no pre-compile
types/*.d.ts  ← type contract for TypeScript consumers                       │
                                                                             ▼
                                                               cubify-harness (browser/Node)
                                                               OR consumer project
```

There is no compiled JavaScript step. The TypeScript source is the distribution artifact for this library. Types are generated separately and used only by editors and the TypeScript compiler — they play no role at runtime.

---

## Key things that make this different from a typical published npm package

A typical published library (e.g. lodash, axios) would:

1. Compile TypeScript → JavaScript
2. Ship the compiled `.js` to npm
3. Ship `.d.ts` files alongside
4. List `typescript` as a `devDependency` (for the build step)

This library takes a simpler approach suited to a monorepo or closely-coupled consumer:

1. Ship the raw TypeScript source
2. Rely on the consumer's Vite to transpile
3. Generate `.d.ts` for type checking only
4. Never pre-compile to JavaScript at all

This is increasingly common in the Vite/unbundled ecosystem. The tradeoff: the library can only be consumed by toolchains that understand TypeScript (Vite, Webpack 5 + ts-loader, etc.) — it would not work as a direct `<script>` tag or in a plain Node.js project without compilation.
