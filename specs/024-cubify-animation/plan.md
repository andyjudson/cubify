# Implementation Plan: 024 — CubePlayer Engine

**Branch**: `main` | **Date**: 2026-04-26 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/024-cubify-animation/spec.md`

## Summary

Implement `CubePlayer` — a new ES module that encapsulates the animation engine, event emitter, and state timeline currently spread across inline script in `index.html`. Wire the harness to use `CubePlayer` in place of the direct `CubeRenderer3D` calls and the `loadAlg` / `startPlay` / `stopPlay` / `snapToStep` / `animateStepForward` functions.

## Technical Context

**Language/Version**: Vanilla ES Modules (no TypeScript, no bundler needed — Vite for dev only)  
**Primary Dependencies**: cubing.js (`KPattern`, `KPuzzle`, `cube3x3x3`), Three.js (via CubeRenderer3D — not touched by this feature), Vite 8.0.8 for dev server  
**Storage**: N/A  
**Testing**: Manual via harness — no automated test framework established  
**Target Platform**: Browser (Chrome/Safari/Firefox), WebGL  
**Project Type**: Library module + harness wiring  
**Performance Goals**: Animation at 60fps, no frame budget regression from current implementation  
**Constraints**: No mid-move pause (CubeRenderer3D animateMove cannot be interrupted); pause works at sequence level only  
**Scale/Scope**: Single 3×3 cube, sequences up to ~50 moves

## Constitution Check

No project constitution found — no gates to evaluate.

## Project Structure

### Documentation (this feature)

```text
specs/024-cubify-animation/
├── plan.md         ← this file
├── research.md     ← Phase 0 output
├── data-model.md   ← Phase 1 output
└── tasks.md        ← Phase 2 output (via /speckit.tasks)
```

### Source Code

```text
cubify-harness/src/
├── AlgParser.js        (existing — unchanged)
├── CubeExporter.js     (existing — unchanged)
├── CubeRenderer2D.js   (existing — unchanged)
├── CubeRenderer3D.js   (existing — unchanged)
├── CubeState.js        (existing — unchanged)
├── CubeStickering.js   (existing — unchanged)
└── CubePlayer.js       ← NEW

cubify-harness/index.html  ← harness wiring (significant edit)
```

## Complexity Tracking

No constitution violations.
