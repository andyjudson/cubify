# /housekeeping — Post-Feature Repo Maintenance

Run after merging a feature branch. Audits documentation, exports, branches, and test counts for staleness. Quick and routine — distinct from `/architecture-review` (strategic, periodic).

## Steps

Run all read steps in parallel, then report findings as a checklist with pass/fail per item.

### 1. README vs exports diff

Read `packages/cubify/src/index.ts` and extract every exported name. Read `packages/cubify/README.md` key classes table. Flag any export that:
- Appears in `index.ts` but not in README (missing)
- Appears in README but not in `index.ts` (removed or renamed)

Repeat for `packages/cubify-react/src/index.ts` vs `packages/cubify-react/README.md`.

### 2. CLAUDE.md review

Check:
- **Architecture table** — every file in `packages/cubify/src/` listed in `src/index.ts` should have a row; flag missing or renamed entries
- **Current Status** — class names should match actual exported names in `index.ts`; flag stale names
- **Recent Changes** — most recent entry should reference the latest completed feature; flag if the last spec in `specs/` has no entry

### 3. Test count sync

Run `npm test` and read the actual passing count from the output. Compare to the count mentioned in CLAUDE.md. If different, propose the updated number.

### 4. Spec status

List all directories in `specs/` that have a `spec.md`. For any spec whose feature branch has been merged to main (check with `git branch --merged main`), verify the spec's Status field says `Complete`. Flag any that are still `Draft` or `In Progress` on a merged branch.

### 5. Branch cleanup

Run `git branch --merged main` (local) and `git branch -r --merged main` (remote). List merged branches that are not `main` and propose deletion commands. Do not delete — just list.

### 6. cfop-app sync (if applicable)

If the cubify library version changed in this session, confirm `cfop-app/package.json` references the latest published version. Flag if it's behind.

## Output Format

Report as a compact checklist — one line per item, ✓ or ✗ with a short note:

```
✓ README exports — all 12 exports present
✗ CLAUDE.md class names — CfopSolver should be CubeSolverCfop (line 16)
✓ Test count — 239 matches CLAUDE.md
✗ Spec status — specs/034-cubify-solver-cfop-method still Draft on merged branch
✓ Branches — no merged branches to clean up
✓ cfop-app — pinned to v1.3.11 (current)
```

After the checklist, list proposed fixes for any ✗ items. Apply them only if the user says to proceed.
