import { useEffect } from 'react';
import { CONFIG } from './config';
import { persistSnapshot, useAtlasStore } from '../store/useAtlasStore';
export function useSimulation(): void {
  useEffect(() => {
    let last = performance.now();
    let accumulator = 0;
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min((now - last) / 1000, CONFIG.maxCatchupSeconds);
      last = now;
      const store = useAtlasStore.getState();
      if (document.hidden || store.speed === 0) {
        accumulator = 0;
        return;
      }
      accumulator += elapsed * store.speed;
      const count = Math.floor((accumulator + 1e-8) / CONFIG.tickSeconds);
      if (count > 0) {
        store.step(count);
        accumulator -= count * CONFIG.tickSeconds;
      }
    }, 100);
    const saver = window.setInterval(persistSnapshot, 2000);
    const unload = () => persistSnapshot();
    window.addEventListener('pagehide', unload);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(saver);
      window.removeEventListener('pagehide', unload);
      persistSnapshot();
    };
  }, []);
}
