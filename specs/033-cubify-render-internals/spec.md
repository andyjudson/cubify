# Feature Specification: Cubify Render Internals

**Feature Branch**: `033-cubify-render-internals`  
**Created**: 2026-05-10  
**Status**: Draft  

## Overview

Extends the 3D cube renderer to visually expose the internal mechanism of the Rubik's cube — making the colour sticker panels on cubelets semi-transparent so the internal structure beneath is visible. This includes rendering the internal walls of cubelets (instead of a black void), and adding a central core piece (sphere with pillar arms extending to each face centre) that the cubelets physically rotate around. The core colour and transparency are derived from the frame theme colour, creating a cohesive, realistic stickerless-style internal look.

---

## User Scenarios & Testing

### User Story 1 — Transparent Sticker Panels (Priority: P1)

A developer or viewer loads the 3D cube with a "render internals" mode enabled. The coloured sticker panels on each cubelet face are rendered with configurable opacity rather than fully opaque, allowing the viewer to see through the surface and perceive the cube's interior.

**Why this priority**: This is the foundational visual change — all other internals work only becomes meaningful once the panels are partially see-through.

**Independent Test**: Enable render-internals mode; verify that each of the 54 coloured sticker faces is rendered with a non-opaque material (alpha < 1.0) and that the cube interior is visually visible through them. Existing opaque rendering still works with internals mode off.

**Acceptance Scenarios**:

1. **Given** internals mode is enabled, **When** the cube renders, **Then** sticker panel materials use semi-transparent rendering with a configurable opacity value (default ~0.65)
2. **Given** internals mode is disabled (default), **When** the cube renders, **Then** all existing opaque rendering is unchanged — no regression
3. **Given** any theme (default/rubiks/gan/speed), **When** internals mode is enabled, **Then** sticker colours are preserved; only opacity changes

---

### User Story 2 — Visible Cubelet Internal Walls (Priority: P2)

When viewing the cube in internals mode, the inner faces of cubelets (faces pointing toward the core, not toward a sticker) are rendered as a visible surface rather than invisible or black. These internal walls give the cube a solid transparent-shell appearance rather than a hollow black void.

**Why this priority**: Without this, transparent stickers reveal only darkness inside the cube. The internal walls define the cubelet geometry as a coherent transparent solid.

**Independent Test**: Enable internals mode; rotate the cube to view it from an oblique angle; verify that internal cubelet faces are rendered with a visible, non-black material (frame-colour derived, semi-transparent) rather than absent or black.

**Acceptance Scenarios**:

1. **Given** internals mode enabled, **When** viewing through transparent sticker panels, **Then** internal cubelet wall faces are visible with a material consistent with the frame colour (same family, lighter or matching opacity)
2. **Given** a dark theme (e.g. speed), **When** internals mode enabled, **Then** internal walls use the theme's frame colour at reduced opacity — not white, not pure black
3. **Given** a standard move animation, **When** internals mode enabled, **Then** internal wall materials travel with cubelets correctly (no visual pop or reapplication needed)

---

### User Story 3 — Central Core Mechanism (Priority: P3)

A visible central core is rendered inside the cube — a sphere (or compact rounded shape) at the absolute centre, with six short cylindrical pillar arms extending outward to approximately the centre-piece position on each face. This is a **stylised/representational** model of the physical axle mechanism; it is intentionally smaller than the real core (~15% of cube half-size) so that no cubelet geometry needs to be cut or modified to accommodate it. Anatomically accurate geometry (where corner pieces have carved notches to clear the core) is explicitly out of scope.

**Why this priority**: The core completes the "internal mechanism" illusion. It is only visible through transparent sticker panels and internal walls, so it depends on P1 and P2 being in place.

**Independent Test**: Enable internals mode; verify a central sphere and six arm geometry pieces are present in the Three.js scene; verify they use a material derived from the frame colour (same hue, configurable opacity); verify they do not participate in cubelet move animations (they stay fixed at the world origin).

**Acceptance Scenarios**:

