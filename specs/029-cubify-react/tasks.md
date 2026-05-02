# Tasks: Feature 029 — cubify-react

**Input**: `specs/029-cubify-react/` — spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md
**Prerequisites**: Features 027–028 complete; 167-test Vitest baseline passing

**Format**: `[ID] [P?] [Story?] Description — file path`
- **[P]**: parallelisable (different file, no incomplete dependency)
- **[Story]**: US1 = `<CubePlayer>`, US2 = `<CubeState>`

---

## Phase 1: Setup

**Purpose**: Confirm library baseline and wire the import alias before any component work.

- [X] T001 Run `npm test` from `/Users/Andy/Documents/TechLab/cubify` and confirm 168 tests pass, 10 skipped, 0 failures — no file changes
- [X] T002 Add `resolve.alias` entry `cubify: resolve(__dirname, '../../../cubify/src/index.ts')` to `cfop-app/vite.config.ts`; add necessary `resolve` and `fileURLToPath` imports
- [X] T003 Add `"paths": { "cubify": ["../../cubify/src/index.ts"] }` under `compilerOptions` in `cfop-app/tsconfig.app.json`
- [X] T004 Create `cfop-app/src/lib/cubify/index.ts` as an empty barrel file (exports to be filled by T008 and T011)

---

## Phase 2: US1 — `<CubePlayer>` component

**Goal**: A React component that mounts `CubePlayer`, drives play/pause via props, syncs alg/stickering/theme changes imperatively, and disposes cleanly on unmount.

**Independent test**: Import `<CubePlayer alg="R U R' U'" style={{ width: 300, height: 300 }} />` in a minimal cfop-app page — Bulma skeleton appears briefly, cube renders, no console errors. Set `playing={true}` — animation runs.

- [X] T005 [US1] Create `cfop-app/src/lib/cubify/CubePlayerComponent.tsx`: define `MoveEvent` and `CubePlayerProps` interfaces (all props from contracts/CubePlayerComponent.ts); implement mount/unmount effect (create CubePlayer instance, call `player.mount(containerRef.current!)`, set `ready(true)`, dispose + `ready(false)` on cleanup); render Bulma `skeleton-block` at full size while `!ready`, canvas container with `display: none` until ready
- [X] T006 [US1] Add prop-sync effects to `cfop-app/src/lib/cubify/CubePlayerComponent.tsx`: `alg/setup/anchor` → wrap `player.loadAlg()` in try/catch, `console.warn` + show solved on invalid alg; `stickering` → `player.setStickering()`; `theme` → `player.renderer.setTheme()`; `playing` → edge-trigger `play()`/`pause()`; `speed` → `player.setSpeed()`; `stepIndex` → `player.jumpTo()` when defined
- [X] T007 [US1] Add event listener effects to `cfop-app/src/lib/cubify/CubePlayerComponent.tsx`: wrap `onMove`/`onComplete`/`onReset` in `useCallback`; register on player in a single effect; deregister all three in the effect cleanup
- [X] T008 [US1] Export `{ CubePlayer }` from `cfop-app/src/lib/cubify/index.ts`

---

## Phase 3: US2 — `<CubeState>` component

**Goal**: A display-only React component that shows a static cube state (inverse of `alg` applied to solved), with stickering and theme, using a Bulma skeleton while the async solved base loads.

**Independent test**: Render `<CubeState alg="R U R' U R U2 R'" stickering="oll" style={{ width: 200, height: 200 }} />` — skeleton flashes, Sune pre-case state appears with OLL mask (U face + top-of-side stickers visible, rest grey). Pass invalid alg — `console.warn` logged, solved cube shown, no crash.

- [X] T009 [P] [US2] Create `cfop-app/src/lib/cubify/CubeStateComponent.tsx`: define `CubeStateProps` interface; implement async mount effect — call `CubeState.solved()`, then create and mount `CubeRenderer3D`, set `ready(true)`; render Bulma `skeleton-block` while `!ready`, canvas container hidden until ready; dispose renderer and reset `ready` in cleanup
- [X] T010 [P] [US2] Add prop-sync effects to `cfop-app/src/lib/cubify/CubeStateComponent.tsx`: `alg/setup` → parse with `AlgParser`, apply `CubeState.invertAlg()` to solved base, call `renderer.setState()`; wrap in try/catch — `console.warn` + setState(solved) on invalid alg; `stickering` → `CubeStickering.fromOrbitStringWithState()` + `renderer.applyStickering()`; `theme` → `renderer.setTheme()`
- [X] T011 [US2] Export `{ CubeState }` from `cfop-app/src/lib/cubify/index.ts` (after T008 has written the initial export)

---

## Final Phase: Polish & Validation

- [X] T012 Manually validate both components against `specs/029-cubify-react/quickstart.md` test criteria: mount/unmount cycle (no orphaned rAF in DevTools), alg prop change reloads animation, skeleton → cube transition, OLL stickering on Sune case, invalid alg shows solved + console.warn, theme switching without remount
- [X] T013 Mark all Acceptance Criteria checkboxes complete in `specs/029-cubify-react/spec.md`; update Feature 029 status row to `Complete ✅` in `specs/spec.md`

---

## Dependencies & Execution Order

```
T001 → T002 → T003 → T004          (Setup — sequential, same files)
                  ↓
T005 → T006 → T007 → T008          (US1 — sequential, same file)
T009 → T010 →        T011          (US2 — sequential, same file; T011 after T008)

Both US1 and US2 can proceed in parallel after T004:
  T005 ‖ T009
  T006 ‖ T010
  T007
  T008 → T011                      (index.ts — T011 waits for T008)

T012 → T013                        (Polish — after all story tasks)
```

### Parallel opportunities

**US1 vs US2** — different files; can be developed concurrently after T004:

```
Sequential: T005 → T006 → T007 → T008   (CubePlayerComponent.tsx)
Parallel:   T009 → T010                  (CubeStateComponent.tsx)
```

T011 (index.ts) must follow T008 to avoid write conflicts on the same file.

---

## Implementation Strategy

### MVP (CubePlayer only)

1. T001–T004: setup and alias
2. T005–T008: `<CubePlayer>` component + export
3. Manual validation (quickstart scenario 1 — animated player)
4. Stop here if `<CubeState>` can wait

### Full delivery

5. T009–T011: `<CubeState>` component + export
6. T012: full validation against all 7 quickstart criteria
7. T013: spec and status update

### Notes

- `CubePlayer.mount()` is synchronous — `setReady(true)` fires in the same effect tick; skeleton will only flash briefly in slow environments
- `CubeState.solved()` is async (loads cubing.js KPuzzle) — skeleton is visible for ~100–200ms on first render; subsequent mounts may be faster if the KPuzzle is cached internally
- Both components must be validated in cfop-app's actual Vite dev server (not just Node) — Three.js WebGL requires a real browser context
- `T011` writes to the same `index.ts` as `T008`; implement by appending the new export rather than rewriting the file
