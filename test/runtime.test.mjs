import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
let server, browser, page, url;
before(async () => {
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'pipe' });
  const port = await new Promise(resolve => {
    const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
  server = spawn(process.execPath, ['server.mjs', '--port', String(port)], { cwd: root, stdio: 'ignore' });
  url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise(r => setTimeout(r, 30));
  }
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  await page.goto(url);
});
after(async () => { await browser?.close(); server?.kill('SIGTERM'); });

async function inRuntime(fn) {
  return page.evaluate(async source => {
    const { renderFrame } = await import('/dist/runtime.js');
    const seed = '0x' + '11'.repeat(32);
    const viewport = { x: 0, y: 0, width: 2000, height: 2000 };
    const canvas = document.createElement('canvas'); canvas.width = 173; canvas.height = 97;
    return new Function('renderFrame', 'canvas', 'seed', 'viewport', `return (${source})()`)(renderFrame, canvas, seed, viewport);
  }, fn.toString());
}

test('invalid requests preserve the previous pixels, including missing and nonnumeric fields', async () => {
  const result = await inRuntime(() => {
    const good = { seed, timeMs: 731, viewport };
    renderFrame(canvas, good);
    const before = canvas.toDataURL();
    const invalid = [null, undefined, {}, { ...good, seed: undefined }, { ...good, seed: '0x' + '11'.repeat(31) },
      { ...good, timeMs: undefined }, { ...good, timeMs: true }, { ...good, timeMs: -Infinity },
      { ...good, viewport: {} }, { ...good, viewport: { ...viewport, width: null } },
      { ...good, viewport: { ...viewport, height: '2000' } }, { ...good, viewport: { ...viewport, y: 1 } }];
    return invalid.map(options => {
      let error = false;
      try { renderFrame(canvas, options); } catch (e) { error = e instanceof Error && e.message.length > 0; }
      return error && before === canvas.toDataURL();
    });
  });
  assert.ok(result.every(Boolean));
});

test('non-square, fractional, tiny and extreme-time requests remain opaque and keep their dimensions', async () => {
  const result = await inRuntime(() => {
    const cases = [
      { seed, timeMs: 0, viewport },
      { seed, timeMs: Number.MAX_VALUE, viewport },
      { seed, timeMs: .5, viewport: { x: 1999.75, y: 1999.75, width: .25, height: .25 } },
      { seed, timeMs: 0, viewport: { x: 1000, y: 1000, width: 1e-10, height: 1e-10 } },
    ];
    return cases.map(options => {
      renderFrame(canvas, options);
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      return canvas.width === 173 && canvas.height === 97 && pixels.every((v, i) => i % 4 !== 3 || v === 255);
    });
  });
  assert.ok(result.every(Boolean), JSON.stringify(result));
});

test('rendering isolates inherited clipping, transforms, composite modes, and styles', async () => {
  const matches = await inRuntime(() => {
    const options = { seed, timeMs: 5039, viewport };
    renderFrame(canvas, options); const expected = canvas.toDataURL();
    const c = canvas.getContext('2d');
    c.beginPath(); c.rect(0, 0, 8, 8); c.clip(); c.translate(100, 20);
    c.globalAlpha = .2; c.globalCompositeOperation = 'destination-out';
    c.filter = 'blur(8px)'; c.setLineDash([1, 50]); c.shadowBlur = 80;
    renderFrame(canvas, options);
    return canvas.toDataURL() === expected;
  });
  assert.equal(matches, true);
});

test('hexadecimal case, unrelated renders, DOM changes and disabled entropy do not alter a frame', async () => {
  assert.equal(await inRuntime(() => {
    const options = { seed: '0x' + 'ab'.repeat(32), timeMs: 2137, viewport };
    renderFrame(canvas, options); const expected = canvas.toDataURL();
    renderFrame(canvas, { seed, timeMs: 444, viewport });
    const random = Math.random, now = Date.now;
    Math.random = Date.now = () => { throw new Error('Unexpected entropy or wall clock'); };
    document.body.dataset.runtimeTest = 'unrelated DOM state';
    try {
      renderFrame(canvas, { ...options, seed: options.seed.toUpperCase() });
      return expected === canvas.toDataURL();
    } finally { Math.random = random; Date.now = now; delete document.body.dataset.runtimeTest; }
  }), true);
});

