import { drawMachine } from './machine.js';
import { machineFromSeed } from './seed.js';

export interface Viewport { x: number; y: number; width: number; height: number }
export interface FrameOptions { seed: string; timeMs: number; viewport: Viewport }
export const WORLD_SIZE = 2000;
// Rasterization of a clipped Bézier can differ from rasterization of the full
// curve. Canonical pixel tiles give every view the same rasterization boundary.
const TILE = 1024;
const BLEED = 16;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Validate the complete request before touching the canvas. */
export function validateFrame(options: FrameOptions): void {
  if (!options || typeof options !== 'object') throw new Error('Frame options are required.');
  if (typeof options.seed !== 'string' || !/^0x[0-9a-f]{64}$/i.test(options.seed)) {
    throw new Error('Seed must be 0x followed by exactly 64 hexadecimal digits.');
  }
  if (!finite(options.timeMs) || options.timeMs < 0) throw new Error('Time must be a finite, nonnegative number of milliseconds.');
  const v = options.viewport;
  if (!v || ![v.x, v.y, v.width, v.height].every(finite) || v.x < 0 || v.y < 0 ||
      v.width <= 0 || v.height <= 0 || v.x + v.width > WORLD_SIZE || v.y + v.height > WORLD_SIZE) {
    throw new Error('Viewport must have nonnegative origins and positive extents within the 2000 × 2000 world.');
  }
}

/** Pure world rendering: no scheduling, viewport-dependent detail, or retained simulation. */
export function renderFrame(canvas: HTMLCanvasElement, options: FrameOptions): void {
  validateFrame(options);
  if (!canvas || !Number.isInteger(canvas.width) || !Number.isInteger(canvas.height) || canvas.width < 1 || canvas.height < 1) {
    throw new Error('Canvas must have positive integer dimensions.');
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('A Canvas 2D context is required.');
  const { viewport: v, seed, timeMs } = options;
  // reset() removes a caller's clip, filters and compositing state without resizing.
  ctx.reset();
  const sx = canvas.width / v.width, sy = canvas.height / v.height;
  const left = v.x * sx, top = v.y * sy;
  const dna = machineFromSeed(seed);
  const tile = new OffscreenCanvas(TILE + 2 * BLEED, TILE + 2 * BLEED);
  const pen = tile.getContext('2d')!;
  ctx.fillStyle = '#efe9d9'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = Math.floor(top / TILE) * TILE; y < top + canvas.height; y += TILE) {
    for (let x = Math.floor(left / TILE) * TILE; x < left + canvas.width; x += TILE) {
      pen.reset();
      pen.setTransform(sx, 0, 0, sy, BLEED - x, BLEED - y);
      drawMachine(pen, dna, timeMs);
      // Copy only the tile core. The identical overscan is discarded in every view.
      ctx.drawImage(tile, BLEED, BLEED, TILE, TILE, x - left, y - top, TILE, TILE);
    }
  }
}
