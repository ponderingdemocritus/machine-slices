// Vessels, pulses and tips. The vessels never move, so their passes (edge, wall, channel, highlight,
// collars, tip bulbs) are built once per view and scale as unions. Pulses are light: each of the
// heart's two strokes sends one down every vessel at once, and wherever the network is at a pulse's
// distance from the heart, that stretch glows, so each beat spreads outward as a pair of rings; when
// a pulse reaches a tip, the tip flashes.

import { lerp } from "../engine/geometry.js";
import { BEAT_MS, pulseAges, STROKES, wrap, type Clock } from "../engine/rhythm.js";
import { rgba } from "../world/palette.js";
import type { Chain } from "../world/vessels.js";
import { PULSE_LENGTH, PULSE_SPEED, type World } from "../world/world.js";
import { band, circle, fillShifted, Glow, LEVELS, LIGHT_X, LIGHT_Y, normals, Pen, tube } from "./shapes.js";
import { pixels, sees, seesDisc, type View } from "./view.js";

export interface VesselArt {
  edge: Path2D;
  wall: Path2D;
  lumen: Path2D;
  shine: Path2D;
  collars: Path2D;
  seams: Path2D;
  lenses: Path2D;
}

const EDGE = 1.3;

/** Radius of the bulb that ends a tip of vessel width w, and its centre. */
const bulbRadius = (w: number) => Math.max(2.6, w * 1.15);
function bulbAt(t: { x: number; y: number; angle: number; width: number }): [number, number, number] {
  const r = bulbRadius(t.width);
  return [t.x + Math.cos(t.angle) * r * 0.55, t.y + Math.sin(t.angle) * r * 0.55, r];
}

export function buildVesselArt(world: World, view: View, step: number): VesselArt {
  const pen = () => new Pen(step);
  const edge = pen(), wall = pen(), lumen = pen(), shine = pen(), collars = pen(), seams = pen(), lenses = pen();
  for (const c of world.vessels.chains) {
    if (!sees(view, c.box, EDGE + 6)) continue;
    const n = c.xs.length;
    const half = Array.from(c.ws, (w) => w / 2);
    tube(edge, c.xs, c.ys, half.map((h) => h + EDGE));
    tube(wall, c.xs, c.ys, half);
    if (c.ws[n - 1]! > 2.6) tube(lumen, c.xs, c.ys, half.map((h) => h * 0.42));
    // The highlight rides on the side of the tube that faces the light; a side branch's starts outside
    // its parent's wall, so that it never crosses the parent.
    const { nx, ny } = normals(c.xs, c.ys);
    const centre = half.map((h, i) => -(nx[i]! * LIGHT_X + ny[i]! * LIGHT_Y) * h * 0.52);
    const parent = world.vessels.chains[c.parent];
    const parentWidth = parent ? parent.ws[parent.ws.length - 1]! : 0;
    const clear = c.ws[n - 1]! < 0.75 * parentWidth ? 0.6 * parentWidth : 0;
    const from = c.ds.findIndex((d) => d - c.ds[0]! >= clear);
    if (from >= 0 && from < n - 1) {
      const part = <T>(a: ArrayLike<T>) => Array.prototype.slice.call(a, from) as T[];
      band(shine, part(c.xs), part(c.ys), part(nx), part(ny), part(centre.map((o, i) => o - half[i]! * 0.13)), part(centre.map((o, i) => o + half[i]! * 0.13)));
    }
    if (c.ws[n - 1]! >= 7) addCollars(collars, seams, c);
  }
  for (const t of world.vessels.tips) {
    const [x, y, r] = bulbAt(t);
    if (!seesDisc(view, x, y, r + EDGE)) continue;
    circle(edge, x, y, r + EDGE);
    circle(wall, x, y, r);
    circle(lenses, x, y, r * 0.48);
  }
  return { edge: edge.path, wall: wall.path, lumen: lumen.path, shine: shine.path, collars: collars.path, seams: seams.path, lenses: lenses.path };
}

