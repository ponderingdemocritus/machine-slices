// The viewer: controls and wall-clock scheduling. It owns the only clock that runs by itself; the
// runtime only ever sees explicit inputs. Every redraw renders the whole world at the selected time.

import { BEAT_MS, CYCLE_MS, renderFrame, WORLD_SIZE } from "./runtime.js";

const DEFAULT_SEED = "0x" + "11".repeat(32);
const WHOLE = { x: 0, y: 0, width: WORLD_SIZE, height: WORLD_SIZE };
/** Largest backing store edge, in device pixels: sharp on most screens, still smooth to play. */
const MAX_PIXELS = 1440;

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`the page has no #${id}`);
  return el as T;
}

const ui = {
  canvas: byId<HTMLCanvasElement>("artwork"),
  play: byId<HTMLButtonElement>("play"),
  pause: byId<HTMLButtonElement>("pause"),
  time: byId<HTMLInputElement>("time"),
  readout: byId<HTMLOutputElement>("time-readout"),
  form: byId<HTMLFormElement>("seed-form"),
  seed: byId<HTMLInputElement>("seed"),
  random: byId<HTMLButtonElement>("random-seed"),
  status: byId<HTMLParagraphElement>("status"),
};

const state = {
  seed: DEFAULT_SEED,
  timeMs: 0,
  playing: false,
  /** Wall-clock instant and machine time when playback last (re)started. */
  anchorWall: 0,
  anchorTime: 0,
  frame: 0,
};

function say(message: string, error = false): void {
  ui.status.textContent = message;
  ui.status.classList.toggle("error", error);
}

function draw(): void {
  renderFrame(ui.canvas, { seed: state.seed, timeMs: state.timeMs, viewport: WHOLE });
  const ms = Math.round(state.timeMs);
  const beat = Math.floor((state.timeMs % CYCLE_MS) / BEAT_MS) + 1;
  const text = `${ms} ms · beat ${beat} of ${CYCLE_MS / BEAT_MS}`;
  ui.time.value = String(ms);
  ui.time.setAttribute("aria-valuetext", text);
  ui.readout.textContent = text;
}

/** Sizes the canvas backing store to its displayed size; true if it changed. */
function fitCanvas(): boolean {
  const box = ui.canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const size = Math.max(64, Math.min(MAX_PIXELS, Math.round(Math.min(box.width, box.height) * ratio)));
  if (ui.canvas.width === size && ui.canvas.height === size) return false;
  ui.canvas.width = size;
  ui.canvas.height = size;
  return true;
}

function tick(now: number): void {
  if (!state.playing) return;
  state.timeMs = (state.anchorTime + Math.max(0, now - state.anchorWall)) % CYCLE_MS;
  draw();
  state.frame = requestAnimationFrame(tick);
}

function play(): void {
  if (!state.playing) {
    state.playing = true;
    state.anchorWall = performance.now();
    state.anchorTime = state.timeMs;
    state.frame = requestAnimationFrame(tick);
  }
  ui.play.setAttribute("aria-pressed", "true");
  ui.pause.setAttribute("aria-pressed", "false");
}

function pause(): void {
  state.playing = false;
  cancelAnimationFrame(state.frame);
  ui.play.setAttribute("aria-pressed", "false");
  ui.pause.setAttribute("aria-pressed", "true");
}

/**
 * Jumps to a time and redraws at once; playback continues from there. The slider's own range is
 * 0–60 000 ms (both ends are the same moment of the machine); a step past either end wraps around.
 */
function seek(timeMs: number): void {
  state.timeMs = timeMs >= 0 && timeMs <= CYCLE_MS ? timeMs : ((timeMs % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
  state.anchorWall = performance.now();
  state.anchorTime = state.timeMs;
  draw();
}

function applySeed(text: string): void {
  const seed = text.trim();
  try {
    // The runtime validates before drawing: a refused seed leaves the current picture as it is.
    renderFrame(ui.canvas, { seed, timeMs: state.timeMs, viewport: WHOLE });
  } catch (error) {
    ui.seed.setAttribute("aria-invalid", "true");
    say(`Seed not applied: ${error instanceof Error ? error.message : String(error)}.`, true);
    return;
  }
  state.seed = seed;
  ui.seed.value = seed;
  ui.seed.removeAttribute("aria-invalid");
  say("Seed applied.");
}

function randomSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

ui.play.addEventListener("click", play);
ui.pause.addEventListener("click", pause);
ui.time.addEventListener("input", () => seek(Number(ui.time.value)));
ui.form.addEventListener("submit", (event) => {
  event.preventDefault();
  applySeed(ui.seed.value);
});
ui.random.addEventListener("click", () => applySeed(randomSeed()));
document.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement | null;
  if (event.altKey || event.ctrlKey || event.metaKey || target?.closest("input, button, textarea")) return;
  if (event.key === " ") {
    event.preventDefault();
    if (state.playing) pause();
    else play();
  } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    seek(state.timeMs + (event.key === "ArrowLeft" ? -BEAT_MS : BEAT_MS));
  }
});
new ResizeObserver(() => {
  if (fitCanvas()) draw();
}).observe(ui.canvas);

fitCanvas();
draw();
