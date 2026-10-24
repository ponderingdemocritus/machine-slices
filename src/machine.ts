import type { MachineDNA } from './seed.js';
import { TAU, INK, PAPER, LIGHT, MIST, TEAL, COPPER, GOLD, LINE, type Pen,
  circle, line, arc, label, bolt, ticks, ringBolts, capsule } from './drawing.js';

// One 12-second shaft. Gear ratios and pressure lag derive every motion from it.
// Modulo before trigonometry keeps even very large finite timestamps well behaved.
export function drawMachine(c: Pen, dna: MachineDNA, timeMs: number) {
  const shaft = (timeMs % 24000) / 12000 * TAU + dna.phase;
  const breath = Math.sin(shaft * 2);
  c.fillStyle = PAPER; c.fillRect(0, 0, 2000, 2000);
  paper(c, dna);
  conduits(c, shaft);
  bellows(c, shaft, breath);
  shell(c, dna, breath);
  satellite(c, 531, 669, 142, -shaft * 2, 12, TEAL);
  satellite(c, 1454, 1274, 177, -shaft, 16, COPPER);
  satellite(c, 1128, 449, 86, shaft * 3, 8, GOLD);
  driveBelts(c, shaft);
  heart(c, dna, shaft);
  instruments(c, shaft);
  inscriptions(c);
}

function paper(c: Pen, dna: MachineDNA) {
  // The paper is world-anchored too: slices inherit the same marks.
  c.fillStyle = '#dfdccb';
  for (let y = 25; y < 2000; y += 50) for (let x = 25; x < 2000; x += 50) c.fillRect(x, y, 1.4, 1.4);
  c.fillStyle = '#d7d1bd';
  for (let i = 0; i < dna.flecks.length; i += 3) {
    c.fillRect(dna.flecks[i] * 2000, dna.flecks[i + 1] * 2000, 1 + dna.flecks[i + 2] * 2, .8);
  }
  for (const [x, y] of [[74, 74], [1926, 74], [74, 1926], [1926, 1926]]) {
    line(c, x - 12, y, x + 12, y, LINE); line(c, x, y - 12, x, y + 12, LINE);
    circle(c, x, y, 4, '', LINE);
  }
  arc(c, 1000, 1000, 675, -.48, 1.92, LINE);
  arc(c, 1000, 1000, 695, 2.28, 4.5, LINE);
  for (let i = 0; i < 50; i++) {
    const a = i * .062 - .48;
    line(c, 1000 + Math.cos(a) * 682, 1000 + Math.sin(a) * 682,
      1000 + Math.cos(a) * (i % 5 ? 688 : 700), 1000 + Math.sin(a) * (i % 5 ? 688 : 700), LINE);
  }
}

function conduitPath(c: Pen, variant: number) {
  c.beginPath();
  if (variant === 0) {
    c.moveTo(532, 674); c.bezierCurveTo(264, 835, 306, 1374, 600, 1505);
    c.bezierCurveTo(888, 1637, 1130, 1574, 1454, 1274);
  } else if (variant === 1) {
    c.moveTo(1128, 449); c.bezierCurveTo(1355, 335, 1663, 647, 1604, 937);
    c.bezierCurveTo(1572, 1090, 1474, 1169, 1454, 1274);
  } else {
    c.moveTo(532, 669); c.bezierCurveTo(546, 416, 746, 331, 913, 359);
    c.bezierCurveTo(1050, 380, 1076, 442, 1128, 449);
  }
}

function conduits(c: Pen, shaft: number) {
  for (let i = 0; i < 3; i++) {
    conduitPath(c, i); c.lineWidth = i === 0 ? 35 : 23; c.strokeStyle = INK; c.stroke();
    conduitPath(c, i); c.lineWidth = i === 0 ? 28 : 16; c.strokeStyle = MIST; c.stroke();
    conduitPath(c, i); c.lineWidth = 4; c.strokeStyle = TEAL;
    c.setLineDash([2, 22]); c.lineDashOffset = -shaft / TAU * 144; c.stroke(); c.setLineDash([]);
  }
  c.beginPath(); c.moveTo(864, 1632); c.bezierCurveTo(1040, 1700, 1239, 1550, 1200, 1400);
  c.lineTo(1100, 1090); c.lineWidth = 20; c.strokeStyle = INK; c.stroke();
  c.lineWidth = 13; c.strokeStyle = GOLD; c.stroke();
}

