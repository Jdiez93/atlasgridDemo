import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D, Sphere, Vector3 } from 'three';
import { hashString } from '../city/rng';
import { useAtlasStore } from '../store/useAtlasStore';
import { angleDelta } from '../sim/math';
import { roadHeight } from '../world/roads';
import { CONFIG } from '../lib/config';

const CAR_COLORS = [
  '#D9553B',
  '#F4F7FB',
  '#2A303D',
  '#7C8697',
  '#2F9BB3',
  '#E9A820',
  '#3E8E41',
  '#C23B5A',
];
const TRUCK_COLORS = ['#F4F7FB', '#E4572E', '#2A9D8F', '#8E5BD0', '#E9A820'];
export function TrafficInstances({ warehouseId }: { warehouseId: string }) {
  const bodies = useRef<InstancedMesh>(null),
    windows = useRef<InstancedMesh>(null),
    lights = useRef<InstancedMesh>(null);
  const color = useMemo(() => new Color(), []);
  const dummy = useMemo(() => new Object3D(), []),
    smooth = useMemo(() => new Map<string, { x: number; z: number; yaw: number }>(), []);
  const bounds = useMemo(() => new Sphere(new Vector3(190, 3, 0), 245), []);
  useFrame((_, dt) => {
    const cars = useAtlasStore.getState().sim.traffic.filter((a) => a.warehouseId === warehouseId);
    const blend = 1 - Math.exp(-Math.min(dt, 0.1) * 15);
    cars.forEach((a, i) => {
      let pos = smooth.get(a.id);
      if (!pos) {
        pos = { ...a.position, yaw: a.yaw };
        smooth.set(a.id, pos);
      }
      pos.x += (a.position.x - pos.x) * blend;
      pos.z += (a.position.z - pos.z) * blend;
      pos.yaw += angleDelta(pos.yaw, a.yaw) * blend;
      dummy.position.set(pos.x, roadHeight(pos) + 0.9, pos.z);
      dummy.rotation.set(0, pos.yaw, 0);
      const h = hashString(a.id);
      const bus = a.kind === 'VAN' && h % 3 === 0;
      const truck = a.kind === 'TRUCK';
      const big = bus
        ? [2.8, 3.2, 11]
        : truck
          ? [2.7, 3.6, 10]
          : a.kind === 'VAN'
            ? [2.4, 2.6, 5.4]
            : [2.25, 1.3, 4.3];
      dummy.position.y = roadHeight(pos) + big[1] / 2;
      dummy.scale.set(big[0], big[1], big[2]);
      dummy.updateMatrix();
      bodies.current?.setMatrixAt(i, dummy.matrix);
      bodies.current?.setColorAt(
        i,
        color.set(
          bus
            ? '#E9A820'
            : truck
              ? TRUCK_COLORS[h % TRUCK_COLORS.length]
              : CAR_COLORS[h % CAR_COLORS.length],
        ),
      );
      dummy.position.y += big[1] / 2 - 0.35;
      dummy.scale.set(big[0] * 0.86, 0.65, bus ? 9.4 : truck ? 2.2 : big[2] * 0.5);
      if (truck)
        dummy.position.add(
          new Vector3(Math.sin(pos.yaw) * 3.6, -big[1] / 2 + 0.9, Math.cos(pos.yaw) * 3.6),
        );
      dummy.updateMatrix();
      windows.current?.setMatrixAt(i, dummy.matrix);
      for (let side = 0; side < 2; side++) {
        const offset = side === 0 ? -1 : 1;
        dummy.position.set(
          pos.x + Math.sin(pos.yaw) * 2.15 + Math.cos(pos.yaw) * offset * 0.8,
          roadHeight(pos) + 0.72,
          pos.z + Math.cos(pos.yaw) * 2.15 - Math.sin(pos.yaw) * offset * 0.8,
        );
        dummy.scale.set(0.32, 0.2, 0.12);
        dummy.updateMatrix();
        lights.current?.setMatrixAt(i * 2 + side, dummy.matrix);
      }
    });
    for (const ref of [bodies, windows, lights])
      if (ref.current) {
        ref.current.instanceMatrix.needsUpdate = true;
        if (ref === bodies && ref.current.instanceColor)
          ref.current.instanceColor.needsUpdate = true;
        ref.current.count = ref === lights ? cars.length * 2 : cars.length;
      }
  });
  return (
    <group>
      <instancedMesh
        ref={bodies}
        args={[undefined, undefined, CONFIG.trafficPerHub]}
        boundingSphere={bounds}
        castShadow
      >
        <boxGeometry />
        <meshStandardMaterial color="#ffffff" roughness={0.5} metalness={0.2} />
      </instancedMesh>
      <instancedMesh
        ref={windows}
        args={[undefined, undefined, CONFIG.trafficPerHub]}
        boundingSphere={bounds}
      >
        <boxGeometry />
        <meshStandardMaterial color="#243D49" roughness={0.35} metalness={0.25} />
      </instancedMesh>
      <instancedMesh
        ref={lights}
        args={[undefined, undefined, CONFIG.trafficPerHub * 2]}
        boundingSphere={bounds}
      >
        <boxGeometry />
        <meshStandardMaterial color="#FFE2A7" emissive="#FFE2A7" emissiveIntensity={1.4} />
      </instancedMesh>
    </group>
  );
}
