# Changelog

## v1.1.0 — 2026-05-09

### Added
- `CubePlayer.stepForward()` — animate one move forward (single-step, no play loop)
- `CubePlayer.stepBackward()` — animate the inverse of the last move
- `CubePlayerHandle` ref now exposes `stepForward` and `stepBackward`
- `CubePlayerControls`: `stepIndex` / `moveCount` props replace `stepBackDisabled` / `stepForwardDisabled` — disabled state now computed internally

### Fixed
- `CubePlayer.pause()` syncs `_stepIndex` when pausing mid-animation, preventing step-backward from undoing the wrong move after play → pause
- `AlgParser`: handle `Rn` notation (`R3` → `R'`, `R4` → identity, `R1` → `R`) — fixes parsing of older TwistyPlayer-style alg JSON
- `CubeState.setupFromAlg()`: use `AlgParser.parse()` instead of `.split(' ')` — correctly handles parenthesised notation

### Changed
- `DEFAULT_THEME` gap: `0.005` → `0.030`

---

## v1.0.0 — 2026-05-07

Initial release.

- `CubeState`, `CubeRenderer3D`, `CubeRenderer2D`, `CubePlayer`, `CubeStickering`, `CubeExporter`, `CubeScramble`, `AlgParser`, `CubeTheme`
- React package: `<CubePlayer>`, `<CubeState>`, `<CubePlayerControls>`, `<CubeMoveTape>`
- 15 CFOP stickering presets
- 4 theme presets: `default`, `rubiks`, `speed-dark`, `speed-light`
- Published to GitHub Packages as `@andyjudson/cubify` and `@andyjudson/cubify-react`
