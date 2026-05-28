import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import type { CSSProperties } from 'react';
import { CubePlayer as CubePlayerEngine } from '@andyjudson/cubify';
import type { CubeTheme, ThemePresetName, MoveEventData } from '@andyjudson/cubify';

export interface MoveEvent {
  index: number;
  move: string;
}

export interface CubePlayerHandle {
  reset: () => void;
  resetCamera: () => void;
  jumpTo: (n: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
  setInternals: (enabled: boolean) => void;
}

export interface CubePlayerProps {
  alg?: string;
  setup?: string;
  anchor?: 'start' | 'end';
  stickering?: string;
  theme?: CubeTheme | ThemePresetName;
  playing?: boolean;
  speed?: number;
  stepIndex?: number;
  onMove?: (e: MoveEvent) => void;
  onComplete?: () => void;
  onReset?: () => void;
  style?: CSSProperties;
  className?: string;
}

export const CubePlayerComponent = forwardRef<CubePlayerHandle, CubePlayerProps>(function CubePlayerComponent(
  {
    alg = '',
    setup = '',
    anchor = 'end',
    stickering,
    theme,
    playing = false,
    speed = 1,
    stepIndex,
    onMove,
    onComplete,
    onReset,
    style,
    className,
  },
  ref,
) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const playerRef       = useRef<InstanceType<typeof CubePlayerEngine> | null>(null);
  const prevPlayingRef  = useRef<boolean | null>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    reset:        () => playerRef.current?.reset(),
    resetCamera:  () => playerRef.current?.renderer.resetCamera(),
    jumpTo:       (n: number) => playerRef.current?.jumpTo(n),
    stepForward:  () => playerRef.current?.stepForward(),
    stepBackward: () => playerRef.current?.stepBackward(),
    setInternals: (enabled: boolean) => playerRef.current?.setInternals(enabled),
  }), []);

  // Mount / unmount
  useEffect(() => {
    const player = new CubePlayerEngine(containerRef.current!);
    playerRef.current = player;
    setReady(true);
    return () => {
      player.renderer.unmount();
      playerRef.current = null;
      setReady(false);
    };
  }, []);

  // Alg — fire-and-forget; null guard in CubePlayer._playNext covers the CubeState.solved() race
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    try {
      player.loadAlg(alg, setup || null, { anchor });
    } catch (e) {
      console.warn('[CubePlayer] Invalid alg or setup — showing solved cube.', e);
      player.loadAlg('', null, { anchor });
    }
  }, [alg, setup, anchor]);

  // Stickering
  useEffect(() => {
    playerRef.current?.setStickering(stickering ?? null);
  }, [stickering]);

  // Theme — also toggle internals when the 'internals' preset is selected/deselected
  useEffect(() => {
    if (theme) {
      playerRef.current?.renderer.setTheme(theme);
      playerRef.current?.setInternals(theme === 'internals');
    }
  }, [theme]);

  // Playing — only act on actual transitions; never call pause() on initial mount
  useEffect(() => {
    if (!ready) return;
    const prev = prevPlayingRef.current;
    prevPlayingRef.current = playing;
    if (playing && prev !== true) playerRef.current?.play();
    else if (!playing && prev === true) playerRef.current?.pause();
  }, [playing, ready]);

  // Speed
  useEffect(() => {
    playerRef.current?.setSpeed(speed);
  }, [speed]);

  // Controlled step
  useEffect(() => {
    if (stepIndex !== undefined) playerRef.current?.jumpTo(stepIndex);
  }, [stepIndex]);

  // Events
  const handleMove = useCallback(
    (data: MoveEventData | Record<string, never>) => {
      if (onMove && 'move' in data) onMove({ index: data.index, move: data.move });
    },
    [onMove],
  );
  const handleComplete = useCallback(
    (_data: MoveEventData | Record<string, never>) => onComplete?.(),
    [onComplete],
  );
  const handleReset = useCallback(
    (_data: MoveEventData | Record<string, never>) => onReset?.(),
    [onReset],
  );

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    p.on('move', handleMove);
    p.on('complete', handleComplete);
    p.on('reset', handleReset);
    return () => {
      p.off('move', handleMove);
      p.off('complete', handleComplete);
      p.off('reset', handleReset);
    };
  }, [handleMove, handleComplete, handleReset]);

  return (
    <div style={style} className={className}>
      {!ready && (
        <div className="skeleton-block" style={{ width: '100%', height: '100%' }} />
      )}
      <div
        ref={containerRef}
        style={{ display: ready ? 'block' : 'none', width: '100%', height: '100%' }}
      />
    </div>
  );
});
