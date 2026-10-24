// Gear trains. Working trains are driven at vessel junctions: when the heartbeat's pulse reaches the
// junction, the train advances by ratchet clicks (or turns smoothly with the beat). Deep trains turn
// slowly behind everything. Gears of one train mesh exactly: their centres are a sum of pitch radii
// apart and each phase puts a tooth of one into a gap of the other.
//
// Every gear advances a whole number of teeth per beat, and its tooth count N is s × q where s is its
// symmetry (spokes or holes) and q divides 72: after the 72 beats of a cycle every gear has turned a
// whole number of symmetry steps, so the cycle closes without a jump.

import { TAU } from "../engine/geometry.js";
import type { Rng } from "../engine/random.js";
import { BEAT_MS, BEATS_PER_CYCLE, LUB_PHASE } from "../engine/rhythm.js";
import type { Heart } from "./heart.js";
import type { Organ } from "./organs.js";
import type { Junction, VesselField, Vessels } from "./vessels.js";

export type GearStyle = "spokes" | "holes" | "solid";

export interface Gear {
  x: number;
  y: number;
  teeth: number;
  module: number;
  /** Pitch radius: where the teeth of meshing gears roll on each other. */
  pitch: number;
  /** Tip radius: the gear's outline. */
  outer: number;
  /** Root radius: the bottom of the tooth gaps. */
  root: number;
  /** Order of rotational symmetry of the body (spokes or holes). */
  symmetry: number;
  style: GearStyle;
  /** Angle of tooth 0 when its train has advanced 0 teeth. */
  phase: number;
  /** +1 or -1: meshing gears turn opposite ways. */
  turn: number;
  train: number;
}

export interface Train {
  layer: "deep" | "working";
  /** Teeth every gear of the train advances per beat. */
  perBeat: number;
  /** Ratchet clicks once per beat, or turns smoothly. */
  clicks: boolean;
  /** Beats after the cycle's first beat at which the train clicks: when the pulse reaches its driver. */
  delay: number;
  /** Index into the palette's working metals. */
  tone: number;
  /** The junction a working train is driven from, if any. */
  junction: Junction | null;
  gears: number[];
}

export interface GearWorks {
  gears: Gear[];
  trains: Train[];
}

const QUOTIENTS = [2, 3, 4, 6, 8, 9, 12, 18, 24, 36].filter((q) => BEATS_PER_CYCLE % q === 0);

/** Tooth counts in [lo, hi] that close the cycle, each with the symmetries it allows. */
function toothCounts(lo: number, hi: number): Map<number, number[]> {
  const counts = new Map<number, number[]>();
  for (const s of [3, 4, 5, 6]) {
    for (const q of QUOTIENTS) {
      const n = s * q;
      if (n < lo || n > hi) continue;
      counts.set(n, [...(counts.get(n) ?? []), s]);
    }
  }
  return counts;
}

const WORKING_TEETH = toothCounts(8, 120);
const DEEP_TEETH = toothCounts(24, 150);

/** The allowed tooth count closest to `wanted`. */
function nearestTeeth(counts: Map<number, number[]>, wanted: number): number {
  let best = 0;
  for (const n of counts.keys()) if (!best || Math.abs(n - wanted) < Math.abs(best - wanted)) best = n;
  return best;
}

/** Phase of a gear meshing with `parent` from direction `alpha` (parent centre → child centre). */
export function meshPhase(parent: Gear, teeth: number, alpha: number): number {
  return alpha + Math.PI - Math.PI / teeth + (alpha - parent.phase) * (parent.teeth / teeth);
}

function makeGear(rng: Rng, counts: Map<number, number[]>, x: number, y: number, teeth: number, module: number, train: number): Gear {
  const pitch = (teeth * module) / 2;
  const symmetry = rng.pick(counts.get(teeth)!);
  const style: GearStyle = teeth < 14 ? "solid" : pitch > 30 ? (rng.chance(0.8) ? "spokes" : "holes") : rng.chance(0.55) ? "holes" : "spokes";
  return { x, y, teeth, module, pitch, outer: pitch + module, root: pitch - 1.25 * module, symmetry, style, phase: 0, turn: 1, train };
}

interface Placement {
  gears: Gear[];
  heart: Heart;
  /** Organs to keep clear of. */
  organs: readonly Organ[];
  /** Extra space kept between gears of different trains. */
  gap: number;
}

/** Whether a gear of tip radius `outer` at (x, y) is clear of the heart and of every gear but `except`. */
function isClear(p: Placement, x: number, y: number, outer: number, except: Gear | null): boolean {
  if (x < 0 || y < 0 || x > 2000 || y > 2000) return false;
  if (Math.hypot(x - p.heart.cx, y - p.heart.cy) < p.heart.radius + outer + 6) return false;
  if (p.organs.some((o) => Math.hypot(x - o.x, y - o.y) < o.radius + outer + 8)) return false;
  for (const g of p.gears) {
    if (g === except) continue;
    if (Math.hypot(g.x - x, g.y - y) < g.outer + outer + p.gap) return false;
  }
  return true;
}

type Allowed = (x: number, y: number, outer: number) => boolean;

/**
 * Adds a gear of about `radius` meshing with `parent`, trying directions a golden angle apart, and
 * returns it, or null if no direction is free.
 */
