import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { Group, Vector3 } from 'three';
import type { Line2 } from 'three-stdlib';
import { useAtlasStore } from '../store/useAtlasStore';
import { CONFIG } from '../lib/config';
import { calculateKPIs } from '../sim/kpis';
import { Box, InstancedBoxes, Label } from './primitives';

import type { Warehouse } from '../sim/types';
const c = CONFIG.colors;
// Stylized landmasses are hand-authored coordinates, generated as extruded procedural tiles.
const LAND = [
  [-29, -5],
  [-27, -8],
  [-24, -12],
  [-21, -12],
  [-18, -10],
  [-22, -6],
  [-25, -2],
  [-19, -4],
  [-17, 0],
  [-15, 4],
  [-14, 9],
  [-13, 12],
  [-12, 16],
  [-11, 20],
  [-9, 21],
  [-9, 15],
  [-8, 11],
  [-11, 7],
  [-5, -8],
  [-1, -10],
  [3, -11],
  [7, -11],
  [11, -10],
  [15, -9],
  [19, -7],
  [23, -7],
  [28, -5],
  [31, -2],
  [27, 1],
  [22, 2],
  [18, 3],
  [15, 6],
  [18, 10],
  [23, 14],
  [26, 17],
  [28, 21],
  [30, 25],
  [23, 26],
  [20, 22],
  [16, 21],
  [9, 7],
  [6, 3],
  [2, 3],
  [-1, 6],
  [-2, 10],
  [0, 14],
  [3, 16],
  [6, 13],
  [7, 9],
  [4, 4],
  [-3, -3],
  [-2, -5],
  [2, -6],
  [5, -7],
  [10, -5],
  [12, -1],
  [8, 1],
  [4, -1],
  [-6, -11],
  [-27, -17],
  [-24, -18],
  [-20, -17],
];
function arc(a: Warehouse, b: Warehouse, p: number): Vector3 {
  return new Vector3(
    a.map.x + (b.map.x - a.map.x) * p,
    1.4 + Math.sin(Math.PI * p) * 8,
    a.map.z + (b.map.z - a.map.z) * p,
  );
}
function WorldTruck({ id }: { id: string }) {
  const ref = useRef<Group>(null);
  const trail = useRef<Group>(null);
  useFrame(() => {
    const sim = useAtlasStore.getState().sim;
    const t = sim.trucks.find((t) => t.id === id);
    if (!t || !ref.current) return;
    const a = sim.warehouses.find((w) => w.id === t.originId)!;
    const b = sim.warehouses.find((w) => w.id === t.destinationId)!;
    const p = arc(a, b, t.routeProgress);
    ref.current.position.copy(p);
    ref.current.rotation.y = Math.atan2(b.map.x - a.map.x, b.map.z - a.map.z);
    if (trail.current) trail.current.position.copy(arc(a, b, Math.max(0, t.routeProgress - 0.045)));
  });
  const t = useAtlasStore((s) => s.sim.trucks.find((t) => t.id === id)!);
  const selected = useAtlasStore((s) => s.selection?.id === id);
  const warehouses = useAtlasStore((s) => s.sim.warehouses);
  const trailPoints = useMemo(() => {
    const a = warehouses.find((w) => w.id === t.originId)!;
    const b = warehouses.find((w) => w.id === t.destinationId)!;
    return Array.from({ length: 12 }, (_, i) =>
      arc(a, b, Math.max(0, t.routeProgress - 0.12 + (i * 0.12) / 11)),
    );
  }, [warehouses, t.originId, t.destinationId, t.routeProgress]);
  return (
    <group>
      <Line points={trailPoints} color={c.charger} lineWidth={3} transparent opacity={0.65} />
      <group
        ref={ref}
        onContextMenu={(e) => {
          e.stopPropagation();
          e.nativeEvent.preventDefault();
          useAtlasStore.getState().setContext({
            selection: { kind: 'truck', id },
            x: e.nativeEvent.clientX,
            y: e.nativeEvent.clientY,
          });
        }}
        onClick={(e) => {
          e.stopPropagation();
          useAtlasStore.getState().select({ kind: 'truck', id }, true);
        }}
      >
        <Box position={[0, 1, 0]} size={[1.5, 1.3, t.kind === 'VAN' ? 2.6 : 4.6]} color={c.truck} />
        <Box
          position={[0, 1.1, -0.6]}
          size={[1.55, 1.4, t.kind === 'VAN' ? 1.4 : 2.8]}
          color={c.trailer}
        />
        <Box position={[0, 1.86, -0.6]} size={[1.4, 0.13, 2]} color={c.emerald} emissive />
        {selected && (
          <Html position={[0, 4, 0]} center zIndexRange={[10, 0]}>
            <div className="world-truck-tag">{id}</div>
          </Html>
        )}
      </group>
      <group ref={trail}>
        <mesh>
          <sphereGeometry args={[0.28, 8, 8]} />
          <meshBasicMaterial color={c.emerald} />
        </mesh>
      </group>
    </group>
  );
}
function RouteArc({ points }: { points: Vector3[] }) {
  const ref = useRef<Line2>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.material.dashOffset -= dt * 0.6 * useAtlasStore.getState().speed;
  });
  return (
    <Line
      ref={ref}
      points={points}
      color={c.emerald}
      lineWidth={1.5}
      transparent
      opacity={0.55}
      dashed
      dashSize={0.45}
      gapSize={0.3}
    />
  );
}
export function WorldScene() {
  const sim = useAtlasStore((s) => s.sim);
  const select = useAtlasStore((s) => s.setWarehouse);
  const tiles = useMemo(
    () =>
      LAND.map(([x, z], i) => ({
        position: [x * 2.15, 0.16, z * 1.45] as [number, number, number],
        scale: [8.7, 0.3 + (i % 3) * 0.09, 5.3] as [number, number, number],
      })),
    [],
  );
  const routes = useMemo(
    () =>
      sim.warehouses.flatMap((a, i) =>
        sim.warehouses.slice(i + 1).map((b) => ({
          id: `${a.id}:${b.id}`,
          points: Array.from({ length: 65 }, (_, j) => arc(a, b, j / 64)),
        })),
      ),
    [sim.warehouses],
  );
  return (
    <group>
      <Box position={[0, -0.6, 5]} size={[180, 1.1, 112]} color="#111E30" />
      <gridHelper args={[180, 36, '#294153', '#1B2C40']} position={[0, 0.04, 5]} />
      <InstancedBoxes items={tiles} color="#24413F" />
      {routes.map((route) => (
        <RouteArc key={route.id} points={route.points} />
      ))}
      {sim.warehouses.map((w) => (
        <group
          key={w.id}
          position={[w.map.x, 1, w.map.z]}
          onContextMenu={(e) => {
            e.stopPropagation();
            e.nativeEvent.preventDefault();
            useAtlasStore.getState().setContext({
              selection: { kind: 'warehouse', id: w.id },
              x: e.nativeEvent.clientX,
              y: e.nativeEvent.clientY,
            });
          }}
          onClick={(e) => {
            e.stopPropagation();
            select(w.id, 'region');
          }}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
            <ringGeometry args={[2.6, 2.8, 48]} />
            <meshBasicMaterial color={c.emerald} />
          </mesh>
          <Box position={[0, 0.65, 0]} size={[2.9, 1.5, 2.6]} color={c.warehouse} />
          <Box position={[0, 1.5, 0]} size={[3.2, 0.15, 2.9]} color={c.emerald} />
          <mesh position={[0, 2.6, 0]}>
            <octahedronGeometry args={[0.58, 0]} />
            <meshStandardMaterial color={c.amber} emissive={c.amber} emissiveIntensity={0.45} />
          </mesh>
          <Html position={[0, 4.2, 0]} center zIndexRange={[12, 0]}>
            <button
              className="hub-marker"
              style={{
                transform:
                  w.code === 'HAM'
                    ? 'translate(25px,-55px)'
                    : w.code === 'RTM'
                      ? 'translate(-45px,0px)'
                      : w.code === 'MAD'
                        ? 'translate(-25px,18px)'
                        : w.code === 'GRU'
                          ? 'translate(15px,-30px)'
                          : 'none',
              }}
              onClick={() => select(w.id, 'region')}
              onContextMenu={(e) => {
                e.preventDefault();
                useAtlasStore.getState().setContext({
                  selection: { kind: 'warehouse', id: w.id },
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
            >
              <span className="eyebrow">
                {w.code} / {w.city}
              </span>
              <strong>{w.name}</strong>
              <span>
                <i className="dot green" />
                {calculateKPIs(sim, w.id).occupancy}% occupied <b>Explore ↗</b>
              </span>
            </button>
          </Html>
        </group>
      ))}
      {sim.trucks
        .filter((t) => t.state === 'EN_RUTA' || (t.state === 'MANTENIMIENTO' && !t.warehouseId))
        .map((t) => (
          <WorldTruck key={t.id} id={t.id} />
        ))}
      <Label
        text="ATLASGRID / GLOBAL NETWORK"
        position={[0, 0.05, -43]}
        width={70}
        height={2.7}
        ground
        color="#637E92"
      />
      <Label
        text="EUROPE"
        position={[-12, 0.5, -34]}
        width={9}
        height={1.2}
        ground
        color="#7E9F98"
      />
      <Label
        text="ASIA PACIFIC"
        position={[52, 0.5, 43]}
        width={18}
        height={1.2}
        ground
        color="#7E9F98"
      />
    </group>
  );
}
