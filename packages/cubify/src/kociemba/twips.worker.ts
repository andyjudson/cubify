// Worker for twips WASM — offloads WASM init and solve/scramble from the main thread.
//
// Both functions delegate to cubing.js public API, which internally manages the
// twips WASM worker (inside-*.js) and lazy-loads twips-*.js for random-state scrambles.
// Direct chunk imports (@vite-ignore + new URL traversal) broke in production builds
// because Vite doesn't rewrite new URL() in node_modules files.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let scrambleMod: any = null;
async function getTwips() {
  if (!scrambleMod) scrambleMod = await import('cubing/scramble');
  return scrambleMod;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let searchMod: any = null;
async function getSearch() {
  if (!searchMod) searchMod = await import('cubing/search');
  return searchMod;
}

type WorkerInMessage =
  | { id: number; action: 'scramble' }
  | { id: number; action: 'solve333'; patternStr: string };

self.addEventListener('message', async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;
  const { id, action } = msg;
  try {
    let result: string;
    if (action === 'scramble') {
      const { randomScrambleForEvent } = await getTwips();
      const alg = await randomScrambleForEvent('333');
      result = alg.toString();
    } else if (action === 'solve333') {
      const { experimentalSolve3x3x3IgnoringCenters } = await getSearch();
      const patternData = JSON.parse(msg.patternStr);
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
