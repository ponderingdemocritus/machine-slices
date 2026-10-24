import { randomSource } from './seed.js';
import { type Ink, P, TAU, line, circle, ring, text, bolt, ticks, rod, tube, flow } from './drawing.js';

interface Wheel { x: number; y: number; r: number; teeth: number; angle: number; accent: string }

function background(c: Ink, random: () => number): void {
  c.fillStyle = P.paper; c.fillRect(0, 0, 2000, 2000);
  // Fixed world-space flecks: no screen-space noise, so a crop retains the paper's grain.
  c.fillStyle = '#9a9c8833';
  for (let i = 0; i < 2200; i++) {
    const x = random() * 2000, y = random() * 2000;
    c.fillRect(x, y, .8 + random(), .8 + random());
  }
  c.strokeStyle = '#81958b22'; c.lineWidth = 1; c.beginPath();
  for (let v = 80; v < 2000; v += 80) {
    c.moveTo(v, 60); c.lineTo(v, 1940); c.moveTo(60, v); c.lineTo(1940, v);
  }
  c.stroke();
  c.strokeStyle = '#81958b55'; c.strokeRect(60, 60, 1880, 1880);
  for (const [x, y] of [[60, 60], [1940, 60], [60, 1940], [1940, 1940]]) {
    line(c, x - 14, y, x + 14, y, P.ink); line(c, x, y - 14, x, y + 14, P.ink);
  }
  text(c, 'ISOBAR / 001', 100, 113, 21);
  text(c, 'A STUDY IN SHARED PRESSURE', 100, 140, 10, P.muted);
  text(c, '2000 : 2000', 1750, 113, 13, P.muted);
  text(c, 'ONE CONTINUOUS BODY', 100, 1898, 12, P.muted);
  text(c, 'MACHINE SLICES', 1750, 1898, 12, P.muted);
  // Drafting arcs form the organism's habitat without filling every quiet space.
  ring(c, 1000, 1030, 805, '#8c9c8d66');
  ring(c, 1000, 1030, 820, '#8c9c8d33', 1, -.5, 3.8);
  line(c, 1000, 170, 1000, 1840, '#8c9c8d44');
  line(c, 170, 1030, 1830, 1030, '#8c9c8d44');
  for (let i = 0; i < 100; i++) {
    const a = i / 100 * TAU;
    line(c, 1000 + Math.cos(a) * 814, 1030 + Math.sin(a) * 814,
      1000 + Math.cos(a) * (i % 5 === 0 ? 831 : 820), 1030 + Math.sin(a) * (i % 5 === 0 ? 831 : 820), P.muted, 1);
  }
}

function chassis(c: Ink): void {
  // A single asymmetric casting joins the breathing chamber to its four organs.
  const body = new Path2D('M 1000 307 C 1110 307 1170 473 1218 566 C 1324 754 1478 824 1435 1090 C 1394 1337 1198 1371 1124 1572 C 1082 1681 966 1764 861 1697 C 752 1628 805 1492 688 1397 C 508 1250 590 1114 625 959 C 656 819 586 628 716 508 C 786 446 878 488 913 379 C 930 328 966 307 1000 307 Z');
  c.fillStyle = P.ink; c.fill(body); c.strokeStyle = P.deep; c.lineWidth = 13; c.stroke(body);
  c.save(); c.clip(body);
  c.strokeStyle = '#93a99a22'; c.lineWidth = 1;
  for (let y = 330; y < 1730; y += 12) {
    c.beginPath(); c.moveTo(565, y); c.lineTo(1450, y - 180); c.stroke();
  }
  c.restore();
  const spine = new Path2D('M 1000 366 C 1046 505 1110 541 1144 670 C 1196 864 1320 937 1272 1129 C 1232 1302 1072 1372 1036 1559 C 1024 1621 976 1674 936 1668');
  c.strokeStyle = P.muted; c.lineWidth = 2; c.stroke(spine);
  for (const [x, y] of [[997, 350], [741, 542], [658, 956], [664, 1258], [862, 1605], [1006, 1661], [1190, 1298], [1382, 1060], [1195, 667]]) bolt(c, x, y, 6);
}

