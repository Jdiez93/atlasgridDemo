import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, CylinderGeometry, InstancedMesh, Object3D } from 'three';
import type { SiteSpec } from '../../city/profiles';
import { dockAgent, type DockAgent } from '../../city/choreography';
import { conveyorBoxes, walker } from '../../city/population';
import { cityClock } from './ColoredInstances';
import { dockX } from './CitySites';

type Vec = [number, number, number];
interface Part {
  pos: Vec;
  size: Vec;
  color: string;
  rotX?: number;
  rough?: number;
  metal?: number;
  emissive?: number;
  wheel?: boolean;
  /** Color por instancia tomado de la empresa. */
  tint?: 'color' | 'accent';
}
const TRUCK_SCALE = 1.2;
const TRUCK: Part[] = [
  { pos: [0, 0.95, -0.2], size: [2.1, 0.32, 9.6], color: '#1A1F2B', rough: 0.6 },
  {
    pos: [0, 2.62, -1.85],
    size: [2.6, 2.46, 6.4],
    color: '#fff',
    tint: 'color',
    rough: 0.4,
    metal: 0.2,
  },
  { pos: [1.33, 1.82, -1.85], size: [0.06, 0.4, 6.3], color: '#fff', tint: 'accent' },
  { pos: [-1.33, 1.82, -1.85], size: [0.06, 0.4, 6.3], color: '#fff', tint: 'accent' },
  { pos: [0, 3.88, -1.85], size: [2.66, 0.1, 6.5], color: '#F4F7FB' },
  { pos: [0, 2.0, 3.3], size: [2.5, 2.3, 2.3], color: '#F4F7FB', rough: 0.35, metal: 0.25 },
  { pos: [0, 3.4, 2.9], size: [2.46, 0.5, 1.5], color: '#EEF2F8', rotX: -0.14 },
  {
    pos: [0, 2.6, 4.46],
    size: [2.2, 1.15, 0.06],
    color: '#1B2A3A',
    rough: 0.08,
    metal: 0.85,
    rotX: -0.1,
  },
  { pos: [1.27, 2.65, 3.75], size: [0.04, 0.95, 1.05], color: '#1B2A3A', rough: 0.08, metal: 0.85 },
  {
    pos: [-1.27, 2.65, 3.75],
    size: [0.04, 0.95, 1.05],
    color: '#1B2A3A',
    rough: 0.08,
    metal: 0.85,
  },
  { pos: [0, 0.88, 4.56], size: [2.6, 0.4, 0.36], color: '#2A303D', rough: 0.6 },
  { pos: [0.92, 1.5, 4.5], size: [0.5, 0.26, 0.08], color: '#FFF1CC', emissive: 1.6 },
  { pos: [-0.92, 1.5, 4.5], size: [0.5, 0.26, 0.08], color: '#FFF1CC', emissive: 1.6 },
  { pos: [0.95, 1.5, -5.08], size: [0.3, 0.2, 0.06], color: '#FF2A2A', emissive: 1.4 },
  { pos: [-0.95, 1.5, -5.08], size: [0.3, 0.2, 0.06], color: '#FF2A2A', emissive: 1.4 },
  { pos: [1.5, 3.05, 4.3], size: [0.5, 0.05, 0.05], color: '#222' },
  { pos: [-1.5, 3.05, 4.3], size: [0.5, 0.05, 0.05], color: '#222' },
  { pos: [1.8, 2.95, 4.28], size: [0.1, 0.62, 0.26], color: '#14171F' },
  { pos: [-1.8, 2.95, 4.28], size: [0.1, 0.62, 0.26], color: '#14171F' },
];
const WHEEL_Z = [3.85, 1.75, 0.6, -3.0, -4.05];
const WHEELS: Vec[] = [-1, 1].flatMap((side) => WHEEL_Z.map((z) => [side * 1.18, 0.52, z] as Vec));
const FORKLIFT: Part[] = [
  { pos: [0, 0.9, 0], size: [1.5, 1.1, 2.3], color: '#FF7A1A', rough: 0.5 },
  { pos: [0, 2.0, -0.3], size: [1.5, 0.1, 1.2], color: '#2A303D' },
  { pos: [0.7, 1.45, -0.3], size: [0.08, 1.0, 0.08], color: '#2A303D' },
  { pos: [-0.7, 1.45, -0.3], size: [0.08, 1.0, 0.08], color: '#2A303D' },
  { pos: [0, 1.4, 1.25], size: [1.2, 2.4, 0.15], color: '#3A4252' },
  { pos: [0.4, 0.2, 1.9], size: [0.15, 0.1, 1.4], color: '#9AA4B3', metal: 0.7 },
  { pos: [-0.4, 0.2, 1.9], size: [0.15, 0.1, 1.4], color: '#9AA4B3', metal: 0.7 },
  { pos: [0, 0.45, -1.2], size: [1.3, 0.8, 0.5], color: '#2A303D' },
];
const FORKLIFT_SCALE = 1.3;
const wheelGeometry = (() => {
  const g = new CylinderGeometry(0.52, 0.52, 0.4, 14);
  g.rotateZ(Math.PI / 2);
  return g;
})();

