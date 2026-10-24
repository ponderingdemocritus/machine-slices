import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

// These checks supplement the pinned round checks: caller state, zoomed seams,
// validation atomicity, and recovery paths in the viewer.
test('runtime and viewer edge cases in Chromium', async t => {
  const port = await new Promise((resolve, reject) => {
    const s = createServer().once('error', reject).listen(0, '127.0.0.1', () => {
      const p = s.address().port; s.close(() => resolve(p));
    });
  });
  const server = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url)), '--port', String(port)]);
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.stdout.once('data', resolve); server.once('error', reject);
      server.once('exit', code => reject(new Error('Server exited: ' + code)));
    });
    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}`);
    await t.test('render ignores caller clip, opacity, filters and transforms; invalid requests preserve pixels', async () => {
      const result = await page.evaluate(async () => {
        const { renderFrame } = await import('/dist/runtime.js');
        const c = document.createElement('canvas'); c.width = 317; c.height = 219;
        const options = { seed:'0x'+'ab'.repeat(32), timeMs:731, viewport:{x:873.25,y:941.5,width:201,height:137} };
        renderFrame(c, options); const expected = c.toDataURL();
        const ctx = c.getContext('2d');
        ctx.beginPath(); ctx.rect(0,0,1,1); ctx.clip(); ctx.globalAlpha = .1; ctx.filter = 'blur(12px)';
        ctx.globalCompositeOperation = 'destination-out'; ctx.translate(51,19);
        renderFrame(c, options);
        const restored = c.toDataURL() === expected && c.width === 317 && c.height === 219;
        const invalid = [undefined, null, {}, {...options,seed:undefined}, {...options,timeMs:undefined},
          {...options,timeMs:true}, {...options,viewport:{x:0,y:0,width:10}}];
        let refused = 0;
        for (const value of invalid) {
          try { renderFrame(c,value); } catch(e) { if(e instanceof Error && e.message && c.toDataURL() === expected) refused++; }
        }
        renderFrame(c,{...options,seed:options.seed.toUpperCase()});
        const uppercase = c.toDataURL() === expected;
        renderFrame(c,{...options,timeMs:Number.MAX_VALUE});
        const pixels=ctx.getImageData(0,0,317,219).data;
        return {restored,uppercase,refused,total:invalid.length,opaque:pixels.every((v,i)=>i%4!==3 || v===255)};
      });
      assert.equal(result.refused, result.total); assert.ok(result.restored); assert.ok(result.uppercase); assert.ok(result.opaque);
    });
    await t.test('5× neighbouring studies match their joined viewport at all four inspection times', async () => {
      const differences = await page.evaluate(async () => {
        const { renderFrame } = await import('/dist/runtime.js');
        const results=[];
        for(const timeMs of [0,731,2137,5039]) {
          const seed='0x'+'11'.repeat(32);
          const whole=document.createElement('canvas'); whole.width=500;whole.height=400;
          renderFrame(whole,{seed,timeMs,viewport:{x:950,y:960,width:100,height:80}});
          for(let i=0;i<2;i++){
            const c=document.createElement('canvas'); c.width=250;c.height=400;
            renderFrame(c,{seed,timeMs,viewport:{x:950+i*50,y:960,width:50,height:80}});
            const a=c.getContext('2d').getImageData(0,0,250,400).data;
            const b=whole.getContext('2d').getImageData(i*250,0,250,400).data;
            results.push(a.reduce((sum,v,j)=>sum+(v!==b[j]?1:0),0));
          }
        }
        return results;
      });
      assert.deepEqual(differences, Array(8).fill(0));
    });
    await t.test('invalid preview seed reports an error, preserves the artwork, and recovers with Enter', async () => {
      const hash = () => page.locator('#artwork').evaluate(c => c.toDataURL());
      const before = await hash();
      await page.locator('#seed').fill('not-a-seed'); await page.locator('#apply-seed').click();
      assert.equal(await hash(), before); assert.match(await page.locator('#status').innerText(), /64 hexadecimal/);
      assert.equal(await page.locator('#seed').getAttribute('aria-invalid'), 'true');
      await page.locator('#seed').fill('0x'+'11'.repeat(32)); await page.locator('#seed').press('Enter');
      assert.equal(await page.locator('#seed').getAttribute('aria-invalid'), null); assert.equal(await hash(), before);
    });
    await t.test('time limits are enforced and playback stops at 60 seconds', async () => {
      await page.locator('#time').fill('-1');
      assert.equal(await page.locator('#time').getAttribute('aria-invalid'), 'true');
      await page.locator('#time').fill('59950'); await page.locator('#play').click();
      await page.waitForFunction(() => document.querySelector('#time').value === '60000');
      assert.equal(await page.locator('#pause').getAttribute('aria-pressed'), 'true');
      await page.locator('#reset').click(); assert.equal(await page.locator('#time').inputValue(), '0');
    });
    await t.test('mobile layout fits its viewport and controls retain labels', async () => {
      await page.setViewportSize({width:390,height:844});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      for(const id of ['seed','time','scrubber']) assert.ok(await page.locator('#'+id).evaluate(e => e.labels.length > 0));
    });
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); server.kill(); }
});
