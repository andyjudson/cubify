/**
 * AlgParser — parses WCA move notation into an array of move strings.
 *
 * No external dependencies.
 * Handles: RUFLBD + ' + 2 + wide (Rw/rw or lowercase r) + M,E,S + x,y,z
 * Ignores: parentheses (grouping), comments
 * Normalises Rn notation: R3→R', R4→identity (skip), R1→R
 */

export class AlgParser {
  /** Parse a WCA notation string into an array of move tokens. */
  static parse(notation: string): string[] {
    if (!notation || !notation.trim()) return [];

    const cleaned = notation
      .replace(/\/\/.*$/gm, '')
      .replace(/[()[\]]/g, '')
      .trim();

    const moves: string[] = [];
    const re = /([UDRLFBMESxyz]w?|[udrlfb])('|\d+)?/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(cleaned)) !== null) {
      const base = match[1].trim();
      if (!base) continue;
      const mod = match[2] ?? '';
      if (mod === "'") {
        moves.push(base + "'");
      } else if (mod === '' || mod === '1') {
        moves.push(base);
      } else {
        const n = parseInt(mod) % 4;
        if (n === 1) moves.push(base);
        else if (n === 2) moves.push(base + '2');
        else if (n === 3) moves.push(base + "'");
        // n === 0: identity, skip
      }
    }
    return moves;
  }
}
