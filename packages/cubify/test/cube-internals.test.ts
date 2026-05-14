import { describe, it, expect } from 'vitest';
import { DEFAULT_INTERNALS_OPTIONS } from '../src/CubeInternals.js';

describe('InternalsOptions', () => {
  it('DEFAULT_INTERNALS_OPTIONS has expected values', () => {
    expect(DEFAULT_INTERNALS_OPTIONS.stickerOpacity).toBe(0.60);
    expect(DEFAULT_INTERNALS_OPTIONS.wallOpacity).toBe(0.20);
    expect(DEFAULT_INTERNALS_OPTIONS.coreOpacity).toBe(0.80);
  });

  it('DEFAULT_INTERNALS_OPTIONS values are all in range [0,1]', () => {
    const { stickerOpacity, wallOpacity, coreOpacity } = DEFAULT_INTERNALS_OPTIONS;
    expect(stickerOpacity).toBeGreaterThanOrEqual(0);
    expect(stickerOpacity).toBeLessThanOrEqual(1);
    expect(wallOpacity).toBeGreaterThanOrEqual(0);
    expect(wallOpacity).toBeLessThanOrEqual(1);
    expect(coreOpacity).toBeGreaterThanOrEqual(0);
    expect(coreOpacity).toBeLessThanOrEqual(1);
  });
});
