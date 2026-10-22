import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useAtlasStore } from '../store/useAtlasStore';
export function PerformanceCounter() {
  const { gl } = useThree();
  const shadows = useRef({ time: -1, signature: '' });
  const sample = useRef({ frames: 0, time: 0 });
  useFrame((_, dt) => {
    const s = useAtlasStore.getState(),
      signature = `${s.view}:${s.warehouseId}:${s.quality}:${s.roof}`;
    gl.shadowMap.autoUpdate = false;
    if (
      s.sim.time < shadows.current.time ||
      signature !== shadows.current.signature ||
      s.sim.time - shadows.current.time >= (s.quality === 'high' ? 0.1 : 0.2)
    ) {
      gl.shadowMap.needsUpdate = true;
      shadows.current = { time: s.sim.time, signature };
    }
    sample.current.frames++;
    sample.current.time += dt;
    if (sample.current.time >= 1) {
      if (useAtlasStore.getState().showFPS)
        useAtlasStore.setState({ fps: Math.round(sample.current.frames / sample.current.time) });
      sample.current = { frames: 0, time: 0 };
    }
  });
  return null;
}
