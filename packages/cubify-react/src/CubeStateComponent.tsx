import { useRef, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { CubeState as CubeStateEngine, CubeRenderer3D, CubeStickering, AlgParser } from '@andyjudson/cubify';
import type { CubeTheme, ThemePresetName } from '@andyjudson/cubify';

// AlgParser is permissive (silently extracts any matching chars). Validate that every
// whitespace-separated token in the input is a legal WCA move before applying.
const VALID_MOVE = /^([UDRLFBMESxyz]w?|[udrlf]|b)('|2)?$/;
function isValidAlg(alg: string): boolean {
  const cleaned = alg.replace(/\/\/.*$/gm, '').trim();
  if (!cleaned) return true;
  return cleaned.split(/\s+/).filter(Boolean).every(t => VALID_MOVE.test(t));
}

export interface CubeStateProps {
  alg?: string;
  setup?: string;
  stickering?: string;
  theme?: CubeTheme | ThemePresetName;
  style?: CSSProperties;
  className?: string;
}

export function CubeState({
  alg = '',
  setup = '',
  stickering,
  theme,
  style,
  className,
}: CubeStateProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<InstanceType<typeof CubeRenderer3D> | null>(null);
  const [ready, setReady] = useState(false);

  // Mount / unmount
  useEffect(() => {
    const renderer = new CubeRenderer3D();
    renderer.mount(containerRef.current!);
    rendererRef.current = renderer;
    setReady(true);
    return () => {
      renderer.unmount();
      rendererRef.current = null;
      setReady(false);
    };
  }, []);

  // State — setup + alg inverse applied to solved: shows what the cube looks like before the alg
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    if ((alg && !isValidAlg(alg)) || (setup && !isValidAlg(setup))) {
      console.warn('[CubeState] Invalid alg or setup — showing solved cube.');
      r.resetToSolved();
      return;
    }
    try {
      const setupMoves = setup ? AlgParser.parse(setup) : [];
      const algMoves = alg ? AlgParser.parse(alg) : [];
      const allMoves = [...setupMoves, ...algMoves];
      r.resetToSolved();
      if (allMoves.length) r.applyMovesInstant(CubeStateEngine.invertAlg(allMoves));
    } catch (e) {
      console.warn('[CubeState] Invalid alg or setup — showing solved cube.', e);
      r.resetToSolved();
    }
  }, [alg, setup, ready]);

  // Stickering
  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !stickering) return;
    try {
      const visMap = CubeStickering.fromOrbitStringWithState(stickering, null);
      r.applyStickering(visMap);
    } catch (e) {
      console.warn('[CubeState] Invalid stickering string.', e);
    }
  }, [stickering, ready]);

  // Theme
  useEffect(() => {
    if (theme) rendererRef.current?.setTheme(theme);
  }, [theme]);

  return (
    <div style={style} className={className}>
      {!ready && (
        <div
          className="skeleton-block"
          style={{ width: '100%', height: '100%' }}
        />
      )}
      <div
        ref={containerRef}
        style={{ display: ready ? 'block' : 'none', width: '100%', height: '100%' }}
      />
    </div>
  );
}
