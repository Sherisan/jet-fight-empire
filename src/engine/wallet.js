// Demo-credit wallet shared by every game. Saved in this browser only.
const KEY = 'jetfightempire.v1.balance';
export const START_BALANCE = 1000;

const r2 = (n) => Math.round(n * 100) / 100;

function load() {
  try {
    const v = parseFloat(localStorage.getItem(KEY));
    if (Number.isFinite(v) && v >= 0) return v;
  } catch {}
  return START_BALANCE;
}

let balance = load();
const listeners = new Set();

function save() {
  try { localStorage.setItem(KEY, String(balance)); } catch {}
}
function emit() {
  save();
  listeners.forEach((l) => l());
}

export const wallet = {
  get: () => balance,
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  debit(amount) {
    amount = r2(amount);
    if (amount <= 0 || amount > balance + 1e-9) return false;
    balance = r2(balance - amount);
    emit();
    return true;
  },
  credit(amount) {
    balance = r2(balance + amount);
    emit();
  },
  reset() {
    balance = START_BALANCE;
    emit();
  },
};
