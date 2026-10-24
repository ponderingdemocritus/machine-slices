// Serves the viewer on loopback: `/` is the page, `/dist/…` the compiled modules, anything else 404.
// Usage: node server.mjs [--port <1-65535>]   (default 4173)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE = 'Usage: node server.mjs [--port <1-65535>]';
const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const TYPES = { '.js': 'text/javascript; charset=utf-8', '.map': 'application/json; charset=utf-8' };

function fail(reason) {
  console.error(`server.mjs: ${reason}\n${USAGE}`);
  process.exit(2);
}

function parsePort(args) {
  let port = '4173';
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--port') {
      if (i + 1 >= args.length) fail('--port needs a value');
      port = args[++i];
    } else if (arg.startsWith('--port=')) {
      port = arg.slice('--port='.length);
    } else {
      fail(`unknown argument ${JSON.stringify(arg)}`);
    }
  }
  const n = /^[0-9]{1,5}$/.test(port) ? Number(port) : NaN;
  if (!(n >= 1 && n <= 65535)) fail(`invalid port ${JSON.stringify(port)}: expected an integer from 1 to 65535`);
  return n;
}

/** The file for a URL path, or null when the path is not served. */
function fileFor(pathname) {
  if (pathname === '/') return { path: join(ROOT, 'public', 'index.html'), type: 'text/html; charset=utf-8' };
  if (!pathname.startsWith('/dist/')) return null;
  const path = normalize(join(ROOT, pathname));
  const type = TYPES[extname(path)];
  return type && path.startsWith(DIST + sep) ? { path, type } : null;
}

const port = parsePort(process.argv.slice(2));
const server = createServer(async (req, res) => {
  let file = null;
  try {
    file = fileFor(decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname));
  } catch {
    // A malformed URL is simply not found.
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(file ? 405 : 404, file ? { allow: 'GET, HEAD' } : {}).end();
    return;
  }
  try {
    if (!file) throw new Error('not served');
    const body = await readFile(file.path);
    res.writeHead(200, { 'content-type': file.type, 'content-length': body.length, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found\n');
  }
});
server.on('error', (error) => {
  console.error(`server.mjs: cannot listen on 127.0.0.1:${port}: ${error.message}`);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => console.log(`Machine Slices: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0));
