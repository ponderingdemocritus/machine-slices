// Path construction. Two rules make one world look the same through every window:
//
// 1. Only short straight edges. Skia clips the edges of a path that cross the canvas border and
//    re-quantizes what is left, so a long edge or a curve crossing a slice's border would rasterize a
//    little differently from the same edge inside a larger canvas, all along its length. A Pen
//    flattens every line and arc into edges at most MAX_EDGE_PX device pixels long, so only pixels
//    right at a border can differ, and a slice matches the whole at equal scale.
// 2. Same bounds everywhere. Skia also rasterizes a path whose bounds are small in another way than a
//    large one, so a path holding the few shapes a slice can see could differ from the path holding
//    the same shapes in the whole world. Every world path starts with two specks far outside the world
//    (worldPath), which no viewport can show, so every path is large.
// 3. One winding. Every filled shape is wound clockwise on screen and every hole anticlockwise, so one
//    path can hold many shapes and fill them as a single union under the nonzero rule: overlapping
//    translucent shapes of one pass never darken twice.

import { TAU } from "../engine/geometry.js";

/** Longest edge a path may contain, in device pixels. */
export const MAX_EDGE_PX = 1.6;

/** Direction toward the light, unit length: up and to the left. */
export const LIGHT_X = -0.55;
export const LIGHT_Y = -0.835;

/** An empty path in world coordinates, made large by two specks outside the world. */
export function worldPath(): Path2D {
  const path = new Path2D();
  for (const [x, y] of [[-100, -100], [2100, 2100]] as const) {
    path.moveTo(x, y);
    path.lineTo(x + 0.5, y);
    path.lineTo(x, y + 0.5);
    path.closePath();
  }
  return path;
}

/** Draws a Path2D in straight edges no longer than `step` world units. */
export class Pen {
  readonly path: Path2D;
  private x = 0;
  private y = 0;
  private startX = 0;
  private startY = 0;

  /** A pen for a world path, or with `local`, for a shape in its own frame that is placed later. */
  constructor(readonly step: number, local = false) {
    this.path = local ? new Path2D() : worldPath();
  }

  move(x: number, y: number): void {
    this.path.moveTo(x, y);
    this.x = this.startX = x;
    this.y = this.startY = y;
  }

  line(x: number, y: number): void {
    const n = Math.ceil(Math.hypot(x - this.x, y - this.y) / this.step);
    for (let i = 1; i < n; i++) this.path.lineTo(this.x + ((x - this.x) * i) / n, this.y + ((y - this.y) * i) / n);
    this.path.lineTo(x, y);
    this.x = x;
    this.y = y;
  }

  /** An arc from angle a0 to a1 (either way round), joined to the current point by a line. */
  arc(cx: number, cy: number, r: number, a0: number, a1: number): void {
    this.line(cx + r * Math.cos(a0), cy + r * Math.sin(a0));
    const n = Math.max(1, Math.ceil((Math.abs(a1 - a0) * r) / this.step));
    for (let i = 1; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      this.path.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    this.x = cx + r * Math.cos(a1);
    this.y = cy + r * Math.sin(a1);
  }

  close(): void {
    this.line(this.startX, this.startY);
    this.path.closePath();
  }
}

/** A filled circle. */
export function circle(pen: Pen, x: number, y: number, r: number): void {
  pen.move(x + r, y);
  pen.arc(x, y, r, 0, TAU);
  pen.close();
}

/** A circular hole: wound the other way, it cuts itself out of the shape around it. */
export function hole(pen: Pen, x: number, y: number, r: number): void {
  pen.move(x + r, y);
  pen.arc(x, y, r, TAU, 0);
  pen.close();
}

/** A ring between radii `inner` and `outer`. */
export function ring(pen: Pen, x: number, y: number, inner: number, outer: number): void {
  circle(pen, x, y, outer);
  hole(pen, x, y, inner);
}

/** A regular polygon of `sides` corners on radius r, the first at angle a. */
export function polygon(pen: Pen, x: number, y: number, r: number, sides: number, a: number): void {
  pen.move(x + r * Math.cos(a), y + r * Math.sin(a));
  for (let k = 1; k < sides; k++) pen.line(x + r * Math.cos(a + (k * TAU) / sides), y + r * Math.sin(a + (k * TAU) / sides));
  pen.close();
}

/** Unit normals of a polyline: the tangent turned a quarter clockwise on screen. */
export function normals(xs: ArrayLike<number>, ys: ArrayLike<number>): { nx: Float64Array; ny: Float64Array } {
  const n = xs.length;
  const nx = new Float64Array(n), ny = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = i > 0 ? i - 1 : i, b = i < n - 1 ? i + 1 : i;
    const tx = xs[b]! - xs[a]!, ty = ys[b]! - ys[a]!;
    const l = Math.hypot(tx, ty) || 1;
    nx[i] = -ty / l;
    ny[i] = tx / l;
  }
  return { nx, ny };
}

