import { buildMoveTables } from './MoveTables.js';
import { search } from './TwoPhase.js';

type WorkerInMessage =
  | { type: 'solve'; stateData: StateData; timeoutMs?: number; nonOptimal?: boolean }
  | { type: 'cancel' };

interface StateData {
  CORNERS: { pieces: number[]; orientation: number[] };
  EDGES:   { pieces: number[]; orientation: number[] };
}

let tables: Awaited<ReturnType<typeof buildMoveTables>> | null = null;
let busy = false;

// Build tables on startup
buildMoveTables().then(t => {
  tables = t;
}).catch(err => {
  self.postMessage({ type: 'error', reason: 'internal', message: String(err), elapsedMs: 0 });
});

self.addEventListener('message', (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === 'cancel') {
    busy = false;
    return;
  }

  if (msg.type !== 'solve') return;
  if (busy) return; // ignore — caller must cancel first

  if (!tables) {
    self.postMessage({ type: 'error', reason: 'internal', message: 'Tables not ready', elapsedMs: 0 });
    return;
  }

  busy = true;
  const start = Date.now();
  const timeoutMs = msg.timeoutMs ?? 300000;

  try {
    const alg = search(msg.stateData, tables, {
      timeoutMs,
      nonOptimal: msg.nonOptimal ?? false,
      onProgress(depth, nodes) {
        if (!busy) return;
        self.postMessage({ type: 'progress', depth, nodes, elapsedMs: Date.now() - start });
      },
      onHeartbeat(nodes) {
        if (!busy) return;
        self.postMessage({ type: 'heartbeat', nodes, elapsedMs: Date.now() - start });
      },
    });

    if (!busy) return; // cancelled

    const elapsedMs = Date.now() - start;
    if (alg === null) {
      self.postMessage({ type: 'error', reason: 'timeout', message: 'Search exceeded time limit', elapsedMs });
    } else {
      self.postMessage({ type: 'solution', alg, depth: alg ? alg.split(' ').length : 0, elapsedMs });
    }
  } catch (err) {
    self.postMessage({ type: 'error', reason: 'internal', message: String(err), elapsedMs: Date.now() - start });
  } finally {
    busy = false;
  }
});
