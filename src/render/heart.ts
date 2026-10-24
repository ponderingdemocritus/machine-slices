// The heart, drawn as a cutaway radial engine: finned barrels open along their axes show the pistons;
// the crankcase is open in front, so the master rod, the articulated rods and the counterweight turn in
// plain sight. The casting never moves and is built once per scale; the moving parts are placed every
// frame from heartPose().

import { TAU } from "../engine/geometry.js";
import { BEAT_MS, wrap, type Clock } from "../engine/rhythm.js";
import { heartPose, type Heart } from "../world/heart.js";
import { rgba, type Metal } from "../world/palette.js";
import type { World } from "../world/world.js";
import { bar, circle, fillShifted, Glow, LEVELS, LIGHT_X, LIGHT_Y, Pen, placed, polygon, ring, rotatedRect, roundedRect, worldPath } from "./shapes.js";
import { pixels, seesDisc, type View } from "./view.js";

export interface HeartArt {
  silhouette: Path2D;
  cavity: Path2D;
  ribs: Path2D;
  casing: Path2D;
  bolts: Path2D;
  barrels: Path2D;
  fins: Path2D;
  slots: Path2D;
  heads: Path2D;
  fittings: Path2D;
  pits: Path2D;
}

/** The heart's unit of detail: 1 for a bore of 50. */
const unit = (h: Heart) => h.bore / 50;

/** A rectangle in a cylinder's own frame (axis along +x). */
const box = (pen: Pen, x0: number, x1: number, y0: number, y1: number) => rotatedRect(pen, 0, 0, 0, x0, x1, y0, y1);

/** One cylinder in its own frame, its axis along +x from the heart's centre. */
function cylinderParts(h: Heart, rootWidth: number, step: number) {
  const u = unit(h);
  const [barrel, fins, slot, head, fittings, pits] = Array.from({ length: 6 }, () => new Pen(step, true)) as [Pen, Pen, Pen, Pen, Pen, Pen];
  const half = h.bore / 2 + 3 * u;
  box(barrel, h.barrelStart, h.barrelEnd, -half, half);
  const pitch = 6.2 * u, thick = 2.9 * u;
  for (let r = h.barrelStart + 12 * u; r < h.barrelEnd - 4 * u; r += pitch) {
    const t = (r - h.barrelStart) / (h.barrelEnd - h.barrelStart);
    const reach = h.finReach[0] + (h.finReach[1] - h.finReach[0]) * t;
    box(fins, r, r + thick, -reach, reach);
  }
  box(slot, h.barrelStart + 3 * u, h.barrelEnd - 7 * u, -h.bore * 0.31, h.bore * 0.31);
  const hw = h.bore / 2 + 6 * u;
  roundedRect(head, h.barrelEnd - 4 * u, -hw, h.headEnd - h.barrelEnd + 4 * u, 2 * hw, 6 * u);
  for (const side of [-1, 1]) {
    circle(fittings, h.headEnd - 11 * u, side * h.bore * 0.27, 5.4 * u);
    circle(pits, h.headEnd - 11 * u, side * h.bore * 0.27, 1.9 * u);
  }
  box(fittings, h.headEnd - 3 * u, h.headEnd + 4 * u, -(rootWidth / 2 + 4 * u), rootWidth / 2 + 4 * u);
  return { barrel: barrel.path, fins: fins.path, slot: slot.path, head: head.path, fittings: fittings.path, pits: pits.path };
}

