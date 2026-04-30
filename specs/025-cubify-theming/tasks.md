# Tasks: Feature 025 — cubify-theming

**Input**: `specs/025-cubify-theming/` — spec.md, plan.md, research.md, data-model.md, contracts/CubeTheme.ts, quickstart.md
**Prerequisites**: Features 022–028 complete; 138-test Vitest baseline passing

**Format**: `[ID] [P?] [Story?] Description — file path`
- **[P]**: parallelisable (different file, no incomplete dependency)
- **[Story]**: maps to US-001…US-006 in spec.md

---

## Phase 1: Setup

**Purpose**: Confirm baseline before any changes.

- [X] T001 Run `npm test` from `/Users/Andy/Documents/TechLab/cubify` and confirm 138 tests pass, 10 skipped, 0 failures — no file changes

---

## Phase 2: Foundational — `src/CubeTheme.ts`

**Purpose**: The `CubeTheme` module is a blocking prerequisite for every renderer change and every harness task. Must be complete before Phase 3+.

**Independent test**: `npm test` passes with new `test/cube-theme.test.ts` suite; `THEME_PRESETS` imports without error in Node REPL.

- [X] T002 Create `src/CubeTheme.ts` with `CubeTheme` interface (all fields from data-model.md), `FaceColours` type, `ThemePresetName` union type (`'rubiks' | 'modern' | 'minimal' | 'gan'`)
- [X] T003 Add hex↔HSL conversion utilities (`hexToHsl`, `hslToHex`) and `effectiveColours(theme): FaceColours` (applies brightness + saturation scalars in HSL space) to `src/CubeTheme.ts`
- [X] T004 Add `validateTheme(theme: unknown): string | null`, `cloneTheme(theme): CubeTheme`, and `getThemePreset(name: ThemePresetName): CubeTheme` to `src/CubeTheme.ts`
- [X] T005 Add `themeToJSON(theme): string` and `themeFromJSON(json: string): CubeTheme` (parse + validate, throw descriptively on invalid input) to `src/CubeTheme.ts`
- [X] T006 Define `THEME_PRESETS: Record<ThemePresetName, CubeTheme>` with all 4 named presets in `src/CubeTheme.ts`:
  - `rubiks`: pad=24, radius=32, materialType=standard, roughness=0.85, Classic colours
  - `modern`: Twisty colours, plasticColour=#2a2a2a, pad=14, radius=16, materialType=basic
  - `minimal`: Pastel colours, plasticColour=#e8e8e8, saturation=0.8, bevel=0.05, radius=48, materialType=basic
  - `gan`: Classic colours, brightness=0.95, saturation=0.85, radius=6, centerShape=circle, materialType=basic
- [X] T007 Write `test/cube-theme.test.ts`: test `validateTheme` (valid + invalid), `effectiveColours` (brightness/saturation applied correctly), `themeToJSON`/`themeFromJSON` round-trip, all 4 presets import with correct `ThemePresetName` key, `getThemePreset` throws on unknown name

**Checkpoint**: `npm test` passes with all Phase 2 tests. `CubeTheme` module ready for renderer integration.

---

## Phase 3: US-001 — Theme object layer

**Goal**: Both renderers accept a `CubeTheme`; all hardcoded visual constants removed; `setTheme()` updates the live cube without page reload.

**Independent test**: Construct `new CubeRenderer3D({ theme: THEME_PRESETS.rubiks })` in harness, confirm thick-bordered stickers render; call `setTheme(THEME_PRESETS.modern)` at runtime, confirm update without page reload.

### CubeRenderer3D — refactor (sequential, same file)

