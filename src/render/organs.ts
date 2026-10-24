// Organs: the iris breathes, opening and closing its blades with the breath and flashing when the pulse
// arrives; the escapement keeps time, its anchor and pendulum rocking once every two beats while the
// escape wheel clicks forward half a tooth on each beat as the pulse arrives; the lung's two pleated
// bellows fill and empty with the breath.

import { TAU } from "../engine/geometry.js";
import { BEAT_MS, ratchet, wrap, type Clock } from "../engine/rhythm.js";
import type { Organ } from "../world/organs.js";
import { mix, rgba } from "../world/palette.js";
import type { World } from "../world/world.js";
import { heartLit } from "./ground.js";
import { bar, circle, fillShifted, Glow, LEVELS, LIGHT_X, LIGHT_Y, Pen, ring, rotatedRect } from "./shapes.js";
import { pixels, seesDisc, type View } from "./view.js";

/** Adds a closed outline through the points, reversed if needed so that it is wound clockwise on screen. */
function outline(pen: Pen, xs: number[], ys: number[]): void {
  let area = 0;
  for (let i = 0; i < xs.length; i++) {
    const j = (i + 1) % xs.length;
    area += xs[i]! * ys[j]! - xs[j]! * ys[i]!;
  }
  const order = area >= 0 ? xs.map((_, i) => i) : xs.map((_, i) => xs.length - 1 - i);
  pen.move(xs[order[0]!]!, ys[order[0]!]!);
  for (let k = 1; k < order.length; k++) pen.line(xs[order[k]!]!, ys[order[k]!]!);
  pen.close();
}

/** Every pass of the organs' drawing, in the order they are filled. */
class OrganPasses {
  /** Drop shadows: plates and bellows. */
  readonly shadow: Pen;
  readonly plate: Pen;
  /** Engine-turned rings on a plate. */
  readonly turned: Pen;
  /** The light behind an iris's blades. */
  readonly glow: Glow;
  /** An iris's blades in three tones, by how much they face the light, and the seams between them. */
  readonly blades: [Pen, Pen, Pen];
  readonly seams: Pen;
  /** Housing rings and inlet pipes, and the housings' bolts. */
  readonly rim: Pen;
  readonly bolts: Pen;
  /** A lung's bellows, the folds between their pleats, and the ridges of the pleats. */
  readonly leather: Pen;
  readonly folds: Pen;
  readonly ridges: Pen;
  /** The pendulum, behind the wheel. */
  readonly backSteel: Pen;
  readonly backBrass: Pen;
  readonly backDark: Pen;
  /** Escape wheels and the lungs' plates, then the wheels' windows. */
  readonly brass: Pen;
  readonly dark: Pen;
  /** The anchor. */
  readonly steel: Pen;
  /** Parts in front of the anchor: the pivot cap, the lungs' manifolds, and jewel settings. */
  readonly front: Pen;
  readonly frontDark: Pen;
  readonly jewels: Glow;

  constructor(step: number) {
    const pen = () => new Pen(step);
    this.shadow = pen();
    this.plate = pen();
    this.turned = pen();
    this.glow = new Glow(step);
    this.blades = [pen(), pen(), pen()];
    this.seams = pen();
    this.rim = pen();
    this.bolts = pen();
    this.leather = pen();
    this.folds = pen();
    this.ridges = pen();
    this.backSteel = pen();
    this.backBrass = pen();
    this.backDark = pen();
    this.brass = pen();
    this.dark = pen();
    this.steel = pen();
    this.front = pen();
    this.frontDark = pen();
    this.jewels = new Glow(step);
  }
}

/** How strongly the pulse that reached the organ last still shows, 1 on arrival. */
const pulseFlash = (o: Organ, clock: Clock) => Math.exp(-(wrap(clock.beats - o.delay, 1) * BEAT_MS) / 240);

/** The pipe from the vessel tip that feeds an organ to its body, starting `from` its centre. */
function inlet(p: OrganPasses, o: Organ, from: number): void {
  if (!o.inlet) return;
  const a = Math.atan2(o.inlet.y - o.y, o.inlet.x - o.x);
  bar(p.rim, o.x + from * Math.cos(a), o.y + from * Math.sin(a), o.inlet.x, o.inlet.y, Math.max(3, o.inlet.width) + 3);
}

