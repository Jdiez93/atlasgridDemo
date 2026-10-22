import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MathUtils } from 'three';
import { useAtlasStore } from '../store/useAtlasStore';
import { CONFIG } from '../lib/config';
import { forkliftLabels, statusTone, truckLabels } from '../lib/format';
import { Box, InstancedBoxes, Interactive, Label, SelectionRing, VehiclePin } from './primitives';
import { roadHeight } from '../world/roads';
import { angleDelta } from '../sim/math';
const c = CONFIG.colors;
export const TRUCK_SCALE = 1.2;
export const VAN_SCALE = 1.25;
type Surface = 'paint' | 'glass' | 'rubber' | 'chrome' | 'dark' | 'lamp' | 'brake' | 'amber';
const SURFACE: Record<
  Surface,
  { roughness: number; metalness: number; emissive?: string; intensity?: number; env?: number }
> = {
  paint: { roughness: 0.38, metalness: 0.25, env: 1 },
  glass: { roughness: 0.06, metalness: 0.85, env: 1.8 },
  rubber: { roughness: 0.95, metalness: 0 },
  chrome: { roughness: 0.22, metalness: 0.95, env: 1.4 },
  dark: { roughness: 0.6, metalness: 0.3 },
  lamp: { roughness: 0.2, metalness: 0, emissive: '#FFF1CC', intensity: 2.4 },
  brake: { roughness: 0.3, metalness: 0, emissive: '#FF2A2A', intensity: 1.8 },
  amber: { roughness: 0.3, metalness: 0, emissive: '#FFB020', intensity: 1.6 },
};
function PBox({
  position = [0, 0, 0],
  size,
  color,
  surface = 'paint',
  rotation,
}: {
  position?: [number, number, number];
  size: [number, number, number];
  color: string;
  surface?: Surface;
  rotation?: [number, number, number];
}) {
  const m = SURFACE[surface];
  return (
    <mesh position={position} rotation={rotation} castShadow={!m.emissive} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={m.roughness}
        metalness={m.metalness}
        emissive={m.emissive ?? '#000000'}
        emissiveIntensity={m.intensity ?? 0}
        envMapIntensity={m.env ?? 0.6}
      />
    </mesh>
  );
}
function PCyl({
  position,
  radius,
  length,
  color,
  surface = 'chrome',
  axis = 'y',
}: {
  position: [number, number, number];
  radius: number;
  length: number;
  color: string;
  surface?: Surface;
  axis?: 'x' | 'y' | 'z';
}) {
  const m = SURFACE[surface];
  return (
    <mesh
      position={position}
      rotation={axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : undefined}
      castShadow
    >
      <cylinderGeometry args={[radius, radius, length, 14]} />
      <meshStandardMaterial
        color={color}
        roughness={m.roughness}
        metalness={m.metalness}
        envMapIntensity={m.env ?? 0.6}
      />
    </mesh>
  );
}
export function Wheel({
  position,
  radius = 0.5,
  vehicleId,
}: {
  position: [number, number, number];
  radius?: number;
  vehicleId?: string;
}) {
  const spin = useRef<Group>(null);
  useFrame((_, dt) => {
    if (!spin.current || !vehicleId) return;
    const store = useAtlasStore.getState();
    const t = store.sim.trucks.find((t) => t.id === vehicleId);
    const f = store.sim.forklifts.find((f) => f.id === vehicleId);
    const speed = t ? t.speed : f ? f.speed : 0;
    spin.current.rotation.y +=
      ((speed * store.speed * Math.min(dt, 0.1)) / radius) *
      (t?.path[t.pathIndex]?.reverse ? -1 : 1);
  });
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <group ref={spin}>
        <mesh castShadow>
          <cylinderGeometry args={[radius, radius, 0.4, 20]} />
          <meshStandardMaterial color="#14171F" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[radius * 0.64, radius * 0.64, 0.42, 16]} />
          <meshStandardMaterial
            color="#C9D1DE"
            metalness={0.9}
            roughness={0.25}
            envMapIntensity={1.3}
          />
        </mesh>
        <mesh>
          <cylinderGeometry args={[radius * 0.22, radius * 0.22, 0.46, 8]} />
          <meshStandardMaterial color="#6B7385" metalness={0.8} roughness={0.4} />
        </mesh>
        <Box size={[0.07, 0.44, radius * 1.1]} color="#5A6275" />
        <Box size={[radius * 1.1, 0.44, 0.07]} color="#5A6275" />
      </group>
    </group>
  );
}
const RIBS = Array.from({ length: 22 }, (_, i) => -4.55 + i * 0.3);
const RIB_ITEMS = [-1, 1].flatMap((side) =>
  RIBS.map((z) => ({
    position: [side * 1.32, 2.62, z] as [number, number, number],
    scale: [0.05, 2.3, 0.1] as [number, number, number],
  })),
);
/** Tractora cab-over + remolque. Frente en +Z. Unidades: metros, escala TRUCK_SCALE. */
export function TruckModel({ cargo = 0, id }: { cargo?: number; small?: boolean; id?: string }) {
  const plate = id ? id.replace('-', ' ') : 'AG 0000';
  return (
    <group scale={TRUCK_SCALE}>
      {/* chasis y quinta rueda */}
      <PBox position={[0, 0.95, -0.2]} size={[2.1, 0.32, 9.6]} color="#1A1F2B" surface="dark" />
      <PBox position={[0, 1.22, 1.3]} size={[1.7, 0.12, 1.4]} color="#2A303D" surface="dark" />
      {/* remolque */}
      <PBox position={[0, 1.32, -1.85]} size={[2.6, 0.18, 6.4]} color="#2A303D" surface="dark" />
      <PBox position={[0, 2.62, -1.85]} size={[2.6, 2.46, 6.4]} color={c.trailer} />
      <PBox position={[0, 3.88, -1.85]} size={[2.66, 0.1, 6.5]} color="#F4F7FB" />
      <InstancedBoxes items={RIB_ITEMS} color="#C3CCD9" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <PBox position={[side * 1.32, 1.82, -1.85]} size={[0.05, 0.36, 6.3]} color={c.emerald} />
          <PBox position={[side * 1.33, 1.5, -1.85]} size={[0.05, 0.08, 6.3]} color={c.amber} />
          <group position={[side * 1.36, 2.85, -1.7]} rotation={[0, (side * Math.PI) / 2, 0]}>
            <Label text="ATLASGRID" position={[0, 0, 0]} width={3.6} height={0.9} color="#0B5D45" />
            <Label
              text="LOGISTICS"
              position={[0, -0.55, 0]}
              width={2.4}
              height={0.5}
              color="#B7791F"
            />
          </group>
          {/* luces laterales, faldones y patas */}
          <PBox
            position={[side * 1.3, 1.1, -1.0]}
            size={[0.04, 0.5, 2.4]}
            color="#2A303D"
            surface="dark"
          />
          <PBox
            position={[side * 1.3, 2.0, -4.95]}
            size={[0.08, 0.1, 0.1]}
            color="#FFB020"
            surface="amber"
          />
          <PBox
            position={[side * 0.95, 1.5, -5.08]}
            size={[0.3, 0.2, 0.06]}
            color="#FF2A2A"
            surface="brake"
          />
          <PBox position={[side * 0.65, 2.62, -5.06]} size={[1.2, 2.3, 0.06]} color="#E3E8F0" />
          <PBox
            position={[side * 0.08, 2.62, -5.1]}
            size={[0.06, 0.5, 0.05]}
            color="#9AA4B3"
            surface="chrome"
          />
          <PBox
            position={[side * 1.0, 2.62, -5.12]}
            size={[0.07, 1.8, 0.05]}
            color="#9AA4B3"
            surface="chrome"
          />
          <PBox
            position={[side * 0.9, 0.62, 1.0 - 4.5]}
            size={[0.06, 0.6, 0.45]}
            color="#111"
            surface="rubber"
          />
          <PBox
            position={[side * 0.75, 0.62, -5.1]}
            size={[0.3, 0.5, 0.04]}
            color="#111"
            surface="rubber"
          />
        </group>
      ))}
      <PBox position={[0, 0.8, -5.05]} size={[2.3, 0.14, 0.16]} color="#8E99A8" surface="chrome" />
      <PBox position={[0, 1.18, -5.12]} size={[0.95, 0.24, 0.03]} color="#FFFFFF" surface="paint" />
      <Label text={plate} position={[0, 1.18, -5.15]} width={0.9} height={0.22} color="#111827" />
      {[-0.9, 0.9].map((x) => (
        <PBox
          key={x}
          position={[x, 0.8, -0.2]}
          size={[0.1, 0.9, 0.1]}
          color="#4A5264"
          surface="dark"
        />
      ))}
      {/* cabina */}
      <PBox position={[0, 2.0, 3.3]} size={[2.5, 2.3, 2.3]} color="#F4F7FB" />
      <PBox
        position={[0, 3.4, 2.9]}
        size={[2.46, 0.5, 1.5]}
        color="#EEF2F8"
        rotation={[-0.14, 0, 0]}
      />
      <PBox
        position={[0, 2.6, 4.46]}
        size={[2.2, 1.15, 0.06]}
        color="#1B2A3A"
        surface="glass"
        rotation={[-0.1, 0, 0]}
      />
      <PBox position={[0, 1.2, 4.46]} size={[2.5, 0.12, 0.08]} color="#10B981" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <PBox
            position={[side * 1.27, 2.65, 3.75]}
            size={[0.04, 0.95, 1.05]}
            color="#1B2A3A"
            surface="glass"
          />
          <PBox position={[side * 1.27, 2.0, 3.25]} size={[0.03, 1.7, 0.05]} color="#B8C1CF" />
          <PBox position={[side * 1.27, 1.55, 3.4]} size={[0.04, 0.22, 2.1]} color={c.emerald} />
          <PBox position={[side * 1.27, 1.25, 3.4]} size={[0.04, 0.06, 2.1]} color={c.amber} />
          <PBox
            position={[side * 1.3, 1.95, 3.85]}
            size={[0.06, 0.07, 0.3]}
            color="#6B7385"
            surface="chrome"
          />
          {/* espejos */}
          <PBox
            position={[side * 1.5, 3.05, 4.3]}
            size={[0.5, 0.05, 0.05]}
            color="#222"
            surface="dark"
          />
          <PBox
            position={[side * 1.8, 2.95, 4.28]}
            size={[0.1, 0.62, 0.26]}
            color="#14171F"
            surface="dark"
          />
          <PBox
            position={[side * 1.86, 2.95, 4.28]}
            size={[0.02, 0.56, 0.22]}
            color="#8FA6BE"
            surface="glass"
          />
          {/* faros */}
          <PBox
            position={[side * 0.92, 1.5, 4.5]}
            size={[0.5, 0.26, 0.08]}
            color="#FFF1CC"
            surface="lamp"
          />
          <PBox
            position={[side * 1.1, 1.18, 4.52]}
            size={[0.28, 0.14, 0.06]}
            color="#FFB020"
            surface="amber"
          />
          {/* depósitos de combustible y escapes */}
          <PCyl
            position={[side * 1.16, 0.95, 2.35]}
            radius={0.36}
            length={1.5}
            color="#C3CCD9"
            axis="z"
          />
          <PCyl position={[side * 1.18, 3.1, 2.0]} radius={0.07} length={2.5} color="#8E99A8" />
          <PBox
            position={[side * 0.5, 3.76, 3.85]}
            size={[0.14, 0.08, 0.1]}
            color="#FFB020"
            surface="amber"
          />
          <PBox
            position={[side * 1.3, 0.62, 4.0]}
            size={[0.3, 0.1, 0.5]}
            color="#2A303D"
            surface="dark"
          />
        </group>
      ))}
      <PBox position={[0, 1.55, 4.52]} size={[1.5, 0.55, 0.06]} color="#1A1F2B" surface="dark" />
      {[1.38, 1.5, 1.62, 1.74].map((y) => (
        <PBox
          key={y}
          position={[0, y, 4.56]}
          size={[1.46, 0.03, 0.03]}
          color="#C3CCD9"
          surface="chrome"
        />
      ))}
      <PBox position={[0, 0.88, 4.56]} size={[2.6, 0.4, 0.36]} color="#2A303D" surface="dark" />
      <PBox position={[0, 3.72, 4.1]} size={[0.5, 0.1, 0.1]} color="#10B981" surface="lamp" />
      <Label text="AG" position={[0, 2.0, 4.54]} width={0.8} height={0.3} color="#10B981" />
      {/* ruedas */}
      {[-1, 1].flatMap((side) =>
        [3.85, 1.75, 0.6, -3.0, -4.05].map((z) => (
          <Wheel
            vehicleId={id}
            key={`${side}:${z}`}
            position={[side * 1.18, 0.52, z]}
            radius={0.52}
          />
        )),
      )}
      {cargo > 0 &&
        Array.from({ length: Math.min(cargo, 6) }, (_, i) => (
          <PBox
            key={i}
            position={[0, 3.96, -4.2 + i * 0.85]}
            size={[1.8, 0.07, 0.6]}
            color={c.film}
            surface="lamp"
          />
        ))}
    </group>
  );
}
export function VanModel({ id }: { id: string }) {
  return (
    <group scale={VAN_SCALE}>
      <PBox position={[0, 1.55, -0.2]} size={[2.3, 2.3, 4.2]} color="#F4F7FB" />
      <PBox position={[0, 1.2, 2.25]} size={[2.3, 1.2, 1.3]} color="#F4F7FB" />
      <PBox
        position={[0, 2.0, 2.2]}
        size={[2.1, 0.12, 1.5]}
        color="#EEF2F8"
        rotation={[0.12, 0, 0]}
      />
      <PBox
        position={[0, 1.95, 2.92]}
        size={[2.0, 0.85, 0.06]}
        color="#1B2A3A"
        surface="glass"
        rotation={[-0.35, 0, 0]}
      />
      <PBox position={[0, 0.78, 2.95]} size={[2.35, 0.34, 0.3]} color="#2A303D" surface="dark" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <PBox
            position={[side * 1.16, 1.9, 2.1]}
            size={[0.04, 0.7, 0.9]}
            color="#1B2A3A"
            surface="glass"
          />
          <PBox position={[side * 1.16, 1.5, -0.2]} size={[0.04, 0.3, 4.1]} color={c.emerald} />
          <PBox position={[side * 1.16, 1.15, -0.2]} size={[0.04, 0.06, 4.1]} color={c.amber} />
          <PBox
            position={[side * 0.8, 1.05, 2.96]}
            size={[0.42, 0.2, 0.08]}
            color="#FFF1CC"
            surface="lamp"
          />
          <PBox
            position={[side * 0.9, 1.0, -2.32]}
            size={[0.24, 0.3, 0.06]}
            color="#FF2A2A"
            surface="brake"
          />
          <PBox
            position={[side * 1.38, 2.25, 2.7]}
            size={[0.16, 0.5, 0.2]}
            color="#14171F"
            surface="dark"
          />
          <group position={[side * 1.19, 1.85, -0.6]} rotation={[0, (side * Math.PI) / 2, 0]}>
            <Label
              text="ATLASGRID"
              position={[0, 0, 0]}
              width={2.6}
              height={0.65}
              color="#0B5D45"
            />
          </group>
          {[-1.4, 1.75].map((z) => (
            <Wheel key={z} vehicleId={id} position={[side * 1.05, 0.5, z]} radius={0.5} />
          ))}
        </group>
      ))}
      <Label
        text={id.replace('-', ' ')}
        position={[0, 0.95, -2.34]}
        width={0.9}
        height={0.22}
        color="#111827"
      />
    </group>
  );
}
export function TruckEntity({ id }: { id: string }) {
  const ref = useRef<Group>(null);
  const truck = useAtlasStore((s) => s.sim.trucks.find((t) => t.id === id)!);
  const selected = useAtlasStore((s) => s.selection?.kind === 'truck' && s.selection.id === id);
  const selectedPallet = useAtlasStore((s) =>
    s.selection?.kind === 'pallet'
      ? s.sim.pallets.find(
          (p) => p.id === s.selection?.id && p.location === 'TRUCK' && p.ownerId === id,
        )
      : undefined,
  );
  const initial = useRef({
    position: [truck.position.x, 0, truck.position.z] as [number, number, number],
    yaw: truck.yaw,
  }).current; // Initial transform only; animation reads the current snapshot below.
  useFrame((_, dt) => {
    const t = useAtlasStore.getState().sim.trucks.find((t) => t.id === id);
    if (!ref.current || !t) return;
    const blend = 1 - Math.exp(-Math.min(dt, 0.1) * 15);
    ref.current.position.x = MathUtils.lerp(ref.current.position.x, t.position.x, blend);
    ref.current.position.z = MathUtils.lerp(ref.current.position.z, t.position.z, blend);
    ref.current.position.y = MathUtils.lerp(
      ref.current.position.y,
      t.road ? roadHeight(t.position) : 0,
      blend,
    );
    ref.current.rotation.y += angleDelta(ref.current.rotation.y, t.yaw) * blend;
  });
  return (
    <group ref={ref} position={initial.position} rotation={[0, initial.yaw, 0]}>
      <Interactive selection={{ kind: 'truck', id }}>
        {truck.kind === 'VAN' ? (
          <VanModel id={id} />
        ) : (
          <TruckModel id={id} cargo={truck.cargo.length} />
        )}
        {(selected || selectedPallet) && <SelectionRing radius={5.8} />}
        <VehiclePin
          id={selectedPallet?.id ?? id}
          label={selectedPallet?.name ?? truckLabels[truck.state]}
          tone={statusTone(truck.state)}
          selected={selected || Boolean(selectedPallet)}
        />
      </Interactive>
    </group>
  );
}
export function CarriedPallet() {
  return (
    <group>
      <Box position={[0, 0.1, 0]} size={[1.5, 0.18, 1.35]} color={c.pallet} />
      <Box position={[0, 0.65, 0]} size={[1.4, 0.95, 1.22]} color={c.pallet} />
      <Box position={[0, 0.75, 0]} size={[1.43, 0.22, 1.26]} color={c.film} />
      <Box position={[0, 1.13, 0]} size={[1.43, 0.07, 1.26]} color={c.film} />
    </group>
  );
}
export function ForkliftEntity({ id }: { id: string }) {
  const ref = useRef<Group>(null);
  const lift = useRef<Group>(null);
  const f = useAtlasStore((s) => s.sim.forklifts.find((f) => f.id === id)!);
  const p = useAtlasStore((s) => s.sim.pallets.find((p) => p.id === f.palletId));
  const selected = useAtlasStore((s) => s.selection?.kind === 'forklift' && s.selection.id === id);
  const selectedPallet = useAtlasStore(
    (s) => s.selection?.kind === 'pallet' && s.selection.id === p?.id,
  );
  const initial = useRef({ x: f.position.x, z: f.position.z, yaw: f.yaw });
  useFrame((_, dt) => {
    const f = useAtlasStore.getState().sim.forklifts.find((f) => f.id === id);
    if (!ref.current || !f) return;
    const blend = 1 - Math.exp(-Math.min(dt, 0.1) * 15);
    ref.current.position.x = MathUtils.lerp(ref.current.position.x, f.position.x, blend);
    ref.current.position.z = MathUtils.lerp(ref.current.position.z, f.position.z, blend);
    ref.current.rotation.y += angleDelta(ref.current.rotation.y, f.yaw) * blend;
    if (lift.current)
      lift.current.position.y = MathUtils.lerp(
        lift.current.position.y,
        f.state === 'PICKING' ? 1.5 : 0.7,
        blend,
      );
  });
  return (
    <group
      ref={ref}
      position={[initial.current.x, 0, initial.current.z]}
      rotation={[0, initial.current.yaw, 0]}
    >
      <Interactive selection={{ kind: 'forklift', id }}>
        <Box position={[0, 0.8, -0.2]} size={[1.5, 1, 2.25]} color={c.forklift} />
        <Box position={[0, 1.38, -0.25]} size={[0.8, 0.2, 1.1]} color="#222D40" />
        <Box position={[0, 1.85, -0.6]} size={[0.72, 0.7, 0.16]} color="#1B2336" />
        {[-0.63, 0.63].flatMap((x) =>
          [-0.75, 0.75].map((z) => (
            <Box
              key={`${x}:${z}`}
              position={[x, 1.95, z]}
              size={[0.09, 2.05, 0.09]}
              color="#39455C"
            />
          )),
        )}
        <Box position={[0, 3, 0.05]} size={[1.6, 0.13, 1.9]} color="#39455C" />
        {[-0.56, 0.56].map((x) => (
          <Box key={x} position={[x, 1.5, 1.18]} size={[0.12, 2.65, 0.14]} color="#5B6575" />
        ))}
        <group ref={lift} position={[0, 0.7, 1.63]}>
          {[-0.48, 0.48].map((x) => (
            <Box key={x} position={[x, 0, 0]} size={[0.17, 0.1, 1.25]} color="#B4C2CA" />
          ))}
          {p?.location === 'FORKLIFT' && (
            <Interactive selection={{ kind: 'pallet', id: p.id }}>
              <CarriedPallet />
              {selectedPallet && <SelectionRing radius={1.15} />}
            </Interactive>
          )}
        </group>
        {[-1, 1].flatMap((side) =>
          [-0.65, 0.75].map((z) => (
            <Wheel
              vehicleId={id}
              key={`${side}:${z}`}
              position={[side * 0.78, 0.42, z]}
              radius={0.36}
            />
          )),
        )}
        <Box position={[0, 3.15, -0.2]} size={[0.16, 0.2, 0.16]} color={c.amber} emissive />
        {selected && <SelectionRing radius={2.6} />}
        <VehiclePin
          id={selectedPallet && p ? p.id : id}
          label={selectedPallet && p ? p.name : forkliftLabels[f.state]}
          tone={f.battery < 18 ? 'amber' : 'green'}
          selected={selected || selectedPallet}
        />
      </Interactive>
    </group>
  );
}