- [X] T008 [US1] Add `_theme: CubeTheme` field to `CubeRenderer3D`; update `CubeRenderer3DOptions` to accept `theme?: CubeTheme | ThemePresetName` (resolve via `getThemePreset` when string); default to library-default values (current hardcoded "speed" look) in `src/CubeRenderer3D.ts`
- [X] T009 [US1] Refactor `makeStickerTexture()` to accept `(colourHex, plasticHex, opacity, pad, radius, isCenter, centerShape)` params; change module-level cache key to composite string `"${colourHex}|${plasticHex}|${opacity}|${pad}|${radius}|${shape}"` — dispose stale `CanvasTexture` entries on key mismatch in `src/CubeRenderer3D.ts`
- [X] T010 [US1] Switch `_buildCubelets()` from one shared `RoundedBoxGeometry` to per-cubelet geometry; store geometry ref on `Cubelet` interface; derive size and bevel from `_theme` in `src/CubeRenderer3D.ts`
- [X] T011 [US1] Update `restoreColours()` to call `effectiveColours(_theme)` for face colour lookup and pass all texture params from `_theme` to `makeStickerTexture()` in `src/CubeRenderer3D.ts`
- [X] T012 [US1] Implement `setTheme(theme: CubeTheme | ThemePresetName)`: diff active theme; if gap or bevel changed → dispose + rebuild per-cubelet geometry; if materialType changed → recreate outward materials; always invalidate stale cache entries + call `restoreColours()` + re-apply active visMap if stickering is active in `src/CubeRenderer3D.ts`

### CubeRenderer2D — theme integration (parallel with T008)

- [X] T013 [P] [US1] Remove hardcoded `FACE_COLOURS` and `GREY` constants from `src/CubeRenderer2D.ts`; add `_theme: CubeTheme` field, `theme` constructor option, and `setTheme()` method; derive effective face colours via `effectiveColours(_theme)` on each `update()` and `toSVG()` call; derive grey from `_theme.plasticColour`

### Exports (parallel with each other after T013)

- [X] T014 [P] [US1] Add `export { CubeTheme, THEME_PRESETS, ThemePresetName, getThemePreset, effectiveColours, validateTheme, themeToJSON, themeFromJSON }` to `src/index.ts`
- [X] T015 [P] [US1] Add `CubeTheme`, `FaceColours`, `ThemePresetName`, `THEME_PRESETS`, `getThemePreset`, `themeToJSON`, `themeFromJSON` type declarations to `types/index.d.ts`; add `setTheme(theme: CubeTheme | ThemePresetName): void` and `get theme(): CubeTheme` to `CubeRenderer3D` and `CubeRenderer2D` signatures

**Checkpoint**: Both renderers accept theme at construction; `setTheme()` live-updates the cube. `npm test` still passes.

---

## Phase 4: US-002 — Named preset buttons (harness)

**Goal**: Clicking a preset button fully replaces the current theme — all harness controls snap to the preset's values.

**Independent test**: Click `rubiks` → cube shows thick rounded stickers + physical lighting. Click `minimal` → white shell, pastel colours. Each switch resets all sliders to preset values.

- [X] T016 [US2] Add `Theming` tab button (after `Stickering`) and `#tools-theming-panel` div (`.tools-panel`) to `cubify-harness/index.html`; wire into `showToolsTab()` switch
- [X] T017 [US2] Add `currentTheme` variable (initialised to library-default values) and `applyThemePatch(patch)` helper (merges patch into `currentTheme`, calls `player.renderer.setTheme(currentTheme)` and `renderer2d?.setTheme(currentTheme)`) in `cubify-harness/index.html`
- [X] T018 [US2] Add 4 preset buttons (`rubiks`, `modern`, `minimal`, `gan`) inside `#tools-theming-panel`; on click: set `currentTheme = cloneTheme(THEME_PRESETS[name])` then call `syncControlsToTheme(currentTheme)` (syncs all slider/picker values) then `applyThemePatch({})` in `cubify-harness/index.html`

**Checkpoint**: 4 preset buttons render and switch the cube's look. Controls not yet present (sliders in next phase).

---

## Phase 5: US-003 — Live geometry and finish controls

**Goal**: Sliders for brightness, saturation, plastic, gap, bevel, sticker pad/radius, center shape, and material type all live-update the cube.

**Independent test**: Drag gap slider to 0.06 → wider gaps visible. Set material to `satin` → physically lit stickers. Drag brightness to 0.7 → all faces darken proportionally.

