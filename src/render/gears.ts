// Gears. Each gear's outline (teeth, rim, spokes or holes) is built once per scale in its own
// coordinates and rasterized into sprites (its shadow, dark and lit edges, and body); every frame
// stamps the sprites turned to the gear's angle. A gear too large for a sprite at this scale is drawn
// from its paths.

import { TAU } from "../engine/geometry.js";
import { teethAdvanced, type Clock } from "../engine/rhythm.js";
import type { Gear, Train } from "../world/gears.js";
import type { Metal } from "../world/palette.js";
import type { World } from "../world/world.js";
import { heartLit, heartLitAt } from "./ground.js";
import { circle, hole, Pen, placed, polygon, ring, worldPath } from "./shapes.js";
import { pixels, seesDisc, type View } from "./view.js";

interface GearShape {
  body: Path2D;
  /** Dark details: axle, hub groove, bolts. */
  detail: Path2D;
  /** A lit ring on the rim. */
  shine: Path2D;
}

/** Gear shapes of one world at one scale, built as gears come into view. */
export type GearShapes = Map<Gear, GearShape>;

/** Radii of a gear's body: hub and inner rim. */
function bodyRadii(g: Gear): { hub: number; rim: number; open: boolean } {
  const hub = Math.max(2.2 * g.module, 0.24 * g.pitch);
  const rim = g.root - Math.max(1.7 * g.module, 0.11 * g.pitch);
  return { hub, rim, open: g.style !== "solid" && rim - hub > 3 * g.module };
}

function gearShape(g: Gear, step: number): GearShape {
  const body = new Pen(step, true);
  const p = Math.PI / g.teeth;
  const at = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];
  body.move(...at(g.root, -0.64 * p));
  for (let i = 0; i < g.teeth; i++) {
    const a = 2 * p * i;
    body.line(...at(g.pitch, a - 0.47 * p));
    body.line(...at(g.outer, a - 0.27 * p));
    body.line(...at(g.outer, a + 0.27 * p));
    body.line(...at(g.pitch, a + 0.47 * p));
    body.line(...at(g.root, a + 0.64 * p));
    body.arc(0, 0, g.root, a + 0.64 * p, a + 1.36 * p);
  }
  body.close();

  const { hub, rim, open } = bodyRadii(g);
  const s = g.symmetry;
  if (open && g.style === "holes") {
    const rc = (hub + rim) / 2;
    const rr = Math.min((rim - hub) * 0.36, rc * Math.sin(Math.PI / s) * 0.62);
    for (let j = 0; j < s; j++) hole(body, rc * Math.cos((j * TAU) / s), rc * Math.sin((j * TAU) / s), rr);
  } else if (open) {
    // Windows between constant-width spokes, wound anticlockwise so that they cut through.
    const spoke = Math.max(1.4 * g.module, 0.09 * g.pitch);
    const inner = hub + 0.8 * g.module;
    for (let j = 0; j < s; j++) {
      const a0 = (j * TAU) / s, a1 = ((j + 1) * TAU) / s;
      const dOut = Math.asin(Math.min(0.95, spoke / 2 / rim)), dIn = Math.asin(Math.min(0.95, spoke / 2 / inner));
      if (a1 - a0 - 2 * dIn < 0.15) continue;
      body.move(...at(rim, a1 - dOut));
      body.arc(0, 0, rim, a1 - dOut, a0 + dOut);
      body.arc(0, 0, inner, a0 + dIn, a1 - dIn);
      body.close();
    }
  }

  const detail = new Pen(step, true);
  circle(detail, 0, 0, Math.max(1.1, hub * 0.36));
  if (open) {
    ring(detail, 0, 0, hub * 0.9, hub);
    if (hub > 5) {
      const bolt = Math.max(0.55, hub * 0.1);
      for (let j = 0; j < s; j++) circle(detail, ...at(hub * 0.64, ((j + 0.5) * TAU) / s), bolt);
    }
  } else {
    ring(detail, 0, 0, g.pitch * 0.5, g.pitch * 0.5 + Math.max(0.5, g.module * 0.3));
  }
  const shine = new Pen(step, true);
  if (open) ring(shine, 0, 0, rim, rim + Math.max(0.5, g.module * 0.32));
  else ring(shine, 0, 0, g.pitch * 0.62, g.pitch * 0.62 + Math.max(0.4, g.module * 0.22));
  return { body: body.path, detail: detail.path, shine: shine.path };
}

