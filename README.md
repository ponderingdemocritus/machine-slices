# Machine Slices — Isobar

**Isobar** is a generative mechanical organism: a pressure vessel, its diaphragm,
four flywheels, and an intake/return circuit drawn as an engraved instrument on
warm paper. A shared phase drives the chamber, reciprocating rods, valves, and
circulation. The work is paused on first opening.

## Run locally

Requires Node.js 22 or later and npm. Installation uses the original, pinned,
registry-only TypeScript and Playwright dependencies; the artwork has no runtime
package dependencies, images, web fonts, or network requests.

```sh
npm ci --ignore-scripts
npm run build
npm start -- --port 4173
```

Open http://127.0.0.1:4173. **Play** advances the shared clock; **Pause** holds it.
The slider and milliseconds field seek immediately and pause playback. Time is
bounded to 0–60,000 ms in the viewer; reaching the end pauses. Play then starts
again at zero. The rendering API accepts any finite, nonnegative time.

**Window A** and **Window B** magnify the adjacent 50 × 80 regions at (950, 960)
and (1000, 960). Click the main artwork to move the inspection window, or focus it
and use the arrow keys; Space toggles playback. These are inspection views of
the same runtime, seed, and clock, not a slice gallery. An invalid preview seed
leaves the last valid artwork visible and reports the expected format. The seed
input is a preview tool; no collection seed or issuance policy is selected here.

## Check

```sh
# Needed only outside the pinned runner:
npx playwright install chromium
npm run check:round1
npm test
```

`check:round1` runs the unchanged published checks, including opaque output,
seed/time determinism, exact crop alignment, input validation, and controls.
`npm test` exercises additional runtime boundaries, pre-draw validation, shared
inspection frames, context isolation, server routing, and responsive controls.
All tests run locally without external requests after installation. The pinned
Hotpod runner already includes its browser.

## Rendering contract and choices

```ts
import { renderFrame } from '/dist/runtime.js';
renderFrame(canvas, {
  seed: '0x' + '11'.repeat(32),
  timeMs: 2137,
  viewport: { x: 0, y: 0, width: 2000, height: 2000 },
});
```

- `src/runtime.ts` validates **all inputs before changing pixels**, resets drawing
  state without changing canvas dimensions, and projects the requested viewport.
- `src/machine.ts` composes the organism in absolute world coordinates.
  `src/drawing.ts` contains its drawing primitives. `src/seed.ts` derives all
  variation from all 32 bytes of the seed. Hexadecimal letter case is equivalent.
- A canonical offscreen world raster is redrawn completely on every call,
  then cropped/scaled onto the supplied canvas. Views at or below world scale
  use 2000 × 2000; magnified views use 4000 × 4000 for finer engraving. Equal
  scales always use the same density. This keeps Canvas
  curve tessellation and clipping from producing different pixels in close
  windows. Magnification uses image smoothing. Each target reuses one backing surface
  (16 MB, or 64 MB for magnification) through a weak reference; no prior
  pixels or simulation values are inputs to the next frame. `OffscreenCanvas`
  and Canvas 2D `reset()` require a modern browser, including the pinned Chromium.
- Each frame is a closed-form function of the seed and explicit time. The seeded
  palette, initial phase, and bearing positions vary; the anatomy remains one
  coherent body. There are no entropy or wall-clock reads in the runtime.
- Drive ratios are fixed. The main phase cycles every 12 seconds, with ratios
  1, −0.8, −2, and 2.5, returning together after 120 seconds. Slider-crank travel
  uses the geometric rod length, rather than an unrelated easing function.
- Only `src/viewer.ts` reads animation timestamps, observes display size, and
  manages controls. Background-tab time is excluded on resuming visibility.
  Playback starts paused, including for reduced-motion preferences.
- The server binds loopback, rejects invalid CLI arguments, serves only the
  index and built JavaScript, and refuses paths outside `dist`.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the fixed interfaces and later rounds.
Round 1 includes no token contract, wallet, mint, or full slice gallery. The
unchanged checks remain under `.launchpad/checks/`.

Software is MIT licensed. The artwork is generated entirely by the code in this
repository, with no third-party creative assets. Separate artwork and collector
rights are addressed in [ARTWORK-RIGHTS.md](ARTWORK-RIGHTS.md); no sale terms or
mainnet deployment are established here.
