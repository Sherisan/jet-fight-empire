import { useEffect, useRef } from 'react';
import { useEngine, useReducedMotion, tier } from '../hooks';

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
      if (countRef.current && v.phase === 'betting') countRef.current.textContent = v.betLeft.toFixed(1) + 's';
      if (barRef.current && v.phase === 'betting') barRef.current.style.transform = `scaleX(${1 - v.betProgress})`;
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io?.disconnect();
    };
  }, [game, engine, mini]);

  const cp = snap.crashPoint;

  return (
    <div className={`stage${mini ? ' mini' : ''}`} data-phase={snap.phase} ref={wrapRef}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="stage-overlay" aria-hidden="true">
        {snap.phase === 'betting' && (
          <div className="ov-wait">
            <span className="ov-label">{game.waitLabel}</span>
            <span className="ov-count" ref={countRef}>6.0s</span>
            {!mini && <span className="ov-bar"><i ref={barRef} /></span>}
          </div>
        )}
        {snap.phase === 'running' && (
          <div className="ov-run">
            {!mini && <span className="ov-label">{game.runningLabel}</span>}
            <span className="ov-mult" ref={multRef} data-tier="low">1.00×</span>
          </div>
        )}
        {snap.phase === 'crashed' && cp !== null && (
          <div className="ov-crash">
            <span className="ov-verb">{game.crashVerb}</span>
            <span className="ov-mult crashed">{cp.toFixed(2)}×</span>
          </div>
        )}
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
