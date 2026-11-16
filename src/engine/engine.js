// Jet Fight Empire round engine, driven by the GameEngineAPI.
//
// The server decides everything that matters: when rounds start and end, the
// crash point, which bets are accepted, cash-out multipliers, wins and the
// balance. This module mirrors that state for the UI and animates between the
// server's ticks with the same growth curve the server uses.

import { LiveCrashClient, GAME_ID } from '../api/liveCrash';
import { wallet } from './wallet';
import { sfx, music } from './sound';
import { toast } from './toasts';

// Defaults until the server's config arrives (same values as appsettings.json).
let K = 0.085;
let BET_MS = 6000;

export const multAt = (seconds) => Math.exp(K * Math.max(0, seconds));
export const timeFor = (mult) => Math.log(mult) / K;
const r2 = (n) => Math.round(n * 100) / 100;

const SLOT_KEYS = ['A', 'B'];
const slotIndex = (k) => SLOT_KEYS.indexOf(k);
const AVATAR_HUES = [12, 38, 160, 195, 220, 265, 300, 330, 85, 0];
const hueFor = (name) => AVATAR_HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_HUES.length];
const mask = (name) => (name.length <= 2 ? name + '***' : name.slice(0, 2) + '***');
const PHASE = { BETTING: 'betting', FLYING: 'running', CRASHED: 'crashed' };

function newSlot(amount) {
  // status: idle | pending (in, waiting for the round to start) | live (running)
  // queued: pending on this page only; sent to the server when betting opens.
  return { amount, autoCash: false, autoCashAt: 2, autoBet: false, status: 'idle', stake: 0, last: null, betId: null, serverAuto: null, queued: false, busy: false };
}

