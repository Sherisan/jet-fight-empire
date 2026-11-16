import { useEffect, useState, useSyncExternalStore } from 'react';
import { wallet } from './engine/wallet';
import { sound } from './engine/sound';
import { toastStore } from './engine/toasts';

export const useEngine = (engine) => useSyncExternalStore(engine.subscribe, engine.getSnapshot);
export const useBalance = () => useSyncExternalStore(wallet.subscribe, wallet.get);
export const useMuted = () => useSyncExternalStore(sound.subscribe, sound.isMuted);
export const useMusic = () => useSyncExternalStore(sound.subscribe, sound.isMusicOn);
export const useVolume = () => useSyncExternalStore(sound.subscribe, sound.getVolume);
export const useToasts = () => useSyncExternalStore(toastStore.subscribe, toastStore.get);

export function useHash() {
  const read = () => (typeof location !== 'undefined' ? location.hash.replace(/^#/, '') : '');
  const [h, setH] = useState(read);
  useEffect(() => {
    const on = () => setH(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return h;
}

export function useReducedMotion() {
  const q = () => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  };
  const [r, setR] = useState(q);
  useEffect(() => {
    let m;
    try { m = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { return; }
    const on = () => setR(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return r;
}

export const money = (n) =>
  Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const tier = (m) => (m >= 10 ? 'high' : m >= 2 ? 'mid' : 'low');
