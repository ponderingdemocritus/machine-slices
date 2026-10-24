import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const validArgs = args.length === 0 || (args.length === 2 && args[0] === '--port' && /^\d+$/.test(args[1]));
const port = args.length === 0 ? 4173 : Number(args[1]);
if (!validArgs || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Usage: node server.mjs [--port 1..65535]');
  process.exit(1);
}
const root = fileURLToPath(new URL('.', import.meta.url));
const dist = resolve(root, 'dist');
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = pathname === '/' ? resolve(root, 'public/index.html') : resolve(root, '.' + pathname);
    const module = pathname.startsWith('/dist/') && path.startsWith(dist + sep) && path.endsWith('.js');
    if ((pathname !== '/' && !module) || (req.method !== 'GET' && req.method !== 'HEAD')) {
      res.writeHead(404).end('Not found'); return;
    }
    const data = await readFile(path);
    res.writeHead(200, {
      'content-type': pathname === '/' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8',
      'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    }).end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404).end('Not found'); }
});
server.on('error', error => { console.error(`Cannot start Machine Slices: ${error.message}`); process.exit(1); });
server.listen(port, '127.0.0.1', () => console.log(`Machine Slices: http://127.0.0.1:${port}`));
