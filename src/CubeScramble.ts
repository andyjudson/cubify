type Face = 'U' | 'D' | 'R' | 'L' | 'F' | 'B';

const FACES: Face[] = ['U', 'D', 'R', 'L', 'F', 'B'];
const SUFFIXES = ["", "'", '2'] as const;
const OPPOSITE: Record<Face, Face> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
const AXIS: Record<Face, number> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };

export class CubeScramble {
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
