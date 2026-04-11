/**
 * AlgParser — parses WCA move notation into an array of move strings.
 *
 * No external dependencies.
 * Handles: RUFLBD + ' + 2 + wide (Rw/rw or lowercase r) + M,E,S + x,y,z
 * Ignores: parentheses (grouping), comments
 */

export class AlgParser {
  /**
   * Parse a WCA notation string into an array of move tokens.
   *
   * @param {string} notation — e.g. "R U R' U'" or "r U R' U' r' F R F'"
   * @returns {string[]} — e.g. ["R", "U", "R'", "U'"]
   */
  static parse(notation) {
    if (!notation || !notation.trim()) return [];

    // Strip comments (anything after //) and grouping brackets
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
      moves.push(base + (match[2] || ''));
    }
    return moves;
  }
}
