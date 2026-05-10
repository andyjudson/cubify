import { describe, it, expect } from 'vitest';
import {
  THEME_PRESETS, DEFAULT_THEME, getThemePreset, cloneTheme,
  effectiveColours, validateTheme, themeToJSON, themeFromJSON,
  type CubeTheme, type ThemePresetName,
} from '../src/CubeTheme.js';

const PRESET_NAMES: ThemePresetName[] = ['alpha', 'classic', 'rubiks', 'speed-dark', 'speed-light'];

describe('THEME_PRESETS', () => {
  it('has exactly 5 named presets', () => {
    expect(Object.keys(THEME_PRESETS).sort()).toEqual(PRESET_NAMES);
  });

  for (const name of PRESET_NAMES) {
    it(`${name} preset is valid`, () => {
      expect(validateTheme(THEME_PRESETS[name])).toBeNull();
    });
  }

  it('DEFAULT_THEME is valid', () => {
    expect(validateTheme(DEFAULT_THEME)).toBeNull();
  });

  it('speed-dark preset has dark plastic', () => {
    expect(THEME_PRESETS['speed-dark'].plasticColour).toBe('#232323');
  });

  it('speed-light preset has light plastic and partial opacity', () => {
    expect(THEME_PRESETS['speed-light'].plasticColour).toBe('#ebebeb');
    expect(THEME_PRESETS['speed-light'].plasticOpacity).toBe(0.9);
  });

  it('rubiks preset uses standard material', () => {
    expect(THEME_PRESETS.rubiks.materialType).toBe('standard');
  });

  it('speed-dark preset uses basic material', () => {
    expect(THEME_PRESETS['speed-dark'].materialType).toBe('basic');
  });
});

describe('getThemePreset', () => {
  it('returns a clone (mutating it does not affect source)', () => {
    const p = getThemePreset('rubiks');
    p.gap = 999;
    expect(THEME_PRESETS.rubiks.gap).not.toBe(999);
  });

  it('throws on unknown name', () => {
    expect(() => getThemePreset('nonexistent' as ThemePresetName)).toThrow();
  });
});

describe('cloneTheme', () => {
  it('produces a deep-enough clone (colours object is new reference)', () => {
    const t = cloneTheme(THEME_PRESETS['speed-dark']);
    t.colours.U = '#000000';
    expect(THEME_PRESETS['speed-dark'].colours.U).toBe('#ffffff');
  });
});

describe('effectiveColours', () => {
  it('returns original colours when brightness=1 saturation=1', () => {
    const t = { ...DEFAULT_THEME, brightness: 1, saturation: 1 };
    const c = effectiveColours(t);
    expect(c).toBe(t.colours);
  });

  it('darkens when brightness < 1', () => {
    const t = { ...DEFAULT_THEME, colours: { ...DEFAULT_THEME.colours, R: '#c41e1e' }, brightness: 0.5, saturation: 1 };
    const c = effectiveColours(t);
    const rDark = parseInt(c.R.slice(1, 3), 16);
    const rOrig = parseInt('#c41e1e'.slice(1, 3), 16);
    expect(rDark).toBeLessThan(rOrig);
  });

  it('lightens when brightness > 1', () => {
    const t = { ...DEFAULT_THEME, colours: { ...DEFAULT_THEME.colours, R: '#c41e1e' }, brightness: 1.3, saturation: 1 };
    const c = effectiveColours(t);
    const rLight = parseInt(c.R.slice(1, 3), 16);
    const rOrig = parseInt('#c41e1e'.slice(1, 3), 16);
    expect(rLight).toBeGreaterThan(rOrig);
  });

  it('white U face stays white at any brightness', () => {
    const t = { ...DEFAULT_THEME, colours: { ...DEFAULT_THEME.colours, U: '#ffffff' }, brightness: 1.5, saturation: 0.5 };
    const c = effectiveColours(t);
    expect(c.U).toBe('#ffffff');
  });

  it('desaturates when saturation < 1', () => {
    const t = { ...DEFAULT_THEME, colours: { ...DEFAULT_THEME.colours, R: '#c41e1e' }, brightness: 1, saturation: 0 };
    const c = effectiveColours(t);
    const r = parseInt(c.R.slice(1, 3), 16);
    const g = parseInt(c.R.slice(3, 5), 16);
    const b = parseInt(c.R.slice(5, 7), 16);
    // fully desaturated → r, g, b all equal
    expect(Math.abs(r - g)).toBeLessThanOrEqual(2);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(2);
  });
});

describe('validateTheme', () => {
  const valid: CubeTheme = cloneTheme(DEFAULT_THEME);

  it('returns null for valid theme', () => {
    expect(validateTheme(valid)).toBeNull();
  });

  it('rejects non-object', () => {
    expect(validateTheme(null)).not.toBeNull();
    expect(validateTheme('string')).not.toBeNull();
    expect(validateTheme(42)).not.toBeNull();
  });

  it('rejects missing colours key', () => {
    const t = { ...valid, colours: undefined };
    expect(validateTheme(t)).not.toBeNull();
  });

  it('rejects invalid face hex', () => {
    const t = { ...valid, colours: { ...valid.colours, R: 'red' } };
    expect(validateTheme(t)).not.toBeNull();
  });

  it('rejects out-of-range gap', () => {
    expect(validateTheme({ ...valid, gap: 2 })).not.toBeNull();
  });

  it('rejects invalid centerShape', () => {
    expect(validateTheme({ ...valid, centerShape: 'triangle' })).not.toBeNull();
  });

  it('rejects invalid materialType', () => {
    expect(validateTheme({ ...valid, materialType: 'glossy' })).not.toBeNull();
  });

  it('rejects invalid plasticColour', () => {
    expect(validateTheme({ ...valid, plasticColour: '#gggggg' })).not.toBeNull();
  });
});

describe('themeToJSON / themeFromJSON', () => {
  it('round-trips all 4 presets losslessly', () => {
    for (const name of PRESET_NAMES) {
      const original = THEME_PRESETS[name];
      const restored = themeFromJSON(themeToJSON(original));
      expect(restored).toEqual(original);
    }
  });

  it('round-trips DEFAULT_THEME', () => {
    expect(themeFromJSON(themeToJSON(DEFAULT_THEME))).toEqual(DEFAULT_THEME);
  });

  it('themeFromJSON throws on invalid JSON', () => {
    expect(() => themeFromJSON('{bad json')).toThrow('Invalid JSON');
  });

  it('themeFromJSON throws on invalid theme shape', () => {
    expect(() => themeFromJSON('{"gap": -999}')).toThrow();
  });

  it('themeFromJSON returns a clone (mutations safe)', () => {
    const t = themeFromJSON(themeToJSON(DEFAULT_THEME));
    t.colours.U = '#000000';
    expect(DEFAULT_THEME.colours.U).toBe('#ffffff');
  });
});
