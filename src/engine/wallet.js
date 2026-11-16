// The player's balance, as last reported by the game server. The server owns
// the wallet: this only mirrors it for display.
let balance = null;
let currency = '';
const listeners = new Set();

function emit() {
  listeners.forEach((l) => l());
}

export const wallet = {
  get: () => balance,
  currency: () => currency,
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  set(value) {
    if (value === null || value === undefined) return;
    const n = Number(value);
    if (!Number.isFinite(n) || n === balance) return;
    balance = n;
    emit();
  },
  setCurrency(c) {
    currency = c || '';
    emit();
  },
};