function conduits(c: Ink, phase: number, warm: string): void {
  const paths = [
    new Path2D('M 790 950 C 443 958 338 781 365 600 C 389 440 625 358 803 520 C 873 584 831 742 934 760'),
    new Path2D('M 1110 835 C 1210 638 1439 569 1602 705 C 1770 845 1653 1081 1412 1076 L 1229 1076'),
    new Path2D('M 1109 1258 C 1278 1300 1443 1329 1401 1531 C 1364 1711 1074 1804 1000 1570'),
    new Path2D('M 842 1194 C 770 1331 486 1270 404 1400 C 290 1584 572 1747 751 1586 C 811 1533 760 1422 892 1388'),
  ];
  paths.forEach((path, i) => { tube(c, path, i % 2 ? warm : P.teal, 17); flow(c, path, phase * (i % 2 ? -1 : 1) + i); });
  // Secondary return channels make crossings read as physical layers.
  const returns = [
    new Path2D('M 672 640 C 470 699 458 1122 684 1190'),
    new Path2D('M 1310 830 C 1540 911 1532 1210 1335 1392'),
    new Path2D('M 895 1430 C 893 1650 751 1810 622 1780'),
  ];
  returns.forEach(path => { tube(c, path, P.gold, 6); flow(c, path, -phase, P.ink); });
}

function flywheel(c: Ink, w: Wheel): void {
  const { x, y, r, teeth, angle, accent } = w;
  c.save(); c.translate(x, y);
  circle(c, 0, 0, r + 18, P.paper, P.ink, 2);
  ring(c, 0, 0, r + 13, P.muted, 1.5); ticks(c, r + 12, 60, P.muted, 4);
  c.save(); c.rotate(angle);
  c.beginPath();
  for (let j = 0; j < teeth * 4; j++) {
    const a = j / (teeth * 4) * TAU;
    const rad = j % 4 === 1 || j % 4 === 2 ? r : r - 8;
    const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
    if (j === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath(); c.fillStyle = P.ink; c.fill();
  circle(c, 0, 0, r - 18, accent, P.deep, 2);
  ring(c, 0, 0, r - 25, P.paper, 1.5);
  // Cut-out petal spokes echo the chamber's radiating ribs.
  for (let j = 0; j < 6; j++) {
    c.save(); c.rotate(j * TAU / 6);
    const spoke = new Path2D();
    spoke.moveTo(26, -9); spoke.bezierCurveTo(r * .56, -27, r * .74, -31, r * .79, -9);
    spoke.bezierCurveTo(r * .85, 19, r * .53, 24, 26, 9); spoke.closePath();
    c.fillStyle = P.deep; c.fill(spoke); c.strokeStyle = P.paper; c.lineWidth = 1; c.stroke(spoke);
    bolt(c, r - 32, 0, 4); c.restore();
  }
  circle(c, 0, 0, 28, P.paper, P.ink, 4); ring(c, 0, 0, 20, P.muted);
  circle(c, 0, 0, 9, P.deep); line(c, 0, 0, 20, 0, P.copper, 3);
  c.restore();
  for (let j = 0; j < 3; j++) {
    const a = j * TAU / 3 + .5; bolt(c, Math.cos(a) * (r + 16), Math.sin(a) * (r + 16), 4);
  }
  c.restore();
}

function bellows(c: Ink, phase: number, warm: string): void {
  c.save(); c.translate(1000, 985);
  const breath = Math.sin(phase), expansion = 1 + breath * .055;
  // A dark pressure vessel, with a copper elliptical diaphragm suspended inside it.
  c.beginPath(); c.ellipse(0, 0, 278, 361, -.16, 0, TAU);
  c.fillStyle = P.deep; c.fill(); c.strokeStyle = P.paper; c.lineWidth = 9; c.stroke();
  c.beginPath(); c.ellipse(0, 0, 265, 348, -.16, 0, TAU); c.strokeStyle = P.muted; c.lineWidth = 1; c.stroke();
  c.save(); c.rotate(-.16); c.scale(expansion, 1);
  const core = new Path2D();
  core.ellipse(0, 0, 232, 317, 0, 0, TAU);
  c.fillStyle = warm; c.fill(core);
  c.save(); c.clip(core);
  // Curved contour plates open and close about a common pressure axis.
  for (let i = -18; i <= 18; i++) {
    const y = i * 17 + breath * 3;
    c.beginPath(); c.moveTo(-260, y - 28);
    c.bezierCurveTo(-124, y + 65 + breath * 13, 110, y - 63 - breath * 13, 260, y + 27);
    c.strokeStyle = i % 3 === 0 ? P.deep : P.paper; c.lineWidth = i % 3 === 0 ? 6 : 1.8; c.stroke();
  }
  // An aperture off the axis gives the two prescribed central windows distinct detail.
  circle(c, 26, -5, 108, P.deep, P.light, 3);
  ring(c, 26, -5, 98, P.copper, 2);
  c.save(); c.translate(26, -5); c.rotate(phase * 2);
  for (let i = 0; i < 9; i++) {
    c.save(); c.rotate(i / 9 * TAU);
    const blade = new Path2D('M 18 -5 C 42 -66 89 -77 92 -28 L 55 5 C 40 20 25 12 18 -5 Z');
    c.fillStyle = i % 3 === 0 ? P.gold : P.paper; c.fill(blade); c.strokeStyle = P.deep; c.lineWidth = 2; c.stroke(blade);
    c.save(); c.clip(blade);
    for (let j = 0; j < 11; j++) {
      c.beginPath(); c.moveTo(28 + j * 4, 15);
      c.bezierCurveTo(35 + j * 5, -6, 37 + j * 5, -29, 53 + j * 5, -58);
      c.strokeStyle = i % 3 === 0 ? '#735f36' : '#82988a'; c.lineWidth = .65; c.stroke();
    }
    ring(c, 0, 0, 72, P.copper, .8);
    c.restore();
    circle(c, 66, -22, 3.5, P.deep, P.gold, 1);
    circle(c, 46, -9, 2, P.copper);
    c.restore();
  }
  ring(c, 0, 0, 32, P.gold, 1); ticks(c, 30, 48, P.paper, 3);
  circle(c, 0, 0, 24, P.copper, P.light, 2);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU;
    circle(c, Math.cos(a) * 17, Math.sin(a) * 17, 2.3, P.deep, P.gold, .6);
  }
  bolt(c, 0, 0, 7);
  c.restore(); c.restore();
  c.restore();
  // External ribs sit above the diaphragm, with moving clevises at their ends.
  for (let i = 0; i < 13; i++) {
    const a = (i / 12) * Math.PI + Math.PI;
    const x = Math.cos(a) * 262 * expansion, y = Math.sin(a) * 340;
    const ox = Math.cos(a) * (294 + breath * 8), oy = Math.sin(a) * 372;
    rod(c, x, y, ox, oy, 5, P.gold);
  }
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU;
    const x = Math.cos(a) * 282, y = Math.sin(a) * 363;
    bolt(c, x * Math.cos(-.16) - y * Math.sin(-.16), x * Math.sin(-.16) + y * Math.cos(-.16), 5);
  }
  c.restore();
}

