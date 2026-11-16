// Jet Fight Empire: the sea battle. Draws one frame from the round state `v`.
// The battle runs from sunset into night as the multiplier climbs.
import { TAU, clamp, lerp, easeOut, hash, rr, particles } from './util';
import { sfx } from '../engine/sound';

/* ───────── Colour ───────── */

const toRgb = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
function mix(a, b, t, alpha = 1) {
  const A = toRgb(a), B = toRgb(b);
  return `rgba(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))},${alpha})`;
}
const wrap = (v, span) => ((v % span) + span) % span;

const SKY_DUSK = ['#0b1636', '#26296a', '#62367e', '#d0606c', '#ffa35a'];
const SKY_NIGHT = ['#02040c', '#060d26', '#0f1a44', '#1f2558', '#3c2c5c'];
const SEA_DUSK = ['#5d3b6a', '#2a2b58', '#081325'];
const SEA_NIGHT = ['#1a1c42', '#0d1434', '#03070f'];

const PLAYER = { body: '#eef2f8', mid: '#b4c0d4', dark: '#66748e', accent: '#ff8a3d', insignia: 'player', glass: [127, 211, 255], code: '01' };
const WINGMAN = { body: '#d6dde8', mid: '#9eabc1', dark: '#56637c', accent: '#7fd3ff', insignia: 'player', glass: [127, 211, 255], code: '02', helmet: '#ffd166' };
const PARKED = { body: '#e2e7ef', mid: '#a9b4c8', dark: '#5e6a82', accent: '#ffd166', insignia: 'player', code: '05' };
const ENEMY = { body: '#9a6474', mid: '#673f50', dark: '#2e1a26', accent: '#ff3b3b', insignia: 'enemy', twin: true, glass: [255, 112, 112], camo: '#5a3242', helmet: '#3a3a42' };
const WRECK = { body: '#5a5560', mid: '#3c3842', dark: '#1e1b22', accent: '#4a2a20', insignia: null, noStores: true };

/* ───────── Aircraft ───────── */

function store(ctx, x, y, k = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.fillStyle = '#5a6274';
  ctx.fillRect(-3, -4, 6, 2.4);
  const g = ctx.createLinearGradient(0, -1.8, 0, 1.8);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#b9c0cc');
  ctx.fillStyle = g;
  rr(ctx, -10, -1.8, 20, 3.6, 1.6);
  ctx.fill();
  ctx.fillStyle = '#d23b3b';
  ctx.beginPath(); ctx.moveTo(9.5, -1.8); ctx.quadraticCurveTo(14, 0, 9.5, 1.8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(4, -1.8, 1.2, 3.6);
  ctx.fillStyle = '#8a93a6';
  ctx.beginPath(); ctx.moveTo(-10, -1.6); ctx.lineTo(-13.5, -4.6); ctx.lineTo(-6.5, -1.6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-10, 1.6); ctx.lineTo(-13.5, 4.6); ctx.lineTo(-6.5, 1.6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * TAU;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a + Math.PI / 5) * r * 0.45, y + Math.sin(a + Math.PI / 5) * r * 0.45);
  }
  ctx.closePath();
}

const glassStops = (g, [r, gr, b]) => {
  g.addColorStop(0, 'rgba(244,252,255,0.8)');
  g.addColorStop(0.35, `rgba(${r},${gr},${b},0.45)`);
  g.addColorStop(1, `rgba(${Math.round(r * 0.15)},${Math.round(gr * 0.25)},${Math.round(b * 0.35)},0.85)`);
};

function fuselagePath(ctx) {
  ctx.beginPath();
  ctx.moveTo(57, 1.5);
  ctx.quadraticCurveTo(44, -4.5, 30, -6);
  ctx.quadraticCurveTo(10, -9, -20, -8);
  ctx.lineTo(-44, -6.5);
  ctx.lineTo(-51, -5);
  ctx.lineTo(-51, 5);
  ctx.lineTo(-30, 7.5);
  ctx.lineTo(4, 8);
  ctx.quadraticCurveTo(34, 7, 57, 1.5);
  ctx.closePath();
}

