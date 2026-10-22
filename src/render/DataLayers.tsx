import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { heat, edgeCongestion } from '../lib/heat';
import { Color, InstancedMesh, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { useAtlasStore } from '../store/useAtlasStore';
import { ROAD_GRAPH, roadNode } from '../world/roads';
import { dockAgent } from '../city/choreography';
import { cityProfile } from '../city/profiles';
import { cityClock } from './city/ColoredInstances';

export function CongestionLayer() {
  const ref = useRef<InstancedMesh>(null);
  const d = useMemo(() => new Object3D(), []);
  const c = useMemo(() => new Color(), []);
  const edges = useMemo(() => ROAD_GRAPH.edges.filter((e) => e.kind !== 'bridge'), []);
  const last = useRef(0);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.25 || !ref.current) return;
    last.current = clock.elapsedTime;
    const s = useAtlasStore.getState();
    const agents = [
      ...s.sim.traffic,
      ...s.sim.trucks.flatMap((t) => (t.road ? [t.road] : [])),
    ].filter((a) => a.warehouseId === s.warehouseId);
    edges.forEach((e, i) => {
      const a = roadNode(e.from),
        b = roadNode(e.to);
      d.position.set((a.x + b.x) / 2, 0.16, (a.z + b.z) / 2);
      d.rotation.set(0, 0, 0);
      d.scale.set(
        e.axis === 'x' ? Math.abs(b.x - a.x) : 11,
        0.05,
        e.axis === 'z' ? Math.abs(b.z - a.z) : 11,
      );
      d.updateMatrix();
      ref.current?.setMatrixAt(i, d.matrix);
      ref.current?.setColorAt(i, heat(edgeCongestion(agents, e.from, e.to) * 1.4 + 0.08, c));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, edges.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.62}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
/** Actividad de muelles de cada nave: calor según muelles con camión presente. */
export function ActivityLayer() {
  const profile = useMemo(() => cityProfile(useAtlasStore.getState().warehouseId), []);
  const meshes = useRef<(Mesh | null)[]>([]);
  const c = useMemo(() => new Color(), []);
  const last = useRef(0);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.3) return;
    last.current = clock.elapsedTime;
    profile.sites.forEach((site, i) => {
      let busy = 0;
      for (let k = 0; k < site.docks; k++) if (dockAgent(site, k, cityClock.t).truck) busy++;
      const m = meshes.current[i];
      if (m) (m.material as MeshBasicMaterial).color.copy(heat(busy / site.docks, c));
    });
  });
  return (
    <group>
      {profile.sites.map((s, i) => (
        <mesh
          key={s.id}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          position={[s.x, 0.2, s.z + (s.facing === 'S' ? 8 : -8)]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[s.sx + 12, s.sz + 22]} />
          <meshBasicMaterial
            color="#10B981"
            transparent
            opacity={0.5}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
export function DataLayers() {
  const layer = useAtlasStore((s) => s.layer);
  const view = useAtlasStore((s) => s.view);
  if (view !== 'region') return null;
  return layer === 'congestion' ? (
    <CongestionLayer />
  ) : layer === 'activity' ? (
    <ActivityLayer />
  ) : null;
}
