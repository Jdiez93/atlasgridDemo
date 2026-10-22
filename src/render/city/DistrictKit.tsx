import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D } from 'three';
import { Box, Label } from '../../scene/primitives';
import { ROAD_GRAPH, roadNode } from '../../world/roads';
import { crossingGreen } from '../../city/population';
import { useAtlasStore } from '../../store/useAtlasStore';
import { hashString, mulberry32 } from '../../city/rng';
import { farField, terrainMounds, type Inst } from '../../city/scenery';
import type { Theme } from '../../city/profiles';
import { ColoredInstances, cityClock } from './ColoredInstances';

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
/** Oficinas, silos y torres de refrigeración del polígono industrial. */
export function IndustrialKit({ seed }: { seed: string }) {
  const towers = useMemo(() => {
    const rand = mulberry32(hashString(seed));
    return [-86, -58, -30, -2, 24].map((x, i) => ({
      x,
      h: 24 + Math.floor(rand() * 26),
      w: 16 + (i % 2) * 5,
    }));
  }, [seed]);
  const bands = useMemo<Inst[]>(
    () =>
      towers.flatMap((t) =>
        Array.from({ length: Math.floor(t.h / 3.4) }, (_, i) => ({
          position: [t.x, 2 + i * 3.4, -132 + 9.05] as [number, number, number],
          scale: [t.w - 1.2, 1.5, 0.12] as [number, number, number],
          color: '#3C5668',
        })),
      ),
    [towers],
  );
  return (
    <group>
      {towers.map((t) => (
        <group key={t.x}>
          <Box position={[t.x, t.h / 2, -132]} size={[t.w, t.h, 18]} color="#9FB6C8" />
          <Box position={[t.x, t.h + 0.4, -132]} size={[t.w + 1, 0.8, 19]} color="#6E7B8C" />
          <Box position={[t.x, t.h + 2, -134]} size={[5, 3, 5]} color="#9AA4B3" />
        </group>
      ))}
      <ColoredInstances
        items={bands}
        castShadow={false}
        roughness={0.2}
        metalness={0.6}
        emissive={0.45}
      />
      {[0, 1, 2].map((i) => (
        <group key={i} position={[120 + i * 26, 0, -128]}>
          <mesh position={[0, 8, 0]} castShadow>
            <cylinderGeometry args={[7, 9.5, 16, 20, 1, true]} />
            <meshStandardMaterial color="#C9CED6" roughness={0.7} side={2} />
          </mesh>
          <mesh position={[0, 15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[6.4, 20]} />
            <meshStandardMaterial color="#4A7A9C" />
          </mesh>
        </group>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`s${i}`} position={[210 + i * 9.5, 12, -128]} castShadow>
          <cylinderGeometry args={[4, 4, 24, 16]} />
          <meshStandardMaterial color="#E4E9EF" roughness={0.45} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}
/** Aparcamiento de empleados, estación de servicio y carga eléctrica. */
export function ParkingAndFuel({ hubId }: { hubId: string }) {
  const cars = useMemo<Inst[]>(() => {
    const rand = mulberry32(hashString(`park:${hubId}`));
    const out: Inst[] = [];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 12; c++) {
        if (rand() < 0.28) continue;
        out.push({
          position: [-2 + c * 4.4, 0.8, 66 + r * 12 + (r % 2 ? 0 : 0)],
          scale: [2, 1.5, 4.2],
          color: CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)],
          yaw: (Math.PI / 2) * 0,
        });
      }
    return out;
  }, [hubId]);
  const lines = useMemo<Inst[]>(
    () =>
      Array.from({ length: 3 }, (_, r) =>
        Array.from({ length: 13 }, (_, c) => ({
          position: [-4.2 + c * 4.4, 0.06, 66 + r * 12] as [number, number, number],
          scale: [0.14, 0.04, 6.4] as [number, number, number],
          color: '#F4F7FB',
        })),
      ).flat(),
    [],
  );
  return (
    <group>
      <Box position={[26, 0.05, 78]} size={[60, 0.1, 40]} color="#59606F" />
      <ColoredInstances items={lines} castShadow={false} />
      <ColoredInstances items={cars} />
      <Label
        text="EMPLOYEE PARKING"
        position={[26, 0.12, 96]}
        width={30}
        height={2.4}
        ground
        color="#F4F7FB"
      />
      {/* estación de servicio + puntos de carga eléctrica */}
      <group position={[-80, 0, 80]}>
        <Box position={[0, 0.05, 0]} size={[34, 0.1, 30]} color="#59606F" />
        <Box position={[0, 5.4, -4]} size={[26, 0.7, 12]} color="#F5A524" />
        {[-10, 10].map((x) => (
          <Box key={x} position={[x, 2.7, -4]} size={[0.8, 5.4, 0.8]} color="#E8EDF3" />
        ))}
        {[-6, 0, 6].map((x) => (
          <Box key={x} position={[x, 1.1, -4]} size={[1.2, 2.2, 0.8]} color="#2A303D" />
        ))}
        <Box position={[0, 2, 10]} size={[10, 4, 6]} color="#C9D2DE" />
        {[-8, -4, 0, 4].map((x) => (
          <group key={x} position={[x + 12, 0, 10]}>
            <Box position={[0, 1.2, 0]} size={[0.8, 2.4, 0.6]} color="#10B981" emissive />
            <Box position={[0, 0.05, 2.6]} size={[3, 0.04, 5]} color="#22D3EE" />
          </group>
        ))}
        <Label
          text="EV CHARGE · FUEL"
          position={[0, 6.2, -4]}
          width={20}
          height={1.6}
          color="#2A303D"
        />
      </group>
    </group>
  );
}
/** Autopista elevada (Los Ángeles) con tráfico en movimiento. */
export function ElevatedHighway() {
  const pillars = useMemo<Inst[]>(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        position: [-130 + i * 24, 4.5, -128] as [number, number, number],
        scale: [3.2, 9, 5] as [number, number, number],
        color: '#9AA0AB',
      })),
    [],
  );
  const cars = useRef<InstancedMesh>(null);
  const d = useMemo(() => new Object3D(), []);
  useEffect(() => {
    const c = new Color();
    for (let i = 0; i < 30; i++)
      cars.current?.setColorAt(i, c.set(CAR_COLORS[i % CAR_COLORS.length]));
    if (cars.current?.instanceColor) cars.current.instanceColor.needsUpdate = true;
  }, []);
  useFrame(() => {
    const t = cityClock.t;
    for (let i = 0; i < 30; i++) {
      const dir = i % 2 ? 1 : -1;
      const x = ((((i * 37.3 + t * (9 + (i % 5)) * dir) % 560) + 560) % 560) - 130;
      d.position.set(x, 9.95, -128 + dir * 5);
      d.scale.set(4.2, 1.4, 2);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      cars.current?.setMatrixAt(i, d.matrix);
    }
    if (cars.current) cars.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <Box position={[150, 9, -128]} size={[570, 1.2, 22]} color="#7D8494" />
      <Box position={[150, 10, -139.2]} size={[570, 1.6, 0.6]} color="#C5CCD6" />
      <Box position={[150, 10, -116.8]} size={[570, 1.6, 0.6]} color="#C5CCD6" />
      <Box position={[150, 9.62, -128]} size={[570, 0.1, 0.4]} color="#F5C84B" />
      <ColoredInstances items={pillars} />
      <instancedMesh ref={cars} args={[undefined, undefined, 30]} frustumCulled={false} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} metalness={0.3} />
      </instancedMesh>
    </group>
  );
}
/** Rascacielos / naves lejanas, dunas y colinas hasta ~1,5 km. */
export function FarCity({ theme, hubId }: { theme: Theme; hubId: string }) {
  const buildings = useMemo(() => farField(theme, hubId), [theme, hubId]);
  const mounds = useMemo<Inst[]>(
    () =>
      terrainMounds(theme, hubId).map((m) => ({
        position: [m.x, -2, m.z] as [number, number, number],
        scale: [m.radius, m.height * 1.4, m.radius * 0.85] as [number, number, number],
        color: m.color,
      })),
    [theme, hubId],
  );
  return (
    <group>
      <ColoredInstances items={buildings} castShadow={false} roughness={0.5} metalness={0.25} />
      <ColoredInstances items={mounds} shape="sphere" castShadow={false} roughness={1} />
    </group>
  );
}
/** Cebras en los cruces con semáforo, marquesinas de autobús y farolas. */
export function RoadDetails() {
  const signalled = ROAD_GRAPH.nodes.filter((n) => n.signal);
  const zebras = useMemo<Inst[]>(
    () =>
      signalled.flatMap((n) =>
        [-1, 1].flatMap((side) => [
          ...Array.from({ length: 7 }, (_, i) => ({
            position: [n.x + (i - 3) * 1.9, 0.07, n.z + side * 9.5] as [number, number, number],
            scale: [0.9, 0.04, 3.2] as [number, number, number],
            color: '#F4F7FB',
          })),
          ...Array.from({ length: 7 }, (_, i) => ({
            position: [n.x + side * 9.5, 0.07, n.z + (i - 3) * 1.9] as [number, number, number],
            scale: [3.2, 0.04, 0.9] as [number, number, number],
            color: '#F4F7FB',
          })),
        ]),
      ),
    [signalled],
  );
  const lamps = useMemo<Inst[]>(() => {
    const out: Inst[] = [];
    for (const e of ROAD_GRAPH.edges) {
      if (e.from > e.to || e.kind === 'bridge') continue;
      const a = roadNode(e.from),
        b = roadNode(e.to);
      const n = Math.floor(e.length / 38);
      for (let i = 1; i < n; i++)
        out.push({
          position: [
            a.x + ((b.x - a.x) * i) / n + (e.axis === 'z' ? 8.4 : 0),
            3.6,
            a.z + ((b.z - a.z) * i) / n + (e.axis === 'x' ? 8.4 : 0),
          ],
          scale: [0.22, 7.2, 0.22],
          color: '#9AA4B3',
        });
    }
    return out;
  }, []);
  const heads = useMemo(
    () =>
      lamps.map((l) => ({
        ...l,
        position: [l.position[0], 7.3, l.position[2]] as [number, number, number],
        scale: [0.9, 0.3, 0.9] as [number, number, number],
        color: '#FFE2A7',
      })),
    [lamps],
  );
  const pools = useRef<InstancedMesh>(null);
  const green = useRef<InstancedMesh>(null);
  const d = useMemo(() => new Object3D(), []);
  useEffect(() => {
    lamps.forEach((l, i) => {
      d.position.set(l.position[0], 0.12, l.position[2]);
      d.rotation.set(-Math.PI / 2, 0, 0);
      d.scale.set(9, 9, 1);
      d.updateMatrix();
      pools.current?.setMatrixAt(i, d.matrix);
    });
    if (pools.current) pools.current.instanceMatrix.needsUpdate = true;
  }, [lamps, d]);
  useFrame(() => {
    if (pools.current)
      (pools.current.material as { opacity: number }).opacity = useAtlasStore.getState().night
        ? 0.3
        : 0;
    // piloto peatonal sincronizado: verde para peatones cuando el tráfico paralelo está en rojo
    signalled.forEach((n, i) => {
      const g = crossingGreen(cityClock.t, n.offset);
      d.position.set(n.x + 8.2, 2.6, n.z + 8.2);
      d.scale.set(0.5, g ? 0.5 : 0.2, 0.5);
      d.updateMatrix();
      green.current?.setMatrixAt(i, d.matrix);
    });
    if (green.current) green.current.instanceMatrix.needsUpdate = true;
  });
  const stops = [
    { x: 100, z: -39 },
    { x: 200, z: -39 },
    { x: 118, z: 31 },
    { x: 208, z: 101 },
  ];
  return (
    <group>
      <ColoredInstances items={zebras} castShadow={false} />
      <ColoredInstances items={lamps} />
      <ColoredInstances items={heads} emissive={1.8} castShadow={false} />
      <instancedMesh
        ref={pools}
        args={[undefined, undefined, Math.max(1, lamps.length)]}
        frustumCulled={false}
      >
        <circleGeometry args={[1, 18]} />
        <meshBasicMaterial
          color="#FFD79A"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={green}
        args={[undefined, undefined, Math.max(1, signalled.length)]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#2DE39A" emissive="#2DE39A" emissiveIntensity={1.2} />
      </instancedMesh>
      {stops.map((s) => (
        <group key={`${s.x}${s.z}`} position={[s.x, 0, s.z]}>
          <Box position={[0, 3, 0]} size={[6, 0.25, 2.4]} color="#2F9BB3" />
          {[-2.6, 2.6].map((x) => (
            <Box key={x} position={[x, 1.5, 0]} size={[0.2, 3, 2.2]} color="#9AA4B3" />
          ))}
          <Box position={[0, 1.6, -1]} size={[5.6, 2.6, 0.12]} color="#8FB2C9" opacity={0.6} />
          <Box position={[0, 0.5, 0.2]} size={[4, 0.3, 0.8]} color="#7C8392" />
          <Label text="BUS" position={[0, 3.5, 1.3]} width={3} height={0.9} color="#F4F7FB" />
        </group>
      ))}
    </group>
  );
}
