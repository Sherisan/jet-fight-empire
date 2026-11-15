import { wallet } from './wallet';
import { sfx } from './sound';
import { toast } from './toasts';

// Multiplier growth: m(t) = e^(K·t). 2× at ~8s, 10× at ~27s.
export const K = 0.085;
export const BET_MS = 6000;
export const CRASH_MS = 3400;
export const MAX_BET = 10000;
export const MIN_BET = 1;

export const multAt = (seconds) => Math.exp(K * Math.max(0, seconds));
export const timeFor = (mult) => Math.log(mult) / K;
const r2 = (n) => Math.round(n * 100) / 100;

// 3% house edge curve: P(crash ≥ x) = 0.97 / x.
export function genCrashPoint() {
  const u = Math.random();
  const raw = 0.97 / (1 - u);
  return Math.min(1000, Math.max(1, Math.floor(raw * 100) / 100));
}

const HANDLES = [
  'thabo', 'lerato', 'sipho', 'naledi', 'kagiso', 'zanele', 'bongani', 'ayanda', 'mpho', 'kea',
  'jordan', 'mila', 'diego', 'yuki', 'omar', 'freya', 'kofi', 'ines', 'ravi', 'luca',
  'nomsa', 'tumi', 'pieter', 'amara', 'chen', 'sofia', 'malik', 'anya', 'tariq', 'zola',
  'ace', 'blaze', 'nova', 'rook', 'viper', 'ghost', 'echo', 'jinx', 'dash', 'pixel',
];
const AVATAR_HUES = [12, 38, 160, 195, 220, 265, 300, 330, 85, 0];

function maskName(n) {
  const num = Math.floor(Math.random() * 90 + 10);
  const full = Math.random() < 0.5 ? n + num : n;
  return full[0] + '***' + full[full.length - 1];
}

function genBots() {
  const count = 16 + Math.floor(Math.random() * 26);
  const bots = [];
  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    const amount =
      roll < 0.45 ? [5, 10, 20, 25][Math.floor(Math.random() * 4)]
        : roll < 0.8 ? [50, 75, 100][Math.floor(Math.random() * 3)]
          : roll < 0.96 ? [150, 200, 250, 300][Math.floor(Math.random() * 4)]
            : [500, 1000][Math.floor(Math.random() * 2)];
    // Most players cash early, a few chase the moon.
    const greedy = Math.random();
    const target = greedy < 0.08 ? 1000 : r2(1.05 + -Math.log(1 - Math.random()) * (greedy > 0.85 ? 6 : 1.4));
    bots.push({
      id: i,
      name: maskName(HANDLES[Math.floor(Math.random() * HANDLES.length)]),
      hue: AVATAR_HUES[Math.floor(Math.random() * AVATAR_HUES.length)],
      amount,
      target,
      cashedAt: null,
    });
  }
  return bots.sort((a, b) => b.amount - a.amount);
}

function newSlot(amount) {
  return { amount, autoCash: false, autoCashAt: 2, autoBet: false, status: 'idle', stake: 0, last: null };
}

