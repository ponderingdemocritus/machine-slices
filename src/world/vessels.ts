// The vessels: one branching tree per cylinder, grown outward from the cylinder heads by space
// colonization (Runions et al., 2005). Attraction points scattered over the world pull the nearest
// vessel tip toward them; every tree competes for the same points, so the trees share the world out
// like the territories of arteries. Widths follow Murray's law from the tips inward, and every point
// knows its distance from the heart along the network: that distance is where a pulse is, in time.

import { boxOfPoints, Grid, PointIndex, type Box } from "../engine/geometry.js";
import { fieldNoise, hashString, type Rng } from "../engine/random.js";
import { smootherstep } from "../engine/rhythm.js";
import type { Heart } from "./heart.js";
import { organAttractors, type Organ } from "./organs.js";

/** A run of vessel between two branch points (or a root, or a tip), as a smoothed polyline. */
export interface Chain {
  tree: number;
  /** The chain this one branches from, or -1 for the chain leaving a cylinder head. */
  parent: number;
  xs: Float64Array;
  ys: Float64Array;
  /** Full width at each point. */
  ws: Float64Array;
  /** Distance from the heart along the network at each point. */
  ds: Float64Array;
  /** Bounds of the chain, its width included. */
  box: Box;
  /** True when the chain ends in a free tip. */
  tip: boolean;
}

/** A branch point, where a vessel divides. */
export interface Junction {
  x: number;
  y: number;
  /** Width of the vessel arriving at the junction. */
  width: number;
  tree: number;
  distance: number;
}

/** The free end of a vessel. */
export interface Tip {
  x: number;
  y: number;
  /** Direction the vessel points at its end. */
  angle: number;
  width: number;
  tree: number;
  distance: number;
}

export interface Vessels {
  chains: Chain[];
  junctions: Junction[];
  tips: Tip[];
  /** Per tree, the longest distance from the heart along it. */
  reach: number[];
  maxWidth: number;
}

const WORLD = 2000;
const SPACING = 40;
const INFLUENCE = 150;
const KILL = 24;
const STEP = 11;
const INERTIA = 0.6;
const MAX_ITERATIONS = 420;
const MAX_NODES = 12000;
const MURRAY = 2.7;
const MIN_WIDTH = 1.5;

interface Forest {
  x: number[];
  y: number[];
  parent: number[];
  tree: number[];
}

/** Attraction points on a jittered grid, thinned by a slow noise field so that the vessels leave pockets. */
function scatterAttractors(rng: Rng, heart: Heart, organs: readonly Organ[]): { x: number[]; y: number[] } {
  const salt = hashString("pockets") ^ rng.u32();
  const x: number[] = [], y: number[] = [];
  const clear = heart.radius + 46;
  for (let gx = SPACING / 2; gx < WORLD; gx += SPACING) {
    for (let gy = SPACING / 2; gy < WORLD; gy += SPACING) {
      const px = Math.min(WORLD - 6, Math.max(6, gx + rng.range(-0.45, 0.45) * SPACING));
      const py = Math.min(WORLD - 6, Math.max(6, gy + rng.range(-0.45, 0.45) * SPACING));
      if (Math.hypot(px - heart.cx, py - heart.cy) < clear) continue;
      if (organs.some((o) => Math.hypot(px - o.x, py - o.y) < o.radius + 30)) continue;
      const keep = 0.14 + 0.86 * smootherstep((fieldNoise(px, py, 560, salt) - 0.3) / 0.3);
      if (rng.float() < keep) {
        x.push(px);
        y.push(py);
      }
    }
  }
  for (const o of organs) {
    for (const p of organAttractors(o, heart)) {
      x.push(p.x);
      y.push(p.y);
    }
  }
  return { x, y };
}

