// The server's contract: loopback, `/` and the compiled modules, 404 elsewhere, and a refusal with a
// reason for bad arguments (run after a build: npm test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const SERVER = fileURLToPath(new URL("../server.mjs", import.meta.url));

const freePort = () =>
  new Promise((resolve) => {
    const s = createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

test("bad arguments exit nonzero with a reason on stderr", () => {
  for (const args of [["--port"], ["--port", "abc"], ["--port", "0"], ["--port", "70000"], ["--port", "1e3"], ["--colour"], ["4173"]]) {
    const r = spawnSync(process.execPath, [SERVER, ...args], { encoding: "utf8", timeout: 5000 });
    assert.notEqual(r.status, 0, args.join(" "));
    assert.match(r.stderr, /\S/, args.join(" "));
  }
});

test("serves the page and the runtime on loopback, and 404 elsewhere", async () => {
  const port = await freePort();
  const server = spawn(process.execPath, [SERVER, "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"] });
  try {
    await new Promise((resolve, reject) => {
      server.stdout.once("data", resolve);
      server.once("exit", (code) => reject(new Error(`server exited with ${code}`)));
    });
    const status = async (path, method = "GET") => (await fetch(`http://127.0.0.1:${port}${path}`, { method })).status;
    assert.equal(await status("/"), 200);
    assert.equal(await status("/dist/runtime.js"), 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/dist/runtime.js`)).headers.get("content-type"), "text/javascript; charset=utf-8");
    for (const path of ["/nope", "/dist/", "/dist/../server.mjs", "/dist/%2e%2e/package.json", "/public/index.html", "/package.json"]) {
      assert.equal(await status(path), 404, path);
    }
    assert.equal(await status("/", "POST"), 405);
  } finally {
    server.kill();
  }
});
