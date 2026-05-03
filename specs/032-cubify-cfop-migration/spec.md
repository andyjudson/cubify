# Feature 032 — cfop-migration (cfop-app adopts cubify)

## Summary

Full adoption of cubify in `cfop-app`: scramble generation, alg parsing, and 3D visualisation. Replaces TwistyPlayer and all direct cubing.js imports. Removes IntersectionObserver workarounds, shadow DOM constraints, and explicit px dimension hacks.

This feature absorbs what was previously split between Feature 030 (decouple) and Feature 031 (migration) — they are one coherent delivery.

---

## Motivation

cfop-app currently uses:
- `randomScrambleForEvent` (cubing.js) for scramble generation
- `Alg`/`Move` (cubing.js) for alg validation and parsing in several files
- `TwistyPlayer` (cubing.js) for step-through visualisation in VisualizerModal
- `TwistyPlayer` for scramble state display in ScrambleCubePreview

All of these can be replaced with cubify equivalents now that the library API (028), scramble generator (028), and React wrapper (029) are complete. The result is a single clean dependency: `cubify`.

---

## Migration Targets

| Component | Current | Target |
|-----------|---------|--------|
| `VisualizerModal` | TwistyPlayer + `experimentalModel` | `<CubePlayer>` (Feature 029) |
| `ScrambleCubePreview` | TwistyPlayer, explicit px dimensions | `<CubeState>` (Feature 029) |
| `scrambleGenerator.ts` | Custom scrambler + `Alg.fromString` validation | `CubeScramble.random()` |
| `scramble.ts` | `Alg` from cubing/alg | `AlgParser.parse()` |
| `VisualizerModal.tsx` imports | `Alg`, `Move` from cubing/alg | `AlgParser.parse()` |

---

## What Goes Away

- `TwistyPlayer` dependency and its cubing.js 3D chunk (~500KB gzipped)
- `IntersectionObserver` height workarounds in VisualizerModal
- `useEffect` timing hacks for TwistyPlayer initialisation
- `experimentalModel` API access for step tracking
- All direct `import ... from 'cubing/...'` in cfop-app source
- Explicit `width`/`height` px constraints on cube containers

What stays: `cubify` keeps cubing.js internally for `KPattern` move application — that dependency never surfaces in cfop-app.

---

## Scramble Generator Notes

`cfop-app/src/utils/scrambleGenerator.ts` is already a custom pure-logic scrambler (20 moves, no same-face, no A-B-A). Its only cubing.js touch is `Alg.fromString` used for validation. Migration is trivial — replace that call with `AlgParser.parse()`. `CubeScramble.random()` is already in `cubify` as of Feature 028.

---

## Prerequisites

- Feature 028 (library API) ✅ — `CubeScramble`, `AlgParser`, full public API
- Feature 029 (React wrapper) 📋 — `<CubePlayer>`, `<CubeState>` components

---

## Acceptance Criteria

- [ ] `VisualizerModal` renders step-through cube using `<CubePlayer>`; play/pause/step controls work
- [ ] `ScrambleCubePreview` renders scramble state using `<CubeState>` — no explicit px dimensions
- [ ] `scrambleGenerator.ts` uses `CubeScramble.random()` — no cubing.js `Alg` import
- [ ] `scramble.ts` uses `AlgParser.parse()` — no cubing.js `Alg` import
- [ ] `VisualizerModal.tsx` — `Alg`/`Move` imports removed
- [ ] `grep -r "from 'cubing" cfop-app/src` returns no matches
- [ ] No `IntersectionObserver` workaround in any component
- [ ] Scramble quality unchanged: 20 moves, no same-face, no A-B-A patterns
- [ ] Existing Playwright smoke tests pass
- [ ] Production bundle size reduced (cubing.js 3D chunk removed)
