/** All visual variation is derived from the complete 256-bit seed. */
export function randomSource(seed: string): () => number {
  let state = 2166136261;
  for (let i = 2; i < seed.length; i += 2) {
    state = Math.imul(state ^ parseInt(seed.slice(i, i + 2), 16), 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
