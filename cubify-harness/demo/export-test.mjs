/**
 * export-test.mjs — Node.js demo/validation for CubeRenderer2D SVG output.
 *
 * Generates SVG + PNG files for 3 test cases:
 *   1. OLL Sune  (top-down view, OLL stickering mask)
 *   2. PLL T-Perm (top-down view, PLL stickering mask)
 *   3. Full solved (top-down view, no mask)
 *
 * Uses CubeRenderer2D.toSVG() (no DOM/canvas required) → sharp for PNG.
 *
 * Run: node demo/export-test.mjs  (from cubify-harness/)
 */

import { createRequire } from 'node:module';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'out');

// ---- Local imports (relative to demo/) ----
// Note: CubeState / CubeStickering import cubing.js which uses browser APIs in some paths.
// We work around by using the Node-compatible puzzle/kpuzzle paths directly.

const { CubeState } = await import('../src/CubeState.js');
const { CubeStickering } = await import('../src/CubeStickering.js');
const { CubeRenderer2D } = await import('../src/CubeRenderer2D.js');

// sharp is a dev dependency for SVG → PNG conversion
const require = createRequire(import.meta.url);
const sharp = require('sharp');

// ---- Test cases ----
const CASES = [
  {
    name:    'sune-oll',
    alg:     "R U R' U R U2 R'",
    mask:    'EDGES:OOOODDDDDDDD,CORNERS:OOOODDDD,CENTERS:-DDDDD',
    label:   'OLL Sune',
  },
  {
    name:    'tperm-pll',
    alg:     "R U R' U' R' F R2 U' R' U' R U R' F'",
    mask:    'EDGES:----DDDDDDDD,CORNERS:DDDDDDDD,CENTERS:-DDDDD',
    label:   'PLL T-Perm',
  },
  {
    name:    'solved-full',
    alg:     '',
    mask:    null,
    label:   'Full solved',
  },
];

async function run() {
  await mkdir(outDir, { recursive: true });

  const solved = await CubeState.solved();
  let passed = 0;

  for (const { name, alg, mask, label } of CASES) {
    process.stdout.write(`  ${label}... `);

    // Build display state: invert alg to show the case, no extra setup (standard Y=up orientation)
    const algMoves = alg.trim() ? alg.split(/\s+/).filter(Boolean) : [];
    const invMoves = CubeState.invertAlg(algMoves);
    const state = solved.applyAlg(invMoves);

    // Build vis map
    const rawPattern = state.toRawPattern();
    const visMap = mask
      ? CubeStickering.fromOrbitStringWithState(mask, rawPattern)
      : new Map();

    // Generate SVG
    const svg = CubeRenderer2D.toSVG(state, visMap, { size: 400 });

    // Validate SVG structure: 13 rects (U face + 4 middle strip cells) + 8 corner quads
    const rectCount = (svg.match(/<rect(?! width="\d+" height="\d+" fill="#)/g) ?? []).length;
    const triCount  = (svg.match(/<polygon /g) ?? []).length;
    if (rectCount !== 13 || triCount !== 8) {
      console.error(`FAIL — expected 13 rects + 8 corner quads, got ${rectCount} rects + ${triCount} quads`);
      process.exitCode = 1;
      continue;
    }

    // Write SVG
    const svgPath = path.join(outDir, `${name}.svg`);
    await writeFile(svgPath, svg, 'utf8');

    // Convert SVG → PNG via sharp
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    if (pngBuffer.length < 1000) {
      console.error(`FAIL — PNG too small (${pngBuffer.length} bytes)`);
      process.exitCode = 1;
      continue;
    }

    const pngPath = path.join(outDir, `${name}.png`);
    await writeFile(pngPath, pngBuffer);

    console.log(`OK  (${rectCount} rects + ${triCount} quads, PNG ${pngBuffer.length} bytes)`);
    passed++;
  }

  console.log(`\n${passed}/${CASES.length} cases passed. Output: ${outDir}`);
  if (passed < CASES.length) process.exitCode = 1;
}

run().catch(err => { console.error(err); process.exitCode = 1; });
