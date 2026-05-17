# Quickstart: CfopSolver (034)

## Install / Build

No new dependencies. Build as normal:

```bash
npm run build --workspace=packages/cubify
```

## Basic usage

```typescript
import { CfopSolver } from '@andyjudson/cubify';
import { CubeScramble } from '@andyjudson/cubify';

const solver = new CfopSolver();

// Get a scrambled state
const scramble = await CubeScramble.wca();
const scrambledState = (await CubeState.solved()).applyAlg(scramble);

// Solve it
const solution = await solver.solve(scrambledState);

console.log(`Solved in ${solution.totalMoves} HTM across ${solution.stages.length} stages`);
for (const stage of solution.stages) {
  console.log(`  ${stage.label}: ${stage.alg || '(skip)'} [${stage.moves} moves]`);
}

solver.dispose();
```

## Stage-by-stage CubePlayer integration

```typescript
// Apply z2 setup to avoid applyOrientation breaking MOVE_AXIS (constitution rule 6)
let state = scrambledState.applyAlg(solution.setupAlg); // 'z2'

for (const stage of solution.stages) {
  if (!stage.alg) continue; // stage already solved, skip

  // For cross stage: CubePlayer starts from the solved render state;
  // pass the scramble + z2 as setup so applyMovesInstant handles orientation.
  // For all other stages: player continues from where it left off.
  if (stage.label === 'cross') {
    await player.loadAlg(stage.alg, scramble + ' ' + solution.setupAlg);
  } else {
    await player.loadAlg(stage.alg);
  }

  player.setStickering(stage.mask);
  player.play();

  await new Promise<void>(res => player.on('complete', res));
  state = state.applyAlg(stage.alg);
}
```

## Cancel an in-progress solve

```typescript
const solver = new CfopSolver();
const promise = solver.solve(state);
solver.cancel(); // promise rejects with Error('cancelled')
solver.dispose();
```

## Harness integration

The harness button "Solve (cfop)" in `cubify-harness/index.html` demonstrates the full stage-by-stage playback with automatic mask switching. See the `handleCfopSolve()` function in that file.

## Notes

- `CfopSolver` runs in a web worker — no main-thread blocking.
- `dispose()` terminates the worker; create a new instance if you need to solve again after disposing.
- `solve()` rejects if: worker unavailable, state invalid/unsolvable, OLL/PLL no-match, cancelled, or timeout exceeded.
- `totalMoves` counts HTM face moves only. The `z2` setup rotation is not counted.
- OLL and PLL stages include `caseName` and `wcaId` for display purposes.
