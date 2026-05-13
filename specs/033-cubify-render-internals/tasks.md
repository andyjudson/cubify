# Tasks: Cubify Render Internals

**Input**: Design documents from `specs/033-cubify-render-internals/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks grouped by user story — each story is independently implementable and testable in the harness.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same phase (different files, no unmet dependencies)
- **[Story]**: Maps task to user story (US1/US2/US3)

---

## Phase 1: Setup

**Purpose**: Create the new module scaffold and unit test file so all subsequent phases have concrete files to extend.

- [ ] T001 [P] Create `packages/cubify/src/CubeInternals.ts` — export `InternalsOptions` interface, `DEFAULT_INTERNALS_OPTIONS` constant, and empty stubs for `buildCoreGroup()` and `buildWallMaterial()`
- [ ] T002 [P] Create `packages/cubify/test/cube-internals.test.ts` — unit tests for `DEFAULT_INTERNALS_OPTIONS` values and range as specified in `contracts/renderer-internals.md`

**Checkpoint**: Module and test files exist; `npm test --workspace=packages/cubify` passes (new tests pass against the stub exports).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the internals state to `CubeRenderer3D` — fields, method stubs, and type imports. No user-visible behaviour yet; this unblocks all three user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 Add `InternalsOptions` import from `CubeInternals.ts`, four private fields (`_internalsEnabled: boolean`, `_internalsOptions: InternalsOptions`, `_coreGroup: THREE.Group | null`, `_internalsWallMaterial: THREE.Material | null`), initialise all in constructor, and add empty `setInternals(enabled: boolean, options?: Partial<InternalsOptions>): void` + `private _applyInternalsToMaterials(): void` stubs to `packages/cubify/src/CubeRenderer3D.ts`

**Checkpoint**: `npm test --workspace=packages/cubify` still passes; `CubeRenderer3D` compiles with new fields.

---

## Phase 3: User Story 1 — Transparent Sticker Panels (Priority: P1) 🎯 MVP

**Goal**: `setInternals(true)` makes all 54 outward sticker panel materials semi-transparent; `setInternals(false)` restores them to fully opaque. Theme changes while internals is active re-apply sticker opacity.

**Independent Test**: Load harness → apply any theme → click Internals toggle → sticker panels become visibly translucent from all angles; toggle off → fully opaque restored.

- [ ] T004 [US1] Implement `setInternals()` sticker branch in `packages/cubify/src/CubeRenderer3D.ts`: on enable iterate `_cubelets`, for each outward slot set `material.transparent = true`, `material.opacity = opts.stickerOpacity`, `material.depthWrite = false`, `material.needsUpdate = true`; on disable restore `transparent = (plasticOpacity < 1)`, `opacity = 1.0`, `depthWrite = (plasticOpacity >= 1)`, `needsUpdate = true`
- [ ] T005 [US1] Implement `_applyInternalsToMaterials()` sticker section in `packages/cubify/src/CubeRenderer3D.ts` (re-stamps opacity on all outward sticker materials using current `_internalsOptions`), and add `if (this._internalsEnabled) this._applyInternalsToMaterials();` at the end of `setTheme()` after the existing `restoreColours()` + `applyStickering()` calls
- [ ] T006 [P] [US1] Add Internals toggle button (id `btn-internals`) wired to `player.renderer.setInternals(enabled, { stickerOpacity })` and a stickerOpacity slider (id `slider-sticker-opacity`, range 0.3–1.0, default 0.65, step 0.05) to the Simulation tab in `cubify-harness/index.html`

**Checkpoint**: Toggle internals on/off in harness; sticker panels go semi-transparent and back. Theme switch while internals on updates materials. All 54 sticker faces affected.

---

## Phase 4: User Story 2 — Visible Cubelet Internal Walls (Priority: P2)

**Goal**: When internals is enabled, inward-facing cubelet walls use a DoubleSide semi-transparent material (frame colour) instead of the opaque shared `_plasticMaterial`. Rotating the cube reveals a visible inner shell rather than a black void.

**Independent Test**: Enable internals in harness → rotate cube to oblique angle → inner cubelet faces are visible with the frame colour at partial opacity, not black/absent. Dark theme: walls use dark plastic colour.

- [ ] T007 [US2] Implement `buildWallMaterial(plasticColour: string, options: InternalsOptions): THREE.Material` in `packages/cubify/src/CubeInternals.ts` — returns `new THREE.MeshStandardMaterial({ color: parseInt(plasticColour.slice(1),16), side: THREE.DoubleSide, transparent: true, opacity: options.wallOpacity })`
- [ ] T008 [US2] Extend `setInternals(true)` in `packages/cubify/src/CubeRenderer3D.ts` to call `buildWallMaterial()`, store as `_internalsWallMaterial`, then for each cubelet replace all inward slots (`!homeOut[slot]`) with `_internalsWallMaterial`; extend `setInternals(false)` to restore all inward slots to `this._plasticMaterial`, dispose `_internalsWallMaterial`, and set it to null
- [ ] T009 [US2] Extend `_applyInternalsToMaterials()` in `packages/cubify/src/CubeRenderer3D.ts` to update `_internalsWallMaterial` colour: `(this._internalsWallMaterial as THREE.MeshStandardMaterial).color.set(parseInt(this._theme.plasticColour.slice(1), 16)); this._internalsWallMaterial.needsUpdate = true;`
- [ ] T010 [P] [US2] Add wallOpacity slider (id `slider-wall-opacity`, range 0.0–1.0, default 0.40, step 0.05) to the Internals controls section in `cubify-harness/index.html`; wire input event to call `player.renderer.setInternals(true, { ...currentOptions, wallOpacity: val })` when internals is on

**Checkpoint**: Inner cubelet faces visible through transparent stickers. Switching to `speed-dark` theme while internals on → walls update to dark plastic colour.

---

## Phase 5: User Story 3 — Central Core Mechanism (Priority: P3)

**Goal**: A stylised core (sphere + 6 axis arms) appears at the world origin when internals is enabled. It never rotates with any cubelet layer during move animations.

**Independent Test**: Enable internals → cube renders with visible sphere and 6 arms at centre → animate Sune `R U R' U R U2 R'` → core stays stationary while layers rotate → disable internals → core absent.

- [ ] T011 [US3] Implement `buildCoreGroup(plasticColour: string, options: InternalsOptions): THREE.Group` in `packages/cubify/src/CubeInternals.ts`: create `THREE.Group`, add sphere `new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), coreMat)` at origin, then 6 cylinder arm meshes sharing `new THREE.CylinderGeometry(0.08, 0.08, 0.80, 8)` — ±Y arms at (0, ±0.62, 0); ±X arms at (±0.62, 0, 0) with `rotation.z = Math.PI/2`; ±Z arms at (0, 0, ±0.62) with `rotation.x = Math.PI/2`. `coreMat` = `new THREE.MeshStandardMaterial({ color: parseInt(plasticColour.slice(1),16), transparent: true, opacity: options.coreOpacity })`
- [ ] T012 [US3] Extend `setInternals(true)` in `packages/cubify/src/CubeRenderer3D.ts` to call `buildCoreGroup()`, store as `_coreGroup`, and call `this._scene?.add(this._coreGroup)`; extend `setInternals(false)` to call `this._scene?.remove(this._coreGroup)`, dispose all child geometry/materials by iterating `_coreGroup.children`, set `_coreGroup = null`
- [ ] T013 [US3] Extend `_applyInternalsToMaterials()` in `packages/cubify/src/CubeRenderer3D.ts` to update core child materials: iterate `_coreGroup?.children`, cast each `mesh.material` as `THREE.MeshStandardMaterial`, update `.color.set(parseInt(this._theme.plasticColour.slice(1), 16))`, set `.needsUpdate = true`
- [ ] T014 [P] [US3] Add coreOpacity slider (id `slider-core-opacity`, range 0.0–1.0, default 0.50, step 0.05) to the Internals controls section in `cubify-harness/index.html`; wire input event similarly to other sliders

**Checkpoint**: Core sphere + arms visible at centre. Animate any move sequence — core stays fixed. Theme change updates core colour. Toggle off removes core cleanly.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Public API exports, CubePlayer passthrough, and final validation.

- [ ] T015 [P] Export `InternalsOptions` (type) and `DEFAULT_INTERNALS_OPTIONS` from `packages/cubify/src/index.ts`
- [ ] T016 Add `setInternals(enabled: boolean, options?: Partial<InternalsOptions>): void` passthrough method to `packages/cubify/src/CubePlayer.ts` that delegates to `this._renderer.setInternals(enabled, options)`
- [ ] T017 Run `npm test --workspace=packages/cubify` and confirm all tests pass (181+ expected, including the 2 new cube-internals tests)
- [ ] T018 [P] Run `node cubify-harness/verify-perms.mjs` and confirm all 18 cross-checks pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001 and T002 can start immediately in parallel
- **Foundational (Phase 2)**: Depends on T001 (needs CubeInternals.ts to import from) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 completion
- **US2 (Phase 4)**: Depends on Phase 3 completion (setInternals() must exist before extending it)
- **US3 (Phase 5)**: Depends on Phase 4 completion (same reason)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1**: Can start after Foundational — foundational sticker transparency
- **US2**: Depends on US1 (extends setInternals() and _applyInternalsToMaterials() established in US1)
- **US3**: Depends on US2 (same pattern — extends methods from prior stories)

The three stories are sequential because they all extend the same `setInternals()` and `_applyInternalsToMaterials()` methods in CubeRenderer3D.ts. Each story adds another "layer" to those methods.

### Within Each Phase

- CubeRenderer3D.ts tasks in a phase are sequential (same file)
- Harness tasks marked [P] are parallel with CubeRenderer3D.ts tasks (different file)
- CubeInternals.ts tasks precede CubeRenderer3D.ts tasks that call them

---

## Parallel Opportunities

### Phase 1

```
T001 (CubeInternals.ts) ←→ T002 (cube-internals.test.ts)  [parallel — different files]
```

### Phase 3

```
T004 → T005 (CubeRenderer3D.ts, sequential)
T006 (cubify-harness/index.html) [parallel with T004/T005]
```

### Phase 6

```
T015 (index.ts) ←→ T018 (verify-perms, read-only) [parallel]
T016 (CubePlayer.ts) → T017 (test run)
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1: T001, T002 (parallel)
2. Complete Phase 2: T003
3. Complete Phase 3: T004 → T005, T006 (parallel with T004/T005)
4. **STOP and VALIDATE**: Toggle internals in harness → confirm sticker transparency
5. P1 story complete and demonstrable

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready, tests pass
2. Phase 3 → US1: Transparent stickers + harness toggle
3. Phase 4 → US2: Visible walls add depth to the transparent shell
4. Phase 5 → US3: Core mechanism completes the illusion
5. Phase 6 → Polish: public API exports + validation

---

## Notes

- `setInternals()` is extended across US1–US3 — each story adds a section to enable/disable branches
- `_applyInternalsToMaterials()` is extended across US1–US3 — each story adds a colour-update section
- Core geometry disposal: iterate `_coreGroup.children`, for each child cast to `THREE.Mesh`, call `.geometry.dispose()` + `.material.dispose()`; note that sphere and arms share geometry instances — dispose once, not per mesh
- The `internals` theme preset is already implemented (from 033 branch setup) and recommended for visual validation
- `CubeExporter.toPNG` is explicitly out of scope — no changes needed there