export function buildHeartArt(world: World, step: number): HeartArt {
  const { heart: h, vessels } = world;
  const u = unit(h);
  const silhouette = new Pen(step), cavity = new Pen(step), ribs = new Pen(step), casing = new Pen(step), bolts = new Pen(step);
  const art = { barrels: worldPath(), fins: worldPath(), slots: worldPath(), heads: worldPath(), fittings: worldPath(), pits: worldPath() };
  const rootWidth = (tree: number) => vessels.chains.find((c) => c.tree === tree && c.parent < 0)?.ws[0] ?? 8;
  circle(silhouette, h.cx, h.cy, h.crankcaseRadius + 8 * u);
  circle(cavity, h.cx, h.cy, h.crankcaseRadius - 8 * u);
  // Ribs of the crankcase's back wall, between the cylinders.
  for (let k = 0; k < 2 * h.cylinders; k++) {
    const a = h.axes[0]! + ((k + 0.5) * TAU) / (2 * h.cylinders);
    const r0 = h.crankcaseRadius * 0.24, r1 = h.crankcaseRadius - 10 * u;
    bar(ribs, h.cx + r0 * Math.cos(a), h.cy + r0 * Math.sin(a), h.cx + r1 * Math.cos(a), h.cy + r1 * Math.sin(a), 2.2 * u);
  }
  ring(casing, h.cx, h.cy, h.crankcaseRadius - 8 * u, h.crankcaseRadius + 7 * u);
  h.axes.forEach((axis, i) => {
    const parts = cylinderParts(h, rootWidth(i), step);
    const m = placed(h.cx, h.cy, axis);
    for (const p of [parts.barrel, parts.fins, parts.head]) silhouette.path.addPath(p, m);
    art.barrels.addPath(parts.barrel, m);
    art.fins.addPath(parts.fins, m);
    art.slots.addPath(parts.slot, m);
    art.heads.addPath(parts.head, m);
    art.fittings.addPath(parts.fittings, m);
    art.pits.addPath(parts.pits, m);
    for (const side of [-0.5, 0.5]) {
      const a = axis + (side * TAU) / h.cylinders;
      circle(bolts, h.cx + h.crankcaseRadius * Math.cos(a), h.cy + h.crankcaseRadius * Math.sin(a), 2.7 * u);
    }
  });
  return { ...art, silhouette: silhouette.path, cavity: cavity.path, ribs: ribs.path, casing: casing.path, bolts: bolts.path };
}

