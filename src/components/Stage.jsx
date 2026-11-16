import { useEffect, useRef, useState } from 'react';
import { useEngine, useReducedMotion, tier } from '../hooks';

const COINS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
  const d = 90 + (i % 3) * 38;
  return { x: Math.round(Math.cos(a) * d), y: Math.round(Math.sin(a) * d * 0.7 - 30), r: (i * 47) % 360, delay: (i % 4) * 30 };
});

// Big "+12.30" pop with a coin burst whenever the player cashes out.
// Wins close together add up into one pop, which restarts its animation.
function WinPops({ log }) {
  const [pop, setPop] = useState(null);
  const seen = useRef(log[0]?.time ?? 0);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const fresh = log.filter((e) => e.time > seen.current && e.win > 0);
    if (log.length) seen.current = Math.max(seen.current, log[0].time);
    if (!fresh.length) return;
    const sum = fresh.reduce((t, e) => t + e.win, 0);
    setPop((p) => ({
      id: `${fresh[0].time}-${fresh[0].slot}`,
      win: (p ? p.win : 0) + sum,
      count: (p ? p.count : 0) + fresh.length,
      at: fresh[0].at,
    }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPop(null), 2300);
  }, [log]);
  if (!pop) return null;
  return [pop].map((p) => (
    <div key={p.id} className="win-pop">
      <span className="win-pop-label">{p.count > 1 ? `Cashed out ×${p.count}` : 'Cashed out'}</span>
      <span className="win-pop-amount">+{p.win.toFixed(2)}</span>
      <span className="win-pop-at">at {p.at.toFixed(2)}×</span>
      {COINS.map((c, k) => (
        <i key={k} className="win-coin" style={{ '--x': `${c.x}px`, '--y': `${c.y}px`, '--r': `${c.r}deg`, animationDelay: `${c.delay}ms` }} />
      ))}
    </div>
  ));
}

export default function Stage({ game, engine, mini = false }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const multRef = useRef(null);
  const countRef = useRef(null);
  const barRef = useRef(null);
  const snap = useEngine(engine);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas.getContext('2d');
    const scene = game.scene();
    let w = 0, h = 0, dpr = 1, raf = 0, last = performance.now(), visible = true;

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    };
    resize();
    // Steer the jet: it follows the mouse, or your finger on a phone.
    const aim = (e) => {
      if (mini || !scene.setPointer) return;
      const r = wrap.getBoundingClientRect();
      scene.setPointer({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
    };
    const letGo = (e) => { if (e.pointerType !== 'mouse') scene.setPointer?.(null); };
    const leave = () => scene.setPointer?.(null);
    wrap.addEventListener('pointermove', aim);
    wrap.addEventListener('pointerdown', aim);
    wrap.addEventListener('pointerup', letGo);
    wrap.addEventListener('pointercancel', leave);
    wrap.addEventListener('pointerleave', leave);
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    let io;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
      io.observe(wrap);
    }

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const v = engine.view(now);
      if (visible) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        scene.draw(ctx, w, h, v, dt, reducedRef.current, mini);
      }
      if (multRef.current && v.phase === 'running') {
        multRef.current.textContent = (Math.floor(v.mult * 100) / 100).toFixed(2) + '×';
        multRef.current.dataset.tier = tier(v.mult);
      }
      if (countRef.current && v.phase === 'betting') countRef.current.textContent = v.betLeft.toFixed(1);
      if (barRef.current && v.phase === 'betting') barRef.current.style.transform = `scaleX(${1 - v.betProgress})`;
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      wrap.removeEventListener('pointermove', aim);
      wrap.removeEventListener('pointerdown', aim);
      wrap.removeEventListener('pointerup', letGo);
      wrap.removeEventListener('pointercancel', leave);
      wrap.removeEventListener('pointerleave', leave);
      ro.disconnect();
      io?.disconnect();
    };
  }, [game, engine, mini]);

  const cp = snap.crashPoint;

  return (
    <div className={`stage${mini ? ' mini' : ''}`} data-phase={snap.phase} ref={wrapRef}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="stage-overlay" aria-hidden="true">
        {snap.conn !== 'online' && (
          <div className="ov-wait">
            <span className="ov-label">{snap.connMessage || 'Connecting to the game server…'}</span>
          </div>
        )}
        {snap.conn === 'online' && snap.phase === 'betting' && (
          <div className="ov-wait">
            <span className="ov-label">{game.waitLabel}</span>
            <span className="ov-count"><b ref={countRef}>6.0</b><small>s</small></span>
            {!mini && <span className="ov-bar"><i ref={barRef} /></span>}
            {!mini && <span className="ov-tip">Move your mouse or finger over the sky to fly the jet</span>}
          </div>
        )}
        {snap.conn === 'online' && snap.phase === 'running' && (
          <div className="ov-run">
            {!mini && <span className="ov-label">{game.runningLabel}</span>}
            <span className="ov-mult" ref={multRef} data-tier="low">1.00×</span>
          </div>
        )}
        {snap.conn === 'online' && snap.phase === 'crashed' && cp !== null && (
          <div className="ov-crash">
            <span className="ov-verb">{game.crashVerb}</span>
            <span className="ov-mult crashed">{cp.toFixed(2)}×</span>
          </div>
        )}
        {!mini && <WinPops log={snap.myLog} />}
      </div>
      {!mini && (
        <p className="sr-only" aria-live="polite">
          {snap.phase === 'crashed' && cp !== null ? `${game.crashVerb} at ${cp.toFixed(2)} times.` : ''}
          {snap.phase === 'running' ? 'Round started.' : ''}
        </p>
      )}
    </div>
  );
}
