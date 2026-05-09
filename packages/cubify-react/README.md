# @andyjudson/cubify-react

React wrappers for [@andyjudson/cubify](https://github.com/andyjudson/cubify) — drop-in `<CubePlayer>` and `<CubeState>` components with full TypeScript support.

## Installation

```bash
npm install @andyjudson/cubify-react @andyjudson/cubify
```

Requires peer dependencies: `react ^18 || ^19`, `react-dom`, `react-icons ^5`

## Components

### `<CubePlayer>`

Animated algorithm player with playback controls.

```tsx
import { CubePlayer } from '@andyjudson/cubify-react';
import type { CubePlayerHandle } from '@andyjudson/cubify-react';

const ref = useRef<CubePlayerHandle>(null);

<CubePlayer
  ref={ref}
  alg="R U R' U'"
  setup="z2 F R U R' U' F'"
  stickering="oll-face-dim"
  theme="speed-dark"
  playing={playing}
  speed={1}
  onMove={({ index, move }) => setStep(index)}
  onComplete={() => setPlaying(false)}
  style={{ width: 300, height: 300 }}
/>
```

`CubePlayerHandle` ref: `reset()`, `resetCamera()`, `jumpTo(n)`, `stepForward()`, `stepBackward()`

### `<CubeState>`

Static cube render from an alg string.

```tsx
import { CubeState } from '@andyjudson/cubify-react';

<CubeState alg={scramble} theme="speed-dark" style={{ width: 120, height: 120 }} />
```

### `<CubePlayerControls>`

Playback controls bar (play/pause, step, speed, camera reset).

```tsx
import { CubePlayerControls } from '@andyjudson/cubify-react';

<CubePlayerControls
  playing={playing}
  stepIndex={stepIndex}
  moveCount={moves.length}
  speed={speed}
  onPlayToggle={() => setPlaying(p => !p)}
  onStepForward={() => ref.current?.stepForward()}
  onStepBackward={() => ref.current?.stepBackward()}
  onReset={() => ref.current?.reset()}
  onCameraReset={() => ref.current?.resetCamera()}
  onSpeedChange={setSpeed}
/>
```

### `<CubeMoveTape>`

Move-by-move progress indicator.

```tsx
import { CubeMoveTape } from '@andyjudson/cubify-react';

<CubeMoveTape moves={moves} stepIndex={stepIndex} />
```

## Source

[github.com/andyjudson/cubify](https://github.com/andyjudson/cubify)