interface Ctx {
  d: Object3D;
  c: Color;
}
/** Colocación de una pieza local (en el marco del vehículo) en el mundo. */
function place(
  mesh: InstancedMesh | null,
  i: number,
  ctx: Ctx,
  origin: { x: number; z: number; yaw: number },
  scale: number,
  part: Part,
  spin = 0,
) {
  if (!mesh) return;
  const cos = Math.cos(origin.yaw),
    sin = Math.sin(origin.yaw);
  const [lx, ly, lz] = part.pos;
  ctx.d.position.set(
    origin.x + (lx * cos + lz * sin) * scale,
    ly * scale,
    origin.z + (-lx * sin + lz * cos) * scale,
  );
  ctx.d.rotation.set(part.rotX ?? spin, origin.yaw, 0, 'YXZ');
  ctx.d.scale.set(part.size[0] * scale, part.size[1] * scale, part.size[2] * scale);
  ctx.d.updateMatrix();
  mesh.setMatrixAt(i, ctx.d.matrix);
}
function Meshes({
  parts,
  count,
  refs,
  wheels,
}: {
  parts: Part[];
  count: number;
  refs: React.MutableRefObject<(InstancedMesh | null)[]>;
  wheels?: number;
}) {
  return (
    <>
      {parts.map((p, i) => (
        <instancedMesh
          key={i}
          ref={(m) => {
            refs.current[i] = m;
          }}
          args={[undefined, undefined, count]}
          castShadow={!p.emissive}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={p.color}
            roughness={p.rough ?? 0.55}
            metalness={p.metal ?? 0.15}
            emissive={p.emissive ? p.color : '#000000'}
            emissiveIntensity={p.emissive ?? 0}
          />
        </instancedMesh>
      ))}
      {wheels && (
        <instancedMesh
          ref={(m) => {
            refs.current[parts.length] = m;
          }}
          args={[wheelGeometry, undefined, count * wheels]}
          castShadow
          frustumCulled={false}
        >
          <meshStandardMaterial color="#14171F" roughness={0.95} />
        </instancedMesh>
      )}
    </>
  );
}
/** Vida de las naves de terceros: camiones, carretillas, palés, operarios, puertas y cintas. */
export function CityLife({ sites }: { sites: SiteSpec[] }) {
  const docks = useMemo(() => sites.reduce((n, s) => n + s.docks, 0), [sites]);
  const trucks = useRef<(InstancedMesh | null)[]>([]);
  const forks = useRef<(InstancedMesh | null)[]>([]);
  const doors = useRef<InstancedMesh>(null);
  const lamps = useRef<InstancedMesh>(null);
  const palBase = useRef<InstancedMesh>(null);
  const palLoad = useRef<InstancedMesh>(null);
  const torso = useRef<InstancedMesh>(null);
  const legs = useRef<InstancedMesh>(null);
  const head = useRef<InstancedMesh>(null);
  const parcels = useRef<InstancedMesh>(null);
  const ctx = useMemo<Ctx>(() => ({ d: new Object3D(), c: new Color() }), []);
  const palletCap = docks * 7 + 8;
  const workerCap = sites.length * 3;
  const sortingSites = useMemo(() => sites.filter((s) => s.kind === 'sorting'), [sites]);
  const colorCache = useMemo(() => {
    const m = new Map<string, Color>();
    for (const s of sites) {
      m.set(s.company.color, new Color(s.company.color));
      m.set(s.company.accent, new Color(s.company.accent));
    }
    return m;
  }, [sites]);
  useFrame(() => {
    const t = cityClock.t;
    let nt = 0,
      nf = 0,
      np = 0,
      nd = 0,
      nw = 0;
    const { d, c } = ctx;
    sites.forEach((site, si) => {
      const dir = site.facing === 'S' ? 1 : -1;
      const faceZ = site.z + dir * (site.sz / 2);
      for (let k = 0; k < site.docks; k++) {
        const a: DockAgent = dockAgent(site, k, t);
        // puertas y luces
        const u = dockX(site, k);
        const h = 4.5 * (1 - 0.94 * a.door);
        d.position.set(u, 4.6 - h / 2, faceZ + dir * 0.36);
        d.rotation.set(0, 0, 0);
        d.scale.set(4.5, h, 0.12);
        d.updateMatrix();
        doors.current?.setMatrixAt(nd, d.matrix);
        d.position.set(u, 5.4, faceZ + dir * 0.9);
        d.scale.set(0.5, 0.3, 0.3);
        d.updateMatrix();
        lamps.current?.setMatrixAt(nd, d.matrix);
        lamps.current?.setColorAt(
          nd,
          c.set(a.door > 0.5 ? '#2DE39A' : a.truck ? '#F5A524' : '#E24B4B'),
        );
        nd++;
        // camión
        if (a.truck && a.truck.fade > 0.02) {
          const sc = TRUCK_SCALE * (0.55 + 0.45 * a.truck.fade);
          const o = { x: a.truck.x, z: a.truck.z, yaw: a.truck.yaw };
          TRUCK.forEach((p, pi) => place(trucks.current[pi], nt, ctx, o, sc, p));
          const tint = colorCache.get(site.company.color);
          const accent = colorCache.get(site.company.accent);
          if (tint) trucks.current[1]?.setColorAt(nt, tint);
          if (accent) {
            trucks.current[2]?.setColorAt(nt, accent);
            trucks.current[3]?.setColorAt(nt, accent);
          }
          const spin = (a.truck.distance * (a.truck.reverse ? -1 : 1)) / 0.52;
          WHEELS.forEach((w, wi) =>
            place(
              trucks.current[TRUCK.length],
              nt * WHEELS.length + wi,
              ctx,
              o,
              sc,
              { pos: w, size: [1, 1, 1], color: '#000' },
              spin,
            ),
          );
          nt++;
        }
        // carretilla + palé transportado
        if (a.forklift) {
          const o = { x: a.forklift.x, z: a.forklift.z, yaw: a.forklift.yaw };
          FORKLIFT.forEach((p, pi) => place(forks.current[pi], nf, ctx, o, FORKLIFT_SCALE, p));
          nf++;
          if (a.forklift.carrying) {
            const lift: Part = { pos: [0, 0.55, 2.0], size: [1.2, 0.14, 0.9], color: '#000' };
            place(palBase.current, np, ctx, o, FORKLIFT_SCALE, lift);
            place(palLoad.current, np, ctx, o, FORKLIFT_SCALE, {
              pos: [0, 1.1, 2.0],
              size: [1.05, 0.95, 0.75],
              color: '#000',
            });
            palLoad.current?.setColorAt(np, colorCache.get(site.company.color) ?? c.set('#C99A62'));
            np++;
          }
        }
        // pila de palés junto al muelle
        for (let i = 0; i < a.stack; i++) {
          const col = i % 2,
            row = Math.floor(i / 2);
          const o = {
            x: a.stackAt.x + (col - 0.5) * 1.5,
            z: a.stackAt.z + dir * row * 1.1,
            yaw: 0,
          };
          place(palBase.current, np, ctx, o, 1, {
            pos: [0, 0.08, 0],
            size: [1.3, 0.14, 0.95],
            color: '#000',
          });
          place(palLoad.current, np, ctx, o, 1, {
            pos: [0, 0.66, 0],
            size: [1.15, 1.0, 0.8],
            color: '#000',
          });
          palLoad.current?.setColorAt(
            np,
            colorCache.get(i % 2 ? site.company.accent : site.company.color) ?? c.set('#C99A62'),
          );
          np++;
        }
        // operario junto a la pila mientras se trabaja
        if (a.phase === 'loading' && nw < workerCap) {
          const w = walker(
            `${site.id}:${k}`,
            t,
            [a.stackAt.x, a.stackAt.z + dir * 1.2],
            [a.stackAt.x + (a.stackAt.x > a.dock.x ? 4 : -4), a.stackAt.z + dir * 2.6],
          );
          d.rotation.set(0, w.yaw, 0);
          d.position.set(w.x, 1.15 + w.bob, w.z);
          d.scale.set(0.6, 0.95, 0.38);
          d.updateMatrix();
          torso.current?.setMatrixAt(nw, d.matrix);
          d.position.set(w.x, 0.42 + w.bob, w.z);
          d.scale.set(0.46, 0.84, 0.3);
          d.updateMatrix();
          legs.current?.setMatrixAt(nw, d.matrix);
          d.position.set(w.x, 1.85 + w.bob, w.z);
          d.scale.set(0.3, 0.3, 0.3);
          d.updateMatrix();
          head.current?.setMatrixAt(nw, d.matrix);
          nw++;
        }
      }
      void si;
    });
    // cintas exteriores de las naves de clasificación: paquetes en movimiento
    let nc = 0;
    for (const s of sortingSites) {
      const bx = s.x + s.sx / 2 + 7;
      conveyorBoxes(t, 8, 0.045).forEach((f) => {
        d.rotation.set(0, 0, 0);
        d.position.set(bx, 1.55, s.z - (s.sz - 4) / 2 + f * (s.sz - 4));
        d.scale.set(1.1, 0.7, 0.9);
        d.updateMatrix();
        parcels.current?.setMatrixAt(nc++, d.matrix);
      });
    }
    const commit = (m: InstancedMesh | null, n: number, color = false) => {
      if (!m) return;
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (color && m.instanceColor) m.instanceColor.needsUpdate = true;
    };
    trucks.current.forEach((m, i) =>
      commit(m, i === TRUCK.length ? nt * WHEELS.length : nt, i >= 1 && i <= 3),
    );
    forks.current.forEach((m) => commit(m, nf));
    commit(doors.current, nd);
    commit(lamps.current, nd, true);
    commit(palBase.current, np);
    commit(palLoad.current, np, true);
    commit(torso.current, nw);
    commit(legs.current, nw);
    commit(head.current, nw);
    commit(parcels.current, nc);
  });
  return (
    <group>
      <Meshes parts={TRUCK} count={docks} refs={trucks} wheels={WHEELS.length} />
      <Meshes parts={FORKLIFT} count={docks} refs={forks} />
      <instancedMesh
        ref={doors}
        args={[undefined, undefined, docks]}
        frustumCulled={false}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#B9C2CF" roughness={0.45} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={lamps} args={[undefined, undefined, docks]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#fff" emissive="#ffffff" emissiveIntensity={1.6} />
      </instancedMesh>
      <instancedMesh
        ref={palBase}
        args={[undefined, undefined, palletCap]}
        frustumCulled={false}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#B88A55" roughness={0.9} />
      </instancedMesh>
      <instancedMesh
        ref={palLoad}
        args={[undefined, undefined, palletCap]}
        frustumCulled={false}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </instancedMesh>
      <instancedMesh
        ref={torso}
        args={[undefined, undefined, workerCap]}
        frustumCulled={false}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#C8E61F"
          roughness={0.8}
          emissive="#C8E61F"
          emissiveIntensity={0.25}
        />
      </instancedMesh>
      <instancedMesh ref={legs} args={[undefined, undefined, workerCap]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#2A3142" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, workerCap]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#F4F7FB" roughness={0.6} />
      </instancedMesh>
      <instancedMesh
        ref={parcels}
        args={[undefined, undefined, Math.max(1, sortingSites.length * 8)]}
        frustumCulled={false}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#C99A62" roughness={0.85} />
      </instancedMesh>
    </group>
  );
}
