import { renderFrame } from './runtime.js';
const canvas = document.querySelector<HTMLCanvasElement>('#artwork')!;
const timeInput = document.querySelector<HTMLInputElement>('#time')!;
const scrub = document.querySelector<HTMLInputElement>('#scrub')!;
const seedInput = document.querySelector<HTMLInputElement>('#seed')!;
const status = document.querySelector<HTMLElement>('#status')!;
const play = document.querySelector<HTMLButtonElement>('#play')!;
const pause = document.querySelector<HTMLButtonElement>('#pause')!;
let seed = '0x' + '11'.repeat(32), timeMs = 0, playing = false, previous = 0;
function redraw() {
  renderFrame(canvas, { seed, timeMs, viewport: { x: 0, y: 0, width: 2000, height: 2000 } });
  timeInput.value = String(Math.round(timeMs)); scrub.value = String(Math.round(timeMs));
}
function setPlaying(value: boolean) {
  playing = value; previous = 0;
  play.setAttribute('aria-pressed', String(playing));
  pause.setAttribute('aria-pressed', String(!playing));
  status.textContent = playing ? 'Running · 60 second loop' : 'Paused';
}
function setTime(input: HTMLInputElement) {
  if (!input.value.trim() || !Number.isFinite(input.valueAsNumber)) {
    status.textContent = 'Enter a time from 0 to 60000 milliseconds.'; return;
  }
  timeMs = Math.max(0, Math.min(60000, input.valueAsNumber));
  redraw(); status.textContent = playing ? 'Running · 60 second loop' : 'Paused';
}
play.addEventListener('click', () => setPlaying(true));
pause.addEventListener('click', () => setPlaying(false));
timeInput.addEventListener('input', () => setTime(timeInput));
scrub.addEventListener('input', () => setTime(scrub));
document.querySelector('#apply-seed')!.addEventListener('click', () => {
  const candidate = seedInput.value.trim();
  if (!/^0x[0-9a-f]{64}$/i.test(candidate)) {
    status.textContent = 'Seed must be 0x followed by 64 hexadecimal digits. The current seed is still active.'; return;
  }
  seed = candidate; redraw(); status.textContent = 'Seed applied · ' + (playing ? 'running' : 'paused');
});
document.addEventListener('keydown', event => {
  if (event.code === 'Space' && event.target === document.body) {
    event.preventDefault(); setPlaying(!playing);
  }
});
function tick(now: number) {
  if (playing) {
    if (previous) timeMs = (timeMs + now - previous) % 60000;
    previous = now; redraw();
  }
  requestAnimationFrame(tick);
}
redraw(); setPlaying(false); requestAnimationFrame(tick);
