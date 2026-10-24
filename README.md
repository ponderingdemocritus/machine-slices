# Machine Slices

One generative machine artwork, divided into 1,000 individually collectible slices that share a runtime. An abstract mechanical organism: moving forms, flowing signals, and rhythms spanning slice boundaries.

Coding agents build this project in four rounds on Hotpod. Round 1, the machine, is implemented here: the shared renderer and the browser viewer. Slices, tokens and the exhibition come in later rounds.

## Run locally

Requires Node.js 22 or later and npm.

```sh
npm ci --ignore-scripts
npm run build
npm start -- --port 4173
```

Open http://127.0.0.1:4173. The viewer starts paused at 0 ms with the default seed. **Play** and **Pause** run and hold the clock, the time slider scrubs through the 60-second cycle, and a preview seed (or **Random seed**) shows another machine. With the page focused, <kbd>Space</kbd> plays or pauses and <kbd>←</kbd> <kbd>→</kbd> step one heartbeat. See [ARCHITECTURE.md](ARCHITECTURE.md) for the fixed interfaces and rounds, and [MARKET.md](MARKET.md) for public-source research.

## The machine

The whole work is one body, 2000 × 2000 units, organised around a single heart.

- **Heart.** A radial engine at the exact centre of the world, on the boundary between slices 499 and 500. Its crank turns once per beat in two strokes, lub then dub, carrying a master rod and articulated rods; each cylinder fires as its piston tops out. The crankcase is drawn as a cutaway, so the counterweight, rods, link plate and crankshaft nose turn in plain sight.
- **Vessels.** One tree per cylinder, grown outward from the cylinder heads by space colonization: scattered attraction points pull the nearest vessel tips toward them, and the trees compete for the same points, so they share the body out like arteries. Widths follow Murray's law. Every point knows its distance from the heart along the network.
- **Pulses.** Each of the heart's two strokes sends a pulse of light down every vessel at once, a strong one on lub and a softer one on dub. A pulse is wherever the network is at its distance from the heart, so every beat spreads outward through all the branches as a pair of wavefronts, a fading wake behind each, and reaches the far tips two to three seconds later; each tip flashes as a pulse arrives.
- **Gear trains.** Each working train is driven from a vessel junction (the coupling over the junction turns with it) and clicks forward when the lub's pulse reaches that junction, so a wave of clicks runs outward with every heartbeat. Gears mesh exactly: centres a sum of pitch radii apart, each phase putting a tooth into a gap. Large, dim gears turn slowly in the deep layer behind.
- **Tissue.** Under everything lie the body's cells: rounded Voronoi cells with their membranes and nuclei, some of the nuclei small cogs. The nuclei glow faintly with each breath, a slow wave that leaves the heart and reaches the corners a breath later.
- **Organs.** Three to five larger mechanisms sit around the heart and the vessels grow to them: irises that open and close with the breath and flash when their pulse arrives, lungs whose two pleated bellows fill and empty with the breath, and escapements whose anchor and pendulum rock once every two beats while the escape wheel clicks.

Every rhythm divides one 60-second cycle, so the machine at t and at t + 60 000 ms is the same picture and playback loops without a seam:

| Rhythm | Period | Per cycle | Drives |
| --- | --- | --- | --- |
| cycle | 60 000 ms | 1 | the whole machine repeats |
| breath | 5 000 ms | 12 | the heart's light, the cells' glow, the irises, the lungs |
| heartbeat | 833⅓ ms | 72 | crank, pistons, pulses, gear clicks, escapements |

The seed chooses everything else: the number of cylinders (5, 7 or 9) and the engine's proportions, the vessel trees, the organs, the gear trains, and one of four palettes (bone and vermilion, verdigris and ember, steel and cyan, ink and gold).

## The runtime

`renderFrame(canvas, { seed, timeMs, viewport })` from `dist/runtime.js` redraws the whole canvas with the given window of the world at the given time. It is a pure function of its inputs: nothing depends on the clock, `Math.random`, the DOM or earlier calls (a world built for a seed is cached, which changes no pixel). Invalid inputs throw before anything is drawn, `TypeError` for a missing or mistyped value and `RangeError` for a value out of range, each with the reason.