function attach(rng: Rng, p: Placement, counts: Map<number, number[]>, train: Train, parent: Gear, radius: number, allowed: Allowed): Gear | null {
  const teeth = nearestTeeth(counts, (2 * radius) / parent.module);
  const pitch = (teeth * parent.module) / 2;
  const start = rng.range(0, TAU);
  for (let k = 0; k < 14; k++) {
    const alpha = start + k * 2.39996;
    const x = parent.x + (parent.pitch + pitch) * Math.cos(alpha);
    const y = parent.y + (parent.pitch + pitch) * Math.sin(alpha);
    if (!isClear(p, x, y, pitch + parent.module, parent) || !allowed(x, y, pitch + parent.module)) continue;
    const g = makeGear(rng, counts, x, y, teeth, parent.module, parent.train);
    g.phase = meshPhase(parent, teeth, alpha);
    g.turn = -parent.turn;
    train.gears.push(p.gears.length);
    p.gears.push(g);
    return g;
  }
  return null;
}

/**
 * Grows a compact cluster around a train's first gear: a main wheel meshing with it, then satellites
 * on whichever gear has room, larger gears taking more of them, none taking more than three.
 */
function growCluster(rng: Rng, p: Placement, counts: Map<number, number[]>, train: Train, main: number, satellites: () => number, count: number, allowed: Allowed): void {
  const first = p.gears[train.gears[0]!]!;
  const meshes = new Map<Gear, number>([[first, 0]]);
  const wheel = attach(rng, p, counts, train, first, main, allowed);
  if (wheel) {
    meshes.set(first, 1);
    meshes.set(wheel, 1);
  }
  for (let i = 0; i < count; i++) {
    const open = [...meshes.keys()].filter((g) => meshes.get(g)! < 3);
    if (!open.length) break;
    const parent = open[rng.weighted(open.map((g) => g.pitch * g.pitch))]!;
    const g = attach(rng, p, counts, train, parent, satellites(), allowed);
    if (!g) continue;
    meshes.set(parent, meshes.get(parent)! + 1);
    meshes.set(g, 1);
  }
}

export function designGears(rng: Rng, heart: Heart, organs: readonly Organ[], vessels: Vessels, field: VesselField, pulseSpeed: number): GearWorks {
  const trains: Train[] = [];
  const deep: Placement = { gears: [], heart, organs: [], gap: 10 };
  const working: Placement = { gears: [], heart, organs, gap: 7 };

  // Deep trains: large, slow, behind the vessels.
  for (let attempt = 0; attempt < 120 && trains.length < 16; attempt++) {
    const module = rng.range(6, 9);
    const teeth = nearestTeeth(DEEP_TEETH, (2 * rng.range(60, 170)) / module);
    const x = rng.range(0, 2000), y = rng.range(0, 2000);
    if (!isClear(deep, x, y, (teeth * module) / 2 + module, null)) continue;
    const index = trains.length;
    const first = makeGear(rng, DEEP_TEETH, x, y, teeth, module, index);
    first.phase = rng.range(0, TAU);
    first.turn = rng.chance(0.5) ? 1 : -1;
    const train: Train = { layer: "deep", perBeat: 1, clicks: false, delay: 0, tone: 0, junction: null, gears: [deep.gears.length] };
    deep.gears.push(first);
    trains.push(train);
    growCluster(rng, deep, DEEP_TEETH, train, rng.range(50, 140), () => rng.range(40, 110), rng.int(0, 2), () => true);
  }

  // Working trains: each driven from a vessel junction, growing into the free space around it.
  const firstWorking = trains.length;
  const junctions = rng.shuffle(vessels.junctions.filter((j) => j.width > 4.2 && j.width < 16));
  for (const j of junctions) {
    if (trains.length - firstWorking >= 40) break;
    const module = rng.range(2.3, 3.6);
    const teeth = nearestTeeth(WORKING_TEETH, (2 * Math.min(30, Math.max(9, j.width * 0.9 + rng.range(5, 12)))) / module);
    const outer = (teeth * module) / 2 + module;
    if (!isClear(working, j.x, j.y, outer, null)) continue;
    const index = trains.length;
    const driver = makeGear(rng, WORKING_TEETH, j.x, j.y, teeth, module, index);
    driver.phase = rng.range(0, TAU);
    driver.turn = rng.chance(0.5) ? 1 : -1;
    const arrival = LUB_PHASE + j.distance / pulseSpeed / BEAT_MS;
    const train: Train = {
      layer: "working",
      perBeat: rng.chance(0.72) ? 1 : 2,
      clicks: rng.chance(0.78),
      delay: arrival,
      tone: rng.weighted([0.42, 0.33, 0.25]),
      junction: j,
      gears: [working.gears.length],
    };
    working.gears.push(driver);
    trains.push(train);
    const satellite = () => (rng.chance(0.45) ? rng.range(8, 13) : rng.range(14, 30));
    growCluster(rng, working, WORKING_TEETH, train, rng.range(24, 58), satellite, rng.int(1, 5), (x, y, r) => field.clearance(x, y, r + 8) >= r + 3);
  }

  // One list: deep gears first, then working gears; trains index into it.
  const offset = deep.gears.length;
  for (let t = firstWorking; t < trains.length; t++) trains[t]!.gears = trains[t]!.gears.map((g) => g + offset);
  return { gears: [...deep.gears, ...working.gears], trains };
}