// Modern fighter, nose pointing +x, ~110 units nose to nozzle. flip: faces left.
// opts.gear: landing gear down (on the deck). opts.t: clock for the nav lights.
function drawFighter(ctx, x, y, size, angle, burn, pal, flip = false, opts = {}) {
  const t = opts.t || 0;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.rotate(angle);
  const s = size / 100;
  ctx.scale(s, s);

  // afterburner: glow, outer flame, white-hot core, shock diamonds
  if (burn > 0) {
    const fl = burn * (0.85 + Math.random() * 0.3);
    const L = 24 + 58 * fl;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(-55, 0, 0, -55, 0, 24 + 30 * fl);
    glow.addColorStop(0, `rgba(255,170,90,${0.5 * burn})`);
    glow.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(-55, 0, 24 + 30 * fl, 0, TAU); ctx.fill();
    const og = ctx.createLinearGradient(-53, 0, -53 - L, 0);
    og.addColorStop(0, 'rgba(255,205,130,0.95)');
    og.addColorStop(0.5, 'rgba(255,110,50,0.6)');
    og.addColorStop(1, 'rgba(255,60,30,0)');
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.moveTo(-53, -5); ctx.quadraticCurveTo(-53 - L * 0.6, -4.2, -53 - L, 0); ctx.quadraticCurveTo(-53 - L * 0.6, 4.2, -53, 5); ctx.closePath(); ctx.fill();
    const ig = ctx.createLinearGradient(-53, 0, -53 - L * 0.55, 0);
    ig.addColorStop(0, 'rgba(255,255,245,1)');
    ig.addColorStop(1, 'rgba(150,200,255,0)');
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.moveTo(-53, -2.8); ctx.quadraticCurveTo(-53 - L * 0.35, -2, -53 - L * 0.55, 0); ctx.quadraticCurveTo(-53 - L * 0.35, 2, -53, 2.8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.75 * burn})`;
    for (let i = 1; i <= 3; i++) {
      const dx = -53 - i * L * 0.15, r = 2.8 - i * 0.55;
      ctx.beginPath(); ctx.moveTo(dx + r, 0); ctx.lineTo(dx, -r); ctx.lineTo(dx - r, 0); ctx.lineTo(dx, r); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // landing gear (behind the fuselage)
  if (opts.gear) {
    ctx.strokeStyle = '#3a3f4c';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(30, 6); ctx.lineTo(31, 21); ctx.moveTo(-14, 7); ctx.lineTo(-16, 20); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-14, 10); ctx.lineTo(-20, 18); ctx.stroke();
    for (const [wx, wy, wr] of [[31, 22.5, 3.5], [-16, 21.5, 4.5]]) {
      ctx.fillStyle = '#16181e';
      ctx.beginPath(); ctx.arc(wx, wy, wr, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8a92a4';
      ctx.beginPath(); ctx.arc(wx, wy, wr * 0.45, 0, TAU); ctx.fill();
    }
  }

  // far wing, far stabilizer and the tail fin(s), in shadow
  ctx.fillStyle = pal.dark;
  ctx.beginPath(); ctx.moveTo(8, -2); ctx.lineTo(-18, -15); ctx.lineTo(-28, -15); ctx.lineTo(-26, -3); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-38, -2); ctx.lineTo(-48, -9); ctx.lineTo(-55, -9); ctx.lineTo(-51, -2); ctx.closePath(); ctx.fill();
  const fin = (ox, col) => {
    const g = ctx.createLinearGradient(-30 + ox, -6, -46 + ox, -32);
    g.addColorStop(0, col);
    g.addColorStop(1, pal.dark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-24 + ox, -6); ctx.lineTo(-40 + ox, -32); ctx.lineTo(-49 + ox, -32); ctx.lineTo(-47 + ox, -6); ctx.closePath(); ctx.fill();
  };
  if (pal.twin) fin(7, pal.dark);
  fin(0, pal.mid);
  ctx.fillStyle = pal.accent;
  ctx.beginPath(); ctx.moveTo(-36.2, -26); ctx.lineTo(-40, -32); ctx.lineTo(-49, -32); ctx.lineTo(-48.6, -26); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-24, -6); ctx.lineTo(-40, -32); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.moveTo(-45, -26); ctx.lineTo(-46.6, -8); ctx.stroke();
  // ventral fin
  ctx.fillStyle = pal.dark;
  ctx.beginPath(); ctx.moveTo(-34, 6.5); ctx.lineTo(-42, 13); ctx.lineTo(-46, 13); ctx.lineTo(-45, 6); ctx.closePath(); ctx.fill();

  // fuselage: base shade, camouflage, top sheen and belly shadow
  const fg = ctx.createLinearGradient(0, -9, 0, 9);
  fg.addColorStop(0, pal.body);
  fg.addColorStop(0.55, pal.mid);
  fg.addColorStop(1, pal.dark);
  ctx.fillStyle = fg;
  fuselagePath(ctx);
  ctx.fill();
  ctx.save();
  fuselagePath(ctx);
  ctx.clip();
  if (pal.camo) {
    ctx.fillStyle = pal.camo;
    for (const [cx, cy, rx, ry] of [[-34, -5, 8, 3], [-10, -4.5, 9, 3], [14, -2, 7, 3.4], [-22, 4, 10, 2.6], [36, -1, 6, 2.4]]) {
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0.2, 0, TAU); ctx.fill();
    }
  }
  const sp = ctx.createLinearGradient(0, -9, 0, -1);
  sp.addColorStop(0, 'rgba(255,255,255,0.5)');
  sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp;
  ctx.fillRect(-60, -10, 120, 9);
  const bs = ctx.createLinearGradient(0, 2, 0, 9);
  bs.addColorStop(0, 'rgba(0,0,0,0)');
  bs.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = bs;
  ctx.fillRect(-60, 2, 120, 8);
  ctx.restore();
  if (pal.glass) {
    ctx.strokeStyle = RIM;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(55, 0.4); ctx.quadraticCurveTo(44, -5.2, 30, -6.7); ctx.quadraticCurveTo(10, -9.6, -20, -8.6); ctx.lineTo(-44, -7.1); ctx.stroke();
  }
  // radome
  ctx.fillStyle = 'rgba(40,46,60,0.55)';
  ctx.beginPath(); ctx.moveTo(57, 1.5); ctx.quadraticCurveTo(51, -2.6, 45, -3.4); ctx.lineTo(45, 5.2); ctx.quadraticCurveTo(51, 4, 57, 1.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(45, -3.4); ctx.lineTo(45, 5.2); ctx.stroke();
  // intake with splitter
  ctx.fillStyle = 'rgba(10,12,20,0.88)';
  ctx.beginPath(); ctx.moveTo(18, 5); ctx.lineTo(4, 5); ctx.lineTo(0, 10.5); ctx.lineTo(16, 9.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.moveTo(18, 5); ctx.lineTo(16, 9.5); ctx.stroke();
  // spine highlight, panel lines and rivets
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(30, -5.2); ctx.quadraticCurveTo(8, -7.8, -42, -5.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 0.7;
  for (const lx of [-30, -8, 10, 44]) { ctx.beginPath(); ctx.moveTo(lx, -7.4); ctx.lineTo(lx - 1, 7); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-44, 3); ctx.lineTo(0, 4.4); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 9; i++) ctx.fillRect(-40 + i * 9, -4.4, 0.8, 0.8);
  // speed stripe
  ctx.fillStyle = pal.accent;
  ctx.beginPath(); ctx.moveTo(-47, -1.2); ctx.lineTo(8, -2); ctx.lineTo(12, 0); ctx.lineTo(-47, 1.2); ctx.closePath(); ctx.fill();
  // nozzle with petals
  const ng = ctx.createLinearGradient(0, -5, 0, 5);
  ng.addColorStop(0, '#4a4f5c');
  ng.addColorStop(1, '#1a1c24');
  ctx.fillStyle = ng;
  ctx.beginPath(); ctx.moveTo(-50, -5.5); ctx.lineTo(-57, -4.4); ctx.lineTo(-57, 4.4); ctx.lineTo(-50, 5.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 0.6;
  for (const py of [-3, -1, 1, 3]) { ctx.beginPath(); ctx.moveTo(-50, py * 1.1); ctx.lineTo(-57, py); ctx.stroke(); }
  ctx.fillStyle = burn > 0 ? `rgba(255,200,120,${0.5 + burn * 0.5})` : '#15161c';
  ctx.fillRect(-57.6, -3.4, 1.6, 6.8);

  // pilot under a tinted canopy
  if (pal.glass) {
    ctx.fillStyle = '#20232c';
    ctx.fillRect(17, -12.5, 2.6, 6.5);
    ctx.fillStyle = pal.helmet || '#f2f4f8';
    ctx.beginPath(); ctx.arc(23, -10.4, 3.3, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.accent;
    ctx.fillRect(20.4, -12.6, 5.2, 0.9);
    ctx.fillStyle = '#16222e';
    ctx.beginPath(); ctx.ellipse(25.3, -10, 1.9, 1.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(160,220,255,0.7)';
    ctx.fillRect(25.6, -10.9, 0.8, 0.6);
  }
  const cg = ctx.createLinearGradient(16, -15, 32, -4);
  glassStops(cg, pal.glass || [42, 38, 48]);
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.moveTo(9, -6.6); ctx.quadraticCurveTo(17, -15.5, 30, -12.4); ctx.quadraticCurveTo(38, -9.5, 41, -5.2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(20,24,34,0.75)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(9, -6.6); ctx.quadraticCurveTo(17, -15.5, 30, -12.4); ctx.quadraticCurveTo(38, -9.5, 41, -5.2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(30, -12.4); ctx.lineTo(31, -5.8); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(13, -10); ctx.quadraticCurveTo(18, -13.9, 26, -13.2); ctx.stroke();

  // near wing with flap line, near stabilizer
  const wg = ctx.createLinearGradient(0, 2, 0, 26);
  wg.addColorStop(0, pal.body);
  wg.addColorStop(1, pal.mid);
  ctx.fillStyle = wg;
  ctx.beginPath(); ctx.moveTo(16, 3); ctx.lineTo(-22, 24); ctx.lineTo(-34, 24); ctx.lineTo(-30, 3); ctx.closePath(); ctx.fill();
  if (pal.camo) {
    ctx.fillStyle = pal.camo;
    ctx.beginPath(); ctx.ellipse(-16, 12, 7, 3, -0.5, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(16, 3); ctx.lineTo(-22, 24); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.moveTo(-28, 6); ctx.lineTo(-31.6, 22); ctx.moveTo(-6, 6); ctx.lineTo(-26, 21); ctx.stroke();
  ctx.fillStyle = pal.accent;
  ctx.beginPath(); ctx.moveTo(-21.5, 23); ctx.lineTo(-34, 23); ctx.lineTo(-34, 25.5); ctx.lineTo(-23, 25.5); ctx.closePath(); ctx.fill();
  const tg = ctx.createLinearGradient(0, 3, 0, 14);
  tg.addColorStop(0, pal.body);
  tg.addColorStop(1, pal.mid);
  ctx.fillStyle = tg;
  ctx.beginPath(); ctx.moveTo(-36, 3); ctx.lineTo(-48, 14); ctx.lineTo(-57, 14); ctx.lineTo(-52, 3); ctx.closePath(); ctx.fill();

  if (!pal.noStores) {
    store(ctx, -10, 14);
    store(ctx, -25, 20, 0.8);
  }
  // nav lights: green wingtip, white tail
  if (!pal.noStores) {
    const on = Math.sin(t * 5 + x * 0.01) > 0;
    ctx.fillStyle = on ? '#7dffb0' : '#1e4a30';
    ctx.beginPath(); ctx.arc(-34.5, 24.3, 1.4, 0, TAU); ctx.fill();
    if (on) {
      ctx.fillStyle = 'rgba(125,255,176,0.35)';
      ctx.beginPath(); ctx.arc(-34.5, 24.3, 3.6, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = Math.sin(t * 3) > 0.6 ? '#ffffff' : '#7a7f8c';
    ctx.beginPath(); ctx.arc(-49.5, -32, 1.1, 0, TAU); ctx.fill();
  }
  if (pal.insignia === 'player') {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-40.5, -16, 4.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1f4f8a'; ctx.beginPath(); ctx.arc(-40.5, -16, 3.3, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.arc(-40.5, -16, 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(30,40,60,0.6)';
    ctx.font = '800 4px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pal.code || '01', -20, -3.6);
  } else if (pal.insignia === 'enemy') {
    ctx.fillStyle = '#ffe6e6'; star(ctx, -40.5, -16, 5.4); ctx.fill();
    ctx.fillStyle = '#e02929'; star(ctx, -40.5, -16, 4.2); ctx.fill();
  }
  ctx.restore();
}

/* ───────── Ships ───────── */

function railing(ctx, x0, x1, y, hgt = 4) {
  ctx.strokeStyle = 'rgba(190,200,225,0.45)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(x0, y - hgt); ctx.lineTo(x1, y - hgt);
  for (let x = x0; x <= x1; x += 5) { ctx.moveTo(x, y); ctx.lineTo(x, y - hgt); }
  ctx.stroke();
}

// A tiny sailor on a warship deck: navy uniform, white cap.
function deckSailor(ctx, x, y, t) {
  const sw = Math.sin(t) * 1.2;
  ctx.strokeStyle = '#1b2440';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - 4); ctx.lineTo(x - 1 + sw * 0.5, y);
  ctx.moveTo(x, y - 4); ctx.lineTo(x + 1 - sw * 0.5, y);
  ctx.moveTo(x, y - 4); ctx.lineTo(x, y - 7.5);
  ctx.moveTo(x, y - 7); ctx.lineTo(x - 1.8, y - 4.5 + sw * 0.4);
  ctx.moveTo(x, y - 7); ctx.lineTo(x + 1.8, y - 4.5 - sw * 0.4);
  ctx.stroke();
  ctx.fillStyle = '#e2b08c';
  ctx.beginPath(); ctx.arc(x, y - 9, 1.3, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f2f4f8';
  ctx.fillRect(x - 1.5, y - 10.6, 3, 0.9);
}

function reflection(ctx, x0, x1, y, depth, alpha) {
  const g = ctx.createLinearGradient(0, y, 0, y + depth);
  g.addColorStop(0, `rgba(6,8,24,${alpha})`);
  g.addColorStop(1, 'rgba(6,8,24,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y, x1 - x0, depth);
}

// Warship, bow pointing left. Waterline at y=0. aim: turret angle towards the player.
function drawWarship(ctx, x, y, s, ship, time, aim, night) {
  const sink = ship.sink || 0;
  const type = ship.type;
  const L = type === 'battleship' ? 130 : type === 'cruiser' ? 105 : 82;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  reflection(ctx, -L + 10, L, 5, 34, 0.4 * (1 - Math.min(1, sink)));
  ctx.restore();

  const lit = mix('#1c2233', '#ffd27a', 0.3 + night * 0.7);

  const block = (bx, by, bw, bh) => {
    const g = ctx.createLinearGradient(0, by, 0, by + bh);
    g.addColorStop(0, '#727a98');
    g.addColorStop(1, '#3a405a');
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw, bh);
    const side = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    side.addColorStop(0, 'rgba(0,0,0,0.22)');
    side.addColorStop(0.35, 'rgba(0,0,0,0)');
    side.addColorStop(1, 'rgba(255,220,190,0.1)');
    ctx.fillStyle = side;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(bx, by, bw, 1.3);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(bx, by + bh - 1.2, bw, 1.2);
  };
  const windows = (wx, wy, n, gap) => {
    ctx.fillStyle = lit;
    for (let i = 0; i < n; i++) ctx.fillRect(wx + i * gap, wy, gap * 0.55, 2.4);
  };
  const bridge = (bx, by, bw) => {
    ctx.fillStyle = '#14202e';
    ctx.beginPath(); ctx.moveTo(bx - 2, by); ctx.lineTo(bx + bw + 2, by); ctx.lineTo(bx + bw, by + 5); ctx.lineTo(bx, by + 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = mix('#5aa8d8', '#ffd27a', night, 0.75);
    for (let i = 0; i < Math.floor(bw / 4); i++) ctx.fillRect(bx + 1 + i * 4, by + 1, 2.6, 3);
    // bridge wings
    ctx.fillStyle = '#4a5170';
    ctx.fillRect(bx - 8, by + 5, bw + 16, 1.8);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(bx - 8, by + 5, bw + 16, 0.6);
  };
  const lifeboat = (lx, ly) => {
    ctx.fillStyle = '#ff7a2a';
    rr(ctx, lx, ly, 12, 4.2, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(lx + 2, ly + 0.6, 8, 0.8);
  };
  const ciws = (cx, cy) => {
    ctx.fillStyle = '#5a6078';
    ctx.fillRect(cx - 3, cy - 2, 6, 3);
    ctx.fillStyle = '#e8ecf4';
    ctx.beginPath(); ctx.arc(cx, cy - 5.5, 3.8, Math.PI, 0); ctx.lineTo(cx + 3.8, cy - 2); ctx.lineTo(cx - 3.8, cy - 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#30343f';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 2, cy - 4); ctx.lineTo(cx - 9, cy - 7); ctx.stroke();
  };
  const mast = (mx, top, base) => {
    ctx.strokeStyle = '#3a405a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(mx - 4, base); ctx.lineTo(mx, top); ctx.lineTo(mx + 4, base); ctx.stroke();
    ctx.lineWidth = 0.8;
    for (let k = 1; k < 5; k++) {
      const yy = base + (top - base) * (k / 5);
      const wd = 4 * (1 - k / 5);
      ctx.beginPath(); ctx.moveTo(mx - wd, yy); ctx.lineTo(mx + wd, yy - (top - base) / 10); ctx.stroke();
    }
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(mx - 10, top + 10); ctx.lineTo(mx + 10, top + 10); ctx.moveTo(mx - 6, top + 18); ctx.lineTo(mx + 6, top + 18); ctx.stroke();
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(mx, top + 2); ctx.lineTo(mx - 24, base + 8); ctx.moveTo(mx, top + 2); ctx.lineTo(mx + 28, base + 8); ctx.moveTo(mx + 3, top + 10); ctx.lineTo(mx + 3, top - 6); ctx.stroke();
    const rw = 11 * Math.abs(Math.cos(time * 2.2 + ship.seed));
    ctx.fillStyle = '#a3acc6';
    ctx.fillRect(mx - Math.max(1, rw), top + 3, Math.max(2, rw * 2), 2.4);
    ctx.fillStyle = '#e8ecf4';
    ctx.beginPath(); ctx.arc(mx - 6, top + 16, 2.6, 0, TAU); ctx.fill();
    ctx.fillStyle = Math.sin(time * 4 + ship.seed) > 0.2 ? '#ff4040' : '#4a1414';
    ctx.beginPath(); ctx.arc(mx, top - 1.5, 1.8, 0, TAU); ctx.fill();
  };
  const funnel = (fx0, top, base) => {
    const g = ctx.createLinearGradient(fx0, 0, fx0 + 17, 0);
    g.addColorStop(0, '#3e4460');
    g.addColorStop(0.6, '#646c8a');
    g.addColorStop(1, '#4a5170');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(fx0, base); ctx.lineTo(fx0 + 3, top); ctx.lineTo(fx0 + 17, top); ctx.lineTo(fx0 + 16, base); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8ecf4';
    ctx.fillRect(fx0 + 2.6, top + 5, 14.6, 2.2);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(fx0 + 2.4, top + 7.2, 14.8, 1.6);
    ctx.fillStyle = '#16181f';
    ctx.fillRect(fx0 + 2, top - 2.5, 16, 3.4);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(fx0 + 2, top - 2.5, 16, 0.8);
  };
  const flagLine = (x0, y0, x1, y1) => {
    ctx.strokeStyle = 'rgba(30,32,44,0.8)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const cols = ['#ffd166', '#c0392b', '#3a7bd5', '#f2f4f8', '#59e39a', '#ff8a3d'];
    for (let i = 1; i < 9; i++) {
      const u = i / 9, fx1 = lerp(x0, x1, u), fy1 = lerp(y0, y1, u);
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath(); ctx.moveTo(fx1, fy1); ctx.lineTo(fx1 + 2.4, fy1 + 0.6); ctx.lineTo(fx1 + 0.4, fy1 + 3.4 + Math.sin(time * 5 + i) * 0.5); ctx.closePath(); ctx.fill();
    }
  };
  const searchlight = (sx, sy) => {
    ctx.fillStyle = '#2e3346';
    ctx.fillRect(sx - 1, sy - 2, 2, 2);
    ctx.fillStyle = '#5a6280';
    rr(ctx, sx - 3, sy - 6, 6, 4.4, 1.5);
    ctx.fill();
    ctx.fillStyle = night > 0.2 ? '#fff6d0' : '#cfd6e6';
    ctx.fillRect(sx - 3.4, sy - 5.4, 1.2, 3.2);
  };
  // Twin anti-aircraft mount: pedestal, shield, thin barrels that chatter when firing.
  const aaGun = (gx, gy) => {
    const a = clamp(aim, -Math.PI + 0.3, -0.3);
    const firing = ship.flash >= 0 && time - ship.flash < 0.5;
    ctx.fillStyle = '#2e3346';
    ctx.fillRect(gx - 5, gy - 1.6, 10, 1.6);
    ctx.fillStyle = '#3a4058';
    ctx.fillRect(gx - 2, gy - 3, 4, 3);
    ctx.strokeStyle = '#1e2230';
    ctx.lineWidth = 0.9;
    for (const o of [-0.9, 0.9]) {
      const jig = firing && Math.sin(time * 60 + o) > 0 ? 1 : 0;
      ctx.beginPath();
      ctx.moveTo(gx - Math.sin(a) * o, gy - 5 + Math.cos(a) * o);
      ctx.lineTo(gx - Math.sin(a) * o + Math.cos(a) * (11 - jig), gy - 5 + Math.cos(a) * o + Math.sin(a) * (11 - jig));
      ctx.stroke();
    }
    ctx.fillStyle = '#6a7290';
    ctx.beginPath(); ctx.moveTo(gx - 4, gy - 2); ctx.lineTo(gx - 3, gy - 8); ctx.lineTo(gx + 3, gy - 8); ctx.lineTo(gx + 4, gy - 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(gx - 3, gy - 8, 6, 0.8);
    if (firing && Math.sin(time * 45) > 0 && SPRITES) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const ex = gx + Math.cos(a) * 12, ey = gy - 5 + Math.sin(a) * 12;
      ctx.drawImage(SPRITES.fire, ex - 4, ey - 4, 8, 8);
      ctx.restore();
    }
  };
  // Armoured drum that raises a turret off the deck: round shading, armour bands, rivets.
  const barbette = (bx, top, hw, base) => {
    const g = ctx.createLinearGradient(bx - hw, 0, bx + hw, 0);
    g.addColorStop(0, '#2c3146');
    g.addColorStop(0.38, '#6c7492');
    g.addColorStop(0.62, '#59617e');
    g.addColorStop(1, '#262a3c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx - hw, top); ctx.lineTo(bx + hw, top);
    ctx.lineTo(bx + hw + 2, base); ctx.lineTo(bx - hw - 2, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let yy = top + 7; yy < base - 2; yy += 7) ctx.fillRect(bx - hw - 1, yy, hw * 2 + 2, 1.2);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    for (let yy = top + 8.2; yy < base - 2; yy += 7) ctx.fillRect(bx - hw - 1, yy, hw * 2 + 2, 0.6);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 6; i++) ctx.fillRect(bx - hw + 3 + i * (hw * 2 - 6) / 5, top + 3, 0.9, 0.9);
    ctx.fillStyle = '#2a2e40';
    ctx.fillRect(bx - hw - 1.5, top - 1, hw * 2 + 3, 2.2);
    ctx.fillStyle = 'rgba(255,255,255,0.24)';
    ctx.fillRect(bx - hw - 1.5, top - 1, hw * 2 + 3, 0.6);
  };
  // Main gun turret: armoured gunhouse facing the target, tapered barrels that recoil,
  // a directional muzzle flash and a puff of smoke after each shot.
  const turret = (tx, ty, sz, n) => {
    const a = clamp(aim, -Math.PI + 0.2, -0.2);
    const face = Math.cos(a) < 0 ? -1 : 1;
    const fired = ship.flash >= 0 ? time - ship.flash : 9;
    const recoil = fired < 0.25 ? (1 - fired / 0.25) * 5 : 0;
    const len = 30;
    const px0 = face * 7, py0 = -8.5;
    const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(sz, sz);
    // barbette ring, sunk into the deck so the gun sits on the ship
    const rg = ctx.createLinearGradient(-13, 0, 13, 0);
    rg.addColorStop(0, '#262a3c');
    rg.addColorStop(0.4, '#4c5470');
    rg.addColorStop(1, '#22263a');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.moveTo(-12, -3.5); ctx.lineTo(12, -3.5); ctx.lineTo(13.5, 3); ctx.lineTo(-13.5, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(-12, -3.5, 24, 0.8);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-13.5, 1.8, 27, 1.2);
    // barrels
    const tips = [];
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 2.7;
      const bx0 = px0 + nx * off - ca * recoil, by0 = py0 + ny * off - sa * recoil;
      const ex = bx0 + ca * len, ey = by0 + sa * len;
      tips.push([ex + ca * recoil, ey + sa * recoil]);
      const w0 = 1.75, w1 = 1.15;
      const bg = ctx.createLinearGradient(bx0 + nx * w0, by0 + ny * w0, bx0 - nx * w0, by0 - ny * w0);
      bg.addColorStop(0, '#6a7290');
      bg.addColorStop(1, '#1c202c');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(bx0 + nx * w0, by0 + ny * w0);
      ctx.lineTo(ex + nx * w1, ey + ny * w1);
      ctx.lineTo(ex - nx * w1, ey - ny * w1);
      ctx.lineTo(bx0 - nx * w0, by0 - ny * w0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#14171f';
      ctx.beginPath();
      ctx.moveTo(ex + nx * 1.6 - ca * 2, ey + ny * 1.6 - sa * 2);
      ctx.lineTo(ex + nx * 1.6, ey + ny * 1.6);
      ctx.lineTo(ex - nx * 1.6, ey - ny * 1.6);
      ctx.lineTo(ex - nx * 1.6 - ca * 2, ey - ny * 1.6 - sa * 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4c5160';
      ctx.beginPath(); ctx.arc(bx0 + ca * 2.5, by0 + sa * 2.5, 2.1, 0, TAU); ctx.fill();
    }
    // armoured gunhouse, sloped face towards the target
    ctx.save();
    ctx.scale(-face, 1);
    const g = ctx.createLinearGradient(0, -16, 0, -3);
    g.addColorStop(0, '#9099b4');
    g.addColorStop(0.45, '#5e6786');
    g.addColorStop(1, '#343a52');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(13, -3.5); ctx.lineTo(13, -12.5); ctx.lineTo(7, -16); ctx.lineTo(-9, -16); ctx.lineTo(-14.5, -10.5); ctx.lineTo(-13.5, -3.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,226,196,0.16)';
    ctx.beginPath(); ctx.moveTo(-9, -16); ctx.lineTo(-14.5, -10.5); ctx.lineTo(-13.5, -3.5); ctx.lineTo(-8, -3.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(-9, -16, 16, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(-13.5, -5.5, 26.5, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 6; i++) ctx.fillRect(-10 + i * 4, -9, 0.8, 0.8);
    ctx.fillStyle = '#3a4058';
    rr(ctx, 1, -18.6, 4.4, 2.8, 0.8); ctx.fill();
    rr(ctx, -6, -18.6, 4.4, 2.8, 0.8); ctx.fill();
    ctx.fillStyle = '#9fd8ff';
    ctx.fillRect(-6.4, -17.8, 0.9, 1.1);
    ctx.fillRect(0.6, -17.8, 0.9, 1.1);
    if (n >= 3) {
      ctx.fillStyle = '#2e3346';
      ctx.fillRect(11.5, -11.5, 4.5, 1.8);
      ctx.fillRect(-17.5, -11.5, 4.5, 1.8);
    }
    ctx.restore();
    // muzzle flash along the barrel, then a drifting smoke puff
    if (SPRITES && fired < 0.16) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const [ex, ey] of tips) {
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(a);
        ctx.globalAlpha = 1 - fired / 0.16;
        ctx.drawImage(SPRITES.fire, -2, -7, 30, 14);
        ctx.drawImage(SPRITES.flash, -6, -6, 12, 12);
        ctx.restore();
      }
      ctx.restore();
    }
    if (SPRITES && fired < 0.9) {
      const k = fired / 0.9;
      for (const [ex, ey] of tips) {
        const r = 5 + k * 14;
        ctx.globalAlpha = 0.5 * (1 - k);
        ctx.drawImage(SPRITES.puff, ex + ca * k * 10 - r, ey + sa * k * 10 - r - k * 8, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };

  const drawBody = () => {
  // superstructure (behind the hull's deck line)
  if (type === 'battleship') {
    block(-46, -42, 88, 25);
    block(-24, -70, 36, 29);
    bridge(-20, -66, 30);
    windows(-40, -34, 9, 8);
    windows(-18, -56, 4, 7);
    funnel(20, -62, -42);
    mast(-6, -108, -70);
    flagLine(-6, -106, -112, -27);
    flagLine(-6, -106, 108, -40);
    block(48, -30, 26, 13);
    lifeboat(-42, -46);
    lifeboat(24, -46);
    ciws(40, -42);
    ciws(-17, -70);
    searchlight(8, -70);
    aaGun(-36, -42);
    aaGun(30, -42);
    aaGun(60, -30);
    barbette(-64, -42, 15, -14);
    turret(-64, -42, 1.05, 3);
  } else if (type === 'cruiser') {
    block(-38, -36, 72, 19);
    block(-18, -60, 30, 25);
    bridge(-15, -56, 24);
    windows(-32, -30, 7, 8);
    funnel(14, -52, -36);
    mast(-3, -94, -60);
    flagLine(-3, -92, -92, -27);
    lifeboat(-34, -40);
    ciws(26, -36);
    searchlight(8, -60);
    aaGun(-28, -36);
    // missile launcher: a box on a trunnion mount bolted to the deck
    const mg = ctx.createLinearGradient(43, 0, 58, 0);
    mg.addColorStop(0, '#3a405a');
    mg.addColorStop(0.5, '#6a7290');
    mg.addColorStop(1, '#3a405a');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.moveTo(41, -14); ctx.lineTo(45, -26); ctx.lineTo(55, -26); ctx.lineTo(59, -14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(45, -26, 10, 0.8);
    ctx.save();
    ctx.translate(50, -26);
    ctx.rotate(-0.5);
    const lg = ctx.createLinearGradient(0, -11, 0, 0);
    lg.addColorStop(0, '#6a7290');
    lg.addColorStop(1, '#3c4258');
    ctx.fillStyle = lg;
    rr(ctx, -8, -11, 28, 11, 2);
    ctx.fill();
    ctx.fillStyle = '#20232e';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(18, -8.6 + i * 3.4, 1.4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#d23b3b';
    ctx.fillRect(-6, -10, 2, 9);
    ctx.restore();
    ctx.fillStyle = '#2a2e3e';
    ctx.beginPath(); ctx.arc(50, -26, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a92ae';
    ctx.beginPath(); ctx.arc(50, -26, 1.3, 0, TAU); ctx.fill();
  } else {
    block(-32, -32, 54, 15);
    block(-24, -52, 24, 20);
    bridge(-22, -49, 20);
    funnel(6, -48, -32);
    mast(-12, -78, -52);
    flagLine(-12, -76, -74, -24);
    lifeboat(-28, -36);
    ciws(14, -32);
    aaGun(-26, -32);
  }

  // hull with flared bow, plating and boot topping
  const hullPath = () => {
    ctx.beginPath();
    ctx.moveTo(-L - 10, -26);
    ctx.quadraticCurveTo(-L * 0.6, -18, 0, -17);
    ctx.lineTo(L - 4, -17);
    ctx.lineTo(L + 2, -15);
    ctx.lineTo(L - 6, 5);
    ctx.lineTo(-L + 26, 5);
    ctx.quadraticCurveTo(-L + 2, -4, -L - 10, -26);
    ctx.closePath();
  };
  const hull = ctx.createLinearGradient(0, -26, 0, 6);
  hull.addColorStop(0, '#78809e');
  hull.addColorStop(0.45, '#4a5170');
  hull.addColorStop(1, '#22263a');
  ctx.fillStyle = hull;
  hullPath();
  ctx.fill();
  ctx.save();
  hullPath();
  ctx.clip();
  const camo = [
    ['rgba(18,22,38,0.3)', [[-0.85, -30], [-0.5, -30], [-0.72, 10], [-1.1, 10]]],
    ['rgba(205,214,238,0.14)', [[-0.32, -30], [-0.08, -30], [-0.26, 10], [-0.52, 10]]],
    ['rgba(18,22,38,0.26)', [[0.08, -30], [0.5, -30], [0.26, 10], [-0.06, 10]]],
    ['rgba(205,214,238,0.12)', [[0.62, -30], [0.92, -30], [0.8, 10], [0.5, 10]]],
  ];
  for (const [col, pts] of camo) {
    ctx.fillStyle = col;
    ctx.beginPath();
    pts.forEach(([fx0, fy0], i) => (i ? ctx.lineTo(fx0 * L, fy0) : ctx.moveTo(fx0 * L, fy0)));
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let px = -L + 4; px < L; px += 16) { ctx.moveTo(px, -20); ctx.lineTo(px, 5); }
  ctx.moveTo(-L - 10, -6); ctx.lineTo(L, -6);
  ctx.stroke();
  const shine = ctx.createLinearGradient(-L, 0, L, 0);
  shine.addColorStop(0, 'rgba(255,220,190,0.12)');
  shine.addColorStop(0.4, 'rgba(0,0,0,0)');
  shine.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = shine;
  ctx.fillRect(-L - 12, -30, L * 2 + 16, 40);
  ctx.restore();
  ctx.fillStyle = '#16181f';
  ctx.fillRect(-L + 18, 0, L * 2 - 22, 1.2);
  ctx.fillStyle = '#8a2f2f';
  ctx.beginPath(); ctx.moveTo(-L + 19, 1.2); ctx.lineTo(L - 4.8, 1.2); ctx.lineTo(L - 6, 5); ctx.lineTo(-L + 26, 5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2e3346';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-L - 10, -25); ctx.quadraticCurveTo(-L * 0.6, -17, 0, -16); ctx.lineTo(L + 2, -14); ctx.stroke();
  ctx.strokeStyle = 'rgba(220,226,255,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-L - 10, -26.2); ctx.quadraticCurveTo(-L * 0.6, -18.2, 0, -17.2); ctx.lineTo(L + 2, -15.2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-L - 4, -20); ctx.quadraticCurveTo(-L * 0.6, -13, 0, -12.5); ctx.lineTo(L - 2, -12); ctx.stroke();
  railing(ctx, -L * 0.75, L - 6, -17.5);
  if (!sink && ship.layer === 'mid') {
    [-0.55, -0.18, 0.42].forEach((f, i) => {
      const run = ship.hit ? Math.sin(time * 3 + i * 2 + ship.seed) * 12 : Math.sin(time * 0.6 + i * 2 + ship.seed) * 3;
      deckSailor(ctx, f * L + run, -17.5, time * (ship.hit ? 10 : 2) + i);
    });
  }
  // anchor and hawse pipe
  ctx.fillStyle = '#16181f';
  ctx.beginPath(); ctx.arc(-L + 2, -15, 2, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2a2e3a';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-L + 2, -13); ctx.lineTo(-L + 2, -7); ctx.moveTo(-L - 1, -8); ctx.quadraticCurveTo(-L + 2, -5, -L + 5, -8); ctx.stroke();
  ctx.fillStyle = lit;
  for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc(-L * 0.42 + i * L * 0.12, -10, 1.2, 0, TAU); ctx.fill(); }
  ctx.font = '900 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillText(ship.num, -L + 21, -9);
  ctx.fillStyle = 'rgba(240,244,255,0.88)';
  ctx.fillText(ship.num, -L + 20, -10);

  // turrets on deck, flag at the stern
  if (type === 'battleship') { turret(-96, -18, 1.2, 3); turret(86, -17, 1.2, 3); }
  else if (type === 'cruiser') { turret(-72, -18, 1.1, 2); turret(80, -17, 0.85, 2); }
  else turret(-56, -18, 0.95, 1);
  ctx.strokeStyle = '#2a2e3e';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(L - 4, -17); ctx.lineTo(L - 4, -40); ctx.stroke();
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(L - 4, -40);
  for (let i = 0; i <= 6; i++) ctx.lineTo(L - 4 + i * 2.4, -40 + Math.sin(time * 6 + i * 0.9) * 1.2);
  ctx.lineTo(L - 4 + 14.4, -32 + Math.sin(time * 6 + 5.4) * 1.2);
  for (let i = 6; i >= 0; i--) ctx.lineTo(L - 4 + i * 2.4, -32 + Math.sin(time * 6 + i * 0.9) * 1.2);
  ctx.closePath();
  ctx.fill();

  if ((ship.hit || sink > 0) && SPRITES) {
    // fires on deck: flames rise, shrink and flicker
    const spots = sink > 0 ? [-0.7, -0.42, -0.14, 0.14, 0.42, 0.7] : [-0.32, 0.36];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    spots.forEach((sp, i) => {
      const fx0 = sp * L;
      for (let k = 0; k < 4; k++) {
        const u = ((k + time * 1.8 + i * 0.37) % 4) / 4;
        const r = (sink > 0 ? 14 : 10) * (1 - u * 0.55);
        const fy = -20 - u * (sink > 0 ? 36 : 26);
        ctx.globalAlpha = (1 - u) * 0.95;
        ctx.drawImage(SPRITES.fire, fx0 - r + Math.sin(time * 6 + k + i) * 2, fy - r, r * 2, r * 2);
      }
    });
    ctx.restore();
  }
  };

  const bob = Math.sin(time * 0.9 + ship.seed) * 0.012;
  ctx.save();
  if (sink > 0) {
    // the sea hides everything below the waterline as she goes down
    ctx.beginPath(); ctx.rect(x - 400 * s, y - 400 * s, 800 * s, 403 * s); ctx.clip();
  }
  if (ship.breaks && sink > 0) {
    // she snaps in two: both halves rise into a V as the break goes under
    const bx = L * 0.08;
    const th = Math.min(0.75, sink * 0.95);
    const gap = sink * 9;
    const drop = sink * 70;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(x + (bx + side * gap) * s, y + drop * s);
      ctx.rotate(-side * th + bob);
      ctx.translate(-bx * s, 0);
      ctx.scale(s, s);
      ctx.beginPath();
      if (side < 0) ctx.rect(-L - 60, -220, L + 60 + bx, 280);
      else ctx.rect(bx, -220, L + 80, 280);
      ctx.clip();
      drawBody();
      // the torn, dark inside of the hull
      ctx.fillStyle = '#120e14';
      ctx.beginPath();
      ctx.moveTo(bx, -28);
      for (let j = 0; j <= 8; j++) ctx.lineTo(bx + side * (5 + (j % 2 ? 2.5 : -1.5)), -28 + j * 4.25);
      ctx.lineTo(bx, 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,150,60,0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
    // fire and glowing steel where she broke
    if (SPRITES) {
      const bxw = x + bx * s, byw = y + drop * s - 14 * s;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 6; k++) {
        const u = ((k + time * 2.2) % 6) / 6;
        const r = (22 - u * 12) * s;
        ctx.globalAlpha = (1 - u) * 0.95;
        ctx.drawImage(SPRITES.fire, bxw - r + Math.sin(time * 5 + k) * 3 * s, byw - u * 60 * s - r, r * 2, r * 2);
      }
      ctx.restore();
    }
  } else {
    const pivot = L * 0.55;
    ctx.translate(x + pivot * s, y + sink * s * 62);
    ctx.rotate(-sink * 0.34 + bob);
    ctx.translate(-pivot * s, 0);
    ctx.scale(s, s);
    drawBody();
  }
  ctx.restore();

  if (sink > 0 && sink < 1.25 && SPRITES) {
    const fade = 1 - sink / 1.25;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // churning foam where she goes under, burning oil spreading on the water
    ctx.fillStyle = `rgba(235,242,255,${0.5 * fade})`;
    ctx.beginPath(); ctx.ellipse(L * 0.3, 2.5, L * (1 - sink * 0.5), 3.5, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const ox = -L * 0.6 + i * L * 0.3 + Math.sin(time * 2 + i) * 4;
      const r = 10 + Math.sin(time * 8 + i * 1.7) * 3;
      ctx.globalAlpha = 0.8 * fade;
      ctx.drawImage(SPRITES.fire, ox - r, -r * 1.2, r * 2, r * 1.7);
    }
    ctx.restore();
  }

  if (sink === 0) {
    // bow wave and a V-shaped wake
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(-L - 6, 1);
    ctx.quadraticCurveTo(-L - 20, 4 + Math.sin(time * 5) * 1.5, -L + 30, 5.5);
    ctx.lineTo(-L + 30, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-L + 4, 4.4, L * 2 - 8, 1.6);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(L - 4, 4); ctx.quadraticCurveTo(L + 40, 3, L + 90 + Math.sin(time * 2) * 6, 1);
    ctx.moveTo(L - 4, 5); ctx.quadraticCurveTo(L + 40, 8, L + 90 + Math.sin(time * 2.3) * 6, 10);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    for (let i = 0; i < 6; i++) {
      const wx = L + 8 + i * 14 + Math.sin(time * 3 + i) * 2;
      ctx.beginPath(); ctx.ellipse(wx, 5, 5 - i * 0.5, 1.2, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

// Flight-deck crew member. Feet at (x, y), about 14 units tall. Jersey colour shows the job.
function drawCrew(ctx, x, y, jersey, pose, t, flip = false) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.scale(0.7, 0.7);
  const INK = 'rgba(8,10,18,0.9)';
  const seg = (pts, wdt, col) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [lw, c] of [[wdt + 1.6, INK], [wdt, col]]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
    }
  };
  const crouch = pose === 'point' ? 2.5 : pose === 'kneel' ? 4 : 0;
  const lean = pose === 'point' ? 0.35 : pose === 'kneel' ? 0.15 : 0;
  const hipY = -9 + crouch;

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 0.6, 6, 1.4, 0, 0, TAU); ctx.fill();

  // legs and boots
  const pants = '#2c3040';
  if (pose === 'kneel') {
    seg([[0, hipY], [-3.5, -2], [-7, 0]], 2.8, pants);
    seg([[0, hipY], [3.5, -4.5], [3, 0]], 2.8, pants);
  } else if (pose === 'point') {
    seg([[0, hipY], [3.4, -3.6], [2.6, 0]], 2.8, pants);
    seg([[0, hipY], [-2.4, -3.2], [-4.4, 0]], 2.8, pants);
  } else {
    seg([[0, hipY], [1, -4.5], [1.3, 0]], 2.8, pants);
    seg([[0, hipY], [-1, -4.5], [-1.3, 0]], 2.8, pants);
  }
  ctx.fillStyle = '#16181e';
  if (pose !== 'kneel') { rr(ctx, -3.8, -1.6, 3.6, 1.9, 0.8); ctx.fill(); }
  rr(ctx, pose === 'point' ? 1.4 : 0.2, -1.6, 3.8, 1.9, 0.8); ctx.fill();

  // torso: jersey, flotation vest with reflective tape, belt
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(lean);
  const sh = [0, -7.5];
  ctx.fillStyle = INK;
  rr(ctx, -4.2, -9.2, 8.4, 10, 2.6); ctx.fill();
  ctx.fillStyle = jersey;
  rr(ctx, -3.4, -8.4, 6.8, 8.6, 2.2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  rr(ctx, -3.6, -7.4, 7.2, 5.6, 1.6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(-3.4, -5.4, 6.8, 0.8);
  ctx.fillRect(-3.4, -3.6, 6.8, 0.8);
  ctx.fillStyle = '#20232c';
  ctx.fillRect(-3.4, -0.9, 6.8, 1.2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(1.4, -8, 1.4, 6);

  // arms
  const sleeve = jersey;
  if (pose === 'wave') {
    const sw = Math.sin(t * 5) * 0.5;
    for (const side of [1, -1]) {
      const a1 = -Math.PI / 2 + side * (0.55 + sw * side * 0.4);
      const el = [sh[0] + side * 3 + Math.cos(a1) * 4, sh[1] + Math.sin(a1) * 4];
      const a2 = a1 - side * 0.35;
      const hd = [el[0] + Math.cos(a2) * 3.8, el[1] + Math.sin(a2) * 3.8];
      seg([[sh[0] + side * 3, sh[1]], el, hd], 2.2, sleeve);
      // glowing marshalling wands
      const wx = hd[0] + Math.cos(a2) * 5, wy = hd[1] + Math.sin(a2) * 5;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,170,60,0.45)';
      ctx.lineWidth = 3.6;
      ctx.beginPath(); ctx.moveTo(hd[0], hd[1]); ctx.lineTo(wx, wy); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = '#ffd27a';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(hd[0], hd[1]); ctx.lineTo(wx, wy); ctx.stroke();
    }
  } else if (pose === 'point') {
    seg([[sh[0] + 2.5, sh[1]], [sh[0] + 6.5, sh[1] - 1.8], [sh[0] + 10.5, sh[1] - 3.6]], 2.2, sleeve);
    seg([[sh[0] - 2.5, sh[1]], [sh[0] - 4.5, sh[1] + 3.5], [sh[0] - 4, sh[1] + 7]], 2.2, sleeve);
    ctx.fillStyle = '#f2f2f2';
    ctx.beginPath(); ctx.arc(sh[0] + 11, sh[1] - 3.8, 1.2, 0, TAU); ctx.fill();
  } else if (pose === 'kneel') {
    seg([[sh[0] + 2.5, sh[1]], [sh[0] + 5.5, sh[1] + 3], [sh[0] + 8.5, sh[1] + 5]], 2.2, sleeve);
    seg([[sh[0] - 2.5, sh[1]], [sh[0] - 1, sh[1] + 4], [sh[0] + 2, sh[1] + 6]], 2.2, sleeve);
  } else {
    seg([[sh[0] + 3, sh[1]], [sh[0] + 3.8, sh[1] + 4], [sh[0] + 4, sh[1] + 7.5]], 2.2, sleeve);
    seg([[sh[0] - 3, sh[1]], [sh[0] - 3.8, sh[1] + 4], [sh[0] - 3.4, sh[1] + 7.5]], 2.2, sleeve);
    ctx.fillStyle = '#e8ecf4';
    rr(ctx, sh[0] + 3, sh[1] + 3, 4, 5, 0.6); ctx.fill();
  }

  // head: cranial helmet, goggles, ear defenders
  const hx = 0.4, hy = -11.2;
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(hx, hy, 3.3, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d9a27a';
  ctx.beginPath(); ctx.arc(hx, hy, 2.6, 0, TAU); ctx.fill();
  ctx.fillStyle = jersey;
  ctx.beginPath(); ctx.arc(hx, hy - 0.2, 2.7, Math.PI * 0.95, Math.PI * 2.05); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.arc(hx + 0.6, hy - 1.6, 0.9, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1c2028';
  ctx.fillRect(hx - 0.6, hy - 0.6, 3.4, 1.4);
  ctx.fillStyle = '#9fd8ff';
  ctx.fillRect(hx + 1.6, hy - 0.4, 1, 0.8);
  ctx.fillStyle = '#20232c';
  ctx.beginPath(); ctx.arc(hx - 1.3, hy + 0.2, 1.2, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function towTractor(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 0.5, 12, 1.6, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, -8, 0, -2);
  g.addColorStop(0, '#ffd166');
  g.addColorStop(1, '#c99a2a');
  ctx.fillStyle = g;
  rr(ctx, -10, -7, 20, 5.5, 1.5);
  ctx.fill();
  ctx.fillStyle = '#20232c';
  ctx.fillRect(-10, -2.2, 20, 1);
  for (const wx of [-6.5, 6.5]) {
    ctx.fillStyle = '#16181e';
    ctx.beginPath(); ctx.arc(wx, -1.6, 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6a7080';
    ctx.beginPath(); ctx.arc(wx, -1.6, 1, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = '#30343f';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(16, -3); ctx.stroke();
  ctx.fillStyle = Math.sin(t * 6) > 0 ? '#ffb347' : '#6a4a1a';
  ctx.fillRect(-8, -8.6, 2, 1.6);
  drawCrew(ctx, -1, -6.5, '#3a7bd5', 'stand', t);
  ctx.restore();
}

// Allied carrier, bow pointing right. Flight deck top at y=-33. jetLx: where our jet sits.
function drawCarrier(ctx, x, y, s, time, night, prog, jetLx) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const lit = mix('#2a3044', '#ffd27a', 0.35 + night * 0.65);
  reflection(ctx, -188, 206, 8, 40, 0.45);

  // hull
  const hullPath = () => {
    ctx.beginPath();
    ctx.moveTo(-200, -25);
    ctx.lineTo(212, -25);
    ctx.quadraticCurveTo(222, -10, 205, 8);
    ctx.lineTo(-184, 8);
    ctx.lineTo(-196, -6);
    ctx.closePath();
  };
  const hull = ctx.createLinearGradient(0, -26, 0, 8);
  hull.addColorStop(0, '#79819c');
  hull.addColorStop(0.55, '#4a5068');
  hull.addColorStop(1, '#23273a');
  ctx.fillStyle = hull;
  hullPath();
  ctx.fill();
  ctx.save();
  hullPath();
  ctx.clip();
  const sideL = ctx.createLinearGradient(-200, 0, 220, 0);
  sideL.addColorStop(0, 'rgba(0,0,0,0.28)');
  sideL.addColorStop(0.6, 'rgba(0,0,0,0)');
  sideL.addColorStop(1, 'rgba(255,215,180,0.14)');
  ctx.fillStyle = sideL;
  ctx.fillRect(-210, -30, 440, 40);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let i = -180; i < 215; i += 20) { ctx.moveTo(i, -24); ctx.lineTo(i, 7); }
  ctx.moveTo(-200, -9); ctx.lineTo(220, -9);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#14161d';
  ctx.fillRect(-188, 1.6, 396, 1.2);
  ctx.fillStyle = '#8a2f2f';
  ctx.beginPath(); ctx.moveTo(-189, 2.8); ctx.lineTo(209, 2.8); ctx.lineTo(205, 8); ctx.lineTo(-184, 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = lit;
  for (let i = 0; i < 18; i++) ctx.fillRect(-170 + i * 20, -16, 4, 2.4);
  // anchor
  ctx.fillStyle = '#14161d';
  ctx.beginPath(); ctx.arc(198, -17, 2.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2a2e3a';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(198, -15); ctx.lineTo(198, -7); ctx.moveTo(194, -8.5); ctx.quadraticCurveTo(198, -5, 202, -8.5); ctx.stroke();
  ctx.font = '900 19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillText('07', 177, -10);
  ctx.fillStyle = 'rgba(244,246,255,0.92)';
  ctx.fillText('07', 176, -11);

  // sponsons and catwalks under the deck edge
  for (const [sx, sw] of [[-198, 34], [-64, 44], [118, 36]]) {
    ctx.fillStyle = '#41475c';
    ctx.fillRect(sx, -27, sw, 7);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(sx, -21, sw, 1.4);
    railing(ctx, sx, sx + sw, -27, 3);
  }

  // flight deck slab with overhang and non-skid surface
  ctx.fillStyle = '#2b2f3c';
  ctx.beginPath(); ctx.moveTo(-216, -33); ctx.lineTo(234, -33); ctx.lineTo(229, -25); ctx.lineTo(-211, -25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(-211, -25, 440, 2.2);
  const dg = ctx.createLinearGradient(0, -35, 0, -31);
  dg.addColorStop(0, '#585e70');
  dg.addColorStop(1, '#353a48');
  ctx.fillStyle = dg;
  ctx.fillRect(-216, -35, 450, 3.4);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 90; i++) ctx.fillRect(-214 + hash(i, 301) * 446, -34.6 + hash(i, 302) * 2.6, 0.9, 0.5);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(-216, -35.4, 450, 0.7);
  for (let i = -200; i < 225; i += 22) ctx.fillRect(i, -33.9, 11, 0.9);
  // catapult track and shuttle
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(jetLx - 10, -32.4, 238 - jetLx, 0.9);
  ctx.fillStyle = '#1a1c24';
  ctx.fillRect(jetLx + 26, -33.2, 4, 1.6);
  // deck edge lights
  for (let i = 0; i < 22; i++) {
    const on = Math.sin(time * 6 - i * 0.6) > 0.2;
    ctx.fillStyle = i % 2 ? (on ? '#7fb8ff' : '#2a3a5a') : (on ? '#ffd27a' : '#5a4a2a');
    ctx.beginPath(); ctx.arc(-200 + i * 20, -31, 1.2, 0, TAU); ctx.fill();
  }

  // jet blast deflector raises behind our jet on the catapult
  if (prog !== null) {
    const th = 0.15 + 0.95 * easeOut(Math.min(1, prog * 3));
    const hx = jetLx - 34, hy = -35;
    const ex = hx - Math.cos(th) * 22, ey = hy - Math.sin(th) * 22;
    ctx.strokeStyle = '#2a2e3a';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(hx - 12, hy); ctx.lineTo((hx + ex) / 2, (hy + ey) / 2); ctx.stroke();
    const jg = ctx.createLinearGradient(hx, hy, ex, ey);
    jg.addColorStop(0, '#4a5064');
    jg.addColorStop(1, '#7a8298');
    ctx.strokeStyle = jg;
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.6;
    for (let k = 1; k < 5; k++) {
      const u = k / 5;
      ctx.beginPath(); ctx.moveTo(hx + (ex - hx) * u - 1.4, hy + (ey - hy) * u + 0.6); ctx.lineTo(hx + (ex - hx) * u + 1.4, hy + (ey - hy) * u - 0.6); ctx.stroke();
    }
  }

  // island: two tiers, bridge, pri-fly, radar panels, mast
  const isl = (bx, by, bw, bh) => {
    const g = ctx.createLinearGradient(0, by, 0, by + bh);
    g.addColorStop(0, '#727a96');
    g.addColorStop(1, '#3c4258');
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw, bh);
    const sg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    sg.addColorStop(0, 'rgba(0,0,0,0.25)');
    sg.addColorStop(0.4, 'rgba(0,0,0,0)');
    sg.addColorStop(1, 'rgba(255,220,190,0.12)');
    ctx.fillStyle = sg;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(bx, by, bw, 1.4);
  };
  isl(-128, -78, 48, 43);
  isl(-120, -102, 34, 25);
  isl(-114, -112, 22, 11);
  ctx.fillStyle = '#14202e';
  ctx.beginPath(); ctx.moveTo(-122, -98); ctx.lineTo(-84, -98); ctx.lineTo(-86, -91); ctx.lineTo(-120, -91); ctx.closePath(); ctx.fill();
  ctx.fillStyle = mix('#5aa8d8', '#ffd27a', night, 0.8);
  for (let i = 0; i < 8; i++) ctx.fillRect(-119 + i * 4.2, -96.8, 3, 4.6);
  ctx.fillStyle = mix('#3a4a66', '#ffd27a', night, 0.7);
  for (let i = 0; i < 4; i++) ctx.fillRect(-112 + i * 4.8, -109.6, 3.4, 3.4);
  // phased-array panels
  ctx.fillStyle = '#8a94ae';
  for (const [px0, py0] of [[-118, -72], [-98, -72]]) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + Math.PI / 8; ctx.lineTo(px0 + 7 + Math.cos(a) * 7, py0 + 7 + Math.sin(a) * 7); }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  ctx.fillStyle = lit;
  for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) ctx.fillRect(-124 + i * 8.8, -54 + r * 9, 4, 2.4);
  ctx.font = '900 9px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(244,246,255,0.9)';
  ctx.fillText('07', -90, -62);
  // lattice mast with radars
  ctx.strokeStyle = '#3c4258';
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(-108, -112); ctx.lineTo(-103, -146); ctx.lineTo(-98, -112); ctx.stroke();
  ctx.lineWidth = 0.7;
  for (let k = 1; k < 5; k++) { const yy = -112 - k * 7; const wd = 5 * (1 - k / 5); ctx.beginPath(); ctx.moveTo(-103 - wd, yy); ctx.lineTo(-103 + wd, yy - 6); ctx.stroke(); }
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-116, -134); ctx.lineTo(-90, -134); ctx.moveTo(-111, -124); ctx.lineTo(-95, -124); ctx.stroke();
  ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(-90, -134); ctx.lineTo(-86, -150); ctx.moveTo(-116, -134); ctx.lineTo(-118, -146); ctx.stroke();
  const rw = 13 * Math.abs(Math.cos(time * 1.8));
  ctx.fillStyle = '#a3acc6';
  ctx.fillRect(-103 - Math.max(1, rw), -142, Math.max(2, rw * 2), 2.6);
  ctx.fillStyle = '#eef1f8';
  ctx.beginPath(); ctx.arc(-112, -129, 3.2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(-94, -129, 2.6, 0, TAU); ctx.fill();
  ctx.fillStyle = Math.sin(time * 3) > 0 ? '#ff4040' : '#4a1414';
  ctx.beginPath(); ctx.arc(-103, -148, 2, 0, TAU); ctx.fill();
  // exhaust stack and flag
  ctx.fillStyle = '#30343f';
  ctx.fillRect(-84, -86, 6, 8);
  ctx.fillStyle = '#ff8a3d';
  ctx.beginPath();
  ctx.moveTo(-90, -134);
  for (let i = 0; i <= 6; i++) ctx.lineTo(-90 + i * 2.6, -134 + Math.sin(time * 6 + i) * 1.3);
  for (let i = 6; i >= 0; i--) ctx.lineTo(-90 + i * 2.6, -126 + Math.sin(time * 6 + i) * 1.3);
  ctx.closePath();
  ctx.fill();

  // parked jets, a tow tractor and the deck crew
  drawFighter(ctx, -188, -44.5, 36, 0, 0, PARKED, false, { gear: true, t: time });
  drawFighter(ctx, -150, -44.5, 36, 0, 0, PARKED, false, { gear: true, t: time + 1 });
  towTractor(ctx, -104, -35, time);
  drawCrew(ctx, -176, -35, '#9b6bff', 'stand', time);
  drawCrew(ctx, -136, -35, '#ff5a5a', 'kneel', time, true);
  drawCrew(ctx, -76, -35, '#f2f2f2', 'stand', time);
  if (prog !== null) {
    drawCrew(ctx, jetLx + 52, -35, '#ffd166', 'wave', time, true);
    drawCrew(ctx, jetLx + 30, -35, '#59e39a', prog > 0.7 ? 'point' : 'stand', time);
    if (prog < 0.6) drawCrew(ctx, jetLx - 2, -35, '#ff5a5a', 'kneel', time);
  }
  ctx.restore();
}

// An ejected pilot: seat rocket first, then a striped parachute swinging down to the sea.
function drawChute(ctx, c, h, time) {
  const open = clamp((c.t - 0.55) / 0.35, 0, 1);
  const s = h * 0.0016;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(open > 0 ? Math.sin(time * 2 + c.seed) * 0.22 * open : c.t * 6);
  ctx.scale(s, s);
  if (open < 1 && c.t < 0.35) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,190,90,0.85)';
    ctx.beginPath(); ctx.moveTo(-3, 6); ctx.lineTo(0, 22 + Math.random() * 8); ctx.lineTo(3, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (open > 0) {
    const cw = 26 * open, top = -52;
    ctx.strokeStyle = 'rgba(30,30,40,0.7)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (const lx of [-cw, -cw * 0.4, cw * 0.4, cw]) { ctx.moveTo(0, -6); ctx.lineTo(lx, top + 6); }
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a0 = Math.PI + (i / 6) * Math.PI, a1 = Math.PI + ((i + 1) / 6) * Math.PI;
      ctx.fillStyle = i % 2 ? '#f2f4f8' : '#e0413a';
      ctx.beginPath();
      ctx.moveTo(0, top + 8);
      ctx.ellipse(0, top + 8, cw, 16 * open, 0, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(0, top + 8, cw, 3 * open, 0, 0, TAU); ctx.fill();
  }
  // pilot in a flight suit with a helmet
  ctx.strokeStyle = '#4a5a3a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const kick = Math.sin(time * 6 + c.seed) * 2;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-2 + kick * 0.3, 9);
  ctx.moveTo(0, 0); ctx.lineTo(2 - kick * 0.3, 9);
  ctx.moveTo(0, 0); ctx.lineTo(0, -8);
  ctx.moveTo(0, -7); ctx.lineTo(-4, open > 0 ? -12 : -3 + kick);
  ctx.moveTo(0, -7); ctx.lineTo(4, open > 0 ? -12 : -3 - kick);
  ctx.stroke();
  ctx.fillStyle = '#3a3a42';
  ctx.beginPath(); ctx.arc(0, -11, 3.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff7070';
  ctx.fillRect(0.5, -12, 2.6, 1.6);
  if (open === 0) {
    ctx.fillStyle = '#2a2d36';
    rr(ctx, -5, -2, 10, 7, 1.5);
    ctx.fill();
  }
  ctx.restore();
}

// Floating wreckage after a sinking: ring buoys, crates and a life raft with survivors.
function drawFloat(ctx, p, k, time) {
  const bobY = Math.sin(time * 2.2 + p.seed) * p.r * 0.15;
  ctx.save();
  ctx.translate(p.x, p.y + bobY);
  ctx.globalAlpha = Math.min(1, (1 - k) * 3);
  if (p.what === 'buoy') {
    ctx.rotate(Math.sin(time * 1.5 + p.seed) * 0.2);
    ctx.lineWidth = p.r * 0.45;
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = i % 2 ? '#f2f4f8' : '#ff6a2a';
      ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.45, 0, (i / 4) * TAU, ((i + 1) / 4) * TAU); ctx.stroke();
    }
  } else if (p.what === 'crate') {
    ctx.rotate(Math.sin(time * 1.3 + p.seed) * 0.15 + p.seed);
    ctx.fillStyle = '#8a6438';
    ctx.fillRect(-p.r, -p.r * 0.8, p.r * 2, p.r * 1.3);
    ctx.strokeStyle = '#5a3e20';
    ctx.lineWidth = Math.max(1, p.r * 0.15);
    ctx.strokeRect(-p.r, -p.r * 0.8, p.r * 2, p.r * 1.3);
    ctx.beginPath(); ctx.moveTo(-p.r, -p.r * 0.8); ctx.lineTo(p.r, p.r * 0.5); ctx.stroke();
  } else {
    // life raft: orange tube, canopy, two survivors waving
    ctx.fillStyle = '#ff7a2a';
    ctx.beginPath(); ctx.ellipse(0, 0, p.r * 2.2, p.r * 0.55, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c95a1a';
    ctx.beginPath(); ctx.ellipse(0, p.r * 0.15, p.r * 1.8, p.r * 0.3, 0, 0, TAU); ctx.fill();
    for (const ox of [-0.8, 0.7]) {
      const wv = Math.sin(time * 6 + ox * 3) * 0.5;
      ctx.strokeStyle = '#1d2a4a';
      ctx.lineWidth = Math.max(1, p.r * 0.28);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ox * p.r, -p.r * 0.2); ctx.lineTo(ox * p.r, -p.r * 1.1);
      ctx.moveTo(ox * p.r, -p.r * 0.9); ctx.lineTo(ox * p.r + p.r * 0.6, -p.r * (1.7 + wv));
      ctx.stroke();
      ctx.fillStyle = '#e2b08c';
      ctx.beginPath(); ctx.arc(ox * p.r, -p.r * 1.35, p.r * 0.25, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f2f4f8';
      ctx.fillRect(ox * p.r - p.r * 0.25, -p.r * 1.65, p.r * 0.5, p.r * 0.12);
    }
  }
  ctx.restore();
}

/* ───────── Obstacles ───────── */

function drawBalloon(ctx, b, h, time, night) {
  const r = b.r;
  const by = b.y + Math.sin(time * 1.2 + b.seed) * r * 0.08;
  ctx.strokeStyle = 'rgba(25,22,35,0.6)';
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.beginPath(); ctx.moveTo(b.x - r * 0.2, by + r * 0.55); ctx.quadraticCurveTo(b.x - r * 0.7, (by + h) / 2, b.x - r * 1.3, h + 10); ctx.stroke();
  ctx.save();
  ctx.translate(b.x, by);
  ctx.rotate(Math.sin(time * 0.8 + b.seed) * 0.05);
  ctx.fillStyle = mix('#8d95a8', '#4a5068', night);
  for (const fy of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(r * 0.9, fy * r * 0.15); ctx.lineTo(r * 1.95, fy * r * 0.78); ctx.lineTo(r * 2.05, fy * r * 0.18); ctx.closePath(); ctx.fill();
  }
  const g = ctx.createLinearGradient(0, -r * 0.65, 0, r * 0.65);
  g.addColorStop(0, mix('#eef0f5', '#8a93b0', night));
  g.addColorStop(1, mix('#6f768a', '#2c3248', night));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.55, r * 0.62, 0, 0, TAU); ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(220,60,60,0.85)';
  ctx.fillRect(r * 0.3, -r, r * 0.2, r * 2);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.32, r * 0.7, r * 0.12, -0.05, 0, TAU); ctx.fill();
  if (Math.sin(time * 5 + b.seed) > 0.4) {
    ctx.fillStyle = 'rgba(255,60,60,0.35)';
    ctx.beginPath(); ctx.arc(-r * 1.5, 0, r * 0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff5050';
    ctx.beginPath(); ctx.arc(-r * 1.5, 0, r * 0.1, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// Surface-to-air missile: white body, red fins, bright exhaust.
function drawSam(ctx, m, h) {
  const a = Math.atan2(m.vy, m.vx);
  const k = (h * 0.05) / 24;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(a);
  ctx.scale(k, k);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const fl = 8 + Math.random() * 6;
  const g = ctx.createRadialGradient(-12, 0, 0, -12, 0, fl);
  g.addColorStop(0, 'rgba(255,250,220,1)');
  g.addColorStop(0.4, 'rgba(255,170,80,0.8)');
  g.addColorStop(1, 'rgba(255,90,40,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(-12, 0, fl, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#f1f3f7';
  rr(ctx, -12, -2, 24, 4, 1.8);
  ctx.fill();
  ctx.fillStyle = '#d23b3b';
  ctx.beginPath(); ctx.moveTo(11.5, -2); ctx.quadraticCurveTo(17, 0, 11.5, 2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-12, -2); ctx.lineTo(-15, -6); ctx.lineTo(-8, -2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-12, 2); ctx.lineTo(-15, 6); ctx.lineTo(-8, 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9aa2b4';
  ctx.beginPath(); ctx.moveTo(2, -2); ctx.lineTo(0, -4); ctx.lineTo(-2, -2); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ───────── Scenery ───────── */

// Soft shapes rendered once to offscreen canvases, then stamped every frame.
let SPRITES = null;
let RIM = 'rgba(255,200,144,0.55)';
const CLOUD_DUSK = { shadow: '#6e4478', lit: '#ec9488', rim: '#ffd6ae' };
const CLOUD_NIGHT = { shadow: '#121836', lit: '#263262', rim: '#56669e' };

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function softBlob(g, x, y, r, col, a) {
  const gr = g.createRadialGradient(x, y, r * 0.15, x, y, r);
  gr.addColorStop(0, mix(col, col, 0, a));
  gr.addColorStop(0.6, mix(col, col, 0, a * 0.85));
  gr.addColorStop(1, mix(col, col, 0, 0));
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

// Fade a sprite out towards its bottom (flat cloud bases) and its sides.
function fadeEdges(g, W, H, bottom = 0.78, sides = 0.08) {
  g.globalCompositeOperation = 'destination-in';
  const v = g.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, 'rgba(0,0,0,1)');
  v.addColorStop(bottom, 'rgba(0,0,0,1)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  const hz = g.createLinearGradient(0, 0, W, 0);
  hz.addColorStop(0, 'rgba(0,0,0,0)');
  hz.addColorStop(sides, 'rgba(0,0,0,1)');
  hz.addColorStop(1 - sides, 'rgba(0,0,0,1)');
  hz.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = hz;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
}

function cumulusSprite(seed, pal) {
  const W = 512, H = 240;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const n = 9 + Math.floor(hash(seed, 1) * 5);
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const hump = Math.sin(Math.PI * u);
    const r = H * (0.14 + hump * 0.2) * (0.75 + hash(seed, i + 30) * 0.5);
    const x = W * (0.12 + u * 0.76) + (hash(seed, i + 10) - 0.5) * 30;
    const y = H * 0.7 - hump * H * 0.26 * (0.6 + hash(seed, i + 50) * 0.6);
    puffs.push([x, y, r]);
  }
  for (const [x, y, r] of puffs) softBlob(g, x, y + r * 0.12, r * 1.05, pal.shadow, 0.95);
  for (const [x, y, r] of puffs) softBlob(g, x + r * 0.2, y - r * 0.22, r * 0.78, pal.lit, 0.85);
  for (const [x, y, r] of puffs) softBlob(g, x + r * 0.32, y - r * 0.36, r * 0.5, pal.rim, 0.28);
  fadeEdges(g, W, H, 0.74, 0.02);
  return c;
}

function stratusSprite(pal) {
  const W = 900, H = 90;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = W * (i + 0.5) / 26 + (hash(i, 61) - 0.5) * 20;
    const r = H * (0.25 + hash(i, 62) * 0.25);
    softBlob(g, x, H * 0.6, r, pal.shadow, 0.9);
    softBlob(g, x + r * 0.2, H * 0.5, r * 0.7, pal.lit, 0.7);
  }
  fadeEdges(g, W, H, 0.7, 0.12);
  return c;
}

function cirrusSprite(pal) {
  const W = 600, H = 80;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  for (let i = 0; i < 18; i++) {
    const x = W * (0.08 + 0.84 * hash(i, 71)), y = H * (0.3 + 0.4 * hash(i, 72));
    const rx = W * (0.07 + 0.12 * hash(i, 73)), ry = H * (0.1 + 0.12 * hash(i, 74));
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    softBlob(g, 0, 0, rx, i % 3 ? pal.lit : pal.rim, 0.5);
    g.restore();
  }
  fadeEdges(g, W, H, 0.95, 0.15);
  return c;
}

function smokeSprite(col, a) {
  const S = 128;
  const c = makeCanvas(S, S), g = c.getContext('2d');
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * TAU, d = i ? S * 0.14 : 0;
    softBlob(g, S / 2 + Math.cos(ang) * d, S / 2 + Math.sin(ang) * d, S * (i ? 0.3 : 0.42), col, a);
  }
  return c;
}

function glowSprite(stops) {
  const S = 128;
  const c = makeCanvas(S, S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  return c;
}

function buildSprites() {
  const pair = (fn) => [fn(CLOUD_DUSK), fn(CLOUD_NIGHT)];
  return {
    clouds: [0, 1, 2, 3, 4, 5].map((s) => pair((p) => cumulusSprite(s + 1, p))),
    stratus: pair(stratusSprite),
    cirrus: pair(cirrusSprite),
    smoke: smokeSprite('#241c30', 0.85),
    smokeLit: smokeSprite('#d27c6a', 0.7),
    puff: smokeSprite('#eef0f8', 0.75),
    fire: glowSprite([[0, 'rgba(255,255,240,1)'], [0.2, 'rgba(255,230,140,0.95)'], [0.45, 'rgba(255,140,50,0.7)'], [0.75, 'rgba(220,60,20,0.25)'], [1, 'rgba(160,30,10,0)']]),
    flash: glowSprite([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,240,200,0.7)'], [1, 'rgba(255,200,120,0)']]),
  };
}

// Smooth value noise for mountain ridges.
function vnoise(x) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i, 151), hash(i + 1, 151), u);
}

// A distant mountain range, hazy with distance and rim-lit by the sun.
function drawRange(ctx, w, h, horizon, scroll, f, height, night, sunA, seed) {
  const top = mix(seed ? '#8a5480' : '#a6688e', seed ? '#161c42' : '#1e2550', night);
  const bot = mix(seed ? '#c47c88' : '#d89090', seed ? '#24285a' : '#2c2f62', night);
  const g = ctx.createLinearGradient(0, horizon - height, 0, horizon);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  const pts = [];
  for (let x = -10; x <= w + 10; x += 4) {
    const wx = (x + scroll * f) / h + seed * 17;
    const env = clamp((vnoise(wx * 1.1 + 3) - 0.28) * 2.4, 0, 1);
    const y = horizon - height * env * (0.5 * vnoise(wx * 3.5) + 0.32 * vnoise(wx * 10 + 7) + 0.18 * vnoise(wx * 27 + 2));
    pts.push([x, y]);
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-10, horizon + 1);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(w + 10, horizon + 1);
  ctx.closePath();
  ctx.fill();
  if (sunA > 0.1) {
    ctx.strokeStyle = `rgba(255,196,150,${0.4 * sunA})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    let pen = false;
    for (const [x, y] of pts) {
      if (y < horizon - 1.5) { if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y); pen = true; } else pen = false;
    }
    ctx.stroke();
  }
}

