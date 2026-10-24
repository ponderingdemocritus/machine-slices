export const TAU = Math.PI * 2;
export const INK = '#203b40';
export const PAPER = '#efe9d9';
export const LIGHT = '#fbf4df';
export const MIST = '#c7d3c4';
export const TEAL = '#417c79';
export const COPPER = '#c45a37';
export const GOLD = '#dbab5b';
export const LINE = '#c5c2ae';
export type Pen = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function circle(c: Pen, x: number, y: number, r: number, fill: string, stroke?: string, width = 1) {
  c.beginPath(); c.arc(x, y, r, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
export function line(c: Pen, x: number, y: number, xx: number, yy: number, color: string, width = 1) {
  c.beginPath(); c.moveTo(x, y); c.lineTo(xx, yy); c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
export function arc(c: Pen, x: number, y: number, r: number, start: number, end: number, color: string, width = 1) {
  c.beginPath(); c.arc(x, y, r, start, end); c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
export function label(c: Pen, text: string, x: number, y: number, size = 13, color = INK) {
  c.fillStyle = color; c.font = `${size}px monospace`; c.fillText(text, x, y);
}
export function bolt(c: Pen, x: number, y: number, r = 6) {
  circle(c, x, y, r, PAPER, INK, 1.5); line(c, x - r * .45, y + r * .45, x + r * .45, y - r * .45, INK, 1.5);
}
export function ticks(c: Pen, x: number, y: number, radius: number, count: number, color = INK, offset = 0) {
  for (let i = 0; i < count; i++) {
    const a = i * TAU / count + offset, r = radius - (i % 5 === 0 ? 13 : 5);
    line(c, x + Math.cos(a) * r, y + Math.sin(a) * r,
      x + Math.cos(a) * radius, y + Math.sin(a) * radius, color, i % 5 === 0 ? 2 : 1);
  }
}
export function ringBolts(c: Pen, x: number, y: number, r: number, count: number, offset = 0) {
  for (let i = 0; i < count; i++) bolt(c, x + Math.cos(i * TAU / count + offset) * r, y + Math.sin(i * TAU / count + offset) * r);
}
export function capsule(c: Pen, x: number, y: number, w: number, h: number, fill: string, stroke = INK, lw = 2) {
  c.beginPath(); c.roundRect(x, y, w, h, Math.min(w, h) / 2);
  c.fillStyle = fill; c.fill(); c.strokeStyle = stroke; c.lineWidth = lw; c.stroke();
}
