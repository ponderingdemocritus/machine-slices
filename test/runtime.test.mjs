import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFrame } from '../dist/runtime.js';
import { compose } from '../dist/machine.js';
const seed = '0x' + '11'.repeat(32);
const options = { seed, timeMs: 0, viewport: { x: 0, y: 0, width: 2000, height: 2000 } };
const untouched = { width: 100, height: 100, getContext() { assert.fail('Invalid options must fail before requesting a context'); } };
const error = e => e instanceof Error && e.message.length > 0;
test('rejects invalid inputs before drawing', () => {
  for (const value of [undefined, null, 12, '', '0x12', '0x' + 'gg'.repeat(32)]) assert.throws(() => renderFrame(untouched, { ...options, seed: value }), error);
  for (const value of [undefined, null, '10', NaN, Infinity, -1]) assert.throws(() => renderFrame(untouched, { ...options, timeMs: value }), error);
  for (const value of [undefined, null, {}, ...['x', 'y', 'width', 'height'].flatMap(k => [null, '1', NaN, Infinity].map(v => ({ ...options.viewport, [k]: v }))),
    { x: -1, y: 0, width: 10, height: 10 }, { x: 0, y: -1, width: 10, height: 10 },
    { x: 0, y: 0, width: 0, height: 10 }, { x: 0, y: 0, width: 10, height: -1 },
    { x: 1999, y: 0, width: 2, height: 10 }, { x: 0, y: 1999, width: 10, height: 2 }]) assert.throws(() => renderFrame(untouched, { ...options, viewport: value }), error);
});
test('rejects unusable canvases', () => {
  for (const canvas of [null, {}, { width: 0, height: 1 }, { width: 1.5, height: 1 }, { width: 1, height: -1 }, { width: 1, height: 1, getContext: () => null }]) assert.throws(() => renderFrame(canvas, options), error);
});
test('layout is deterministic, case insensitive, seed dependent, and connected', () => {
  const a = compose(seed);
  compose('0x' + 'ab'.repeat(32));
  assert.deepEqual(compose(seed), a);
  assert.deepEqual(compose('0x' + 'AB'.repeat(32)), compose('0x' + 'ab'.repeat(32)));
  assert.notDeepEqual(compose('0x' + 'ab'.repeat(32)), a);
  a.organs.forEach((o, i) => {
    assert.deepEqual(a.conduits[i].points.at(-1), [o.x, o.y]);
    assert.ok(a.conduits[i].length > 0);
  });
});
