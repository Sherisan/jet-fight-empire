// Tiny synthesized sound kit (Web Audio). No audio files needed.
const KEY = 'jetfightempire.v1.muted';
let ctx = null;
let muted = false;
try { muted = localStorage.getItem(KEY) === '1'; } catch {}
const listeners = new Set();

function ac() {
  if (!ctx) {
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (C) ctx = new C();
    } catch { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Browsers only allow audio after a user gesture: call this from any click.
export function unlockAudio() { ac(); }

function tone({ freq = 440, to = null, dur = 0.15, type = 'sine', gain = 0.07, delay = 0 }) {
  const c = ctx;
  if (!c || muted || c.state !== 'running') return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise({ dur = 0.5, gain = 0.12, freq = 900, delay = 0 }) {
  const c = ctx;
  if (!c || muted || c.state !== 'running') return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t0);
  f.frequency.exponentialRampToValueAtTime(80, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
}

export const sfx = {
  bet() { tone({ freq: 520, dur: 0.07, type: 'triangle', gain: 0.06 }); },
  cancel() { tone({ freq: 380, to: 240, dur: 0.12, type: 'triangle', gain: 0.05 }); },
  tick() { tone({ freq: 880, dur: 0.05, type: 'square', gain: 0.025 }); },
  launch() {
    tone({ freq: 180, to: 720, dur: 0.45, type: 'sawtooth', gain: 0.035 });
    noise({ dur: 0.4, gain: 0.04, freq: 2400 });
  },
  cash() {
    tone({ freq: 784, dur: 0.12, type: 'triangle', gain: 0.07 });
    tone({ freq: 1175, dur: 0.22, type: 'triangle', gain: 0.07, delay: 0.08 });
    tone({ freq: 1568, dur: 0.3, type: 'sine', gain: 0.04, delay: 0.16 });
  },
  crash() {
    noise({ dur: 0.9, gain: 0.22, freq: 1400 });
    tone({ freq: 140, to: 40, dur: 0.6, type: 'sine', gain: 0.14 });
  },
  lose() { tone({ freq: 300, to: 150, dur: 0.3, type: 'triangle', gain: 0.04, delay: 0.1 }); },
};

export const sound = {
  isMuted: () => muted,
  toggle() {
    muted = !muted;
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch {}
    if (!muted) { ac(); sfx.bet(); }
    listeners.forEach((l) => l());
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
