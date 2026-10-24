// The ground the machine lies on: a deep radial gradient, the body's cells, and dotted construction rings
// and rays centred on the heart (all still, kept in a bitmap layer); the light the heart throws around
// itself; and a veil that darkens the ground's far corners.

import { TAU } from "../engine/geometry.js";
import { clamp01, type Clock } from "../engine/rhythm.js";
import { hex, mix, rgba } from "../world/palette.js";
import type { World } from "../world/world.js";
import { circle, fillShifted, Glow, hole, LEVELS, Pen } from "./shapes.js";
import { pixels, sees, seesDisc, type View } from "./view.js";

/** Distance between the dots of a construction line, and their radius. */
const DOT_STEP = 15;
const DOT_RADIUS = 1.15;
/** Where the heart's light starts to fall off, and where it ends, as multiples of the heart's radius. */
const LIT_FROM = 0.8;
const LIT_TO = 1500;

/** The still art of the ground: cells in a few densities, their nuclei, and the construction dots. */
export interface GroundArt {
  cells: Path2D[];
  nuclei: Path2D;
  dots: Path2D;
}

/** A small cog: a toothed disc with a hole, as a cell's nucleus. */
function cog(pen: Pen, x: number, y: number, r: number, teeth: number): void {
  const p = Math.PI / teeth;
  for (let k = 0; k < 2 * teeth; k++) {
    const a = k * p, out = k % 2 === 0;
    const r0 = out ? r : r * 0.74;
    if (k === 0) pen.move(x + r0 * Math.cos(a - 0.4 * p), y + r0 * Math.sin(a - 0.4 * p));
    else pen.line(x + r0 * Math.cos(a - 0.4 * p), y + r0 * Math.sin(a - 0.4 * p));
    pen.line(x + r0 * Math.cos(a + 0.4 * p), y + r0 * Math.sin(a + 0.4 * p));
  }
  pen.close();
  hole(pen, x, y, r * 0.32);
}

/** Cell densities: each cell is drawn in the nearest of these. */
const CELL_TONES = 4;

export function buildGroundArt(world: World, view: View, step: number): GroundArt {
  const { heart } = world;
  const cells = Array.from({ length: CELL_TONES }, () => new Pen(step));
  const nuclei = new Pen(step);
  for (const c of world.tissue) {
    if (!sees(view, { x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 })) continue;
    const pen = cells[Math.min(CELL_TONES - 1, Math.floor(c.shade * CELL_TONES))]!;
    pen.move(c.xs[0]!, c.ys[0]!);
    for (let k = 1; k < c.xs.length; k++) pen.line(c.xs[k]!, c.ys[k]!);
    pen.close();
    if (c.cog) cog(nuclei, c.nx, c.ny, c.nr * 1.5, c.cog);
    else circle(nuclei, c.nx, c.ny, c.nr);
  }
  const pen = new Pen(step);
  const dot = (x: number, y: number) => {
    if (seesDisc(view, x, y, DOT_RADIUS)) circle(pen, x, y, DOT_RADIUS);
  };
  const inner = heart.radius + 34;
  for (let r = inner; r < 1480; r += 92) {
    const count = Math.round((TAU * r) / DOT_STEP);
    for (let k = 0; k < count; k++) dot(heart.cx + r * Math.cos((k * TAU) / count), heart.cy + r * Math.sin((k * TAU) / count));
  }
  const rays = heart.cylinders * 4;
  for (let i = 0; i < rays; i++) {
    const a = heart.axes[0]! + ((i + 0.5) * TAU) / rays;
    for (let r = inner + DOT_STEP; r < 1480; r += DOT_STEP) dot(heart.cx + r * Math.cos(a), heart.cy + r * Math.sin(a));
  }
  return { cells: cells.map((c) => c.path), nuclei: nuclei.path, dots: pen.path };
}

/**
 * A fill lit by the heart: `near` around the heart, `mid` partway out, `far` at the corners. Defined
 * in world units, so every window into the world gets the same light.
 */
export function heartLit(ctx: CanvasRenderingContext2D, world: World, near: string, mid: string, far: string): CanvasGradient {
  const { cx, cy, radius } = world.heart;
  const light = ctx.createRadialGradient(cx, cy, radius * LIT_FROM, cx, cy, LIT_TO);
  light.addColorStop(0, near);
  light.addColorStop(0.3, mid);
  light.addColorStop(1, far);
  return light;
}

/** The colour heartLit gives at one point, for parts that are coloured whole. */
export function heartLitAt(world: World, x: number, y: number, near: string, mid: string, far: string): string {
  const { cx, cy, radius } = world.heart;
  const t = clamp01((Math.hypot(x - cx, y - cy) - radius * LIT_FROM) / (LIT_TO - radius * LIT_FROM));
  return t < 0.3 ? mix(near, mid, t / 0.3) : mix(mid, far, (t - 0.3) / 0.7);
}

