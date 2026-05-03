/**
 * CubeRenderer3D geometry tests — MOVE_AXIS directions and axis assignments.
 *
 * These tests verify the animation axis direction constants from lessons §5 and
 * cube-physical-rules §3.4. They do NOT instantiate the WebGL renderer.
 *
 * Key fact: cubing.js U/D have animation directions flipped vs WCA:
 *   - U.dir = -1 (same axis as standard but reversed to compensate for cubing.js U = WCA U')
 *   - D.dir = +1 (follows D convention, opposite of U)
 *   - R, L, F, B dirs match WCA standard (no flip)
 */

import { describe, it, expect } from 'vitest';
import { MOVE_AXIS } from '../src/CubeRenderer3D.ts';

// ── MOVE_AXIS directions (lessons §5, physical §3.4) ─────────────────────────

describe('MOVE_AXIS directions — lessons §5', () => {
  it('U.dir = -1 — cubing.js U is WCA U\', direction flipped to compensate', () => {
    expect(MOVE_AXIS.U.dir).toBe(-1);
  });

  it('D.dir = +1 — opposite to U', () => {
    expect(MOVE_AXIS.D.dir).toBe(1);
  });

  it('E.dir = +1 — follows D convention (lessons §5)', () => {
    expect(MOVE_AXIS.E.dir).toBe(1);
  });

  it('R.dir = -1 — WCA standard (no flip)', () => {
    expect(MOVE_AXIS.R.dir).toBe(-1);
  });

  it('L.dir = +1 — WCA standard (opposite of R on same axis)', () => {
    expect(MOVE_AXIS.L.dir).toBe(1);
  });

  it('F.dir = -1 — WCA standard', () => {
    expect(MOVE_AXIS.F.dir).toBe(-1);
  });

  it('B.dir = +1 — WCA standard (opposite of F on same axis)', () => {
    expect(MOVE_AXIS.B.dir).toBe(1);
  });
});

// ── MOVE_AXIS rotation axes ───────────────────────────────────────────────────

describe('MOVE_AXIS rotation axes', () => {
  it('U and D share the Y axis (0,1,0)', () => {
    expect(MOVE_AXIS.U.axis.y).toBe(1);
    expect(MOVE_AXIS.U.axis.x).toBe(0);
    expect(MOVE_AXIS.U.axis.z).toBe(0);
    expect(MOVE_AXIS.D.axis.y).toBe(1);
  });

  it('R and L share the X axis (1,0,0)', () => {
    expect(MOVE_AXIS.R.axis.x).toBe(1);
    expect(MOVE_AXIS.L.axis.x).toBe(1);
    expect(MOVE_AXIS.R.axis.y).toBe(0);
    expect(MOVE_AXIS.R.axis.z).toBe(0);
  });

  it('F and B share the Z axis (0,0,1)', () => {
    expect(MOVE_AXIS.F.axis.z).toBe(1);
    expect(MOVE_AXIS.B.axis.z).toBe(1);
    expect(MOVE_AXIS.F.axis.x).toBe(0);
    expect(MOVE_AXIS.F.axis.y).toBe(0);
  });

  it('M shares the X axis (same as R/L)', () => {
    expect(MOVE_AXIS.M.axis.x).toBe(1);
  });

  it('E shares the Y axis (same as U/D)', () => {
    expect(MOVE_AXIS.E.axis.y).toBe(1);
  });

  it('S shares the Z axis (same as F/B)', () => {
    expect(MOVE_AXIS.S.axis.z).toBe(1);
  });
});

// ── MOVE_AXIS filter functions ────────────────────────────────────────────────

describe('MOVE_AXIS filter functions', () => {
  it('U filter selects y=1 pieces only', () => {
    expect(MOVE_AXIS.U.filter({ x: 0, y: 1, z: 0 })).toBe(true);
    expect(MOVE_AXIS.U.filter({ x: 0, y: 0, z: 0 })).toBe(false);
    expect(MOVE_AXIS.U.filter({ x: 0, y: -1, z: 0 })).toBe(false);
  });

  it('D filter selects y=-1 pieces only', () => {
    expect(MOVE_AXIS.D.filter({ x: 0, y: -1, z: 0 })).toBe(true);
    expect(MOVE_AXIS.D.filter({ x: 0, y: 1, z: 0 })).toBe(false);
  });

  it('R filter selects x=1 pieces only', () => {
    expect(MOVE_AXIS.R.filter({ x: 1, y: 0, z: 0 })).toBe(true);
    expect(MOVE_AXIS.R.filter({ x: -1, y: 0, z: 0 })).toBe(false);
  });

  it('L filter selects x=-1 pieces only', () => {
    expect(MOVE_AXIS.L.filter({ x: -1, y: 0, z: 0 })).toBe(true);
    expect(MOVE_AXIS.L.filter({ x: 1, y: 0, z: 0 })).toBe(false);
  });

  it('F filter selects z=1 pieces only', () => {
    expect(MOVE_AXIS.F.filter({ x: 0, y: 0, z: 1 })).toBe(true);
    expect(MOVE_AXIS.F.filter({ x: 0, y: 0, z: -1 })).toBe(false);
  });

  it('B filter selects z=-1 pieces only', () => {
    expect(MOVE_AXIS.B.filter({ x: 0, y: 0, z: -1 })).toBe(true);
    expect(MOVE_AXIS.B.filter({ x: 0, y: 0, z: 1 })).toBe(false);
  });

  it('whole-cube rotations (X,Y,Z) filter selects all pieces', () => {
    const pos = { x: 1, y: -1, z: 0 };
    expect(MOVE_AXIS.X.filter(pos)).toBe(true);
    expect(MOVE_AXIS.Y.filter(pos)).toBe(true);
    expect(MOVE_AXIS.Z.filter(pos)).toBe(true);
  });
});

