import { TAU, clamp, lerp, easeOut, hash, rr, particles } from './util';

const C = {
  sky: ['#0a1533', '#22265e', '#5b3378', '#c8586a', '#ff9a52'],
  sun: '#ffe1a6',
};
const PLAYER = { body: '#dfe6f2', bodyDark: '#8794ad', canopy: '#7fd3ff', stripe: '#ff8a3d' };
const ENEMY = { body: '#5a3046', bodyDark: '#2a1426', canopy: '#ff6b6b', stripe: '#ff4d4d' };
const WRECK = { body: '#4a4450', bodyDark: '#221e28', canopy: '#3a3040', stripe: '#6a3020' };

// Fighter jet pointing +x, ~100 units nose to tail.
function drawJet(ctx, x, y, size, angle, burn, pal, flip = false) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.rotate(angle);
  const s = size / 100;
  ctx.scale(s, s);
  if (burn > 0) {
    const fl = burn * (0.8 + Math.random() * 0.35);
    ctx.globalCompositeOperation = 'lighter';
    const fg = ctx.createLinearGradient(-50, 0, -50 - 60 * fl, 0);
    fg.addColorStop(0, 'rgba(255,255,240,0.95)');
    fg.addColorStop(0.25, 'rgba(255,214,110,0.9)');
    fg.addColorStop(0.6, 'rgba(255,120,50,0.6)');
    fg.addColorStop(1, 'rgba(255,80,40,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(-52 - 30 * fl, 0, 32 * fl, 4 + 2 * fl, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = pal.bodyDark;
  ctx.beginPath();
  ctx.moveTo(8, -3); ctx.lineTo(-20, -26); ctx.lineTo(-32, -26); ctx.lineTo(-22, -3);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-36, -3); ctx.lineTo(-46, -12); ctx.lineTo(-52, -12); ctx.lineTo(-48, -3);
  ctx.closePath(); ctx.fill();
  const bg = ctx.createLinearGradient(0, -9, 0, 9);
  bg.addColorStop(0, pal.body);
  bg.addColorStop(1, pal.bodyDark);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(52, 1);
  ctx.quadraticCurveTo(38, -6, 22, -7);
  ctx.lineTo(-12, -8); ctx.lineTo(-48, -6); ctx.lineTo(-50, 0); ctx.lineTo(-48, 6); ctx.lineTo(-12, 7); ctx.lineTo(24, 6);
  ctx.quadraticCurveTo(40, 5, 52, 1);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = pal.stripe;
  ctx.beginPath();
  ctx.moveTo(-44, -1.5); ctx.lineTo(14, -2.5); ctx.lineTo(18, 0); ctx.lineTo(-44, 1.5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = pal.bodyDark;
  ctx.beginPath();
  ctx.moveTo(-28, -6); ctx.lineTo(-44, -26); ctx.lineTo(-52, -26); ctx.lineTo(-47, -5);
  ctx.closePath(); ctx.fill();
  const cg = ctx.createLinearGradient(14, -12, 30, -2);
  cg.addColorStop(0, '#e9fbff');
  cg.addColorStop(0.4, pal.canopy);
  cg.addColorStop(1, '#1d4f78');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.ellipse(22, -6.5, 12, 4.6, -0.04, Math.PI, TAU); ctx.fill();
  const wg = ctx.createLinearGradient(0, 2, 0, 30);
  wg.addColorStop(0, pal.body);
  wg.addColorStop(1, pal.bodyDark);
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.moveTo(10, 3); ctx.lineTo(-20, 30); ctx.lineTo(-34, 30); ctx.lineTo(-22, 4);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-36, 3); ctx.lineTo(-48, 15); ctx.lineTo(-55, 15); ctx.lineTo(-50, 3);
  ctx.closePath(); ctx.fill();
  // missiles under the wing
  ctx.fillStyle = '#e8ecf2';
  rr(ctx, -18, 20, 22, 3.5, 1.5); ctx.fill();
  ctx.fillStyle = pal.stripe;
  ctx.beginPath(); ctx.arc(-20, 20, 4, 0, TAU); ctx.fill();
  ctx.fillStyle = pal.body;
  ctx.beginPath(); ctx.arc(-20, 20, 1.8, 0, TAU); ctx.fill();
  ctx.restore();
}

