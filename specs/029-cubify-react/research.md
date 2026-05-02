# Research — Feature 029: cubify-react

## Decision 1: Component location

**Decision:** React wrapper components live in `cfop-app/src/lib/cubify/` — separate from the core library.

**Rationale:** The constitution hard-rules "no frameworks in core." Adding React to `cubify/src/` would introduce a React dependency into the library itself. The wrappers are thin bridge code specific to cfop-app's React tree; they belong in cfop-app.

**Alternatives considered:**
- `cubify/src/react/` — rejected; violates constitution.
- Separate `cubify-react/` npm package — correct long-term direction but premature; no publishing pipeline exists yet.

---

## Decision 2: Import path — Vite alias over relative import

**Decision:** Add a `cubify` alias in `cfop-app/vite.config.ts` pointing to `../../../cubify/src/index.ts`, and a matching `paths` entry in `cfop-app/tsconfig.json`. Component files import from `'cubify'` not from a long relative path.

**Rationale:** Relative imports across two sibling git repos (`../../cubify/src/...`) are fragile and noisy. A single alias makes the import surface identical to what it will be once cubify is a published package — zero churn at migration time.

**Alternatives considered:**
- Raw relative imports — works but couples all files to the exact repo layout.
- npm `file:` reference in cfop-app's package.json — needs `npm install` reruns on cubify changes; adds friction.

---

## Decision 3: React lifecycle pattern — useRef + useEffect

**Decision:** Use the standard `useRef` + `useEffect` pattern. Separate effects per reactive dependency. Mount effect creates the instance; each prop has its own effect with that prop in the dependency array.

**Rationale:** This is the established React pattern for imperative APIs. React 19 ref callbacks (which return a cleanup function) are cleaner for mount/dispose but less familiar; the useRef approach is well understood and compatible with StrictMode double-invoke via an existence check.

```tsx
// Mount
useEffect(() => {
  const player = new CubePlayer();
  player.mount(containerRef.current!);
  playerRef.current = player;
  return () => { player.dispose(); playerRef.current = null; };
}, []);

// Per-prop sync
useEffect(() => {
  if (alg !== undefined) playerRef.current?.loadAlg(alg, setup, { anchor });
}, [alg, setup, anchor]);
```

**StrictMode safety:** The mount effect checks `if (!playerRef.current)` before constructing, and always disposes in cleanup. Double-invoke is safe because the second mount creates a fresh instance into the same container.

**Alternatives considered:**
- React 19 ref callbacks — cleaner syntax but less familiar; deferred to future refactor.
- `useMemo` for instance — wrong; instances with side effects must not live in memo.

---

## Decision 4 (addendum): Vite must deduplicate cubing.js — `resolve.dedupe`

**Problem discovered in integration:** When `cfop-app` imports cubify source via the Vite alias and cubify's own `node_modules/cubing` is a separate install from `cfop-app/node_modules/cubing`, Vite bundles both copies. `CubeState.applyAlg` was calling `new Alg(str)` (using cubify's cubing instance), but `kPattern.traverseAlg` was dispatched using cfop-app's cubing visitor. The `instanceof` checks inside cubing.js's `dispatch()` fail across instances → every move threw `Error: unknown AlgNode`.

**Fix — two parts (both required):**

1. **Pass alg strings directly**, not `Alg` objects, to `kPattern.applyAlg()`. `KPattern.applyAlg` accepts raw strings; wrapping with `new Alg()` risks cross-instance mismatch. Fixed in `CubeState.applyAlg`:
   ```typescript
   // Wrong — Alg object from cubify's cubing instance fails cfop-app's visitor:
   return new CubeState(this._kPattern.applyAlg(new Alg(algStr)));
   // Correct — string passthrough works across any module boundary:
   return new CubeState(this._kPattern.applyAlg(algStr));
   ```

2. **Add `dedupe: ['cubing']` to `vite.config.ts`** to guarantee a single cubing.js instance regardless of how many `node_modules` trees contain it:
   ```typescript
   resolve: {
     alias: { cubify: resolve(__dirname, '../../cubify/src/index.ts') },
     dedupe: ['cubing'],
   }
   ```

**Root cause signal:** Stack traces showing `dispatch (chunk-WKZF2DBH.js)` alongside `traverseAlg (cubing_puzzles.js)` as different files confirms two separate bundles.

**Rule:** Any app that sources cubify directly (not as a published package) AND has cubing in its own `node_modules` MUST add `dedupe: ['cubing']`. When cubify is published and the app lists cubing as a peer/devDependency with a matching version, a single copy is guaranteed naturally.

---

## Decision 4 (cont.): No Vitest unit tests for React wrappers

**Decision:** Skip Vitest unit tests for `CubePlayerComponent` and `CubeStateComponent`. Validate via manual harness testing and Playwright E2E in cfop-app.

**Rationale:** The components' job is wiring props to imperative method calls. Testing that wiring in jsdom requires mocking the entire cubify module, which tests the mock rather than the real behaviour. WebGL is unavailable in jsdom regardless. The existing cubify Vitest suite already covers the library; the React wrapper is integration glue.

**Alternatives considered:**
- vi.mock() unit tests — possible but brittle; mocking CubePlayer to verify loadAlg was called adds maintenance cost for low confidence.
- Playwright component tests — correct approach if cfop-app already uses Playwright; deferred to feature 031 integration.

---

## Decision 5: `playing` prop semantics — edge-triggered, not level

**Decision:** The `playing` prop is edge-triggered. When it changes from `false` to `true`, call `player.play()`. When it changes from `true` to `false`, call `player.pause()`. The component does not attempt to sync player state back to `playing` on `onComplete`.

**Rationale:** CubePlayer is the source of truth for animation state. The React component drives it imperatively; it does not try to mirror internal player state back to props. The consumer is responsible for setting `playing={false}` in response to `onComplete` if needed.

---

## Decision 6: `stepIndex` prop — controlled-only

**Decision:** `stepIndex` is an optional controlled prop. When provided and changed, the component calls `player.jumpTo(stepIndex)`. The component does not track step internally. Uncontrolled step advancement (via play/onMove) is left to the consumer.

**Rationale:** Controlled props are predictable. The consumer who needs to display `currentStep` listens to `onMove` and maintains their own state variable; they then pass it back as `stepIndex` if they want full control. Components that don't need step control simply omit the prop.
