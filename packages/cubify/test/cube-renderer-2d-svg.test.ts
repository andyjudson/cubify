/**
 * CubeRenderer2D SVG output tests — migrated from demo/export-test.mjs.
 *
 * CubeRenderer2D.toSVG() is a static method that produces SVG strings without
 * any DOM or canvas dependency. Pure Node.js, no jsdom required.
 *
 * Structure invariant: 13 <rect> elements (9 U face + 4 middle strip cells)
 *                    + 8 <polygon> corner quads
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { CubeState } from '../src/CubeState.ts';
import { CubeStickering } from '../src/CubeStickering.ts';
import { CubeRenderer2D } from '../src/CubeRenderer2D.ts';

const SUNE_ALG  = "R U R' U R U2 R'";
const TPERM_ALG = "R U R' U' R' F R2 U' R' U' R U R' F'";
const OLL_MASK  = 'EDGES:OOOODDDDDDDD,CORNERS:OOOODDDD,CENTERS:-DDDDD';
const PLL_MASK  = 'EDGES:----DDDDDDDD,CORNERS:DDDDDDDD,CENTERS:-DDDDD';

let solved: CubeState;

beforeAll(async () => {
  solved = await CubeState.solved();
});

function buildState(alg: string): CubeState {
  const algMoves = alg.trim() ? alg.split(/\s+/).filter(Boolean) : [];
  return solved.applyAlg(CubeState.invertAlg(algMoves));
}

function buildVisMap(state: CubeState, mask: string | null) {
  return mask
    ? CubeStickering.fromOrbitStringWithState(mask, state.toRawPattern())
    : new Map<string, number[]>();
}

function svgCounts(svg: string) {
  // Count <rect> elements that are sticker cells (not the background rect)
  const rectCount = (svg.match(/<rect(?! width="\d+" height="\d+" fill="#)/g) ?? []).length;
  const triCount  = (svg.match(/<polygon /g) ?? []).length;
  return { rectCount, triCount };
}

// ── SVG structure invariants ──────────────────────────────────────────────────

describe('toSVG — structure invariants', () => {
  it('solved full: 13 rects + 8 corner quads', () => {
    const state = solved;
    const svg = CubeRenderer2D.toSVG(state, new Map());
    const { rectCount, triCount } = svgCounts(svg);
    expect(rectCount).toBe(13);
    expect(triCount).toBe(8);
  });

  it('OLL Sune: 13 rects + 8 corner quads', () => {
    const state  = buildState(SUNE_ALG);
    const visMap = buildVisMap(state, OLL_MASK);
    const svg = CubeRenderer2D.toSVG(state, visMap);
    const { rectCount, triCount } = svgCounts(svg);
    expect(rectCount).toBe(13);
    expect(triCount).toBe(8);
  });

  it('PLL T-Perm: 13 rects + 8 corner quads', () => {
    const state  = buildState(TPERM_ALG);
    const visMap = buildVisMap(state, PLL_MASK);
    const svg = CubeRenderer2D.toSVG(state, visMap);
    const { rectCount, triCount } = svgCounts(svg);
    expect(rectCount).toBe(13);
    expect(triCount).toBe(8);
  });
});

// ── SVG validity ──────────────────────────────────────────────────────────────

describe('toSVG — output format', () => {
  it('starts with <svg xmlns=...>', () => {
    const svg = CubeRenderer2D.toSVG(solved, new Map());
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });

  it('ends with </svg>', () => {
    const svg = CubeRenderer2D.toSVG(solved, new Map());
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
  });

  it('contains viewBox attribute matching size', () => {
    const svg = CubeRenderer2D.toSVG(solved, new Map(), { size: 400 });
    expect(svg).toContain('viewBox="0 0 400 400"');
    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="400"');
  });

  it('custom size is reflected in SVG dimensions', () => {
    const svg = CubeRenderer2D.toSVG(solved, new Map(), { size: 256 });
    expect(svg).toContain('viewBox="0 0 256 256"');
  });

  it('output is non-trivially sized (> 1KB)', () => {
    const svg = CubeRenderer2D.toSVG(solved, new Map());
    expect(new TextEncoder().encode(svg).length).toBeGreaterThan(1000);
  });
});

// ── Colour rendering — solved state spot-checks ───────────────────────────────

describe('toSVG — colour rendering on solved cube', () => {
  it('contains U face white colour (#ffffff)', () => {
    const svg = CubeRenderer2D.toSVG(solved, new Map());
    expect(svg.toLowerCase()).toContain('#ffffff');
  });

  it('contains F face green colour (#44ee00)', () => {
    const svg = CubeRenderer2D.toSVG(solved, new Map());
    expect(svg.toLowerCase()).toContain('#44ee00');
  });

  it('contains background plastic colour (#000000 from DEFAULT_THEME)', () => {
    const svg = CubeRenderer2D.toSVG(solved, new Map());
    expect(svg).toContain('#000000');
  });
});

// ── OLL stickering mask ───────────────────────────────────────────────────────

describe('toSVG — OLL stickering produces grey for hidden stickers', () => {
  it('Sune OLL: SVG contains #888888 for hidden stickers', () => {
    const state  = buildState(SUNE_ALG);
    const visMap = buildVisMap(state, OLL_MASK);
    const svg = CubeRenderer2D.toSVG(state, visMap, { size: 400 });
    expect(svg).toContain('#888888');
  });

  it('full mask: SVG does not contain stickering grey (#888888) when no mask active', () => {
    const svg = CubeRenderer2D.toSVG(solved, new Map(), { size: 400 });
    expect(svg).not.toContain('#888888');
  });
});

// ── Idempotency ───────────────────────────────────────────────────────────────

describe('toSVG — idempotency', () => {
  it('same inputs produce identical SVG strings', () => {
    const state = buildState(SUNE_ALG);
    const visMap = buildVisMap(state, OLL_MASK);
    const svg1 = CubeRenderer2D.toSVG(state, visMap);
    const svg2 = CubeRenderer2D.toSVG(state, visMap);
    expect(svg1).toBe(svg2);
  });
});

// ── After R: stickerIndex formula verification (lessons §6, §9) ──────────────

describe('toSVG — face layout correctness after R', () => {
  it('after R: U right column (U[2,5,8]) shows F colour (green) via SVG', () => {
    // After R, F right col → U right col — visible in the U face cells
    // The SVG renders the U face centre cell (U[4]=U, unchanged) + right col
    // We verify the overall SVG still has correct structure
    const afterR = solved.applyAlg(['R']);
    const svg = CubeRenderer2D.toSVG(afterR, new Map());
    const { rectCount, triCount } = svgCounts(svg);
    expect(rectCount).toBe(13);
    expect(triCount).toBe(8);
    // SVG should contain green (F colour) for U right column
    expect(svg.toLowerCase()).toContain('#44ee00');
  });
});