// A smoke plume whose puffs rise, grow and drift with the wind.
function drawPlume(ctx, SP, bx, by, hgt, time, seed, h, sunA) {
  const N = 16;
  for (let k = 0; k < N; k++) {
    const u = ((k + time * 0.4 + seed * 3.1) % N) / N;
    const yy = by - u * hgt;
    const xx = bx - u * u * h * 0.14 + Math.sin(time * 0.5 + k + seed) * h * 0.008 * u;
    const r = h * (0.016 + u * 0.075);
    const a = Math.min(1, u * 10) * (1 - u) * 0.9;
    ctx.globalAlpha = a;
    ctx.drawImage(SP.smoke, xx - r, yy - r, r * 2, r * 2);
    if (sunA > 0.1) {
      ctx.globalAlpha = a * 0.4 * sunA;
      ctx.drawImage(SP.smokeLit, xx - r * 0.4, yy - r * 1.1, r * 1.5, r * 1.5);
    }
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const fr = h * (0.025 + Math.random() * 0.006);
  const fg = ctx.createRadialGradient(bx, by, 0, bx, by, fr);
  fg.addColorStop(0, 'rgba(255,220,150,0.9)');
  fg.addColorStop(0.4, 'rgba(255,130,50,0.55)');
  fg.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.arc(bx, by, fr, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawGull(ctx, x, y, s, flap, col) {
  const wy = Math.sin(flap) * s * 0.55;
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(1, s * 0.2);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s, y - wy);
  ctx.quadraticCurveTo(x - s * 0.45, y - s * 0.5 - wy * 0.3, x, y);
  ctx.quadraticCurveTo(x + s * 0.45, y - s * 0.5 - wy * 0.3, x + s, y - wy);
  ctx.stroke();
}

function drawIslands(ctx, w, h, horizon, scroll, f, layer, night, time) {
  const seg = w * (layer ? 0.5 : 0.36);
  const off = scroll * f;
  const k0 = Math.floor((off - w * 0.3) / seg), k1 = Math.floor((off + w * 1.3) / seg);
  const topC = layer ? mix('#4a2f5e', '#141a38', night) : mix('#6a4070', '#1c2246', night);
  const botC = layer ? mix('#7a4a6a', '#1e2244', night) : mix('#a0587a', '#262a50', night);
  for (let k = k0; k <= k1; k++) {
    if (hash(k, 70 + layer) < 0.45) continue;
    const iw = seg * (0.5 + hash(k, 73 + layer) * 0.5);
    const cx = k * seg - off + seg * 0.5;
    const ih = h * (layer ? 0.06 : 0.035) * (0.5 + hash(k, 74 + layer));
    const g = ctx.createLinearGradient(0, horizon - ih, 0, horizon);
    g.addColorStop(0, topC);
    g.addColorStop(1, botC);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - iw / 2, horizon + 1);
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const bump = Math.pow(Math.sin(Math.PI * u), 1.3) * (0.75 + 0.25 * Math.sin(u * 11 + k * 3));
      ctx.lineTo(cx - iw / 2 + u * iw, horizon - ih * bump);
    }
    ctx.lineTo(cx + iw / 2, horizon + 1);
    ctx.closePath();
    ctx.fill();
    if (layer && hash(k, 76) > 0.55) {
      // lighthouse
      const lx = cx + iw * 0.18, ly = horizon - ih * 0.8;
      ctx.fillStyle = mix('#e8e2d8', '#7c7f96', night);
      ctx.fillRect(lx - 2, ly - h * 0.03, 4, h * 0.03);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(lx - 2, ly - h * 0.02, 4, h * 0.005);
      if (night > 0.2) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const a = time * 1.4 + k;
        const bl = h * 0.25;
        const bg = ctx.createLinearGradient(lx, ly - h * 0.03, lx + Math.cos(a) * bl, ly - h * 0.03);
        bg.addColorStop(0, `rgba(255,240,190,${0.35 * night})`);
        bg.addColorStop(1, 'rgba(255,240,190,0)');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(lx, ly - h * 0.03);
        ctx.lineTo(lx + Math.cos(a) * bl, ly - h * 0.03 - h * 0.015);
        ctx.lineTo(lx + Math.cos(a) * bl, ly - h * 0.03 + h * 0.015);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath(); ctx.arc(lx, ly - h * 0.032, 1.8, 0, TAU); ctx.fill();
    }
  }
}

