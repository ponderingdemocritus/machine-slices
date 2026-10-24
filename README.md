# Machine Slices — The Tidal Engine

A mechanical organism drawn in ink, verdigris and copper on an ivory field. A crescent carapace shelters the turning heart; intake bellows, satellite rotors and a return reservoir share its rhythm. The two heart studies are adjacent windows into the same 2000 × 2000 world.

## Run

Requires Node.js 22 or later and npm.

```sh
npm ci --ignore-scripts
npm run build
npm start -- --port 4173
```

Open http://127.0.0.1:4173. The artwork starts paused at 0 ms with seed `0x` followed by `11` repeated 32 times. Play advances to 60000 ms and stops; playing from the end restarts at zero. Pause holds the current frame. Use the slider or exact millisecond field to seek. Reset returns to zero. Apply a seed, or press Enter in the seed field, to change its structure and phase at the selected time. Invalid input leaves the artwork intact and displays a reason. Switching away from the tab pauses playback.

The server listens only on loopback and serves the viewer and compiled JavaScript modules. Installation uses the locked registry dependencies with scripts disabled. Building and viewing require no network, external assets, fonts or WebGL.

## The mechanism

A shaft makes one revolution every twelve seconds. The intake and pressure gauge breathe twice per revolution; the reservoir follows with a quarter-cycle delay. Satellite rotors turn at fixed ratios, signals circulate through the conduits, and the heart shutters counter-rotate at half speed. The complete mechanism repeats after twenty-four seconds. Seeds determine the shaft's starting phase, carapace rib count, flywheel aperture count and paper markings. Every seed byte participates.

All motion is evaluated analytically from the supplied time. There is no accumulated simulation, frame counter or random call in the renderer. The viewer alone reads animation timestamps. Starting paused also respects viewers who prefer reduced motion.

## Shared runtime

```js
const { renderFrame } = await import('/dist/runtime.js');
const canvas = document.createElement('canvas');
canvas.width = 250;
canvas.height = 400;
renderFrame(canvas, {
  seed: '0x' + '11'.repeat(32),
  timeMs: 2137,
  viewport: { x: 950, y: 960, width: 50, height: 80 }
});
document.body.append(canvas);
```

Use `x: 1000` for its right-hand neighbour, or `{ x: 0, y: 0, width: 2000, height: 2000 }` for the whole machine. Both heart studies in the viewer use this exact export; they are fixed inspection views, not a collection gallery.

- `src/runtime.ts`: validates requests before drawing; maps world coordinates into the canvas. It resets the context, including any caller clip, without changing canvas dimensions.
- `src/seed.ts`: derives immutable drawing parameters from all 32 seed bytes.
- `src/machine.ts`: composition, layers and phase relationships in world units.
- `src/drawing.ts`: a small set of Canvas 2D drawing primitives and the shared palette.
- `src/viewer.ts`: inputs, accessible transport state and animation scheduling.

Canvas can rasterize a Bézier differently when its bounds are clipped. The runtime therefore renders on a canonical grid of 1024-pixel tiles with sixteen pixels of bleed, copying only tile interiors. At equal scale, whole views and slices use exactly the same rasterization bounds. Detail does not change with viewport size. The temporary surface is an `OffscreenCanvas`; it has no retained state between calls. This requires a modern browser with Canvas 2D `reset()` and `OffscreenCanvas`, as provided by the pinned runner. Non-square canvases map the requested viewport to the full canvas, including independent horizontal and vertical scales.

## Checks

```sh
# Outside the pinned runner, install Chromium once:
npx playwright install chromium

npm run check:round1
npm test
```

The pinned runner already includes Chromium. Set `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` when running the additional tests there. The official checks cover opaque rendering, reproducibility, animation, seeds, validation, crop correspondence, controls and offline operation. Additional tests cover zoomed adjoining slices at all four inspection times, caller context isolation, invalid-request atomicity, uppercase seeds, extreme finite times, UI recovery, playback limits, mobile overflow, and the server's path and CLI boundaries.

The official gate must run against a committed tree. Its script, transcript and inspection screenshots belong outside this repository; none is part of the artwork.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the collection's later rounds. This version implements the shared machine and viewer only. Software is MIT licensed; [ARTWORK-RIGHTS.md](ARTWORK-RIGHTS.md) addresses artwork rights.
