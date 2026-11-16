// GameEngineAPI live crash client.
//
// The game server runs the rounds: it draws each crash point with its provably
// fair RNG before betting opens, runs the clock, takes bets, pays cash-outs
// (by hand or automatic) and keeps the wallet. This module only talks to it
// over SignalR (/livecrashhub) and converts server times to this page's clock.
//
// Session: the lobby launches the game as /?token=<jwt> (the token names the
// game). In local dev, with no token in the URL, a demo token is fetched from
// the API's /api/dev-token.

import * as signalR from '@microsoft/signalr';

export const GAME_ID = 'jet-fight-empire';
export const API_BASE = (import.meta.env.VITE_GAME_API_URL || 'http://localhost:5003').replace(/\/$/, '');

export class LiveCrashClient {
  constructor(gameId) {
    this.gameId = gameId;
    this.conn = null;
    this.token = null;
    /** serverTime − Date.now(). */
    this.offset = 0;
    /** { round, tick, myBet, betPlaced, cashedOut, resync, status } */
    this.handlers = {};
  }

  /** performance.now() time of a server timestamp. */
  toLocal(serverMs) {
    return performance.now() + (serverMs - (Date.now() + this.offset));
  }

  async connect() {
    await this.loadToken();
    try {
      return await this.open();
    } catch (e) {
      // A saved dev token can outlive its 4 hours: get a fresh one.
      if (!import.meta.env.DEV) throw e;
      await this.fetchDevToken();
      return this.open();
    }
  }

  async open() {
    await this.conn?.stop().catch(() => {});
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/livecrashhub`, { accessTokenFactory: () => this.token ?? '' })
      .withAutomaticReconnect([0, 1000, 2000, 5000, 10000, 10000, 10000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();
    conn.on('Round', (r) => this.handlers.round?.(r));
    conn.on('Tick', (x) => this.handlers.tick?.(x.m, x.t));
    conn.on('MyBet', (x) => this.handlers.myBet?.(x.bet, x.balance));
    conn.on('BetPlaced', (b) => this.handlers.betPlaced?.(b));
    conn.on('CashedOut', (b) => this.handlers.cashedOut?.(b));
    conn.onreconnecting(() => this.handlers.status?.('reconnecting', 'Connection lost. Reconnecting…'));
    conn.onreconnected(async () => {
      try {
        const s = await this.snapshot();
        this.handlers.status?.('online');
        this.handlers.resync?.(s);
      } catch {
        this.handlers.status?.('offline', "Can't reach the game server.");
      }
    });
    conn.onclose(() => this.handlers.status?.('offline', 'Disconnected from the game server. Reload to play.'));
    this.conn = conn;
    await conn.start();
    const s = await this.snapshot();
    this.handlers.status?.('online');
    return s;
  }

  async snapshot() {
    const sent = Date.now();
    const s = await this.conn.invoke('GetSnapshot');
    const got = Date.now();
    this.offset = s.state.serverTime - (sent + got) / 2;
    return s;
  }

  placeBet(slot, amount, autoCashOut) {
    return this.call('PlaceBet', slot, amount, autoCashOut);
  }

  cancelBet(slot) {
    return this.call('CancelBet', slot);
  }

  cashOut(slot) {
    return this.call('CashOut', slot);
  }

  async call(method, ...args) {
    if (!this.conn || this.conn.state !== signalR.HubConnectionState.Connected) throw new Error("Can't reach the game server.");
    return this.conn.invoke(method, ...args);
  }

  get tokenKey() {
    return `gameengine_token_${this.gameId}`;
  }

  // Picks up the launch token (and drops it from the address bar so it isn't
  // shared by copying the URL), falling back to a dev token locally.
  async loadToken() {
    const key = this.tokenKey;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('token');
    if (fromUrl) {
      this.token = fromUrl;
      try { sessionStorage.setItem(key, fromUrl); } catch {}
      params.delete('token');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
    } else {
      try { this.token = sessionStorage.getItem(key); } catch { this.token = null; }
    }
    if (!this.token && import.meta.env.DEV) await this.fetchDevToken();
    if (!this.token) throw new Error('No game session. Open the game from the lobby.');
  }

  async fetchDevToken() {
    const res = await fetch(`${API_BASE}/api/dev-token?gameId=${encodeURIComponent(this.gameId)}`);
    if (!res.ok) throw new Error("Can't reach the game server.");
    this.token = (await res.json()).token;
    try { sessionStorage.setItem(this.tokenKey, this.token); } catch {}
  }
}
