import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
const serverPath = fileURLToPath(new URL('../server.mjs', import.meta.url));

test('CLI refuses invalid flags, nondecimal ports and out-of-range ports with a reason', () => {
  for (const args of [['--nope'], ['--port'], ['--port','0'], ['--port','65536'], ['--port','1.5'],
    ['--port','NaN'], ['--port','1e3'], ['--port','0x1000'], ['--port',' 4173 '], ['--port','4173','extra']]) {
    const r = spawnSync(process.execPath, [serverPath, ...args], { encoding:'utf8' });
    assert.notEqual(r.status, 0, args.join(' ')); assert.match(r.stderr, /Usage/); assert.equal(r.stdout, '');
  }
});

test('loopback server serves browser modules from any cwd and refuses paths outside dist', async () => {
  const port = await new Promise(resolve => {
    const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
  const child = spawn(process.execPath, [serverPath, '--port', String(port)], { cwd:'/tmp' });
  try {
    await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); child.once('exit', code => reject(new Error('Server exited: ' + code))); });
    const url = `http://127.0.0.1:${port}`;
    for (const path of ['/', '/dist/runtime.js', '/dist/machine.js', '/dist/viewer.js']) {
      const r = await fetch(url + path); assert.equal(r.status, 200); assert.ok((await r.text()).length > 0);
    }
    for (const path of ['/missing', '/package.json', '/dist/%2e%2e%2fpackage.json', '/dist/%2e%2e%2fserver.mjs', '/dist/%', '/dist/']) {
      assert.equal((await fetch(url + path)).status, 404, path);
    }
    const head = await fetch(url, { method:'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  } finally { child.kill(); }
});