function housing(p: OrganPasses, o: Organ, inner: number, bolts: number): void {
  circle(p.shadow, o.x, o.y, o.radius);
  circle(p.plate, o.x, o.y, o.radius);
  ring(p.rim, o.x, o.y, inner, o.radius);
  for (let k = 0; k < bolts; k++) {
    const a = o.angle + ((k + 0.5) * TAU) / bolts;
    circle(p.bolts, o.x + (inner + o.radius) * 0.5 * Math.cos(a), o.y + (inner + o.radius) * 0.5 * Math.sin(a), o.radius * 0.03);
  }
  inlet(p, o, o.radius * 0.9);
}

/** The breath of an organ, 0 (empty) to 1 (full), following the pulse's arrival a little. */
const breathOf = (o: Organ, clock: Clock) => 0.5 - 0.5 * Math.cos(TAU * (clock.breathPhase - o.delay / 6));

/** The iris: blades tiling the ring around an aperture that opens with the breath. */
function iris(p: OrganPasses, o: Organ, clock: Clock): void {
  const inner = o.radius * 0.74;
  housing(p, o, inner, 2 * o.count);
  const breath = breathOf(o, clock);
  const flash = pulseFlash(o, clock);
  const level = Math.round(LEVELS * Math.min(1, 0.25 + 0.45 * breath + 0.5 * flash));
  circle(p.glow.at(level), o.x, o.y, inner);
  circle(p.jewels.at(Math.round(LEVELS * flash)), o.x, o.y, inner * 0.3);

  const n = o.count;
  const a = inner * (0.1 + 0.62 * breath);
  const reach = inner + o.radius * 0.03;
  const out = Math.sqrt(reach * reach - a * a);
  const turn = o.angle + 0.95 * breath;
  const phi = (k: number) => turn + (k * TAU) / n;
  const vertex = (k: number): [number, number] => {
    const m = (phi(k - 1) + phi(k)) / 2, r = a / Math.cos(Math.PI / n);
    return [o.x + r * Math.cos(m), o.y + r * Math.sin(m)];
  };
  // The point where the line of blade k (tangent to the aperture) meets the housing.
  const meet = (k: number): [number, number] => {
    const f = phi(k);
    return [o.x + a * Math.cos(f) - out * Math.sin(f), o.y + a * Math.sin(f) + out * Math.cos(f)];
  };
  for (let k = 0; k < n; k++) {
    const [vx, vy] = vertex(k), [ax, ay] = meet(k), [bx, by] = meet(k - 1);
    const xs = [vx, ax], ys = [vy, ay];
    const a0 = Math.atan2(ay - o.y, ax - o.x);
    let a1 = Math.atan2(by - o.y, bx - o.x);
    while (a1 > a0) a1 -= TAU;
    const steps = Math.max(2, Math.ceil(((a0 - a1) * reach) / 6));
    for (let i = 1; i <= steps; i++) {
      const t = a0 + ((a1 - a0) * i) / steps;
      xs.push(o.x + reach * Math.cos(t));
      ys.push(o.y + reach * Math.sin(t));
    }
    // Blades facing the light are brighter.
    const facing = Math.cos(phi(k)) * LIGHT_X + Math.sin(phi(k)) * LIGHT_Y;
    outline(p.blades[facing > 0.35 ? 2 : facing < -0.35 ? 0 : 1], xs, ys);
    const [wx, wy] = vertex(k + 1);
    bar(p.seams, wx, wy, ax, ay, Math.max(0.8, o.radius * 0.016));
  }
}

