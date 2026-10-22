import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, Group } from 'three';
import { useAtlasStore } from '../store/useAtlasStore';
export function Weather() {
  const weather = useAtlasStore((s) => s.sim.weather),
    view = useAtlasStore((s) => s.view),
    quality = useAtlasStore((s) => s.quality);
  const group = useRef<Group>(null);
  const positions = useMemo(() => {
    const count = quality === 'low' ? 90 : 260,
      a = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const x = ((i * 137) % 400) - 90,
        z = ((i * 173) % 280) - 135,
        y = (i * 13) % 80;
      a.set([x, y, z, x + 0.2, y + 2.3, z + 0.1], i * 6);
    }
    return new BufferAttribute(a, 3);
  }, [quality]);
  useFrame((_, dt) => {
    if (group.current) {
      group.current.position.y -= dt * useAtlasStore.getState().speed * 15;
      if (group.current.position.y < -80) group.current.position.y = 0;
    }
  });
  if (weather !== 'rain' || view === 'world') return null;
  return (
    <group ref={group}>
      <lineSegments>
        <bufferGeometry>
          <primitive attach="attributes-position" object={positions} />
        </bufferGeometry>
        <lineBasicMaterial color="#88BCCA" transparent opacity={0.3} />
      </lineSegments>
    </group>
  );
}
