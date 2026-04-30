/**
 * CubeTheme — visual parameters for both 3D and 2D renderers.
 * All fields are plain JSON-serialisable values.
 */

export interface FaceColours {
  U: string;
  R: string;
  F: string;
  D: string;
  L: string;
  B: string;
}

export type ThemePresetName = 'rubiks' | 'modern' | 'minimal' | 'gan';

export interface CubeTheme {
  colours: FaceColours;
  brightness: number;       // HSL lightness multiplier; 1.0 = no change
  saturation: number;       // HSL saturation multiplier; 1.0 = no change
  plasticColour: string;    // hex
  plasticOpacity: number;   // 0 (transparent) – 1 (opaque)
  gap: number;              // world-space gap between cubelets
  bevel: number;            // RoundedBoxGeometry bevel radius
  stickerPad: number;       // border px on 256×256 texture canvas
  stickerRadius: number;    // sticker corner radius in px
  centerShape: 'square' | 'circle';
  materialType: 'basic' | 'standard';
  roughness: number;
  metalness: number;
}

// ---- Colour palette constants ----

const CLASSIC: FaceColours = {
  U: '#ffffff', R: '#c41e1e', F: '#1a7c2a',
  D: '#ffd000', L: '#e06000', B: '#0f4fad',
};

const TWISTY: FaceColours = {
  U: '#ffffff', R: '#ef3030', F: '#22aa44',
  D: '#ffdd00', L: '#ff8800', B: '#1155cc',
};

const PASTEL: FaceColours = {
  U: '#f5f5f5', R: '#e57373', F: '#81c784',
  D: '#fff176', L: '#ffb74d', B: '#64b5f6',
};

// ---- Named presets ----

export const THEME_PRESETS: Record<ThemePresetName, CubeTheme> = {
  rubiks: {
    colours: CLASSIC,
    brightness: 1.0, saturation: 1.0,
    plasticColour: '#141414', plasticOpacity: 1,
    gap: 0.02, bevel: 0.03,
    stickerPad: 24, stickerRadius: 32,
    centerShape: 'square',
    materialType: 'standard', roughness: 0.85, metalness: 0,
  },
  modern: {
    colours: TWISTY,
    brightness: 1.0, saturation: 1.0,
    plasticColour: '#2a2a2a', plasticOpacity: 1,
    gap: 0.02, bevel: 0.04,
    stickerPad: 14, stickerRadius: 16,
    centerShape: 'square',
    materialType: 'basic', roughness: 0.9, metalness: 0,
  },
  minimal: {
    colours: PASTEL,
    brightness: 1.0, saturation: 0.8,
    plasticColour: '#e8e8e8', plasticOpacity: 1,
    gap: 0.015, bevel: 0.05,
    stickerPad: 12, stickerRadius: 48,
    centerShape: 'square',
    materialType: 'basic', roughness: 0.9, metalness: 0,
  },
  gan: {
    colours: CLASSIC,
    brightness: 0.95, saturation: 0.85,
    plasticColour: '#1a1a1a', plasticOpacity: 1,
    gap: 0.018, bevel: 0.025,
    stickerPad: 12, stickerRadius: 6,
    centerShape: 'circle',
    materialType: 'basic', roughness: 0.9, metalness: 0,
  },
};

// ---- Default theme (library default — the current "speed" look) ----

export const DEFAULT_THEME: CubeTheme = {
  colours: CLASSIC,
  brightness: 1.0, saturation: 1.0,
  plasticColour: '#141414', plasticOpacity: 1,
  gap: 0.02, bevel: 0.03,
  stickerPad: 10, stickerRadius: 8,
  centerShape: 'square',
  materialType: 'basic', roughness: 0.9, metalness: 0,
};

// ---- Helpers ----

export function getThemePreset(name: ThemePresetName): CubeTheme {
  const preset = THEME_PRESETS[name];
  if (!preset) throw new Error(`Unknown theme preset: "${name}"`);
  return cloneTheme(preset);
}

export function cloneTheme(theme: CubeTheme): CubeTheme {
  return { ...theme, colours: { ...theme.colours } };
}

// ---- HSL colour utilities ----

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (n: number) => Math.round(Math.clamp ? Math.clamp(n, 0, 1) * 255 : Math.min(255, Math.max(0, Math.round(n * 255)))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function adjustHex(hex: string, brightness: number, saturation: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const s2 = Math.min(1, Math.max(0, s * saturation));
  const l2 = Math.min(1, Math.max(0, l * brightness));
  return hslToHex(h, s2, l2);
}

export function effectiveColours(theme: CubeTheme): FaceColours {
  const { brightness, saturation } = theme;
  if (brightness === 1 && saturation === 1) return theme.colours;
  const adjust = (hex: string) => adjustHex(hex, brightness, saturation);
  return {
    U: adjust(theme.colours.U),
    R: adjust(theme.colours.R),
    F: adjust(theme.colours.F),
    D: adjust(theme.colours.D),
    L: adjust(theme.colours.L),
    B: adjust(theme.colours.B),
  };
}

// ---- Validation ----

const REQUIRED_FACE_KEYS = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function validateTheme(theme: unknown): string | null {
  if (typeof theme !== 'object' || theme === null) return 'Theme must be an object';
  const t = theme as Record<string, unknown>;

  if (typeof t.colours !== 'object' || t.colours === null) return 'colours must be an object';
  const c = t.colours as Record<string, unknown>;
  for (const k of REQUIRED_FACE_KEYS) {
    if (typeof c[k] !== 'string' || !HEX_RE.test(c[k] as string))
      return `colours.${k} must be a 6-digit hex string`;
  }

  const numFields: Array<[string, number, number]> = [
    ['brightness', 0.1, 5],
    ['saturation', 0, 5],
    ['plasticOpacity', 0, 1],
    ['gap', 0, 0.5],
    ['bevel', 0, 0.5],
    ['stickerPad', 0, 256],
    ['stickerRadius', 0, 256],
    ['roughness', 0, 1],
    ['metalness', 0, 1],
  ];
  for (const [key, min, max] of numFields) {
    const v = t[key];
    if (typeof v !== 'number' || v < min || v > max)
      return `${key} must be a number between ${min} and ${max}`;
  }

  if (typeof t.plasticColour !== 'string' || !HEX_RE.test(t.plasticColour as string))
    return 'plasticColour must be a 6-digit hex string';

  if (t.centerShape !== 'square' && t.centerShape !== 'circle')
    return 'centerShape must be "square" or "circle"';

  if (t.materialType !== 'basic' && t.materialType !== 'standard')
    return 'materialType must be "basic" or "standard"';

  return null;
}

// ---- JSON export / import ----

export function themeToJSON(theme: CubeTheme): string {
  return JSON.stringify(theme, null, 2);
}

export function themeFromJSON(json: string): CubeTheme {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON');
  }
  const err = validateTheme(parsed);
  if (err) throw new Error(`Invalid theme: ${err}`);
  const t = parsed as CubeTheme;
  return { ...t, colours: { ...t.colours } };
}