/* ───────── HUD icons ───────── */

function jetIcon(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 8 * s, y); ctx.lineTo(x - 6 * s, y - 2 * s); ctx.lineTo(x - 8 * s, y - 6 * s); ctx.lineTo(x - 10 * s, y - 6 * s);
  ctx.lineTo(x - 9 * s, y); ctx.lineTo(x - 2 * s, y + 6 * s); ctx.lineTo(x + 1 * s, y + 6 * s); ctx.lineTo(x - 1 * s, y + 1 * s);
  ctx.closePath();
  ctx.fill();
}
function shipIcon(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x - 10 * s, y); ctx.lineTo(x + 10 * s, y); ctx.lineTo(x + 8 * s, y + 4 * s); ctx.lineTo(x - 8 * s, y + 4 * s); ctx.closePath(); ctx.fill();
  ctx.fillRect(x - 3 * s, y - 5 * s, 6 * s, 5 * s);
  ctx.fillRect(x - 1 * s, y - 9 * s, 2 * s, 4 * s);
}
function missileIcon(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  rr(ctx, x - 8 * s, y - 1.6 * s, 14 * s, 3.2 * s, 1.5 * s);
  ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 6 * s, y - 1.6 * s); ctx.lineTo(x + 10 * s, y); ctx.lineTo(x + 6 * s, y + 1.6 * s); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 8 * s, y); ctx.lineTo(x - 10 * s, y - 4 * s); ctx.lineTo(x - 5 * s, y); ctx.lineTo(x - 10 * s, y + 4 * s); ctx.closePath(); ctx.fill();
}

