import type { CSSProperties } from 'react';
import {
  MdPlayArrow,
  MdPause,
  MdReplay,
  MdRemove,
  MdAdd,
  MdCenterFocusStrong,
  MdSkipPrevious,
  MdSkipNext,
} from 'react-icons/md';

export interface CubePlayerControlsProps {
  playing: boolean;
  stepIndex?: number;   // current position (0 = start, moveCount = end)
  moveCount?: number;   // total moves in the loaded alg
  speed?: number;
  onPlayToggle: () => void;
  onReset: () => void;
  onStepBackward?: () => void;
  onStepForward?: () => void;
  onCameraReset?: () => void;
  onSpeedChange?: (speed: number) => void;
  style?: CSSProperties;
  className?: string;
}

const SPEED_STEP  = 0.5;
const SPEED_MIN   = 0.5;
const SPEED_MAX   = 3;

const BTN: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 44,
  height: 44,
  borderRadius: 10,
  border: '1px solid #dbdbdb',
  background: '#f5f5f5',
  cursor: 'pointer',
  color: '#363636',
  fontSize: 20,
  flexShrink: 0,
};

const BTN_ACTIVE: CSSProperties = {
  ...BTN,
  background: '#00b89c',
  borderColor: '#00b89c',
  color: '#fff',
};

const BTN_DISABLED: CSSProperties = {
  ...BTN,
  opacity: 0.35,
  cursor: 'default',
};

export function CubePlayerControls({
  playing,
  stepIndex = 0,
  moveCount = 0,
  speed = 1,
  onPlayToggle,
  onReset,
  onStepBackward,
  onStepForward,
  onCameraReset,
  onSpeedChange,
  style,
  className,
}: CubePlayerControlsProps) {
  const stepBackwardDisabled    = playing || stepIndex <= 0;
  const stepForwardDisabled = playing || !moveCount || stepIndex >= moveCount;

  const nudgeSpeed = (delta: number) => {
    if (!onSpeedChange) return;
    const next = Math.round(Math.min(SPEED_MAX, Math.max(SPEED_MIN, speed + delta)) / SPEED_STEP) * SPEED_STEP;
    onSpeedChange(next);
  };

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...style }}
      className={className}
    >
      <button style={BTN} title="Reset" onClick={onReset}>
        <MdReplay />
      </button>

      {onStepBackward && (
        <button style={stepBackwardDisabled ? BTN_DISABLED : BTN} title="Step backward" onClick={onStepBackward} disabled={stepBackwardDisabled}>
          <MdSkipPrevious />
        </button>
      )}

      <button style={BTN_ACTIVE} title={playing ? 'Pause' : 'Play'} onClick={onPlayToggle}>
        {playing ? <MdPause /> : <MdPlayArrow />}
      </button>

      {onStepForward && (
        <button style={stepForwardDisabled ? BTN_DISABLED : BTN} title="Step forward" onClick={onStepForward} disabled={stepForwardDisabled}>
          <MdSkipNext />
        </button>
      )}

      {onSpeedChange && (
        <>
          <button style={BTN} title="Slower" onClick={() => nudgeSpeed(-SPEED_STEP)} disabled={speed <= SPEED_MIN}>
            <MdRemove />
          </button>
          <span style={{ minWidth: 40, textAlign: 'center', fontSize: '0.85rem', color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            ×{speed.toFixed(2).replace(/\.?0+$/, (m) => m === '.00' ? '.0' : '')}
          </span>
          <button style={BTN} title="Faster" onClick={() => nudgeSpeed(SPEED_STEP)} disabled={speed >= SPEED_MAX}>
            <MdAdd />
          </button>
        </>
      )}

      {onCameraReset && (
        <button style={BTN} title="Reset camera" onClick={onCameraReset}>
          <MdCenterFocusStrong />
        </button>
      )}
    </div>
  );
}