/** Collars around a wide vessel at regular steps, each with a dark seam on its far side. */
function addCollars(collars: Pen, seams: Pen, c: Chain): void {
  const n = c.xs.length;
  const width = c.ws[n - 1]!;
  const step = Math.max(16, width * 2.2);
  const length = c.ds[n - 1]! - c.ds[0]!;
  const thick = Math.max(1.1, width * 0.11);
  let i = 0;
  for (let s = step * 0.9; s < length - step * 0.6; s += step) {
    const d = c.ds[0]! + s;
    while (i < n - 2 && c.ds[i + 1]! < d) i++;
    const t = (d - c.ds[i]!) / Math.max(1e-9, c.ds[i + 1]! - c.ds[i]!);
    const x = lerp(c.xs[i]!, c.xs[i + 1]!, t), y = lerp(c.ys[i]!, c.ys[i + 1]!, t);
    const len = Math.hypot(c.xs[i + 1]! - c.xs[i]!, c.ys[i + 1]! - c.ys[i]!) || 1;
    const tx = (c.xs[i + 1]! - c.xs[i]!) / len, ty = (c.ys[i + 1]! - c.ys[i]!) / len;
    const h = lerp(c.ws[i]!, c.ws[i + 1]!, t) / 2 + 1.5;
    const across = (pen: Pen, a: number, b: number, reach: number) =>
      band(pen, [x + tx * a, x + tx * b], [y + ty * a, y + ty * b], [-ty, -ty], [tx, tx], [-reach, -reach], [reach, reach]);
    across(collars, -thick, thick, h);
    across(seams, thick, thick + Math.max(0.6, width * 0.06), h - 0.6);
  }
}

export function drawVessels(ctx: CanvasRenderingContext2D, world: World, art: VesselArt, view: View): void {
  const { palette } = world;
  const shadow = pixels(view, 3, 3.5);
  ctx.fillStyle = palette.shade;
  fillShifted(ctx, art.edge, shadow * 0.8, shadow);
  ctx.fillStyle = palette.vessel.edge;
  ctx.fill(art.edge);
  ctx.fillStyle = palette.vessel.wall;
  ctx.fill(art.wall);
  ctx.fillStyle = palette.vessel.lumen;
  ctx.fill(art.lumen);
  ctx.fill(art.lenses);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = palette.vessel.shine;
  ctx.fill(art.shine);
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.vessel.collar;
  ctx.fill(art.collars);
  ctx.fillStyle = palette.vessel.edge;
  ctx.fill(art.seams);
}

/** The part of a chain between distances d0 and d1 from the heart, or null if it is empty. */
function stretch(c: Chain, d0: number, d1: number): { xs: number[]; ys: number[]; ws: number[] } | null {
  const ds = c.ds, n = ds.length;
  if (d1 <= d0) return null;
  const xs: number[] = [], ys: number[] = [], ws: number[] = [];
  const at = (d: number, i: number) => {
    const t = (d - ds[i]!) / Math.max(1e-9, ds[i + 1]! - ds[i]!);
    xs.push(lerp(c.xs[i]!, c.xs[i + 1]!, t));
    ys.push(lerp(c.ys[i]!, c.ys[i + 1]!, t));
    ws.push(lerp(c.ws[i]!, c.ws[i + 1]!, t));
  };
  let i = 0, hi = n - 2;
  while (i < hi) {
    const mid = (i + hi + 1) >> 1;
    if (ds[mid]! <= d0) i = mid;
    else hi = mid - 1;
  }
  at(d0, i);
  for (let k = i + 1; k < n && ds[k]! < d1; k++) {
    xs.push(c.xs[k]!);
    ys.push(c.ys[k]!);
    ws.push(c.ws[k]!);
    i = k;
  }
  at(d1, Math.min(i, n - 2));
  return xs.length >= 2 ? { xs, ys, ws } : null;
}

/** A pulse is a bright head PULSE_LENGTH long drawn in SEGMENTS steps, then a dim wake WAKE long. */
const SEGMENTS = 9;
const WAKE = 280;
const WAKE_SEGMENTS = 3;

/**
 * The glow of the pulses: a soft bloom around the head, a halo, a body and a hot core; behind the
 * head, a wake of fading light shows which way the pulse is going.
 */
