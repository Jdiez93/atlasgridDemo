import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAtlasStore } from '../store/useAtlasStore';
export function LoadingScreen() {
  const ready = useAtlasStore((s) => s.ready);
  const [fonts, setFonts] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let mounted = true;
    void document.fonts.ready.then(() => {
      if (mounted) setFonts(true);
    });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (ready && fonts) {
      const timer = setTimeout(() => setDone(true), 300);
      return () => clearTimeout(timer);
    }
  }, [ready, fonts]);
  const progress = ready && fonts ? 100 : fonts ? 70 : 20;
  return (
    <AnimatePresence>
      {!done && (
        <motion.div className="loading-screen" exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
          <div className="loading-logo">
            <img src="/logo.svg" alt="AtlasGrid" />
            <div>
              <strong>ATLASGRID</strong>
              <span>OPERATIONS CONTROL</span>
            </div>
          </div>
          <div className="loading-line">
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="loading-status">
            <span>
              {ready
                ? 'Connected. Welcome, Alex.'
                : fonts
                  ? 'Building procedural network…'
                  : 'Preparing control room…'}
            </span>
            <b className="mono">{progress}%</b>
          </div>
          <div className="loading-skeletons">
            <i />
            <i />
            <i />
          </div>
          <span className="loading-caption">3 HUBS · 4 TRUCKS · ONE CONNECTED NETWORK</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
