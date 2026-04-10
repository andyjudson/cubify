/**
 * AlgParser — parses WCA move notation into an array of move strings.
 *
 * Primary path: built-in regex parser (no external dependency).
 * Optional path: use cubing/alg for guaranteed WCA compliance if available.
 *
 * Handles: RUFLBD + ' + 2 + wide (Rw/rw or lowercase r) + M,E,S + x,y,z
 * Ignores: parentheses (grouping), comments
 */

/**
 * WCA move token regex — matches a single move including optional modifier.
 * Covers: face (RULFDB), wide (Rw, or lowercase rulfdb), slices (MES), rotations (xyz)
 */
const MOVE_RE = /([UDRLFBMESxyz]w?|[udrlf b])('|2)?/g;

export class AlgParser {
  /**
   * Parse a WCA notation string into an array of move tokens.
   * Uses a built-in regex parser — no external dependency required.
   *
   * @param {string} notation — e.g. "R U R' U'" or "r U R' U' r' F R F'"
   * @returns {string[]} — e.g. ["R", "U", "R'", "U'"]
   */
  static parse(notation) {
    if (!notation || !notation.trim()) return [];

    // Strip comments (anything after //) and parentheses
    const cleaned = notation
      .replace(/\/\/.*$/gm, '')
      .replace(/[()[\]]/g, '')
      .trim();

    const moves = [];
    const re = /([UDRLFBMESxyz](?:w)?|[udrlf b])('|2)?/g;
    let match;
    while ((match = re.exec(cleaned)) !== null) {
      const base = match[1].trim();
      if (!base) continue;
      const mod = match[2] || '';
      moves.push(base + mod);
    }
    return moves;
  }

  /**
   * Parse using cubing/alg if available, falling back to built-in parser.
   * Pass the Alg class directly to avoid a hard dependency.
   *
   * @param {string} notation
   * @param {{ Alg: Function }} cubingAlg — optional { Alg } import from 'cubing/alg'
   * @returns {string[]}
   */
  static parseWith(notation, cubingAlg) {
    if (!cubingAlg || !cubingAlg.Alg) {
      return AlgParser.parse(notation);
    }
    try {
      const alg = new cubingAlg.Alg(notation);
      return [...alg.experimentalLeafMoves()].map(m => m.toString());
    } catch (e) {
      console.warn('[AlgParser] cubing/alg parse failed, falling back:', e.message);
      return AlgParser.parse(notation);
    }
  }

  /**
   * Return the inverse of a move array (reversed, each move inverted).
   * @param {string[]} moves
   * @returns {string[]}
   */
  static invertAlg(moves) {
    return [...moves].reverse().map(m => {
      if (m.endsWith("'")) return m.slice(0, -1);
      if (m.endsWith('2')) return m;
      return m + "'";
    });
  }
}
