import { useMemo } from 'react';
import { useAtlasStore } from '../../store/useAtlasStore';
import { ROAD_GRAPH, roadNode } from '../../world/roads';
import { hashString, mulberry32 } from '../../city/rng';
import type { Inst } from '../../city/scenery';
import { tiledTexture } from '../textures';
import { ColoredInstances } from './ColoredInstances';

/** Plano de césped/arena con variación tonal procedural. */
export function GroundPlane({
  color,
  y,
  size,
  center = [0, 0],
}: {
  color: string;
  y: number;
  size: number;
  center?: [number, number];
}) {
  const map = useMemo(() => tiledTexture('grass', color, size, size, 14), [color, size]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center[0], y, center[1]]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial map={map} roughness={1} />
    </mesh>
  );
}
/** Losa de hormigón con juntas y manchas. */
export function ConcreteSlab({
  position,
  size,
  color = '#767D8C',
}: {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
}) {
  const map = useMemo(() => tiledTexture('concrete', color, size[0], size[2], 9), [color, size]);
  return (
    <mesh position={position} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial map={map} roughness={0.92} metalness={0.02} />
    </mesh>
  );
}
/** Desgaste del asfalto: parches, manchas de aceite y roderas a lo largo de las carreteras. */
export function RoadWear({ seed }: { seed: string }) {
  const items = useMemo<Inst[]>(() => {
    const rand = mulberry32(hashString(`wear:${seed}`));
    const out: Inst[] = [];
    for (const e of ROAD_GRAPH.edges) {
      if (e.from > e.to || e.kind === 'bridge') continue;
      const a = roadNode(e.from),
        b = roadNode(e.to);
      const n = Math.floor(e.length / 7);
      for (let i = 0; i < n; i++) {
        const f = rand();
        const lane = (rand() > 0.5 ? 1 : -1) * (1.6 + rand() * 1.6);
        const x = a.x + (b.x - a.x) * f + (e.axis === 'z' ? lane : 0);
        const z = a.z + (b.z - a.z) * f + (e.axis === 'x' ? lane : 0);
        const patch = rand() > 0.55;
        out.push({
          position: [x, 0.075, z],
          scale:
            e.axis === 'x'
              ? [
                  patch ? 4 + rand() * 6 : 2 + rand() * 3,
                  0.03,
                  patch ? 2 + rand() * 2 : 0.5 + rand(),
                ]
              : [
                  patch ? 2 + rand() * 2 : 0.5 + rand(),
                  0.03,
                  patch ? 4 + rand() * 6 : 2 + rand() * 3,
                ],
          color: patch ? (rand() > 0.5 ? '#3A4052' : '#555C70') : '#2B303D',
        });
      }
    }
    return out;
  }, [seed]);
  return <ColoredInstances items={items} castShadow={false} roughness={0.95} />;
}
/** Charcos reflectantes cuando llueve. */
export function Puddles({
  area,
  count = 26,
  seed,
}: {
  area: [number, number, number, number];
  count?: number;
  seed: string;
}) {
  const rain = useAtlasStore((s) => s.sim.weather === 'rain');
  const items = useMemo(() => {
    const rand = mulberry32(hashString(`puddle:${seed}`));
    return Array.from({ length: count }, () => ({
      x: area[0] + rand() * (area[1] - area[0]),
      z: area[2] + rand() * (area[3] - area[2]),
      r: 1.6 + rand() * 3.4,
      s: 0.5 + rand() * 0.5,
    }));
  }, [area, count, seed]);
  if (!rain) return null;
  return (
    <group>
      {items.map((p, i) => (
        <mesh
          key={i}
          position={[p.x, 0.11, p.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[p.r, p.r * p.s, 1]}
        >
          <circleGeometry args={[1, 20]} />
          <meshStandardMaterial
            color="#20293A"
            roughness={0.04}
            metalness={0.9}
            envMapIntensity={2.2}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
    </group>
  );
}
