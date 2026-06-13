# Quickstart: Verifying the Beginner F2L Procedure Layer

How to run and interpret the checks that gate this feature. All commands run from the cubify repo root (`/Users/Andy/Documents/TechLab/cubify`).

## 1. Run the fall-through counter (the success metric)

```bash
npx vitest run packages/cubify/test/cfop-f2l-setup-poc.test.ts
```

Reads `method` off every `solveF2lIntuitive` result over the enumerated FR/FL tier-2 and tier-3 domain and prints a per-slot Coverage Report:

```
=== FR tier-2 setup-insert: N unique cases ===
byMethod: easy-insert:.. setup-insert:.. extract-insert:.. search-fallback:0
fall-through: 0    round-trip failures: 0    vocabulary violations: 0
move-count: min .. median .. max ..
```

**Done = `search-fallback: 0`, `fall-through: 0`, `round-trip failures: 0`, `vocabulary violations: 0` on every slot/tier (SC-001/002/003).** While encoding is in progress, a non-zero `fall-through` is the backlog of un-encoded variants.

## 2. Run the beginner round-trip + vocabulary suite

```bash
npx vitest run packages/cubify/test/cfop-f2l-beginner.test.ts
```

Asserts, across all four slots (BR/BL via conjugation): every emitted `alg` round-trips and contains no `B`/wide/slice move. This is the SC-002/SC-003 gate in assertion form (the counter in step 1 reports the same numbers for visibility).

## 3. Full solver regression

```bash
npm test
```

The existing CFOP suite (9-stage solution, OLL/PLL stages, PLL recognition) must stay green — confirms FR-010 (no public-API/advanced/OLL/PLL impact).

## 4. Pre-merge cross-check (constitution requirement)

```bash
node cubify-harness/verify-perms.mjs
```

All 18 permutation cross-checks must pass before any merge.

## 5. Manual harness smoke test (qualitative SC-005)

```bash
cd cubify-harness
ps aux | grep -i vite           # kill stragglers first
npm run dev -- --host 127.0.0.1 --port 5174
# open http://127.0.0.1:5174/ → Scramble → "Solve (cfop)" with beginner mode
```

Step through an F2L solve and confirm every move maps to a named method step (position the pair → keep white visible → set up → insert; back slots show a leading `y`/`y'` rotation). This is the "is it recognisably the method?" acceptance (SC-005).

---

## Interpreting a regression

| Symptom | Likely cause | Where to look |
|---|---|---|
| `fall-through > 0` | a position variant isn't matched by any procedure | add/extend the procedure for that tier + white-facing direction in `F2lSolver.ts` |
| `round-trip failures > 0` | a procedure emits a sequence that disturbs the cross or a finished slot | the `mustSolve`/`crossOk` guard inside the procedure |
| `vocabulary violations > 0` | a B/wide/slice leaked in | a back slot took the in-place/B+U path instead of the `y`-conjugate; or `searchFallback` ran (check it's gated behind the procedure miss) |
| `maxLen` blew up (11–12) | a matched procedure got search-tightened, or search ran when a procedure should have matched | confirm matched procedures are returned as-is and never tightened |