/* ───────── Scene ───────── */

export function createJetScene() {
  let time = 0, scroll = 0, speed = 0, night = 0;
  let lastPhase = null, lastRound = -1, crashTime = 0, crashPos = null, crashFrom = null, scrollAtStart = 0;
  const fx = particles();
  let ships = [], enemies = [], missiles = [], sams = [], balloons = [], wreck = null, contrail = [];
  let kills = { jets: 0, ships: 0, dodged: 0 };
  let nextEnemy = 2, nextFlak = 1, nextAttack = 1.5, nextShipMid = 0, nextShipFar = 0, nextSam = 3, nextBalloon = 2.5, nextBolt = 3;
  let jetY = 0, jetVy = 0, dodge = 0, shooter = 0;
  // Player steering: pointer position as fractions of the stage (null = autopilot).
  let pointer = null, jetXf = 0.3;
  const wing = { x: 0, y: 0, k: 0 };
  let flashT = -9, bolt = null;
  let SP = null, flashes = [], farJet = null, nextFarJet = 4, chutes = [];

  const resetWorld = (w) => {
    ships = [];
    enemies = [];
    missiles = [];
    sams = [];
    balloons = [];
    contrail = [];
    chutes = [];
    wreck = null;
    kills = { jets: 0, ships: 0, dodged: 0 };
    nextShipMid = scroll * 0.5 + w * 0.9;
    nextShipFar = scroll * 0.15 + w * 0.2;
  };

  return {
    // Mouse / touch steering. p = { x, y } as 0..1 of the stage, or null to let go.
    setPointer(p) { pointer = p; },
    draw(ctx, w, h, v, dt, reduced, mini) {
      time += dt;
      const horizon = h * 0.6;
      const jetSize = clamp(h * 0.15, 40, 110);
      const steering = v.phase === 'running' && v.tPhase >= 1.4 && pointer && !mini;
      if (v.phase === 'betting') jetXf = 0.3;
      else if (v.phase === 'running') {
        const goal = steering ? clamp(pointer.x, 0.1, 0.72) : 0.3;
        jetXf += (goal - jetXf) * Math.min(1, dt * (steering ? 5 : 1.2));
      }
      const px = w * jetXf;
      const deckY = h * 0.78;
      const running = v.phase === 'running';
      const crashed = v.phase === 'crashed';

      const shipPos = (s) => {
        const f = s.layer === 'far' ? 0.15 : 0.5;
        const y = s.layer === 'far' ? horizon + h * 0.025 : horizon + h * 0.16;
        const scl = s.layer === 'far' ? h * 0.0011 : h * 0.0024;
        return { x: s.x - scroll * f, y, s: scl };
      };
      const launcherOnScreen = () => ships.find((s) => s.layer === 'mid' && s.type === 'cruiser' && s.hp > 0 && shipPos(s).x > w * 0.45 && shipPos(s).x < w * 0.98);
      const launcherAt = (s) => { const p = shipPos(s); return [p.x + 58 * p.s, p.y - 30 * p.s]; };

      if (v.phase !== lastPhase || v.roundId !== lastRound) {
        if (running) {
          scrollAtStart = scroll;
          nextEnemy = 1.8; nextFlak = 1.4; nextAttack = 1.4; nextSam = 3; nextBalloon = 2.2; nextBolt = 2;
        }
        if (crashed && lastPhase === 'running') {
          crashTime = time;
          crashPos = [px, jetY];
          const l = launcherOnScreen();
          crashFrom = l ? launcherAt(l) : [px + w * 0.25, h + 10];
          boom(fx, px, jetY, h, 2.2);
          for (let i = 0; i < 8; i++) {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, sp = h * (0.3 + Math.random() * 0.5);
            fx.add({ kind: 'chunk', x: px, y: jetY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: h * 1.5, life: 3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16, r: h * (0.01 + Math.random() * 0.016), col: '#6a6f7e', floor: horizon + h * (0.08 + Math.random() * 0.3) });
          }
          wreck = { x: px, y: jetY, vx: w * 0.06, vy: -h * 0.15, rot: 0, vr: 3.2 };
          missiles = [];
          sams = [];
          contrail = [];
        }
        if (v.phase === 'betting') { fx.clear(); resetWorld(w); wing.k = 0; }
        lastPhase = v.phase;
        lastRound = v.roundId;
      }
      if (ships.length === 0 && enemies.length === 0 && nextShipMid === 0) resetWorld(w);

      // the battle runs from sunset into night as the multiplier climbs
      const nT = running ? clamp(Math.log(v.mult) / Math.log(25), 0, 1) : crashed ? night : 0;
      night = lerp(night, nT, Math.min(1, dt * (v.phase === 'betting' ? 1.5 : 0.8)));
      const n = night;

      const target = running ? w * (0.22 + 0.32 * clamp(Math.log(v.mult) / Math.log(10), 0, 1.8)) : 0;
      speed = lerp(speed, target, Math.min(1, dt * 2.5));
      scroll += speed * dt;
      const sinceStart = running ? scroll - scrollAtStart : 0;

      // player flight: off the deck, climb to cruise, then weave around obstacles
      const carrierS = h * 0.0034;
      const carrierRestX = w * 0.36;
      const deckJetY = deckY - 5.2 * carrierS - jetSize * 0.26;
      const cruise = h * 0.4 + Math.sin(time * 1.1) * h * 0.04;
      let pitch = -0.02;
      if (v.phase === 'betting') { jetY = deckJetY; jetVy = 0; dodge = 0; }
      else if (running) {
        if (v.tPhase < 1.4) {
          const ny = lerp(deckJetY, cruise, easeOut(v.tPhase / 1.4));
          jetVy = dt > 0 ? (ny - jetY) / dt : 0;
          jetY = ny;
          pitch = -0.35 * (1 - v.tPhase / 1.4);
        } else {
          let tgt = (steering ? pointer.y * h : cruise) + dodge;
          for (const b of balloons) {
            const dx = b.x - px;
            if (dx > -jetSize * 1.4 && dx < w * 0.45) tgt = Math.min(tgt, b.y - b.r * 0.9 - jetSize * 0.38);
          }
          tgt = clamp(tgt, h * 0.12, horizon - h * 0.1);
          jetVy += ((tgt - jetY) * 16 - jetVy * 6.5) * dt;
          jetY += jetVy * dt;
          pitch = clamp(jetVy / (w * 0.45 + 1), -0.4, 0.4);
        }
        dodge *= Math.exp(-dt * 1.4);
      }

      ctx.save();
      if (crashed && !reduced) {
        const k = 1 - clamp((time - crashTime) / 0.5, 0, 1);
        ctx.translate((Math.random() - 0.5) * h * 0.035 * k, (Math.random() - 0.5) * h * 0.035 * k);
      }

      /* sky */
      if (!SP) { SP = buildSprites(); SPRITES = SP; }
      RIM = mix('#ffc890', '#a8b8ff', n, 0.55);
      const spr = (pair, cx, cy, sw, sh, a) => {
        if (n < 0.99) { ctx.globalAlpha = a * (1 - n); ctx.drawImage(pair[0], cx - sw / 2, cy - sh / 2, sw, sh); }
        if (n > 0.01) { ctx.globalAlpha = a * n; ctx.drawImage(pair[1], cx - sw / 2, cy - sh / 2, sw, sh); }
        ctx.globalAlpha = 1;
      };
      const sg = ctx.createLinearGradient(0, 0, 0, horizon);
      for (let i = 0; i < 5; i++) sg.addColorStop(i / 4, mix(SKY_DUSK[i], SKY_NIGHT[i], n));
      ctx.fillStyle = sg;
      ctx.fillRect(-20, -20, w + 40, horizon + 20);

      const sunX = w * 0.78, sunR = h * 0.12, sunY = horizon + sunR * 0.25 + n * sunR * 1.5;
      const sunA = 1 - n * 0.85;
      const moonA = clamp((n - 0.3) / 0.4, 0, 1);
      const moonX = w * 0.64, moonY = h * 0.17, moonR = h * 0.045;

      // warm afterglow spreading along the horizon
      const ag = ctx.createRadialGradient(sunX, horizon, 0, sunX, horizon, w * 0.95);
      ag.addColorStop(0, `rgba(255,176,112,${0.4 * sunA})`);
      ag.addColorStop(0.45, `rgba(236,112,128,${0.14 * sunA})`);
      ag.addColorStop(1, 'rgba(236,112,128,0)');
      ctx.fillStyle = ag;
      ctx.fillRect(-20, -20, w + 40, horizon + 20);

      for (let i = 0; i < 80; i++) {
        const x = wrap(hash(i, 21) * w * 1.3 - scroll * 0.01, w * 1.3) - w * 0.15;
        const y = hash(i, 22) * horizon * 0.7;
        const tw = 0.5 + 0.5 * Math.sin(time * (1.5 + hash(i, 23) * 2) + i);
        const a = (0.12 + n * 0.85) * (0.4 + 0.6 * tw) * (1 - y / (horizon * 0.8));
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        const sz = 1 + hash(i, 24) * 1.3;
        ctx.fillRect(x, y, sz, sz);
      }

      // moon rises as the sun sets
      if (moonA > 0) {
        const mg = ctx.createRadialGradient(moonX, moonY, moonR * 0.5, moonX, moonY, moonR * 5);
        mg.addColorStop(0, `rgba(200,212,255,${0.4 * moonA})`);
        mg.addColorStop(1, 'rgba(200,212,255,0)');
        ctx.fillStyle = mg;
        ctx.beginPath(); ctx.arc(moonX, moonY, moonR * 5, 0, TAU); ctx.fill();
        const md = ctx.createRadialGradient(moonX - moonR * 0.3, moonY - moonR * 0.3, 0, moonX, moonY, moonR);
        md.addColorStop(0, `rgba(250,252,255,${moonA})`);
        md.addColorStop(1, `rgba(200,208,235,${moonA})`);
        ctx.fillStyle = md;
        ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(160,170,205,${0.45 * moonA})`;
        for (const [cx2, cy2, cr] of [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [0.05, 0.45, 0.12], [0.4, -0.35, 0.09]]) {
          ctx.beginPath(); ctx.arc(moonX + cx2 * moonR, moonY + cy2 * moonR, cr * moonR, 0, TAU); ctx.fill();
        }
      }

      // soft sun rays fading out with distance
      if (sunA > 0.15) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI / 2 + (i - 4) * 0.27 + Math.sin(time * 0.12 + i * 1.3) * 0.04;
          const L = h * (0.55 + hash(i, 31) * 0.35);
          const half = 0.025 + hash(i, 32) * 0.03;
          const rg = ctx.createRadialGradient(sunX, horizon, sunR * 0.5, sunX, horizon, L);
          rg.addColorStop(0, `rgba(255,214,170,${0.14 * sunA})`);
          rg.addColorStop(1, 'rgba(255,214,170,0)');
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.moveTo(sunX, horizon);
          ctx.lineTo(sunX + Math.cos(a - half) * L, horizon + Math.sin(a - half) * L);
          ctx.lineTo(sunX + Math.cos(a + half) * L, horizon + Math.sin(a + half) * L);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // high cirrus streaks
      for (let i = 0; i < 5; i++) {
        const span = w * 2;
        const cx = wrap(hash(i, 141) * span - scroll * 0.025 - time * 3, span) - w * 0.5;
        const cy = h * (0.05 + hash(i, 142) * 0.18);
        const cw = w * (0.4 + hash(i, 143) * 0.35);
        spr(SP.cirrus, cx, cy, cw, cw * 0.13, 0.7);
      }

      // sun with a corona and thin cloud bands drifting across it, sinking as night falls
      ctx.save();
      ctx.beginPath(); ctx.rect(-20, -20, w + 40, horizon + 20); ctx.clip();
      const cor = ctx.createRadialGradient(sunX, sunY, sunR * 0.9, sunX, sunY, sunR * 2.8);
      cor.addColorStop(0, `rgba(255,232,185,${0.6 * sunA})`);
      cor.addColorStop(1, 'rgba(255,150,90,0)');
      ctx.fillStyle = cor;
      ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 2.8, 0, TAU); ctx.fill();
      const sd = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
      sd.addColorStop(0, '#fff6d8');
      sd.addColorStop(0.6, '#ffc27a');
      sd.addColorStop(1, '#ff8a52');
      ctx.fillStyle = sd;
      ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, TAU); ctx.fill();
      for (let k = 0; k < 3; k++) spr(SP.cirrus, sunX + Math.sin(time * 0.07 + k * 2) * sunR * 0.4, horizon - sunR * (0.2 + k * 0.3), sunR * 4.6, sunR * 0.32, 0.85);
      ctx.restore();

      // distant mountains and a low cloud bank on the horizon
      drawRange(ctx, w, h, horizon, scroll, 0.012, h * 0.11, n, sunA, 0);
      {
        const span = w * 1.3;
        const off = wrap(scroll * 0.02 + time * 2, span);
        for (let k = -1; k <= 1; k++) spr(SP.stratus, k * span - off + span / 2, horizon - h * 0.03, span * 1.05, h * 0.075, 0.7);
      }

      // cumulus: a far hazy layer low down, a big mid layer higher up
      for (let i = 0; i < 6; i++) {
        const span = w * 1.8;
        const cx = wrap(hash(i, 161) * span - scroll * 0.05 - time * 2, span) - w * 0.4;
        const cy = horizon - h * (0.08 + hash(i, 162) * 0.12);
        const cw = h * (0.24 + hash(i, 163) * 0.18);
        spr(SP.clouds[i % 6], cx, cy, cw, cw * 0.47, 0.6);
      }
      for (let i = 0; i < 5; i++) {
        const span = w * 2;
        const cx = wrap(hash(i, 171) * span - scroll * 0.14 - time * 4, span) - w * 0.5;
        const cy = h * (0.12 + hash(i, 172) * 0.2);
        const cw = h * (0.42 + hash(i, 173) * 0.35);
        spr(SP.clouds[(i + 2) % 6], cx, cy, cw, cw * 0.47, 0.95);
      }

      // a far-off battle flickers on the horizon
      flashes = flashes.filter((f) => time - f.t0 < 0.7);
      if (!reduced && Math.random() < dt * (0.35 + n * 1.2 + (running ? 0.5 : 0))) flashes.push({ x: w * (0.05 + Math.random() * 0.9), t0: time, s: 0.5 + Math.random() });
      if (flashes.length) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const f of flashes) {
          const k = (time - f.t0) / 0.7;
          const a = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9;
          const r = h * 0.1 * f.s * (0.6 + k * 0.6);
          const fg = ctx.createRadialGradient(f.x, horizon - 2, 0, f.x, horizon - 2, r);
          fg.addColorStop(0, `rgba(255,222,160,${0.55 * a})`);
          fg.addColorStop(1, 'rgba(255,140,60,0)');
          ctx.fillStyle = fg;
          ctx.beginPath(); ctx.arc(f.x, horizon - 2, r, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }

      // a far formation of jets crossing high up
      nextFarJet -= dt;
      if (!farJet && nextFarJet <= 0) farJet = { t0: time, y: h * (0.07 + Math.random() * 0.12), dir: Math.random() < 0.5 ? 1 : -1, sp: w * (0.08 + Math.random() * 0.05) };
      if (farJet) {
        const tt = time - farJet.t0;
        const lead = farJet.dir > 0 ? -w * 0.1 + tt * farJet.sp : w * 1.1 - tt * farJet.sp;
        const col = mix('#3a2a4a', '#0a0e22', n, 0.85);
        for (let i = 0; i < 3; i++) {
          const fx0 = lead - farJet.dir * i * h * 0.035;
          const fy = farJet.y + (i === 0 ? 0 : (i === 1 ? -1 : 1) * h * 0.014);
          const cg = ctx.createLinearGradient(fx0, fy, fx0 - farJet.dir * w * 0.12, fy);
          cg.addColorStop(0, 'rgba(255,240,235,0.4)');
          cg.addColorStop(1, 'rgba(255,240,235,0)');
          ctx.strokeStyle = cg;
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(fx0 - farJet.dir * h * 0.008, fy); ctx.lineTo(fx0 - farJet.dir * w * 0.12, fy); ctx.stroke();
          ctx.save();
          ctx.translate(fx0, fy);
          if (farJet.dir < 0) ctx.scale(-1, 1);
          jetIcon(ctx, 0, 0, h * 0.0011, col);
          ctx.restore();
        }
        if (lead < -w * 0.3 || lead > w * 1.4) { farJet = null; nextFarJet = 8 + Math.random() * 8; }
      }

      // lightning in the night storm
      if (running && n > 0.55 && !reduced) {
        nextBolt -= dt;
        if (nextBolt <= 0) {
          nextBolt = 2.5 + Math.random() * 4;
          flashT = time;
          let bx = w * (0.1 + Math.random() * 0.8), byy = h * 0.06;
          bolt = [[bx, byy]];
          while (byy < h * 0.38) { bx += (Math.random() - 0.5) * h * 0.08; byy += h * (0.03 + Math.random() * 0.04); bolt.push([bx, byy]); }
          sfx.thunder();
        }
      }
      if (time - flashT < 0.25) {
        const k = 1 - (time - flashT) / 0.25;
        ctx.fillStyle = `rgba(200,210,255,${0.28 * k})`;
        ctx.fillRect(-20, -20, w + 40, horizon + 20);
        if (bolt) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineJoin = 'round';
          for (const [lw, col] of [[h * 0.012, `rgba(150,170,255,${0.4 * k})`], [h * 0.003, `rgba(255,255,255,${k})`]]) {
            ctx.strokeStyle = col;
            ctx.lineWidth = lw;
            ctx.beginPath();
            bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // enemy searchlights sweep the night sky
      if (n > 0.12) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const span = w * 1.5;
          const bx = wrap(hash(i, 61) * span - scroll * 0.15, span) - w * 0.2;
          const a = -Math.PI / 2 + Math.sin(time * (0.35 + i * 0.1) + i * 2) * 0.55;
          const L = h * 0.75;
          const ex = bx + Math.cos(a) * L, ey = horizon + Math.sin(a) * L;
          const bg = ctx.createLinearGradient(bx, horizon, ex, ey);
          bg.addColorStop(0, `rgba(220,230,255,${0.2 * n})`);
          bg.addColorStop(1, 'rgba(220,230,255,0)');
          ctx.fillStyle = bg;
          ctx.beginPath();
          ctx.moveTo(bx - 2, horizon);
          ctx.lineTo(ex + Math.cos(a + Math.PI / 2) * h * 0.05, ey + Math.sin(a + Math.PI / 2) * h * 0.05);
          ctx.lineTo(ex - Math.cos(a + Math.PI / 2) * h * 0.05, ey - Math.sin(a + Math.PI / 2) * h * 0.05);
          ctx.lineTo(bx + 2, horizon);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // smoke rising from burning ships beyond the horizon
      for (let i = 0; i < 3; i++) {
        const span = w * 1.7;
        const bx = wrap(hash(i, 51) * span - scroll * 0.06, span) - w * 0.25;
        drawPlume(ctx, SP, bx, horizon - 2, h * (0.24 + hash(i, 52) * 0.18), time, i, h, sunA);
      }

      drawIslands(ctx, w, h, horizon, scroll, 0.03, 0, n, time);
      drawIslands(ctx, w, h, horizon, scroll, 0.07, 1, n, time);

      // haze where the sky meets the sea
      const hz = ctx.createLinearGradient(0, horizon - h * 0.08, 0, horizon);
      hz.addColorStop(0, mix('#ffa88a', '#2a2f66', n, 0));
      hz.addColorStop(1, mix('#ffb48e', '#2a2f66', n, 0.4));
      ctx.fillStyle = hz;
      ctx.fillRect(-20, horizon - h * 0.08, w + 40, h * 0.08);

      // seagulls circle the carrier before launch
      const gullA = v.phase === 'betting' ? 1 : running ? clamp(1 - v.tPhase / 4, 0, 1) : 0;
      if (gullA > 0) {
        ctx.globalAlpha = gullA;
        for (let i = 0; i < 6; i++) {
          const gx = w * (0.45 + 0.24 * Math.sin(time * 0.18 + i * 1.3)) - (running ? sinceStart * 0.5 : 0);
          const gy = h * (0.28 + 0.08 * Math.sin(time * 0.33 + i * 2.1));
          drawGull(ctx, gx, gy, h * 0.011 * (0.7 + hash(i, 181) * 0.6), time * 7 + i * 1.7, mix('#2c2236', '#0c1024', n));
        }
        ctx.globalAlpha = 1;
      }

      /* ocean */
      const og = ctx.createLinearGradient(0, horizon, 0, h);
      og.addColorStop(0, mix(SEA_DUSK[0], SEA_NIGHT[0], n));
      og.addColorStop(0.3, mix(SEA_DUSK[1], SEA_NIGHT[1], n));
      og.addColorStop(1, mix(SEA_DUSK[2], SEA_NIGHT[2], n));
      ctx.fillStyle = og;
      ctx.fillRect(-20, horizon, w + 40, h - horizon + 20);
      // the sky mirrored near the horizon, and a warm haze line
      const sr = ctx.createLinearGradient(0, horizon, 0, horizon + (h - horizon) * 0.4);
      sr.addColorStop(0, mix('#ff9f7a', '#3a3a78', n, 0.4));
      sr.addColorStop(1, mix('#ff9f7a', '#3a3a78', n, 0));
      ctx.fillStyle = sr;
      ctx.fillRect(-20, horizon, w + 40, (h - horizon) * 0.4);
      const hg = ctx.createLinearGradient(0, horizon - h * 0.02, 0, horizon + h * 0.03);
      hg.addColorStop(0, 'rgba(255,170,120,0)');
      hg.addColorStop(0.4, `rgba(255,190,140,${0.4 * (1 - n) + 0.1})`);
      hg.addColorStop(1, 'rgba(255,170,120,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(-20, horizon - h * 0.02, w + 40, h * 0.05);

      // rolling swells: a shaded trough under each lit crest, bigger towards the viewer
      const crestCol = (a) => mix('#ffc6a0', '#9aa8e8', n, a);
      const rows = 17;
      for (let j = 0; j < rows; j++) {
        const u = (j + 0.6) / rows;
        const yy = horizon + (h - horizon) * Math.pow(u, 1.55);
        const amp = 0.4 + u * u * h * 0.0065;
        const wl = h * (0.05 + u * 0.24);
        const f = 0.15 + u * 0.95;
        const ph = ((scroll * f + time * 16 * (0.4 + u)) / wl) * TAU + j * 1.7;
        const step = Math.max(3, wl / 26);
        const pts = [];
        for (let x = -12; x <= w + 12; x += step) {
          pts.push([x, yy + Math.sin((x / wl) * TAU - ph) * amp + Math.sin((x / (wl * 0.37)) * TAU - ph * 1.3) * amp * 0.35]);
        }
        const depth = 2 + (h - horizon) * 0.045 * u;
        ctx.beginPath();
        pts.forEach(([x, y2], i) => (i ? ctx.lineTo(x, y2) : ctx.moveTo(x, y2)));
        ctx.lineTo(w + 12, yy + depth);
        ctx.lineTo(-12, yy + depth);
        ctx.closePath();
        ctx.fillStyle = `rgba(4,6,22,${0.08 + u * 0.14})`;
        ctx.fill();
        ctx.beginPath();
        pts.forEach(([x, y2], i) => (i ? ctx.lineTo(x, y2) : ctx.moveTo(x, y2)));
        ctx.strokeStyle = crestCol(0.1 + u * 0.22);
        ctx.lineWidth = 0.6 + u * 1.6;
        ctx.stroke();
      }

      // sun and moon glitter paths
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let j = 0; j < 22; j++) {
        const u = j / 21;
        const yy = horizon + (h - horizon) * Math.pow(u, 1.5) + 2;
        const wdt = sunR * (0.5 + u * 1.5) * (0.7 + 0.3 * Math.sin(time * 3 + j));
        ctx.fillStyle = `rgba(255,180,110,${0.35 * (1 - u) * sunA})`;
        ctx.fillRect(sunX - wdt / 2 + Math.sin(time * 2 + j) * 4, yy, wdt, Math.max(1, 1 + u * 2));
      }
      for (let i = 0; i < 70; i++) {
        const u = Math.pow(hash(i, 201), 1.4);
        const yy = horizon + 3 + (h - horizon) * 0.9 * u;
        const tw = Math.sin(time * (3 + hash(i, 203) * 6) + i * 2.3);
        if (tw < 0.2) continue;
        const sx = sunA > 0.15 ? sunX : moonX;
        const amt = sunA > 0.15 ? sunA : moonA;
        if (amt <= 0) break;
        const spread = (sunA > 0.15 ? sunR : moonR * 1.6) * (0.4 + u * 2.2);
        const x = sx + (hash(i, 202) - 0.5) * spread * 2;
        const col = sunA > 0.15 ? '255,225,170' : '210,225,255';
        ctx.fillStyle = `rgba(${col},${0.7 * tw * amt * (1 - u * 0.6)})`;
        ctx.fillRect(x, yy, 2 + u * 9, 0.8 + u * 1.4);
      }
      ctx.restore();

      // whitecaps
      for (let i = 0; i < 30; i++) {
        const u = hash(i, 81);
        const yy = horizon + (h - horizon) * (0.12 + 0.88 * Math.pow(u, 1.2));
        const span = w * 1.4;
        const x = wrap(hash(i, 82) * span - scroll * (0.3 + u), span) - w * 0.2;
        const a = 0.35 * Math.max(0, Math.sin(time * 1.6 + i * 1.7));
        if (a <= 0.02) continue;
        const cw = h * 0.028 * (0.4 + u);
        ctx.fillStyle = `rgba(240,245,255,${a})`;
        ctx.beginPath(); ctx.ellipse(x, yy, cw, Math.max(0.8, cw * 0.14), 0, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(240,245,255,${a * 0.5})`;
        ctx.beginPath(); ctx.ellipse(x + cw * 0.9, yy + cw * 0.08, cw * 0.5, Math.max(0.6, cw * 0.1), 0, 0, TAU); ctx.fill();
      }

      /* enemy fleet */
      while (nextShipFar < scroll * 0.15 + w * 1.3) {
        const r = Math.random();
        ships.push({ layer: 'far', x: nextShipFar, type: r < 0.4 ? 'battleship' : r < 0.7 ? 'cruiser' : 'destroyer', hp: 99, sink: 0, flash: -1, nextFire: Math.random() * 3, seed: Math.random() * 10, num: String(10 + Math.floor(Math.random() * 89)) });
        nextShipFar += w * (0.35 + Math.random() * 0.4);
      }
      while (nextShipMid < scroll * 0.5 + w * 1.4) {
        const r = Math.random();
        const type = r < 0.4 ? 'battleship' : r < 0.72 ? 'cruiser' : 'destroyer';
        ships.push({ layer: 'mid', x: nextShipMid, type, hp: type === 'destroyer' ? 1 : 2, sink: 0, flash: -1, nextFire: 0.5 + Math.random() * 2, nextSmoke: 0, seed: Math.random() * 10, num: String(10 + Math.floor(Math.random() * 89)) });
        nextShipMid += w * (0.55 + Math.random() * 0.5);
      }
      ships = ships.filter((s) => shipPos(s).x > -w * 0.4 && s.sink < 1.2);
      for (const s of ships.filter((q) => q.layer === 'far')) {
        const p = shipPos(s);
        s.x -= w * 0.01 * dt;
        drawWarship(ctx, p.x, p.y, p.s, s, time, -Math.PI / 2 - 0.5 + Math.sin(time * 0.3 + s.seed) * 0.3, n);
        s.nextFire -= dt;
        if (s.nextFire < 0) { s.flash = time; s.nextFire = 1.5 + Math.random() * 3; }
      }
      for (const s of ships.filter((q) => q.layer === 'mid')) {
        const p = shipPos(s);
        s.x -= w * 0.02 * dt;
        if (s.hp <= 0) s.sink = Math.min(1.3, s.sink + dt * 0.35);
        const aim = running ? Math.atan2(jetY - (p.y - 30 * p.s), px - p.x) : -Math.PI / 2 - 0.5 + Math.sin(time * 0.3 + s.seed) * 0.3;
        drawWarship(ctx, p.x, p.y, p.s, s, time, aim, n);
        s.nextSmoke -= dt;
        if (s.hp > 0 && s.nextSmoke <= 0 && p.x > -w * 0.1 && p.x < w * 1.1) {
          s.nextSmoke = 0.12;
          const fxo = s.type === 'battleship' ? 30 : s.type === 'cruiser' ? 24 : 12;
          const fyo = s.type === 'battleship' ? 64 : s.type === 'cruiser' ? 54 : 50;
          fx.add({ kind: 'haze', x: p.x + fxo * p.s, y: p.y - fyo * p.s, vx: -h * 0.04 - speed * 0.2, vy: -h * 0.06, life: 1.6, r: h * 0.01 });
        }
        if (running && s.hp > 0 && p.x > 0 && p.x < w) {
          s.nextFire -= dt;
          if (s.nextFire < 0) {
            s.nextFire = 0.5 + Math.random() * 1.1;
            s.flash = time;
            const sx = p.x - 40 * p.s, sy = p.y - 40 * p.s;
            const ax = px + (Math.random() - 0.5) * h * 0.35, ay = jetY + (Math.random() - 0.3) * h * 0.25;
            const a = Math.atan2(ay - sy, ax - sx);
            for (let i = 0; i < 4; i++) fx.add({ kind: 'tracer', x: sx, y: sy, vx: Math.cos(a) * w * 1.1, vy: Math.sin(a) * w * 1.1, life: 0.5, delay: i * 0.05, color: '#ffb36b' });
          }
        }
        if ((s.hit || s.sink > 0) && Math.random() < (s.sink > 0 ? 0.7 : 0.35)) fx.add({ kind: 'smoke', x: p.x + (Math.random() - 0.5) * (s.sink > 0 ? 120 : 60) * p.s, y: p.y - 40 * p.s, vx: -h * 0.03 - speed * 0.5, vy: -h * 0.1, life: 2, r: h * 0.022 });
        if (s.sink > 0.3 && s.sink < 1.15 && Math.random() < 0.5) fx.add({ kind: 'steam', x: p.x + (Math.random() - 0.3) * 160 * p.s, y: p.y, vx: -speed * 0.5, vy: -h * 0.08, life: 1.4, r: h * 0.02 });
        if (s.sink > 0 && s.secondary > 0 && Math.random() < dt * 3) {
          s.secondary--;
          boom(fx, p.x + (Math.random() - 0.5) * 100 * p.s, p.y - 25 * p.s, h, 0.7);
          sfx.boom();
        }
      }

      /* allied carrier */
      const jetLx = (px - carrierRestX) / carrierS;
      const carrierX = carrierRestX - sinceStart;
      if (v.phase === 'betting' || (running && carrierX > -w && v.tPhase < 5)) {
        drawCarrier(ctx, carrierX, deckY + 30 * carrierS, carrierS, time, n, v.phase === 'betting' ? v.betProgress : 1, jetLx);
        if (v.phase === 'betting' && Math.random() < 0.3) {
          fx.add({ kind: 'steam', x: px + jetSize * (0.6 + Math.random() * 1.2), y: deckJetY + jetSize * 0.24, vx: -h * 0.04 * Math.random(), vy: -h * (0.03 + Math.random() * 0.05), life: 1, r: h * (0.006 + Math.random() * 0.01) });
        }
      }

      /* obstacles: barrage balloons the jet must climb over */
      if (running && !mini && v.tPhase > 2) {
        nextBalloon -= dt;
        if (nextBalloon <= 0) {
          nextBalloon = (3 + Math.random() * 3.5) / (1 + Math.log(v.mult) * 0.25);
          balloons.push({ x: w + jetSize * 2, y: h * (0.36 + Math.random() * 0.11), r: jetSize * (0.28 + Math.random() * 0.08), seed: Math.random() * 10 });
        }
      }
      for (const b of balloons) {
        b.x -= speed * dt;
        drawBalloon(ctx, b, h, time, n);
      }
      balloons = balloons.filter((b) => b.x > -jetSize * 3);

      /* enemy fighters, in formations */
      if (running && !mini) {
        nextEnemy -= dt;
        if (nextEnemy <= 0) {
          nextEnemy = (1.6 + Math.random() * 2.4) / (1 + Math.log(v.mult) * 0.35);
          const behind = v.mult > 1.6 && Math.random() < 0.22;
          const count = 1 + (Math.random() < 0.45 ? 1 : 0) + (v.mult > 3 && Math.random() < 0.35 ? 1 : 0);
          const y0 = behind ? h * (0.08 + Math.random() * 0.1) : h * (0.12 + Math.random() * 0.28);
          const vx = behind ? w * (0.45 + Math.random() * 0.2) : -w * (0.3 + Math.random() * 0.2);
          for (let i = 0; i < count; i++) {
            enemies.push({
              x: behind ? -80 - i * w * 0.07 : w + 60 + i * w * 0.07,
              y: y0 + i * h * 0.055,
              vx, behind,
              fire: 0.4 + Math.random() * 0.4,
              size: jetSize * (0.62 + Math.random() * 0.12),
              wob: Math.random() * 6, state: 'alive', rot: 0, vy: 0,
            });
          }
        }
      }
      for (const e of enemies) {
        if (e.state === 'alive') {
          e.x += e.vx * dt;
          e.y += Math.sin(time * 2 + e.wob) * h * 0.02 * dt;
          e.fire -= dt;
          if (running && !e.behind && e.fire <= 0 && e.x < w && e.x > px + 30) {
            e.fire = 0.7 + Math.random() * 0.6;
            const a = Math.atan2(jetY - e.y, px - e.x) + (Math.random() - 0.5) * 0.45;
            for (let i = 0; i < 3; i++) fx.add({ kind: 'tracer', x: e.x, y: e.y, vx: Math.cos(a) * w * 0.9, vy: Math.sin(a) * w * 0.9, life: 0.45, delay: i * 0.05, color: '#ff8a8a' });
          }
          drawFighter(ctx, e.x, e.y, e.size, Math.sin(time * 2 + e.wob) * 0.05, 0.7, ENEMY, !e.behind, { t: time });
        } else {
          e.vy += h * 1.1 * dt;
          e.vx *= 1 - dt * 0.6;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.rot += dt * (e.spin || 4);
          fx.add({ kind: 'fire', x: e.x + (Math.random() - 0.5) * e.size * 0.2, y: e.y, vx: -e.vx * 0.2, vy: -h * 0.05, life: 0.35, r: e.size * 0.12 });
          fx.add({ kind: 'smoke', x: e.x, y: e.y, vx: -e.vx * 0.3, vy: -h * 0.03, life: 1.6, r: e.size * 0.13 });
          if (!e.broke && e.y > (e.y0 ?? e.y) + h * 0.1) {
            e.broke = true;
            fx.add({ kind: 'wing', x: e.x, y: e.y, vx: e.vx * 0.5 + h * 0.15, vy: -h * 0.25, g: h * 1.2, life: 3, rot: 0, vr: 7, r: e.size * 0.3, floor: (e.seaY ?? horizon + h * 0.1) + h * 0.01 });
            boom(fx, e.x, e.y, h, 0.5);
          }
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.scale(0.3 + 0.7 * Math.abs(Math.cos(time * 2.4 + (e.tum || 0))), 1);
          drawFighter(ctx, 0, 0, e.size, e.rot, 0, WRECK, !e.behind);
          ctx.restore();
          const seaY = e.seaY ?? horizon + h * 0.06;
          if (e.y > seaY) {
            e.gone = true;
            const big = 0.6 + (seaY - horizon) / h;
            splash(fx, e.x, seaY, h * big);
            boom(fx, e.x, seaY - h * 0.01, h, 0.5 * big);
            fx.add({ kind: 'pyre', x: e.x, y: seaY, vx: -speed * 0.6, vy: 0, life: 2.5, r: h * 0.03 * big });
          }
        }
      }
      enemies = enemies.filter((e) => !e.gone && e.x > -160 && e.x < w + 200);
      for (const c of chutes) {
        c.t += dt;
        if (c.t < 0.6) { c.vy += h * 1.2 * dt; c.x += c.vx * dt; }
        else { c.vy = lerp(c.vy, h * 0.07, Math.min(1, dt * 3)); c.vx = lerp(c.vx, -speed * 0.2, Math.min(1, dt)); c.x += c.vx * dt; }
        c.y += c.vy * dt;
        if (c.t < 0.3) fx.add({ kind: 'trail', x: c.x, y: c.y + h * 0.015, vx: 0, vy: 0, life: 0.6, r: h * 0.006 });
        drawChute(ctx, c, h, time);
        if (c.y > c.seaY) { c.done = true; splash(fx, c.x, c.seaY, h * 0.3); }
      }
      chutes = chutes.filter((c) => !c.done && c.x > -100);

      /* obstacles: heat-seeking missiles, dodged with flares */
      if (running && !mini && v.tPhase > 2.5) {
        nextSam -= dt;
        if (nextSam <= 0) {
          nextSam = (3.2 + Math.random() * 3) / (1 + Math.log(v.mult) * 0.4);
          const l = launcherOnScreen();
          const [sx, sy] = l ? launcherAt(l) : [w * (0.55 + Math.random() * 0.4), h + 10];
          if (l) l.flash = time;
          sams.push({ x: sx, y: sy, vx: -h * 0.2, vy: -h * 0.6, t: 0, state: 'homing' });
          sfx.missile();
        }
      }
      for (const m of sams) {
        m.t += dt;
        let tx = px, ty = jetY;
        if (m.state === 'decoy') { m.dx -= speed * dt * 0.6; m.dy += h * 0.15 * dt; tx = m.dx; ty = m.dy; }
        const sp = h * (m.state === 'homing' ? 0.85 : 1.05);
        const want = Math.atan2(ty - m.y, tx - m.x);
        let a = Math.atan2(m.vy, m.vx);
        let d = want - a;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        a += clamp(d, -3 * dt, 3 * dt);
        m.vx = Math.cos(a) * sp;
        m.vy = Math.sin(a) * sp;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        for (let q = 0; q < 3; q++) {
          const back = h * 0.02 + (q / 3) * sp * dt;
          fx.add({ kind: 'trail', x: m.x - Math.cos(a) * back, y: m.y - Math.sin(a) * back, vx: -speed * 0.3, vy: 0, life: 0.9, r: h * 0.008 });
        }
        if (m.state === 'homing' && (Math.hypot(px - m.x, jetY - m.y) < h * 0.26 || m.t > 3)) {
          m.state = 'decoy';
          m.tDecoy = time;
          m.dx = px - jetSize * 0.5;
          m.dy = jetY + jetSize * 0.4;
          for (let i = 0; i < 7; i++) {
            fx.add({ kind: 'flare', x: px - jetSize * 0.2, y: jetY + jetSize * 0.1, vx: -w * (0.08 + Math.random() * 0.22), vy: -h * 0.12 + Math.random() * h * 0.3, g: h * 0.5, drag: 0.6, life: 1.2 + Math.random() * 0.5, r: h * 0.006 });
          }
          dodge += (m.y > jetY ? -1 : 1) * h * 0.12;
          sfx.flares();
        }
        if (m.state === 'decoy' && time - m.tDecoy > 0.5) {
          m.done = true;
          boom(fx, m.x, m.y, h, 0.6);
          kills.dodged += 1;
          sfx.boom();
        }
        drawSam(ctx, m, h);
      }
      sams = sams.filter((m) => !m.done && m.y < h + 80 && m.x > -80 && m.x < w + 80);

      /* wingman joins after take-off */
      if (running && v.tPhase > 1.6) wing.k = Math.min(1, wing.k + dt * 0.7);
      if (wing.k > 0) {
        if (crashed) { wing.x += w * 0.55 * dt; wing.y -= h * 0.25 * dt; }
        else {
          const e = easeOut(wing.k);
          wing.x = lerp(-w * 0.15, px - w * 0.1, e);
          wing.y = Math.max(h * 0.07, jetY - h * 0.09 + Math.sin(time * 1.4) * h * 0.015);
        }
      }

      /* our missiles: at fighters and ships */
      if (running && !mini && v.tPhase > 1.2) {
        nextAttack -= dt;
        if (nextAttack <= 0) {
          nextAttack = (0.9 + Math.random() * 1.1) / (1 + Math.log(v.mult) * 0.45);
          const jetT = enemies.find((e) => e.state === 'alive' && e.x > px + 60 && e.x < w * 0.98 && !e.targeted);
          const shipT = ships.find((s) => s.layer === 'mid' && s.hp > 0 && !s.targeted && shipPos(s).x > px + 40 && shipPos(s).x < w * 0.95);
          const tgt = jetT && (!shipT || Math.random() < 0.6) ? { kind: 'jet', ref: jetT } : shipT ? { kind: 'ship', ref: shipT } : null;
          const fromWing = wing.k > 0.95 && Math.random() < 0.4;
          const ox = fromWing ? wing.x : px, oy = fromWing ? wing.y : jetY;
          if (tgt) {
            tgt.ref.targeted = tgt.kind === 'jet' || tgt.ref.hp <= 1;
            missiles.push({ tgt, t0: time, dur: 0.55 + Math.random() * 0.2, sx: ox + jetSize * 0.1, sy: oy + jetSize * 0.22, lx: ox, ly: oy });
            sfx.missile();
          }
          for (let i = 0; i < 5; i++) fx.add({ kind: 'tracer', x: px + jetSize * 0.5, y: jetY + pitch * jetSize * 0.5, vx: Math.cos(pitch) * w * 1.6, vy: Math.sin(pitch) * w * 1.6, life: 0.35, delay: i * 0.05, color: '#fff3c4' });
        }
      }
      for (const m of missiles) {
        const k = (time - m.t0) / m.dur;
        let tx, ty;
        if (m.tgt.kind === 'jet') { tx = m.tgt.ref.x; ty = m.tgt.ref.y; }
        else { const p = shipPos(m.tgt.ref); tx = p.x; ty = p.y - 25 * p.s; }
        const e = clamp(k, 0, 1);
        const cx = m.sx + w * 0.15, cy = m.sy + h * 0.06;
        const x = (1 - e) * (1 - e) * m.sx + 2 * (1 - e) * e * cx + e * e * tx;
        const y = (1 - e) * (1 - e) * m.sy + 2 * (1 - e) * e * cy + e * e * ty;
        fx.add({ kind: 'trail', x, y, vx: -speed * 0.4, vy: 0, life: 0.5, r: h * 0.007 });
        const ang = Math.atan2(y - m.ly, x - m.lx);
        m.lx = x; m.ly = y;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        const ms = h * 0.0016;
        ctx.scale(ms, ms);
        ctx.fillStyle = 'rgba(255,200,120,0.9)';
        ctx.beginPath(); ctx.arc(-12, 0, 4 + Math.random() * 2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#eef1f6';
        rr(ctx, -10, -1.8, 20, 3.6, 1.6);
        ctx.fill();
        ctx.fillStyle = '#d23b3b';
        ctx.beginPath(); ctx.moveTo(9.5, -1.8); ctx.quadraticCurveTo(14, 0, 9.5, 1.8); ctx.closePath(); ctx.fill();
        ctx.restore();
        if (k >= 1) {
          m.done = true;
          boom(fx, tx, ty, h, m.tgt.kind === 'ship' ? 1.3 : 0.8);
          if (m.tgt.kind === 'jet' && m.tgt.ref.state === 'alive') {
            m.tgt.ref.state = 'falling';
            m.tgt.ref.vy = -h * 0.05;
            m.tgt.ref.spin = (3 + Math.random() * 4) * (Math.random() < 0.5 ? -1 : 1);
            m.tgt.ref.y0 = m.tgt.ref.y;
            m.tgt.ref.seaY = horizon + h * (0.06 + Math.random() * 0.24);
            m.tgt.ref.tum = Math.random() * 6;
            if (Math.random() < 0.7) {
              const e = m.tgt.ref;
              chutes.push({ x: e.x, y: e.y - e.size * 0.1, vx: e.vx * 0.25, vy: -h * 0.6, t: 0, seed: Math.random() * 6, seaY: horizon + h * (0.1 + Math.random() * 0.25) });
              fx.add({ kind: 'chunk', x: e.x, y: e.y - e.size * 0.1, vx: e.vx * 0.3 + (Math.random() - 0.5) * h * 0.2, vy: -h * 0.4, g: h * 1.2, life: 3, rot: 0, vr: 12, r: e.size * 0.1, col: '#7a4a5a', floor: e.seaY });
            }
            kills.jets += 1;
            sfx.boom();
          } else if (m.tgt.kind === 'ship' && m.tgt.ref.hp > 0) {
            m.tgt.ref.hp -= 1;
            m.tgt.ref.targeted = false;
            m.tgt.ref.hit = true;
            if (m.tgt.ref.hp <= 0) {
              kills.ships += 1;
              sfx.sink();
              const sh = m.tgt.ref, p = shipPos(sh);
              const L = sh.type === 'battleship' ? 130 : sh.type === 'cruiser' ? 105 : 82;
              sh.secondary = 4;
              sh.breaks = sh.type !== 'destroyer';
              boom(fx, p.x, p.y - 30 * p.s, h, 1.6);
              splash(fx, p.x + (Math.random() - 0.5) * L * p.s, p.y, h * 0.9);
              const kinds = ['buoy', 'crate', 'buoy', 'crate', 'buoy', 'raft'];
              kinds.forEach((what, i) => {
                fx.add({ kind: 'float', what, x: p.x + (i / (kinds.length - 1) - 0.5) * L * 2 * p.s, y: p.y + h * (0.005 + Math.random() * 0.03), vx: -speed * 0.5 - h * 0.01, vy: 0, life: 7, seed: Math.random() * 6, r: h * (what === 'raft' ? 0.012 : 0.008) });
              });
              for (let i = 0; i < 4; i++) fx.add({ kind: 'pyre', x: p.x + (Math.random() - 0.5) * L * 1.6 * p.s, y: p.y + h * 0.008, vx: -speed * 0.5, vy: 0, life: 3.5 + Math.random() * 2, r: h * (0.025 + Math.random() * 0.02) });
              for (let i = 0; i < 5; i++) {
                fx.add({ kind: 'sailor', x: p.x + (Math.random() - 0.5) * L * 1.4 * p.s, y: p.y - 22 * p.s, vx: (Math.random() - 0.5) * h * 0.3, vy: -h * (0.25 + Math.random() * 0.25), g: h * 1.4, life: 4, rot: 0, vr: (Math.random() - 0.5) * 8, r: h * 0.02, floor: p.y + h * 0.012 });
              }
            } else sfx.boom();
          }
        }
      }
      missiles = missiles.filter((m) => !m.done);

      // flak bursts around the player
      if (running && v.mult > 1.2) {
        nextFlak -= dt;
        if (nextFlak <= 0) {
          nextFlak = (0.45 + Math.random() * 0.9) / (1 + Math.log(v.mult) * 0.2);
          const a = Math.random() * TAU, d = h * (0.1 + Math.random() * 0.14);
          sfx.flak();
          fx.add({ kind: 'flak', x: px + Math.cos(a) * d, y: jetY + Math.sin(a) * d, vx: -speed * 0.3, vy: 0, life: 0.9, r: h * 0.03 });
        }
      }

      // vapour trails off the wingtip at high speed
      if (running && v.tPhase > 1.4) {
        contrail.push({ x: px - jetSize * 0.3, y: jetY + jetSize * 0.25 });
        if (contrail.length > 46) contrail.shift();
      }
      for (const p of contrail) p.x -= speed * dt;
      if (contrail.length > 2 && running) {
        const vis = clamp((v.mult - 1.3) / 1.5, 0, 1);
        ctx.lineCap = 'round';
        for (let i = 1; i < contrail.length; i++) {
          const a = (i / contrail.length) * 0.4 * vis;
          ctx.strokeStyle = `rgba(255,255,255,${a})`;
          ctx.lineWidth = Math.max(1, h * 0.004);
          ctx.beginPath(); ctx.moveTo(contrail[i - 1].x, contrail[i - 1].y); ctx.lineTo(contrail[i].x, contrail[i].y); ctx.stroke();
        }
      }

      /* wingman and player */
      if (wing.k > 0 && wing.x < w + 200) drawFighter(ctx, wing.x, wing.y, jetSize * 0.8, crashed ? -0.3 : pitch * 0.8, 0.85, WINGMAN, false, { t: time });
      if (v.phase === 'betting') drawFighter(ctx, px, jetY, jetSize, -0.02, 0.25 + v.betProgress * 0.6, PLAYER, false, { gear: true, t: time });
      else if (running) drawFighter(ctx, px, jetY, jetSize, pitch, 1, PLAYER, false, { gear: v.tPhase < 0.7, t: time });

      // the missile that gets us
      if (crashed && crashPos && crashFrom) {
        const tc = time - crashTime;
        if (tc < 0.45) {
          ctx.strokeStyle = `rgba(255,240,220,${0.85 * (1 - tc / 0.45)})`;
          ctx.lineWidth = Math.max(2, h * 0.006);
          ctx.beginPath();
          ctx.moveTo(crashFrom[0], crashFrom[1]);
          ctx.quadraticCurveTo((crashFrom[0] + crashPos[0]) / 2 + w * 0.05, crashPos[1] + h * 0.2, crashPos[0], crashPos[1]);
          ctx.stroke();
        }
        if (tc < 0.6) {
          const ring = easeOut(tc / 0.6);
          ctx.strokeStyle = `rgba(255,220,170,${0.7 * (1 - ring)})`;
          ctx.lineWidth = h * 0.012 * (1 - ring) + 1;
          ctx.beginPath(); ctx.arc(crashPos[0], crashPos[1], h * 0.3 * ring, 0, TAU); ctx.stroke();
        }
      }
      if (wreck) {
        wreck.vy += h * 1.0 * dt;
        wreck.x += wreck.vx * dt;
        wreck.y += wreck.vy * dt;
        wreck.rot += wreck.vr * dt;
        fx.add({ kind: 'smoke', x: wreck.x, y: wreck.y, vx: -wreck.vx * 0.3, vy: -h * 0.04, life: 1.8, r: jetSize * 0.15 });
        fx.add({ kind: 'fire', x: wreck.x + (Math.random() - 0.5) * jetSize * 0.25, y: wreck.y, vx: (Math.random() - 0.5) * h * 0.1, vy: -h * 0.05, life: 0.4, r: jetSize * 0.14 });
        drawFighter(ctx, wreck.x, wreck.y, jetSize, wreck.rot, 0, WRECK);
        if (wreck.y > horizon + h * 0.2) { splash(fx, wreck.x, wreck.y, h * 1.4); wreck = null; }
      }

      /* particles */
      fx.update(dt);
      fx.each((p) => {
        // sailors and wreckage that reach the sea make a splash
        if (p.kind === 'pyre' && Math.random() < 0.3) fx.add({ kind: 'smoke', x: p.x, y: p.y - p.r, vx: p.vx, vy: -h * 0.07, life: 1.8, r: p.r * 0.7 });
        if (p.kind === 'wing' && Math.random() < 0.6) fx.add({ kind: 'fire', x: p.x, y: p.y, vx: 0, vy: 0, life: 0.3, r: p.r * 0.4 });
        if ((p.kind === 'sailor' || p.kind === 'chunk' || p.kind === 'wing') && p.floor !== undefined && p.vy > 0 && p.y > p.floor) {
          p.age = p.life;
          splash(fx, p.x, p.floor, h * (p.kind === 'chunk' ? 0.5 : 0.3));
        }
        if (p.kind === 'flare' && Math.random() < 0.5) fx.add({ kind: 'trail', x: p.x, y: p.y, vx: 0, vy: 0, life: 0.6, r: h * 0.004 });
        if (p.kind === 'chunk' && Math.random() < 0.5) {
          fx.add({ kind: 'smoke', x: p.x, y: p.y, vx: 0, vy: -h * 0.02, life: 0.9, r: p.r * 0.8 });
          if (Math.random() < 0.5) fx.add({ kind: 'fire', x: p.x, y: p.y, vx: 0, vy: 0, life: 0.25, r: p.r * 0.7 });
        }
      });

      // soft smoke, steam and trails
      fx.each((p, k) => {
        if (p.kind === 'smoke' || p.kind === 'haze') {
          const r = p.r * (1.3 + k * 2.2);
          ctx.globalAlpha = (p.kind === 'smoke' ? 0.75 : 0.35) * (1 - k);
          ctx.drawImage(SP.smoke, p.x - r, p.y - r, r * 2, r * 2);
        } else if (p.kind === 'steam' || p.kind === 'trail') {
          const r = p.r * (1.4 + k * 2);
          ctx.globalAlpha = (p.kind === 'trail' ? 0.6 : 0.35) * (1 - k);
          ctx.drawImage(SP.puff, p.x - r, p.y - r, r * 2, r * 2);
        } else if (p.kind === 'flak') {
          const r = p.r * (1 + k * 1.5);
          ctx.globalAlpha = 0.85 * (1 - k);
          ctx.drawImage(SP.smoke, p.x - r, p.y - r, r * 2, r * 2);
        } else if (p.kind === 'fireball' && k > 0.3) {
          // fireballs burn out into dark smoke
          const r = p.r * (1.2 + k * 1.8);
          ctx.globalAlpha = 0.7 * ((k - 0.3) / 0.7) * (1 - k * 0.6);
          ctx.drawImage(SP.smoke, p.x - r, p.y - r, r * 2, r * 2);
        }
      });
      ctx.globalAlpha = 1;

      if (crashed && crashPos) {
        const tc = time - crashTime;
        if (tc < 0.35) {
          const fr = h * (0.14 + tc * 0.7);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 1 - tc / 0.35;
          ctx.drawImage(SP.flash, crashPos[0] - fr, crashPos[1] - fr, fr * 2, fr * 2);
          ctx.restore();
        }
      }

      // fire, flashes, sparks and flares glow additively
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      fx.each((p, k) => {
        if (p.kind === 'fire' || p.kind === 'fireball') {
          const grow = p.kind === 'fireball' ? (k < 0.15 ? 0.6 + k * 2.6 : 1 - (k - 0.15) * 0.7) : 1 - k * 0.5;
          const r = p.r * grow * 1.9;
          ctx.globalAlpha = Math.min(1, 1.3 * (1 - k));
          ctx.drawImage(SP.fire, p.x - r, p.y - r, r * 2, r * 2);
        } else if (p.kind === 'flash') {
          const r = p.r * (0.6 + k * 0.9);
          ctx.globalAlpha = 1 - k;
          ctx.drawImage(SP.flash, p.x - r, p.y - r, r * 2, r * 2);
        } else if (p.kind === 'spark') {
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = k < 0.4 ? '#fff4c8' : '#ffab4a';
          ctx.lineWidth = Math.max(1, p.r);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
        } else if (p.kind === 'flak' && k < 0.2) {
          const r = p.r * (0.8 + k * 2);
          ctx.globalAlpha = 1 - k / 0.2;
          ctx.drawImage(SP.fire, p.x - r, p.y - r, r * 2, r * 2);
        } else if (p.kind === 'pyre') {
          // burning oil on the water
          for (let j = 0; j < 3; j++) {
            const u = ((j + p.age * 2.4) % 3) / 3;
            const r = p.r * (1.3 - u * 0.6) * (1 - k * 0.5);
            ctx.globalAlpha = (1 - u) * Math.min(1, (1 - k) * 2) * 0.9;
            ctx.drawImage(SP.fire, p.x - r + (j - 1) * p.r * 0.7, p.y - r * 1.2 - u * p.r * 1.6, r * 2, r * 1.7);
          }
        } else if (p.kind === 'flare') {
          const r = p.r * 6;
          ctx.globalAlpha = 1 - k;
          ctx.drawImage(SP.flash, p.x - r, p.y - r, r * 2, r * 2);
        }
      });
      ctx.restore();
      ctx.globalAlpha = 1;

      // solid bits: shockwaves, wreckage, water, foam rings, sailors, tracers
      fx.each((p, k) => {
        if (p.kind === 'shock') {
          ctx.strokeStyle = `rgba(255,236,200,${0.35 * (1 - k)})`;
          ctx.lineWidth = Math.max(1, p.r * 0.05 * (1 - k));
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * easeOut(k), 0, TAU); ctx.stroke();
        } else if (p.kind === 'debris' || p.kind === 'chunk') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.col || '#5a5566';
          ctx.beginPath(); ctx.moveTo(-p.r, -p.r * 0.4); ctx.lineTo(p.r * 0.8, -p.r * 0.6); ctx.lineTo(p.r, p.r * 0.3); ctx.lineTo(-p.r * 0.6, p.r * 0.5); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(-p.r * 0.6, -p.r * 0.45, p.r * 1.2, p.r * 0.2);
          ctx.restore();
        } else if (p.kind === 'wing') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(p.r / 20, p.r / 20);
          ctx.fillStyle = '#4a4552';
          ctx.beginPath(); ctx.moveTo(14, -8); ctx.lineTo(-10, 12); ctx.lineTo(-20, 12); ctx.lineTo(-16, -8); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#2a2630';
          ctx.fillRect(-16, -9, 30, 2.5);
          ctx.restore();
        } else if (p.kind === 'float') {
          drawFloat(ctx, p, k, time);
        } else if (p.kind === 'water') {
          ctx.fillStyle = `rgba(232,242,255,${0.9 * (1 - k)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - k * 0.3), 0, TAU); ctx.fill();
        } else if (p.kind === 'ring') {
          const rx = p.r * (0.3 + easeOut(k) * 1.2);
          ctx.strokeStyle = `rgba(235,242,255,${0.6 * (1 - k)})`;
          ctx.lineWidth = Math.max(1, p.r * 0.07 * (1 - k));
          ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, rx * 0.16, 0, 0, TAU); ctx.stroke();
        } else if (p.kind === 'sailor') {
          const s = p.r;
          const kick = Math.sin(p.age * 18) * 0.5;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.strokeStyle = '#1d2a4a';
          ctx.lineWidth = Math.max(1, s * 0.2);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, -s * 0.2); ctx.lineTo(-s * 0.25, s * 0.45 + kick * s * 0.3);
          ctx.moveTo(0, -s * 0.2); ctx.lineTo(s * 0.25, s * 0.45 - kick * s * 0.3);
          ctx.moveTo(0, -s * 0.2); ctx.lineTo(0, -s * 0.62);
          ctx.moveTo(0, -s * 0.55); ctx.lineTo(-s * 0.42, -s * 0.9 + kick * s * 0.3);
          ctx.moveTo(0, -s * 0.55); ctx.lineTo(s * 0.42, -s * 0.9 - kick * s * 0.3);
          ctx.stroke();
          ctx.fillStyle = '#e8b896';
          ctx.beginPath(); ctx.arc(0, -s * 0.8, s * 0.17, 0, TAU); ctx.fill();
          ctx.fillStyle = '#f2f4f8';
          ctx.fillRect(-s * 0.18, -s * 1.0, s * 0.36, s * 0.1);
          ctx.restore();
        } else if (p.kind === 'tracer') {
          if (p.delay && p.age < p.delay) return;
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = 1 - k;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });

      // near clouds rushing past in front of the action
      for (let i = 0; i < 3; i++) {
        const span = w * 2.6;
        const cx = wrap(hash(i, 91) * span - scroll * 1.5, span) - w * 0.6;
        const cy = h * (0.14 + hash(i, 92) * 0.3);
        const cw = h * (0.55 + hash(i, 93) * 0.3);
        spr(SP.clouds[i % 6], cx, cy, cw, cw * 0.47, 0.32);
      }

      // speed lines at high multipliers
      if (running && !reduced && speed > w * 0.45) {
        const k = clamp((speed - w * 0.45) / (w * 0.4), 0, 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 10; i++) {
          const span = w * 1.4;
          const x = wrap(hash(i, 101) * span - time * w * 2.2 * (0.6 + hash(i, 102)), span) - w * 0.2;
          const y = h * (0.05 + hash(i, 103) * 0.55);
          ctx.strokeStyle = `rgba(255,255,255,${0.12 * k})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.09, y); ctx.stroke();
        }
        ctx.restore();
      }

      if (crashed) {
        const tc = time - crashTime;
        const a = reduced ? 0.1 : clamp(0.32 - tc * 0.6, 0.06, 0.32);
        ctx.fillStyle = `rgba(255,60,40,${a})`;
        ctx.fillRect(-20, -20, w + 40, h + 40);
      }

      /* HUD: battle tally */
      if (!mini && v.phase !== 'betting') {
        const pad = h * 0.03;
        const fs = Math.max(11, Math.round(h * 0.03));
        ctx.font = `700 ${fs}px "Chakra Petch", system-ui, sans-serif`;
        const plural = (c, one, many) => `${c} ${c === 1 ? one : many}`;
        const lines = [
          [jetIcon, plural(kills.jets, 'jet down', 'jets down')],
          [shipIcon, plural(kills.ships, 'ship sunk', 'ships sunk')],
          [missileIcon, plural(kills.dodged, 'missile dodged', 'missiles dodged')],
        ];
        const iw = fs * 1.6;
        const lh = fs * 1.25;
        const tw = Math.max(...lines.map(([, t]) => ctx.measureText(t).width)) + iw + pad * 1.2;
        const th = lh * lines.length + fs * 0.5;
        ctx.fillStyle = 'rgba(8,10,25,0.55)';
        rr(ctx, pad, pad, tw, th, 8);
        ctx.fill();
        ctx.fillStyle = '#ff8a3d';
        ctx.fillRect(pad, pad, 4, th);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        lines.forEach(([icon, text], i) => {
          const y = pad + fs * 0.25 + lh * (i + 0.5);
          icon(ctx, pad + iw * 0.6, y, fs / 16, '#ffd9b8');
          ctx.fillStyle = '#fff';
          ctx.fillText(text, pad + iw + pad * 0.2, y);
        });
      }

      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.8);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(5,8,25,0.45)');
      ctx.fillStyle = vg;
      ctx.fillRect(-20, -20, w + 40, h + 40);
      ctx.restore();
    },
  };
}

