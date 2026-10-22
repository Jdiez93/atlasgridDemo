import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D } from 'three';
import type { Inst } from '../../city/scenery';
import { useAtlasStore } from '../../store/useAtlasStore';

type Shape = 'box' | 'cone' | 'sphere' | 'cylinder';
/** Instancias estáticas con color por instancia (contenedores, rascacielos, colinas…). */
export function ColoredInstances({
  items,
  shape = 'box',
  roughness = 0.75,
  metalness = 0.05,
  emissive = 0,
  castShadow = true,
  receiveShadow = true,
}: {
  items: Inst[];
  shape?: Shape;
  roughness?: number;
  metalness?: number;
  /** Intensidad emisiva (se atenúa de día). */
  emissive?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((item, i) => {
      dummy.position.set(...item.position);
      dummy.scale.set(...item.scale);
      dummy.rotation.set(0, item.yaw ?? 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(item.color));
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, dummy, color]);
  const mat = useRef<{ emissiveIntensity: number } | null>(null);
  useFrame(() => {
    if (!emissive || !mat.current) return;
    const s = useAtlasStore.getState();
    mat.current.emissiveIntensity = s.night ? emissive : emissive * 0.15;
  });
  if (!items.length) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      frustumCulled
    >
      {shape === 'box' && <boxGeometry args={[1, 1, 1]} />}
      {shape === 'cone' && <coneGeometry args={[1, 1, 7]} />}
      {shape === 'sphere' && <sphereGeometry args={[1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />}
      {shape === 'cylinder' && <cylinderGeometry args={[1, 1, 1, 14]} />}
      <meshStandardMaterial
        ref={mat as never}
        color="#ffffff"
        roughness={roughness}
        metalness={metalness}
        emissive={emissive ? '#FFE2A7' : '#000000'}
        emissiveIntensity={0}
      />
    </instancedMesh>
  );
}
/** Tiempo visual suave (60 fps) anclado al reloj de simulación (10 Hz): sin tirones en las coreografías. */
export const cityClock = { t: 0 };
export function CityClock() {
  useFrame((_, dt) => {
    const s = useAtlasStore.getState();
    if (s.speed > 0) cityClock.t += Math.min(dt, 0.1) * s.speed;
    const drift = s.sim.time - cityClock.t;
    if (Math.abs(drift) > 2) cityClock.t = s.sim.time;
    else cityClock.t += drift * 0.02;
  }, -2);
  return null;
}
