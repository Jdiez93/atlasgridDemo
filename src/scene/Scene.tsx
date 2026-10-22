import { Suspense, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, Fog, PCFSoftShadowMap } from 'three';
import { useAtlasStore } from '../store/useAtlasStore';
import { CONFIG } from '../lib/config';
import { WarehouseScene } from './WarehouseScene';
import { WorldScene } from './WorldScene';
import { PerformanceCounter } from '../render/PerformanceCounter';
import { RegionScene } from '../render/RegionScene';
import { Weather } from '../render/Weather';
import { CameraRig } from './CameraRig';
import { Clouds, Lighting, SkyDome } from '../render/Atmosphere';
import { AutoQuality, Effects } from '../render/Effects';
import { PhotoCapture } from '../ui/PhotoMode';
function Ready() {
  const { gl } = useThree();
  useEffect(() => {
    const ready = () => useAtlasStore.setState({ ready: true });
    const lost = (e: Event) => {
      e.preventDefault();
      useAtlasStore.setState({ ready: false });
    };
    gl.domElement.addEventListener('webglcontextlost', lost);
    gl.domElement.addEventListener('webglcontextrestored', ready);
    const timer = setTimeout(ready, 180);
    return () => {
      clearTimeout(timer);
      gl.domElement.removeEventListener('webglcontextlost', lost);
      gl.domElement.removeEventListener('webglcontextrestored', ready);
    };
  }, [gl]);
  return null;
}
export function Scene() {
  const view = useAtlasStore((s) => s.view);
  const photo = useAtlasStore((s) => s.photo);
  const quality = useAtlasStore((s) => s.quality),
    weather = useAtlasStore((s) => s.sim.weather);
  const [supported] = useState(() => {
    try {
      const canvas = document.createElement('canvas');
      return Boolean(canvas.getContext('webgl2'));
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!supported) useAtlasStore.setState({ ready: true });
    const params = new URLSearchParams(window.location.search);
    const hub = params.get('hub');
    if (hub && useAtlasStore.getState().sim.warehouses.some((w) => w.id === hub))
      useAtlasStore.getState().setWarehouse(hub, 'region');
    if (params.get('night') === '1' && !useAtlasStore.getState().night)
      useAtlasStore.getState().toggle('night');
    const q = params.get('q');
    if (q === 'low' || q === 'medium' || q === 'high' || q === 'ultra')
      useAtlasStore.getState().setQuality(q, true);
  }, [supported]);
  if (!supported)
    return (
      <div className="scene-fallback">
        <div className="fallback-cube">◇</div>
        <strong>WebGL 2 is unavailable</strong>
        <p>
          Enable hardware acceleration in your browser to open the 3D control room.
          <br />
          The fleet, inventory and simulation controls remain usable.
        </p>
      </div>
    );
  return (
    <div className="scene" onContextMenu={(e) => e.preventDefault()}>
      <Canvas
        shadows={quality !== 'low'}
        dpr={
          photo.busy
            ? [photo.scale, photo.scale]
            : quality === 'low'
              ? [0.8, 1]
              : quality === 'medium'
                ? [1, 1.25]
                : quality === 'high'
                  ? [1, 1.5]
                  : [1, 2]
        }
        camera={{ position: [...CONFIG.camera.warehouse], fov: 42, near: 0.1, far: 700 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
          gl.shadowMap.type = PCFSoftShadowMap;
        }}
        onPointerMissed={() => useAtlasStore.getState().select(null)}
      >
        <color attach="background" args={[CONFIG.colors.sky]} />
        <primitive
          object={
            new Fog(
              CONFIG.colors.fog,
              weather === 'fog' ? (view === 'region' ? 70 : 45) : view === 'warehouse' ? 140 : 230,
              weather === 'fog'
                ? view === 'region'
                  ? 480
                  : 200
                : view === 'warehouse'
                  ? 520
                  : 900,
            )
          }
          attach="fog"
        />
        <SkyDome />
        <Clouds />
        <Lighting />
        <CameraRig />
        <PerformanceCounter />
        <Suspense fallback={null}>
          {view === 'world' ? (
            <WorldScene />
          ) : view === 'region' ? (
            <RegionScene />
          ) : (
            <WarehouseScene />
          )}
          <Weather />
          <Ready />
          <Effects />
          <AutoQuality />
          <PhotoCapture />
        </Suspense>
      </Canvas>
    </div>
  );
}