export function createEngine(id, label, offsetMs = 0) {
  const now = performance.now();
  const st = {
    phase: 'betting',
    phaseStart: now - offsetMs,
    roundId: 1,
    crashPoint: genCrashPoint(),
    history: Array.from({ length: 30 }, genCrashPoint),
    bets: { A: newSlot(10), B: newSlot(50) },
    bots: genBots(),
    myLog: [],
    mult: 1,
  };
  let audible = false;
  let lastEmit = 0;
  let lastTickSecond = -1;
  const listeners = new Set();
  let snap = null;

  function makeSnap() {
    snap = {
      id,
      phase: st.phase,
      phaseStart: st.phaseStart,
      roundId: st.roundId,
      crashPoint: st.phase === 'crashed' ? st.crashPoint : null,
      mult: st.mult,
      history: st.history.slice(0, 40),
      bets: { A: { ...st.bets.A }, B: { ...st.bets.B } },
      bots: st.bots.map((b) => ({ ...b })),
      myLog: st.myLog.slice(0, 40),
    };
  }
  function emit() {
    makeSnap();
    listeners.forEach((l) => l());
  }
  makeSnap();

  function play(name) { if (audible) sfx[name](); }

  function record(slot, entry) {
    st.myLog.unshift({ round: st.roundId, slot, ...entry, time: Date.now() });
    if (st.myLog.length > 60) st.myLog.length = 60;
  }

  function doCash(slotKey, m) {
    const b = st.bets[slotKey];
    const win = r2(b.stake * m);
    wallet.credit(win);
    b.status = 'idle';
    b.last = { type: 'win', amount: win, at: m, stake: b.stake };
    record(slotKey, { stake: b.stake, at: m, win });
    play('cash');
    toast({ kind: 'win', game: label, text: `Cashed out ${win.toFixed(2)} at ${m.toFixed(2)}×` });
  }

  function placeInternal(slotKey, silent) {
    const b = st.bets[slotKey];
    if (b.status !== 'idle') return false;
    const amt = r2(b.amount);
    if (amt < MIN_BET) { toast({ kind: 'error', game: label, text: `Minimum bet is ${MIN_BET}.00` }); return false; }
    if (!wallet.debit(amt)) {
      toast({ kind: 'error', game: label, text: 'Not enough credits for that bet. Lower it or refill your balance.' });
      return false;
    }
    b.stake = amt;
    b.status = 'pending';
    if (!silent) play('bet');
    return true;
  }

  function startRound(at) {
    st.phase = 'running';
    st.phaseStart = at;
    st.mult = 1;
    for (const k of ['A', 'B']) if (st.bets[k].status === 'pending') st.bets[k].status = 'live';
    play('launch');
  }

  function crash(at) {
    st.phase = 'crashed';
    st.phaseStart = at;
    st.mult = st.crashPoint;
    st.history.unshift(st.crashPoint);
    if (st.history.length > 60) st.history.length = 60;
    let lost = false;
    for (const k of ['A', 'B']) {
      const b = st.bets[k];
      if (b.status === 'live') {
        b.status = 'idle';
        b.last = { type: 'loss', amount: b.stake, at: st.crashPoint, stake: b.stake };
        record(k, { stake: b.stake, at: st.crashPoint, win: 0, crashed: true });
        lost = true;
      }
    }
    play('crash');
    if (lost) play('lose');
  }

  function newBetting(at) {
    st.phase = 'betting';
    st.phaseStart = at;
    st.roundId += 1;
    st.crashPoint = genCrashPoint();
    st.bots = genBots();
    st.mult = 1;
    for (const k of ['A', 'B']) {
      const b = st.bets[k];
      if (b.autoBet && b.status === 'idle') {
        if (!placeInternal(k, true)) b.autoBet = false;
      }
    }
  }

  const engine = {
    id,
    label,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot: () => snap,
    setAudible(v) { audible = v; },

    // Live values for animation (read every frame, never stale).
    view(now) {
      const tPhase = (now - st.phaseStart) / 1000;
      let mult = 1;
      if (st.phase === 'running') mult = Math.min(multAt(tPhase), st.crashPoint);
      else if (st.phase === 'crashed') mult = st.crashPoint;
      return {
        phase: st.phase,
        tPhase,
        runT: st.phase === 'running' ? tPhase : st.phase === 'crashed' ? timeFor(st.crashPoint) : 0,
        mult,
        betLeft: st.phase === 'betting' ? Math.max(0, BET_MS / 1000 - tPhase) : 0,
        betProgress: st.phase === 'betting' ? Math.min(1, tPhase / (BET_MS / 1000)) : 0,
        roundId: st.roundId,
      };
    },
    liveStake(slotKey) {
      const b = st.bets[slotKey];
      return b.status === 'live' ? b.stake : 0;
    },

    tick(now) {
      let changed = false;
      for (let guard = 0; guard < 400; guard++) {
        if (st.phase === 'betting') {
          const left = BET_MS - (now - st.phaseStart);
          const sec = Math.ceil(left / 1000);
          if (sec !== lastTickSecond && sec <= 3 && sec > 0) { lastTickSecond = sec; play('tick'); }
          if (left <= 0) { startRound(st.phaseStart + BET_MS); lastTickSecond = -1; changed = true; continue; }
          break;
        }
        if (st.phase === 'running') {
          const t = (now - st.phaseStart) / 1000;
          const m = multAt(t);
          const cp = st.crashPoint;
          const reached = Math.min(m, cp);
          for (const k of ['A', 'B']) {
            const b = st.bets[k];
            if (b.status === 'live' && b.autoCash && b.autoCashAt <= reached && b.autoCashAt < cp) {
              doCash(k, b.autoCashAt);
              changed = true;
            }
          }
          for (const bot of st.bots) {
            if (bot.cashedAt === null && bot.target <= reached && bot.target < cp) {
              bot.cashedAt = bot.target;
              changed = true;
            }
          }
          if (m >= cp) {
            crash(st.phaseStart + timeFor(cp) * 1000);
            changed = true;
            continue;
          }
          st.mult = m;
          if (now - lastEmit > 100) changed = true;
          break;
        }
        // crashed
        if (now - st.phaseStart >= CRASH_MS) {
          newBetting(st.phaseStart + CRASH_MS);
          changed = true;
          continue;
        }
        break;
      }
      if (changed) {
        lastEmit = now;
        emit();
      }
    },

    placeBet(slotKey) {
      if (placeInternal(slotKey, false)) emit();
    },
    cancelBet(slotKey) {
      const b = st.bets[slotKey];
      if (b.status !== 'pending') return;
      wallet.credit(b.stake);
      b.status = 'idle';
      b.stake = 0;
      b.autoBet = false;
      play('cancel');
      emit();
    },
    cashOut(slotKey) {
      const b = st.bets[slotKey];
      if (b.status !== 'live' || st.phase !== 'running') return;
      const m = Math.floor(multAt((performance.now() - st.phaseStart) / 1000) * 100) / 100;
      if (m >= st.crashPoint) return; // too late: the crash resolves on the next tick
      doCash(slotKey, Math.max(1, m));
      emit();
    },
    // Test hook: pin the next crash point (used by the screenshot script).
    _force(cp) { st.crashPoint = cp; },
    configure(slotKey, patch) {
      Object.assign(st.bets[slotKey], patch);
      emit();
    },
  };
  return engine;
}

export const engines = {
  jet: createEngine('jet', 'Jet Fight Empire', 0),
};
// Screenshot tests only: the single-file build sets __TEST__ when run with --test.
if (typeof __TEST__ !== 'undefined' && __TEST__ && typeof window !== 'undefined') window.__lastSecond = { engines };
