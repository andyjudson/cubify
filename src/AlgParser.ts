/**
 * AlgParser — parses WCA move notation into an array of move strings.
 *
 * No external dependencies.
 * Handles: RUFLBD + ' + 2 + wide (Rw/rw or lowercase r) + M,E,S + x,y,z
 * Ignores: parentheses (grouping), comments
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
    const re = /([UDRLFBMESxyz]w?|[udrlfb])('|2)?/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(cleaned)) !== null) {
      const base = match[1].trim();
      if (!base) continue;
      moves.push(base + (match[2] ?? ''));
    }
    return moves;
  }
}