test('half-scale and magnified crops match the same region of the full work', async () => {
  assert.deepEqual(await inRuntime(() => {
    const results = [];
    for (const scale of [.5, 2]) for (const seedValue of [seed, '0x' + 'ab'.repeat(32)]) {
      const full = document.createElement('canvas'); full.width = full.height = 2000 * scale;
      renderFrame(full, { seed: seedValue, timeMs: 5039, viewport });
      const v = { x: 948, y: 960, width: 104, height: 80 };
      const crop = document.createElement('canvas'); crop.width = v.width * scale; crop.height = v.height * scale;
      renderFrame(crop, { seed: seedValue, timeMs: 5039, viewport: v });
      const w = crop.width - 4, h = crop.height - 4;
      const a = crop.getContext('2d').getImageData(2, 2, w, h).data;
      const b = full.getContext('2d').getImageData(v.x * scale + 2, v.y * scale + 2, w, h).data;
      results.push(a.every((value, i) => Math.abs(value - b[i]) <= 2));
    }
    return results;
  }), [true, true, true, true]);
});

test('server rejects malformed ports and path traversal and serves ES modules', async () => {
  for (const args of [['--port', '0'], ['--port', '65536'], ['--port', '1.5'], ['--port', '1e3'], ['--port', ''], ['--unknown'], ['--port']]) {
    const r = spawnSync(process.execPath, ['server.mjs', ...args], { cwd: root, encoding: 'utf8', timeout: 2000 });
    assert.notEqual(r.status, 0); assert.match(r.stderr, /Usage/); assert.equal(r.stdout, '');
  }
  const runtime = await fetch(url + '/dist/runtime.js');
  assert.equal(runtime.status, 200); assert.match(runtime.headers.get('content-type'), /javascript/);
  for (const path of ['/missing', '/public/index.html', '/dist/missing.js', '/dist/..%2fpackage.json', '/dist/..%2fREADME.md', '/%ZZ']) {
    assert.equal((await fetch(url + path)).status, 404, path);
  }
});

test('invalid seeds give a visible error, preserve the artwork, and recover on a valid seed', async () => {
  await page.locator('#pause').click();
  const before = await page.locator('#artwork').evaluate(c => c.toDataURL());
  await page.locator('#seed').fill('not a seed'); await page.locator('#apply-seed').click();
  assert.equal(await page.locator('#status').getAttribute('data-error'), 'true');
  assert.match(await page.locator('#status').textContent(), /64 hexadecimal/);
  assert.equal(await page.locator('#artwork').evaluate(c => c.toDataURL()), before);
  await page.locator('#seed').fill('0x' + 'ab'.repeat(32)); await page.locator('#apply-seed').click();
  assert.equal(await page.locator('#status').getAttribute('data-error'), 'false');
  assert.notEqual(await page.locator('#artwork').evaluate(c => c.toDataURL()), before);
});

test('inspection, keyboard controls, and the renderer share the same exact time and seed', async () => {
  await page.locator('#time').fill('2137'); await page.locator('#time').dispatchEvent('input');
  await page.locator('#window-b').click();
  assert.equal(await page.evaluate(async () => {
    const { renderFrame } = await import('/dist/runtime.js');
    const c = document.createElement('canvas'); c.width = 250; c.height = 400;
    renderFrame(c, { seed: document.querySelector('#seed').value, timeMs: 2137, viewport: { x: 1000, y: 960, width: 50, height: 80 } });
    return c.toDataURL() === document.querySelector('#detail').toDataURL();
  }), true);
  await page.locator('#artwork').focus(); await page.keyboard.press('ArrowLeft');
  assert.match(await page.locator('#detail-coordinates').textContent(), /x 950/);
  await page.keyboard.press('Space'); assert.equal(await page.locator('#play').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Space'); assert.equal(await page.locator('#pause').getAttribute('aria-pressed'), 'true');
});

test('viewer fits phone, tablet, and desktop widths without horizontal overflow', async () => {
  for (const [width, height] of [[320, 740], [390, 844], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`);
    assert.ok(await page.locator('#artwork').isVisible());
    assert.ok(await page.locator('#apply-seed').isVisible());
  }
});
