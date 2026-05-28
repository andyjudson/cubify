
export interface TwipsServerSolveOptions {
  minDepth?: number;
  maxDepth?: number;
  startPruneDepth?: number;
  randomStart?: boolean;
  generatorMoves?: string[];
}

type Face = 'U' | 'D' | 'R' | 'L' | 'F' | 'B';

const FACES: Face[] = ['U', 'D', 'R', 'L', 'F', 'B'];
const SUFFIXES = ["", "'", '2'] as const;
const OPPOSITE: Record<Face, Face> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
const AXIS: Record<Face, number> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PendingMap = Map<number, { resolve: (v: string) => void; reject: (e: any) => void }>;

let _idCounter = 0;

// --- Scramble worker (wasmRandomScrambleForEvent only — always fast) ---
const _scramblePending: PendingMap = new Map();
let _scrambleWorker: Worker | null = null;
export let twipsWarmed = false;

function _getScrambleWorker(): Worker {
  if (!_scrambleWorker) {
    _scrambleWorker = new Worker(
      new URL('./twips.worker.ts', import.meta.url),
      { type: 'module' },
    );
    _scrambleWorker.addEventListener('message', (e: MessageEvent) => {
      const { id, result, error } = e.data;
      const cb = _scramblePending.get(id);
      if (!cb) return;
      _scramblePending.delete(id);
      if (error) {
        cb.reject(new Error(error));
      } else {
        if (!twipsWarmed) {
          twipsWarmed = true;
          console.info('[CubeScramble] twips WASM ready');
        }
        cb.resolve(result);
      }
    });
    _scrambleWorker.addEventListener('error', (e: ErrorEvent) => {
      for (const [id, cb] of _scramblePending) {
        _scramblePending.delete(id);
        cb.reject(new Error(e.message));
      }
    });
  }
  return _scrambleWorker;
}


function _scrambleTwips(): Promise<string> {
  const id = _idCounter++;
  return new Promise((resolve, reject) => {
    _scramblePending.set(id, { resolve, reject });
    _getScrambleWorker().postMessage({ id, action: 'scramble' });
  });
}

export class CubeScramble {
  /**
   * WCA-quality random-state scramble via twips WASM (two-phase Kociemba, pre-built tables).
   * Runs in a dedicated Scramble Worker — independent from the Solve Worker.
   * First call lazy-loads the WASM bundle (~200–400 ms); subsequent calls ~50 ms.
   */
  static async wca(): Promise<string> {
    return _scrambleTwips();
  }

  /**
   * Solve via a locally running `twips serve` instance (http://localhost:2023).
   * Much faster than WASM — native Rust with pre-built tables, no warm-up.
   * Run `twips serve` in a terminal to enable this path.
   *
   * Default options: randomStart:true, startPruneDepth:5 — finds a fast
   * non-optimal solution rather than proving optimality.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async solveServer(kPattern: any, options?: TwipsServerSolveOptions): Promise<string> {
    const searchArgs: TwipsServerSolveOptions = {
      randomStart: true,
      startPruneDepth: 5,
      ...options,
    };
    const response = await fetch('http://localhost:2023/v0/solve/pattern', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        definition: kPattern.kpuzzle.definition,
        pattern: kPattern.patternData,
        searchArgs,
      }),
    });
    if (!response.ok) {
      throw new Error(`twips server error: ${await response.text()}`);
    }
    const json = await response.json();
    return json.alg as string;
  }

  /** Returns true if a `twips serve` instance is reachable at localhost:2023. */
  static async isTwipsServerAvailable(): Promise<boolean> {
    try {
      const r = await fetch('http://localhost:2023/', { method: 'HEAD', signal: AbortSignal.timeout(800) });
      return r.status < 500;
    } catch {
      return false;
    }
  }

  static random(length = 20): string {
    const moves: string[] = [];
    let lastFace: Face | null = null;
    let secondLastFace: Face | null = null;

    while (moves.length < length) {
      // Exclude same axis if last two moves were on opposite faces of the same axis
      const excludeAxis = (lastFace && secondLastFace && OPPOSITE[lastFace] === secondLastFace)
        ? AXIS[lastFace]
        : null;

      const available = FACES.filter(f => {
        if (f === lastFace) return false;
        if (excludeAxis !== null && AXIS[f] === excludeAxis) return false;
        return true;
      });

      const face = available[Math.floor(Math.random() * available.length)];
      const suffix = SUFFIXES[Math.floor(Math.random() * 3)];
      moves.push(face + suffix);
      secondLastFace = lastFace;
      lastFace = face;
    }

    return moves.join(' ');
  }
}
