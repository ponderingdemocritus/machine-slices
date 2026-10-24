import { compose } from './machine.js';
import { drawMachine } from './draw.js';
export interface Viewport { x: number; y: number; width: number; height: number }
export interface FrameOptions { seed: string; timeMs: number; viewport: Viewport }
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Draw a window into the shared 2000-unit world. No scheduling or retained frame state. */
export function renderFrame(canvas: HTMLCanvasElement, options: FrameOptions): void {
  if (!options || typeof options.seed !== 'string' || !/^0x[0-9a-f]{64}$/i.test(options.seed)) throw new Error('Seed must be 0x followed by 64 hexadecimal digits.');
  if (!finite(options.timeMs) || options.timeMs < 0) throw new Error('Time must be a finite, nonnegative number.');
  const v = options.viewport;
  if (!v || ![v.x, v.y, v.width, v.height].every(finite) || v.x < 0 || v.y < 0 || v.width <= 0 || v.height <= 0 || v.x + v.width > 2000 || v.y + v.height > 2000) throw new Error('Viewport must be a positive rectangle inside the 2000 × 2000 world.');
  if (!canvas || !Number.isInteger(canvas.width) || !Number.isInteger(canvas.height) || canvas.width <= 0 || canvas.height <= 0 || typeof canvas.getContext !== 'function') throw new Error('Canvas must have positive integer dimensions and a 2D context.');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable.');
  ctx.reset();
  const machine = compose(options.seed);
  const sx = canvas.width / v.width, sy = canvas.height / v.height;
  function paint(target: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number, height: number, x = 0, y = 0): void {
    target.fillStyle = machine.palette[0];
    target.fillRect(0, 0, width, height);
    target.setTransform(sx, 0, 0, sy, -x * sx, -y * sy);
    drawMachine(target, machine, options.timeMs % 60000);
  }
  const fullWorld = v.x === 0 && v.y === 0 && v.width === 2000 && v.height === 2000;
  // Canvas bounds chop edges before antialiasing: cut equal-scale slices from a whole-world frame.
  // Zoomed views draw vectors directly because their whole-world buffer would be too large.
  if (!fullWorld && sx <= 1 && sy <= 1) {
    const buffer = new OffscreenCanvas(Math.ceil(2000 * sx), Math.ceil(2000 * sy));
    const buffered = buffer.getContext('2d');
    if (!buffered) throw new Error('Offscreen canvas 2D context is unavailable.');
    paint(buffered, buffer.width, buffer.height);
    ctx.fillStyle = machine.palette[0];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buffer, v.x * sx, v.y * sy, canvas.width, canvas.height,
      0, 0, canvas.width, canvas.height);
  } else {
    paint(ctx, canvas.width, canvas.height, v.x, v.y);
  }
}
