// Unit tests of the runtime's pure parts (run on the compiled modules: npm test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCanvasSize, checkFrameOptions, checkTime, checkViewport, parseSeed } from "../dist/engine/validate.js";
import { BEAT_MS, BEATS_PER_CYCLE, CYCLE_MS, clockAt, contraction, heartStroke, heartStrokeInverse, pulseAges, STROKES, teethAdvanced } from "../dist/engine/rhythm.js";
import { seedWords, stream } from "../dist/engine/random.js";

const SEED = "0x" + "11".repeat(32);
const WHOLE = { x: 0, y: 0, width: 2000, height: 2000 };

test("seeds are 0x and 64 hex digits, either case, and come back lowercase", () => {
  assert.equal(parseSeed("0x" + "AB".repeat(32)), "ab".repeat(32));
  for (const bad of ["", "0x12", "0x" + "gg".repeat(32), "11".repeat(32), "0x" + "1".repeat(65), 17, null, undefined]) {
    assert.throws(() => parseSeed(bad), (e) => e instanceof Error && e.message.length > 0, String(bad));
  }
});

test("times are finite numbers, 0 or more", () => {
  assert.equal(checkTime(0), 0);
  assert.equal(checkTime(1e12), 1e12);
  for (const bad of [-1, -1e-9, NaN, Infinity, "10", null, undefined]) assert.throws(() => checkTime(bad), Error);
});

test("viewports lie inside the 2000 x 2000 world with a positive extent", () => {
  assert.deepEqual(checkViewport({ x: 1950, y: 1920, width: 50, height: 80 }), { x: 1950, y: 1920, width: 50, height: 80 });
  const bad = [null, 5, {}, { x: -1, y: 0, width: 50, height: 80 }, { x: 0, y: 0, width: 0, height: 80 }, { x: 0, y: 0, width: 50, height: -1 },
    { x: 1990, y: 0, width: 50, height: 80 }, { x: 0, y: 1990, width: 50, height: 80 }, { x: NaN, y: 0, width: 50, height: 80 },
    { x: 0, y: 0, width: Infinity, height: 80 }, { x: "0", y: 0, width: 50, height: 80 }];
  for (const v of bad) assert.throws(() => checkViewport(v), Error, JSON.stringify(v));
});

test("canvases need positive integer dimensions", () => {
  checkCanvasSize(1, 1);
  for (const [w, h] of [[0, 10], [10, 0], [1.5, 2], [-3, 3]]) assert.throws(() => checkCanvasSize(w, h), RangeError);
});

test("every refusal names its reason", () => {
  assert.throws(() => checkFrameOptions(null), /options must be an object/);
  assert.throws(() => checkFrameOptions({ seed: SEED, timeMs: 0 }), /viewport/);
  assert.throws(() => checkFrameOptions({ seed: SEED, viewport: WHOLE }), /timeMs/);
  assert.throws(() => checkFrameOptions({ timeMs: 0, viewport: WHOLE }), /seed/);
  assert.deepEqual(checkFrameOptions({ seed: SEED, timeMs: 5, viewport: WHOLE }), { seedHex: "11".repeat(32), timeMs: 5, viewport: WHOLE });
});

test("the clock repeats every 60 s: 72 beats and 12 breaths", () => {
  assert.equal(CYCLE_MS, 60_000);
  assert.equal(BEATS_PER_CYCLE * BEAT_MS, CYCLE_MS);
  for (const t of [0, 731, 2137, 5039, 59_999.5]) assert.deepEqual(clockAt(t + 3 * CYCLE_MS), clockAt(t));
});

test("the heart's stroke rises from 0 to 1 and can be inverted", () => {
  assert.equal(heartStroke(0), 0);
  assert.ok(Math.abs(heartStroke(1) - 1) < 1e-12);
  let last = -1;
  for (let f = 0; f <= 1; f += 0.001) {
    const u = heartStroke(f);
    assert.ok(u >= last, `monotonic at ${f}`);
    last = u;
  }
  for (const u of [0.05, 0.3, 0.61, 0.9]) assert.ok(Math.abs(heartStroke(heartStrokeInverse(u)) - u) < 1e-9);
});

test("gear trains advance a whole number of teeth per beat, smoothly or by clicks", () => {
  const end = clockAt(CYCLE_MS - 1e-6);
  for (const clicks of [false, true]) {
    for (const delay of [0, 0.37, 2.9]) {
      const advance = teethAdvanced(end, 2, clicks, delay) - teethAdvanced(clockAt(0), 2, clicks, delay);
      assert.ok(Math.abs(advance - 2 * BEATS_PER_CYCLE) < 1e-3, `${clicks} ${delay}: ${advance}`);
    }
  }
  // A click is quick: most of a beat is rest.
  const a = teethAdvanced(clockAt(0.5 * BEAT_MS), 1, true, 0), b = teethAdvanced(clockAt(0.9 * BEAT_MS), 1, true, 0);
  assert.equal(a, b);
});

test("pulses leave on the heart's two strokes, lub stronger than dub, as the heart contracts", () => {
  assert.equal(STROKES.length, 2);
  assert.ok(STROKES[0].phase < STROKES[1].phase && STROKES[1].phase < 1);
  assert.ok(STROKES[0].strength > STROKES[1].strength);
  for (const s of STROKES) assert.ok(contraction(s.phase) > 0.6, `contracting at ${s.phase}`);
});

test("a source fires one pulse per beat", () => {
  const ages = pulseAges(clockAt(1000), 0.25, 3 * BEAT_MS);
  assert.equal(ages.length, 3);
  ages.forEach((age, i) => i && assert.ok(Math.abs(age - ages[i - 1] - BEAT_MS) < 1e-9));
});

test("random streams are deterministic and independent", () => {
  const words = seedWords("0123456789abcdef".repeat(4));
  assert.deepEqual(words.slice(0, 2), [0x01234567, 0x89abcdef]);
  const draw = (label) => {
    const rng = stream(words, label);
    return [1, 2, 3, 4, 5].map(() => rng.u32());
  };
  assert.deepEqual(draw("heart"), draw("heart"));
  assert.notDeepEqual(draw("heart"), draw("vessels"));
});