function slider(c: Ink, x: number, y: number, phase: number, angle: number, warm: string): void {
  c.save(); c.translate(x, y); c.rotate(angle);
  const crank = 33, length = 154;
  const pinX = Math.cos(phase) * crank, pinY = Math.sin(phase) * crank;
  // Slider-crank geometry: the connecting rod keeps its exact length.
  const slide = pinX + Math.sqrt(length * length - pinY * pinY);
  c.fillStyle = P.deep; c.fillRect(98, -44, 177, 88);
  c.strokeStyle = P.paper; c.lineWidth = 3; c.strokeRect(98, -44, 177, 88);
  for (let i = 0; i < 12; i++) line(c, 106 + i * 14, -44, 106 + i * 14, 44, P.muted, 2);
  c.fillStyle = warm; c.fillRect(slide - 17, -35, 33, 70);
  c.strokeStyle = P.light; c.lineWidth = 2; c.strokeRect(slide - 17, -35, 33, 70);
  line(c, 94, -52, 284, -52, P.ink, 4); line(c, 94, 52, 284, 52, P.ink, 4);
  rod(c, pinX, pinY, slide, 0, 9); bolt(c, slide, 0, 7);
  c.restore();
}

function instrument(c: Ink, x: number, y: number, phase: number, label: string, r = 66): void {
  c.save(); c.translate(x, y);
  circle(c, 0, 0, r + 7, P.ink, P.paper, 2);
  circle(c, 0, 0, r, P.paper, P.deep, 2);
  ticks(c, r - 7, 40, P.ink, 5);
  ring(c, 0, 0, r - 17, P.copper, 3, Math.PI * 1.2, Math.PI * 1.85);
  const a = -Math.PI * .6 + Math.sin(phase) * .75;
  line(c, 0, 0, Math.cos(a) * (r - 17), Math.sin(a) * (r - 17), P.copper, 3);
  circle(c, 0, 0, 5, P.ink);
  text(c, label, -r * .46, r * .49, 10);
  bolt(c, -r - 3, 0, 3); bolt(c, r + 3, 0, 3); c.restore();
}