/** Grows one tree per cylinder until no attraction point is left in reach. */
function grow(rng: Rng, heart: Heart, organs: readonly Organ[]): Forest {
  const f: Forest = { x: [], y: [], parent: [], tree: [] };
  const dirX: number[] = [], dirY: number[] = [];
  const nodes = new PointIndex(WORLD, 30);
  const add = (x: number, y: number, parent: number, tree: number, dx: number, dy: number) => {
    f.x.push(x);
    f.y.push(y);
    f.parent.push(parent);
    f.tree.push(tree);
    dirX.push(dx);
    dirY.push(dy);
    return nodes.add(x, y);
  };
  // Each tree starts as a short trunk leaving its cylinder head, curling slightly with the crank.
  const swirl = rng.range(0.05, 0.11) * (rng.chance(0.5) ? 1 : -1);
  heart.axes.forEach((axis, t) => {
    let a = axis, x = heart.cx + (heart.headEnd + 2) * Math.cos(a), y = heart.cy + (heart.headEnd + 2) * Math.sin(a);
    let i = add(x, y, -1, t, Math.cos(a), Math.sin(a));
    for (let k = 0; k < 5; k++) {
      a += swirl;
      x += STEP * Math.cos(a);
      y += STEP * Math.sin(a);
      i = add(x, y, i, t, Math.cos(a), Math.sin(a));
    }
  });

  const scattered = scatterAttractors(rng, heart, organs);
  const points = new PointIndex(WORLD, 30);
  scattered.x.forEach((x, i) => points.add(x, scattered.y[i]!));
  const alive = new Uint8Array(scattered.x.length).fill(1);
  let left = alive.length;

  for (let iteration = 0; iteration < MAX_ITERATIONS && f.x.length < MAX_NODES && left > 0; iteration++) {
    const pullX = new Map<number, number>(), pullY = new Map<number, number>();
    for (let p = 0; p < alive.length; p++) {
      if (!alive[p]) continue;
      const px = points.xs[p]!, py = points.ys[p]!;
      const n = nodes.nearest(px, py, INFLUENCE);
      if (n < 0) continue;
      const d = Math.hypot(px - f.x[n]!, py - f.y[n]!) || 1;
      pullX.set(n, (pullX.get(n) ?? 0) + (px - f.x[n]!) / d);
      pullY.set(n, (pullY.get(n) ?? 0) + (py - f.y[n]!) / d);
    }
    const born: number[] = [];
    for (const [n, sx] of pullX) {
      const sy = pullY.get(n)!;
      const len = Math.hypot(sx, sy);
      if (len < 1e-6) continue;
      let dx = sx / len + INERTIA * dirX[n]!, dy = sy / len + INERTIA * dirY[n]!;
      const dl = Math.hypot(dx, dy);
      if (dl < 1e-6) continue;
      dx /= dl;
      dy /= dl;
      const x = f.x[n]! + STEP * dx, y = f.y[n]! + STEP * dy;
      if (x < 3 || y < 3 || x > WORLD - 3 || y > WORLD - 3) continue;
      if (Math.hypot(x - heart.cx, y - heart.cy) < heart.radius + 4) continue;
      if (organs.some((o) => Math.hypot(x - o.x, y - o.y) < o.radius + 6)) continue;
      if (nodes.nearest(x, y, STEP * 0.6) >= 0) continue;
      born.push(add(x, y, n, f.tree[n]!, dx, dy));
    }
    if (born.length === 0) break;
    for (const n of born) {
      points.within(f.x[n]!, f.y[n]!, KILL, (p) => {
        if (alive[p]) {
          alive[p] = 0;
          left--;
        }
      });
    }
  }
  return f;
}

/** Chaikin corner cutting that keeps both ends in place. */
function smooth(xs: number[], ys: number[], rounds: number): { xs: number[]; ys: number[] } {
  for (let r = 0; r < rounds && xs.length > 2; r++) {
    const nx = [xs[0]!], ny = [ys[0]!];
    for (let i = 0; i < xs.length - 1; i++) {
      const ax = xs[i]!, ay = ys[i]!, bx = xs[i + 1]!, by = ys[i + 1]!;
      if (i > 0) {
        nx.push(0.75 * ax + 0.25 * bx);
        ny.push(0.75 * ay + 0.25 * by);
      }
      if (i < xs.length - 2) {
        nx.push(0.25 * ax + 0.75 * bx);
        ny.push(0.25 * ay + 0.75 * by);
      }
    }
    nx.push(xs[xs.length - 1]!);
    ny.push(ys[ys.length - 1]!);
    xs = nx;
    ys = ny;
  }
  return { xs, ys };
}

