import { renderFrame, validateFrame, WORLD_SIZE, type Viewport } from './runtime.js';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>('artwork');
const timeInput = element<HTMLInputElement>('time');
const scrubber = element<HTMLInputElement>('scrubber');
const seedInput = element<HTMLInputElement>('seed');
const status = element<HTMLParagraphElement>('status');
const play = element<HTMLButtonElement>('play');
const pause = element<HTMLButtonElement>('pause');
const whole: Viewport = { x: 0, y: 0, width: WORLD_SIZE, height: WORLD_SIZE };
const studies = [element<HTMLCanvasElement>('study-left'), element<HTMLCanvasElement>('study-right')];
const END = 60000;
let seed = '0x' + '11'.repeat(32);
let timeMs = 0;
let playing = false;
let frameRequest = 0;
let previousTimestamp: number | undefined;

function draw() {
  renderFrame(canvas, { seed, timeMs, viewport: whole });
  studies.forEach((c, i) => renderFrame(c, { seed, timeMs,
    viewport: { x: 950 + i * 50, y: 960, width: 50, height: 80 } }));
  timeInput.value = scrubber.value = String(Math.round(timeMs));
  element('elapsed').textContent = (timeMs / 1000).toFixed(3).padStart(6, '0');
}

function setPlaying(value: boolean) {
  playing = value;
  cancelAnimationFrame(frameRequest);
  previousTimestamp = undefined;
  play.setAttribute('aria-pressed', String(value));
  pause.setAttribute('aria-pressed', String(!value));
  element('transport-state').textContent = value ? 'In motion' : 'Paused';
  element('state-dot').classList.toggle('running', value);
  if (value) frameRequest = requestAnimationFrame(tick);
}

function tick(timestamp: number) {
  if (!playing) return;
  if (previousTimestamp !== undefined) timeMs = Math.min(END, timeMs + timestamp - previousTimestamp);
  previousTimestamp = timestamp;
  draw();
  if (timeMs >= END) setPlaying(false);
  else frameRequest = requestAnimationFrame(tick);
}

play.addEventListener('click', () => {
  if (timeMs >= END) { timeMs = 0; draw(); }
  setPlaying(true);
});
pause.addEventListener('click', () => setPlaying(false));
element('reset').addEventListener('click', () => { setPlaying(false); timeMs = 0; draw(); });

function seek(input: HTMLInputElement) {
  const next = input.valueAsNumber;
  if (!Number.isFinite(next) || next < 0 || next > END || !Number.isInteger(next)) {
    input.setAttribute('aria-invalid', 'true');
    status.textContent = 'Choose a whole millisecond from 0 to 60000.';
    return;
  }
  input.removeAttribute('aria-invalid');
  status.textContent = '';
  timeMs = next;
  previousTimestamp = undefined;
  draw();
}
timeInput.addEventListener('input', () => seek(timeInput));
scrubber.addEventListener('input', () => { timeInput.removeAttribute('aria-invalid'); seek(scrubber); });

element<HTMLFormElement>('seed-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const candidate = seedInput.value.trim();
    validateFrame({ seed: candidate, timeMs, viewport: whole });
    seed = candidate;
    seedInput.removeAttribute('aria-invalid');
    status.textContent = 'Preview seed applied.';
    draw();
  } catch (error) {
    seedInput.setAttribute('aria-invalid', 'true');
    status.textContent = error instanceof Error ? error.message : 'Could not apply this seed.';
  }
});

// Hidden tabs pause instead of jumping forward after a suspended animation callback.
// The artwork starts still, including for viewers who prefer reduced motion.
document.addEventListener('visibilitychange', () => { if (document.hidden) setPlaying(false); });
seedInput.value = seed;
setPlaying(false);
draw();