1. **Given** internals mode enabled, **When** the cube is rendered, **Then** a core sphere is present at the world origin and six arms extend to approximately ±half-cube-length on each axis (X, Y, Z)
2. **Given** a move is animated, **When** the move completes, **Then** the core geometry remains stationary — it does not rotate with any cubelet layer
3. **Given** any theme, **When** internals mode enabled, **Then** the core material uses the theme frame colour at a consistent opacity (~0.5), matching the visual tone of the frame

---

### Edge Cases

- What happens when `internals` is toggled mid-animation? Material update should wait for animation completion or apply cleanly without visual artefact.
- How does internals mode interact with stickering / mask presets? Masked (greyed) stickers should remain grey but also gain transparency.
- Does `CubeExporter.toPNG` respect internals mode? Initial scope: only the live 3D renderer; export may remain fully opaque unless explicitly enabled.
- What is the minimum opacity that still allows colour identification? Below ~0.3 sticker colours become indistinct — should clamp opacity input to a sensible range (0.3–1.0).

---

## Requirements

### Functional Requirements

- **FR-001**: `CubeRenderer3D` MUST expose an `setInternals(enabled: boolean, options?: InternalsOptions)` method that enables or disables internals rendering mode
- **FR-002**: When internals mode is enabled, sticker panel materials MUST use an opacity value drawn from `InternalsOptions.stickerOpacity` (default 0.65, range 0.3–1.0)
- **FR-003**: When internals mode is enabled, internal cubelet wall faces MUST be rendered with a material derived from the current theme frame colour at `InternalsOptions.wallOpacity` (default 0.4)
- **FR-004**: When internals mode is enabled, a core geometry (sphere + 6 arms) MUST be added to the Three.js scene at the world origin; it MUST use a material derived from the theme frame colour at `InternalsOptions.coreOpacity` (default 0.5)
- **FR-005**: The core geometry MUST remain stationary during all move animations — it is never added to a rotating layer group
- **FR-006**: `setTheme()` MUST update core and internal wall material colours when internals mode is active
- **FR-007**: `setInternals(false)` MUST remove core geometry from the scene and restore sticker panel materials to fully opaque
- **FR-008**: `InternalsOptions` MUST be expressible as a plain JSON-serialisable object so it can be driven from the harness UI controls
- **FR-009**: Internals mode MUST be independent of stickering — masked sticker panels gain transparency but retain their grey colour

### Key Entities

- **InternalsOptions**: `{ stickerOpacity: number, wallOpacity: number, coreOpacity: number }` — all values 0.0–1.0
- **Core geometry**: Three.js `SphereGeometry` (central globe) + 6 × `CylinderGeometry` (axis arms); attached as a non-animated scene group
- **Internal wall faces**: The inward-facing geometry of each cubelet — currently not rendered; needs to be exposed or built from existing cubelet mesh

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: With internals mode enabled, all 54 sticker panels render with opacity < 1.0 and the cube interior is visually discernible when viewed from any angle
- **SC-002**: Existing opaque rendering (internals mode off) produces pixel-identical output to pre-feature behaviour — zero regression in the Vitest suite
- **SC-003**: Core geometry (sphere + arms) is present in the scene graph when internals enabled and absent when disabled
- **SC-004**: A full move sequence animates without visual artefact — internal walls and core remain correctly positioned throughout
- **SC-005**: `setTheme()` called while internals mode is active updates all internals-related materials within the same render frame

---

## Assumptions

- `CubeRenderer3D` already builds individual cubelet meshes with per-face materials; internal wall faces can be added as additional geometry per cubelet or by enabling the back-face of existing panel geometry
- Three.js `MeshStandardMaterial` (already in use) supports `transparent: true` and `opacity` — no renderer or material system changes needed beyond setting these properties
- The harness (`cubify-harness/index.html`) will expose internals controls (toggle + opacity sliders) for visual validation; this is harness-only and not part of the library API surface
- `CubeExporter.toPNG` is out of scope for internals mode in this feature — it will continue to render fully opaque
- Core geometry proportions (sphere radius, arm length/radius) are design constants tuned visually; exact values are an implementation decision
- Internals mode does not affect `CubeRenderer2D` (2D top-down view)
