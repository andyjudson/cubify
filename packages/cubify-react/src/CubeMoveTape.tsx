import type { CSSProperties } from 'react';

export interface CubeMoveTapeProps {
  moves: string[];
  stepIndex: number;
  style?: CSSProperties;
  className?: string;
}

export function CubeMoveTape({ moves, stepIndex, style, className }: CubeMoveTapeProps) {
  return (
    <div
      style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap', maxWidth: 640, margin: '0 auto', ...style }}
      className={className}
    >
      {moves.map((mv, i) => {
        const isDone   = i < stepIndex;
        const isActive = i === stepIndex;
        return (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 32,
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              fontWeight: isActive ? 700 : 400,
              padding: '3px 8px',
              borderRadius: 6,
              border: '1px solid',
              background:  isActive ? '#00b89c' : isDone ? '#3a3a3a' : '#f5f5f5',
              borderColor: isActive ? '#00b89c' : isDone ? '#4a4a4a' : '#dbdbdb',
              color:       isActive ? '#fff'    : isDone ? '#aaa'    : '#555',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {mv}
          </span>
        );
      })}
    </div>
  );
}
