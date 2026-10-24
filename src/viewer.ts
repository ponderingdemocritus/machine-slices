import { renderFrame, type Viewport } from './runtime.js';

const get = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing viewer control: ${selector}`);
  return element;
};
const canvas = get<HTMLCanvasElement>('#artwork');
const detail = get<HTMLCanvasElement>('#detail');
const play = get<HTMLButtonElement>('#play'), pause = get<HTMLButtonElement>('#pause');
const time = get<HTMLInputElement>('#time'), scrub = get<HTMLInputElement>('#scrub');
const seedInput = get<HTMLInputElement>('#seed');
const status = get<HTMLParagraphElement>('#status');
const state = get<HTMLSpanElement>('#play-state');
const windowA = get<HTMLButtonElement>('#window-a'), windowB = get<HTMLButtonElement>('#window-b');
const coordinates = get<HTMLSpanElement>('#detail-coordinates');

const WORLD: Viewport = { x: 0, y: 0, width: 2000, height: 2000 };
const LIMIT = 60000;
let seed = '0x' + '11'.repeat(32), timeMs = 0, playing = false;
let window: Viewport = { x: 950, y: 960, width: 50, height: 80 };
let raf = 0, lastStamp: number | null = null;

function message(value: string, error = false): void {
  status.textContent = value;
  status.dataset.error = String(error);
}
function draw(): void {
  renderFrame(canvas, { seed, timeMs, viewport: WORLD });
  renderFrame(detail, { seed, timeMs, viewport: window });
}
function syncTime(): void {
  time.value = scrub.value = String(Math.round(timeMs));
  scrub.setAttribute('aria-valuetext', `${Math.round(timeMs)} milliseconds`);
}
function syncTransport(): void {
  play.setAttribute('aria-pressed', String(playing));
  pause.setAttribute('aria-pressed', String(!playing));
  state.dataset.playing = String(playing);
  state.textContent = playing ? 'In motion' : 'Paused';
}
function stop(): void {
  if (playing) {
    // A paused millisecond value can be entered again to reproduce this frame.
    timeMs = Math.round(timeMs); syncTime(); draw();
  }
  playing = false; lastStamp = null; cancelAnimationFrame(raf); syncTransport();
}
function tick(stamp: number): void {
  if (!playing) return;
  if (lastStamp !== null) timeMs = Math.min(LIMIT, timeMs + stamp - lastStamp);
  lastStamp = stamp;
  draw(); syncTime();
  if (timeMs >= LIMIT) {
    stop(); message('The clock reached 60,000 ms. Scrub back or press Play to begin again.');
  } else raf = requestAnimationFrame(tick);
}
function start(): void {
  if (playing) return;
  if (timeMs >= LIMIT) timeMs = 0;
  playing = true; lastStamp = null; syncTransport();
  message('In motion. Pause to hold a moment, or scrub to another time.');
  raf = requestAnimationFrame(tick);
}
play.addEventListener('click', start);
pause.addEventListener('click', () => { stop(); message(`Paused at ${Math.round(timeMs).toLocaleString('en-US')} ms.`); });

function seek(value: string): void {
  const number = value.trim() === '' ? NaN : Number(value);
  if (!Number.isInteger(number) || number < 0 || number > LIMIT) {
    time.setAttribute('aria-invalid', 'true');
    message('Enter a whole number of milliseconds from 0 to 60,000.', true);
    return;
  }
  stop(); timeMs = number; time.removeAttribute('aria-invalid');
  syncTime(); draw(); message(`Paused at ${number.toLocaleString('en-US')} ms.`);
}
time.addEventListener('input', () => seek(time.value));
scrub.addEventListener('input', () => seek(scrub.value));
get<HTMLFormElement>('#seed-form').addEventListener('submit', event => {
  event.preventDefault();
  const next = seedInput.value.trim();
  if (!/^0x[0-9a-f]{64}$/i.test(next)) {
    seedInput.setAttribute('aria-invalid', 'true');
    message('Use 0x followed by exactly 64 hexadecimal digits (0–9, a–f). The current artwork is unchanged.', true);
    return;
  }
  seed = next.toLowerCase(); seedInput.value = seed; seedInput.removeAttribute('aria-invalid');
  draw(); message(`Preview seed applied at ${Math.round(timeMs).toLocaleString('en-US')} ms.`);
});

function inspect(x: number, y: number): void {
  window = { x: Math.max(0, Math.min(1950, Math.round(x))), y: Math.max(0, Math.min(1920, Math.round(y))), width: 50, height: 80 };
  coordinates.textContent = `x ${window.x} · y ${window.y}`;
  windowA.setAttribute('aria-pressed', String(window.x === 950 && window.y === 960));
  windowB.setAttribute('aria-pressed', String(window.x === 1000 && window.y === 960));
  renderFrame(detail, { seed, timeMs, viewport: window });
}
windowA.addEventListener('click', () => inspect(950, 960));
windowB.addEventListener('click', () => inspect(1000, 960));
canvas.addEventListener('click', event => {
  const rect = canvas.getBoundingClientRect();
  inspect((event.clientX - rect.left) / rect.width * 2000 - 25, (event.clientY - rect.top) / rect.height * 2000 - 40);
});
canvas.addEventListener('keydown', event => {
  const move: Record<string, [number, number]> = { ArrowLeft: [-50, 0], ArrowRight: [50, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] };
  if (event.key === ' ') { event.preventDefault(); playing ? stop() : start(); }
  if (move[event.key]) {
    event.preventDefault(); const [x, y] = move[event.key]; inspect(window.x + x, window.y + y);
  }
});
// Background tabs do not produce a surprise leap on returning to the artwork.
document.addEventListener('visibilitychange', () => { lastStamp = null; });

function resize(): void {
  const size = Math.min(1600, Math.max(1, Math.round(canvas.getBoundingClientRect().width * Math.min(devicePixelRatio || 1, 2))));
  if (canvas.width !== size || canvas.height !== size) { canvas.width = canvas.height = size; draw(); }
}
try {
  draw(); syncTime(); syncTransport();
  new ResizeObserver(resize).observe(canvas);
} catch (error) {
  stop(); message(error instanceof Error ? error.message : 'The artwork could not be rendered.', true);
}
