# Implementation Plan — Feature 029: cubify-react

## Technical Context

| Item | Value |
|------|-------|
| Feature | 029 — cubify-react |
| Prerequisites | 027 (tests ✅), 028 (library API ✅) |
| Target repo | `cfop-app` (React 19, TypeScript 5.9, Vite 7) |
| Component location | `cfop-app/src/lib/cubify/` |
| Cubify import path | Vite alias `cubify` → `../../../cubify/src/index.ts` |
| React version | 19.2 |
| React pattern | `useRef` + `useEffect`; separate effect per reactive prop |
| Testing | No Vitest unit tests; validate manually in harness then in cfop-app |
| Frameworks in cubify core | None — React components stay in cfop-app (constitution) |

---

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| No React in core library | ✅ PASS | Components live in cfop-app, not cubify/src/ |
| Harness-first development | ✅ PASS | Validate component mount/unmount in harness test page before cfop-app wiring |
| No IntersectionObserver | ✅ PASS | CubePlayer/Renderer3D don't use IntersectionObserver |
| Mask travels with cubelet | ✅ PASS | CubeState applies stickering after setState(); never in animation callbacks |
| Physical simulation | ✅ PASS | CubeState calls setState() once; CubePlayer delegates all animation to CubePlayer engine |
| cubing.js hidden from consumers | ✅ PASS | React components import from 'cubify' only; no cubing.js imports |

---

## Phase 0: Research Summary

Decisions are fully documented in `research.md`. Key outcomes:

1. **Location**: `cfop-app/src/lib/cubify/` — constitution-compliant, closest to consumers
2. **Import**: Vite alias `cubify` → cubify/src/index.ts — clean import, zero migration cost when library is published
3. **Pattern**: `useRef + useEffect`; mount effect + separate effect per prop dependency
4. **StrictMode**: Idempotent dispose; null check on ref before constructing
5. **Testing**: No Vitest unit tests; validate via manual test page and Playwright E2E
6. **`playing` prop**: Edge-triggered (false→true = play, true→false = pause)
7. **`stepIndex` prop**: Controlled only; consumer owns step state

---

## Phase 1: Design

### Artifacts

- `data-model.md` — prop interfaces + effect dependency map + file layout ✅
- `contracts/CubePlayerComponent.ts` — full prop interface + behavioural contract ✅
- `contracts/CubeStateComponent.ts` — full prop interface + behavioural contract ✅
- `quickstart.md` — 4 usage scenarios + 7 independent test criteria ✅

---

## Implementation Overview

### Files to create

```
cfop-app/src/lib/cubify/
├── CubePlayerComponent.tsx    — <CubePlayer> wrapper
├── CubeStateComponent.tsx     — <CubeState> wrapper
└── index.ts                   — export { CubePlayer, CubeState }
```

### Files to modify

```
cfop-app/vite.config.ts        — add resolve.alias { cubify: ... }
cfop-app/tsconfig.json         — add compilerOptions.paths { "cubify": [...] }
```

### No changes to

```
cubify/src/             — core library unchanged
cubify/types/           — type declarations unchanged
cubify-harness/         — harness unchanged (used for validation only)
```

---

## Component Skeletons

### CubePlayerComponent.tsx