export function createEngine(id, label) {
  const client = new LiveCrashClient(GAME_ID);
  const st = {
    conn: 'connecting',
    connMessage: 'Connecting to the game server…',
    phase: 'betting',
    phaseStart: performance.now(),
    roundId: 0,
    crashPoint: null,
    history: [],
    bets: { A: newSlot(10), B: newSlot(50) },
    players: new Map(),
    myLog: [],
    mult: 1,
    limits: { minBet: 1, maxBet: 10000, maxWin: 500000, minAutoCashOut: 1.01, maxMultiplier: 1000, slots: 2, betSeconds: 6 },
    fairness: { hash: '', nonce: null, prevSeed: '', prevHash: '' },
    me: '',
    lastWin: null,
  };
  const settled = new Set();
  let audible = false;
  let lastEmit = 0;
  let lastTickSecond = -1;
  const listeners = new Set();
  let snap = null;

  function makeSnap() {
    snap = {
      id,
      conn: st.conn,
      connMessage: st.connMessage,
      phase: st.phase,
      phaseStart: st.phaseStart,
      roundId: st.roundId,
      crashPoint: st.phase === 'crashed' ? st.crashPoint : null,
      mult: st.mult,
      history: st.history.slice(0, 40),
      bets: { A: { ...st.bets.A }, B: { ...st.bets.B } },
      bots: [...st.players.values()],
      myLog: st.myLog.slice(0, 40),
      limits: { ...st.limits },
      fairness: { ...st.fairness },
    };
  }
  function emit() {
    lastEmit = performance.now();
    makeSnap();
    listeners.forEach((l) => l());
  }
  makeSnap();

  function play(name) { if (audible) sfx[name](); }

  function record(slot, entry) {
    st.myLog.unshift({ round: entry.round ?? st.roundId, slot, ...entry, time: Date.now() });
    if (st.myLog.length > 60) st.myLog.length = 60;
  }

  // ── Server events ────────────────────────────────────────────────────────

  function applyRound(r, fromSnapshot = false) {
    const prev = st.phase;
    const phase = PHASE[r.status] || 'betting';
    st.roundId = r.id;
    if (r.serverSeedHash) st.fairness.hash = r.serverSeedHash;
    st.fairness.nonce = r.nonce ?? null;
    st.phase = phase;
    if (phase === 'betting') {
      st.phaseStart = client.toLocal(r.phaseEndsAt) - BET_MS;
      st.crashPoint = null;
      st.mult = 1;
      if (prev !== 'betting' || fromSnapshot) {
        st.players.clear();
        lastTickSecond = -1;
        if (!fromSnapshot) sendQueuedAndAuto();
      }
    } else if (phase === 'running') {
      st.phaseStart = client.toLocal(r.startedAt);
      for (const k of SLOT_KEYS) {
        const b = st.bets[k];
        if (b.status === 'pending' && b.queued) continue; // waits for the next round
        if (b.status === 'pending') b.status = 'live';
      }
      if (prev !== 'running' && !fromSnapshot) play('launch');
    } else {
      st.phaseStart = client.toLocal(r.crashedAt ?? Date.now() + client.offset);
      st.crashPoint = Number(r.crashPoint);
      st.mult = st.crashPoint;
      if (prev !== 'crashed' && !fromSnapshot) {
        st.history.unshift(st.crashPoint);
        if (st.history.length > 60) st.history.length = 60;
        let lost = false;
        for (const k of SLOT_KEYS) {
          const b = st.bets[k];
          if (b.status === 'live') { settleLoss(k, b.betId, b.stake, st.crashPoint, r.id); lost = true; }
        }
        play('crash');
        if (lost) play('lose');
      }
    }
    emit();
  }

  function settleWin(k, betId, stake, at, win, round) {
    if (betId && settled.has(betId)) return;
    if (betId) settled.add(betId);
    const b = st.bets[k];
    if (b.betId === betId) { b.status = 'idle'; b.betId = null; b.stake = 0; }
    b.last = { type: 'win', amount: win, at, stake };
    st.lastWin = { seq: (st.lastWin?.seq ?? 0) + 1, amount: win, at };
    record(k, { stake, at, win, round });
    play('cash');
  }

  function settleLoss(k, betId, stake, at, round) {
    if (betId && settled.has(betId)) return;
    if (betId) settled.add(betId);
    const b = st.bets[k];
    if (b.betId === betId) { b.status = 'idle'; b.betId = null; b.stake = 0; }
    b.last = { type: 'loss', amount: stake, at, stake };
    record(k, { stake, at, win: 0, crashed: true, round });
  }

  function applyMyBet(bet, balance) {
    wallet.set(balance);
    const k = SLOT_KEYS[bet.slot];
    if (!k) return;
    const amount = Number(bet.amount);
    if (bet.status === 'CashedOut') {
      const at = Number(bet.cashedOutAt);
      const win = bet.win !== null && bet.win !== undefined ? Number(bet.win) : r2(amount * at);
      settleWin(k, bet.id, amount, at, win, bet.roundId);
    } else if (bet.status === 'Lost') {
      settleLoss(k, bet.id, amount, st.crashPoint ?? 1, bet.roundId);
    } else if (bet.status === 'Cancelled') {
      const b = st.bets[k];
      if (b.betId === bet.id) { b.status = 'idle'; b.betId = null; b.stake = 0; }
    } else if (bet.status === 'Active' && bet.roundId === st.roundId) {
      const b = st.bets[k];
      b.betId = bet.id;
      b.stake = amount;
      b.serverAuto = bet.autoCashOut;
      b.queued = false;
      b.status = st.phase === 'running' ? 'live' : 'pending';
    }
    emit();
  }

  function upsertPlayer(pb) {
    if (pb.roundId !== st.roundId) return;
    if (st.me && pb.player === st.me) return; // shown as "You"
    const key = `${pb.player}:${pb.slot}`;
    st.players.set(key, {
      id: key,
      name: pb.player,
      hue: hueFor(pb.player),
      amount: Number(pb.amount),
      cashedAt: pb.cashedOutAt !== null && pb.cashedOutAt !== undefined ? Number(pb.cashedOutAt) : null,
    });
  }

  function applySnapshot(s) {
    const c = s.config;
    K = c.growthRate;
    BET_MS = c.bettingMs;
    st.limits = { minBet: c.minBet, maxBet: c.maxBet, maxWin: c.maxWin, minAutoCashOut: c.minAutoCashOut, maxMultiplier: c.maxMultiplier, slots: c.slots, betSeconds: c.bettingMs / 1000 };
    const fair = s.state.fairness || {};
    st.fairness.hash = fair.currentServerSeedHash || st.fairness.hash;
    st.fairness.prevSeed = fair.previousServerSeed?.serverSeed || '';
    st.fairness.prevHash = fair.previousServerSeed?.hash || '';
    st.me = mask(s.player.username || '');
    wallet.setCurrency(s.player.currency);
    wallet.set(s.balance);
    st.history = s.state.history.map((h) => Number(h.crashPoint));
    for (const k of SLOT_KEYS) {
      const b = st.bets[k];
      b.amount = Math.min(Math.max(b.amount, c.minBet), c.maxBet);
      b.status = 'idle'; b.betId = null; b.stake = 0; b.queued = false;
    }
    applyRound(s.state.round, true);
    st.players.clear();
    for (const pb of s.state.bets) upsertPlayer(pb);
    for (const bet of s.state.myBets) {
      if (bet.roundId === st.roundId && bet.status === 'Active') applyMyBet(bet, null);
    }
    if (s.state.multiplier !== null && s.state.multiplier !== undefined) st.mult = Number(s.state.multiplier);
    emit();
  }

  client.handlers = {
    round: (r) => applyRound(r),
    tick: (m) => { st.mult = m; },
    myBet: applyMyBet,
    betPlaced: (pb) => { upsertPlayer(pb); emit(); },
    cashedOut: (pb) => { upsertPlayer(pb); emit(); },
    resync: applySnapshot,
    status: (state, message) => {
      st.conn = state;
      st.connMessage = message || '';
      emit();
    },
  };

  // ── Player actions ───────────────────────────────────────────────────────

  async function send(k, silent) {
    const b = st.bets[k];
    const amt = r2(b.amount);
    b.busy = true;
    b.queued = false;
    b.status = 'pending';
    b.stake = amt;
    emit();
    const auto = b.autoCash ? r2(Math.max(b.autoCashAt, st.limits.minAutoCashOut)) : null;
    try {
      const res = await client.placeBet(slotIndex(k), amt, auto);
      wallet.set(res.balance);
      if (!res.ok) {
        b.status = 'idle'; b.stake = 0; b.autoBet = false;
        toast({ kind: 'error', game: label, text: res.error || 'Your bet was not accepted.' });
      } else {
        b.betId = res.bet.id;
        b.serverAuto = res.bet.autoCashOut;
        b.status = st.phase === 'running' && res.bet.roundId === st.roundId ? 'live' : 'pending';
        if (!silent) play('bet');
      }
    } catch (e) {
      b.status = 'idle'; b.stake = 0; b.autoBet = false;
      toast({ kind: 'error', game: label, text: e.message || "Can't reach the game server." });
    } finally {
      b.busy = false;
      emit();
    }
  }

  // Betting just opened: send bets queued during the last round, then auto bets.
  function sendQueuedAndAuto() {
    for (const k of SLOT_KEYS) {
      const b = st.bets[k];
      if (b.busy) continue;
      if (b.status === 'pending' && b.queued) send(k, false);
      else if (b.status === 'idle' && b.autoBet) send(k, true);
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

    async connect() {
      try {
        applySnapshot(await client.connect());
      } catch (e) {
        st.conn = 'offline';
        st.connMessage = e.message || "Can't reach the game server.";
        emit();
      }
    },

    // Live values for animation (read every frame, never stale).
    view(now) {
      const tPhase = (now - st.phaseStart) / 1000;
      let mult = 1;
      if (st.phase === 'running') mult = Math.min(multAt(tPhase), st.limits.maxMultiplier);
      else if (st.phase === 'crashed') mult = st.crashPoint ?? 1;
      return {
        phase: st.phase,
        tPhase,
        runT: st.phase === 'running' ? tPhase : st.phase === 'crashed' ? timeFor(st.crashPoint ?? 1) : 0,
        mult,
        betLeft: st.phase === 'betting' ? Math.max(0, BET_MS / 1000 - tPhase) : 0,
        betProgress: st.phase === 'betting' ? Math.min(1, tPhase / (BET_MS / 1000)) : 0,
        roundId: st.roundId,
        win: st.lastWin,
        stake: ['A', 'B'].reduce((sum, k) => sum + (st.bets[k].status === 'live' ? st.bets[k].stake : 0), 0),
      };
    },
    liveStake(slotKey) {
      const b = st.bets[slotKey];
      return b.status === 'live' ? b.stake : 0;
    },

    // Called every frame: countdown sounds, auto cash-out switched on after the
    // bet was placed, and a throttled refresh while the jet is flying.
    tick(now) {
      if (st.phase === 'betting') {
        const sec = Math.ceil(BET_MS / 1000 - (now - st.phaseStart) / 1000);
        if (sec !== lastTickSecond && sec <= 3 && sec > 0) { lastTickSecond = sec; play('tick'); }
      } else if (st.phase === 'running') {
        const m = multAt((now - st.phaseStart) / 1000);
        for (const k of SLOT_KEYS) {
          const b = st.bets[k];
          if (b.status === 'live' && !b.busy && b.autoCash && b.serverAuto === null && m >= b.autoCashAt) engine.cashOut(k);
        }
        if (now - lastEmit > 100) emit();
      }
      if (audible) {
        music.setMode(st.phase);
        if (st.phase === 'running') music.setMult(Math.min(multAt((now - st.phaseStart) / 1000), st.limits.maxMultiplier));
      }
    },

    placeBet(slotKey) {
      const b = st.bets[slotKey];
      if (b.status !== 'idle' || b.busy) return;
      if (st.conn !== 'online') { toast({ kind: 'error', game: label, text: "Can't reach the game server." }); return; }
      const amt = r2(b.amount);
      const bal = wallet.get();
      if (amt < st.limits.minBet) { toast({ kind: 'error', game: label, text: `Minimum bet is ${st.limits.minBet.toFixed(2)}` }); return; }
      if (bal !== null && amt > bal + 1e-9) { toast({ kind: 'error', game: label, text: 'Not enough balance for that bet.' }); return; }
      if (st.phase === 'betting') { send(slotKey, false); return; }
      // The round is running: join the next one.
      b.status = 'pending';
      b.queued = true;
      b.stake = amt;
      play('bet');
      emit();
    },
    async cancelBet(slotKey) {
      const b = st.bets[slotKey];
      if (b.status !== 'pending' || b.busy) return;
      b.autoBet = false;
      if (b.queued) {
        b.status = 'idle'; b.queued = false; b.stake = 0;
        play('cancel');
        emit();
        return;
      }
      b.busy = true;
      emit();
      try {
        const res = await client.cancelBet(slotIndex(slotKey));
        wallet.set(res.balance);
        if (res.ok) {
          b.status = 'idle'; b.betId = null; b.stake = 0;
          play('cancel');
        } else {
          toast({ kind: 'error', game: label, text: res.error || "That bet can't be cancelled now." });
        }
      } catch (e) {
        toast({ kind: 'error', game: label, text: e.message || "Can't reach the game server." });
      } finally {
        b.busy = false;
        emit();
      }
    },
    async cashOut(slotKey) {
      const b = st.bets[slotKey];
      if (b.status !== 'live' || st.phase !== 'running' || b.busy) return;
      b.busy = true;
      const betId = b.betId;
      const stake = b.stake;
      const round = st.roundId;
      emit();
      try {
        const res = await client.cashOut(slotIndex(slotKey));
        wallet.set(res.balance);
        if (res.ok) {
          settleWin(slotKey, betId, stake, Number(res.multiplier), Number(res.win), round);
        } else if (st.bets[slotKey].status === 'live') {
          toast({ kind: 'error', game: label, text: res.error || 'Too late to cash out.' });
        }
      } catch (e) {
        toast({ kind: 'error', game: label, text: e.message || "Can't reach the game server." });
      } finally {
        b.busy = false;
        emit();
      }
    },
    configure(slotKey, patch) {
      Object.assign(st.bets[slotKey], patch);
      emit();
    },
  };
  return engine;
}

export const engines = {
  jet: createEngine('jet', 'Jet Fight Empire'),
};