export function drawHeart(ctx: CanvasRenderingContext2D, world: World, art: HeartArt, clock: Clock, view: View, step: number): void {
  const { heart: h, palette } = world;
  if (!seesDisc(view, h.cx, h.cy, h.radius + 16)) return;
  const { body, steel } = palette.heart;
  const u = unit(h);
  const rim = Math.min(2.2, pixels(view, 0.9, 0.4));
  const pose = heartPose(h, clock.crankTurns);
  const pen = () => new Pen(step);

  // The casting.
  const drop = pixels(view, 5, 6);
  ctx.fillStyle = palette.shade;
  fillShifted(ctx, art.silhouette, drop * 0.8, drop);
  ctx.fillStyle = palette.ink;
  ctx.fill(art.cavity);
  // The furnace inside the crankcase brightens with every stroke.
  const furnace = ctx.createRadialGradient(h.cx, h.cy, 0, h.cx, h.cy, h.crankcaseRadius);
  furnace.addColorStop(0, rgba(palette.glow, 0.2 + 0.32 * clock.contraction));
  furnace.addColorStop(0.7, rgba(palette.glow, 0.05 + 0.08 * clock.contraction));
  furnace.addColorStop(1, rgba(palette.glow, 0));
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = furnace;
  ctx.fill(art.cavity);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = body.dark;
  ctx.fill(art.ribs);
  ctx.globalAlpha = 1;
  ctx.fillStyle = body.dark;
  ctx.fill(art.barrels);
  ctx.fillStyle = body.light;
  fillShifted(ctx, art.fins, -rim, -rim);
  fillShifted(ctx, art.heads, -rim, -rim);
  ctx.fillStyle = body.base;
  ctx.fill(art.fins);
  ctx.fill(art.heads);
  ctx.fill(art.casing);
  ctx.fillStyle = palette.ink;
  ctx.fill(art.slots);
  ctx.fillStyle = body.light;
  ctx.fill(art.fittings);
  ctx.fillStyle = body.dark;
  ctx.fill(art.pits);
  ctx.fillStyle = body.shine;
  ctx.fill(art.bolts);

  // Pistons in their slots, and the fire above each crown just after it fires.
  const pistons = pen(), grooves = pen();
  const fire = new Glow(step);
  const halfWidth = h.bore * 0.29;
  h.axes.forEach((axis, i) => {
    const s = pose.piston[i]!;
    const crown = s + h.pistonLength * 0.62;
    rotatedRect(pistons, h.cx, h.cy, axis, Math.max(h.barrelStart - 14 * u, s - h.pistonLength * 0.38), crown, -halfWidth, halfWidth);
    for (const g of [3.2, 6.4]) rotatedRect(grooves, h.cx, h.cy, axis, crown - g * u - 0.9 * u, crown - g * u, -halfWidth, halfWidth);
    circle(grooves, h.cx + s * Math.cos(axis), h.cy + s * Math.sin(axis), 3.2 * u);
    const level = Math.round(LEVELS * Math.exp(-(wrap(clock.beats - h.firePhase[i]!, 1) * BEAT_MS) / 120));
    if (level > 0) rotatedRect(fire.at(level), h.cx, h.cy, axis, crown, h.barrelEnd - 7 * u, -h.bore * 0.31, h.bore * 0.31);
  });
  ctx.fillStyle = steel.base;
  ctx.fill(pistons.path);
  ctx.fillStyle = steel.dark;
  ctx.fill(grooves.path);
  fire.fill(ctx, rgba(palette.glow, 1), 0.95);

  // The crank: counterweight opposite the pin, and the web that carries the pin.
  const weight = pen(), rivets = pen();
  const back = pose.crank + Math.PI;
  weight.move(h.cx, h.cy);
  weight.arc(h.cx, h.cy, h.crankcaseRadius * 0.6, back - 0.95, back + 0.95);
  weight.close();
  bar(weight, h.cx, h.cy, pose.pinX, pose.pinY, h.linkRadius * 1.5);
  for (const k of [-0.6, 0, 0.6]) {
    circle(rivets, h.cx + h.crankcaseRadius * 0.45 * Math.cos(back + k), h.cy + h.crankcaseRadius * 0.45 * Math.sin(back + k), 2.4 * u);
  }
  emboss(ctx, weight.path, rim, palette.ink, steel.base, polish(ctx, h.cx, h.cy, h.crankcaseRadius * 0.6, steel, 0.35));
  emboss(ctx, rivets.path, rim * 0.6, palette.ink, steel.shine, steel.dark);

  // Rods, from the master rod's big end out to every piston pin; the master rod is grooved.
  const rods = pen(), master = pen(), groove = pen();
  h.axes.forEach((axis, i) => {
    const s = pose.piston[i]!;
    const px = h.cx + s * Math.cos(axis), py = h.cy + s * Math.sin(axis);
    const x0 = pose.rodX[i]!, y0 = pose.rodY[i]!;
    bar(i === 0 ? master : rods, x0, y0, px, py, (i === 0 ? 11 : 6.6) * u);
    if (i === 0) bar(groove, x0 + (px - x0) * 0.3, y0 + (py - y0) * 0.3, x0 + (px - x0) * 0.85, y0 + (py - y0) * 0.85, 2.6 * u);
  });
  emboss(ctx, rods.path, rim, palette.ink, steel.light, steel.base);
  emboss(ctx, master.path, rim, palette.ink, steel.shine, steel.light);
  ctx.fillStyle = steel.dark;
  ctx.fill(groove.path);

  // The big end: a plate around the crank pin holding the articulated rods' link pins.
  const plateR = h.linkRadius + 6 * u;
  const plate = pen(), turned = pen(), pins = pen(), pinHoles = pen();
  circle(plate, pose.pinX, pose.pinY, plateR);
  for (const k of [0.62, 0.8]) ring(turned, pose.pinX, pose.pinY, plateR * k, plateR * k + 0.6 * u);
  for (let i = 1; i < h.cylinders; i++) {
    circle(pins, pose.rodX[i]!, pose.rodY[i]!, 3.6 * u);
    circle(pinHoles, pose.rodX[i]!, pose.rodY[i]!, 1.3 * u);
  }
  circle(pins, pose.pinX, pose.pinY, h.linkRadius * 0.56);
  ring(pinHoles, pose.pinX, pose.pinY, h.linkRadius * 0.38, h.linkRadius * 0.45);
  emboss(ctx, plate.path, rim * 1.4, palette.ink, steel.shine, polish(ctx, pose.pinX, pose.pinY, plateR, steel, 0.3));
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = steel.dark;
  ctx.fill(turned.path);
  ctx.globalAlpha = 1;
  emboss(ctx, pins.path, rim * 0.7, palette.ink, steel.shine, steel.light);
  ctx.fillStyle = steel.dark;
  ctx.fill(pinHoles.path);

  // The crankshaft's nose at the very centre: turned rings, hex bolts turning with the crank, and a
  // jewel that glows with each stroke.
  const r = h.crankcaseRadius * 0.17;
  const nose = pen(), noseTurned = pen(), heads = pen(), core = pen();
  circle(nose, h.cx, h.cy, r);
  for (const k of [0.6, 0.9]) ring(noseTurned, h.cx, h.cy, r * k, r * k + 0.5 * u);
  for (let k = 0; k < 6; k++) {
    const a = pose.crank + (k * TAU) / 6;
    polygon(heads, h.cx + r * 0.75 * Math.cos(a), h.cy + r * 0.75 * Math.sin(a), r * 0.12, 6, a);
  }
  circle(core, h.cx, h.cy, r * 0.42);
  emboss(ctx, nose.path, rim * 1.4, palette.ink, body.shine, polish(ctx, h.cx, h.cy, r, body, 0.25));
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = body.dark;
  ctx.fill(noseTurned.path);
  ctx.globalAlpha = 1;
  emboss(ctx, heads.path, rim * 0.6, palette.ink, body.shine, body.base);
  emboss(ctx, core.path, -rim * 0.8, palette.ink, body.light, steel.dark);
  const jewel = new Glow(step);
  circle(jewel.at(Math.round(LEVELS * (0.35 + 0.65 * clock.contraction))), h.cx, h.cy, r * 0.22);
  jewel.fill(ctx, rgba(palette.glow, 1), 0.9);
  const spark = new Glow(step);
  circle(spark.at(Math.round(LEVELS * clock.contraction)), h.cx, h.cy, r * 0.1);
  spark.fill(ctx, rgba(palette.spark, 1), 0.9);
}

/**
 * A polished face for a round part of radius r at (x, y): its highlight toward the light. `gloss` is
 * how far toward the rim the highlight reaches.
 */
function polish(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, metal: Metal, gloss: number): CanvasGradient {
  const g = ctx.createRadialGradient(x + LIGHT_X * r * 0.45, y + LIGHT_Y * r * 0.45, r * 0.05, x, y, r * 1.1);
  g.addColorStop(0, metal.shine);
  g.addColorStop(gloss, metal.light);
  g.addColorStop(0.75, metal.base);
  g.addColorStop(1, metal.dark);
  return g;
}

/** Fills a part as embossed metal: a dark edge below and right, a lit edge above and left, then its face. */
function emboss(ctx: CanvasRenderingContext2D, path: Path2D, edge: number, dark: string, light: string, face: string | CanvasGradient): void {
  ctx.fillStyle = dark;
  fillShifted(ctx, path, edge, edge);
  ctx.fillStyle = light;
  fillShifted(ctx, path, -edge, -edge);
  ctx.fillStyle = face;
  ctx.fill(path);
}
