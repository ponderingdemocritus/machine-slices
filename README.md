# Machine Slices

One abstract mechanical organism in a 2000 × 2000 world. A paired-gear heart sends signals through curved conduits to flywheels, bellows and pistons, then outward to perimeter bearings. Shared load rails, mounting lugs and a plated spine connect the housings. Metal housings, calibration marks and fasteners carry detail into small windows of the work.

With dependencies installed, run offline:

```sh
npm run build
npm start -- --port 4173
```

Open http://127.0.0.1:4173. The viewer starts paused at zero. Play and Pause control the clock; the number input and slider scrub milliseconds. Space toggles playback when the page background has focus. Apply seed accepts `0x` followed by 64 hexadecimal digits. Invalid input leaves the active seed intact.

Playback wraps at 60 seconds. A two-second beat drives piston strokes and signals moving at 0.6 world units per millisecond; organ responses follow the conduit travel time. Gear speeds follow their tooth ratios, and all rotations close at 60 seconds. Seeds vary metal palettes and organ positions within one anatomical grammar.

`src/runtime.ts` exports synchronous `renderFrame(canvas, { seed, timeMs, viewport })`. Layout generation lives in `src/machine.ts`, drawing in `src/draw.ts`, and browser scheduling in `src/viewer.ts`. All geometry uses world coordinates, with no external assets or runtime dependencies. Slices at scale ≤ 1 are cut from a whole-world buffer so they match the whole work pixel for pixel; zoomed views draw vectors directly.

```sh
npm test
npm run check:round1
```

Software is MIT licensed. Artwork rights are described separately in ARTWORK-RIGHTS.md.
