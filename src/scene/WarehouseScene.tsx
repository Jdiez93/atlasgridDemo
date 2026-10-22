import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, InstancedMesh, Object3D } from 'three';
import { useAtlasStore } from '../store/useAtlasStore';
import { CONFIG } from '../lib/config';
import { rackPosition } from '../sim/math';
import {
  Box,
  InstancedBoxes,
  Interactive,
  Label,
  SelectionRing,
  type InstanceBox,
} from './primitives';
import { Inventory } from './Inventory';
import { useCityProfile } from '../render/city/CityScene';
import { FarCity } from '../render/city/DistrictKit';
import { GroundPlane, Puddles, ConcreteSlab } from '../render/city/Ground';
import { ForkliftEntity, TruckEntity } from './Vehicles';
const c = CONFIG.colors;
const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number): InstanceBox => ({
  position: [x, y, z],
  scale: [sx, sy, sz],
});
function Racks() {
  const frames = useMemo(() => {
    const a: InstanceBox[] = [];
    for (let i = 0; i < 20; i++) {
      const p = rackPosition(i);
      for (const dx of [-1.4, 1.4])
        for (const dz of [-1, 1]) a.push(box(p.x + dx, 3.1, p.z + dz, 0.1, 6.2, 0.1));
    }
    return a;
  }, []);
  const shelves = useMemo(() => {
    const a: InstanceBox[] = [];
    for (let i = 0; i < 20; i++) {
      const p = rackPosition(i);
      for (let l = 0; l < 3; l++) a.push(box(p.x, 0.05 + l * 2.05, p.z, 2.95, 0.12, 2.05));
    }
    return a;
  }, []);
  return (
    <group>
      <InstancedBoxes items={frames} color="#718093" />
      <InstancedBoxes items={shelves} color="#48566D" />
    </group>
  );
}
function Trees() {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const points = useMemo(
    () =>
      [
        [-31, -17],
        [-32, -7],
        [-32, 5],
        [-32, 18],
        [39, -16],
        [39, -5],
        [-23, -22],
        [-8, -22],
        [8, -22],
        [23, -22],
      ].map(([x, z]) => ({ x, z })),
    [],
  );
  useEffect(() => {
    if (!ref.current) return;
    points.forEach((p, i) => {
      dummy.position.set(p.x, 3.1, p.z);
      dummy.scale.set(1.4 + (i % 3) * 0.25, 1.1 + (i % 2) * 0.2, 1.4 + (i % 3) * 0.25);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [points, dummy]);
  return (
    <group>
      <InstancedBoxes
        items={points.map((p) => box(p.x, 1.1, p.z, 0.4, 2.2, 0.4))}
        color="#7A5C3E"
      />
      <instancedMesh ref={ref} args={[undefined, undefined, points.length]} castShadow>
        <coneGeometry args={[1.6, 4.3, 6]} />
        <meshStandardMaterial color={c.tree} flatShading />
      </instancedMesh>
      <InstancedBoxes
        items={points.map((p) => box(p.x, 0.04, p.z, 3.8, 0.08, 3.8))}
        color="#4C7A3A"
      />
    </group>
  );
}
function Fences() {
  const posts = useMemo(() => {
    const a: InstanceBox[] = [];
    for (let x = -39; x <= 39; x += 3) a.push(box(x, 1, -24, 0.12, 2, 0.12));
    for (let z = -21; z <= 26; z += 3) {
      a.push(box(-39, 1, z, 0.12, 2, 0.12));
      a.push(box(41, 1, z, 0.12, 2, 0.12));
    }
    return a;
  }, []);
  const rails = useMemo(
    () => [
      box(0, 0.7, -24, 80, 0.05, 0.07),
      box(0, 1.65, -24, 80, 0.05, 0.07),
      box(-39, 0.7, 1, 0.07, 0.05, 50),
      box(-39, 1.65, 1, 0.07, 0.05, 50),
      box(41, 0.7, 1, 0.07, 0.05, 50),
      box(41, 1.65, 1, 0.07, 0.05, 50),
    ],
    [],
  );
  return (
    <group>
      <InstancedBoxes items={posts} color="#586C7B" />
      <InstancedBoxes items={rails} color="#435466" />
    </group>
  );
}
function Gate() {
  const arm = useRef<Group>(null);
  useFrame((_, dt) => {
    if (!arm.current) return;
    const open = useAtlasStore
      .getState()
      .sim.trucks.some(
        (t) =>
          t.warehouseId === useAtlasStore.getState().warehouseId &&
          ['EN_PUERTA', 'MANIOBRANDO', 'SALIENDO'].includes(t.state) &&
          t.position.x > 30,
      );
    const goal = open ? -Math.PI / 2 : 0;
    arm.current.rotation.z += (goal - arm.current.rotation.z) * Math.min(1, dt * 4);
  });
  return (
    <group position={[32, 0, 29]}>
      <Box position={[-3, 1.5, 0]} size={[3, 3, 3.2]} color={c.warehouse} />
      <Box position={[-3, 2.05, 1.64]} size={[2.4, 0.95, 0.04]} color="#234A51" />
      <Box position={[0, 0.9, 0]} size={[0.65, 1.8, 0.6]} color={c.amber} />
      <group ref={arm} position={[0, 1.7, 0]}>
        <Box position={[3, 0, 0]} size={[6, 0.15, 0.18]} color={c.truck} />
        {[1, 2.5, 4, 5.5].map((x) => (
          <Box key={x} position={[x, 0, 0.01]} size={[0.5, 0.17, 0.2]} color={c.amber} />
        ))}
      </group>
      <Label text="ACCESS 01" position={[-3, 3.42, 1.65]} width={3.2} height={0.5} />
    </group>
  );
}
function DockEntity({ id }: { id: string }) {
  const d = useAtlasStore((s) => s.sim.docks.find((d) => d.id === id)!);
  const blocked = useAtlasStore((s) => s.sim.time < d.blockedUntil);
  const selected = useAtlasStore((s) => s.selection?.id === id && s.selection.kind === 'dock');
  const status = blocked ? c.error : d.truckId ? c.amber : c.emerald;
  return (
    <group position={[d.position.x, 0, 2]}>
      <Interactive selection={{ kind: 'dock', id }}>
        <Box position={[0, 1.7, 0]} size={[3.7, 3.4, 0.55]} color="#1B263A" />
        <Box position={[0, 1.7, 0.3]} size={[3.05, 2.8, 0.06]} color="#59677A" />
        {[0.55, 0.95, 1.35, 1.75, 2.15, 2.55].map((y) => (
          <Box key={y} position={[0, y, 0.35]} size={[3.05, 0.05, 0.04]} color="#313E54" />
        ))}
        <Box position={[0, 3.58, 0.33]} size={[3.7, 0.22, 0.2]} color={status} emissive />
        {[-1.92, 1.92].map((x) => (
          <Box key={x} position={[x, 1.65, 0.3]} size={[0.22, 3.3, 0.5]} color="#F5A524" />
        ))}
        <Box position={[0, 0.27, 0.8]} size={[3.65, 0.5, 1.5]} color="#647086" />
        <Label text={d.label.toUpperCase()} position={[0, 4.35, 0.34]} width={5} height={0.65} />
        <Box position={[0, 0.035, 6]} size={[0.12, 0.045, 11.5]} color={c.amber} opacity={0.6} />
        <Label
          text={d.label.toUpperCase()}
          position={[0, 0.06, 14]}
          width={6}
          height={0.8}
          color={c.amber}
          ground
        />
        {selected && (
          <group position={[0, 0, 6]}>
            <SelectionRing radius={3.7} />
          </group>
        )}
      </Interactive>
    </group>
  );
}
function Chargers({ warehouseId }: { warehouseId: string }) {
  const charger = useAtlasStore((s) => s.sim.chargers.find((c) => c.warehouseId === warehouseId)!);
  return (
    <group position={[charger.position.x, 0, charger.position.z]}>
      <Interactive selection={{ kind: 'charger', id: charger.id }}>
        <Box position={[0, 0.1, 0]} size={[3.5, 0.2, 4]} color="#243948" />
        <Box position={[0, 1.4, -1.5]} size={[1.45, 2.6, 0.85]} color="#27384A" />
        <Box position={[0, 1.85, -1.04]} size={[0.85, 0.65, 0.05]} color={c.charger} emissive />
        <Box position={[0, 2.1, -0.98]} size={[0.08, 0.3, 0.05]} color="#E6EAF2" />
        <Box position={[0, 2.05, -0.98]} size={[0.3, 0.08, 0.05]} color="#E6EAF2" />
        <Label
          text="CHARGE"
          position={[0, 0.04, 2.8]}
          width={4}
          height={0.6}
          color={c.charger}
          ground
        />
      </Interactive>
    </group>
  );
}
function StreetLights() {
  return (
    <group>
      {[-28, 20, 39].map((x, i) => (
        <group key={x} position={[x, 0, i === 1 ? -19 : 25]}>
          <Box position={[0, 3.8, 0]} size={[0.16, 7.6, 0.16]} color="#48566D" />
          <Box position={[-0.9, 7.6, 0]} size={[2, 0.13, 0.2]} color="#68768A" />
          <Box position={[-1.7, 7.48, 0]} size={[0.65, 0.08, 0.5]} color="#F2DDAB" emissive />
        </group>
      ))}
    </group>
  );
}
export function WarehouseScene() {
  const { profile, palette } = useCityProfile();
  const id = useAtlasStore((s) => s.warehouseId);
  const selection = useAtlasStore((s) => s.selection);
  const sim = useAtlasStore((s) => s.sim);
  const roof = useAtlasStore((s) => s.roof);
  const w = sim.warehouses.find((w) => w.id === id)!;
  const trackedTruck =
    selection?.kind === 'truck'
      ? selection.id
      : selection?.kind === 'pallet'
        ? sim.pallets.find((p) => p.id === selection.id)?.ownerId
        : selection?.kind === 'shipment'
          ? sim.shipments.find((s) => s.id === selection.id)?.truckId
          : undefined;
  const roadLines = useMemo(
    () => Array.from({ length: 22 }, (_, i) => box(-64 + i * 6, 0.025, 34, 3, 0.04, 0.12)),
    [],
  );
  const structural = useMemo(
    () =>
      [-18, -10, -2, 6, 18].flatMap((x) => [
        box(x, 3.45, -18, 0.2, 6.9, 0.2),
        box(x, 3.45, 2, 0.2, 6.9, 0.2),
        box(x, 6.9, -8, 0.2, 0.25, 20),
      ]),
    [],
  );
  return (
    <group>
      <Box position={[0, -0.57, 2]} size={[86, 1, 59]} color="#58606F" />
      <ConcreteSlab position={[0, -0.04, 2]} size={[85, 0.1, 58]} color={c.ground} />
      <Box position={[0, -0.04, 34]} size={[320, 0.12, 8]} color={c.asphalt} />
      <InstancedBoxes items={roadLines} color="#697583" />
      <Label
        text={`ATLASGRID / ${w.code} ACCESS`}
        position={[0, 0.04, 38.8]}
        width={26}
        height={1.1}
        color="#C9D2E0"
        ground
      />
      <Interactive selection={{ kind: 'warehouse', id }}>
        <Box position={[0, 0.12, -8]} size={[38, 0.3, 22]} color="#8C95A6" />
        <Box position={[0, 3.5, -18.8]} size={[38, 7, 0.5]} color={c.warehouse} />
        <Box position={[-18.8, 3.5, -8]} size={[0.5, 7, 22]} color={c.warehouse} />
        <Box position={[18.8, 1.1, -8]} size={[0.5, 2.2, 22]} color={c.warehouse} />
        <Box position={[0, 6.9, -18.45]} size={[37, 0.3, 0.18]} color={c.emerald} emissive />
        <InstancedBoxes items={structural} color="#8794A8" />
        {roof && (
          <Box position={[0, 7.2, -8]} size={[39, 0.35, 23]} color={c.warehouse} opacity={0.82} />
        )}
        <Label
          text={`ATLASGRID · ${w.code}`}
          position={[0, 5.8, -18.47]}
          width={16}
          height={1.55}
          color={c.truck}
        />
        <Label
          text="INVENTORY / ZONE A"
          position={[-19.8, 0.04, -4]}
          width={14}
          height={1}
          color="#E1E7F0"
          ground
        />
      </Interactive>
      <Racks />
      <Inventory warehouseId={id} />
      {sim.docks
        .filter((d) => d.warehouseId === id)
        .map((d) => (
          <DockEntity key={d.id} id={d.id} />
        ))}
      {sim.parking
        .filter((p) => p.warehouseId === id)
        .map((p) => (
          <group key={p.id} position={[p.position.x, 0, p.position.z]}>
            <Interactive selection={{ kind: 'parking', id: p.id }}>
              <Box position={[0, 0.016, 0]} size={[5, 0.04, 11]} color="#5A6275" />
              {[-2.5, 2.5].map((x) => (
                <Box key={x} position={[x, 0.05, 0]} size={[0.1, 0.05, 11]} color={c.amber} />
              ))}
              {[-5.5, 5.5].map((z) => (
                <Box key={z} position={[0, 0.05, z]} size={[5, 0.05, 0.1]} color={c.amber} />
              ))}
              <Label
                text={p.label}
                position={[0, 0.085, 4.6]}
                width={3}
                height={1}
                color={c.amber}
                ground
              />
            </Interactive>
          </group>
        ))}
      <Label
        text="YARD / RESERVED PARKING"
        position={[28, 0.05, 23]}
        width={15}
        height={1}
        color="#D5DCE8"
        ground
      />
      <Box position={[0, 0.04, 26]} size={[62, 0.06, 0.09]} color="#6B7483" opacity={0.4} />
      <Chargers warehouseId={id} />
      <Trees />
      <Fences />
      <Gate />
      <StreetLights />
      {sim.trucks
        .filter(
          (t) =>
            t.warehouseId === id ||
            (!t.warehouseId &&
              t.destinationId === id &&
              (t.routeProgress > 0.79 || trackedTruck === t.id)),
        )
        .map((t) => (
          <TruckEntity key={t.id} id={t.id} />
        ))}
      {sim.forklifts
        .filter((f) => f.warehouseId === id)
        .map((f) => (
          <ForkliftEntity key={f.id} id={f.id} />
        ))}
      <GroundPlane color={palette.ground} y={-0.13} size={3000} />
      <Puddles area={[-38, 38, -16, 30]} count={18} seed={id} />
      <FarCity theme={profile.theme} hubId={profile.hubId} />
    </group>
  );
}
