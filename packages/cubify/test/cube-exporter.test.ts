/**
 * CubeExporter unit tests — CubeExporter._resolve (pure Node.js, no DOM/canvas).
 *
 * _render2D and _render3D require DOM/WebGL and are covered by:
 *   - cube-renderer-2d-svg.test.ts (SVG path, Node.js safe)
 *   - Browser / Playwright acceptance tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { CubeState } from '../src/CubeState.ts';
import { CubeExporter } from '../src/CubeExporter.ts';

let solved: CubeState;

beforeAll(async () => {
  solved = await CubeState.solved();
});

// ── _resolve — alg string input ───────────────────────────────────────────────

describe('CubeExporter._resolve — alg string input', () => {
  it('_resolve("R U R\'", null) setupMoves = invertAlg(["R","U","R\'"])', async () => {
    // invertAlg(["R","U","R'"]) = reverse(["R'","U","R"]) then invert each = ["R","U'","R'"]
    const { setupMoves } = await CubeExporter._resolve("R U R'", null);
    expect(setupMoves).toEqual(["R", "U'", "R'"]);
  });

  it('_resolve("R U R\'", null) state = solved.applyAlg("R U\' R\'")', async () => {
    const { state } = await CubeExporter._resolve("R U R'", null);
    const expected = solved.applyAlg("R U' R'");
    expect(state.toFaceArray()).toEqual(expected.toFaceArray());
  });

  it('_resolve("", null) → state = solved, setupMoves = []', async () => {
    const { state, setupMoves } = await CubeExporter._resolve('', null);
    expect(state.isSolved()).toBe(true);
    expect(setupMoves).toEqual([]);
  });

  it('_resolve(null, null) → state = solved', async () => {
    const { state } = await CubeExporter._resolve(null, null);
    expect(state.isSolved()).toBe(true);
  });

  it('_resolve with setupAlg appends extra moves after invertAlg', async () => {
    // setupMoves = invertAlg(["R","U","R'"]) + ["z2"] = ["R","U'","R'","z2"]
    const { setupMoves } = await CubeExporter._resolve("R U R'", 'z2');
    expect(setupMoves).toEqual(["R", "U'", "R'", "z2"]);
  });

  it('_resolve state with setupAlg = solved.applyAlg(inv(alg) + setup)', async () => {
    const { state } = await CubeExporter._resolve("R U R'", 'z2');
    const expected = solved.applyAlg("R U' R' z2");
    expect(state.toFaceArray()).toEqual(expected.toFaceArray());
  });
});

// ── _resolve — CubeState passthrough ─────────────────────────────────────────

describe('CubeExporter._resolve — CubeState passthrough', () => {
  it('_resolve(cubeState, null) → state = the same CubeState instance', async () => {
    const cs = solved.applyAlg('R');
    const { state } = await CubeExporter._resolve(cs, null);
    expect(state).toBe(cs); // exact same reference
  });

  it('_resolve(cubeState, null) → setupMoves = []', async () => {
    const cs = solved.applyAlg('R');
    const { setupMoves } = await CubeExporter._resolve(cs, null);
    expect(setupMoves).toEqual([]);
  });

  it('_resolve(cubeState, setupAlg) → still passthrough, setupMoves = []', async () => {
    // When algOrState is a CubeState, setupAlg is ignored (state returned as-is)
    const cs = solved.applyAlg('R');
    const { state, setupMoves } = await CubeExporter._resolve(cs, 'z2');
    expect(state).toBe(cs);
    expect(setupMoves).toEqual([]);
  });
});

// ── _resolve — setupAlg ordering ─────────────────────────────────────────────

describe('CubeExporter._resolve — setupAlg ordering', () => {
  it('invertAlg is applied BEFORE setupAlg in the sequence', async () => {
    // alg = "U" → invertAlg = ["U'"]
    // setupAlg = "D"
    // setupMoves should be ["U'", "D"], not ["D", "U'"]
    const { setupMoves } = await CubeExporter._resolve('U', 'D');
    expect(setupMoves).toEqual(["U'", 'D']);
  });

  it('result state matches expected manual computation', async () => {
    const { state } = await CubeExporter._resolve('U', 'D');
    const expected = solved.applyAlg("U' D");
    expect(state.toFaceArray()).toEqual(expected.toFaceArray());
  });
});