function shell(c: Pen, dna: MachineDNA, breath: number) {
  // A fixed, asymmetrical carapace against the exposed rotor.
  c.beginPath(); c.moveTo(1000, 554);
  c.bezierCurveTo(743, 520, 544, 734, 547, 1018);
  c.bezierCurveTo(552, 1313, 755, 1480, 1000, 1461);
  c.bezierCurveTo(780, 1380, 714, 1200, 722, 1000);
  c.bezierCurveTo(720, 788, 840, 632, 1000, 554);
  c.fillStyle = INK; c.fill();
  for (let i = 0; i < dna.ribs; i++) {
    const a = 1.67 + i / (dna.ribs - 1) * 3.03;
    const inner = 284 + Math.sin(i * .29) * 13;
    const outer = 443 + Math.sin(i * .42) * 10 + breath * 3;
    const x = 1000 + Math.cos(a) * inner, y = 1000 + Math.sin(a) * inner;
    const xx = 1000 + Math.cos(a + .12) * outer, yy = 1000 + Math.sin(a + .12) * outer;
    line(c, x, y, xx, yy, i % 4 ? '#547773' : GOLD, i % 4 ? 2 : 4);
    circle(c, xx, yy, 3.2, LIGHT);
  }
  arc(c, 1000, 1000, 455, 1.67, 4.67, INK, 3);
  arc(c, 1000, 1000, 465, 1.72, 4.67, INK, 1);
  arc(c, 1000, 1000, 416, -1.43, 1.36, INK, 5);
  arc(c, 1000, 1000, 429, -1.42, 1.35, TEAL, 2);
  for (let i = 0; i < 12; i++) {
    const a = -1.39 + i * .245;
    bolt(c, 1000 + Math.cos(a) * 418, 1000 + Math.sin(a) * 418, 5);
  }
}

function satellite(c: Pen, x: number, y: number, r: number, angle: number, count: number, color: string) {
  circle(c, x + 7, y + 10, r + 15, '#d9d4c2');
  circle(c, x, y, r + 14, PAPER, INK, 2);
  circle(c, x, y, r + 3, INK);
  ticks(c, x, y, r - 2, count * 4, LIGHT);
  circle(c, x, y, r - 20, color, LIGHT, 2);
  c.save(); c.translate(x, y); c.rotate(angle);
  for (let i = 0; i < count; i++) {
    c.save(); c.rotate(i * TAU / count);
    c.beginPath(); c.moveTo(r * .25, -4); c.bezierCurveTo(r * .55, -r * .32, r * .68, -r * .23, r - 28, -8);
    c.lineTo(r - 28, 2); c.bezierCurveTo(r * .65, -r * .12, r * .48, 10, r * .25, 8);
    c.closePath(); c.fillStyle = INK; c.fill(); c.restore();
  }
  circle(c, 0, 0, r * .29, PAPER, INK, 3);
  ringBolts(c, 0, 0, r * .2, 4);
  circle(c, 0, 0, r * .1, INK); line(c, 0, 0, r * .09, 0, GOLD, 3);
  c.restore();
  ringBolts(c, x, y, r + 8, 6, Math.PI / 6);
}

function bellows(c: Pen, shaft: number, breath: number) {
  c.save(); c.translate(792, 470); c.rotate(-.35);
  const extension = 107 + breath * 18;
  capsule(c, -55, -extension, 110, extension + 90, INK);
  for (let i = 0; i < 14; i++) {
    const y = -extension + 12 + i / 13 * (extension + 60);
    capsule(c, -68, y, 136, 6, i % 3 ? MIST : GOLD, INK, 1);
  }
  capsule(c, -76, -extension - 12, 152, 18, TEAL);
  capsule(c, -76, 76, 152, 18, TEAL);
  line(c, 0, 94, 0, 204, INK, 16); line(c, -3, 94, -3, 204, LIGHT, 4);
  bolt(c, 0, 193, 12); c.restore();
  // Lower accumulator responds with a quarter-cycle lag.
  c.save(); c.translate(817, 1567); c.rotate(.23);
  capsule(c, -94, -98, 188, 240, INK);
  capsule(c, -79, -83, 158, 206, MIST);
  for (let i = 0; i < 8; i++) line(c, -66, -56 + i * 21, 65, -56 + i * 21, TEAL, 1);
  const y = Math.cos(shaft * 2) * 37;
  capsule(c, -70, y - 23, 140, 46, COPPER);
  line(c, 0, -140, 0, y - 23, INK, 15); line(c, -4, -140, -4, y - 23, LIGHT, 3);
  for (const yy of [-98, 135]) { bolt(c, -66, yy); bolt(c, 66, yy); }
  c.restore();
}