export function drawPulses(ctx: CanvasRenderingContext2D, world: World, clock: Clock, view: View, step: number): void {
  const { vessels, palette } = world;
  const haloReach = pixels(view, 2.6, 3.2);
  const glow = rgba(palette.glow, 1);
  // Half-widths for vessel width w at position u along the head (0 at the front, 1 at its end): the
  // outer glows narrow toward the tail, so that each pulse is a comet.
  const layers = [
    { half: (w: number, u: number) => (w * 1.1 + 4 * haloReach) * Math.max(0, 1 - 2 * u) ** 0.7, alpha: 0.07, color: glow, glow: new Glow(step) },
    { half: (w: number, u: number) => (w * 0.68 + haloReach) * (1 - 0.8 * u), alpha: 0.2, color: glow, glow: new Glow(step) },
    { half: (w: number) => w * 0.32 + 0.5, alpha: 0.55, color: glow, glow: new Glow(step) },
    { half: (w: number) => w * 0.13 + 0.25, alpha: 0.85, color: rgba(palette.spark, 1), glow: new Glow(step) },
  ];
  const wake = { half: (w: number) => w * 0.3 + 0.4, alpha: 0.3, color: glow, glow: new Glow(step) };
  // Stretches behind the front: the head's in every layer (the bloom only near the front), then the wake.
  const stretches: { from: number; to: number; level: number; u: number; layers: (typeof layers)[number][] }[] = [];
  for (let k = 0; k < SEGMENTS; k++) {
    const u = (k + 0.5) / SEGMENTS;
    stretches.push({
      from: (k / SEGMENTS) * PULSE_LENGTH,
      to: ((k + 1) / SEGMENTS) * PULSE_LENGTH,
      level: (1 - u) ** 1.6,
      u,
      layers: u < 0.5 ? layers : layers.slice(1),
    });
  }
  for (let k = 0; k < WAKE_SEGMENTS; k++) {
    const level = 0.55 * (1 - (k + 0.5) / WAKE_SEGMENTS);
    stretches.push({ from: PULSE_LENGTH + (k / WAKE_SEGMENTS) * WAKE, to: PULSE_LENGTH + ((k + 1) / WAKE_SEGMENTS) * WAKE, level, u: 1, layers: [wake] });
  }
  // The bloom reaches farthest beyond a chain's box.
  const reach = 4 * haloReach + 0.7 * vessels.maxWidth;
  for (const c of vessels.chains) {
    if (!sees(view, c.box, reach)) continue;
    const first = c.ds[0]!, last = c.ds[c.ds.length - 1]!;
    const maxAge = (vessels.reach[c.tree]! + PULSE_LENGTH + WAKE) / PULSE_SPEED;
    for (const stroke of STROKES) for (const age of pulseAges(clock, stroke.phase, maxAge)) {
      const front = age * PULSE_SPEED;
      if (first > front || last < front - PULSE_LENGTH - WAKE) continue;
      const fade = stroke.strength * (0.35 + 0.65 * Math.exp(-front / 1250));
      for (const st of stretches) {
        const level = Math.round(LEVELS * fade * st.level);
        if (level <= 0) continue;
        const piece = stretch(c, Math.max(first, front - st.to), Math.min(last, front - st.from));
        if (!piece) continue;
        const { nx, ny } = normals(piece.xs, piece.ys);
        const head = piece.xs.length - 1;
        for (const layer of st.layers) {
          const half = piece.ws.map((w) => layer.half(w, st.u));
          band(layer.glow.at(level), piece.xs, piece.ys, nx, ny, half.map((h) => -h), half);
          // The front of the head is round.
          if (st.from === 0 && front < last) circle(layer.glow.at(level), piece.xs[head]!, piece.ys[head]!, layer.half(piece.ws[head]!, 0));
        }
      }
    }
  }
  wake.glow.fill(ctx, glow, wake.alpha);
  for (const layer of layers) layer.glow.fill(ctx, layer.color, layer.alpha);
}

/** Each tip flashes as its pulse arrives, then fades before the next beat. */
export function drawTips(ctx: CanvasRenderingContext2D, world: World, clock: Clock, view: View, step: number): void {
  const { vessels, palette } = world;
  const halo = new Glow(step), core = new Glow(step);
  for (const t of vessels.tips) {
    const travel = t.distance / PULSE_SPEED / BEAT_MS;
    let flash = 0;
    for (const stroke of STROKES) flash = Math.max(flash, stroke.strength * Math.exp(-(wrap(clock.beats - stroke.phase - travel, 1) * BEAT_MS) / 260));
    const level = Math.round(LEVELS * flash);
    if (level <= 0) continue;
    const [x, y, r] = bulbAt(t);
    const reach = r * (1.5 + 1.6 * flash);
    if (!seesDisc(view, x, y, reach)) continue;
    circle(halo.at(level), x, y, reach);
    circle(core.at(level), x, y, r * 0.62);
  }
  halo.fill(ctx, rgba(palette.glow, 1), 0.3);
  core.fill(ctx, rgba(palette.spark, 1), 0.8);
}
