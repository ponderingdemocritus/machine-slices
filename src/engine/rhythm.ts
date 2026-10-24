// The machine's clock. Every movement is a pure function of explicit time, and every rhythm divides one
// 60-second cycle, so the machine at t and at t + 60 000 ms is the same picture:
//
//   cycle      60 000 ms   the whole machine repeats
//   breath      5 000 ms   12 breaths per cycle: the slow swell of light and of the cilia
//   heartbeat     833 ms   72 beats per cycle: one crank turn, lub then dub
//
// Gears advance a whole number of teeth per beat, pulses leave the heart once per beat, and so on: the
// constants below are the only tempo there is.

export const CYCLE_MS = 60_000;
export const BEATS_PER_CYCLE = 72;
export const BREATHS_PER_CYCLE = 12;
export const BEAT_MS = CYCLE_MS / BEATS_PER_CYCLE;
export const BREATH_MS = CYCLE_MS / BREATHS_PER_CYCLE;

/** Share of the crank turn made at a slow constant drift; the rest comes in the two strokes. */
const DRIFT = 0.16;
/** The first stroke (lub) and the second (dub): their share of the stroke, start and length in beats. */
const LUB = { share: 0.6, start: 0, length: 0.16 };
const DUB = { start: 0.21, length: 0.15 };

/**
 * The heart's two strokes: the beat phase at which each pushes hardest, and how hard. Each sends a
 * pulse down every vessel at once, so pulses leave the heart in pairs, lub then dub.
 */
export const STROKES: readonly { phase: number; strength: number }[] = [
  { phase: LUB.start + LUB.length / 2, strength: 1 },
  { phase: DUB.start + DUB.length / 2, strength: 0.6 },
];
/** When the first, strong stroke leaves the heart: what gears, tips and organs answer to. */
export const LUB_PHASE = STROKES[0]!.phase;

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Ken Perlin's smootherstep on [0, 1], clamped: zero first and second derivatives at both ends. */
export function smootherstep(x: number): number {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Positive remainder: wraps x into [0, m). */
export function wrap(x: number, m: number): number {
  const r = x % m;
  return r < 0 ? r + m : r;
}

/**
 * The heart's stroke: the fraction of a crank turn completed at beat phase f in [0, 1]. Monotonic from 0
 * to 1, made of a constant drift, a strong first stroke and a softer second one: lub-dub.
 */
export function heartStroke(f: number): number {
  const lub = smootherstep((f - LUB.start) / LUB.length);
  const dub = smootherstep((f - DUB.start) / DUB.length);
  return DRIFT * f + (1 - DRIFT) * (LUB.share * lub + (1 - LUB.share) * dub);
}

/** The beat phase at which the stroke has completed fraction u of the turn (inverse of heartStroke). */
export function heartStrokeInverse(u: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (heartStroke(mid) < u) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** How hard the heart pushes at beat phase f, in [0, 1]: peaks on lub and, softer, on dub. */
export function contraction(f: number): number {
  const bump = (centre: number, width: number) => {
    const d = (f - centre) / width;
    return Math.exp(-d * d);
  };
  return Math.max(bump(LUB.start + LUB.length * 0.5, 0.07), 0.62 * bump(DUB.start + DUB.length * 0.5, 0.07));
}

/** A ratchet's advance within one beat, in [0, 1]: one quick click, then rest until the next beat. */
export function ratchet(f: number): number {
  return smootherstep(f / 0.14);
}

/** Every phase of the machine at one moment. */
export interface Clock {
  /** Milliseconds into the current cycle, in [0, CYCLE_MS). */
  t: number;
  /** Beats since the cycle began, continuous, in [0, BEATS_PER_CYCLE). */
  beats: number;
  /** Phase within the current beat, in [0, 1). */
  beatPhase: number;
  /** Crank turns since the cycle began: whole beats plus the heart's stroke within this one. */
  crankTurns: number;
  /** Heart contraction at this moment, in [0, 1]. */
  contraction: number;
  /** Phase within the current breath, in [0, 1). */
  breathPhase: number;
  /** Depth of breath, 0 (exhaled) to 1 (inhaled), smooth. */
  breath: number;
}

export function clockAt(timeMs: number): Clock {
  const t = wrap(timeMs, CYCLE_MS);
  const beats = (t * BEATS_PER_CYCLE) / CYCLE_MS;
  const index = Math.floor(beats);
  const beatPhase = beats - index;
  const breathPhase = wrap((t * BREATHS_PER_CYCLE) / CYCLE_MS, 1);
  return {
    t,
    beats,
    beatPhase,
    crankTurns: index + heartStroke(beatPhase),
    contraction: contraction(beatPhase),
    breathPhase,
    breath: 0.5 - 0.5 * Math.cos(2 * Math.PI * breathPhase),
  };
}

/**
 * Teeth a gear train has advanced since the cycle began: `perBeat` teeth every beat, either smoothly or
 * in one ratchet click per beat, `delayBeats` after the heart's first stroke (the pulse's arrival).
 */
export function teethAdvanced(clock: Clock, perBeat: number, clicks: boolean, delayBeats: number): number {
  if (!clicks) return perBeat * clock.beats;
  const x = clock.beats - delayBeats;
  const whole = Math.floor(x);
  return perBeat * (whole + ratchet(x - whole));
}

/**
 * Ages in milliseconds of the pulses still travelling, for a source that fires once per beat at beat
 * phase `phase`: the newest first, while younger than `maxAgeMs`.
 */
export function pulseAges(clock: Clock, phase: number, maxAgeMs: number): number[] {
  const ages: number[] = [];
  for (let age = wrap(clock.beats - phase, 1) * BEAT_MS; age <= maxAgeMs; age += BEAT_MS) ages.push(age);
  return ages;
}