function driveBelts(c: Pen, shaft: number) {
  for (const [x, y, r] of [[531, 669, 54], [1454, 1274, 62], [1128, 449, 37]]) {
    const a = Math.atan2(y - 1000, x - 1000), nx = -Math.sin(a) * r, ny = Math.cos(a) * r;
    for (const s of [-1, 1]) {
      line(c, 1000 + nx * s, 1000 + ny * s, x + nx * s, y + ny * s, INK, 10);
      c.setLineDash([2, 15]); c.lineDashOffset = shaft / TAU * 102 * s;
      line(c, 1000 + nx * s, 1000 + ny * s, x + nx * s, y + ny * s, GOLD, 3);
      c.setLineDash([]);
    }
  }
}

function heart(c: Pen, dna: MachineDNA, shaft: number) {
  const x = 1000, y = 1000;
  circle(c, x, y, 321, PAPER, INK, 3);
  circle(c, x, y, 308, INK);
  ticks(c, x, y, 303, 120, MIST);
  circle(c, x, y, 281, MIST, LIGHT, 2);
  // Apertures in a single flywheel, with a common fixed pivot.
  c.save(); c.translate(x, y); c.rotate(shaft);
  for (let i = 0; i < dna.apertures; i++) {
    c.save(); c.rotate(i * TAU / dna.apertures);
    c.beginPath(); c.moveTo(143, -18); c.bezierCurveTo(182, -67, 232, -56, 263, -21);
    c.lineTo(260, 9); c.bezierCurveTo(216, -12, 175, 7, 147, 29); c.closePath();
    c.fillStyle = i % 3 === 0 ? TEAL : INK; c.fill();
    arc(c, 0, 0, 271, -.15, .08, LIGHT, 3);
    bolt(c, 247, 19, 4); c.restore();
  }
  c.restore();
  circle(c, x, y, 149, PAPER, INK, 4);
  ticks(c, x, y, 140, 72, INK, -.5);
  circle(c, x, y, 118, COPPER, INK, 3);
  for (let i = 0; i < 48; i++) {
    const a = i * TAU / 48, r = i % 4 === 0 ? 90 : 104;
    line(c, x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * 113, y + Math.sin(a) * 113, GOLD, 1.2);
  }
  circle(c, x, y, 85, INK, LIGHT, 2);
  // Six eccentric crescent shutters slowly inhale around the axle.
  c.save(); c.translate(x, y); c.rotate(-shaft * .5);
  for (let i = 0; i < 6; i++) {
    c.save(); c.rotate(i * TAU / 6);
    const open = 25 + Math.sin(shaft * 2) * 7;
    c.beginPath(); c.moveTo(open, -6); c.bezierCurveTo(39, -53, 69, -61, 79, -20);
    c.bezierCurveTo(55, -30, 46, -8, open + 4, 8); c.closePath();
    c.fillStyle = i % 2 ? MIST : GOLD; c.fill();
    c.strokeStyle = LIGHT; c.lineWidth = .9; c.stroke();
    // Fine scored channels turn the small shutters into landscapes at slice scale.
    c.save(); c.clip();
    for (let j = 0; j < 7; j++) {
      c.beginPath(); c.moveTo(open + 3 + j * 2, 7);
      c.bezierCurveTo(46 + j * 2, -15, 39 + j * 3, -48, 76 + j * 2, -22);
      c.strokeStyle = i % 2 ? TEAL : '#9c703b'; c.lineWidth = .45; c.stroke();
    }
    c.restore();
    c.beginPath(); c.moveTo(43, -20); c.quadraticCurveTo(58, -42, 70, -28);
    c.strokeStyle = INK; c.lineWidth = 1; c.stroke(); c.restore();
  }
  circle(c, 0, 0, 20, COPPER, LIGHT, 2);
  ticks(c, 0, 0, 18, 24, GOLD);
  circle(c, 0, 0, 11, GOLD, INK, 2);
  circle(c, 0, 0, 7.5, '', '#9c703b', .5);
  line(c, -6, 0, 6, 0, INK, 2); c.restore();
  c.save(); c.translate(x, y); c.rotate(-.7);
  for (const s of [-1, 1]) {
    capsule(c, s < 0 ? -342 : 158, -18, 184, 36, PAPER, INK, 3);
    bolt(c, s * 325, 0, 8); bolt(c, s * 177, 0, 7);
    line(c, s * 192, -5, s * 302, -5, TEAL, 2);
  }
  c.restore();
  const crankX = 1000 + Math.cos(shaft) * 111, crankY = 1000 + Math.sin(shaft) * 111;
  const sliderY = 733 + Math.sin(shaft) * 30;
  line(c, 1045, 630, 1045, 782, INK, 9); line(c, 1075, 630, 1075, 782, INK, 9);
  line(c, 1060, sliderY, crankX, crankY, INK, 15);
  line(c, 1060, sliderY, crankX, crankY, LIGHT, 9);
  capsule(c, 1036, sliderY - 13, 48, 26, COPPER);
  bolt(c, crankX, crankY, 9);
}

