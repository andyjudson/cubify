/**
 * CubeExporter — PNG export for both 2D top-down and 3D rendered views.
 *
 * CubeExporter.toPNG(algOrState, options) → Promise<string>  (data URL)
 *
 * style: '2d' → CubeRenderer2D top-down perspective (OLL/PLL)
 * style: '3d' → CubeRenderer3D Three.js render on off-DOM canvas (full/cross/F2L)
 *
 * setupAlg resolution matches TwistyPlayer experimentalSetupAnchor: 'end':
 *   setupMoves = invertAlg(alg) then apply setupAlg — cube shows the case position
 */

import { CubeState } from './CubeState.js';
import { CubeStickering } from './CubeStickering.js';
import { CubeRenderer2D } from './CubeRenderer2D.js';
import { CubeRenderer3D } from './CubeRenderer3D.js';

export class CubeExporter {
  /**
   * Render the cube as a PNG data URL.
   *
   * @param {string|CubeState} algOrState — alg notation string or pre-built CubeState
   * @param {object} options
   * @param {'2d'|'3d'} options.style       — '2d' = top-down (OLL/PLL), '3d' = Three.js render (full/cross/F2L)
   * @param {string}   [options.stickering] — orbit string mask; omit for full colour
   * @param {string}   [options.setupAlg]   — additional setup alg applied after invertAlg(alg)
   * @param {number}   [options.size=400]   — output canvas size in px
   * @returns {Promise<string>} PNG data URL
   */
  static async toPNG(algOrState, { style = '2d', stickering = null, setupAlg = null, size = 400 } = {}) {
    const { state, setupMoves } = await CubeExporter._resolve(algOrState, setupAlg);
    const visMap = stickering
      ? CubeStickering.fromOrbitStringWithState(stickering, state.toRawPattern())
      : new Map();

    if (style === '3d') return CubeExporter._render3D(state, visMap, setupMoves, size);
    return CubeExporter._render2D(state, visMap, size);
  }

  // ---- Internal helpers ----

  static async _resolve(algOrState, setupAlg) {
    if (algOrState instanceof CubeState) {
      return { state: algOrState, setupMoves: [] };
    }
    const alg = (algOrState ?? '').trim();
    const algMoves = alg ? alg.split(/\s+/).filter(Boolean) : [];
    // setupMoves: first invert the alg (to reach case position), then apply optional setupAlg
    const invMoves = CubeState.invertAlg(algMoves);
    const extraMoves = setupAlg ? setupAlg.trim().split(/\s+/).filter(Boolean) : [];
    const setupMoves = [...invMoves, ...extraMoves];
    const solved = await CubeState.solved();
    const state = solved.applyAlg(setupMoves);
    return { state, setupMoves };
  }

  static _render2D(state, visMap, size) {
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    const renderer = new CubeRenderer2D(null, { size, canvas });
    renderer.update(state, visMap);
    const dataURL = renderer.toDataURL('image/png');
    renderer.destroy();
    return dataURL;
  }

  static async _render3D(state, visMap, setupMoves, size) {
    // Off-DOM canvas: not appended to document — Three.js renders directly to it
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;

    const renderer3d = new CubeRenderer3D({ canvas });
    // mount() needs a container reference for OrbitControls event binding; use a detached div
    const fakeContainer = document.createElement('div');
    fakeContainer.style.width  = `${size}px`;
    fakeContainer.style.height = `${size}px`;
    renderer3d.mount(fakeContainer);
    renderer3d._resize(size, size);

    // Set visual cube state: reset to solved then replay setup moves
    renderer3d.resetToSolved();
    if (setupMoves.length) renderer3d.applyMovesInstant(setupMoves);
    renderer3d.restoreColours();
    if (visMap.size > 0) renderer3d.applyStickering(visMap);

    // Flush one render frame
    renderer3d._renderer.render(renderer3d._scene, renderer3d._camera);

    const dataURL = canvas.toDataURL('image/png');
    renderer3d.unmount();
    return dataURL;
  }
}
