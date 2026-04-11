# Feature 030 — cubify-decouple (Remove cubing.js from cfop-app)

## Summary

Remove all direct `cubing.js` imports from `cfop-app`. TwistyPlayer is handled in Feature 031; this feature covers the three remaining `Alg`/`Move` import sites and moves the scramble generator into `cubify-harness`.

---

## Motivation

After Feature 031 removes TwistyPlayer, three cubing.js import sites remain in cfop-app:

| File | Import | Replacement |
|------|--------|-------------|
| `scrambleGenerator.ts` | `Alg` (validation only) | `AlgParser.parse()` check |
| `scramble.ts` | `Alg` | `AlgParser.parse()` |
| `VisualizerModal.tsx` | `Alg`, `Move` | `AlgParser.parse()` (TwistyPlayer already gone) |

`cubify-harness` keeps cubing.js as an **internal** dependency for `KPattern` move application — that stays. The goal is zero direct cubing.js imports in cfop-app source.

---

## Existing Implementation

`cfop-app/src/utils/scrambleGenerator.ts` is already a custom pure-logic scrambler:
- 20-move output, no consecutive same-face, no opposite-face A-B-A patterns
- Only cubing.js touch: `Alg.fromString` used for validation — easily replaced with `AlgParser.parse()`

This is a migration, not a rewrite.

## Scope

### CubeScramble module

```js
import { CubeScramble } from 'cubify';

const scramble = CubeScramble.random();   // string — 20-move scramble notation
const moves = CubeScramble.parse(scramble); // string[] of move tokens
```

Migration steps:
1. Move `scrambleGenerator.ts` logic into `cubify-harness/src/CubeScramble.js`
2. Replace `Alg.fromString` validation with `AlgParser.parse()` check
3. cfop-app imports from cubify wrapper instead of local util

---

## Acceptance Criteria

- [ ] `CubeScramble.random()` in cubify-harness, no cubing.js import
- [ ] `scrambleGenerator.ts` and `scramble.ts` — `Alg` import replaced with `AlgParser.parse()`
- [ ] `VisualizerModal.tsx` — `Alg`/`Move` imports removed (TwistyPlayer already gone via 031)
- [ ] `grep -r "from 'cubing" cfop-app/src` returns no matches
- [ ] Scramble quality constraints unchanged (20 moves, no same-face, no A-B-A)
