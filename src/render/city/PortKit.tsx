import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Group, InstancedMesh, Object3D } from 'three';
import { Box } from '../../scene/primitives';
import {
  RAIL_X0,
  RAIL_X1,
  RAIL_Z,
  TRAIN_CARS,
  bob,
  craneCycle,
  trainCars,
} from '../../city/population';
import { ZONES, containerStacks, railSleepers } from '../../city/scenery';
import { ColoredInstances, cityClock } from './ColoredInstances';

const WAGON_COLORS = [
  '#D9553B',
  '#2F9BB3',
  '#E9A820',
  '#7C8697',
  '#3E8E41',
  '#8E5BD0',
  '#C23B5A',
  '#B38A5C',
  '#2A9D8F',
];
/** Vía de tren con tren de mercancías en bucle (todas las ciudades). */
export function RailLine() {
  const sleepers = useMemo(railSleepers, []);
  const wagons = useRef<InstancedMesh>(null);
  const loads = useRef<InstancedMesh>(null);
  const loco = useRef<Group>(null);
  const d = useMemo(() => new Object3D(), []);
  const col = useMemo(() => new Color(), []);
  useFrame(() => {
    const xs = trainCars(cityClock.t);
    if (loco.current) {
      loco.current.position.set(xs[0], 0, RAIL_Z);
      loco.current.visible = xs[0] > RAIL_X0 && xs[0] < RAIL_X1;
    }
    let n = 0;
    for (let i = 1; i < TRAIN_CARS; i++) {
      const x = xs[i];
      if (x < RAIL_X0 || x > RAIL_X1) continue;
      d.position.set(x, 1.9, RAIL_Z);
      d.scale.set(12, 2.2, 2.9);
      d.updateMatrix();
      wagons.current?.setMatrixAt(n, d.matrix);
      d.position.set(x, 3.6, RAIL_Z);
      d.scale.set(11.4, 1.5, 2.6);
      d.updateMatrix();
      loads.current?.setMatrixAt(n, d.matrix);
      loads.current?.setColorAt(n, col.set(WAGON_COLORS[i % WAGON_COLORS.length]));
      n++;
    }
    for (const m of [wagons.current, loads.current])
      if (m) {
        m.count = n;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
  });
  return (
    <group>
      <Box
        position={[(RAIL_X0 + RAIL_X1) / 2, 0.05, RAIL_Z]}
        size={[RAIL_X1 - RAIL_X0, 0.12, 7]}
        color="#8A8478"
      />
      <ColoredInstances items={sleepers} castShadow={false} />
      {[-0.9, 0.9].map((o) => (
        <Box
          key={o}
          position={[(RAIL_X0 + RAIL_X1) / 2, 0.3, RAIL_Z + o]}
          size={[RAIL_X1 - RAIL_X0, 0.14, 0.14]}
          color="#B6BDC8"
        />
      ))}
      <group ref={loco}>
        <Box position={[0, 1.8, 0]} size={[14, 2.6, 3]} color="#E4572E" />
        <Box position={[-4.5, 3.6, 0]} size={[4.5, 1.6, 2.8]} color="#F4F7FB" />
        <Box position={[3, 3.3, 0]} size={[7, 0.5, 2.6]} color="#2A303D" />
        <Box position={[6.9, 1.9, 0]} size={[0.2, 0.6, 2]} color="#FFF1CC" emissive />
      </group>
      <instancedMesh
        ref={wagons}
        args={[undefined, undefined, TRAIN_CARS]}
        frustumCulled={false}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#59616F" roughness={0.6} metalness={0.4} />
      </instancedMesh>
      <instancedMesh
        ref={loads}
        args={[undefined, undefined, TRAIN_CARS]}
        frustumCulled={false}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
      </instancedMesh>
    </group>
  );
}
function Crane({ x, z, index }: { x: number; z: number; index: number }) {
  const trolley = useRef<Group>(null);
  const hoist = useRef<Group>(null);
  useFrame(() => {
    const k = craneCycle(cityClock.t, index);
    if (trolley.current) trolley.current.position.x = -18 + k.trolley * 56;
    if (hoist.current) {
      const len = 6 + k.hoist * 26;
      hoist.current.scale.y = len;
      hoist.current.position.y = -len / 2;
    }
  });
  return (
    <group position={[x, 0, z]}>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Box
            key={`${sx}${sz}`}
            position={[sx * 5, 19, sz * 6]}
            size={[1.2, 38, 1.2]}
            color="#E4572E"
          />
        )),
      )}
      <Box position={[0, 38.5, 0]} size={[12, 1.6, 14]} color="#D1481F" />
      <Box position={[0, 40.2, 0]} size={[64, 1.6, 2.4]} color="#E8E9EC" />
      <Box position={[-22, 44, 0]} size={[2, 8, 2]} color="#C9CED6" rotation={[0, 0, 0.5]} />
      <group ref={trolley} position={[0, 38.8, 0]}>
        <Box position={[0, 0, 0]} size={[4, 1.4, 3.4]} color="#2A303D" />
        <group ref={hoist} position={[0, -1, 0]}>
          <Box position={[0, 0, 0]} size={[0.14, 1, 0.14]} color="#14171F" />
        </group>
        <group position={[0, -9, 0]}>
          <Box
            position={[0, 0, 0]}
            size={[12, 2.6, 2.5]}
            color={['#2F9BB3', '#E9A820', '#D9553B'][index % 3]}
          />
        </group>
      </group>
    </group>
  );
}
function Ship({ x, z, length }: { x: number; z: number; length: number }) {
  const g = useRef<Group>(null);
  useFrame(() => {
    if (g.current) {
      g.current.position.y = bob(cityClock.t, 1.3, 0.12);
      g.current.rotation.z = bob(cityClock.t, 0.4, 0.008);
    }
  });
  const stacks = useMemo(
    () =>
      containerStacks(
        { x0: x - 8, x1: x + 8, z0: z - length / 2 + 14, z1: z + length / 2 - 4 },
        `ship:${x}:${z}`,
        5,
        0.9,
      ).map((c) => ({
        ...c,
        position: [c.position[0], c.position[1] + 6.2, c.position[2]] as [number, number, number],
        scale: [2.4, 2.6, 12] as [number, number, number],
      })),
    [x, z, length],
  );
  return (
    <group ref={g}>
      <Box position={[x, 3, z]} size={[20, 7, length]} color="#7A2E2E" />
      <Box position={[x, 0.2, z]} size={[20.5, 1.6, length + 0.5]} color="#1F2530" />
      <Box position={[x, 6.6, z]} size={[20.4, 0.8, length + 0.4]} color="#4A4F5C" />
      <Box position={[x, 11, z + length / 2 - 8]} size={[16, 10, 10]} color="#F4F7FB" />
      <Box position={[x, 17, z + length / 2 - 8]} size={[14, 3, 8]} color="#E8EDF3" />
      <Box position={[x, 20, z + length / 2 - 8]} size={[4, 4, 4]} color="#D9553B" />
      <ColoredInstances items={stacks.slice(0, 40)} />
    </group>
  );
}
/** Puerto: canal, muelle, grúas pórtico, buque y contenedores apilados. */
export function PortKit({ tower, water, seed }: { tower: boolean; water: string; seed: string }) {
  const yards = useMemo(
    () => [
      ...containerStacks(ZONES.northWest, `${seed}:nw`, tower ? 8 : 4, 0.82),
      ...containerStacks(ZONES.northMid, `${seed}:nm`, tower ? 7 : 4, 0.78),
      ...containerStacks({ x0: 242, x1: 264, z0: -138, z1: -50 }, `${seed}:quay`, 5, 0.9),
    ],
    [seed, tower],
  );
  return (
    <group>
      <Box position={[281, -0.04, 0]} size={[34, 0.1, 345]} color={water} />
      <Box position={[258, 0.06, 0]} size={[10, 0.14, 345]} color="#8A93A2" />
      {[-110, -64, -18].map((z, i) => (
        <Crane key={z} x={262} z={z} index={i} />
      ))}
      <Ship x={282} z={-70} length={118} />
      {tower && <Ship x={282} z={90} length={78} />}
      <ColoredInstances items={yards} />
    </group>
  );
}