// ── Wide moves ────────────────────────────────────────────────────────────────

describe('MOVE_AXIS wide moves', () => {
  it('f shares axis and dir with F', () => {
    expect(MOVE_AXIS.f.dir).toBe(MOVE_AXIS.F.dir);
    expect(MOVE_AXIS.f.axis.z).toBe(1);
  });

  it('b shares axis and dir with B', () => {
    expect(MOVE_AXIS.b.dir).toBe(MOVE_AXIS.B.dir);
    expect(MOVE_AXIS.b.axis.z).toBe(1);
  });

  it('r shares axis and dir with R', () => {
    expect(MOVE_AXIS.r.dir).toBe(MOVE_AXIS.R.dir);
    expect(MOVE_AXIS.r.axis.x).toBe(1);
  });

  it('l shares axis and dir with L', () => {
    expect(MOVE_AXIS.l.dir).toBe(MOVE_AXIS.L.dir);
    expect(MOVE_AXIS.l.axis.x).toBe(1);
  });

  it('u shares axis and dir with U', () => {
    expect(MOVE_AXIS.u.dir).toBe(MOVE_AXIS.U.dir);
    expect(MOVE_AXIS.u.axis.y).toBe(1);
  });

  it('d shares axis and dir with D', () => {
    expect(MOVE_AXIS.d.dir).toBe(MOVE_AXIS.D.dir);
    expect(MOVE_AXIS.d.axis.y).toBe(1);
  });

  it('f filter selects z=0 AND z=1 (face + S slice)', () => {
    expect(MOVE_AXIS.f.filter({ x: 0, y: 0, z:  1 })).toBe(true);
    expect(MOVE_AXIS.f.filter({ x: 0, y: 0, z:  0 })).toBe(true);
    expect(MOVE_AXIS.f.filter({ x: 0, y: 0, z: -1 })).toBe(false);
  });

  it('b filter selects z=0 AND z=-1 (face + S\' slice)', () => {
    expect(MOVE_AXIS.b.filter({ x: 0, y: 0, z: -1 })).toBe(true);
    expect(MOVE_AXIS.b.filter({ x: 0, y: 0, z:  0 })).toBe(true);
    expect(MOVE_AXIS.b.filter({ x: 0, y: 0, z:  1 })).toBe(false);
  });

  it('r filter selects x=0 AND x=1 (face + M\' slice)', () => {
    expect(MOVE_AXIS.r.filter({ x:  1, y: 0, z: 0 })).toBe(true);
    expect(MOVE_AXIS.r.filter({ x:  0, y: 0, z: 0 })).toBe(true);
    expect(MOVE_AXIS.r.filter({ x: -1, y: 0, z: 0 })).toBe(false);
  });

  it('l filter selects x=0 AND x=-1 (face + M slice)', () => {
    expect(MOVE_AXIS.l.filter({ x: -1, y: 0, z: 0 })).toBe(true);
    expect(MOVE_AXIS.l.filter({ x:  0, y: 0, z: 0 })).toBe(true);
    expect(MOVE_AXIS.l.filter({ x:  1, y: 0, z: 0 })).toBe(false);
  });

  it('u filter selects y=0 AND y=1 (face + E\' slice)', () => {
    expect(MOVE_AXIS.u.filter({ x: 0, y:  1, z: 0 })).toBe(true);
    expect(MOVE_AXIS.u.filter({ x: 0, y:  0, z: 0 })).toBe(true);
    expect(MOVE_AXIS.u.filter({ x: 0, y: -1, z: 0 })).toBe(false);
  });

  it('d filter selects y=0 AND y=-1 (face + E slice)', () => {
    expect(MOVE_AXIS.d.filter({ x: 0, y: -1, z: 0 })).toBe(true);
    expect(MOVE_AXIS.d.filter({ x: 0, y:  0, z: 0 })).toBe(true);
    expect(MOVE_AXIS.d.filter({ x: 0, y:  1, z: 0 })).toBe(false);
  });
});

// ── Canvas-dependent tests (skipped — require WebGL) ─────────────────────────

describe.skip('CubeRenderer3D WebGL tests — requires headed browser (Playwright)', () => {
  it('stickerIndex U face: idx(x, z) formula', () => { /* Playwright acceptance */ });
  it('stickerIndex D face: idx(x, -z) formula', () => { /* Playwright acceptance */ });
  it('faceCW cycle direction: [off,off+2,off+8,off+6] = CW (lessons §9)', () => { /* Playwright acceptance */ });
  it('after R: F[2,5,8] moves to D[2,5,8] — CW cycle (lessons §9)', () => { /* Playwright acceptance */ });
});
