import { drawMachine } from './machine.js';

export interface Viewport { x: number; y: number; width: number; height: number }
export interface FrameOptions { seed: string; timeMs: number; viewport: Viewport }

/** Validate the whole request before acquiring or changing the drawing context. */
function validate(canvas: HTMLCanvasElement, options: FrameOptions): void {
  if (!canvas || !Number.isInteger(canvas.width) || !Number.isInteger(canvas.height) || canvas.width <= 0 || canvas.height <= 0 || typeof canvas.getContext !== 'function') {
    throw new Error('Canvas must have positive integer dimensions and a 2D context.');
  }
  if (!options || typeof options !== 'object') throw new Error('Frame options are required.');
  if (typeof options.seed !== 'string' || !/^0x[0-9a-f]{64}$/i.test(options.seed)) {
    throw new Error('Seed must be 0x followed by exactly 64 hexadecimal digits.');
  }
  if (typeof options.timeMs !== 'number' || !Number.isFinite(options.timeMs) || options.timeMs < 0) {
    throw new Error('Time must be a finite, nonnegative number of milliseconds.');
  }
  const v = options.viewport;
  if (!v || typeof v !== 'object' || ![v.x, v.y, v.width, v.height].every(n => typeof n === 'number' && Number.isFinite(n)) ||
      v.x < 0 || v.y < 0 || v.width <= 0 || v.height <= 0 || v.x + v.width > 2000 || v.y + v.height > 2000) {
    throw new Error('Viewport must have nonnegative origins and positive extents within the 2000 × 2000 world.');
  }
}

// Allocation reuse only: each call resets and redraws the entire surface. No pixels or
// simulation values from an earlier frame are inputs to a later one.
const surfaces = new WeakMap<HTMLCanvasElement, OffscreenCanvas>();

/**
 * A canonical world raster keeps curve tessellation and antialiasing independent
 * of viewport clipping. Equal-scale views choose the same density. Magnified
 * inspection gets a 2x world raster for finer engraved detail.
 */
export function renderFrame(canvas: HTMLCanvasElement, options: FrameOptions): void {
  validate(canvas, options);
  const c = canvas.getContext('2d');
  if (!c) throw new Error('A Canvas 2D context is required.');
  const v = options.viewport;
  const density = Math.max(canvas.width / v.width, canvas.height / v.height) > 1 ? 2 : 1;
  const side = 2000 * density;
  let surface = surfaces.get(canvas);
  if (!surface || surface.width !== side) {
    surface = new OffscreenCanvas(side, side);
    surfaces.set(canvas, surface);
  }
  const world = surface.getContext('2d');
  if (!world) throw new Error('An offscreen Canvas 2D context is required.');
  world.reset();
  world.scale(density, density);
  drawMachine(world, options.seed, options.timeMs);
  // reset() removes prior clipping and drawing state without resizing the canvas.
  c.reset();
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  // Canvas implementations round source rectangles to float precision. Preserve an
  // opaque sample even when a valid positive extent is smaller than that precision.
  const width = Math.max(v.width, 1 / (256 * density)), height = Math.max(v.height, 1 / (256 * density));
  c.drawImage(surface, Math.min(v.x, 2000 - width) * density, Math.min(v.y, 2000 - height) * density, width * density, height * density, 0, 0, canvas.width, canvas.height);
}
