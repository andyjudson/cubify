import type { CSSProperties } from 'react';

export interface CubeMoveTapeProps {
  moves: string[];
  stepIndex: number;
  rowSize?: number;
  style?: CSSProperties;
  className?: string;
}

export function CubeMoveTape({ moves, stepIndex, rowSize = 12, style, className }: CubeMoveTapeProps) {
  const effectiveRowSize = moves.length <= rowSize + 2 ? moves.length : rowSize;
  const rows: string[][] = [];
  for (let i = 0; i < moves.length; i += effectiveRowSize) {
    rows.push(moves.slice(i, i + effectiveRowSize));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, ...style }} className={className}>
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
          {row.map((mv, colIdx) => {
            const i        = rowIdx * rowSize + colIdx;
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
                  background:  isActive ? '#00b89c' : isDone ? '#3a3a3a' : 'var(--bulma-primary-dark)',
                  borderColor: isActive ? '#00b89c' : isDone ? '#4a4a4a' : 'var(--bulma-primary-25)',
                  color:       isActive ? '#fff'    : isDone ? '#aaa'    : 'var(--bulma-primary-dark-invert)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {mv}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
