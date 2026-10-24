// Organs: a few large mechanisms set in the body around the heart before the vessels grow. Vessels
// grow toward their rims, so every organ is fed by a vessel; it acts when the heartbeat's pulse
// arrives there (escapement) or with the breath (iris, lung).

import { TAU } from "../engine/geometry.js";
import type { Rng } from "../engine/random.js";
import { BEAT_MS, LUB_PHASE } from "../engine/rhythm.js";
import type { Heart } from "./heart.js";
import type { Vessels } from "./vessels.js";

export type OrganKind = "iris" | "escapement" | "lung";

export interface Organ {
  kind: OrganKind;
  x: number;
  y: number;
  /** The organ keeps this disc clear of vessels and gears. */
  radius: number;
  /** Turn of the organ: where an iris's blades start, which way a lung's bellows point. */
  angle: number;
  /** Iris blades, escape-wheel teeth, or pleats of each bellows. */
  count: number;
  /** Beats after the cycle's first beat at which the pulse reaches the organ. */
  delay: number;
  /** The vessel tip feeding the organ, if one reached it. */
  inlet: { x: number; y: number; width: number } | null;
}

export function placeOrgans(rng: Rng, heart: Heart): Organ[] {
  const organs: Organ[] = [];
  const wanted = rng.int(3, 5);
  const kinds = rng.shuffle<OrganKind>(["iris", "escapement", "lung"]);
  // Spread around the heart like a constellation: one sector each, at a free distance within it.
  const turn = rng.range(0, TAU);
  for (let attempt = 0; attempt < 200 && organs.length < wanted; attempt++) {
    const kind = kinds[organs.length % kinds.length]!;
    const radius = kind === "iris" ? rng.range(64, 92) : rng.range(84, 108);
    const a = turn + ((organs.length + rng.range(-0.3, 0.3)) * TAU) / wanted;
    const d = rng.range(heart.radius + radius + 150, 880);
    const x = heart.cx + d * Math.cos(a), y = heart.cy + d * Math.sin(a);
    if (x < radius + 40 || y < radius + 40 || x > 2000 - radius - 40 || y > 2000 - radius - 40) continue;
    if (organs.some((o) => Math.hypot(o.x - x, o.y - y) < o.radius + radius + 170)) continue;
    const angle = rng.range(0, TAU);
    // An escape wheel turns 36 teeth per cycle; with teeth dividing 144 its four windows close the cycle too.
    const count = kind === "iris" ? rng.pick([7, 9, 11, 12]) : kind === "escapement" ? rng.pick([16, 18, 24, 36]) : rng.int(5, 8);
    organs.push({ kind, x, y, radius, angle, count, delay: 0, inlet: null });
  }
  return organs;
}

/** Finds the vessel tip that feeds each organ, and when the pulse reaches it. */
export function connectOrgans(organs: Organ[], vessels: Vessels, pulseSpeed: number): void {
  for (const o of organs) {
    let best = null, bestGap = 60;
    for (const t of vessels.tips) {
      const gap = Math.hypot(t.x - o.x, t.y - o.y) - o.radius;
      if (gap < bestGap) {
        bestGap = gap;
        best = t;
      }
    }
    if (!best) continue;
    o.inlet = { x: best.x, y: best.y, width: best.width };
    o.delay = LUB_PHASE + best.distance / pulseSpeed / BEAT_MS;
  }
}

/** Attraction points on an organ's rim, on the side facing the heart, so that vessels grow to it. */
export function organAttractors(o: Organ, heart: Heart): { x: number; y: number }[] {
  const toward = Math.atan2(heart.cy - o.y, heart.cx - o.x);
  return [-0.5, 0, 0.5].map((da) => ({ x: o.x + (o.radius + 16) * Math.cos(toward + da), y: o.y + (o.radius + 16) * Math.sin(toward + da) }));
}