// An explosion: white flash, shockwave, fireballs that burn out into smoke, flying sparks.
function boom(fx, x, y, h, size) {
  fx.add({ kind: 'flash', x, y, vx: 0, vy: 0, life: 0.22, r: h * 0.17 * size });
  fx.add({ kind: 'shock', x, y, vx: 0, vy: 0, life: 0.45, r: h * 0.2 * size });
  for (let i = 0; i < 12 * size; i++) {
    const a = Math.random() * TAU, sp = h * (0.04 + Math.random() * 0.22) * size;
    fx.add({ kind: 'fireball', x: x + Math.cos(a) * h * 0.01, y: y + Math.sin(a) * h * 0.01, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - h * 0.05, drag: 3.2, life: 0.6 + Math.random() * 0.6, r: h * (0.018 + Math.random() * 0.02) * size });
  }
  for (let i = 0; i < 14 * size; i++) {
    const a = Math.random() * TAU, sp = h * (0.3 + Math.random() * 0.6) * size;
    fx.add({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - h * 0.1, g: h * 1.2, drag: 1.5, life: 0.35 + Math.random() * 0.45, r: 1.3 });
  }
  for (let i = 0; i < 6 * size; i++) {
    fx.add({ kind: 'smoke', x: x + (Math.random() - 0.5) * h * 0.05, y: y + (Math.random() - 0.5) * h * 0.03, vx: (Math.random() - 0.5) * h * 0.08, vy: -h * 0.05, drag: 1, life: 1.5 + Math.random(), r: h * 0.026 * size });
  }
}

// Something hits the sea: a column of spray, falling droplets, foam rings and mist.
function splash(fx, x, y, h) {
  fx.add({ kind: 'ring', x, y, vx: 0, vy: 0, life: 1.4, r: h * 0.12 });
  fx.add({ kind: 'ring', x, y, vx: 0, vy: 0, life: 2, r: h * 0.2 });
  for (let i = 0; i < 30; i++) {
    const up = Math.random() < 0.55;
    fx.add({ kind: 'water', x: x + (Math.random() - 0.5) * h * 0.05, y, vx: (Math.random() - 0.5) * h * (up ? 0.12 : 0.4), vy: -h * (up ? 0.6 + Math.random() * 0.7 : 0.2 + Math.random() * 0.3), g: h * 1.8, life: 0.9 + Math.random() * 0.5, r: h * (0.006 + Math.random() * 0.012) });
  }
  for (let i = 0; i < 6; i++) fx.add({ kind: 'steam', x: x + (Math.random() - 0.5) * h * 0.08, y: y - h * 0.02, vx: (Math.random() - 0.5) * h * 0.05, vy: -h * 0.06, life: 1.3, r: h * 0.022 });
}
