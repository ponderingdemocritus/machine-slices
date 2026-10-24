// The heart: a radial engine at the centre of the world. Its crank turns once per beat (lub-dub, see
// engine/rhythm.ts); each cylinder fires as its piston reaches the top of its stroke, and sends a pulse
// down the vessel that leaves its head. A master rod and articulated rods tie the pistons to one crank
// pin, so the pistons rise and fall in sequence around the ring.

import { TAU } from "../engine/geometry.js";
import type { Rng } from "../engine/random.js";
import { heartStrokeInverse, wrap } from "../engine/rhythm.js";

export interface Heart {
  cx: number;
  cy: number;
  /** Number of cylinders: odd, as in a real radial engine. */
  cylinders: number;
  /** Direction of each cylinder's axis, from the centre. */
  axes: number[];
  crankcaseRadius: number;
  /** Cylinder bore: the piston's width. */
  bore: number;
  /** Radii, along every axis, where a barrel starts and ends and where its head ends. */
  barrelStart: number;
  barrelEnd: number;
  headEnd: number;
  /** Half-width of the cooling fins, at the barrel's start and end. */
  finReach: [number, number];
  /** Crank throw: the crank pin's distance from the centre. */
  throw: number;
  rodLength: number;
  /** Distance of the articulated rods' pins from the crank pin, on the master rod's big end. */
  linkRadius: number;
  /** Length of a piston along its axis. */
  pistonLength: number;
  /** Crank angle when the cycle begins. */
  phase: number;
  /** Beat phase at which each cylinder fires (its piston at the top of the stroke). */
  firePhase: number[];
  /** Everything of the heart lies within this radius of its centre. */
  radius: number;
}

export function designHeart(rng: Rng, cx: number, cy: number): Heart {
  const cylinders = [5, 7, 9][rng.weighted([0.3, 0.45, 0.25])]!;
  const scale = rng.range(1.16, 1.3);
  const crankcaseRadius = (74 + cylinders * 3 + rng.range(-4, 6)) * scale;
  const spacing = TAU / cylinders;
  const bore = Math.min(rng.range(44, 54) * scale, 2 * crankcaseRadius * Math.sin(spacing / 2) * 0.78);
  const throwLength = rng.range(21, 26) * scale;
  const rodLength = rng.range(100, 112) * scale;
  const pistonLength = bore * 0.66;
  const barrelStart = crankcaseRadius - 6;
  const barrelEnd = rodLength + throwLength + pistonLength * 0.62 + 18;
  const headEnd = barrelEnd + 26 * scale;
  const fin = (r: number) => Math.min(bore / 2 + 11 * scale, r * Math.sin(spacing / 2) - 2.5);
  const first = -Math.PI / 2 + rng.range(-0.15, 0.15) * spacing;
  const axes = Array.from({ length: cylinders }, (_, i) => first + i * spacing);
  const phase = rng.range(0, TAU);
  return {
    cx,
    cy,
    cylinders,
    axes,
    crankcaseRadius,
    bore,
    barrelStart,
    barrelEnd,
    headEnd,
    finReach: [fin(barrelStart + 16), fin(barrelEnd)],
    throw: throwLength,
    rodLength,
    linkRadius: rng.range(15, 17) * scale,
    pistonLength,
    phase,
    firePhase: axes.map((a) => heartStrokeInverse(wrap((a - phase) / TAU, 1))),
    radius: headEnd + 8,
  };
}

/** Where every moving part of the heart is, for a crank position. */
export interface HeartPose {
  /** Crank angle. */
  crank: number;
  /** The crank pin. */
  pinX: number;
  pinY: number;
  /** Direction of the master rod, from the crank pin to its piston. */
  masterAngle: number;
  /** Each rod's lower pin (the crank pin for the master rod, a link pin for the others). */
  rodX: number[];
  rodY: number[];
  /** Each piston's pin, as a distance from the centre along its axis. */
  piston: number[];
}

/** The pin of a rod of length `length` from (px, py) on the axis at angle `axis` through the centre. */
function pinOnAxis(h: Heart, axis: number, px: number, py: number, length: number): number {
  const ux = Math.cos(axis), uy = Math.sin(axis);
  const qx = px - h.cx, qy = py - h.cy;
  const along = qx * ux + qy * uy;
  const across2 = qx * qx + qy * qy - along * along;
  return along + Math.sqrt(Math.max(0, length * length - across2));
}

/** The heart's pose after `crankTurns` turns of the crank. */
export function heartPose(h: Heart, crankTurns: number): HeartPose {
  const crank = h.phase + TAU * crankTurns;
  const pinX = h.cx + h.throw * Math.cos(crank);
  const pinY = h.cy + h.throw * Math.sin(crank);
  const master = h.axes[0]!;
  const s0 = pinOnAxis(h, master, pinX, pinY, h.rodLength);
  const masterAngle = Math.atan2(h.cy + s0 * Math.sin(master) - pinY, h.cx + s0 * Math.cos(master) - pinX);
  const rodX = [pinX], rodY = [pinY], piston = [s0];
  const articulated = h.rodLength - h.linkRadius;
  for (let i = 1; i < h.cylinders; i++) {
    const a = masterAngle + (h.axes[i]! - master);
    const lx = pinX + h.linkRadius * Math.cos(a), ly = pinY + h.linkRadius * Math.sin(a);
    rodX.push(lx);
    rodY.push(ly);
    piston.push(pinOnAxis(h, h.axes[i]!, lx, ly, articulated));
  }
  return { crank, pinX, pinY, masterAngle, rodX, rodY, piston };
}
