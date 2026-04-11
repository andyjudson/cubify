# Data Model: cubify-harness (Feature 020)

## CubeState

Represents a 3×3×3 cube as 6 face arrays of 9 sticker colour values.

```js
// Face order: U=0, R=1, F=2, D=3, L=4, B=5 (WCA standard)
// Each face: 9 stickers in reading order (top-left to bottom-right)
// Colour values: 'U'|'R'|'F'|'D'|'L'|'B' (face of origin) | 'X' (hidden/grey)

class CubeState {
  faces: string[][]  // [6][9] — faces[faceIndex][stickerIndex]

  static solved()                      // → CubeState in solved state
  applyMove(move: string)              // mutates in place; returns this
  applyAlg(moves: string[])            // applies sequence; returns this
  clone()                              // → new CubeState (deep copy)
}
```

**Sticker index layout per face** (reading order):
```
0 1 2
3 4 5
6 7 8
```

**Adjacency table**: Each move is defined as a face rotation + 4-cycle of adjacent sticker indices across neighbouring faces. Stored as a static lookup in `CubeState.js`.

---

## AlgParser

Thin adapter over `cubing/alg`.

```js
class AlgParser {
  static parse(notation: string): string[]
  // → array of WCA move strings e.g. ["R", "U", "R'", "U'"]
  // Handles: RUFLBD + ' + 2 + wide (u,d,r,l,f,b) + M,E,S + x,y,z
}
```

---

## CubeStickering

Maps preset names to sticker visibility per cubelet face.

```js
// Preset names: 'full' | 'oll' | 'pll' | 'f2l' | 'cross' | 'oll-edges' | 'pll-corners'
// A sticker is 'visible' (show colour) or 'hidden' (show grey/black)

class CubeStickering {
  static forPreset(name: string): StickeringMap
  // StickeringMap: Map<cubeletIndex, faceVisibility[6]>
  // faceVisibility[i] = true (show colour) | false (show grey)
}
```

**Preset definitions**:
| Preset | Visible layers |
|--------|---------------|
| `full` | All 54 stickers |
| `oll` | U face + top-layer edge and corner stickers on RFLB faces |
| `pll` | U face + top-layer stickers on all 4 side faces |
| `f2l` | Bottom 2 layers (D face + middle/bottom RFLB stickers) |
| `cross` | D face centre + 4 bottom edge stickers on RFLB |

---

## CubeRenderer3D

Three.js renderer. Manages scene, camera, lighting, and 26 cubelets.

```js
class CubeRenderer3D {
  constructor(options: { theme?: 'light'|'dark', gap?: number })

  mount(container: HTMLElement)    // appends canvas, starts ResizeObserver
  unmount()                        // removes canvas, disconnects ResizeObserver
  setState(state: CubeState)       // updates sticker colours, re-renders
  setStickering(preset: string)    // applies StickeringMap, re-renders
  render()                         // manual re-render trigger
}
```

**Internal state**:
- `_scene: THREE.Scene`
- `_camera: THREE.PerspectiveCamera`
- `_renderer: THREE.WebGLRenderer`
- `_cubelets: THREE.Mesh[26]` — each with `MeshStandardMaterial[6]`
- `_ro: ResizeObserver`

---

## CubeRenderer2D

Pure SVG flat net renderer. No DOM or canvas dependency.

```js
class CubeRenderer2D {
  static toSVG(state: CubeState, options: {
    stickering?: string,  // preset name
    size?: number,        // output size in px (default 256)
    theme?: 'light'|'dark'
  }): string  // returns SVG string
}
```

Layout: standard cube net (cross shape), U on top, LFRB in middle row, D on bottom.

---

## CubeExporter

Entry point for static export.

```js
class CubeExporter {
  // Browser: uses OffscreenCanvas + WebGLRenderer
  static async toPNG(algOrState: string | CubeState, options: {
    stickering?: string,
    setupAlg?: string,
    size?: number,
    theme?: 'light'|'dark'
  }): Promise<Blob>  // browser

  // Any environment: pure SVG string
  static toSVG(algOrState: string | CubeState, options: {
    stickering?: string,
    setupAlg?: string,
    size?: number
  }): string
}
```

**`setupAlg` handling**: If provided, the displayed state is `solved.applyAlg(inv(alg)).applyAlg(setupAlg)` — the recognition pattern before executing the alg, consistent with `experimentalSetupAnchor: 'end'` behaviour in TwistyPlayer.

---

## Colour Token Map

CSS custom properties for theming (defined in `cubify-harness/css/cubify.css`):

```css
--cubify-U: #ffffff;   /* white */
--cubify-R: #ff4500;   /* orange-red */
--cubify-F: #00a550;   /* green */
--cubify-D: #ffdd00;   /* yellow */
--cubify-L: #ff6600;   /* orange */
--cubify-B: #003399;   /* blue */
--cubify-hidden: #333333;
--cubify-bg: transparent;
```