function instruments(c: Pen, shaft: number) {
  c.save(); c.translate(1472, 738);
  capsule(c, -84, -122, 168, 248, INK);
  circle(c, 0, -39, 67, LIGHT, INK, 2); ticks(c, 0, -39, 59, 40);
  const needle = -.7 + Math.sin(shaft * 2 - .5) * .55;
  line(c, 0, -39, Math.cos(needle) * 49, -39 + Math.sin(needle) * 49, COPPER, 3);
  circle(c, 0, -39, 6, INK);
  label(c, 'PRESSURE', -31, -7, 9);
  for (let i = 0; i < 6; i++) {
    capsule(c, -55, 45 + i * 10, 110, 4, i < 3 + Math.sin(shaft * 2) * 2 ? GOLD : TEAL, INK, .5);
  }
  bolt(c, -63, -102); bolt(c, 63, 106); c.restore();
  for (let i = 0; i < 7; i++) {
    const a = .4 + i * .12, r = 530;
    const x = 1000 + Math.cos(a) * r, y = 1000 + Math.sin(a) * r;
    circle(c, x, y, 12, PAPER, INK, 2);
    circle(c, x, y, 5 + 2 * Math.sin(shaft * 2 - i * .35), i % 2 ? TEAL : COPPER);
  }
  c.save(); c.translate(1165, 1558); c.rotate(-.46 + Math.sin(shaft) * .035);
  for (let i = 0; i < 9; i++) {
    const h = 100 - i * 7;
    capsule(c, i * 15, -h / 2, 10, h, i % 3 ? TEAL : GOLD, INK, 1);
  }
  line(c, -13, 0, 143, 0, INK, 8); bolt(c, 0, 0, 9); c.restore();
}

function inscriptions(c: Pen) {
  label(c, '01 / THE TIDAL ENGINE', 140, 164, 20);
  label(c, 'A STUDY IN RECIRCULATION', 140, 193, 12, TEAL);
  line(c, 140, 218, 454, 218, INK);
  label(c, 'INTAKE', 349, 425, 12); line(c, 350, 440, 487, 440, LINE); line(c, 487, 440, 530, 509, LINE);
  label(c, 'RETURN', 1540, 1538, 12); line(c, 1528, 1526, 1451, 1460, LINE);
  label(c, 'I', 996, 644, 17); label(c, 'II', 1350, 1005, 17); label(c, 'III', 987, 1366, 17);
  label(c, '2000 × 2000 / CONTINUOUS FIELD', 140, 1854, 12, TEAL);
  label(c, 'INHALE  /  TRANSFER  /  RETURN', 140, 1878, 12, TEAL);
  for (let i = 0; i < 5; i++) { c.fillStyle = [INK, TEAL, MIST, GOLD, COPPER][i]; c.fillRect(1670 + i * 30, 1844, 22, 22); }
}