/** The band between two offset curves of a polyline, offsets lo[i] < hi[i] along the normals. */
export function band(
  pen: Pen,
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  nx: ArrayLike<number>,
  ny: ArrayLike<number>,
  lo: ArrayLike<number>,
  hi: ArrayLike<number>,
): void {
  const n = xs.length;
  if (n < 2) return;
  pen.move(xs[0]! + nx[0]! * lo[0]!, ys[0]! + ny[0]! * lo[0]!);
  for (let i = 1; i < n; i++) pen.line(xs[i]! + nx[i]! * lo[i]!, ys[i]! + ny[i]! * lo[i]!);
  for (let i = n - 1; i >= 0; i--) pen.line(xs[i]! + nx[i]! * hi[i]!, ys[i]! + ny[i]! * hi[i]!);
  pen.close();
}

/** A tube of half-width half[i] along a polyline, with round ends. */
export function tube(pen: Pen, xs: ArrayLike<number>, ys: ArrayLike<number>, half: ArrayLike<number>): void {
  const n = xs.length;
  if (n < 2) return;
  const { nx, ny } = normals(xs, ys);
  band(pen, xs, ys, nx, ny, Array.from(half, (h) => -h), half);
  circle(pen, xs[0]!, ys[0]!, half[0]!);
  circle(pen, xs[n - 1]!, ys[n - 1]!, half[n - 1]!);
}

/** A straight bar of width w between two points, with round ends. */
export function bar(pen: Pen, x0: number, y0: number, x1: number, y1: number, w: number): void {
  tube(pen, [x0, x1], [y0, y1], [w / 2, w / 2]);
}

/** A rectangle in a frame rotated by `angle` about (cx, cy), from `along0` to `along1` on the axis. */
export function rotatedRect(pen: Pen, cx: number, cy: number, angle: number, along0: number, along1: number, across0: number, across1: number): void {
  const c = Math.cos(angle), s = Math.sin(angle);
  const at = (u: number, v: number): [number, number] => [cx + u * c - v * s, cy + u * s + v * c];
  pen.move(...at(along0, across0));
  pen.line(...at(along1, across0));
  pen.line(...at(along1, across1));
  pen.line(...at(along0, across1));
  pen.close();
}

/** An axis-aligned rectangle with rounded corners of radius r. */
export function roundedRect(pen: Pen, x: number, y: number, w: number, h: number, r: number): void {
  pen.move(x + r, y);
  pen.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  pen.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  pen.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  pen.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
  pen.close();
}

/** Brightness levels of a Glow. */
export const LEVELS = 24;

/** Light: one union of shapes per brightness level, filled additively. */
export class Glow {
  private readonly levels = new Map<number, Pen>();

  constructor(private readonly step: number) {}

  /** The pen for shapes at `level` of LEVELS. */
  at(level: number): Pen {
    let pen = this.levels.get(level);
    if (!pen) this.levels.set(level, (pen = new Pen(this.step)));
    return pen;
  }

  fill(ctx: CanvasRenderingContext2D, color: string, alpha: number): void {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = color;
    for (const [level, pen] of this.levels) {
      ctx.globalAlpha = (alpha * level) / LEVELS;
      ctx.fill(pen.path);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
}

/** Fills `path` displaced by (dx, dy), e.g. for a drop shadow or a lit edge. */
export function fillShifted(ctx: CanvasRenderingContext2D, path: Path2D, dx: number, dy: number): void {
  ctx.save();
  ctx.translate(dx, dy);
  ctx.fill(path);
  ctx.restore();
}

/** A 2D matrix for Path2D.addPath: rotate by `angle`, then move to (x, y). */
export function placed(x: number, y: number, angle: number): DOMMatrix2DInit {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { a: c, b: s, c: -s, d: c, e: x, f: y };
}
