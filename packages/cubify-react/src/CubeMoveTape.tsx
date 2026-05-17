import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';

export interface CubeMoveTapeProps {
  moves: string[];
  stepIndex: number;
  rowSize?: number;
  style?: CSSProperties;
  className?: string;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 600px)');
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

export function CubeMoveTape({ moves, stepIndex, rowSize, style, className }: CubeMoveTapeProps) {
  const isMobile = useIsMobile();
  const resolvedRowSize = rowSize ?? (isMobile ? 9 : 12);
  const tolerance = isMobile ? 0 : 2;
  const effectiveRowSize = moves.length <= resolvedRowSize + tolerance ? moves.length : resolvedRowSize;
  const rows: string[][] = [];
  for (let i = 0; i < moves.length; i += effectiveRowSize) {
    rows.push(moves.slice(i, i + effectiveRowSize));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, ...style }} className={className}>
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
          {row.map((mv, colIdx) => {
            const i        = rowIdx * effectiveRowSize + colIdx;
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
