// One frame, back to front: ground, the heart's light, the cells' glow, deep gears, working gears,
// vessels, couplings, organs, pulses, tips, heart. Everything is drawn in world units under one
// viewport transform, on a context reset to its defaults first.
//
// What never moves is kept between frames: the ground and the vessels for the last few viewports, as
// bitmap layers of the canvas's size copied in at whole pixels (or, on a canvas too large for extra
// layers, as the paths to draw); the heart's casting and the gears' shapes and sprites per scale.

import type { Clock } from "../engine/rhythm.js";
import type { Viewport } from "../engine/validate.js";
import type { World } from "../world/world.js";
import { drawCouplings, drawGears, newGearCache, type GearCache, type MakeCanvas } from "./gears.js";
import { buildGroundArt, drawCellGlow, drawGround, drawHeartLight, drawVeil, type GroundArt } from "./ground.js";
import { buildHeartArt, drawHeart, type HeartArt } from "./heart.js";
import { drawOrgans } from "./organs.js";
import { MAX_EDGE_PX } from "./shapes.js";
import { buildVesselArt, drawPulses, drawTips, drawVessels, type VesselArt } from "./vessels.js";
import { seesDisc, viewOf, type View } from "./view.js";

/** Canvases larger than this many pixels keep their still parts as paths rather than bitmap layers. */
const MAX_LAYER_PIXELS = 4_500_000;
/** How many viewports keep their still parts, across all worlds. */
const KEEP_STILLS = 3;
/** How many scales a world keeps gear and heart shapes for. */
const KEEP_SCALES = 3;
/**
 * Bounds on the pixel scale and on the edge length: a viewport so small that its scale would overflow
 * is drawn at MAX_SCALE (it shows a single point either way), and edges are never split finer than
 * MIN_STEP world units, so that no path grows without bound at extreme zoom.
 */
const MAX_SCALE = 1e6;
const MIN_STEP = 0.05;

/** The still parts for one viewport on one canvas size: bitmap layers, or the paths to draw. */
type Still = { world: World; key: string } & (
  | { kind: "layers"; ground: HTMLCanvasElement; vessels: HTMLCanvasElement }
  | { kind: "paths"; ground: GroundArt; vessels: VesselArt }
);

/** Shapes a world keeps per scale. */
interface Shapes {
  gears: Map<number, GearCache>;
  hearts: Map<number, HeartArt>;
}

const stills: Still[] = [];
const shapes = new WeakMap<World, Shapes>();

function shapesFor(world: World): Shapes {
  let s = shapes.get(world);
  if (!s) shapes.set(world, (s = { gears: new Map(), hearts: new Map() }));
  return s;
}

function perScale<T>(map: Map<number, T>, key: number, make: () => T): T {
  let value = map.get(key);
  if (value === undefined) {
    if (map.size >= KEEP_SCALES) map.delete(map.keys().next().value!);
    map.set(key, (value = make()));
  }
  return value;
}

/** Sets a context to the Canvas 2D defaults a frame relies on, whatever was set on it before. */
function begin(ctx: CanvasRenderingContext2D): void {
  // reset() also drops a clip or a transform left by the caller; it is missing only in old browsers.
  if (typeof ctx.reset === "function") ctx.reset();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = "rgba(0, 0, 0, 0)";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "low";
}

interface Frame {
  world: World;
  viewport: Viewport;
  width: number;
  height: number;
  sx: number;
  sy: number;
  view: View;
  step: number;
  make: MakeCanvas;
}

const toWorld = (ctx: CanvasRenderingContext2D, f: Frame) => ctx.setTransform(f.sx, 0, 0, f.sy, -f.viewport.x * f.sx, -f.viewport.y * f.sy);

/** The opaque ground, under its veil. */
function paintGround(ctx: CanvasRenderingContext2D, f: Frame, art: GroundArt): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = f.world.palette.ground[2];
  ctx.fillRect(0, 0, f.width, f.height);
  ctx.restore();
  drawGround(ctx, f.world, art, f.view);
  drawVeil(ctx, f.world, f.view);
}

function stillFor(f: Frame): Still {
  const key = `${f.width}x${f.height}|${f.viewport.x},${f.viewport.y},${f.viewport.width},${f.viewport.height}`;
  const at = stills.findIndex((s) => s.world === f.world && s.key === key);
  if (at >= 0) {
    const [still] = stills.splice(at, 1);
    stills.unshift(still!);
    return still!;
  }
  const ground = buildGroundArt(f.world, f.view, f.step), vessels = buildVesselArt(f.world, f.view, f.step);
  let still: Still = { world: f.world, key, kind: "paths", ground, vessels };
  if (f.width * f.height <= MAX_LAYER_PIXELS) {
    const layer = (paint: (ctx: CanvasRenderingContext2D) => void) => {
      const ctx = f.make(f.width, f.height).getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      begin(ctx);
      toWorld(ctx, f);
      paint(ctx);
      return ctx.canvas;
    };
    const groundLayer = layer((ctx) => paintGround(ctx, f, ground));
    const vesselLayer = layer((ctx) => drawVessels(ctx, f.world, vessels, f.view));
    if (groundLayer && vesselLayer) still = { world: f.world, key, kind: "layers", ground: groundLayer, vessels: vesselLayer };
  }
  stills.unshift(still);
  stills.length = Math.min(stills.length, KEEP_STILLS);
  return still;
}

/** Copies a bitmap layer onto the canvas at whole pixels. */
function copy(ctx: CanvasRenderingContext2D, layer: HTMLCanvasElement): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  world: World,
  clock: Clock,
  viewport: Viewport,
  width: number,
  height: number,
  make: MakeCanvas,
): void {
  const sx = Math.min(MAX_SCALE, width / viewport.width), sy = Math.min(MAX_SCALE, height / viewport.height);
  const scale = Math.max(sx, sy);
  // The longest edge any path may have, in world units (see shapes.ts).
  const step = Math.max(MIN_STEP, MAX_EDGE_PX / scale);
  const view = viewOf(viewport, width, height);
  const f: Frame = { world, viewport, width, height, sx, sy, view, step, make };
  const still = stillFor(f);
  const own = shapesFor(world);
  const gears = perScale(own.gears, step, newGearCache);
  const { heart: h } = world;
  const heart = seesDisc(view, h.cx, h.cy, h.radius + 16) ? perScale(own.hearts, step, () => buildHeartArt(world, step)) : null;

  begin(ctx);
  ctx.save();
  toWorld(ctx, f);
  if (still.kind === "layers") copy(ctx, still.ground);
  else paintGround(ctx, f, still.ground);
  drawHeartLight(ctx, world, clock, view);
  drawCellGlow(ctx, world, clock, view, step);
  drawGears(ctx, world, gears, clock, view, step, scale, make, "deep");
  drawGears(ctx, world, gears, clock, view, step, scale, make, "working");
  if (still.kind === "layers") copy(ctx, still.vessels);
  else drawVessels(ctx, world, still.vessels, view);
  drawCouplings(ctx, world, clock, view, step);
  drawOrgans(ctx, world, clock, view, step);
  drawPulses(ctx, world, clock, view, step);
  drawTips(ctx, world, clock, view, step);
  if (heart) drawHeart(ctx, world, heart, clock, view, step);
  ctx.restore();
}