/** A gear's angle at this moment. */
export function gearAngle(g: Gear, train: Train, clock: Clock): number {
  return g.phase + g.turn * (TAU / g.teeth) * teethAdvanced(clock, train.perBeat, train.clicks, train.delay);
}

/** A gear rasterized once per scale: its silhouette in shadow (and in dark and light), and its body. */
interface GearSprites {
  shadow: HTMLCanvasElement;
  dark: HTMLCanvasElement | null;
  light: HTMLCanvasElement | null;
  body: HTMLCanvasElement;
}

/** Gear shapes and sprites of one world at one scale, built as gears come into view. */
export interface GearCache {
  shapes: GearShapes;
  sprites: Map<Gear, GearSprites | null>;
}

export const newGearCache = (): GearCache => ({ shapes: new Map(), sprites: new Map() });

/** Gears whose sprite would be wider than this many pixels are drawn as paths instead. */
const MAX_SPRITE_PX = 640;

export type MakeCanvas = (width: number, height: number) => HTMLCanvasElement;

function sprite(make: MakeCanvas, g: Gear, scale: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const size = Math.ceil(2 * (g.outer + 2) * scale) + 4;
  const canvas = make(size, size);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.setTransform(scale, 0, 0, scale, size / 2, size / 2);
  paint(ctx);
  return canvas;
}

function gearSprites(make: MakeCanvas, world: World, g: Gear, shape: GearShape, metal: Metal, deep: boolean, scale: number): GearSprites | null {
  if (2 * (g.outer + 2) * scale > MAX_SPRITE_PX) return null;
  const { palette } = world;
  const silhouette = (color: string, alpha: number) =>
    sprite(make, g, scale, (ctx) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fill(shape.body);
    });
  const tone = heartLitAt(world, g.x, g.y, metal.light, metal.base, metal.dark);
  return {
    shadow: silhouette(palette.shade, deep ? 0.6 : 1),
    dark: deep ? null : silhouette(metal.dark, 1),
    light: deep ? null : silhouette(metal.light, 1),
    body: sprite(make, g, scale, (ctx) => {
      ctx.fillStyle = tone;
      ctx.fill(shape.body);
      ctx.fillStyle = metal.dark;
      ctx.fill(shape.detail);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = metal.shine;
      ctx.fill(shape.shine);
    }),
  };
}

interface Visible {
  g: Gear;
  angle: number;
  metal: Metal;
  shape: GearShape;
  sprites: GearSprites | null;
}

/**
 * Draws one layer of gears in passes over all of them: shadows, dark edges, lit edges, bodies. A gear
 * comes from its sprites, turned to its angle, or (when too large for a sprite) from its paths.
 */