// Warship, bow pointing left. Waterline at y=0; length ~240 units for a battleship.
function drawShip(ctx, x, y, s, ship, time) {
  ctx.save();
  ctx.translate(x, y + (ship.sink || 0) * s * 60);
  ctx.rotate((ship.sink || 0) * 0.25);
  ctx.scale(s, s);
  const bs = ship.type === 'battleship';
  const L = bs ? 120 : 80;
  const hull = ctx.createLinearGradient(0, -18, 0, 4);
  hull.addColorStop(0, '#59607a');
  hull.addColorStop(1, '#2c3042');
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(-L - 4, -18);
  ctx.quadraticCurveTo(-L + 8, -2, -L + 22, 4);
  ctx.lineTo(L - 10, 4);
  ctx.lineTo(L, -12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7a2a2a';
  ctx.fillRect(-L + 20, 0, L * 2 - 30, 4);
  ctx.fillStyle = '#6a7290';
  ctx.fillRect(-L + 4, -18, L * 2 - 6, 2);
  // superstructure
  ctx.fillStyle = '#4a5066';
  if (bs) {
    ctx.fillRect(-34, -38, 70, 22);
    ctx.fillRect(-16, -62, 30, 26);
    ctx.fillStyle = '#ffd27a';
    for (let i = 0; i < 4; i++) ctx.fillRect(-12 + i * 7, -56, 4, 3);
    ctx.fillStyle = '#2a2e3e';
    ctx.fillRect(20, -62, 14, 26);
    ctx.strokeStyle = '#4a5066';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, -62); ctx.lineTo(-2, -92);
    ctx.moveTo(-12, -82); ctx.lineTo(8, -82);
    ctx.moveTo(90, -12); ctx.lineTo(90, -48);
    ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(90, -48, 14, 9);
  } else {
    ctx.fillRect(-26, -32, 44, 16);
    ctx.fillRect(-20, -46, 18, 14);
    ctx.fillStyle = '#2a2e3e';
    ctx.fillRect(6, -46, 10, 14);
    ctx.strokeStyle = '#4a5066';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-11, -46); ctx.lineTo(-11, -66); ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(60, -30, 10, 7);
    ctx.strokeStyle = '#4a5066';
    ctx.beginPath(); ctx.moveTo(60, -16); ctx.lineTo(60, -30); ctx.stroke();
  }
  // gun turrets aimed up and forward
  const turrets = bs ? [-82, -56, 70] : [-52];
  for (const tx of turrets) {
    const ty = tx === -56 ? -26 : -18;
    ctx.strokeStyle = '#2a2e3e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tx - 6, ty - 5); ctx.lineTo(tx - 32, ty - 18);
    ctx.moveTo(tx - 6, ty - 2); ctx.lineTo(tx - 32, ty - 15);
    ctx.stroke();
    ctx.fillStyle = '#4a5066';
    rr(ctx, tx - 12, ty - 9, 24, 10, 4);
    ctx.fill();
    if (ship.flash && time - ship.flash < 0.12) {
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(tx - 34, ty - 17, 7, 0, TAU); ctx.fill();
    }
  }
  if (ship.sink > 0) {
    ctx.fillStyle = 'rgba(255,140,50,0.85)';
    for (let i = 0; i < 5; i++) {
      const fx = -L * 0.6 + i * L * 0.3;
      ctx.beginPath(); ctx.arc(fx, -22 - Math.random() * 8, 6 + Math.random() * 6, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
  // foam at the waterline
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x - L * s, y + 3 * s, L * 2 * s, Math.max(1.5, 2 * s));
  ctx.fillRect(x + L * s, y + 2 * s, (30 + Math.sin(time * 3) * 6) * s, Math.max(1, 1.5 * s));
}

function drawCarrier(ctx, x, y, s, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const g = ctx.createLinearGradient(0, -26, 0, 6);
  g.addColorStop(0, '#5a6278');
  g.addColorStop(1, '#262a3a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-200, -24);
  ctx.lineTo(214, -24);
  ctx.lineTo(196, 6);
  ctx.lineTo(-182, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a3f4f';
  ctx.fillRect(-206, -30, 424, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = -190; i < 200; i += 26) ctx.fillRect(i, -27, 13, 1.5);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(40, -29, 170, 1.5);
  // island
  ctx.fillStyle = '#4a5066';
  ctx.fillRect(-120, -70, 40, 40);
  ctx.fillRect(-112, -92, 22, 22);
  ctx.fillStyle = '#ffd27a';
  for (let i = 0; i < 4; i++) ctx.fillRect(-116 + i * 9, -62, 5, 3);
  ctx.strokeStyle = '#4a5066';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-101, -92); ctx.lineTo(-101, -118); ctx.moveTo(-110, -108); ctx.lineTo(-92, -108); ctx.stroke();
  ctx.fillStyle = '#ff8a3d';
  ctx.fillRect(-101, -118, 12, 7);
  // deck lights
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = Math.sin(time * 6 - i * 0.7) > 0.3 ? '#ffd27a' : '#5a4a2a';
    ctx.beginPath(); ctx.arc(60 + i * 20, -31, 2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function jetIcon(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 8 * s, y);
  ctx.lineTo(x - 6 * s, y - 2 * s);
  ctx.lineTo(x - 8 * s, y - 6 * s);
  ctx.lineTo(x - 10 * s, y - 6 * s);
  ctx.lineTo(x - 9 * s, y);
  ctx.lineTo(x - 2 * s, y + 6 * s);
  ctx.lineTo(x + 1 * s, y + 6 * s);
  ctx.lineTo(x - 1 * s, y + 1 * s);
  ctx.closePath();
  ctx.fill();
}
function shipIcon(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 10 * s, y);
  ctx.lineTo(x + 10 * s, y);
  ctx.lineTo(x + 8 * s, y + 4 * s);
  ctx.lineTo(x - 8 * s, y + 4 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - 3 * s, y - 5 * s, 6 * s, 5 * s);
  ctx.fillRect(x - 1 * s, y - 9 * s, 2 * s, 4 * s);
}

export function createJetScene() {
  let time = 0, scroll = 0, speed = 0;
  let lastPhase = null, lastRound = -1, crashTime = 0, crashPos = null, scrollAtStart = 0;
  const fx = particles();
  const clouds = Array.from({ length: 8 }, (_, i) => ({ x: hash(i, 1), y: 0.08 + hash(i, 2) * 0.4, s: 0.5 + hash(i, 3) * 0.9, f: 0.25 + hash(i, 4) * 0.7 }));
  let ships = [], enemies = [], missiles = [], wreck = null;
  let kills = { jets: 0, ships: 0 };
  let nextEnemy = 2, nextFlak = 1, nextAttack = 1.5, nextShipMid = 0, nextShipFar = 0, nextAA = 1;
  let jetY = 0;

  const resetWorld = (w) => {
    ships = [];
    enemies = [];
    missiles = [];
    wreck = null;
    kills = { jets: 0, ships: 0 };
    nextShipMid = scroll * 0.5 + w * 0.9;
    nextShipFar = scroll * 0.15 + w * 0.2;
  };

  return {
    draw(ctx, w, h, v, dt, reduced, mini) {
      time += dt;
      const horizon = h * 0.6;
      const jetSize = clamp(h * 0.15, 40, 110);
      const px = w * 0.3;
      const deckY = h * 0.78;
      const running = v.phase === 'running';

      if (v.phase !== lastPhase || v.roundId !== lastRound) {
        if (running) {
          scrollAtStart = scroll;
          nextEnemy = 1.8; nextFlak = 1.4; nextAttack = 1.4; nextAA = 0.8;
        }
        if (v.phase === 'crashed' && lastPhase === 'running') {
          crashTime = time;
          crashPos = [px, jetY];
          const tipX = px, tipY = jetY;
          for (let i = 0; i < 55; i++) {
            const a = Math.random() * TAU, sp = h * (0.1 + Math.random() * 0.6);
            fx.add({ kind: 'fire', x: tipX, y: tipY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - h * 0.05, drag: 2.8, life: 0.6 + Math.random() * 0.6, r: h * (0.012 + Math.random() * 0.026) });
          }
          for (let i = 0; i < 14; i++) {
            const a = Math.random() * TAU, sp = h * (0.05 + Math.random() * 0.2);
            fx.add({ kind: 'smoke', x: tipX, y: tipY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - h * 0.05, drag: 1.2, life: 1.6 + Math.random(), r: h * (0.03 + Math.random() * 0.04) });
          }
          for (let i = 0; i < 8; i++) {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, sp = h * (0.3 + Math.random() * 0.5);
            fx.add({ kind: 'debris', x: tipX, y: tipY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: h * 1.6, life: 2.2, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16, r: h * (0.008 + Math.random() * 0.014) });
          }
          wreck = { x: tipX, y: tipY, vx: w * 0.06, vy: -h * 0.15, rot: 0, vr: 3.2 };
          missiles = [];
        }
        if (v.phase === 'betting') { fx.clear(); resetWorld(w); }
        lastPhase = v.phase;
        lastRound = v.roundId;
      }
      if (ships.length === 0 && enemies.length === 0 && nextShipMid === 0) resetWorld(w);

      const target = running ? w * (0.22 + 0.32 * clamp(Math.log(v.mult) / Math.log(10), 0, 1.8)) : 0;
      speed = lerp(speed, target, Math.min(1, dt * 2.5));
      scroll += speed * dt;
      const sinceStart = running ? scroll - scrollAtStart : 0;

      // player altitude: on the deck, then climb out to cruise and weave
      const cruise = h * 0.4 + Math.sin(time * 1.1) * h * 0.045;
      if (v.phase === 'betting') jetY = deckY - jetSize * 0.32;
      else if (running) {
        const k = easeOut(v.tPhase / 1.4);
        jetY = lerp(deckY - jetSize * 0.32, cruise, k);
      }
      const pitch = running ? (v.tPhase < 1.4 ? -0.35 * (1 - v.tPhase / 1.4) : Math.cos(time * 1.1) * -0.08) : -0.02;

      ctx.save();
      if (v.phase === 'crashed' && !reduced) {
        const k = 1 - clamp((time - crashTime) / 0.5, 0, 1);
        ctx.translate((Math.random() - 0.5) * h * 0.035 * k, (Math.random() - 0.5) * h * 0.035 * k);
      }

      // sky
      const sg = ctx.createLinearGradient(0, 0, 0, horizon);
      C.sky.forEach((c, i) => sg.addColorStop(i / (C.sky.length - 1), c));
      ctx.fillStyle = sg;
      ctx.fillRect(-20, -20, w + 40, horizon + 20);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 24; i++) {
        const x = ((hash(i, 21) * w * 1.3 - scroll * 0.02) % (w * 1.3) + w * 1.3) % (w * 1.3);
        ctx.fillRect(x, hash(i, 22) * h * 0.25, 1.4, 1.4);
      }
      const sunX = w * 0.78, sunR = h * 0.12;
      const glow = ctx.createRadialGradient(sunX, horizon, sunR * 0.4, sunX, horizon, sunR * 3.4);
      glow.addColorStop(0, 'rgba(255,214,150,0.55)');
      glow.addColorStop(1, 'rgba(255,140,80,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sunX - sunR * 3.4, horizon - sunR * 3.4, sunR * 6.8, sunR * 3.4);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, w, horizon); ctx.clip();
      ctx.fillStyle = C.sun;
      ctx.beginPath(); ctx.arc(sunX, horizon + sunR * 0.25, sunR, 0, TAU); ctx.fill();
      ctx.restore();

      // smoke columns from burning ships on the horizon
      for (let i = 0; i < 4; i++) {
        const span = w * 1.6;
        const bx = ((hash(i, 51) * span - scroll * 0.06) % span + span) % span - w * 0.2;
        const hgt = h * (0.18 + hash(i, 52) * 0.2);
        for (let k = 0; k < 16; k++) {
          const u = k / 15;
          const yy = horizon - u * hgt;
          const xx = bx + Math.sin(time * 0.8 + k * 0.5 + i) * h * 0.012 * u - u * u * h * 0.1;
          ctx.fillStyle = `rgba(32,24,44,${0.3 * (1 - u * 0.8)})`;
          ctx.beginPath(); ctx.arc(xx, yy, h * (0.018 + u * 0.04), 0, TAU); ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,140,60,0.8)';
        ctx.beginPath(); ctx.arc(bx, horizon - 2, h * 0.008, 0, TAU); ctx.fill();
      }

      // clouds
      for (const c of clouds) {
        const span = w * 1.5;
        const cx = ((c.x * span - scroll * c.f * 0.6) % span + span) % span - w * 0.25;
        const cy = c.y * h;
        const r = h * 0.045 * c.s;
        ctx.fillStyle = c.f > 0.6 ? 'rgba(255,200,210,0.2)' : 'rgba(255,170,190,0.12)';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.arc(cx + r * 1.1, cy - r * 0.35, r * 1.2, 0, TAU);
        ctx.arc(cx + r * 2.3, cy, r * 0.9, 0, TAU);
        ctx.rect(cx, cy, r * 2.3, r * 0.9);
        ctx.fill();
      }

      // ocean
      const og = ctx.createLinearGradient(0, horizon, 0, h);
      og.addColorStop(0, '#5a3a68');
      og.addColorStop(0.25, '#2a2a55');
      og.addColorStop(1, '#0a1528');
      ctx.fillStyle = og;
      ctx.fillRect(-20, horizon, w + 40, h - horizon + 20);
      for (let j = 0; j < 22; j++) {
        const u = j / 21;
        const yy = horizon + (h - horizon) * Math.pow(u, 1.5) + 2;
        const wdt = sunR * (0.6 + u * 1.6) * (0.7 + 0.3 * Math.sin(time * 3 + j));
        ctx.fillStyle = `rgba(255,190,120,${0.5 * (1 - u)})`;
        ctx.fillRect(sunX - wdt / 2 + Math.sin(time * 2 + j) * 4, yy, wdt, Math.max(1, 1 + u * 2));
      }
      for (let j = 0; j < 12; j++) {
        const u = (j + 0.5) / 12;
        const yy = horizon + (h - horizon) * Math.pow(u, 1.4);
        const f = 0.15 + u * 0.9;
        const spacing = h * (0.12 + u * 0.3);
        const off = ((scroll * f + time * 10 * f + j * 37) % spacing + spacing) % spacing;
        ctx.strokeStyle = `rgba(200,210,255,${0.08 + u * 0.12})`;
        ctx.lineWidth = 1 + u * 1.5;
        for (let x = -off; x < w + spacing; x += spacing) {
          ctx.beginPath();
          ctx.moveTo(x, yy);
          ctx.quadraticCurveTo(x + spacing * 0.15, yy - 2 - u * 3, x + spacing * 0.3, yy);
          ctx.stroke();
        }
      }

      // enemy fleet
      {
        while (nextShipFar < scroll * 0.15 + w * 1.3) {
          ships.push({ layer: 'far', x: nextShipFar, type: Math.random() < 0.5 ? 'battleship' : 'destroyer', hp: 99, sink: 0, flash: -1, nextFire: Math.random() * 3 });
          nextShipFar += w * (0.35 + Math.random() * 0.4);
        }
        while (nextShipMid < scroll * 0.5 + w * 1.4) {
          ships.push({ layer: 'mid', x: nextShipMid, type: Math.random() < 0.55 ? 'battleship' : 'destroyer', hp: 2, sink: 0, flash: -1, nextFire: 0.5 + Math.random() * 2 });
          nextShipMid += w * (0.55 + Math.random() * 0.5);
        }
      }
      const shipPos = (s) => {
        const f = s.layer === 'far' ? 0.15 : 0.5;
        const y = s.layer === 'far' ? horizon + h * 0.025 : horizon + h * 0.16;
        const scl = s.layer === 'far' ? h * 0.0011 : h * 0.0024;
        return { x: s.x - scroll * f, y, s: scl };
      };
      ships = ships.filter((s) => shipPos(s).x > -w * 0.4 && s.sink < 1.2);
      for (const s of ships.filter((q) => q.layer === 'far')) {
        const p = shipPos(s);
        s.x -= w * 0.01 * dt;
        drawShip(ctx, p.x, p.y, p.s, s, time);
        s.nextFire -= dt;
        if (s.nextFire < 0) { s.flash = time; s.nextFire = 1.5 + Math.random() * 3; }
      }

      for (const s of ships.filter((q) => q.layer === 'mid')) {
        const p = shipPos(s);
        s.x -= w * 0.02 * dt;
        if (s.hp <= 0) s.sink = Math.min(1.3, s.sink + dt * 0.35);
        drawShip(ctx, p.x, p.y, p.s, s, time);
        // anti-aircraft fire at the player
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
        if (s.sink > 0 && Math.random() < 0.5) fx.add({ kind: 'smoke', x: p.x + (Math.random() - 0.5) * 120 * p.s, y: p.y - 30 * p.s, vx: -h * 0.02, vy: -h * 0.12, life: 1.6, r: h * 0.02 });
      }

      // allied carrier (launch deck)
      const carrierS = h * 0.0034;
      const carrierX = px + w * 0.06 - sinceStart * (running ? 1 : 0);
      if (v.phase === 'betting' || (running && carrierX > -w)) {
        drawCarrier(ctx, carrierX, deckY + 30 * carrierS, carrierS, time);
        if (v.phase === 'betting' && Math.random() < 0.5) {
          fx.add({ kind: 'steam', x: px - jetSize * 0.6 + Math.random() * jetSize * 0.4, y: deckY - 2, vx: -h * 0.05 * Math.random(), vy: -h * (0.05 + Math.random() * 0.08), life: 1, r: h * (0.01 + Math.random() * 0.015) });
        }
      }

      // enemy fighters
      if (running && !mini) {
        nextEnemy -= dt;
        if (nextEnemy <= 0) {
          nextEnemy = (1.4 + Math.random() * 2.2) / (1 + Math.log(v.mult) * 0.35);
          enemies.push({ x: w + 60, y: h * (0.14 + Math.random() * 0.36), vx: -w * (0.3 + Math.random() * 0.25), fire: 0.4 + Math.random() * 0.4, size: jetSize * (0.6 + Math.random() * 0.2), wob: Math.random() * 6, state: 'alive', rot: 0, vy: 0 });
        }
      }
      for (const e of enemies) {
        if (e.state === 'alive') {
          e.x += e.vx * dt;
          e.y += Math.sin(time * 2 + e.wob) * h * 0.02 * dt;
          e.fire -= dt;
          if (running && e.fire <= 0 && e.x < w && e.x > px + 30) {
            e.fire = 0.7 + Math.random() * 0.6;
            const a = Math.atan2(jetY - e.y, px - e.x) + (Math.random() - 0.5) * 0.45;
            for (let i = 0; i < 3; i++) fx.add({ kind: 'tracer', x: e.x, y: e.y, vx: Math.cos(a) * w * 0.9, vy: Math.sin(a) * w * 0.9, life: 0.45, delay: i * 0.05, color: '#ff8a8a' });
          }
          drawJet(ctx, e.x, e.y, e.size, 0, 0.6, ENEMY, true);
        } else {
          e.vy += h * 1.1 * dt;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.rot += dt * 4;
          if (Math.random() < 0.8) fx.add({ kind: 'smoke', x: e.x, y: e.y, vx: 0, vy: -h * 0.03, life: 1.1, r: h * 0.016 });
          drawJet(ctx, e.x, e.y, e.size, e.rot, 0, WRECK, true);
          if (e.y > horizon + h * 0.06) {
            e.gone = true;
            splash(fx, e.x, e.y, h);
          }
        }
      }
      enemies = enemies.filter((e) => !e.gone && e.x > -120);

      // player attacks: missiles at jets and ships
      if (running && !mini && v.tPhase > 1.2) {
        nextAttack -= dt;
        if (nextAttack <= 0) {
          nextAttack = (0.9 + Math.random() * 1.1) / (1 + Math.log(v.mult) * 0.45);
          const jetT = enemies.find((e) => e.state === 'alive' && e.x > px + 60 && e.x < w * 0.98 && !e.targeted);
          const shipT = ships.find((s) => s.layer === 'mid' && s.hp > 0 && !s.targeted && shipPos(s).x > px + 40 && shipPos(s).x < w * 0.95);
          const tgt = jetT && (!shipT || Math.random() < 0.6) ? { kind: 'jet', ref: jetT } : shipT ? { kind: 'ship', ref: shipT } : null;
          if (tgt) {
            tgt.ref.targeted = tgt.kind === 'jet' || tgt.ref.hp <= 1;
            missiles.push({ tgt, t0: time, dur: 0.55 + Math.random() * 0.2, sx: px + jetSize * 0.1, sy: jetY + jetSize * 0.22 });
          }
          // gun burst
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
        fx.add({ kind: 'trail', x, y, vx: -speed * 0.4, vy: 0, life: 0.5, r: h * 0.008 });
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, Math.max(2, h * 0.006), 0, TAU); ctx.fill();
        if (k >= 1) {
          m.done = true;
          boom(fx, tx, ty, h, m.tgt.kind === 'ship' ? 1.3 : 0.8);
          if (m.tgt.kind === 'jet' && m.tgt.ref.state === 'alive') {
            m.tgt.ref.state = 'falling';
            m.tgt.ref.vy = -h * 0.05;
            kills.jets += 1;
          } else if (m.tgt.kind === 'ship' && m.tgt.ref.hp > 0) {
            m.tgt.ref.hp -= 1;
            m.tgt.ref.targeted = false;
            if (m.tgt.ref.hp <= 0) kills.ships += 1;
          }
        }
      }
      missiles = missiles.filter((m) => !m.done);

      // flak around the player
      if (running && v.mult > 1.2) {
        nextFlak -= dt;
        if (nextFlak <= 0) {
          nextFlak = 0.45 + Math.random() * 0.9;
          const a = Math.random() * TAU, d = h * (0.1 + Math.random() * 0.14);
          fx.add({ kind: 'flak', x: px + Math.cos(a) * d, y: jetY + Math.sin(a) * d, vx: -speed * 0.3, vy: 0, life: 0.9, r: h * 0.03 });
        }
      }

      // player jet
      if (v.phase === 'betting') {
        drawJet(ctx, px, jetY, jetSize, -0.02, 0.25 + v.betProgress * 0.6, PLAYER);
      } else if (running) {
        drawJet(ctx, px, jetY, jetSize, pitch, 1, PLAYER);
      }

      // missile from below on the crash
      if (v.phase === 'crashed' && crashPos) {
        const tc = time - crashTime;
        if (tc < 0.45) {
          ctx.strokeStyle = `rgba(255,240,220,${0.85 * (1 - tc / 0.45)})`;
          ctx.lineWidth = Math.max(2, h * 0.006);
          ctx.beginPath();
          ctx.moveTo(crashPos[0] + w * 0.25, horizon + h * 0.12);
          ctx.quadraticCurveTo(crashPos[0] + w * 0.15, crashPos[1] + h * 0.2, crashPos[0], crashPos[1]);
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
        if (Math.random() < 0.9) {
          fx.add({ kind: 'smoke', x: wreck.x, y: wreck.y, vx: 0, vy: -h * 0.04, life: 1.4, r: h * 0.022 });
          fx.add({ kind: 'fire', x: wreck.x, y: wreck.y, vx: (Math.random() - 0.5) * h * 0.1, vy: -h * 0.05, life: 0.3, r: h * 0.012 });
        }
        drawJet(ctx, wreck.x, wreck.y, jetSize, wreck.rot, 0, WRECK);
        if (wreck.y > horizon + h * 0.2) { splash(fx, wreck.x, wreck.y, h * 1.4); wreck = null; }
      }

      // particles
      fx.update(dt);
      fx.each((p, k) => {
        if (p.kind === 'smoke' || p.kind === 'steam' || p.kind === 'trail') {
          ctx.fillStyle = p.kind === 'smoke' ? `rgba(38,26,48,${0.55 * (1 - k)})` : `rgba(235,235,245,${(p.kind === 'trail' ? 0.45 : 0.5) * (1 - k)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + k * 1.5), 0, TAU); ctx.fill();
        }
      });
      if (v.phase === 'crashed' && crashPos) {
        const tc = time - crashTime;
        if (tc < 0.35) {
          const fr = h * (0.12 + tc * 0.6);
          const fl = ctx.createRadialGradient(crashPos[0], crashPos[1], 0, crashPos[0], crashPos[1], fr);
          fl.addColorStop(0, `rgba(255,250,225,${1 - tc / 0.35})`);
          fl.addColorStop(0.4, `rgba(255,190,90,${0.8 * (1 - tc / 0.35)})`);
          fl.addColorStop(1, 'rgba(255,120,40,0)');
          ctx.fillStyle = fl;
          ctx.beginPath(); ctx.arc(crashPos[0], crashPos[1], fr, 0, TAU); ctx.fill();
        }
      }
      fx.each((p, k) => {
        if (p.kind === 'fire') {
          const col = k < 0.18 ? '255,244,200' : k < 0.45 ? '255,190,80' : k < 0.75 ? '255,112,48' : '150,40,40';
          ctx.fillStyle = `rgba(${col},${Math.min(1, 1.25 * (1 - k))})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - k * 0.45), 0, TAU); ctx.fill();
        } else if (p.kind === 'debris') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = '#5a5566';
          ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
          ctx.restore();
        } else if (p.kind === 'flak') {
          if (k < 0.15) {
            ctx.fillStyle = 'rgba(255,210,130,0.95)';
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.7, 0, TAU); ctx.fill();
          }
          ctx.fillStyle = `rgba(30,20,40,${0.6 * (1 - k)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + k), 0, TAU); ctx.fill();
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
        } else if (p.kind === 'water') {
          ctx.fillStyle = `rgba(230,240,255,${0.85 * (1 - k)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - k * 0.3), 0, TAU); ctx.fill();
        }
      });

      if (v.phase === 'crashed') {
        const tc = time - crashTime;
        const a = reduced ? 0.1 : clamp(0.32 - tc * 0.6, 0.06, 0.32);
        ctx.fillStyle = `rgba(255,60,40,${a})`;
        ctx.fillRect(-20, -20, w + 40, h + 40);
      }

      // HUD: kill tally
      if (!mini && v.phase !== 'betting') {
        const pad = h * 0.03;
        const fs = Math.max(11, Math.round(h * 0.032));
        ctx.font = `700 ${fs}px "Chakra Petch", system-ui, sans-serif`;
        const t1 = `${kills.jets} jets down`;
        const t2 = `${kills.ships} ships sunk`;
        const iw = fs * 1.6;
        const tw = Math.max(ctx.measureText(t1).width, ctx.measureText(t2).width) + iw + pad * 1.2;
        ctx.fillStyle = 'rgba(8,10,25,0.55)';
        rr(ctx, pad, pad, tw, fs * 3, 8);
        ctx.fill();
        ctx.fillStyle = '#ff8a3d';
        ctx.fillRect(pad, pad, 4, fs * 3);
        jetIcon(ctx, pad + iw * 0.6, pad + fs * 0.95, fs / 16, '#ffd9b8');
        shipIcon(ctx, pad + iw * 0.6, pad + fs * 2.15, fs / 16, '#ffd9b8');
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(t1, pad + iw + pad * 0.2, pad + fs * 0.95);
        ctx.fillText(t2, pad + iw + pad * 0.2, pad + fs * 2.15);
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

function boom(fx, x, y, h, size) {
  for (let i = 0; i < 26 * size; i++) {
    const a = Math.random() * TAU, sp = h * (0.05 + Math.random() * 0.35) * size;
    fx.add({ kind: 'fire', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - h * 0.04, drag: 3, life: 0.4 + Math.random() * 0.5, r: h * (0.008 + Math.random() * 0.018) * size });
  }
  for (let i = 0; i < 8 * size; i++) {
    fx.add({ kind: 'smoke', x: x + (Math.random() - 0.5) * h * 0.04, y, vx: (Math.random() - 0.5) * h * 0.1, vy: -h * 0.06, drag: 1, life: 1.2 + Math.random(), r: h * 0.02 * size });
  }
}

function splash(fx, x, y, h) {
  for (let i = 0; i < 18; i++) {
    fx.add({ kind: 'water', x: x + (Math.random() - 0.5) * h * 0.04, y, vx: (Math.random() - 0.5) * h * 0.25, vy: -h * (0.3 + Math.random() * 0.5), g: h * 1.8, life: 0.9, r: h * (0.006 + Math.random() * 0.01) });
  }
}
