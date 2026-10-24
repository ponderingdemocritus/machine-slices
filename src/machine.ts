export type Point = [number, number];
export interface Organ { x: number; y: number; angle: number; kind: number; size: number }
export interface Conduit { points: Point[]; length: number }
export interface Machine { palette: string[]; organs: Organ[]; conduits: Conduit[] }

/** Mix all 256 seed bits, then use a local Mulberry32 stream. */
export function randomFromSeed(seed: string): () => number {
  let state = 2166136261;
  for (let i = 2; i < seed.length; i += 2) state = Math.imul(state ^ parseInt(seed.slice(i, i + 2), 16), 16777619);
  return () => {
    let n = state += 0x6d2b79f5;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

/** The same anatomical grammar, with seeded metal finishes and joint positions. */
export function compose(seed: string): Machine {
  const random = randomFromSeed(seed);
  const palettes = [
    ['#171d19', '#29362c', '#435445', '#798b6e', '#b89d63', '#e5dbaf', '#d48850', '#b4d9a0'],
    ['#15191e', '#252d37', '#394954', '#798581', '#b69a78', '#ece1c3', '#b85442', '#a4c9de'],
    ['#0b191d', '#142b2d', '#284448', '#58716c', '#b49462', '#e6d5a7', '#d16b42', '#89ddd0'],
  ];
  const palette = palettes[Math.floor(random() * palettes.length)].slice();
  // Small continuous variation makes even seeds choosing the same finish distinct.
  const hue = Math.floor(random() * 28 + 160);
  palette[7] = `hsl(${hue} 48% 70%)`;
  const anchors = [[590, 570, -0.35, 0, 152], [1390, 540, 0.32, 1, 148],
    [1545, 1190, 0.55, 0, 165], [1240, 1590, -0.25, 2, 145],
    [530, 1430, -0.6, 1, 145], [905, 285, 0.12, 2, 100]];
  const organs = anchors.map(([x, y, angle, kind, size]) => ({
    x: x + (random() - 0.5) * 85, y: y + (random() - 0.5) * 70,
    angle: angle + (random() - 0.5) * 0.18, kind, size,
  }));
  const conduits = organs.map((o, i) => {
    const a = Math.atan2(o.y - 1000, o.x - 1000);
    const start: Point = [1000 + Math.cos(a) * 166, 1000 + Math.sin(a) * 166];
    const bend = (i % 2 ? 1 : -1) * 190;
    const c1 = [start[0] + Math.cos(a) * 240 - Math.sin(a) * bend, start[1] + Math.sin(a) * 240 + Math.cos(a) * bend];
    const c2 = [o.x - Math.cos(a) * 210 - Math.sin(a) * bend, o.y - Math.sin(a) * 210 + Math.cos(a) * bend];
    const points: Point[] = [];
    let length = 0;
    for (let j = 0; j <= 48; j++) {
      const t = j / 48, u = 1 - t;
      const p: Point = [u ** 3 * start[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * o.x,
        u ** 3 * start[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * o.y];
      if (j) length += Math.hypot(p[0] - points[j - 1][0], p[1] - points[j - 1][1]);
      points.push(p);
    }
    return { points, length };
  });
  return { palette, organs, conduits };
}