function fillView(ctx: CanvasRenderingContext2D, view: View): void {
  ctx.fillRect(view.x0 - 4, view.y0 - 4, view.x1 - view.x0 + 8, view.y1 - view.y0 + 8);
}

/** The ground's radial gradient, through three colours: at the heart, midway, at the corners. */
function groundGradient(ctx: CanvasRenderingContext2D, world: World, colours: readonly string[]): CanvasGradient {
  const { cx, cy } = world.heart;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1450);
  g.addColorStop(0, colours[0]!);
  g.addColorStop(0.42, colours[1]!);
  g.addColorStop(1, colours[2]!);
  return g;
}

/**
 * The still ground: gradient, the body's cells, and construction dots. Each cell is the ground lifted
 * a little toward the tissue's tint, with a lit rim above and to the left and a shaded one below.
 */
export function drawGround(ctx: CanvasRenderingContext2D, world: World, art: GroundArt, view: View): void {
  const { palette } = world;
  const tint = hex(palette.tissue);
  const toward = (colour: string, t: number) => groundGradient(ctx, world, palette.ground.map((g) => mix(g, colour, t)));
  ctx.fillStyle = groundGradient(ctx, world, palette.ground);
  fillView(ctx, view);
  const rim = pixels(view, 1, 0.9);
  ctx.fillStyle = toward(tint, 0.14);
  for (const path of art.cells) fillShifted(ctx, path, -rim, -rim);
  ctx.fillStyle = toward("#000000", 0.3);
  for (const path of art.cells) fillShifted(ctx, path, rim, rim);
  art.cells.forEach((path, i) => {
    ctx.fillStyle = toward(tint, 0.05 + (0.06 * i) / (CELL_TONES - 1));
    ctx.fill(path);
  });
  ctx.fillStyle = toward("#000000", 0.4);
  fillShifted(ctx, art.nuclei, rim * 0.6, rim * 0.6);
  ctx.fillStyle = toward(tint, 0.17);
  ctx.fill(art.nuclei);
  ctx.fillStyle = palette.grid;
  ctx.fill(art.dots);
}

/**
 * The cells' nuclei glow faintly with the breath, a slow wave that leaves the heart with each breath
 * and takes a whole breath to reach the corners.
 */
export function drawCellGlow(ctx: CanvasRenderingContext2D, world: World, clock: Clock, view: View, step: number): void {
  const { heart, palette } = world;
  const glow = new Glow(step);
  for (const c of world.tissue) {
    if (!seesDisc(view, c.nx, c.ny, c.nr)) continue;
    const wave = 0.5 - 0.5 * Math.cos(TAU * (clock.breathPhase - Math.hypot(c.nx - heart.cx, c.ny - heart.cy) / 1400));
    const level = Math.round(LEVELS * wave * wave);
    if (level > 0) circle(glow.at(level), c.nx, c.ny, c.nr * 0.55);
  }
  glow.fill(ctx, rgba(palette.glow, 1), 0.16);
}

/** The heart's light: it swells with each contraction and, slower, with the breath. */
export function drawHeartLight(ctx: CanvasRenderingContext2D, world: World, clock: Clock, view: View): void {
  const { palette, heart } = world;
  const reach = heart.radius * (1.9 + 0.25 * clock.breath);
  const light = ctx.createRadialGradient(heart.cx, heart.cy, heart.radius * 0.4, heart.cx, heart.cy, reach);
  const strength = 0.1 + 0.05 * clock.breath + 0.12 * clock.contraction;
  light.addColorStop(0, rgba(palette.glow, strength));
  light.addColorStop(0.5, rgba(palette.glow, strength * 0.3));
  light.addColorStop(1, rgba(palette.glow, 0));
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = light;
  // Only the light's square: beyond `reach` it adds nothing.
  const x0 = Math.max(view.x0 - 4, heart.cx - reach), y0 = Math.max(view.y0 - 4, heart.cy - reach);
  const x1 = Math.min(view.x1 + 4, heart.cx + reach), y1 = Math.min(view.y1 + 4, heart.cy + reach);
  if (x1 > x0 && y1 > y0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.globalCompositeOperation = "source-over";
}

/** Darkens the ground toward the corners, so that the eye settles on the heart. */
export function drawVeil(ctx: CanvasRenderingContext2D, world: World, view: View): void {
  const { heart } = world;
  const veil = ctx.createRadialGradient(heart.cx, heart.cy, 640, heart.cx, heart.cy, 1500);
  veil.addColorStop(0, "rgba(0, 0, 0, 0)");
  veil.addColorStop(1, "rgba(0, 0, 0, 0.3)");
  ctx.fillStyle = veil;
  fillView(ctx, view);
}