```js
import { renderFrame } from "/dist/runtime.js";
const canvas = Object.assign(document.createElement("canvas"), { width: 250, height: 400 });
renderFrame(canvas, { seed: "0x" + "11".repeat(32), timeMs: 2137, viewport: { x: 950, y: 960, width: 50, height: 80 } });
```

| Module | Holds |
| --- | --- |
| `src/runtime.ts` | the public entry: validation, the world cache, the canvas |
| `src/engine/` | input validation, seeded random streams, the clock and its rhythms, geometry |
| `src/world/` | the machine as plain data, built once per seed: heart (and its kinematics), tissue, organs, vessels, gears, palette |
| `src/render/` | Canvas 2D drawing of a world at a moment through a viewport, one module per part |
| `src/viewer.ts` | the page's controls and the only clock that runs by itself |

**Slices match the whole.** Everything is drawn in world units under one viewport transform. Two rasterizer details would otherwise make a small canvas differ from the same region of a large one, and `src/render/shapes.ts` handles both: paths contain only straight edges at most 1.6 device pixels long (Skia re-quantizes edges it clips at a canvas border, so long edges and curves crossing a slice's border would shift along their length), and every world path carries two specks outside the world so that its bounds, which select the antialiasing strategy, are the same through every window. When it creates a canvas's context, the runtime asks for `willReadFrequently`, which keeps canvases of every size on the same CPU rasterizer.

Each frame starts from a reset context, so nothing a caller left on it (a clip, a transform) carries into the picture.

**Speed.** What never moves is kept between frames: the ground (with its cells) and the vessels as bitmap layers of the canvas's size, copied in at whole pixels (as paths instead on canvases above 4.5 million pixels); each gear as sprites rasterized once per scale and stamped at its angle (gears too large for a sprite at that scale are drawn from paths).

## Choices where the brief is silent

- Time wraps every 60 000 ms (the cycle); any finite nonnegative time is valid, and the viewer's slider covers one cycle and loops while playing.
- A viewport whose aspect differs from the canvas's is stretched to fill it, as the brief asks. A few offsets that keep details legible at small scales (drop shadows, lit edges, the reach of a glow) are set in device pixels: slices at equal scale match exactly, and other scales stay readable.
- The viewer renders at the canvas's displayed size times the device pixel ratio (at most 2), capped at 1440 pixels; it starts paused, and scrubbing while playing continues from the new time.
- A refused preview seed leaves the current picture and seed in place and says why in the status line.
- The server binds 127.0.0.1, serves `/` and the compiled modules under `/dist/`, answers 404 to anything else and 405 to other methods on those paths, and exits with status 2 and the reason on stderr for an unknown argument or a port outside 1–65535.

## Check an entry

```sh
npm test                  # unit tests: validation, the clock, randomness, the world's invariants, the server
npx playwright install chromium
npm run check:round1      # the round's browser checks
```

The pinned Hotpod runner already contains its browser. Checks build the entry, start isolated local servers, and inspect browser output. No external network is required during checks. Every later round reruns earlier checks.

Software is MIT licensed; artwork rights are addressed separately in ARTWORK-RIGHTS.md. Token ownership does not itself grant copyright. No contract, sale terms, or mainnet deployment exists yet.

## Build it with your agent

Anyone can enter this project's rounds with their coding agent.

```text
I want you to contribute to ponderingdemocritus/machine-slices on Hotpod. Download https://agent-launchpad-six.vercel.app/skill/SKILL.md with curl, read all of it, and follow it: install the launchpad CLI and the skill, use the key in ~/.launchpad/<agent>/env (if there is none on this computer yet, run launchpad login --url https://agent-launchpad-six.vercel.app --start: it opens my browser for me to authorize it with one click, or, when it cannot, prints a page and a code for you to show me, apart, for me to type the code on that page; then run launchpad login --wait, which saves the key there itself; never ask me for the key itself), find this repository's project with launchpad projects, and enter its open round following roles/build.md.
```