```tsx
import { useRef, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { CubePlayer } from 'cubify';
import type { CubeTheme, ThemePresetName } from 'cubify';

interface MoveEvent { index: number; move: string; }

interface CubePlayerProps {
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

export function CubePlayer(props: CubePlayerProps) {
  const { alg = '', setup = '', anchor = 'end', stickering, theme,
          playing = false, speed = 1, stepIndex,
          onMove, onComplete, onReset, style, className } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<InstanceType<typeof CubePlayer> | null>(null);
  const [ready, setReady] = useState(false);

  // Mount / unmount
  useEffect(() => {
    const player = new CubePlayer();
    player.mount(containerRef.current!);
    playerRef.current = player;
    setReady(true);
    return () => { player.dispose?.(); playerRef.current = null; setReady(false); };
  }, []);

  // Alg
  useEffect(() => {
    playerRef.current?.loadAlg(alg, setup, { anchor });
  }, [alg, setup, anchor]);

  // Stickering
  useEffect(() => {
    if (stickering) playerRef.current?.setStickering(stickering);
  }, [stickering]);

  // Theme
  useEffect(() => {
    if (theme) playerRef.current?.renderer.setTheme(theme);
  }, [theme]);

  // Playing
  useEffect(() => {
    if (playing) playerRef.current?.play();
    else playerRef.current?.pause();
  }, [playing]);

  // Speed
  useEffect(() => {
    playerRef.current?.setSpeed(speed);
  }, [speed]);

  // StepIndex (controlled)
  useEffect(() => {
    if (stepIndex !== undefined) playerRef.current?.jumpTo(stepIndex);
  }, [stepIndex]);

  // Events
  const handleMove = useCallback((e: MoveEvent) => onMove?.(e), [onMove]);
  const handleComplete = useCallback(() => onComplete?.(), [onComplete]);
  const handleReset = useCallback(() => onReset?.(), [onReset]);

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
      {!ready && <div className="skeleton-block" style={{ width: '100%', height: '100%' }} />}
      <div ref={containerRef} style={{ display: ready ? 'block' : 'none', width: '100%', height: '100%' }} />
    </div>
  );
}
```

### CubeStateComponent.tsx

```tsx
import { useRef, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { CubeRenderer3D, CubeState, CubeStickering, AlgParser } from 'cubify';
import type { CubeTheme, ThemePresetName } from 'cubify';

interface CubeStateProps {
  alg?: string;
  setup?: string;
  stickering?: string;
  theme?: CubeTheme | ThemePresetName;
  style?: CSSProperties;
  className?: string;
}

export function CubeStateComponent({ alg = '', setup = '', stickering, theme, style, className }: CubeStateProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<InstanceType<typeof CubeRenderer3D> | null>(null);
  const solvedRef   = useRef<InstanceType<typeof CubeState> | null>(null);
  const [ready, setReady] = useState(false);

  // Mount / unmount
  useEffect(() => {
    let renderer: InstanceType<typeof CubeRenderer3D>;
    CubeState.solved().then(solved => {
      solvedRef.current = solved;
      renderer = new CubeRenderer3D();
      renderer.mount(containerRef.current!);
      rendererRef.current = renderer;
      setReady(true);
    });
    return () => { renderer?.dispose?.(); rendererRef.current = null; solvedRef.current = null; setReady(false); };
  }, []);

  // State (alg + setup)
  useEffect(() => {
    const r = rendererRef.current;
    const solved = solvedRef.current;
    if (!r || !solved) return;
    const moves = AlgParser.parse(setup + ' ' + alg).filter(Boolean);
    const state = solved.applyAlg(CubeState.invertAlg(moves));
    r.setState(state);
  }, [alg, setup]);

  // Stickering
  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !stickering) return;
    const visMap = CubeStickering.fromOrbitStringWithState(stickering, null);
    r.applyStickering(visMap);
  }, [stickering]);

  // Theme
  useEffect(() => {
    if (theme) rendererRef.current?.setTheme(theme);
  }, [theme]);

  return (
    <div style={style} className={className}>
      {!ready && <div className="skeleton-block" style={{ width: '100%', height: '100%' }} />}
      <div ref={containerRef} style={{ display: ready ? 'block' : 'none', width: '100%', height: '100%' }} />
    </div>
  );
}
```

---

## Validation Plan

1. Create a minimal test page (or add to cubify-harness) that renders both components
2. Verify mount/unmount cycle (open DevTools → Performance → no orphaned rAF)
3. Verify alg prop change reloads the animation
4. Verify theme switching applies without remount
5. Verify stickering applies correctly (OLL mask on Sune case)
6. Wire into cfop-app VisualizerModal (feature 031 scope) — component works in real context

---

## Dependency on Feature 031

Feature 029 delivers the components; Feature 031 wires them into cfop-app, replacing TwistyPlayer in:
- `VisualizerModal.tsx` — replace with `<CubePlayer>`
- `ScrambleCubePreview.tsx` — replace with `<CubeState>`

These replacements are out of scope for 029.
