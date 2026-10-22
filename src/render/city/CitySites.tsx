import { useMemo } from 'react';
import { Box, Label } from '../../scene/primitives';
import type { SiteKind, SiteSpec } from '../../city/profiles';
import type { Inst } from '../../city/scenery';
import { ColoredInstances } from './ColoredInstances';
import { ConcreteSlab } from './Ground';

const WALL: Record<SiteKind, string> = {
  shed: '#D3D9E3',
  cold: '#EEF2F6',
  office: '#B9C9D6',
  robotic: '#C6CEDA',
  sorting: '#DCD3C4',
  terminal: '#CBD3DE',
};
export const dockX = (site: SiteSpec, d: number) =>
  site.x + (d - (site.docks - 1) / 2) * (site.sx * 0.32);
function Emblem({
  site,
  y,
  x,
  dir,
  faceZ,
}: {
  site: SiteSpec;
  y: number;
  x: number;
  dir: number;
  faceZ: number;
}) {
  const { emblem, accent } = site.company;
  const z = faceZ + dir * 0.28;
  if (emblem === 'dot')
    return (
      <mesh position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.1, 18]} />
        <meshStandardMaterial color={accent} />
      </mesh>
    );
  if (emblem === 'ring')
    return (
      <mesh position={[x, y, z]}>
        <torusGeometry args={[0.8, 0.24, 8, 20]} />
        <meshStandardMaterial color={accent} />
      </mesh>
    );
  if (emblem === 'chevron')
    return (
      <>
        <Box
          position={[x - 0.35, y, z]}
          size={[0.5, 1.8, 0.1]}
          color={accent}
          rotation={[0, 0, 0.55]}
        />
        <Box
          position={[x + 0.35, y, z]}
          size={[0.5, 1.8, 0.1]}
          color={accent}
          rotation={[0, 0, -0.55]}
        />
      </>
    );
  return (
    <Box
      position={[x, y, z]}
      size={[1.8, 1.8, 0.1]}
      color={accent}
      rotation={[0, 0, Math.PI / 4]}
    />
  );
}
function Site({ site, index }: { site: SiteSpec; index: number }) {
  const dir = site.facing === 'S' ? 1 : -1;
  const faceZ = site.z + dir * (site.sz / 2);
  const gap = Math.abs(site.roadZ - faceZ);
  const h = site.height;
  const bay = Array.from({ length: site.docks }, (_, d) => dockX(site, d));
  const flip: [number, number, number] = [0, dir < 0 ? Math.PI : 0, 0];
  return (
    <group>
      {/* patio de hormigón entre la fachada y la carretera */}
      <ConcreteSlab
        position={[site.x, 0.04, faceZ + (dir * (gap - 7)) / 2]}
        size={[site.sx + 16, 0.1, gap - 7]}
        color="#7C8392"
      />
      <Box
        position={[site.x, 0.02, site.z]}
        size={[site.sx + 8, 0.08, site.sz + 8]}
        color="#6F7685"
      />
      {/* nave */}
      <Box
        position={[site.x, h / 2, site.z]}
        size={[site.sx, h, site.sz]}
        color={WALL[site.kind]}
      />
      <Box
        position={[site.x, h + 0.3, site.z]}
        size={[site.sx + 1, 0.6, site.sz + 1]}
        color="#8590A0"
      />
      <Box
        position={[site.x, h - 2.3, faceZ + dir * 0.07]}
        size={[site.sx - 1.5, 2.6, 0.16]}
        color={site.company.color}
      />
      <group position={[site.x + 2, h - 2.3, faceZ + dir * 0.2]} rotation={flip}>
        <Label
          text={site.company.name}
          position={[0, 0, 0]}
          width={site.sx - 7}
          height={2.1}
          color={site.company.accent}
        />
      </group>
      <Emblem site={site} x={site.x - site.sx / 2 + 3} y={h - 2.3} dir={dir} faceZ={faceZ} />
      {/* muelles */}
      {bay.map((u, d) => (
        <group key={d}>
          <Box position={[u, 2.35, faceZ + dir * 0.12]} size={[4.7, 4.7, 0.22]} color="#232A38" />
          <Box position={[u, 5.0, faceZ + dir * 0.5]} size={[5.3, 0.5, 0.9]} color="#394152" />
          {[-1, 1].map((k) => (
            <Box
              key={k}
              position={[u + k * 2.0, 0.9, faceZ + dir * 0.5]}
              size={[0.5, 1.0, 0.6]}
              color="#15181F"
            />
          ))}
          {[-1, 1].map((k) => (
            <Box
              key={k}
              position={[u + k * 2.3, 0.07, faceZ + dir * 8]}
              size={[0.16, 0.05, 15]}
              color="#F2F4F8"
            />
          ))}
        </group>
      ))}
      {/* extras por tipo */}
      {site.kind === 'cold' && (
        <>
          {[-1, 0, 1].map((k) => (
            <mesh key={k} position={[site.x + k * 6, h + 1.4, site.z]}>
              <cylinderGeometry args={[1.8, 1.8, 1.6, 16]} />
              <meshStandardMaterial color="#F4F7FB" roughness={0.4} metalness={0.3} />
            </mesh>
          ))}
          <Box
            position={[site.x + site.sx / 2 + 3, 2.2, site.z]}
            size={[4, 4.4, 8]}
            color="#E4E9EF"
          />
        </>
      )}
      {site.kind === 'office' && (
        <>
          <Box
            position={[site.x - site.sx * 0.2, h + 13, site.z - site.sz * 0.15]}
            size={[site.sx * 0.45, 26, site.sz * 0.5]}
            color="#8FB2C9"
          />
          <Box
            position={[site.x - site.sx * 0.2, h + 26.3, site.z - site.sz * 0.15]}
            size={[site.sx * 0.47, 0.6, site.sz * 0.52]}
            color="#6E7B8C"
          />
        </>
      )}
      {site.kind === 'robotic' && (
        <>
          <Box
            position={[site.x, h + 0.9, site.z]}
            size={[site.sx - 4, 0.25, site.sz - 4]}
            color="#2B3446"
            rotation={[0.06, 0, 0]}
          />
          <Box
            position={[site.x, h - 5.2, faceZ + dir * 0.2]}
            size={[site.sx - 2, 0.35, 0.1]}
            color="#10B981"
            emissive
          />
        </>
      )}
      {site.kind === 'sorting' && (
        <>
          <Box
            position={[site.x + site.sx / 2 + 7, 1.1, site.z]}
            size={[2.2, 0.5, site.sz - 4]}
            color="#4A5164"
          />
          <Box
            position={[site.x + site.sx / 2 + 7, 0.55, site.z]}
            size={[3, 0.3, site.sz - 3]}
            color="#7C8392"
          />
        </>
      )}
      {site.kind === 'shed' && index % 2 === 0 && (
        <>
          {[-1, 1].map((k) => (
            <group key={k} position={[site.x - site.sx / 2 - 5, 0, site.z + k * 5]}>
              <mesh position={[0, 5, 0]} castShadow>
                <cylinderGeometry args={[2.2, 2.2, 10, 16]} />
                <meshStandardMaterial color="#D8DEE8" roughness={0.5} metalness={0.4} />
              </mesh>
              <mesh position={[0, 10.4, 0]}>
                <coneGeometry args={[2.2, 1.6, 16]} />
                <meshStandardMaterial color="#9AA4B3" />
              </mesh>
            </group>
          ))}
        </>
      )}
      {[-1, 1].map((k) => (
        <Box
          key={`hvac${k}`}
          position={[site.x + k * (site.sx * 0.25), h + 1.6, site.z - 3]}
          size={[4, 1.9, 5]}
          color="#9AA4B3"
        />
      ))}
    </group>
  );
}
export function CitySites({ sites }: { sites: SiteSpec[] }) {
  const ribs = useMemo<Inst[]>(
    () =>
      sites.flatMap((s) =>
        [-1, 1].flatMap((side) =>
          Array.from({ length: Math.floor(s.sz / 1.6) }, (_, i) => ({
            position: [
              s.x + side * (s.sx / 2 + 0.05),
              s.height / 2,
              s.z - s.sz / 2 + 0.8 + i * 1.6,
            ] as [number, number, number],
            scale: [0.12, s.height - 0.4, 0.22] as [number, number, number],
            color: '#B5BECB',
          })),
        ),
      ),
    [sites],
  );
  const sideWindows = useMemo<Inst[]>(
    () =>
      sites.flatMap((s) =>
        [-1, 1].flatMap((side) =>
          Array.from({ length: Math.floor((s.sz - 4) / 4.2) }, (_, i) => ({
            position: [
              s.x + side * (s.sx / 2 + 0.12),
              s.height * 0.62,
              s.z - s.sz / 2 + 3 + i * 4.2,
            ] as [number, number, number],
            scale: [0.1, 1.5, 2.2] as [number, number, number],
            color: '#9FB6C8',
          })),
        ),
      ),
    [sites],
  );
  const windows = useMemo<Inst[]>(
    () =>
      sites
        .filter((s) => s.kind === 'office')
        .flatMap((s) =>
          Array.from({ length: 7 }, (_, i) => ({
            position: [
              s.x - s.sx * 0.2,
              s.height + 3 + i * 3.4,
              s.z - s.sz * 0.15 + (s.sz * 0.5) / 2 + 0.05,
            ] as [number, number, number],
            scale: [s.sx * 0.4, 1.4, 0.12] as [number, number, number],
            color: '#3C5668',
          })),
        ),
    [sites],
  );
  return (
    <group>
      {sites.map((s, i) => (
        <Site key={s.id} site={s} index={i} />
      ))}
      <ColoredInstances items={ribs} castShadow={false} />
      <ColoredInstances
        items={sideWindows}
        castShadow={false}
        roughness={0.15}
        metalness={0.5}
        emissive={1.7}
      />
      <ColoredInstances
        items={windows}
        castShadow={false}
        roughness={0.2}
        metalness={0.6}
        emissive={0.5}
      />
    </group>
  );
}