- [X] T019 [US3] Add brightness slider (range 0.3–2.0, step 0.05, default 1.0) and saturation slider (range 0–2.0, step 0.05, default 1.0) with live value labels to `#tools-theming-panel` in `cubify-harness/index.html`; wire to `applyThemePatch({ brightness, saturation })`
- [X] T020 [US3] Add plastic colour `<input type="color">` and opacity slider (range 0–1, step 0.05) to `#tools-theming-panel` in `cubify-harness/index.html`; wire to `applyThemePatch({ plasticColour, plasticOpacity })`
- [X] T021 [US3] Add gap slider (range 0.005–0.1, step 0.005) and bevel slider (range 0–0.1, step 0.005) to `#tools-theming-panel` in `cubify-harness/index.html`; wire to `applyThemePatch({ gap, bevel })`
- [X] T022 [US3] Add sticker pad slider (range 0–60, step 1) and sticker radius slider (range 0–128, step 1) to `#tools-theming-panel` in `cubify-harness/index.html`; wire to `applyThemePatch({ stickerPad, stickerRadius })`
- [X] T023 [US3] Add center shape toggle (`square` / `circle`) and material shortcut buttons (`flat` → basic; `matte` → standard roughness 0.85; `satin` → standard roughness 0.5; `glossy` → standard roughness 0.1) to `#tools-theming-panel` in `cubify-harness/index.html`

**Checkpoint**: All geometry and finish controls live-update the cube. `syncControlsToTheme()` correctly resets them when a preset is clicked.

---

## Phase 6: US-004 — Per-face colour pickers

**Goal**: Individual colour pickers for each of the 6 faces with live preview.

**Independent test**: Change R face to `#0000ff` → right-face stickers turn blue immediately. Click `rubiks` preset → pickers reset to Classic Rubik's red.

- [X] T024 [US4] Add 6 `<input type="color">` pickers (labelled U/R/F/D/L/B) to `#tools-theming-panel` in `cubify-harness/index.html`; on input: merge changed face into `currentTheme.colours` and call `applyThemePatch({ colours: {...currentTheme.colours, [face]: value} })`; include in `syncControlsToTheme()` so preset clicks reset picker values

**Checkpoint**: Per-face colour editing works; presets override individual pickers.

---

## Phase 7: US-005 — Circle center pieces

**Goal**: `gan` theme (and any theme with `centerShape: 'circle'`) renders disc-shaped stickers on the 6 face-center cubelets; corners and edges remain square/rounded-square.

**Independent test**: Apply `gan` theme → center cubelets show circular stickers. Apply `rubiks` → centers revert to rounded-rectangle. Corner/edge stickers unaffected in both cases.

- [X] T025 [P] [US5] Add `isCenter(pos: Vec3): boolean` helper (`Math.abs(pos.x) + Math.abs(pos.y) + Math.abs(pos.z) === 1`); update `_buildCubelets()` to pass `isCenter` flag per-cubelet to `makeStickerTexture()` in `src/CubeRenderer3D.ts`
- [X] T026 [P] [US5] Add circle texture branch to `makeStickerTexture()`: when `isCenter && centerShape === 'circle'`, draw `ctx.arc(cx, cy, r, 0, Math.PI*2)` disc with `pad`-inset radius instead of rounded-rect path; include `shape` in composite cache key in `src/CubeRenderer3D.ts`

**Note**: T025 and T026 are in the same file (`src/CubeRenderer3D.ts`) but marked [P] because they can be developed alongside harness-only tasks in T019–T024.

**Checkpoint**: Switch to `gan` theme in harness — center pieces show disc stickers.

---

## Phase 8: US-006 — JSON export / import

**Goal**: Export and import theme JSON via clipboard for sharing and saving custom themes.

**Independent test**: Customise colours + gap → click Export → paste JSON into Import textarea → click Apply → cube and all controls restore to the exported state.

