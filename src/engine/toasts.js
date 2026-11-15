let items = [];
let seq = 0;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export function toast({ kind = 'info', text, game }) {
  const id = ++seq;
  items = [...items.slice(-3), { id, kind, text, game }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, kind === 'error' ? 3600 : 2800);
}

export const toastStore = {
  get: () => items,
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