export function growVessels(rng: Rng, heart: Heart, organs: readonly Organ[]): Vessels {
  const f = grow(rng, heart, organs);
  const count = f.x.length;
  const kids: number[][] = Array.from({ length: count }, () => []);
  for (let i = 0; i < count; i++) if (f.parent[i]! >= 0) kids[f.parent[i]!]!.push(i);

  // Murray's law, from the tips inward: a parent's radius^k is the sum of its children's.
  const radius = new Float64Array(count).fill(1);
  for (let i = count - 1; i >= 0; i--) {
    if (kids[i]!.length === 0) continue;
    let sum = 0;
    for (const c of kids[i]!) sum += radius[c]! ** MURRAY;
    radius[i] = sum ** (1 / MURRAY);
  }
  let maxRadius = 1;
  for (let i = 0; i < count; i++) maxRadius = Math.max(maxRadius, radius[i]!);
  const maxWidth = rng.range(28, 34);
  const widthOf = (n: number) => MIN_WIDTH + (maxWidth - MIN_WIDTH) * ((radius[n]! - 1) / Math.max(1e-9, maxRadius - 1)) ** 0.85;

  const chains: Chain[] = [], junctions: Junction[] = [], tips: Tip[] = [];
  const reach = heart.axes.map(() => 0);
  const roots: number[] = [];
  for (let i = 0; i < count; i++) if (f.parent[i]! < 0) roots.push(i);
  const queue: { node: number; chain: number; distance: number }[] = roots.map((node) => ({ node, chain: -1, distance: 0 }));
  while (queue.length) {
    const { node: from, chain: parentChain, distance: startDistance } = queue.pop()!;
    for (const first of kids[from]!) {
      const path = [from, first];
      let n = first;
      while (kids[n]!.length === 1) {
        n = kids[n]![0]!;
        path.push(n);
      }
      const { xs, ys } = smooth(path.map((i) => f.x[i]!), path.map((i) => f.y[i]!), 2);
      // A branch leaves its parent slightly flared, like a fillet, then settles to its own width.
      const width = widthOf(first), parentWidth = widthOf(from);
      const flare = Math.min(parentWidth, width * 1.6);
      const ws = new Float64Array(xs.length), ds = new Float64Array(xs.length);
      let along = 0;
      for (let i = 0; i < xs.length; i++) {
        if (i > 0) along += Math.hypot(xs[i]! - xs[i - 1]!, ys[i]! - ys[i - 1]!);
        ds[i] = startDistance + along;
        ws[i] = width + (flare - width) * Math.exp(-along / (0.45 * parentWidth));
      }
      const tree = f.tree[first]!;
      const index = chains.length;
      const end = xs.length - 1;
      chains.push({
        tree,
        parent: parentChain,
        xs: Float64Array.from(xs),
        ys: Float64Array.from(ys),
        ws,
        ds,
        box: boxOfPoints(xs, ys, flare / 2 + 2),
        tip: kids[n]!.length === 0,
      });
      reach[tree] = Math.max(reach[tree]!, ds[end]!);
      if (kids[n]!.length === 0) {
        const angle = Math.atan2(ys[end]! - ys[end - 1]!, xs[end]! - xs[end - 1]!);
        tips.push({ x: xs[end]!, y: ys[end]!, angle: Number.isFinite(angle) ? angle : 0, width, tree, distance: ds[end]! });
      } else {
        junctions.push({ x: xs[end]!, y: ys[end]!, width, tree, distance: ds[end]! });
        queue.push({ node: n, chain: index, distance: ds[end]! });
      }
    }
  }
  return { chains, junctions, tips, reach, maxWidth };
}

/** Distance from a point to the nearest vessel wall wider than `minWidth` (negative inside it). */
export class VesselField {
  private readonly grid = new Grid<number>(80);
  private readonly segments: number[] = [];

  constructor(vessels: Vessels, minWidth: number) {
    for (const c of vessels.chains) {
      for (let i = 0; i + 1 < c.xs.length; i++) {
        const w = Math.max(c.ws[i]!, c.ws[i + 1]!);
        if (w < minWidth) continue;
        const k = this.segments.length / 5;
        this.segments.push(c.xs[i]!, c.ys[i]!, c.xs[i + 1]!, c.ys[i + 1]!, w / 2);
        this.grid.insert(k, boxOfPoints([c.xs[i]!, c.xs[i + 1]!], [c.ys[i]!, c.ys[i + 1]!], w / 2));
      }
    }
  }

  /** Clearance from (x, y) to the vessels, looking no farther than `within`. */
  clearance(x: number, y: number, within: number): number {
    let best = within;
    const s = this.segments;
    for (const k of this.grid.near({ x0: x - within, y0: y - within, x1: x + within, y1: y + within })) {
      const o = k * 5;
      const ax = s[o]!, ay = s[o + 1]!, bx = s[o + 2]!, by = s[o + 3]!;
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) - s[o + 4]!;
      if (d < best) best = d;
    }
    return best;
  }
}
