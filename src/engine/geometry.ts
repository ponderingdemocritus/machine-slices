// Plain geometry in world units: boxes, and two spatial indexes for "what is near this point".

export const TAU = Math.PI * 2;

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The smallest box around a list of points, grown by `pad`. */
export function boxOfPoints(xs: ArrayLike<number>, ys: ArrayLike<number>, pad: number): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]!, y = ys[i]!;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Points in a square [0, size)², bucketed in a flat grid, for nearest-neighbour searches. */
export class PointIndex {
  private readonly cols: number;
  private readonly cells: number[][];
  readonly xs: number[] = [];
  readonly ys: number[] = [];

  constructor(size: number, private readonly cell: number) {
    this.cols = Math.ceil(size / cell);
    this.cells = Array.from({ length: this.cols * this.cols }, () => []);
  }

  private column(v: number): number {
    const c = Math.floor(v / this.cell);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  /** Adds a point and returns its index. */
  add(x: number, y: number): number {
    const i = this.xs.length;
    this.xs.push(x);
    this.ys.push(y);
    this.cells[this.column(y) * this.cols + this.column(x)]!.push(i);
    return i;
  }

  /** The index of the nearest point closer than `within` to (x, y), or -1. Searches outward ring by ring. */
  nearest(x: number, y: number, within: number): number {
    const cx = this.column(x), cy = this.column(y);
    const rings = Math.ceil(within / this.cell) + 1;
    let best = -1, bestD = within;
    for (let r = 0; r <= rings; r++) {
      if ((r - 1) * this.cell > bestD) break;
      for (let gy = cy - r; gy <= cy + r; gy++) {
        if (gy < 0 || gy >= this.cols) continue;
        const edge = gy === cy - r || gy === cy + r;
        for (let gx = cx - r; gx <= cx + r; gx += edge ? 1 : 2 * r || 1) {
          if (gx < 0 || gx >= this.cols) continue;
          for (const i of this.cells[gy * this.cols + gx]!) {
            const d = Math.hypot(this.xs[i]! - x, this.ys[i]! - y);
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          }
        }
      }
    }
    return best;
  }

  /** Calls `visit` for every point within `radius` of (x, y). */
  within(x: number, y: number, radius: number, visit: (i: number) => void): void {
    const x0 = this.column(x - radius), x1 = this.column(x + radius);
    const y0 = this.column(y - radius), y1 = this.column(y + radius);
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        for (const i of this.cells[gy * this.cols + gx]!) {
          if (Math.hypot(this.xs[i]! - x, this.ys[i]! - y) < radius) visit(i);
        }
      }
    }
  }
}

/** A uniform grid of buckets over the plane, for "what is near this point" queries. */
export class Grid<T> {
  private readonly cells = new Map<number, T[]>();

  constructor(readonly cellSize: number) {}

  private key(cx: number, cy: number): number {
    return (cx + 1024) * 4096 + (cy + 1024);
  }

  /** Files an item under every cell its box touches. */
  insert(item: T, box: Box): void {
    const s = this.cellSize;
    for (let cx = Math.floor(box.x0 / s); cx <= Math.floor(box.x1 / s); cx++) {
      for (let cy = Math.floor(box.y0 / s); cy <= Math.floor(box.y1 / s); cy++) {
        const k = this.key(cx, cy);
        const cell = this.cells.get(k);
        if (cell) cell.push(item);
        else this.cells.set(k, [item]);
      }
    }
  }

  /** Every item filed in a cell the box touches; an item may come more than once. */
  *near(box: Box): Generator<T> {
    const s = this.cellSize;
    for (let cx = Math.floor(box.x0 / s); cx <= Math.floor(box.x1 / s); cx++) {
      for (let cy = Math.floor(box.y0 / s); cy <= Math.floor(box.y1 / s); cy++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (cell) yield* cell;
      }
    }
  }
}