/** The escapement: escape wheel, anchor and pendulum on a turned plate, hanging as gravity wants. */
function escapement(p: OrganPasses, o: Organ, clock: Clock): void {
  const R = o.radius;
  housing(p, o, R * 0.93, 8);
  for (let r = R * 0.14; r < R * 0.9; r += R * 0.036) ring(p.turned, o.x, o.y, r, r + R * 0.009);
  const x = clock.beats - o.delay;
  const swing = 0.16 * Math.sin(Math.PI * x);
  const [px, py] = [o.x, o.y - 0.55 * R];
  const wheelR = 0.3 * R, wx = o.x, wy = o.y - 0.05 * R;
  // Anchor and pendulum are one rigid piece rocking about the pivot.
  const c = Math.cos(swing), s = Math.sin(swing);
  const rocked = (dx: number, dy: number): [number, number] => [px + dx * c - dy * s, py + dx * s + dy * c];

  // The pendulum hangs behind the wheel.
  const [bx, by] = rocked(0, 1.25 * R);
  bar(p.backSteel, px, py, bx, by, R * 0.04);
  circle(p.backBrass, bx, by, R * 0.16);
  circle(p.backDark, bx, by, R * 0.055);

  // Escape wheel: ratchet teeth and four windows; half a tooth per beat, as the pulse arrives.
  const n = o.count;
  const base = (TAU / n) * 0.5 * (Math.floor(x) + ratchet(x - Math.floor(x)));
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = base + (i * TAU) / n;
    for (const [r, t] of [[wheelR * 0.78, t0], [wheelR, t0 + (0.6 * TAU) / n], [wheelR * 0.78, t0 + (0.66 * TAU) / n]] as const) {
      xs.push(wx + r * Math.cos(t));
      ys.push(wy + r * Math.sin(t));
    }
  }
  outline(p.brass, xs, ys);
  for (let j = 0; j < 4; j++) {
    const t0 = base + (j * TAU) / 4 + 0.22, t1 = base + ((j + 1) * TAU) / 4 - 0.22;
    const hx: number[] = [], hy: number[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = t0 + ((t1 - t0) * i) / 8;
      hx.push(wx + wheelR * 0.62 * Math.cos(t));
      hy.push(wy + wheelR * 0.62 * Math.sin(t));
    }
    for (let i = 8; i >= 0; i--) {
      const t = t0 + ((t1 - t0) * i) / 8;
      hx.push(wx + wheelR * 0.24 * Math.cos(t));
      hy.push(wy + wheelR * 0.24 * Math.sin(t));
    }
    outline(p.dark, hx, hy);
  }

  // The anchor's arms reach down to pallets on either side of the wheel's top.
  const reach = 0.5 * R - wheelR * Math.cos(0.66);
  for (const side of [-1, 1]) {
    const [ex, ey] = rocked(side * wheelR * Math.sin(0.66), reach);
    bar(p.steel, px, py, ex, ey, R * 0.065);
    circle(p.steel, ex, ey, R * 0.045);
  }
  circle(p.front, px, py, R * 0.085);
  const flash = pulseFlash(o, clock);
  for (const [jx, jy] of [[px, py], [wx, wy]] as const) {
    circle(p.frontDark, jx, jy, R * 0.045);
    circle(p.jewels.at(Math.round(LEVELS * (0.3 + 0.7 * flash))), jx, jy, R * 0.03);
  }
}

/** The lung: two pleated bellows on a manifold, filling and emptying with the breath. */
function lung(p: OrganPasses, o: Organ, clock: Clock): void {
  const R = o.radius, n = o.count;
  const c = Math.cos(o.angle), s = Math.sin(o.angle);
  const at = (x: number, y: number): [number, number] => [o.x + x * c - y * s, o.y + x * s + y * c];
  const length = R * (0.34 + 0.34 * breathOf(o, clock));
  const start = 0.24 * R;
  inlet(p, o, 0.18 * R);
  for (const side of [-1, 1]) {
    const x = (k: number) => side * (start + (k * length) / (2 * n));
    const half = (k: number) => (k % 2 === 0 ? 0.37 : 0.29) * R;
    const xs: number[] = [], ys: number[] = [];
    for (let k = 0; k <= 2 * n; k++) {
      const [px, py] = at(x(k), -half(k));
      xs.push(px);
      ys.push(py);
    }
    for (let k = 2 * n; k >= 0; k--) {
      const [px, py] = at(x(k), half(k));
      xs.push(px);
      ys.push(py);
    }
    outline(p.leather, xs, ys);
    outline(p.shadow, xs, ys);
    for (let k = 1; k < 2 * n; k++) bar(k % 2 ? p.folds : p.ridges, ...at(x(k), -half(k)), ...at(x(k), half(k)), R * 0.014);
    // The plates that hold each bellows: one on the manifold, one moving with the breath.
    for (const [a0, a1] of [[start - 0.07 * R, start], [start + length, start + length + 0.08 * R]] as const) {
      const lo = side > 0 ? a0 : -a1, hi = side > 0 ? a1 : -a0;
      rotatedRect(p.brass, o.x, o.y, o.angle, lo, hi, -0.43 * R, 0.43 * R);
    }
  }
  circle(p.front, o.x, o.y, 0.2 * R);
  circle(p.frontDark, o.x, o.y, 0.09 * R);
  for (let k = 0; k < 6; k++) circle(p.frontDark, ...at(0.145 * R * Math.cos((k * TAU) / 6), 0.145 * R * Math.sin((k * TAU) / 6)), 0.018 * R);
  circle(p.jewels.at(Math.round(LEVELS * (0.3 + 0.7 * pulseFlash(o, clock)))), o.x, o.y, 0.05 * R);
}

