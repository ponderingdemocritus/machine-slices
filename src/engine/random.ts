// Deterministic randomness. A seed's 256 bits feed independent named streams (sfc32), so each part
// of the machine draws its own numbers and changing one part never reshuffles another. Nothing here
// reads Math.random or the clock.

/** murmur3's 32-bit finalizer: spreads every input bit over the output. */
export function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A 32-bit hash of a list of integers. */
export function hashInts(...values: number[]): number {
  let h = 0x9e3779b9;
  for (const v of values) h = fmix32(Math.imul(h ^ (v | 0), 0x01000193) + 0x7f4a7c15);
  return h;
}

/** A 32-bit hash of a string (FNV-1a, then mixed). */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return fmix32(h);
}

/** A uniform number in [0, 1) from a list of integers: randomness without a stream. */
export function hashUnit(...values: number[]): number {
  return hashInts(...values) / 4294967296;
}

/** The eight 32-bit words of a seed given as 64 hexadecimal digits. */
export function seedWords(seedHex: string): number[] {
  const words: number[] = [];
  for (let i = 0; i < 64; i += 8) words.push(parseInt(seedHex.slice(i, i + 8), 16) >>> 0);
  return words;
}

/** A small, fast generator (sfc32) with helpers for the draws the machine needs. */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(a: number, b: number, c: number, d: number) {
    this.a = a | 0;
    this.b = b | 0;
    this.c = c | 0;
    this.d = d | 0;
    for (let i = 0; i < 16; i++) this.u32();
  }

  u32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform in [0, 1). */
  float(): number {
    return this.u32() / 4294967296;
  }

  /** Uniform in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.float();
  }

  /** Uniform integer in [lo, hi], both included. */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.float() * (hi - lo + 1));
  }

  chance(p: number): boolean {
    return this.float() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.float() * items.length)]!;
  }

  /** Picks an index with probability proportional to its weight. */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    let r = this.float() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i]!;
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  /** In-place Fisher–Yates shuffle. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.float() * (i + 1));
      [items[i], items[j]] = [items[j]!, items[i]!];
    }
    return items;
  }
}

/** An independent stream of the seed, named for the part of the machine that consumes it. */
export function stream(words: readonly number[], label: string): Rng {
  const salt = hashString(label);
  const state = [1, 2, 3, 4].map((lane) => hashInts(salt, lane, ...words));
  return new Rng(state[0]!, state[1]!, state[2]!, state[3]!);
}

/** Smooth value noise in [0, 1] with unit lattice spacing, keyed by `salt`. */
export function valueNoise(x: number, y: number, salt: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const v00 = hashUnit(ix, iy, salt), v10 = hashUnit(ix + 1, iy, salt);
  const v01 = hashUnit(ix, iy + 1, salt), v11 = hashUnit(ix + 1, iy + 1, salt);
  const top = v00 + (v10 - v00) * sx, bottom = v01 + (v11 - v01) * sx;
  return top + (bottom - top) * sy;
}

/** Two octaves of value noise, in [0, 1], with features about `scale` units wide. */
export function fieldNoise(x: number, y: number, scale: number, salt: number): number {
  return (2 * valueNoise(x / scale, y / scale, salt) + valueNoise((2 * x) / scale + 17.3, (2 * y) / scale - 9.1, salt ^ 0x5bd1e995)) / 3;
}
