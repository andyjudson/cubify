/**
 * Contract — CubeTheme public API (Feature 025)
 *
 * This file is the authoritative interface contract. The implementation in
 * src/CubeTheme.ts must satisfy every signature here.
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export interface FaceColours {
  U: string;
  R: string;
  F: string;
  D: string;
  L: string;
  B: string;
}

export interface CubeTheme {
  colours: FaceColours;
  brightness: number;       // HSL lightness multiplier; 1.0 = no change
  saturation: number;       // HSL saturation multiplier; 1.0 = no change
  plasticColour: string;    // hex, e.g. '#141414'
  plasticOpacity: number;   // 0 (transparent) – 1 (opaque)
  gap: number;              // world-space gap between cubelets
  bevel: number;            // RoundedBoxGeometry bevel radius
  stickerPad: number;       // border px on 256×256 texture canvas
  stickerRadius: number;    // sticker corner radius in px
  centerShape: 'square' | 'circle';
  materialType: 'basic' | 'standard';
  roughness: number;        // 0 (glossy) – 1 (matte); standard only
  metalness: number;        // standard only
}

export type ThemePresetName = 'speed' | 'rubiks' | 'modern' | 'minimal' | 'gan';

// ---------------------------------------------------------------------------
// CubeTheme namespace (static helpers — implemented as named exports or
// properties of a plain namespace object in src/CubeTheme.ts)
// ---------------------------------------------------------------------------

/**
 * All 5 named preset themes.
 */
export declare const THEME_PRESETS: Readonly<Record<ThemePresetName, CubeTheme>>;

/**
 * Return a preset by name, or throw if unknown.
 */
export declare function getThemePreset(name: ThemePresetName): CubeTheme;

/**
 * Return a deep copy of the given theme (safe to mutate).
 */
export declare function cloneTheme(theme: CubeTheme): CubeTheme;

/**
 * Validate a theme object. Returns null on success, or a string describing
 * the first validation error.
 */
export declare function validateTheme(theme: unknown): string | null;

/**
 * Compute effective face colours after applying brightness and saturation
 * adjustments in HSL space. Returns a new FaceColours record.
 */
export declare function effectiveColours(theme: CubeTheme): FaceColours;

/**
 * Serialise a theme to a compact JSON string suitable for clipboard export.
 */
export declare function themeToJSON(theme: CubeTheme): string;

/**
 * Parse and validate a JSON string produced by themeToJSON. Throws on
 * invalid JSON or invalid theme shape.
 */
export declare function themeFromJSON(json: string): CubeTheme;

// ---------------------------------------------------------------------------
// CubeRenderer3D additions (extends existing API)
// ---------------------------------------------------------------------------

/**
 * Apply a new theme to the renderer. Diffs against the current theme and
 * takes the minimal rebuild path:
 *
 *   colours / brightness / saturation / plasticColour / stickerPad /
 *   stickerRadius / centerShape → texture cache invalidation + restoreColours
 *
 *   gap / bevel → per-cubelet geometry dispose + rebuild, then texture rebuild
 *
 *   materialType / roughness / metalness → material type switch, then texture rebuild
 *
 * If the renderer is currently animating, setTheme() waits for the current
 * move to complete (via abortAnimation()) before rebuilding.
 *
 * The active stickering mask (if any) is re-applied after the rebuild so
 * that grey stickers are not lost.
 */
// interface CubeRenderer3D {
//   setTheme(theme: CubeTheme | ThemePresetName): void;
//   get theme(): CubeTheme;
// }

// ---------------------------------------------------------------------------
// CubeRenderer2D additions (extends existing API)
// ---------------------------------------------------------------------------

/**
 * Apply a new theme. Only colours, brightness, saturation, and plasticColour
 * are used — 2D has no gap/bevel/texture-shape dimension.
 * Takes effect on the next update() or toSVG() call.
 */
// interface CubeRenderer2D {
//   setTheme(theme: CubeTheme | ThemePresetName): void;
//   get theme(): CubeTheme;
// }

// ---------------------------------------------------------------------------
// CubeRenderer3DOptions addition
// ---------------------------------------------------------------------------

// interface CubeRenderer3DOptions {
//   theme?: CubeTheme | ThemePresetName;  // defaults to THEME_PRESETS.speed
// }

// interface CubeRenderer2DOptions {
//   theme?: CubeTheme | ThemePresetName;  // defaults to THEME_PRESETS.speed
// }
