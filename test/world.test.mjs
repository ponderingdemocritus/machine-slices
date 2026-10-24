// Invariants of the machine every seed must keep (run on the compiled modules: npm test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWorld } from "../dist/world/world.js";
import { heartPose } from "../dist/world/heart.js";
import { BEATS_PER_CYCLE } from "../dist/engine/rhythm.js";

const SEEDS = ["11".repeat(32), "ab".repeat(32), "0123456789abcdef".repeat(4), "f00d".repeat(16), "deadbeef".repeat(8)];
const worlds = SEEDS.map((seed) => buildWorld(seed));
const TAU = Math.PI * 2;
const frac = (x) => x - Math.floor(x);

test("a world depends only on its seed", () => {
  assert.equal(JSON.stringify(buildWorld(SEEDS[0])), JSON.stringify(worlds[0]));
  assert.notEqual(JSON.stringify(worlds[0]), JSON.stringify(worlds[1]));
});

test("the heart sits at the centre of the world, on the line between slices 499 and 500", () => {
  for (const w of worlds) {
    assert.equal(w.heart.cx, 1000);
    assert.equal(w.heart.cy, 1000);
    assert.equal(w.heart.cylinders % 2, 1);
  }
});

test("every rod keeps its length and every piston stays in its barrel as the crank turns", () => {
  for (const { heart: h } of worlds) {
    for (let turns = 0; turns < 1; turns += 0.01) {
      const pose = heartPose(h, turns);
      h.axes.forEach((axis, i) => {
        const s = pose.piston[i];
        const length = Math.hypot(h.cx + s * Math.cos(axis) - pose.rodX[i], h.cy + s * Math.sin(axis) - pose.rodY[i]);
        assert.ok(Math.abs(length - (i === 0 ? h.rodLength : h.rodLength - h.linkRadius)) < 1e-9);
        assert.ok(s + h.pistonLength * 0.62 < h.barrelEnd, "the crown stays below the head");
      });
    }
  }
});

/** Pairs of gears of one train whose pitch circles touch: they mesh. */
function meshingPairs(w) {
  const pairs = [];
  for (const train of w.works.trains) {
    for (const i of train.gears) {
      for (const j of train.gears) {
        const a = w.works.gears[i], b = w.works.gears[j];
        if (i < j && Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - (a.pitch + b.pitch)) < 1e-6) pairs.push([a, b]);
      }
    }
  }
  return pairs;
}

test("meshing gears turn opposite ways, a tooth of one in a gap of the other", () => {
  for (const w of worlds) {
    const pairs = meshingPairs(w);
    assert.ok(pairs.length > 40);
    for (const [a, b] of pairs) {
      assert.equal(a.module, b.module);
      assert.equal(a.turn, -b.turn);
      // Where the teeth meet, a's offset from its nearest tooth and b's mirror each other: tooth into gap.
      const alpha = Math.atan2(b.y - a.y, b.x - a.x);
      const fa = frac(((alpha - a.phase) * a.teeth) / TAU);
      const fb = frac(((alpha + Math.PI - b.phase) * b.teeth) / TAU);
      const off = frac(fa + fb);
      assert.ok(Math.abs(off - 0.5) < 1e-6, `offset ${off}`);
    }
  }
});

test("every gear of a train meshes with another one of it", () => {
  for (const w of worlds) {
    const meshed = new Set(meshingPairs(w).flat());
    for (const train of w.works.trains) {
      if (train.gears.length > 1) for (const i of train.gears) assert.ok(meshed.has(w.works.gears[i]));
    }
  }
});

test("gears of one layer never overlap unless they mesh", () => {
  for (const w of worlds) {
    const layerOf = new Map();
    w.works.trains.forEach((t) => t.gears.forEach((i) => layerOf.set(w.works.gears[i], t.layer)));
    const meshing = new Set(meshingPairs(w).map(([a, b]) => `${a.x},${a.y}|${b.x},${b.y}`));
    const gears = w.works.gears;
    for (let i = 0; i < gears.length; i++) {
      for (let j = i + 1; j < gears.length; j++) {
        const a = gears[i], b = gears[j];
        if (layerOf.get(a) !== layerOf.get(b) || meshing.has(`${a.x},${a.y}|${b.x},${b.y}`)) continue;
        assert.ok(Math.hypot(b.x - a.x, b.y - a.y) > a.outer + b.outer, "tip circles apart");
      }
    }
  }
});

test("after one cycle every gear shows the same picture again", () => {
  for (const w of worlds) {
    for (const train of w.works.trains) {
      for (const i of train.gears) {
        const g = w.works.gears[i];
        // Teeth advanced in a cycle, in steps of the body's symmetry: a whole number.
        const steps = (train.perBeat * BEATS_PER_CYCLE * g.symmetry) / g.teeth;
        assert.equal(steps, Math.round(steps), `${g.teeth} teeth, symmetry ${g.symmetry}`);
        assert.equal(g.teeth % g.symmetry, 0);
      }
    }
  }
});

test("escape wheels close the cycle too: 36 teeth a cycle, four windows", () => {
  for (const w of worlds) {
    for (const o of w.organs) if (o.kind === "escapement") assert.equal((36 * 4) % o.count, 0, `${o.count} teeth`);
  }
});

test("each branch starts where its parent ends, and distance from the heart grows along it", () => {
  for (const w of worlds) {
    for (const c of w.vessels.chains) {
      for (let i = 1; i < c.ds.length; i++) assert.ok(c.ds[i] > c.ds[i - 1]);
      if (c.parent < 0) continue;
      const p = w.vessels.chains[c.parent];
      const end = p.xs.length - 1;
      assert.equal(c.xs[0], p.xs[end]);
      assert.equal(c.ys[0], p.ys[end]);
      assert.equal(c.ds[0], p.ds[end]);
    }
  }
});

test("organs keep clear of the heart and of each other, and vessels feed them", () => {
  for (const w of worlds) {
    assert.ok(w.organs.length >= 3);
    for (const o of w.organs) {
      assert.ok(Math.hypot(o.x - w.heart.cx, o.y - w.heart.cy) > w.heart.radius + o.radius);
      for (const p of w.organs) if (p !== o) assert.ok(Math.hypot(o.x - p.x, o.y - p.y) > o.radius + p.radius);
    }
    assert.ok(w.organs.filter((o) => o.inlet).length >= w.organs.length - 1);
  }
});
