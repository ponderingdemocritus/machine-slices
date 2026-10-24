import type { Machine, Point } from './machine.js';
const TAU = Math.PI * 2;

/** All geometry and gradients live in world coordinates, including the fine engraving. */
export function drawMachine(c: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, m: Machine, time: number): void {
  const [ink, dark, steel, edge, brass, ivory, rust, signal] = m.palette;
  const beat = time / 2000 * TAU;
  const pulse = (delay = 0) => (1 + Math.cos(beat - delay / 2000 * TAU)) / 2;
  c.lineCap = 'round'; c.lineJoin = 'round';
  function line(points: Point[], color: string, width = 1) {
    c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.strokeStyle = color; c.lineWidth = width; c.stroke();
  }
  function circle(x: number, y: number, r: number, fill: string, stroke = '', w = 1) {
    c.beginPath(); c.arc(x, y, r, 0, TAU);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = w; c.stroke(); }
  }
  function arc(r: number, a: number, b: number, color: string, w = 1) {
    c.beginPath(); c.arc(0, 0, r, a, b); c.strokeStyle = color; c.lineWidth = w; c.stroke();
  }
  function bolt(x: number, y: number, r = 3) {
    circle(x, y, r + 1.5, ink, edge); circle(x, y, r, brass);
    line([[x - r * 0.55, y + r * 0.3], [x + r * 0.55, y - r * 0.3]], ink, 1);
  }
  function ring(r: number, count: number, color: string) {
    for (let i = 0; i < count; i++) {
      const a = i * TAU / count;
      line([[Math.cos(a) * r, Math.sin(a) * r], [Math.cos(a) * (r + (i % 5 ? 5 : 10)), Math.sin(a) * (r + (i % 5 ? 5 : 10))]], color, 1);
    }
  }
  function gear(x: number, y: number, radius: number, teeth: number, rotation: number) {
    c.save(); c.translate(x, y); c.rotate(rotation);
    c.beginPath();
    for (let j = 0; j < teeth * 4; j++) {
      const a = j / (teeth * 4) * TAU;
      const r = radius + (j % 4 === 1 || j % 4 === 2 ? 4 : -4);
      if (!j) c.moveTo(Math.cos(a) * r, Math.sin(a) * r); else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath(); c.fillStyle = brass; c.fill(); c.lineWidth = 1.5; c.strokeStyle = ivory; c.stroke();
    circle(0, 0, radius - 13, dark, ink, 4);
    circle(0, 0, radius - 19, '', edge);
    // Cut marks on the rim and oil grooves keep small windows articulated.
    for (let j = 0; j < teeth; j++) {
      c.save(); c.rotate(j * TAU / teeth);
      line([[radius - 11, -1], [radius - 5, -1]], ink, 0.8);
      c.restore();
    }
    for (let i = 0; i < 6; i++) {
      c.save(); c.rotate(i * TAU / 6);
      line([[12, 0], [radius - 22, 0]], brass, 9);
      line([[15, -2], [radius - 23, -2]], ivory, 1);
      for (let j = 22; j < radius - 30; j += 5) line([[j, 0], [j + 3, 3]], ink, 0.65);
      bolt(radius - 26, 0, 2.5); c.restore();
    }
    circle(0, 0, 17, steel, brass, 3); circle(0, 0, 12, '', edge, 0.8);
    for (let j = 0; j < 6; j++) circle(Math.cos(j * TAU / 6) * 12, Math.sin(j * TAU / 6) * 12, 1, ink);
    circle(0, 0, 7, ink, ivory);
    line([[-4, 0], [4, 0]], signal, 2);
    c.restore();
  }
  // Quiet drafting marks remain legible in the spaces between organs.
  c.strokeStyle = dark; c.lineWidth = 0.6;
  c.beginPath();
  for (let n = 40; n < 2000; n += 40) {
    c.moveTo(n, 0); c.lineTo(n, 2000); c.moveTo(0, n); c.lineTo(2000, n);
  }
  c.stroke();
  c.beginPath();
  for (let y = 40; y < 2000; y += 80) for (let x = 40; x < 2000; x += 80) {
    c.moveTo(x - 2, y); c.lineTo(x + 2, y); c.moveTo(x, y - 2); c.lineTo(x, y + 2);
  }
  c.strokeStyle = steel; c.lineWidth = 0.7; c.stroke();
  // A continuous curved carapace holds the anatomy together.
  c.save(); c.translate(1000, 1000); c.rotate(-0.22);
  c.beginPath(); c.moveTo(-120, -790);
  c.bezierCurveTo(230, -800, 590, -430, 590, -20);
  c.bezierCurveTo(610, 390, 260, 790, -70, 740);
  c.bezierCurveTo(-390, 720, -610, 300, -570, -80);
  c.bezierCurveTo(-540, -480, -350, -740, -120, -790);
  c.closePath(); c.fillStyle = dark; c.fill(); c.strokeStyle = steel; c.lineWidth = 3; c.stroke();
  c.scale(0.94, 0.96); c.strokeStyle = brass; c.lineWidth = 1; c.stroke();
  c.restore();
  // Curved ribs and return capillaries describe a single load-bearing body.
  c.save(); c.translate(1000, 1000); c.rotate(-0.22);
  for (let i = 0; i < 13; i++) {
    const y = -630 + i * 102;
    const spread = 470 * Math.sqrt(Math.max(0, 1 - (y / 790) ** 2));
    c.beginPath(); c.moveTo(-spread, y);
    c.bezierCurveTo(-spread * 0.8, y - 80, -110, y - 60, -55, y - 20);
    c.moveTo(55, y - 20); c.bezierCurveTo(160, y - 65, spread * 0.8, y - 60, spread, y);
    c.strokeStyle = ink; c.lineWidth = 13; c.stroke();
    c.strokeStyle = steel; c.lineWidth = 7; c.stroke();
    c.strokeStyle = brass; c.lineWidth = 0.8; c.stroke();
    for (const sign of [-1, 1]) bolt(sign * spread, y, 3);
  }
  for (const sign of [-1, 1]) {
    c.beginPath(); c.moveTo(sign * 90, -730);
    c.bezierCurveTo(sign * 380, -400, sign * 355, 420, sign * 75, 670);
    c.strokeStyle = ink; c.lineWidth = 20; c.stroke();
    c.strokeStyle = edge; c.lineWidth = 11; c.stroke();
    c.strokeStyle = brass; c.lineWidth = 2; c.stroke();
  }
  c.restore();
  c.save(); c.translate(1000, 1000); c.rotate(-0.22);
  for (let i = 0; i < 12; i++) {
    const y = -650 + i * 112;
    c.beginPath(); c.moveTo(-52, y); c.lineTo(46, y - 16);
    c.lineTo(60, y + 57); c.lineTo(-40, y + 72); c.closePath();
    c.fillStyle = i % 3 ? steel : dark; c.fill();
    c.strokeStyle = edge; c.lineWidth = 1; c.stroke();
    for (let j = 0; j < 4; j++) line([[-27 + j * 17, y + 13], [-18 + j * 17, y + 43]], ink, 2);
    bolt(-39, y + 6); bolt(45, y + 54);
  }
  c.restore();
  // Radial load rails tie the organ housings directly into the heart casting.
  for (const o of m.organs) {
    const dx = o.x - 1000, dy = o.y - 1000, length = Math.hypot(dx, dy);
    const ux = dx / length, uy = dy / length;
    for (const side of [-1, 1]) {
      const rail: Point[] = [[1000 + ux * 220 - uy * side * 45, 1000 + uy * 220 + ux * side * 45],
        [o.x - uy * side * 45, o.y + ux * side * 45]];
      line(rail, ink, 17); line(rail, steel, 10); line(rail, brass, 1);
    }
    for (let d = 275; d < length - o.size; d += 65) {
      const x = 1000 + ux * d, y = 1000 + uy * d;
      line([[x - uy * 45, y + ux * 45], [x + ux * 26 + uy * 45, y + uy * 26 - ux * 45]], edge, 3);
    }
  }
  function artery(points: Point[], offset = 0) {
    const tendon: Point[] = points.map(([x, y], j) => [x + 28 * Math.sin(j / (points.length - 1) * Math.PI), y - 28 * Math.sin(j / (points.length - 1) * Math.PI)]);
    line(tendon, ink, 9); line(tendon, edge, 3); line(tendon, brass, 1);
    line(points, ink, 35); line(points, brass, 27); line(points, dark, 22); line(points, steel, 12); line(points, ink, 5);
    let distance = offset;
    for (let j = 1; j < points.length; j++) {
      const [x, y] = points[j], [px, py] = points[j - 1];
      const segment = Math.hypot(x - px, y - py);
      distance += segment;
      if (j % 4 === 0) {
        const dx = (y - py) / segment, dy = -(x - px) / segment;
        line([[x - dx * 16, y - dy * 16], [x + dx * 16, y + dy * 16]], ink, 5);
        line([[x - dx * 16, y - dy * 16], [x + dx * 16, y + dy * 16]], edge, 2);
      }
      // Constant 0.6 world units / ms; path length sets organ response delay.
      const age = ((time - distance / 0.6) % 2000 + 2000) % 2000;
      if (age < 230) line([[px, py], [x, y]], age < 100 ? ivory : signal, 4);
    }
  }
  // Outward arteries continue the arrival clock through to the perimeter bearings.
  const terminals = [[90, 90, 0], [580, 35, 0], [1120, 35, 5], [1910, 90, 1],
    [1965, 580, 1], [1965, 1120, 2], [1910, 1910, 3], [1450, 1965, 3],
    [680, 1965, 4], [90, 1910, 4], [35, 1200, 4], [35, 580, 0]];
  terminals.forEach(([x, y, index], i) => {
    const o = m.organs[index], dx = x - o.x, dy = y - o.y;
    const length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length;
    const bend = (i % 2 ? -1 : 1) * 95;
    const points: Point[] = [];
    for (let j = 0; j <= 24; j++) {
      const t = j / 24;
      points.push([o.x + dx * t + nx * Math.sin(t * Math.PI) * bend,
        o.y + dy * t + ny * Math.sin(t * Math.PI) * bend]);
    }
    const delay = m.conduits[index].length;
    artery(points, delay);
    // A second tie and transverse lugs turn each branch into a structural limb.
    const tie: Point[] = points.map(([px, py]) => [px + nx * 54, py + ny * 54]);
    line(tie, ink, 11); line(tie, steel, 6); line(tie, brass, 1);
    let travelled = delay;
    points.forEach((p, j) => {
      if (j) travelled += Math.hypot(p[0] - points[j - 1][0], p[1] - points[j - 1][1]);
      if (j && j % 4 === 0) {
        line([p, tie[j]], ink, 10); line([p, tie[j]], edge, 5);
        bolt(tie[j][0], tie[j][1], 2.5);
      }
    });
    c.save(); c.translate(x, y); c.rotate(Math.atan2(dy, dx));
    // Long bearing shoes enter the edge; corner shoes reach both adjoining edges.
    c.fillStyle = dark; c.fillRect(-56, -65, 112, 130);
    for (const sy of [-52, 52]) {
      line([[-66, sy], [66, sy]], steel, 15);
      line([[-66, sy - 4], [66, sy - 4]], brass, 1);
      bolt(-44, sy); bolt(44, sy);
    }
    circle(0, 0, 43, ink, brass, 2); circle(0, 0, 34, steel, edge);
    c.save(); c.rotate((beat - travelled / 0.6 / 2000 * TAU) / 3);
    for (let spoke = 0; spoke < 3; spoke++) {
      c.rotate(TAU / 3); line([[9, 0], [30, 0]], brass, 5);
    }
    c.restore(); circle(0, 0, 10, dark, ivory);
    circle(0, 0, 4, pulse(travelled / 0.6) > 0.8 ? signal : rust);
    c.restore();
    if (i % 3 === 0) {
      const sx = x < 1000 ? -1 : 1, sy = y < 1000 ? -1 : 1;
      line([[x, y], [x + sx * 90, y], [x + sx * 90, y + sy * 90], [x, y + sy * 90], [x, y]], steel, 15);
      line([[x, y], [x + sx * 90, y], [x + sx * 90, y + sy * 90], [x, y + sy * 90]], brass, 1);
    }
  });
  // Thin tendons run alongside the main signal arteries.
  for (const [i, conduit] of m.conduits.entries()) {
    artery(conduit.points);
    const mid = conduit.points[24];
    circle(mid[0], mid[1], 21, ink, brass, 2);
    circle(mid[0], mid[1], 13, steel, edge);
    const a = beat / 2 + i;
    line([[mid[0] - Math.cos(a) * 11, mid[1] - Math.sin(a) * 11], [mid[0] + Math.cos(a) * 11, mid[1] + Math.sin(a) * 11]], ivory, 3);
  }
  m.organs.forEach((o, index) => {
    const delay = m.conduits[index].length / 0.6;
    const breath = pulse(delay);
    c.save(); c.translate(o.x, o.y); c.rotate(o.angle);
    const r = o.size;
    for (let lug = 0; lug < 4; lug++) {
      c.save(); c.rotate(Math.PI / 4 + lug * TAU / 4);
      line([[r - 12, 0], [r + 50, 0]], ink, 26);
      line([[r - 12, 0], [r + 50, 0]], steel, 18);
      line([[r - 8, -5], [r + 46, -5]], brass, 1);
      bolt(r + 38, 0, 4); c.restore();
    }
    // Mounting flange, with engraved calibrations and alternating screws.
    circle(0, 0, r + 24, ink, steel, 2); circle(0, 0, r + 14, dark, brass, 2);
    ring(r + 16, 60, edge);
    for (let i = 0; i < 10; i++) bolt(Math.cos(i * TAU / 10) * (r + 6), Math.sin(i * TAU / 10) * (r + 6));
    if (o.kind === 0) {
      circle(0, 0, r - 7, ink, edge);
      // Equal circular pitch: 36 and 24 teeth, pitch radii 90 and 60.
      const k = r / 156;
      c.save(); c.scale(k, k);
      gear(-48, 0, 90, 36, -time / 10000 * TAU);
      gear(102, 0, 60, 24, time / 20000 * 3 * TAU + Math.PI / 24);
      circle(-48, 0, 38 + breath * 5, '', rust, 3);
      c.restore();
    } else if (o.kind === 1) {
      // Corrugated bellows: the same delayed stroke moves both endplates.
      c.fillStyle = ink; c.fillRect(-r + 24, -r + 35, r * 2 - 48, r * 2 - 70);
      for (const x of [-r + 30, r - 30]) {
        line([[x, -r + 25], [x, r - 25]], edge, 9);
        line([[x - 2, -r + 25], [x - 2, r - 25]], ivory, 1);
      }
      const top = -r * 0.55 + breath * 25, bottom = r * 0.55;
      for (let j = 0; j < 12; j++) {
        const y = top + (bottom - top) * j / 11;
        line([[-r * 0.63, y], [-r * 0.48, y + 5], [r * 0.48, y + 5], [r * 0.63, y]], j % 2 ? brass : edge, 5);
        line([[-r * 0.46, y + 3], [r * 0.46, y + 3]], ivory, 0.8);
      }
      for (const y of [top - 12, bottom + 17]) {
        line([[-r * 0.75, y], [r * 0.75, y]], steel, 16);
        line([[-r * 0.75, y - 5], [r * 0.75, y - 5]], brass, 2);
        bolt(-r * 0.67, y); bolt(r * 0.67, y);
      }
      line([[0, -r], [0, top - 20]], brass, 12);
      circle(0, -r + 5, 13, signal, ink, 3);
    } else {
      // Reciprocating piston and crank, phase-locked to the arriving pulse.
      c.fillStyle = ink; c.fillRect(-r * 0.58, -r * 0.8, r * 1.16, r * 1.1);
      for (let j = 0; j < 8; j++) {
        const y = -r * 0.8 + j * 15;
        line([[-r * 0.68, y], [r * 0.68, y]], steel, 6);
        line([[-r * 0.68, y - 2], [r * 0.68, y - 2]], brass, 1);
      }
      const y = -r * 0.5 + breath * 38;
      line([[0, y], [0, r * 0.62]], brass, 15); line([[-4, y], [-4, r * 0.62]], ivory, 2);
      line([[-r * 0.45, y], [r * 0.45, y]], edge, 24);
      line([[-r * 0.45, y - 7], [r * 0.45, y - 7]], ivory, 2);
      const phase = beat - delay / 2000 * TAU;
      gear(0, r * 0.58, r * 0.38, 24, phase);
      const pin: Point = [Math.sin(phase) * r * 0.16, r * 0.58 + Math.cos(phase) * r * 0.16];
      line([[0, y + 9], pin], ink, 11);
      line([[0, y + 9], pin], edge, 7);
      line([[-2, y + 9], [pin[0] - 2, pin[1]]], ivory, 1);
      bolt(pin[0], pin[1], 4);
    }
    c.restore();
  });
  // The heart: a heavy annular housing around two counter-rotating drives.
  c.save(); c.translate(1000, 1000);
  circle(0, 0, 246, ink, brass, 3);
  circle(0, 0, 235, dark, edge, 2);
  ring(224, 120, brass);
  for (let i = 0; i < 16; i++) {
    const a = i * TAU / 16;
    bolt(Math.cos(a) * 237, Math.sin(a) * 237, 4);
    c.save(); c.rotate(a);
    arc(208, 0.035, TAU / 16 - 0.035, i % 4 ? steel : rust, 12);
    arc(208, 0.04, TAU / 16 - 0.04, brass, 1);
    c.restore();
  }
  circle(0, 0, 190, ink, brass, 2);
  // Radial vanes breathe behind the drive train.
  for (let i = 0; i < 24; i++) {
    c.save(); c.rotate(i * TAU / 24 + Math.sin(beat) * 0.025);
    c.beginPath(); c.moveTo(122, -9); c.lineTo(178 + pulse() * 5, -4); c.lineTo(170, 10); c.lineTo(124, 14); c.closePath();
    c.fillStyle = i % 3 ? steel : rust; c.fill();
    line([[132, -5], [173, 0]], brass, 1);
    c.restore();
  }
  circle(0, 0, 120, dark, edge, 2);
  // Pitch radii 60 + 40 = 100; 30:20 teeth follow the same ratio.
  gear(-40, 0, 60, 30, time / 6000 * TAU);
  gear(60, 0, 40, 20, -time / 4000 * TAU + Math.PI / 20);
  // Small oilways, cross-boundary bus and fasteners enrich the central slices.
  for (const y of [-31, 31]) {
    line([[-103, y], [-77, y], [-65, y * 2], [90, y * 2], [105, y]], ink, 9);
    line([[-103, y], [-77, y], [-65, y * 2], [90, y * 2], [105, y]], brass, 4);
    line([[-103, y - 1], [-77, y - 1], [-65, y * 2 - 1], [90, y * 2 - 1]], ivory, 0.8);
    for (let x = -60; x <= 80; x += 20) bolt(x, y * 2, 2);
  }
  for (let i = 0; i < 3; i++) {
    const x = -14 + i * 11;
    circle(x, -85, 3.5, pulse(i * 90) > 0.6 ? signal : steel, brass);
  }
  // A rotating pointer makes the larger heartbeat readable even at thumbnail scale.
  c.save(); c.rotate(beat / 6);
  arc(155, 0, 0.68, signal, 5); arc(155, Math.PI, Math.PI + 0.68, brass, 5);
  c.restore();
  c.restore();
}
