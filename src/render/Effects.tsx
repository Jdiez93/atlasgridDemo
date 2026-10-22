import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
  N8AO,
  SMAA,
  TiltShift2,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { ACESFilmicToneMapping, NoToneMapping } from 'three';
import { useAtlasStore, type Quality } from '../store/useAtlasStore';

const ORDER: Quality[] = ['low', 'medium', 'high', 'ultra'];

/** Postprocesado por nivel de calidad. En "low" se usa el tone mapping nativo. */
export function Effects() {
  const quality = useAtlasStore((s) => s.quality);
  const tilt = useAtlasStore((s) => s.tiltShift);
  const view = useAtlasStore((s) => s.view);
  const gl = useThree((s) => s.gl);
  const active = quality !== 'low';
  useEffect(() => {
    gl.toneMapping = active ? NoToneMapping : ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
  }, [gl, active]);
  if (!active) return null;
  const heavy = quality === 'high' || quality === 'ultra';
  return (
    <EffectComposer multisampling={heavy ? 0 : 4} enableNormalPass={false}>
      <>
        {heavy && (
          <N8AO
            aoRadius={view === 'warehouse' ? 2.6 : 5}
            distanceFalloff={1.2}
            intensity={view === 'world' ? 1.6 : 2.6}
            quality={quality === 'ultra' ? 'high' : 'low'}
            halfRes={quality === 'high'}
            color="#2B2A33"
          />
        )}
        <Bloom mipmapBlur intensity={0.32} luminanceThreshold={0.92} luminanceSmoothing={0.2} />
        <HueSaturation hue={0} saturation={0.1} />
        <BrightnessContrast brightness={0.01} contrast={0.07} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette eskil={false} offset={0.28} darkness={0.42} />
        {heavy && <SMAA />}
        {tilt && quality === 'ultra' ? <TiltShift2 blur={0.12} /> : <></>}
      </>
    </EffectComposer>
  );
}

/** Auto-detección: baja o sube un escalón según los FPS medidos. */
export function AutoQuality() {
  const sample = useRef({ frames: 0, time: 0, windows: 0, good: 0, warmup: 0 });
  useFrame((_, dt) => {
    const st = useAtlasStore.getState();
    if (!st.autoQuality || !st.ready) return;
    const s = sample.current;
    s.warmup += dt;
    if (s.warmup < 5 || dt > 0.3) return;
    s.frames++;
    s.time += dt;
    if (s.time < 4) return;
    const fps = s.frames / s.time;
    s.frames = 0;
    s.time = 0;
    const idx = ORDER.indexOf(st.quality);
    if (fps < 28 && idx > 0) {
      s.good = 0;
      st.setQuality(ORDER[idx - 1], false);
    } else if (fps > 57 && idx < 2) {
      s.good++;
      if (s.good >= 2) {
        s.good = 0;
        st.setQuality(ORDER[idx + 1], false);
      }
    } else s.good = 0;
  });
  return null;
}
