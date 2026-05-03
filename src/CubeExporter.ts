/**
 * CubeExporter — PNG export for both 2D top-down and 3D rendered views.
 *
 * CubeExporter.toPNG(algOrState, options) → Promise<string>  (data URL)
 *
 * style: '2d' → CubeRenderer2D top-down perspective (OLL/PLL)
 * style: '3d' → CubeRenderer3D Three.js render on off-DOM canvas
 */

import { CubeState } from './CubeState.js';
import { CubeStickering, type VisMap } from './CubeStickering.js';
import { CubeRenderer2D } from './CubeRenderer2D.js';
import { CubeRenderer3D } from './CubeRenderer3D.js';

export interface ExportOptions {
  style?: '2d' | '3d';
  stickering?: string | null;
  setupAlg?: string | null;
  size?: number;
}

export class CubeExporter {
  static async toPNG(algOrState: string | CubeState, { style = '2d', stickering = null, setupAlg = null, size = 400 }: ExportOptions = {}): Promise<string> {
    const { state, setupMoves } = await CubeExporter._resolve(algOrState, setupAlg);
    const visMap: VisMap = stickering
      ? CubeStickering.fromOrbitString(stickering)
      : new Map();

    if (style === '3d') return CubeExporter._render3D(state, visMap, setupMoves, size);
    return CubeExporter._render2D(state, visMap, size);
  }

  static async _resolve(algOrState: string | CubeState | null, setupAlg: string | null): Promise<{ state: CubeState; setupMoves: string[] }> {
    if (algOrState instanceof CubeState) {
      return { state: algOrState, setupMoves: [] };
    }
    const alg      = (algOrState ?? '').trim();
    const algMoves = alg ? alg.split(/\s+/).filter(Boolean) : [];
    const invMoves = CubeState.invertAlg(algMoves);
    const extraMoves = setupAlg ? setupAlg.trim().split(/\s+/).filter(Boolean) : [];
    const setupMoves = [...invMoves, ...extraMoves];
    const solved = await CubeState.solved();
    const state  = solved.applyAlg(setupMoves);
    return { state, setupMoves };
  }

  private static _render2D(state: CubeState, visMap: VisMap, size: number): string {
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    const renderer = new CubeRenderer2D(null, { size, canvas });
    renderer.update(state, visMap);
    const dataURL = renderer.toDataURL('image/png');
    renderer.destroy();
    return dataURL;
  }

  private static async _render3D(_state: CubeState, visMap: VisMap, setupMoves: string[], size: number): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;

    const renderer3d = new CubeRenderer3D({ canvas });
    const fakeContainer = document.createElement('div');
    fakeContainer.style.width  = `${size}px`;
    fakeContainer.style.height = `${size}px`;
    renderer3d.mount(fakeContainer);

    renderer3d.resetToSolved();
    if (setupMoves.length) renderer3d.applyMovesInstant(setupMoves);
    renderer3d.restoreColours();
    if (visMap.size > 0) renderer3d.applyStickering(visMap);

    const dataURL = renderer3d.snapshotAt(size);
    renderer3d.unmount();
    return dataURL;
  }
}
