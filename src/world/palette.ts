// Curated palettes. A seed picks one; every colour of a frame comes from it.

import type { Rng } from "../engine/random.js";

/** Four tones of one metal, from its shadow to its specular highlight. */
export interface Metal {
  dark: string;
  base: string;
  light: string;
  shine: string;
}

export type Rgb = readonly [number, number, number];

export interface Palette {
  name: string;
  /** The ground's radial gradient: at the heart, midway, at the corners. */
  ground: readonly [string, string, string];
  /** Faint construction lines of the ground. */
  grid: string;
  /** The tint of the body's cells, drawn faint over the ground. */
  tissue: Rgb;
  /** Outlines and the darkest shadows. */
  ink: string;
  /** Drop shadows, translucent. */
  shade: string;
  /** Tones of the working gears; each train is cast in one of them. */
  metals: readonly Metal[];
  /** The deep, dim gears behind everything. */
  deep: Metal;
  /** The vessels: their dark edge, wall, inner channel, highlight and the collars around them. */
  vessel: { edge: string; wall: string; lumen: string; shine: string; collar: string };
  /** The heart's casting and its moving steel. */
  heart: { body: Metal; steel: Metal };
  /** The light that flows: pulses, sparks, the heart's fire. */
  glow: Rgb;
  /** The white-hot core of that light. */
  spark: Rgb;
}

const PALETTES: readonly Palette[] = [
  {
    name: "verdigris and ember",
    ground: ["#1b2b2b", "#0f1a1a", "#060b0b"],
    grid: "rgba(165, 214, 200, 0.075)",
    tissue: [150, 225, 205],
    ink: "#040808",
    shade: "rgba(0, 0, 0, 0.5)",
    metals: [
      { dark: "#5b4222", base: "#a58149", light: "#d6b67b", shine: "#f6e4b3" },
      { dark: "#5c2e1b", base: "#a65c39", light: "#d8946b", shine: "#f7cbab" },
      { dark: "#34444a", base: "#72868c", light: "#adbdc1", shine: "#e3eef0" },
    ],
    deep: { dark: "#0f1a1b", base: "#1c2d2e", light: "#28403f", shine: "#335150" },
    vessel: { edge: "#040c0c", wall: "#2b5650", lumen: "#081413", shine: "#a3d8c9", collar: "#6f9d90" },
    heart: {
      body: { dark: "#4f3a1f", base: "#9a7843", light: "#cfae74", shine: "#f3dfae" },
      steel: { dark: "#2f3d42", base: "#6c7f86", light: "#a9babf", shine: "#e6f0f2" },
    },
    glow: [255, 136, 70],
    spark: [255, 230, 196],
  },
  {
    name: "steel and cyan",
    ground: ["#1b2232", "#0e121c", "#05070c"],
    grid: "rgba(170, 196, 240, 0.07)",
    tissue: [165, 195, 250],
    ink: "#030509",
    shade: "rgba(0, 0, 0, 0.5)",
    metals: [
      { dark: "#3a4351", base: "#798597", light: "#b7c2d2", shine: "#eef3fa" },
      { dark: "#2b2f37", base: "#5b626f", light: "#949caa", shine: "#d2d7df" },
      { dark: "#6a5226", base: "#ad8b4c", light: "#dbbf88", shine: "#f8ebc4" },
    ],
    deep: { dark: "#0e121c", base: "#192032", light: "#242e44", shine: "#2f3b55" },
    vessel: { edge: "#03050a", wall: "#243859", lumen: "#060b15", shine: "#a2c4f2", collar: "#607ba7" },
    heart: {
      body: { dark: "#353d4a", base: "#6f7b8c", light: "#aab6c6", shine: "#e8eef7" },
      steel: { dark: "#5e4720", base: "#a1803f", light: "#d3b67c", shine: "#f6e6bb" },
    },
    glow: [88, 222, 255],
    spark: [226, 250, 255],
  },
  {
    name: "bone and vermilion",
    ground: ["#2b2420", "#18120f", "#090606"],
    grid: "rgba(240, 218, 196, 0.06)",
    tissue: [255, 196, 172],
    ink: "#070403",
    shade: "rgba(0, 0, 0, 0.5)",
    metals: [
      { dark: "#6a5f53", base: "#b6a892", light: "#e1d5bf", shine: "#fbf4e6" },
      { dark: "#3a3432", base: "#6f6662", light: "#a69c96", shine: "#dad2cc" },
      { dark: "#6a4c1f", base: "#b7893d", light: "#e1bc75", shine: "#fbe7b8" },
    ],
    deep: { dark: "#1c1513", base: "#2c221d", light: "#3a2d26", shine: "#47372e" },
    vessel: { edge: "#0a0504", wall: "#5b2a23", lumen: "#170806", shine: "#ebb6a6", collar: "#8f5b4d" },
    heart: {
      body: { dark: "#5f554a", base: "#a99b86", light: "#d8cbb4", shine: "#f8f0e0" },
      steel: { dark: "#38322f", base: "#6c635f", light: "#a39993", shine: "#ddd5cf" },
    },
    glow: [255, 74, 46],
    spark: [255, 216, 172],
  },
  {
    name: "ink and gold",
    ground: ["#25211a", "#14120d", "#080705"],
    grid: "rgba(236, 222, 180, 0.065)",
    tissue: [250, 222, 160],
    ink: "#060504",
    shade: "rgba(0, 0, 0, 0.5)",
    metals: [
      { dark: "#6d5120", base: "#bf9343", light: "#eac67e", shine: "#fff0c4" },
      { dark: "#484846", base: "#888783", light: "#c1bfb9", shine: "#efede8" },
      { dark: "#593a21", base: "#92643d", light: "#c6945e", shine: "#ecc89f" },
    ],
    deep: { dark: "#18150f", base: "#28241b", light: "#353024", shine: "#423b2d" },
    vessel: { edge: "#060504", wall: "#3e3a2b", lumen: "#0d0c08", shine: "#dcd4b0", collar: "#7f7759" },
    heart: {
      body: { dark: "#62491d", base: "#b0873d", light: "#e0bc74", shine: "#fcecbd" },
      steel: { dark: "#444442", base: "#82817d", light: "#bcbab4", shine: "#ecebe6" },
    },
    glow: [255, 196, 84],
    spark: [255, 244, 214],
  },
];

/** A seed's palette: one of the curated four. */
export function choosePalette(rng: Rng): Palette {
  return rng.pick(PALETTES);
}

export const rgba = (c: Rgb, alpha: number): string => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;

/** An RGB triple as `#rrggbb`. */
export const hex = (c: Rgb): string => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

/** The colour a fraction t of the way from `#rrggbb` a to b, as `#rrggbb`. */
export function mix(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  let out = "#";
  for (let i = 0; i < 3; i++) out += Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t).toString(16).padStart(2, "0");
  return out;
}
