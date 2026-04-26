/**
 * CubeRenderer2D canvas rendering tests.
 *
 * These tests use the canvas-based update() / toDataURL() API.
 * They require the `canvas` npm package (node-canvas) for a real 2D context.
 *
 * To enable: npm install --save-dev canvas
 * Then set env CUBIFY_CANVAS_TESTS=1 and re-run.
 *
 * The SVG rendering logic is covered by cube-renderer-2d-svg.test.js (no dependency).
 */

import { describe, it, expect, beforeAll } from 'vitest';

const CANVAS_ENABLED = process.env.CUBIFY_CANVAS_TESTS === '1';

describe.skipIf(!CANVAS_ENABLED)('CubeRenderer2D canvas — requires canvas package', () => {
  let CubeRenderer2D, CubeState, solved, canvas;

  beforeAll(async () => {
    // Dynamic import to avoid parse-time failure when canvas is not installed
    ({ CubeState } = await import('../src/CubeState.js'));
    ({ CubeRenderer2D } = await import('../src/CubeRenderer2D.js'));
    const canvasMod = await import('canvas');
    canvas = canvasMod.createCanvas(400, 400);
    solved = await CubeState.solved();
  });

  it('constructor with provided canvas does not throw', () => {
    expect(() => new CubeRenderer2D(null, { size: 400, canvas })).not.toThrow();
  });

  it('update(solvedState, emptyMap) does not throw', () => {
    const r = new CubeRenderer2D(null, { size: 400, canvas });
    expect(() => r.update(solved, new Map())).not.toThrow();
  });

  it('toDataURL returns a data URL string', () => {
    const r = new CubeRenderer2D(null, { size: 400, canvas });
    r.update(solved, new Map());
    const url = r.toDataURL('image/png');
    expect(typeof url).toBe('string');
    expect(url).toMatch(/^data:image\/png/);
  });

  it('update called twice is idempotent (no throw)', () => {
    const r = new CubeRenderer2D(null, { size: 400, canvas });
    r.update(solved, new Map());
    expect(() => r.update(solved, new Map())).not.toThrow();
  });

  it('destroy() does not throw', () => {
    const r = new CubeRenderer2D(null, { size: 400, canvas });
    expect(() => r.destroy()).not.toThrow();
  });

  it('transparent: true option produces a canvas with alpha channel', () => {
    const { createCanvas } = canvasMod;
    const tCanvas = createCanvas(400, 400);
    const r = new CubeRenderer2D(null, { size: 400, canvas: tCanvas, transparent: true });
    r.update(solved, new Map());
    const ctx = tCanvas.getContext('2d');
    // Sample a corner pixel — should be transparent (alpha=0) since background is not filled
    const data = ctx.getImageData(0, 0, 1, 1).data;
    expect(data[3]).toBe(0); // alpha = 0 at corners
  });
});