export function drawOrgans(ctx: CanvasRenderingContext2D, world: World, clock: Clock, view: View, step: number): void {
  const { palette } = world;
  const p = new OrganPasses(step);
  for (const o of world.organs) {
    // An organ reaches as far as its housing's shadow, or the end of its inlet pipe.
    const inletReach = o.inlet ? Math.hypot(o.inlet.x - o.x, o.inlet.y - o.y) + Math.max(3, o.inlet.width) + 4 : 0;
    if (!seesDisc(view, o.x, o.y, Math.max(o.radius + 40, inletReach))) continue;
    if (o.kind === "iris") iris(p, o, clock);
    else if (o.kind === "escapement") escapement(p, o, clock);
    else lung(p, o, clock);
  }
  const { body, steel } = palette.heart;
  const drop = pixels(view, 4, 5);
  ctx.fillStyle = palette.shade;
  fillShifted(ctx, p.shadow.path, drop * 0.8, drop);
  ctx.fillStyle = mix(palette.ink, body.dark, 0.55);
  ctx.fill(p.plate.path);
  ctx.globalAlpha = 0.09;
  ctx.fillStyle = body.shine;
  ctx.fill(p.turned.path);
  ctx.globalAlpha = 1;
  p.glow.fill(ctx, rgba(palette.glow, 1), 0.55);
  const tones = [steel.dark, steel.base, steel.light];
  p.blades.forEach((pen, i) => {
    ctx.fillStyle = tones[i]!;
    ctx.fill(pen.path);
  });
  ctx.fillStyle = palette.ink;
  ctx.fill(p.seams.path);
  ctx.fillStyle = heartLit(ctx, world, body.light, body.base, body.dark);
  ctx.fill(p.rim.path);
  ctx.fillStyle = body.shine;
  ctx.fill(p.bolts.path);
  ctx.fillStyle = heartLit(ctx, world, palette.vessel.shine, palette.vessel.wall, palette.vessel.edge);
  ctx.fill(p.leather.path);
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = palette.ink;
  ctx.fill(p.folds.path);
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = palette.vessel.shine;
  ctx.fill(p.ridges.path);
  ctx.globalAlpha = 1;
  ctx.fillStyle = steel.base;
  ctx.fill(p.backSteel.path);
  ctx.fillStyle = heartLit(ctx, world, body.light, body.base, body.dark);
  ctx.fill(p.backBrass.path);
  ctx.fillStyle = palette.ink;
  ctx.fill(p.backDark.path);
  ctx.fillStyle = heartLit(ctx, world, body.light, body.base, body.dark);
  ctx.fill(p.brass.path);
  ctx.fillStyle = palette.ink;
  ctx.fill(p.dark.path);
  ctx.fillStyle = steel.light;
  ctx.fill(p.steel.path);
  ctx.fillStyle = heartLit(ctx, world, body.light, body.base, body.dark);
  ctx.fill(p.front.path);
  ctx.fillStyle = palette.ink;
  ctx.fill(p.frontDark.path);
  p.jewels.fill(ctx, rgba(palette.spark, 1), 0.9);
}
