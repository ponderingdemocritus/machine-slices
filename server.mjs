import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const rawPort = args.length === 0 ? '4173' : args.length === 2 && args[0] === '--port' ? args[1] : '';
const port = /^\d+$/.test(rawPort) ? Number(rawPort) : NaN;
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Usage: node server.mjs [--port 1..65535]; port must be a decimal integer.');
  process.exit(1);
}
const root = fileURLToPath(new URL('.', import.meta.url));
const dist = resolve(root, 'dist');
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let path;
    if (pathname === '/') path = resolve(root, 'public/index.html');
    else if (pathname.startsWith('/dist/')) {
      path = resolve(dist, pathname.slice(6));
      if (!path.startsWith(dist + sep) || !path.endsWith('.js')) {
        res.writeHead(404).end('Not found'); return;
      }
    } else { res.writeHead(404).end('Not found'); return; }
    const data = await readFile(path);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' }).end('Method not allowed'); return;
    }
    res.writeHead(200, {
      'content-type': pathname === '/' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8',
      'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    }).end(data);
  } catch { res.writeHead(404).end('Not found'); }
});
server.on('error', error => { console.error(`Cannot serve Machine Slices: ${error.message}`); process.exit(1); });
server.listen(port, '127.0.0.1', () => console.log(`Machine Slices: http://127.0.0.1:${port}`));
