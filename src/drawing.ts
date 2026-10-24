export type Ink = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export const TAU = Math.PI * 2;
export const P = {
  paper: '#e9e2cf', light: '#f7f0da', ink: '#1c3439', deep: '#11262c',
  muted: '#70817b', faint: '#c5c6b3', copper: '#bc4c30', orange: '#e16c3a',
  gold: '#d3a65a', teal: '#397c79', mint: '#91b7a3',
} as const;

export function line(c: Ink, x1: number, y1: number, x2: number, y2: number, color: string, width = 1): void {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
export function circle(c: Ink, x: number, y: number, r: number, fill: string, stroke?: string, width = 1): void {
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
export function ring(c: Ink, x: number, y: number, r: number, color: string, width = 1, start = 0, end = TAU): void {
  c.beginPath(); c.arc(x, y, r, start, end); c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
export function text(c: Ink, value: string, x: number, y: number, size = 12, color: string = P.ink): void {
  c.fillStyle = color; c.font = `${size}px monospace`; c.fillText(value, x, y);
}
export function bolt(c: Ink, x: number, y: number, r = 5): void {
  circle(c, x, y, r + 2, P.deep, P.muted);
  circle(c, x, y, r, P.paper, P.ink, 1.4);
  line(c, x - r * .55, y, x + r * .55, y, P.ink, 1.3);
}
export function ticks(c: Ink, r: number, count: number, color: string, length = 8): void {
  c.strokeStyle = color; c.lineWidth = 1.4; c.beginPath();
  for (let i = 0; i < count; i++) {
    const a = i / count * TAU;
    const inner = r - (i % 5 === 0 ? length * 1.8 : length);
    c.moveTo(inner * Math.cos(a), inner * Math.sin(a));
    c.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  c.stroke();
}
/** A rod's end points, and therefore its length, have explicit world coordinates. */
export function rod(c: Ink, ax: number, ay: number, bx: number, by: number, width = 13, color: string = P.paper): void {
  c.lineCap = 'round';
  line(c, ax, ay, bx, by, P.deep, width + 7);
  line(c, ax, ay, bx, by, color, width);
  line(c, ax, ay - 1, bx, by - 1, P.light, 1);
  bolt(c, ax, ay, 5); bolt(c, bx, by, 5);
}
export function tube(c: Ink, path: Path2D, accent: string = P.teal, width = 20): void {
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = P.deep; c.lineWidth = width + 9; c.stroke(path);
  c.strokeStyle = P.paper; c.lineWidth = width + 3; c.stroke(path);
  c.strokeStyle = accent; c.lineWidth = width; c.stroke(path);
}
/** Offset pulses along a shared path without integrating or retaining simulation state. */
export function flow(c: Ink, path: Path2D, phase: number, color: string = P.light): void {
  c.save(); c.setLineDash([2, 42]); c.lineDashOffset = -phase * 25;
  c.strokeStyle = color; c.lineWidth = 3; c.lineCap = 'round'; c.stroke(path); c.restore();
}
