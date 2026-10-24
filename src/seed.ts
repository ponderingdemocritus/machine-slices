export interface MachineDNA {
  phase: number;
  ribs: number;
  apertures: number;
  flecks: readonly number[];
}

/** All 32 seed bytes feed a small integer mixer. This is a drawing seed, not cryptography. */
export function machineFromSeed(seed: string): MachineDNA {
  let state = 2166136261;
  for (let i = 2; i < seed.length; i += 2) state = Math.imul(state ^ parseInt(seed.slice(i, i + 2), 16), 16777619);
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let x = Math.imul(state ^ state >>> 15, 1 | state);
    x ^= x + Math.imul(x ^ x >>> 7, 61 | x);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
  return { phase: next() * Math.PI * 2, ribs: 27 + Math.floor(next() * 8),
    apertures: 9 + Math.floor(next() * 5), flecks: Array.from({ length: 600 }, next) };
}
