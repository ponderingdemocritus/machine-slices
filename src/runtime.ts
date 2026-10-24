// Machine Slices: the shared runtime. renderFrame draws any window of the one machine at any moment,
// as a pure function of its inputs: the seed decides the machine, the time decides its motion, the
// viewport decides what part of the 2000 × 2000 world fills the canvas.
//
//   engine/   validation, deterministic randomness, the clock, geometry
//   world/    the machine as data, built once per seed: heart, vessels, gears, palette
//   render/   Canvas 2D drawing of a world at a moment through a viewport

import { clockAt } from "./engine/rhythm.js";
import { checkCanvasSize, checkFrameOptions, type FrameOptions } from "./engine/validate.js";
import { drawFrame } from "./render/frame.js";
import { buildWorld, type World } from "./world/world.js";

export { BEAT_MS, BREATH_MS, CYCLE_MS } from "./engine/rhythm.js";
export { WORLD_SIZE, type FrameOptions, type Viewport } from "./engine/validate.js";

/** Built worlds, most recent last. A world depends only on its seed, so keeping it changes no pixel. */
const worlds = new Map<string, World>();
const KEEP = 4;

function worldFor(seedHex: string): World {
  let world = worlds.get(seedHex);
  if (world) {
    worlds.delete(seedHex);
  } else {
    world = buildWorld(seedHex);
    if (worlds.size >= KEEP) worlds.delete(worlds.keys().next().value!);
  }
  worlds.set(seedHex, world);
  return world;
}

/**
 * Completely redraws `canvas` (keeping its dimensions) with the machine of `seed` at `timeMs`, the
 * `viewport` of the world stretched over the whole canvas. Throws an Error with the reason, before
 * drawing anything, if an input is invalid.
 */
export function renderFrame(canvas: HTMLCanvasElement, options: FrameOptions): void {
  const { seedHex, timeMs, viewport } = checkFrameOptions(options);
  if (typeof canvas !== "object" || canvas === null || typeof canvas.getContext !== "function") {
    throw new TypeError("canvas must be an HTMLCanvasElement");
  }
  checkCanvasSize(canvas.width, canvas.height);
  // A CPU-backed context: canvases of every size rasterize the same way, so slices match the whole.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas has no 2D context (it may already hold another kind of context)");
  const doc = canvas.ownerDocument;
  const make = (width: number, height: number) => {
    const layer = doc.createElement("canvas");
    layer.width = width;
    layer.height = height;
    return layer;
  };
  drawFrame(ctx, worldFor(seedHex), clockAt(timeMs), viewport, canvas.width, canvas.height, make);
}
