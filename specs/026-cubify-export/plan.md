# Implementation Plan: 026 — cubify-image-export

**Branch**: `026-cubify-export` | **Date**: 2026-04-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/026-cubify-export/spec.md`

## Summary

Implement `CubeRenderer2D` — a Canvas 2D (browser) / SVG string (Node.js) renderer that produces
a top-down perspective view of the cube, respecting cube state and stickering mask. Integrate into
the cubify-harness 2D tab. Provide a PNG export path via `canvas.toDataURL()` (browser). A Node.js
demo script produces reference PNGs for OLL and PLL cases.

Scope for this feature: US-001 (2D renderer), US-002 (3D OffscreenCanvas export), US-003 (demo script).
US-004 (cubify-scripts Playwright migration) is deferred — it requires the Node.js OffscreenCanvas path.

Rendering style convention (caller chooses per export):
- `style: '3d'` → full / cross / F2L cases (layer context, spatial relationships)
- `style: '2d'` → OLL / PLL cases (top-face focus, flat diagram convention)

## Technical Context

**Language/Version**: JavaScript ES Module (Node 24 / browser)
**Primary Dependencies**: CubeState.js (existing), CubeStickering.js (existing), Canvas 2D API (browser built-in), no new npm dependencies for the renderer
**Storage**: N/A
**Testing**: Manual via harness; `demo/export-test.mjs` for Node.js PNG validation
**Target Platform**: Browser (harness 2D tab) + Node.js 24 (demo/export script)
**Project Type**: library module + harness integration
**Performance Goals**: <200ms per render (single synchronous canvas draw call)
**Constraints**: No new npm dependencies for the 2D renderer itself; zero browser dependency for SVG string output
**Scale/Scope**: Single module, ~200–300 LOC

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Educational focus | ✅ PASS | Directly serves cubify image generation for CFOP learning |
| Web-first + React ecosystem | ✅ PASS | Vanilla JS module, no framework coupling |
| Minimal dependencies | ✅ PASS | Zero new npm dependencies |
| Open source / no paywalls | ✅ PASS | |
| No social/competitive features | ✅ PASS | |

No violations. Proceed.

## Project Structure

### Documentation (this feature)

```text
specs/026-cubify-export/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
│   └── CubeRenderer2D.md
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code

```text
cubify-harness/
├── src/
│   ├── CubeState.js           ← existing (no changes)
│   ├── CubeStickering.js      ← existing (no changes)
│   ├── CubeRenderer3D.js      ← existing (no changes)
│   ├── CubeRenderer2D.js      ← NEW: top-down 2D renderer (Canvas 2D / SVG string)
│   └── CubeExporter.js        ← NEW: toPNG() wrapper routing 2d→CubeRenderer2D, 3d→CubeRenderer3D
├── demo/
│   └── export-test.mjs        ← NEW: Node.js PNG validation script (sharp for SVG→PNG)
└── index.html                 ← MODIFY: wire 2D tab to CubeRenderer2D
```

**Structure Decision**: Single new module in the existing cubify-harness/src/ pattern.
No separate package or build step required — ESM import directly in both harness and demo script.

## Complexity Tracking

No constitution violations. No additional entries needed.
