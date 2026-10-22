import { useEffect, useMemo, useRef } from 'react';
import { InstancedMesh, Object3D } from 'three';
import { Html, Line } from '@react-three/drei';
import { useAtlasStore } from '../store/useAtlasStore';
import { CONFIG } from '../lib/config';
import { Box, InstancedBoxes, Interactive, Label } from '../scene/primitives';
import { TruckEntity } from '../scene/Vehicles';
import { ROAD_GRAPH, roadNode, signalGreen } from '../world/roads';
import { TrafficInstances } from './TrafficInstances';
import { CityScene, useCityProfile } from './city/CityScene';
import { DataLayers } from './DataLayers';
import { GroundPlane, Puddles, RoadWear } from './city/Ground';
import { ZONES, inRect, type Rect } from '../city/scenery';
import { hashString, mulberry32 } from '../city/rng';

const c = CONFIG.colors;
function Foliage({
  items,
  color,
}: {
  items: { position: [number, number, number]; scale: [number, number, number] }[];
  color: string;
}) {
  const ref = useRef<InstancedMesh>(null),
    dummy = useMemo(() => new Object3D(), []);
  useEffect(() => {
    if (!ref.current) return;
    items.forEach((item, i) => {
      dummy.position.set(...item.position);
      dummy.scale.set(...item.scale);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items, dummy]);
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow>
        <coneGeometry args={[1, 1, 5]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </instancedMesh>
      <InstancedBoxes
        items={items.map((t) => ({
          position: [t.position[0], 1.1, t.position[2]],
          scale: [0.4, 2.2, 0.4],
        }))}
        color="#7A5C3E"
      />
    </group>
  );
}
export function RegionScene() {
  const sim = useAtlasStore((s) => s.sim),
    id = useAtlasStore((s) => s.warehouseId),
    selection = useAtlasStore((s) => s.selection);
  const warehouse = sim.warehouses.find((w) => w.id === id)!;
  const { profile, palette } = useCityProfile();
  const roads = useMemo(
    () =>
      ROAD_GRAPH.edges.filter(
        (e) => e.from < e.to || (e.from.startsWith('r') && e.to.startsWith('r')),
      ),
    [],
  );
  const marks = useMemo(
    () =>
      roads.flatMap((e) => {
        const a = roadNode(e.from),
          b = roadNode(e.to),
          yaw = Math.atan2(b.x - a.x, b.z - a.z);
        return Array.from({ length: Math.floor(e.length / 12) }, (_, i) => ({
          position: [
            a.x + ((b.x - a.x) * (i + 0.5)) / Math.floor(e.length / 12),
            0.035,
            a.z + ((b.z - a.z) * (i + 0.5)) / Math.floor(e.length / 12),
          ] as [number, number, number],
          scale: [0.18, 0.035, 4] as [number, number, number],
          yaw,
        }));
      }),
    [roads],
  );
  const trees = useMemo(() => {
    const rand = mulberry32(hashString(`trees:${warehouse.id}`));
    const keepOut: Rect[] = [
      ...Object.values(ZONES),
      { x0: -210, x1: 560, z0: 126, z1: 150 },
      { x0: -130, x1: 430, z0: -190, z1: -140 },
    ];
    return Array.from({ length: 260 }, (_, i) => ({
      position: [
        -95 + (i % 20) * 22 + rand() * 9,
        3,
        -165 + Math.floor(i / 20) * 26 + rand() * 9,
      ] as [number, number, number],
      scale: [2.2 + rand() * 1.2, 4.6 + rand() * 3.2, 2.2 + rand() * 1.2] as [
        number,
        number,
        number,
      ],
    })).filter(({ position: [x, , z] }) => {
      if (rand() > palette.treeDensity) return false;
      if (Math.abs(x - 281) < 22) return false;
      if (Math.abs(x) < 50 && z > -30 && z < 44) return false;
      if (keepOut.some((r) => inRect(x, z, r, 3))) return false;
      if (
        profile.sites.some(
          (st) => Math.abs(x - st.x) < st.sx / 2 + 12 && Math.abs(z - st.z) < st.sz / 2 + 24,
        )
      )
        return false;
      return roads.every((edge) => {
        const a = roadNode(edge.from),
          b = roadNode(edge.to),
          dx = b.x - a.x,
          dz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(x - a.x - t * dx, z - a.z - t * dz) > 13;
      });
    });
  }, [roads, profile, palette, warehouse.id]);
  const selected =
    selection?.kind === 'truck' ? sim.trucks.find((t) => t.id === selection.id)?.road : undefined;
  return (
    <group>
      <Box position={[115, -0.65, 0]} size={[510, 1, 365]} color={palette.groundDark} />
      <GroundPlane color={palette.ground} y={-0.8} size={3200} center={[115, 0]} />
      <GroundPlane color={palette.ground} y={-0.09} size={520} center={[115, 0]} />
      <RoadWear seed={warehouse.id} />
      <Puddles area={[-80, 300, -140, 120]} seed={warehouse.id} />
      <Box position={[280, -0.02, 0]} size={[15, 0.1, 345]} color={palette.water} />
      <Label
        text={profile.district.toUpperCase()}
        position={[113, 0.02, -92]}
        width={150}
        height={5}
        ground
        color="#EAF0F5"
      />
      {roads.map((e) => {
        const a = roadNode(e.from),
          b = roadNode(e.to);
        return (
          <Box
            key={e.id}
            position={[(a.x + b.x) / 2, 0, (a.z + b.z) / 2]}
            size={[14, 0.09, e.length + 10]}
            rotation={[0, Math.atan2(b.x - a.x, b.z - a.z), 0]}
            color={e.kind === 'highway' ? c.highway : c.asphalt}
          />
        );
      })}
      <InstancedBoxes items={marks} color="#F5A524" />
      <Foliage items={trees} color={palette.treeColor} />
      <CityScene />
      <DataLayers />
      <Interactive selection={{ kind: 'warehouse', id }}>
        <group
          onClick={(e) => {
            e.stopPropagation();
            useAtlasStore.getState().setWarehouse(id);
          }}
        >
          <Box position={[0, 4, -8]} size={[40, 8, 25]} color={c.warehouse} />
          <Box position={[0, 8.3, -8]} size={[41, 0.6, 26]} color={warehouse.accent} />
          <Box position={[0, 0.05, 14]} size={[82, 0.1, 39]} color="#6B7385" />
          {sim.docks
            .filter((d) => d.warehouseId === id)
            .map((d) => (
              <group key={d.id} position={[d.position.x, 0, 4.7]}>
                <Box position={[0, 1.8, 0]} size={[4, 3.6, 0.2]} color="#4A5568" />
                <Box
                  position={[0, 4, 0]}
                  size={[4, 0.25, 0.22]}
                  color={d.truckId ? c.amber : c.emerald}
                  emissive
                />
              </group>
            ))}
          <Label
            text={`ATLASGRID / ${warehouse.code}`}
            position={[0, 5.6, 4.6]}
            width={32}
            height={3}
          />
          <Html position={[0, 17, -8]} center zIndexRange={[10, 0]}>
            <button
              className="hub-marker region-hub"
              onClick={() => useAtlasStore.getState().setWarehouse(id)}
            >
              <span className="eyebrow">{warehouse.city} / OWN HUB</span>
              <strong>{warehouse.name}</strong>
              <span>Enter warehouse ↗</span>
            </button>
          </Html>
        </group>
      </Interactive>
      <Box position={[55, 0.01, 32]} size={[25, 0.1, 9]} color={c.asphalt} />
      <group position={[325, 0.04, 75]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <ringGeometry args={[12, 28, 48]} />
          <meshStandardMaterial color={c.asphalt} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[12, 24]} />
          <meshStandardMaterial color="#5F9B4E" />
        </mesh>
        <Box position={[0, 2, 0]} size={[3, 4, 3]} color={c.emerald} />
      </group>
      {[257.5, 302.5].map((x, i) => (
        <group key={x}>
          <Box
            position={[x, 2.1, 40]}
            size={[45, 0.38, 14]}
            rotation={[0, 0, i ? -0.093 : 0.093]}
            color="#7E8899"
          />
          {[32.8, 47.2].map((z) => (
            <Box
              key={z}
              position={[x, 3, z]}
              size={[45, 0.9, 0.25]}
              rotation={[0, 0, i ? -0.093 : 0.093]}
              color="#C5CCD6"
            />
          ))}
        </group>
      ))}
      <Label text="EASTBOUND / TOLL 02" position={[309, 4, 7]} width={35} height={2.7} />
      {[32, 48].map((z) => (
        <Box key={z} position={[313, 3, z]} size={[0.4, 6, 0.4]} color="#8D98A8" />
      ))}
      <Box position={[313, 6.2, 40]} size={[2, 0.7, 17]} color={warehouse.accent} />
      <Box position={[317, 1.6, 26]} size={[5, 3.2, 4]} color="#9AA6B6" />
      {ROAD_GRAPH.nodes
        .filter((n) => n.signal)
        .map((n) => (
          <group key={n.id} position={[n.x - 9, 0, n.z - 9]}>
            <Box position={[0, 3.2, 0]} size={[0.28, 6.4, 0.28]} color="#9AA4B3" />
            <Box position={[0, 5.8, 0]} size={[1, 2, 0.8]} color="#111827" />
            <Box
              position={[0, 6.3, 0.45]}
              size={[0.46, 0.46, 0.1]}
              color={signalGreen(n, 'x', sim.time) ? '#1A4136' : c.error}
              emissive
            />
            <Box
              position={[0, 5.3, 0.45]}
              size={[0.46, 0.46, 0.1]}
              color={signalGreen(n, 'x', sim.time) ? c.emerald : '#18392F'}
              emissive
            />
          </group>
        ))}
      {ROAD_GRAPH.nodes
        .filter((n) => n.signal)
        .map((n) => (
          <group key={`vertical-${n.id}`} position={[n.x + 9, 0, n.z - 9]}>
            <Box position={[0, 3.2, 0]} size={[0.28, 6.4, 0.28]} color="#9AA4B3" />
            <Box position={[0, 5.8, 0]} size={[1, 2, 0.8]} color="#111827" />
            <Box
              position={[0, 6.3, 0.45]}
              size={[0.46, 0.46, 0.1]}
              color={signalGreen(n, 'z', sim.time) ? '#1A4136' : c.error}
              emissive
            />
            <Box
              position={[0, 5.3, 0.45]}
              size={[0.46, 0.46, 0.1]}
              color={signalGreen(n, 'z', sim.time) ? c.emerald : '#18392F'}
              emissive
            />
          </group>
        ))}
      {sim.closures
        .filter((cl) => cl.warehouseId === id)
        .map((cl) => {
          const e = ROAD_GRAPH.edges.find((e) => e.id === cl.edgeId)!,
            n = roadNode(e.to);
          return (
            <Box
              key={cl.edgeId}
              position={[n.x, 1, n.z - 15]}
              size={[7, 1, 1]}
              color={c.amber}
              emissive
            />
          );
        })}
      {selected && selected.warehouseId === id && (
        <Line
          points={selected.nodes.slice(selected.index).map((node) => {
            const p = roadNode(node);
            return [p.x, 0.4, p.z] as [number, number, number];
          })}
          color={c.charger}
          lineWidth={3}
        />
      )}
      <TrafficInstances key={id} warehouseId={id} />
      {sim.trucks
        .filter((t) => t.road?.warehouseId === id || t.warehouseId === id)
        .map((t) => (
          <TruckEntity key={t.id} id={t.id} />
        ))}
    </group>
  );
}