export function drawGears(
  ctx: CanvasRenderingContext2D,
  world: World,
  cache: GearCache,
  clock: Clock,
  view: View,
  step: number,
  scale: number,
  make: MakeCanvas,
  layer: Train["layer"],
): void {
  const { works, palette } = world;
  const deep = layer === "deep";
  const rim = Math.min(2.2, pixels(view, 0.9, 0.35));
  const drop = deep ? pixels(view, 5, 7) : pixels(view, 2.6, 2.8);
  const visible: Visible[] = [];
  for (const train of works.trains) {
    if (train.layer !== layer) continue;
    const metal = deep ? palette.deep : palette.metals[train.tone]!;
    for (const index of train.gears) {
      const g = works.gears[index]!;
      if (!seesDisc(view, g.x + drop / 2, g.y + drop / 2, g.outer + drop)) continue;
      let shape = cache.shapes.get(g);
      if (!shape) cache.shapes.set(g, (shape = gearShape(g, step)));
      let sprites = cache.sprites.get(g);
      if (sprites === undefined) cache.sprites.set(g, (sprites = gearSprites(make, world, g, shape, metal, deep, scale)));
      visible.push({ g, angle: gearAngle(g, train, clock), metal, shape, sprites });
    }
  }

  const base = ctx.getTransform();
  /** Draws a sprite centred on (x, y), turned by `angle`. */
  const stamp = (image: HTMLCanvasElement, x: number, y: number, angle: number) => {
    const c = Math.cos(angle) / scale, s = Math.sin(angle) / scale;
    ctx.setTransform(
      base.a * c + base.c * s,
      base.b * c + base.d * s,
      -base.a * s + base.c * c,
      -base.b * s + base.d * c,
      base.a * x + base.c * y + base.e,
      base.b * x + base.d * y + base.f,
    );
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
  };
  // Pass by pass across all gears, so that no gear's edge falls on a neighbour's body. Gears without
  // sprites go into one path per tone and pass.
  for (const pass of ["shadow", "dark", "light", "body"] as const) {
    if (deep && (pass === "dark" || pass === "light")) continue;
    const dx = pass === "shadow" ? drop * 0.8 : pass === "dark" ? rim : pass === "light" ? -rim : 0;
    const dy = pass === "shadow" ? drop : dx;
    const batches = new Map<Metal, { body: Path2D; detail: Path2D; shine: Path2D }>();
    for (const v of visible) {
      const x = v.g.x + dx, y = v.g.y + dy;
      if (v.sprites) {
        stamp(v.sprites[pass]!, x, y, v.angle);
        continue;
      }
      let batch = batches.get(v.metal);
      if (!batch) batches.set(v.metal, (batch = { body: worldPath(), detail: worldPath(), shine: worldPath() }));
      batch.body.addPath(v.shape.body, placed(x, y, v.angle));
      if (pass === "body") {
        batch.detail.addPath(v.shape.detail, placed(x, y, v.angle));
        batch.shine.addPath(v.shape.shine, placed(x, y, v.angle));
      }
    }
    ctx.setTransform(base);
    for (const [metal, batch] of batches) {
      if (pass === "shadow") {
        ctx.globalAlpha = deep ? 0.6 : 1;
        ctx.fillStyle = palette.shade;
      } else {
        ctx.fillStyle = pass === "dark" ? metal.dark : pass === "light" ? metal.light : heartLit(ctx, world, metal.light, metal.base, metal.dark);
      }
      ctx.fill(batch.body);
      ctx.globalAlpha = 1;
      if (pass !== "body") continue;
      ctx.fillStyle = metal.dark;
      ctx.fill(batch.detail);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = metal.shine;
      ctx.fill(batch.shine);
      ctx.globalAlpha = 1;
    }
  }
}

/** The hub where a working train meets its vessel: a capped coupling that turns with the driver. */
export function drawCouplings(ctx: CanvasRenderingContext2D, world: World, clock: Clock, view: View, step: number): void {
  const { works, palette } = world;
  const edge = new Pen(step), cap = new Pen(step), nut = new Pen(step), dots = new Pen(step);
  for (const train of works.trains) {
    const j = train.junction;
    if (!j) continue;
    const r = j.width * 0.62 + 1.5;
    if (!seesDisc(view, j.x, j.y, r + 2)) continue;
    const driver = works.gears[train.gears[0]!]!;
    const angle = gearAngle(driver, train, clock);
    circle(edge, j.x, j.y, r + 1.3);
    circle(cap, j.x, j.y, r);
    // The nut has the driver's symmetry (doubled below five sides), so it too closes the cycle.
    polygon(nut, j.x, j.y, r * 0.52, driver.symmetry < 5 ? 2 * driver.symmetry : driver.symmetry, angle);
    circle(dots, j.x, j.y, Math.max(0.6, r * 0.18));
    for (let k = 0; k < driver.symmetry; k++) {
      const a = angle + ((k + 0.5) * TAU) / driver.symmetry;
      circle(dots, j.x + r * 0.78 * Math.cos(a), j.y + r * 0.78 * Math.sin(a), Math.max(0.45, r * 0.08));
    }
  }
  ctx.fillStyle = palette.vessel.edge;
  ctx.fill(edge.path);
  ctx.fillStyle = palette.vessel.collar;
  ctx.fill(cap.path);
  ctx.fillStyle = palette.metals[0]!.light;
  ctx.fill(nut.path);
  ctx.fillStyle = palette.vessel.edge;
  ctx.fill(dots.path);
}
