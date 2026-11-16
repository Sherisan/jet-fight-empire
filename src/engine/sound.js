// Synthesized sound kit and battle soundtrack (Web Audio). No audio files needed.
const KEY = 'jetfightempire.v1.muted';
const MUSIC_KEY = 'jetfightempire.v1.music';
const VOL_KEY = 'jetfightempire.v1.volume';

let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let muted = false, musicOn = true, volume = 0.8;
try {
  muted = localStorage.getItem(KEY) === '1';
  musicOn = localStorage.getItem(MUSIC_KEY) !== '0';
  const v = parseFloat(localStorage.getItem(VOL_KEY));
  if (Number.isFinite(v)) volume = Math.min(1, Math.max(0, v));
} catch {}
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const save = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

function ac() {
  if (!ctx) {
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master = ctx.createGain();
      sfxBus = ctx.createGain();
      musicBus = ctx.createGain();
      sfxBus.connect(master);
      musicBus.connect(master);
      master.connect(comp).connect(ctx.destination);
      applyLevels();
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      music._start();
    } catch { ctx = null; return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function applyLevels() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(muted ? 0 : volume, t, 0.05);
  musicBus.gain.setTargetAtTime(musicOn ? 0.4 : 0, t, 0.1);
  sfxBus.gain.setTargetAtTime(1, t, 0.05);
}

// Browsers only allow audio after a user gesture: call this from any click.
export function unlockAudio() { ac(); }

const live = () => ctx && ctx.state === 'running' && !muted;
const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
const now = () => ctx.currentTime;

// One shaped oscillator note.
function voice(t, { type = 'sine', freq = 440, to = null, dur = 0.15, gain = 0.07, attack = 0.008, filter = null, bus = sfxBus, detune = 0 }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter.type || 'lowpass';
    f.Q.value = filter.q ?? 0.8;
    f.frequency.setValueAtTime(filter.freq, t);
    if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t + dur);
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// A burst of filtered noise.
function hiss(t, { dur = 0.3, gain = 0.1, type = 'lowpass', freq = 900, to = null, q = 0.8, bus = sfxBus, attack = 0.004 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(bus);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
}

// Rate-limit busy effects so a big dogfight doesn't turn into noise.
const lastAt = {};
const gate = (name, gap) => {
  const t = now();
  if (lastAt[name] && t - lastAt[name] < gap) return false;
  lastAt[name] = t;
  return true;
};

export const sfx = {
  bet() {
    if (!live()) return;
    const t = now();
    voice(t, { type: 'triangle', freq: 660, dur: 0.06, gain: 0.08 });
    voice(t + 0.05, { type: 'triangle', freq: 990, dur: 0.08, gain: 0.07 });
    hiss(t, { dur: 0.05, gain: 0.05, type: 'highpass', freq: 5000 });
  },
  cancel() {
    if (!live()) return;
    voice(now(), { type: 'triangle', freq: 520, to: 260, dur: 0.16, gain: 0.07 });
  },
  tick() {
    if (!live()) return;
    const t = now();
    // cockpit warning beep
    voice(t, { type: 'square', freq: 1480, dur: 0.07, gain: 0.035, filter: { freq: 3200 } });
    voice(t, { type: 'sine', freq: 740, dur: 0.1, gain: 0.05 });
  },
  launch() {
    if (!live()) return;
    const t = now();
    // catapult slam, then the afterburner roars off the deck
    voice(t, { type: 'sine', freq: 110, to: 40, dur: 0.35, gain: 0.45 });
    hiss(t, { dur: 0.12, gain: 0.25, type: 'bandpass', freq: 1800, q: 1.2 });
    hiss(t + 0.05, { dur: 1.6, gain: 0.32, type: 'bandpass', freq: 300, to: 2800, q: 0.9, attack: 0.08 });
    voice(t + 0.05, { type: 'sawtooth', freq: 70, to: 210, dur: 1.4, gain: 0.07, filter: { freq: 900 } });
  },
  cash() {
    if (!live()) return;
    const t = now();
    hiss(t, { dur: 0.08, gain: 0.12, type: 'bandpass', freq: 3500, q: 2 });
    [1568, 2093, 2637].forEach((f, i) => voice(t + 0.07 + i * 0.05, { type: 'sine', freq: f, dur: 0.6, gain: 0.08 }));
    [3136, 4186].forEach((f, i) => voice(t + 0.1 + i * 0.04, { type: 'triangle', freq: f, dur: 0.35, gain: 0.03 }));
    for (let i = 0; i < 6; i++) voice(t + 0.2 + i * 0.045, { type: 'square', freq: 2400 + Math.random() * 1600, dur: 0.05, gain: 0.015, filter: { freq: 6000 } });
  },
  crash() {
    if (!live()) return;
    const t = now();
    // missile hit: big blast, then the jet spirals down into the sea
    hiss(t, { dur: 1.6, gain: 0.6, freq: 3200, to: 70 });
    voice(t, { type: 'sine', freq: 110, to: 26, dur: 1.2, gain: 0.6 });
    voice(t + 0.1, { type: 'sawtooth', freq: 900, to: 140, dur: 1.4, gain: 0.05, filter: { freq: 1600 } });
    hiss(t + 1.3, { dur: 0.7, gain: 0.25, type: 'bandpass', freq: 900, to: 200, q: 0.6 });
  },
  lose() {
    if (!live()) return;
    const t = now() + 0.25;
    [392, 370, 349, 311].forEach((f, i) => voice(t + i * 0.16, { type: 'triangle', freq: f, dur: 0.22, gain: 0.05 }));
  },
  missile() {
    if (!live() || !gate('missile', 0.12)) return;
    const t = now();
    hiss(t, { dur: 0.45, gain: 0.12, type: 'bandpass', freq: 3500, to: 900, q: 1.4, attack: 0.01 });
    voice(t, { type: 'sawtooth', freq: 520, to: 180, dur: 0.35, gain: 0.025, filter: { freq: 2000 } });
  },
  boom() {
    if (!live() || !gate('boom', 0.08)) return;
    const t = now();
    hiss(t, { dur: 0.7, gain: 0.3, freq: 2200, to: 90 });
    voice(t, { type: 'sine', freq: 90, to: 35, dur: 0.5, gain: 0.35 });
  },
  sink() {
    if (!live()) return;
    const t = now();
    // ship blows up, then hull groans and water rushes in
    hiss(t, { dur: 1.1, gain: 0.4, freq: 1600, to: 60 });
    voice(t, { type: 'sine', freq: 70, to: 24, dur: 1.0, gain: 0.5 });
    voice(t + 0.35, { type: 'sawtooth', freq: 95, to: 55, dur: 1.2, gain: 0.05, filter: { freq: 400 } });
    hiss(t + 0.5, { dur: 1.4, gain: 0.12, type: 'bandpass', freq: 600, to: 250, q: 0.5, attack: 0.2 });
  },
  flares() {
    if (!live() || !gate('flares', 0.3)) return;
    const t = now();
    for (let i = 0; i < 4; i++) {
      hiss(t + i * 0.06, { dur: 0.1, gain: 0.12, type: 'bandpass', freq: 2600, q: 2 });
      voice(t + i * 0.06, { type: 'square', freq: 900 - i * 80, dur: 0.05, gain: 0.025, filter: { freq: 2400 } });
    }
    hiss(t + 0.05, { dur: 0.8, gain: 0.08, type: 'highpass', freq: 3000, to: 1500 });
  },
  thunder() {
    if (!live() || !gate('thunder', 1.2)) return;
    const t = now();
    hiss(t, { dur: 0.25, gain: 0.25, type: 'highpass', freq: 1500 });
    hiss(t + 0.05, { dur: 2.4, gain: 0.35, freq: 420, to: 60, attack: 0.15 });
    voice(t + 0.1, { type: 'sine', freq: 55, to: 30, dur: 1.8, gain: 0.25, attack: 0.2 });
  },
  flak() {
    if (!live() || !gate('flak', 0.18)) return;
    const t = now();
    hiss(t, { dur: 0.22, gain: 0.11, freq: 1400, to: 200 });
    voice(t, { type: 'sine', freq: 160, to: 70, dur: 0.15, gain: 0.08 });
  },
};

/* ───────── Soundtrack ───────── */
// D-minor battle theme. Betting: snare roll and a low pulse on the carrier deck.
// Flying: driving drums and bass that speed up and add brass and lead lines as
// the multiplier climbs. A jet engine drone runs underneath while airborne.

const PROG = [
  { root: 38, chord: [62, 65, 69] }, // Dm
  { root: 34, chord: [58, 62, 65] }, // Bb
  { root: 36, chord: [60, 64, 67] }, // C
  { root: 33, chord: [57, 61, 64] }, // A
];
const BASS = [0, null, 0, 0, null, 0, 12, null, 0, null, 0, 0, 10, null, 12, null];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];

export const music = (() => {
  let mode = 'off';
  let mult = 1;
  let step = 0, bar = 0, nextTime = 0, timer = null;
  let engine = null;

  const bpm = () => (mode === 'running' ? 120 + Math.min(40, Math.log(Math.max(1, mult)) * 14) : 100);

  function kick(t) { voice(t, { freq: 150, to: 42, dur: 0.3, gain: 0.9, bus: musicBus }); }
  function snare(t, g = 0.3) {
    hiss(t, { dur: 0.16, gain: g, type: 'bandpass', freq: 1900, q: 0.7, bus: musicBus });
    voice(t, { type: 'triangle', freq: 200, to: 150, dur: 0.08, gain: g * 0.55, bus: musicBus });
  }
  function hat(t, open) { hiss(t, { dur: open ? 0.22 : 0.04, gain: open ? 0.08 : 0.07, type: 'highpass', freq: 7500, bus: musicBus }); }
  function bass(t, n, len) {
    voice(t, { type: 'sawtooth', freq: mtof(n), dur: len, gain: 0.22, attack: 0.005, filter: { freq: 1200, to: 240, q: 4 }, bus: musicBus });
    voice(t, { type: 'sine', freq: mtof(n - 12), dur: len, gain: 0.2, bus: musicBus });
  }
  function brass(t, notes, len) {
    notes.forEach((n) => {
      voice(t, { type: 'sawtooth', freq: mtof(n), dur: len, gain: 0.045, attack: 0.03, filter: { freq: 2200, to: 700, q: 1.5 }, bus: musicBus, detune: -7 });
      voice(t, { type: 'sawtooth', freq: mtof(n), dur: len, gain: 0.045, attack: 0.03, filter: { freq: 2200, to: 700, q: 1.5 }, bus: musicBus, detune: 7 });
    });
  }
  function pad(t, notes, len) { notes.forEach((n) => voice(t, { type: 'triangle', freq: mtof(n - 12), dur: len, gain: 0.04, attack: 0.4, bus: musicBus })); }
  function lead(t, n) { voice(t, { type: 'square', freq: mtof(n), dur: 0.12, gain: 0.032, filter: { freq: 3200 }, bus: musicBus }); }

  function schedule(t) {
    const ch = PROG[bar % 4];
    const s16 = 60 / bpm() / 4;
    if (mode === 'betting') {
      // military snare roll building towards launch
      if (step % 2 === 0 || bar % 2 === 1) snare(t, step % 4 === 0 ? 0.16 : 0.07);
      if (step === 0 || step === 8) bass(t, ch.root, s16 * 3);
      if (step === 0) pad(t, ch.chord, s16 * 16);
      if (step === 0 && bar % 2 === 0) kick(t);
    } else if (mode === 'running') {
      const lvl = mult >= 10 ? 4 : mult >= 5 ? 3 : mult >= 2 ? 2 : 1;
      if ([0, 6, 8, 11].includes(step)) kick(t);
      if (step === 4 || step === 12) snare(t);
      if (lvl >= 4 && bar % 4 === 3 && step >= 12) snare(t, 0.22);
      if (step % 2 === 0) hat(t, step === 14);
      else if (lvl >= 3) hat(t, false);
      const b = BASS[step];
      if (b !== null) bass(t, ch.root + b, s16 * 1.6);
      if (lvl >= 2 && (step === 0 || step === 10)) brass(t, ch.chord, s16 * 3);
      if (lvl >= 3 && step % 2 === 0) lead(t, ch.chord[ARP[(step / 2) % 8]] + 12);
      if (lvl >= 4 && step % 2 === 1) lead(t, ch.chord[ARP[((step - 1) / 2 + 3) % 8]] + 24);
    }
    step = (step + 1) % 16;
    if (step === 0) bar++;
    return s16;
  }

  function tick() {
    if (!ctx || ctx.state !== 'running' || mode === 'off' || mode === 'crashed') return;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.12) nextTime += schedule(nextTime);
  }

  function stopLoop(node) {
    if (!node) return;
    const t = ctx.currentTime;
    node.g.gain.setTargetAtTime(0.0001, t, 0.08);
    node.srcs.forEach((s) => { try { s.stop(t + 0.5); } catch {} });
  }

  // Jet engine drone: filtered noise plus a low turbine whine that rises with the multiplier.
  function startEngine() {
    if (engine || !ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 700;
    f.Q.value = 0.8;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 140;
    const of = ctx.createBiquadFilter();
    of.type = 'lowpass';
    of.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(0.05, ctx.currentTime, 0.3);
    src.connect(f).connect(g);
    o.connect(of).connect(g);
    g.connect(sfxBus);
    src.start();
    o.start();
    engine = { g, f, o, srcs: [src, o] };
  }

  function stinger() {
    const t = ctx.currentTime + 0.05;
    [62, 58, 57, 50].forEach((n, i) => voice(t + i * 0.09, { type: 'sawtooth', freq: mtof(n), dur: 0.5, gain: 0.05, filter: { freq: 1800, to: 400 }, bus: musicBus }));
    voice(t, { type: 'sine', freq: mtof(26), dur: 1.4, gain: 0.3, bus: musicBus });
  }

  function apply(prev) {
    if (!ctx || ctx.state !== 'running') return;
    if (mode === 'running') startEngine(); else { stopLoop(engine); engine = null; }
    if (mode === 'running' && prev !== 'running') { step = 0; bar = 0; nextTime = ctx.currentTime + 0.05; }
    if (mode === 'betting' && prev !== 'betting') { step = 0; bar = 0; nextTime = ctx.currentTime + 0.05; }
    if (mode === 'crashed' && prev === 'running' && musicOn && !muted) stinger();
  }

  return {
    setMode(m) {
      if (m === mode) return;
      const prev = mode;
      mode = m;
      if (m !== 'running') mult = 1;
      apply(prev);
    },
    setMult(m) {
      mult = m;
      if (engine && ctx) {
        const k = Math.min(1, Math.log(Math.max(1, m)) / Math.log(20));
        const t = ctx.currentTime;
        engine.f.frequency.setTargetAtTime(700 + k * 1600, t, 0.3);
        engine.o.frequency.setTargetAtTime(140 + k * 160, t, 0.3);
      }
    },
    _start() {
      if (!timer) timer = setInterval(tick, 25);
      if (ctx) ctx.addEventListener?.('statechange', () => apply(null));
      apply(null);
    },
  };
})();

export const sound = {
  isMuted: () => muted,
  isMusicOn: () => musicOn,
  getVolume: () => volume,
  toggle() {
    muted = !muted;
    save(KEY, muted ? '1' : '0');
    if (!muted) ac();
    applyLevels();
    if (!muted) sfx.bet();
    emit();
  },
  toggleMusic() {
    musicOn = !musicOn;
    save(MUSIC_KEY, musicOn ? '1' : '0');
    ac();
    applyLevels();
    emit();
  },
  setVolume(v) {
    volume = Math.min(1, Math.max(0, v));
    save(VOL_KEY, String(volume));
    applyLevels();
    emit();
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