- [X] T027 [US6] Add `Export JSON` button to `#tools-theming-panel`; on click: call `themeToJSON(currentTheme)` → `navigator.clipboard.writeText(json)` → show brief "Copied!" confirmation in `cubify-harness/index.html`
- [X] T028 [US6] Add `<textarea>` for pasting JSON and `Apply` button to `#tools-theming-panel`; on Apply: call `themeFromJSON(input)`, catch errors and display inline error message, on success call `applyThemePatch({...importedTheme})` then `syncControlsToTheme(currentTheme)` in `cubify-harness/index.html`

**Checkpoint**: Full export → import round-trip restores theme exactly.

---

## Final Phase: Polish & Cross-Cutting

- [X] T029 Run `npm test` from `/Users/Andy/Documents/TechLab/cubify` and confirm all tests pass (138 original + new `cube-theme.test.ts` tests)
- [X] T030 Mark all Acceptance Criteria checkboxes complete in `specs/025-cubify-theming/spec.md`; update `specs/spec.md` Feature 025 status row to `Complete ✅`
- [X] T031 Remove temporary `.specify/feature.json` pin from `/Users/Andy/Documents/TechLab/cubify/.specify/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user story phases**
- **Phase 3 (US-001)**: Depends on Phase 2
- **Phase 4 (US-002)**: Depends on Phase 3 (needs setTheme() on renderers)
- **Phase 5 (US-003)**: Depends on Phase 4 (harness shell + applyThemePatch must exist)
- **Phase 6 (US-004)**: Can start parallel with Phase 5 (different DOM section, same file)
- **Phase 7 (US-005)**: Depends on Phase 3 (needs makeStickerTexture refactor); can run parallel with Phases 5–6
- **Phase 8 (US-006)**: Depends on Phase 5 (needs applyThemePatch + syncControlsToTheme)
- **Final Phase**: Depends on all story phases complete

### User Story Dependencies

- **US-001**: Depends on Foundational (Phase 2) only
- **US-002**: Depends on US-001 (setTheme on renderers)
- **US-003**: Depends on US-002 (harness shell + patch helper)
- **US-004**: Depends on US-002; independent of US-003 (different DOM controls, same pattern)
- **US-005**: Depends on US-001 (makeStickerTexture refactor); independent of US-002–004
- **US-006**: Depends on US-002 (applyThemePatch helper)

### Parallel Opportunities Within Phases

**Phase 3 (US-001)**:
- T013 [P] — `CubeRenderer2D` changes run in parallel with T008–T012 (`CubeRenderer3D` changes)
- T014 [P] + T015 [P] — `src/index.ts` and `types/index.d.ts` run in parallel with each other

**Phases 5–6 vs Phase 7**:
- T019–T024 (harness controls) can run in parallel with T025–T026 (circle centers in `CubeRenderer3D`) — different files

---

## Parallel Example: Phase 3 (US-001)

```
Sequential: T008 → T009 → T010 → T011 → T012  (CubeRenderer3D — same file)
Parallel:   T013                                (CubeRenderer2D — different file)
Parallel:   T014 + T015                         (index.ts + types — different files, after T013)
```

---

## Implementation Strategy

### MVP (Phase A — library complete, no harness controls)

1. Phase 1: confirm baseline
2. Phase 2: build `CubeTheme.ts` + tests
3. Phase 3: renderer integration
4. **Validate**: switch theme programmatically in browser console — cube updates correctly
5. Stop here if harness controls can wait

### Full Delivery (Phase B — harness complete)

6. Phase 4: preset buttons → verify preset switching
7. Phase 5–6: sliders + colour pickers → verify all controls live-update
8. Phase 7: circle centers → verify `gan` theme
9. Phase 8: JSON export/import → verify round-trip
10. Final: polish + tests

### Notes

- Geometry rebuild (gap/bevel slider) causes ~100 ms recalculation — acceptable; not a perf regression
- `setTheme()` must call `abortAnimation()` first if `_animating` is true to prevent mid-animation geometry swap
- `syncControlsToTheme(theme)` is a harness-side helper that must set every slider/picker value from the theme — write it in T017 alongside `applyThemePatch`
- The `gan` preset uses `centerShape: 'circle'` — US-005 must be complete before the `gan` button works correctly in the harness