function annotations(c: Ink, variation: number): void {
  const notes: [number, number, number, number, string, string][] = [
    [288, 337, 529, 514, '01 / INTAKE', 'LOW PRESSURE'],
    [1454, 388, 1460, 649, '02 / EXCHANGE', 'RECIPROCATING'],
    [1543, 1377, 1292, 1227, '03 / DIAPHRAGM', 'COMMON PHASE'],
    [209, 1746, 529, 1585, '04 / RETURN', 'CLOSED CIRCUIT'],
  ];
  for (const [x, y, tx, ty, title, subtitle] of notes) {
    text(c, title, x, y, 13); text(c, subtitle, x, y + 20, 9, P.muted);
    const p = new Path2D(); p.moveTo(x, y + 33); p.lineTo(x + 124, y + 33); p.lineTo(tx, ty);
    c.strokeStyle = P.muted; c.lineWidth = 1; c.stroke(p); circle(c, tx, ty, 3, P.copper);
  }
  // Small inspection stamps and hatch marks survive magnification.
  for (const [x, y, width] of [[713, 1446, 72], [1169, 576, 55], [1043, 1589, 61]]) {
    c.fillStyle = P.paper; c.fillRect(x, y, width, 24);
    text(c, `P.${String(Math.floor(variation * 900 + x)).slice(-3)}`, x + 6, y + 16, 10);
    for (let i = 0; i < 7; i++) line(c, x + i * 5, y + 32, x + 4 + i * 5, y + 38, P.muted);
  }
}

/** Paint one absolute-time scene. Every part shares this phase; nothing accumulates. */
export function drawMachine(c: Ink, seed: string, timeMs: number): void {
  const random = randomSource(seed);
  const variation = random(), offset = random() * TAU;
  // Integer drive ratios all return together after 120 seconds; modulo bounds huge valid times.
  const drive = (timeMs % 120000) / 12000 * TAU;
  const phase = drive + offset;
  const warm = variation > .65 ? P.copper : variation > .3 ? P.orange : P.gold;
  const leftX = 610 + (random() - .5) * 50;
  const rightY = 759 + (random() - .5) * 40;
  background(c, random); chassis(c); conduits(c, phase, warm);
  // Belt lines and bearings behind the moving arms.
  const belt = new Path2D(`M ${leftX - 68} 599 C 675 657 746 667 855 717 M ${leftX + 58} 509 C 798 552 892 595 939 663`);
  tube(c, belt, P.deep, 7); flow(c, belt, phase * 2, P.gold);
  const lowerBelt = new Path2D('M 520 1445 L 933 1516 M 553 1574 L 967 1639');
  tube(c, lowerBelt, P.deep, 6); flow(c, lowerBelt, phase, P.paper);
  flywheel(c, { x: leftX, y: 565, r: 133, teeth: 40, angle: phase, accent: P.teal });
  flywheel(c, { x: 1460, y: rightY, r: 170, teeth: 50, angle: -phase * .8, accent: warm });
  flywheel(c, { x: 529, y: 1504, r: 99, teeth: 30, angle: -phase * 2, accent: P.gold });
  flywheel(c, { x: 969, y: 1580, r: 71, teeth: 24, angle: phase * 2.5, accent: P.teal });
  // Three out-of-phase reciprocators give an inhale / transfer / return rhythm.
  slider(c, leftX, 565, phase, .66, warm);
  slider(c, 1460, rightY, -phase * .8, 2.52, P.teal);
  slider(c, 529, 1504, -phase * 2, -.48, warm);
  bellows(c, phase, warm);
  // A light articulated spine joins the principal crank to the breathing vessel.
  const px = 1000 + Math.sin(phase) * 31, py = 476 + Math.cos(phase) * 37;
  rod(c, 995, 355, px, py, 11, P.gold);
  rod(c, px, py, 971 + Math.sin(phase) * 14, 623, 11);
  instrument(c, 1000, 315, phase, 'IN / OUT', 54);
  instrument(c, 1310, 1337, phase + Math.PI * .5, 'BAR', 65);
  instrument(c, 688, 1165, phase + Math.PI, 'RETURN', 44);
  // The left manifold: a row of phase-linked valve plungers.
  c.save(); c.translate(419, 1063); c.rotate(-.17);
  c.fillStyle = P.ink; c.fillRect(-51, -103, 102, 250);
  c.strokeStyle = P.paper; c.lineWidth = 3; c.strokeRect(-44, -97, 88, 238);
  for (let i = 0; i < 6; i++) {
    const y = -74 + i * 34, travel = Math.sin(phase * 2 - i * .44) * 15;
    line(c, -32, y, 32, y, P.muted, 2);
    c.fillStyle = i % 2 ? P.gold : P.mint; c.fillRect(travel - 8, y - 8, 16, 16);
    bolt(c, -51, y, 3); bolt(c, 51, y, 3);
  }
  c.restore(); annotations(c, variation);
}
