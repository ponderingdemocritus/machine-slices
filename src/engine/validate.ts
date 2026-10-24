// Input contract of renderFrame. Everything is checked before anything is drawn, and every refusal is
// an Error with a readable reason: TypeError for a missing or mistyped value, RangeError for a value of
// the right type outside its range.

/** The machine is a square world of WORLD_SIZE × WORLD_SIZE logical units. */
export const WORLD_SIZE = 2000;

/** A window into the world, in logical units. */
export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameOptions {
  /** `0x` followed by exactly 64 hexadecimal digits, either case. */
  seed: string;
  /** Finite, nonnegative milliseconds on the machine's clock. */
  timeMs: number;
  viewport: Viewport;
}

/** Validated frame inputs: the seed as 64 lowercase hex digits (no `0x`), and a copied viewport. */
export interface FrameInput {
  seedHex: string;
  timeMs: number;
  viewport: Viewport;
}

const SEED_PATTERN = /^0x[0-9a-f]{64}$/i;

function describe(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value.length > 24 ? `${value.slice(0, 24)}…` : value);
  if (typeof value === "number") return String(value);
  return `a ${typeof value}`;
}

/** Returns the seed's 64 hex digits, lowercased, or throws. */
export function parseSeed(seed: unknown): string {
  if (typeof seed !== "string") throw new TypeError(`seed must be a string, got ${describe(seed)}`);
  if (!SEED_PATTERN.test(seed)) {
    throw new RangeError(`seed must be "0x" followed by exactly 64 hexadecimal digits, got ${describe(seed)}`);
  }
  return seed.slice(2).toLowerCase();
}

/** Returns the time, or throws unless it is a finite nonnegative number. */
export function checkTime(timeMs: unknown): number {
  if (typeof timeMs !== "number") throw new TypeError(`timeMs must be a number, got ${describe(timeMs)}`);
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    throw new RangeError(`timeMs must be a finite number of milliseconds, 0 or more, got ${describe(timeMs)}`);
  }
  return timeMs;
}

/** Returns a copy of the viewport, or throws unless it lies inside the world with a positive extent. */
export function checkViewport(viewport: unknown): Viewport {
  if (typeof viewport !== "object" || viewport === null) {
    throw new TypeError(`viewport must be an object {x, y, width, height}, got ${describe(viewport)}`);
  }
  const v = viewport as Record<string, unknown>;
  const read = (key: "x" | "y" | "width" | "height"): number => {
    const n = v[key];
    if (typeof n !== "number") throw new TypeError(`viewport.${key} must be a number, got ${describe(n)}`);
    if (!Number.isFinite(n)) throw new RangeError(`viewport.${key} must be finite, got ${describe(n)}`);
    return n;
  };
  const x = read("x"), y = read("y"), width = read("width"), height = read("height");
  if (x < 0 || y < 0) throw new RangeError(`viewport origin must be 0 or more, got (${x}, ${y})`);
  if (width <= 0 || height <= 0) throw new RangeError(`viewport extent must be positive, got ${width} × ${height}`);
  if (x + width > WORLD_SIZE || y + height > WORLD_SIZE) {
    throw new RangeError(
      `viewport must stay inside the ${WORLD_SIZE} × ${WORLD_SIZE} world: x + width = ${x + width}, y + height = ${y + height}`,
    );
  }
  return { x, y, width, height };
}

/** Throws unless both canvas dimensions are positive integers. */
export function checkCanvasSize(width: unknown, height: unknown): void {
  const ok = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n > 0;
  if (!ok(width) || !ok(height)) {
    throw new RangeError(`canvas must have positive integer dimensions, got ${describe(width)} × ${describe(height)}`);
  }
}

/** Validates the whole options object of renderFrame. */
export function checkFrameOptions(options: unknown): FrameInput {
  if (typeof options !== "object" || options === null) {
    throw new TypeError(`options must be an object {seed, timeMs, viewport}, got ${describe(options)}`);
  }
  const o = options as Record<string, unknown>;
  return { seedHex: parseSeed(o.seed), timeMs: checkTime(o.timeMs), viewport: checkViewport(o.viewport) };
}
