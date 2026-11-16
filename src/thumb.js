// Lobby thumbnail (public/thumbnail.png): drawn once with the game's own art.
// Open /thumb.html on the dev server; the picture is 1200×800 (saved at 600×400).
import { thumbKit } from './scenes/jet';

const { drawFighter, drawWarship, drawRange, PLAYER, WINGMAN, ENEMY } = thumbKit;
const c = document.getElementById('c');
const ctx = c.getContext('2d');
const W = c.width, H = c.height;
const CX = 600; // the lobby card crops the sides: keep the hero in the middle
const HZ = 560; // horizon
const TAU = Math.PI * 2;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function glow(x, y, r, stops) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

async function draw() {
  await document.fonts.load('120px Bungee');
  const SP = thumbKit.sprites();

  // sky: night at the top into a burning sunset at the horizon
  const sky = ctx.createLinearGradient(0, 0, 0, HZ);
  sky.addColorStop(0, '#0d0b26');
  sky.addColorStop(0.35, '#3a1d5c');
  sky.addColorStop(0.7, '#a83c6c');
  sky.addColorStop(0.9, '#ff7a4a');
  sky.addColorStop(1, '#ffc27a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HZ);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`;
    ctx.fillRect(rnd() * W, rnd() * 230, 2, 2);
  }

  // sun and its rays behind the jet
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const a = Math.PI + (i / 15) * Math.PI;
    ctx.fillStyle = `rgba(255,190,120,${i % 2 ? 0.05 : 0.09})`;
    ctx.beginPath();
    ctx.moveTo(CX, HZ - 10);
    ctx.lineTo(CX + Math.cos(a - 0.05) * 1100, HZ - 10 + Math.sin(a - 0.05) * 1100);
    ctx.lineTo(CX + Math.cos(a + 0.05) * 1100, HZ - 10 + Math.sin(a + 0.05) * 1100);
    ctx.closePath();
    ctx.fill();
  }
  glow(CX, HZ - 10, 420, [[0, 'rgba(255,230,170,0.9)'], [0.15, 'rgba(255,170,100,0.55)'], [0.5, 'rgba(255,90,90,0.18)'], [1, 'rgba(255,60,90,0)']]);
  ctx.restore();
  ctx.fillStyle = '#fff1c8';
  ctx.beginPath(); ctx.arc(CX, HZ - 4, 54, Math.PI, 0); ctx.fill();

  // clouds
  const cloud = (k, x, y, w, a) => { ctx.globalAlpha = a; const s = SP.clouds[k][0]; ctx.drawImage(s, x, y, w, w * s.height / s.width); ctx.globalAlpha = 1; };
  cloud(0, -160, 170, 620, 0.9);
  cloud(3, 760, 140, 640, 0.85);
  cloud(1, 260, 330, 380, 0.55);
  cloud(4, 640, 360, 420, 0.55);

  // mountains on the horizon
  drawRange(ctx, W, H, HZ, 0, 0.1, 110, 0.15, 0.8, 1);
  drawRange(ctx, W, H, HZ, 300, 0.2, 60, 0.2, 0.8, 0);

  // ocean with the sun's glitter path
  const sea = ctx.createLinearGradient(0, HZ, 0, H);
  sea.addColorStop(0, '#5a3360');
  sea.addColorStop(0.25, '#2a2350');
  sea.addColorStop(1, '#0c1028');
  ctx.fillStyle = sea;
  ctx.fillRect(0, HZ, W, H - HZ);
  for (let i = 0; i < 260; i++) {
    const y = HZ + 4 + Math.pow(rnd(), 1.6) * (H - HZ);
    const spread = 40 + (y - HZ) * 0.9;
    const x = CX + (rnd() - 0.5) * spread * 2;
    ctx.fillStyle = `rgba(255,${190 + rnd() * 50},140,${0.25 + rnd() * 0.5})`;
    ctx.fillRect(x, y, 6 + rnd() * 22 * (y - HZ) / 240, 2);
  }
  ctx.strokeStyle = 'rgba(160,170,255,0.12)';
  ctx.lineWidth = 2;
  for (let y = HZ + 24; y < H; y += 26 + (y - HZ) * 0.12) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.03 + y) * 3);
    ctx.stroke();
  }

  // fleet: an enemy battleship on fire and a cruiser firing up at us
  const ship = (type, num, extra = {}) => ({ type, num, seed: 2, flash: -1, hit: false, sink: 0, hp: 3, layer: 'far', ...extra });
  drawWarship(ctx, 250, HZ + 70, 1.35, ship('battleship', '66', { hit: true, flash: 0.05 }), 0.1, -0.9, 0.2);
  drawWarship(ctx, 980, HZ + 92, 1.55, ship('cruiser', '42', { flash: 0.02 }), 0.1, -2.3, 0.2);

  // smoke columns from the burning ships
  for (const [x, y, n] of [[230, HZ + 20, 9], [330, HZ + 30, 7]]) {
    for (let i = 0; i < n; i++) {
      const r = 50 + i * 14;
      ctx.globalAlpha = 0.75 - i * 0.06;
      ctx.drawImage(SP.smoke, x - r + i * 18, y - i * 46 - r, r * 2, r * 2);
    }
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, r] of [[240, HZ + 30, 70], [320, HZ + 36, 50], [282, HZ + 10, 44]]) ctx.drawImage(SP.fire, x - r, y - r, r * 2, r * 2);
  ctx.restore();

  // flak bursts and tracers up at the jet
  ctx.save();
  ctx.strokeStyle = 'rgba(255,236,170,0.8)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    const x0 = 950 + rnd() * 40, y0 = HZ + 40;
    const x1 = 760 - i * 40 + rnd() * 30, y1 = 250 + rnd() * 160;
    const u0 = 0.45 + rnd() * 0.3;
    ctx.beginPath();
    ctx.moveTo(x0 + (x1 - x0) * u0, y0 + (y1 - y0) * u0);
    ctx.lineTo(x0 + (x1 - x0) * (u0 + 0.06), y0 + (y1 - y0) * (u0 + 0.06));
    ctx.stroke();
  }
  ctx.restore();
  for (const [x, y, r] of [[820, 300, 34], [380, 250, 34], [150, 200, 28]]) {
    ctx.drawImage(SP.smoke, x - r * 1.4, y - r * 1.4, r * 2.8, r * 2.8);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(SP.fire, x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  // missile trail from the hero to an enemy jet blowing up
  const ex = 1000, ey = 250;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(240,236,255,0.55)';
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(650, 360); ctx.bezierCurveTo(740, 330, 800, 210, ex - 20, ey + 10); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  drawFighter(ctx, ex + 10, ey + 10, 120, 0.5, 0, ENEMY, true, {});
  for (let i = 0; i < 6; i++) {
    const r = 70 - i * 6;
    ctx.globalAlpha = 0.8;
    ctx.drawImage(SP.smoke, ex - r + 40 + i * 24, ey - r - 30 - i * 16, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(SP.fire, ex - 120, ey - 120, 240, 240);
  ctx.drawImage(SP.flash, ex - 80, ey - 80, 160, 160);
  ctx.restore();
  ctx.fillStyle = '#2a2430';
  for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU, d = 70 + rnd() * 70;
    ctx.save();
    ctx.translate(ex + Math.cos(a) * d, ey + Math.sin(a) * d);
    ctx.rotate(rnd() * 6);
    ctx.fillRect(-7, -4, 14, 8);
    ctx.restore();
  }

  // second enemy diving in from the right, wingman on the left
  drawFighter(ctx, 1010, 420, 120, -0.1, 0.8, ENEMY, true, {});
  drawFighter(ctx, 240, 330, 130, -0.12, 0.9, WINGMAN, false, {});

  // the hero jet, big and climbing, right in the middle
  glow(CX, 390, 300, [[0, 'rgba(255,200,140,0.35)'], [1, 'rgba(255,160,120,0)']]);
  drawFighter(ctx, CX - 10, 400, 330, -0.2, 1, PLAYER, false, {});

  // title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const title = (txt, y, size, fill, track) => {
    ctx.font = `${size}px Bungee`;
    ctx.letterSpacing = `${track}px`;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a0f2e';
    ctx.lineWidth = size * 0.22;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText(txt, CX + 6, y + 10);
    ctx.strokeText(txt, CX, y);
    ctx.fillStyle = fill;
    ctx.fillText(txt, CX, y);
  };
  const gold = ctx.createLinearGradient(0, 30, 0, 140);
  gold.addColorStop(0, '#fff6d0');
  gold.addColorStop(0.5, '#ffd166');
  gold.addColorStop(1, '#ff9a3d');
  title('JET FIGHT', 132, 104, gold, 2);
  const orange = ctx.createLinearGradient(0, 160, 0, 215);
  orange.addColorStop(0, '#ffb37a');
  orange.addColorStop(1, '#ff5a3d');
  title('EMPIRE', 212, 66, orange, 18);

  // finish: vignette
  const v = ctx.createRadialGradient(CX, 420, 260, CX, 420, 820);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  document.body.dataset.ready = '1';
}

draw();
