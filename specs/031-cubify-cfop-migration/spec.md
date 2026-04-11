# Feature 031 — cubify-cfop-migration (cfop-app Full Migration)

## Summary

Replace all TwistyPlayer and direct cubing.js usage in `cfop-app` with `cubify.js` components. Remove IntersectionObserver workarounds, shadow DOM constraints, and explicit px dimension hacks.

---

## Migration targets

| Component | Current | Target |
|-----------|---------|--------|
| `VisualizerModal` | TwistyPlayer + `experimentalModel` | `<CubePlayer>` component |
| `ScrambleCubePreview` | TwistyPlayer with explicit px dimensions | `<CubeState>` component |
| Scramble generation | `randomScrambleForEvent` (cubing.js) | `CubeScramble.random()` (Feature 030) |
| Alg parsing | `Alg`/`Move` from cubing/alg | `AlgParser.parse()` (already available) |

---

## What goes away

- `IntersectionObserver` height workarounds in VisualizerModal
- `useEffect` timing hacks for TwistyPlayer initialisation
- `experimentalModel` API access for step tracking
- All direct `import ... from 'cubing/...'` in cfop-app (except through cubify wrapper)
- Explicit `width`/`height` px requirements on cube containers

---

## Prerequisites

- Feature 024 (animation engine) — `CubePlayer` play/pause/jumpTo
- Feature 025 (theming) — visual parity with current TwistyPlayer look
- Feature 026 (2D export) — `CubeExporter` for cubify-scripts
- Feature 029 (React wrapper) — `<CubePlayer>` and `<CubeState>` components
- Feature 030 (scramble) — `CubeScramble.random()`

---

## Acceptance Criteria

- [ ] VisualizerModal renders cube with play/pause/step controls using `<CubePlayer>`
- [ ] ScrambleCubePreview renders scramble state using `<CubeState>`, no explicit px dimensions
- [ ] No direct `cubing/` imports remain in cfop-app
- [ ] No IntersectionObserver workarounds in any component
- [ ] Existing Playwright smoke tests pass
- [ ] Production build size reduced (cubing.js 3D chunk removed)
