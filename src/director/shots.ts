import { cityProfile } from '../city/profiles';
import { dockAgent } from '../city/choreography';
import { planeAt, trainCars, RAIL_Z } from '../city/population';
import { mulberry32 } from '../city/rng';
import type { Simulation } from '../sim/types';

/** Modo Director: elige planos cinematográficos de los eventos relevantes. Todo puro y testeable. */
export interface Shot {
  id: string;
  label: string;
  target: [number, number, number];
  distance: number;
  height: number;
  azimuth: number;
  /** Radianes de órbita lenta durante el plano. */
  sweep: number;
  duration: number;
  priority: number;
}
export type DirectorView = 'region' | 'warehouse' | 'world';
const TRUCK_LABEL: Record<string, string> = {
  EN_PUERTA: 'arriving at the gate',
  MANIOBRANDO: 'maneuvering to dock',
  EN_MUELLE: 'docked',
  CARGANDO: 'loading',
  DESCARGANDO: 'unloading',
  SALIENDO: 'leaving the hub',
};
export function candidateShots(
  sim: Simulation,
  view: DirectorView,
  hubId: string,
  t: number,
): Shot[] {
  const shots: Shot[] = [];
  const own = sim.trucks.filter((x) => x.warehouseId === hubId && TRUCK_LABEL[x.state]);
  if (view === 'warehouse') {
    shots.push({
      id: 'overview',
      label: `${hubId} · overview`,
      target: [0, 3, 6],
      distance: 62,
      height: 30,
      azimuth: 0.9,
      sweep: 0.5,
      duration: 9,
      priority: 1,
    });
    for (const x of own)
      shots.push({
        id: `truck:${x.id}`,
        label: `${x.id} ${TRUCK_LABEL[x.state]}`,
        target: [x.position.x, 2.5, x.position.z],
        distance: 24,
        height: 9,
        azimuth: x.yaw + 2.4,
        sweep: 0.35,
        duration: 7,
        priority: x.state === 'EN_PUERTA' || x.state === 'MANIOBRANDO' ? 4 : 3,
      });
    for (const f of sim.forklifts.filter((f) => f.warehouseId === hubId && f.speed > 0.5))
      shots.push({
        id: `fork:${f.id}`,
        label: `${f.id} moving pallets`,
        target: [f.position.x, 1.5, f.position.z],
        distance: 16,
        height: 6,
        azimuth: 1.2,
        sweep: 0.4,
        duration: 6,
        priority: 2,
      });
    return shots;
  }
  if (view === 'world')
    return [
      {
        id: 'world',
        label: 'Global network',
        target: [0, 0, 5],
        distance: 210,
        height: 150,
        azimuth: 0.6,
        sweep: 0.3,
        duration: 10,
        priority: 1,
      },
    ];
  shots.push({
    id: 'hub',
    label: 'Own hub',
    target: [0, 3, 6],
    distance: 75,
    height: 38,
    azimuth: 0.8,
    sweep: 0.45,
    duration: 9,
    priority: 1,
  });
  for (const x of own)
    shots.push({
      id: `truck:${x.id}`,
      label: `${x.id} ${TRUCK_LABEL[x.state]}`,
      target: [x.position.x, 2, x.position.z],
      distance: 34,
      height: 15,
      azimuth: x.yaw + 2.2,
      sweep: 0.3,
      duration: 7,
      priority: x.state === 'EN_PUERTA' ? 4 : 3,
    });
  const profile = cityProfile(hubId);
  for (const site of profile.sites)
    for (let d = 0; d < site.docks; d++) {
      const a = dockAgent(site, d, t);
      if (a.phase === 'loading' || a.phase === 'docking')
        shots.push({
          id: `site:${site.id}:${d}`,
          label: `${site.company.name} · dock ${d + 1} ${a.phase}`,
          target: [a.dock.x, 2, a.dock.z],
          distance: 30,
          height: 14,
          azimuth: site.facing === 'S' ? 0.6 : 3.6,
          sweep: 0.3,
          duration: 7,
          priority: 2,
        });
    }
  const plane = planeAt(t);
  if (profile.theme === 'airport' && plane.visible && plane.y < 40)
    shots.push({
      id: 'plane',
      label: 'Cargo flight on the runway',
      target: [plane.x, plane.y + 6, plane.z],
      distance: 90,
      height: 26,
      azimuth: 0.5,
      sweep: 0.25,
      duration: 8,
      priority: 5,
    });
  const head = trainCars(t)[0];
  if (head > -150 && head < 480)
    shots.push({
      id: 'train',
      label: 'Freight train',
      target: [head, 3, RAIL_Z],
      distance: 60,
      height: 20,
      azimuth: 0.4,
      sweep: 0.3,
      duration: 8,
      priority: 2,
    });
  if (profile.theme === 'port' || profile.theme === 'tower-port')
    shots.push({
      id: 'quay',
      label: 'Quay cranes & vessel',
      target: [268, 14, -64],
      distance: 110,
      height: 42,
      azimuth: 2.2,
      sweep: 0.3,
      duration: 9,
      priority: 2,
    });
  for (const al of sim.alerts.filter(
    (a) => !a.read && a.severity !== 'info' && a.entity?.kind === 'truck',
  )) {
    const x = sim.trucks.find((x) => x.id === (al.entity as { id: string }).id);
    if (x && x.warehouseId === hubId)
      shots.push({
        id: `alert:${al.id}`,
        label: `Alert · ${al.title}`,
        target: [x.position.x, 2, x.position.z],
        distance: 30,
        height: 12,
        azimuth: 1,
        sweep: 0.3,
        duration: 7,
        priority: 5,
      });
  }
  return shots;
}
/** Elige el siguiente plano: ponderado por prioridad, sin repetir el anterior. */
export function nextShot(candidates: Shot[], lastId: string | null, seed: number): Shot {
  const pool = candidates.filter((c) => c.id !== lastId);
  const list = pool.length ? pool : candidates;
  const total = list.reduce((n, c) => n + c.priority ** 2, 0);
  let r = mulberry32(Math.floor(seed * 1000) + 7)() * total;
  for (const c of list) {
    r -= c.priority ** 2;
    if (r <= 0) return c;
  }
  return list[list.length - 1];
}
/** Pose de cámara para un plano tras `elapsed` segundos (órbita suave + empuje lento). */
export function shotPose(
  shot: Shot,
  elapsed: number,
): { position: [number, number, number]; target: [number, number, number] } {
  const k = Math.min(1, elapsed / shot.duration);
  const az = shot.azimuth + shot.sweep * k;
  const dist = shot.distance * (1.08 - 0.16 * k);
  return {
    target: shot.target,
    position: [
      shot.target[0] + Math.sin(az) * dist,
      shot.target[1] + shot.height,
      shot.target[2] + Math.cos(az) * dist,
    ],
  };
}
