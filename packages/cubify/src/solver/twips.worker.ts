// Worker for twips WASM — offloads WASM init and solve/scramble from the main thread.

const twipsUrl = new URL(
  '../../../../node_modules/cubing/dist/lib/cubing/chunks/twips-YHXBF55O.js',
  import.meta.url,
);

// search chunk — exports experimentalSolve3x3x3IgnoringCenters.
// Routes: cubing.js search Worker → search-dynamic-solve-3x3x3-*.js → cs0x7f/min2phase.
// Fast (pre-built JS tables), but opaque — no readable source.
// TODO: replace with a direct twips solve333 call once twips exposes one natively.
// See specs/032-cubify-solver/research.md §"Decision: Solver algorithm" for full context.
const searchUrl = new URL(
  '../../../../node_modules/cubing/dist/lib/cubing/chunks/chunk-M7YKTETT.js',
  import.meta.url,
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let twipsMod: any = null;
async function getTwips() {
  if (!twipsMod) {
    twipsMod = await import(/* @vite-ignore */ twipsUrl.href);
  }
  return twipsMod;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let searchMod: any = null;
async function getSearch() {
  if (!searchMod) {
    searchMod = await import(/* @vite-ignore */ searchUrl.href);
  }
  return searchMod;
}

self.addEventListener('message', async (e: MessageEvent) => {
  const { id, action, kpuzzleStr, patternStr, invert, options } = e.data;
  try {
    let result: string;
    if (action === 'scramble') {
      const { wasmRandomScrambleForEvent } = await getTwips();
      const alg = await wasmRandomScrambleForEvent('333');
      result = alg.toString();
    } else if (action === 'solve333') {
      // Fast path: two-phase Kociemba with pre-built WASM tables (same path as scramble generation).
      const { experimentalSolve3x3x3IgnoringCenters } = await getSearch();
      const patternData = JSON.parse(patternStr);
      const alg = await experimentalSolve3x3x3IgnoringCenters({ patternData });
      result = alg.toString();
    } else {
      throw new Error(`[twips.worker] unknown action: ${action}`);
    }
    self.postMessage({ id, result });
  } catch (err) {
    console.error('[twips.worker] error:', err);
    self.postMessage({ id, error: String(err) });
  }
});
