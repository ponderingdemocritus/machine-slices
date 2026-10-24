// Tissue: the body's cells, under everything. A Voronoi diagram of jittered points, each cell shrunk
// away from its neighbours (the gap between two cells is their membrane) and rounded, with a nucleus,
// some of them small cogs. It gives every window into the world an organic texture at the scale of
// a slice.

import { fieldNoise, hashString, type Rng } from "../engine/random.js";

export interface Cell {
  /** The rounded cell outline, inside its membrane. */
  xs: number[];
  ys: number[];
  /** Nucleus centre and radius. */
  nx: number;
  ny: number;
  nr: number;
  /** Teeth of a nucleus that is a small cog (0: a plain round nucleus). */
  cog: number;
  /** How dense the cell looks, 0 to 1. */
  shade: number;
  /** Bounds of the outline. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const WORLD = 2000;
const SPACING = 40;
/** Half the width of a membrane. */
const MEMBRANE = 1.6;

/** Clips a convex polygon to the half-plane closer to (px, py) than to (qx, qy), less `inset`. */
function clip(xs: number[], ys: number[], px: number, py: number, qx: number, qy: number, inset: number): [number[], number[]] {
  const nx = qx - px, ny = qy - py;
  const len = Math.hypot(nx, ny);
  const ux = nx / len, uy = ny / len;
  // Points p + t u with t < len / 2 - inset are kept.
  const limit = len / 2 - inset;
  const side = (i: number) => (xs[i]! - px) * ux + (ys[i]! - py) * uy - limit;
  const ox: number[] = [], oy: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    const j = (i + 1) % xs.length;
    const a = side(i), b = side(j);
    if (a <= 0) {
      ox.push(xs[i]!);
      oy.push(ys[i]!);
    }
    if ((a < 0 && b > 0) || (a > 0 && b < 0)) {
      const t = a / (a - b);
      ox.push(xs[i]! + (xs[j]! - xs[i]!) * t);
      oy.push(ys[i]! + (ys[j]! - ys[i]!) * t);
    }
  }
  return [ox, oy];
}

/** One round of Chaikin corner cutting on a closed polygon. */
function round(xs: number[], ys: number[]): [number[], number[]] {
  const ox: number[] = [], oy: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    const j = (i + 1) % xs.length;
    ox.push(0.75 * xs[i]! + 0.25 * xs[j]!, 0.25 * xs[i]! + 0.75 * xs[j]!);
    oy.push(0.75 * ys[i]! + 0.25 * ys[j]!, 0.25 * ys[i]! + 0.75 * ys[j]!);
  }
  return [ox, oy];
}

export function growTissue(rng: Rng): Cell[] {
  const cols = Math.ceil(WORLD / SPACING) + 2;
  const px: number[] = [], py: number[] = [];
  for (let gy = -1; gy < cols - 1; gy++) {
    for (let gx = -1; gx < cols - 1; gx++) {
      px.push((gx + 0.5 + rng.range(-0.4, 0.4)) * SPACING);
      py.push((gy + 0.5 + rng.range(-0.4, 0.4)) * SPACING);
    }
  }
  const salt = hashString("tissue") ^ rng.u32();
  const cells: Cell[] = [];
  for (let gy = 1; gy < cols - 1; gy++) {
    for (let gx = 1; gx < cols - 1; gx++) {
      const i = gy * cols + gx;
      const x = px[i]!, y = py[i]!;
      let xs = [x - 2 * SPACING, x + 2 * SPACING, x + 2 * SPACING, x - 2 * SPACING];
      let ys = [y - 2 * SPACING, y - 2 * SPACING, y + 2 * SPACING, y + 2 * SPACING];
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const ny = gy + dy, nx = gx + dx;
          if ((dx === 0 && dy === 0) || nx < 0 || ny < 0 || nx >= cols || ny >= cols) continue;
          const j = ny * cols + nx;
          [xs, ys] = clip(xs, ys, x, y, px[j]!, py[j]!, MEMBRANE);
        }
      }
      if (xs.length < 3) continue;
      [xs, ys] = round(xs, ys);
      let cx = 0, cy = 0;
      for (let k = 0; k < xs.length; k++) {
        cx += xs[k]!;
        cy += ys[k]!;
      }
      cx /= xs.length;
      cy /= xs.length;
      const a = rng.range(0, Math.PI * 2), off = rng.range(0, 0.2) * SPACING;
      cells.push({
        xs,
        ys,
        nx: cx + off * Math.cos(a),
        ny: cy + off * Math.sin(a),
        nr: rng.range(0.08, 0.14) * SPACING,
        cog: rng.chance(0.3) ? rng.int(6, 10) : 0,
        shade: fieldNoise(cx, cy, 300, salt),
        x0: Math.min(...xs),
        y0: Math.min(...ys),
        x1: Math.max(...xs),
        y1: Math.max(...ys),
      });
    }
  }
  return cells;
}
