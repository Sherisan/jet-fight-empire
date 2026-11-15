export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeOutBack = (t) => {
  t = clamp(t, 0, 1);
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// Deterministic pseudo-random from an integer, for scenery that must not flicker.
export function hash(i, salt = 0) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function limb(ctx, pts, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

// Two-segment leg/arm: angles measured from straight down, positive swings forward (right).
export function joint(x, y, angle, len) {
  return [x + Math.sin(angle) * len, y + Math.cos(angle) * len];
}

export function makeStars(n, seed) {
  const s = [];
  for (let i = 0; i < n; i++) s.push({ x: hash(i, seed), y: hash(i, seed + 1), r: 0.4 + hash(i, seed + 2) * 1.3, tw: hash(i, seed + 3) * TAU });
  return s;
}

// Simple particle pool.
export function particles() {
  let list = [];
  return {
    add(p) { list.push({ life: 1, age: 0, rot: 0, vr: 0, g: 0, drag: 0, ...p }); },
    clear() { list = []; },
    get size() { return list.length; },
    update(dt, floorY) {
      for (const p of list) {
        p.age += dt;
        p.vy += p.g * dt;
        if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const fl = p.floor ?? floorY;
        if (fl !== undefined && p.bounce && p.y > fl) {
          p.y = fl;
          p.vy *= -p.bounce;
          p.vx *= 0.7;
          p.bounce *= 0.5;
        }
      }
      list = list.filter((p) => p.age < p.life);
    },
    each(fn) { for (const p of list) fn(p, p.age / p.life); },
    shift(dx) { for (const p of list) if (p.scroll) p.x -= dx * p.scroll; },
  };
}

export function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
