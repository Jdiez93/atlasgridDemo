import type { SiteSpec } from './profiles';
import { hashString, mulberry32 } from './rng';

/** Simulación ligera de naves de terceros: función pura del tiempo (determinista, sin estado ni fugas). */
export type DockPhase =
  | 'idle'
  | 'arriving'
  | 'maneuvering'
  | 'docking'
  | 'loading'
  | 'undocking'
  | 'departing';
export interface Pose {
  x: number;
  z: number;
  yaw: number;
}
export interface DockAgent {
  phase: DockPhase;
  /** 0 cerrado · 1 abierto. */
  door: number;
  truck: (Pose & { reverse: boolean; distance: number; box: boolean; fade: number }) | null;
  forklift: (Pose & { carrying: boolean }) | null;
  /** Palés apilados junto al muelle (0-5). */
  stack: number;
  unloading: boolean;
  /** Posición del muelle (puerta). */
  dock: { x: number; z: number };
  stackAt: { x: number; z: number };
}
interface Pt {
  x: number;
  z: number;
  reverse: boolean;
  s: number;
}
export interface DockRoute {
  points: Pt[];
  length: number;
  /** Distancia a la que acaba la aproximación (inicia la marcha atrás). */
  reverseStart: number;
  /** Distancia a la que el camión toca el muelle. */
  dockS: number;
}
const STAGE = 9.2;
const REAR = 6.4;
const SPEED = { approach: 8.5, reverse: 2.8, depart: 6.2 };
type V = [number, number];
const lerp = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const quad = (p0: V, c: V, p1: V, t: number): V => lerp(lerp(p0, c, t), lerp(c, p1, t), t);
const cubic = (p0: V, c1: V, c2: V, p1: V, t: number): V =>
  lerp(quad(p0, c1, c2, t), quad(c1, c2, p1, t), t);

/** Ruta de un muelle en coordenadas locales (u a lo largo de la fachada, d profundidad hacia la carretera). */
export function buildRoute(site: SiteSpec, dockIndex: number): DockRoute {
  const dir = site.facing === 'S' ? 1 : -1;
  const faceZ = site.z + dir * (site.sz / 2);
  const spread = (site.docks - 1) / 2;
  const u = site.x + (dockIndex - spread) * (site.sx * 0.32);
  const gap = Math.abs(site.roadZ - faceZ);
  const laneD = gap - 2.2; // carril de entrada, junto al eje
  const exitD = gap - 5.6; // carril de salida, junto al patio
  // sentido de circulación por carril: fachadas S llegan desde el este, fachadas N desde el oeste
  const s = site.facing === 'S' ? 1 : -1;
  const world = ([lu, ld]: V): V => [lu, faceZ + dir * ld];
  const raw: { p: V; reverse: boolean }[] = [];
  const push = (p: V, reverse: boolean) => raw.push({ p: world(p), reverse });
  const line = (a: V, b: V, steps: number, reverse = false) => {
    for (let i = 0; i < steps; i++) push(lerp(a, b, i / steps), reverse);
  };
  line([u + s * 55, laneD], [u + s * 24, laneD], 4);
  for (let i = 0; i < 10; i++)
    push(
      cubic(
        [u + s * 24, laneD],
        [u + s * 14, laneD],
        [u + s * 14, STAGE],
        [u + s * 6, STAGE],
        i / 10,
      ),
      false,
    );
  line([u + s * 6, STAGE], [u - s * 6.5, STAGE], 3);
  for (let i = 0; i < 12; i++)
    push(quad([u - s * 6.5, STAGE], [u, STAGE], [u, REAR], i / 11), true);
  for (let i = 0; i < 12; i++)
    push(cubic([u, REAR], [u, REAR + 7], [u - s * 3, exitD], [u - s * 13, exitD], i / 11), false);
  line([u - s * 13, exitD], [u - s * 50, exitD], 5);
  let acc = 0;
  const points: Pt[] = raw.map((r, i) => {
    if (i > 0) acc += Math.hypot(r.p[0] - raw[i - 1].p[0], r.p[1] - raw[i - 1].p[1]);
    return { x: r.p[0], z: r.p[1], reverse: r.reverse, s: acc };
  });
  const firstRev = points.findIndex((p) => p.reverse);
  const lastRev = points.length - 1 - [...points].reverse().findIndex((p) => p.reverse);
  return { points, length: acc, reverseStart: points[firstRev].s, dockS: points[lastRev].s };
}
const routeCache = new Map<string, DockRoute>();
export function dockRoute(site: SiteSpec, dockIndex: number): DockRoute {
  const key = `${site.id}:${dockIndex}`;
  let r = routeCache.get(key);
  if (!r) routeCache.set(key, (r = buildRoute(site, dockIndex)));
  return r;
}
/** Posición/orientación sobre la ruta a distancia s. */
export function poseAt(route: DockRoute, s: number): Pose & { reverse: boolean } {
  const pts = route.points;
  const t = Math.max(0, Math.min(route.length, s));
  let i = 0;
  while (i < pts.length - 2 && pts[i + 1].s < t) i++;
  const a = pts[i],
    b = pts[i + 1];
  const k = b.s - a.s > 1e-6 ? (t - a.s) / (b.s - a.s) : 0;
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const reverse = a.reverse && b.reverse;
  return {
    x: a.x + dx * k,
    z: a.z + dz * k,
    yaw: reverse ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz),
    reverse,
  };
}
export interface Timeline {
  arrive: number;
  reverse: number;
  door: number;
  dwell: number;
  depart: number;
  active: number;
  period: number;
}
/** Ventana máxima de actividad de un muelle y periodo común de la nave (alternan muelles pares/impares). */
export const WINDOW = 92;
export const STAGGER = 34;
export const SITE_PERIOD = 2 * (WINDOW + STAGGER);
export function timelineFor(site: SiteSpec, dockIndex: number): Timeline {
  const r = dockRoute(site, dockIndex);
  const rand = mulberry32(hashString(`${site.id}:${dockIndex}`));
  const arrive = r.reverseStart / SPEED.approach;
  const reverse = (r.dockS - r.reverseStart) / SPEED.reverse;
  const depart = (r.length - r.dockS) / SPEED.depart;
  const door = 2.5;
  const room = WINDOW - arrive - reverse - depart - door * 2;
  const dwell = Math.max(14, Math.min(30 + rand() * 24, room));
  const active = arrive + reverse + door * 2 + dwell + depart;
  return { arrive, reverse, door, dwell, depart, active, period: SITE_PERIOD };
}
/** Aparición/desaparición suave en los extremos de la ruta (evita pops). */
const fadeAt = (r: DockRoute, s: number) => Math.max(0, Math.min(1, s / 8, (r.length - s) / 12));
const ease = (x: number) => x * x * (3 - 2 * x);
/** Estado completo de un muelle en el instante t (segundos de simulación). */
export function dockAgent(site: SiteSpec, dockIndex: number, t: number): DockAgent {
  const r = dockRoute(site, dockIndex);
  const tl = timelineFor(site, dockIndex);
  const group = dockIndex % 2,
    start = group * (SITE_PERIOD / 2) + Math.floor(dockIndex / 2) * STAGGER;
  const shifted = t + site.phase - start;
  const cycle = Math.floor(shifted / tl.period);
  const u = shifted - cycle * tl.period;
  const last = r.points[r.points.length - 1];
  const dock = poseAt(r, r.dockS);
  const unloading = (cycle + dockIndex) % 2 === 0;
  const dir = site.facing === 'S' ? 1 : -1;
  const side = r.points[0].x > dock.x ? -1 : 1;
  const stackAt = { x: dock.x + side * 5.8, z: dock.z - dir * 4.2 };
  const base: DockAgent = {
    phase: 'idle',
    door: 0,
    truck: null,
    forklift: null,
    stack: unloading ? 0 : 5,
    unloading,
    dock: { x: dock.x, z: dock.z - dir * REAR },
    stackAt,
  };
  if (u >= tl.active) return { ...base, stack: unloading ? 5 : 0 };
  const box = (hashString(`${site.id}:${dockIndex}:${cycle}`) & 3) === 0;
  const truckAt = (s: number, phase: DockPhase): DockAgent => {
    const p = poseAt(r, s);
    return {
      ...base,
      phase,
      truck: {
        x: p.x,
        z: p.z,
        yaw: p.yaw,
        reverse: p.reverse,
        distance: s,
        box,
        fade: fadeAt(r, s),
      },
    };
  };
  let c = tl.arrive;
  if (u < c) return truckAt((u / tl.arrive) * r.reverseStart, 'arriving');
  const revT = u - c;
  c += tl.reverse;
  if (u < c) {
    const k = ease(Math.min(1, revT / tl.reverse));
    return truckAt(
      r.reverseStart + (r.dockS - r.reverseStart) * k,
      revT < tl.reverse * 0.35 ? 'maneuvering' : 'docking',
    );
  }
  const atDock = dock;
  const open = tl.door,
    dw = tl.dwell;
  const inDock = u - c;
  if (inDock < open + dw + open) {
    const door =
      inDock < open
        ? ease(inDock / open)
        : inDock > open + dw
          ? 1 - ease((inDock - open - dw) / open)
          : 1;
    const work = Math.max(0, Math.min(1, (inDock - open) / dw));
    const trips = 5;
    const phaseTrip = work * trips;
    const trip = Math.min(trips - 1, Math.floor(phaseTrip));
    const f = phaseTrip - trip;
    const out = f < 0.5; // 0-0.5: camión → pila; 0.5-1: vuelve vacío
    const k = out ? ease(f * 2) : 1 - ease((f - 0.5) * 2);
    const from = { x: atDock.x, z: atDock.z - dir * (REAR - 1.2) };
    const fx = from.x + (stackAt.x - from.x) * k,
      fz = from.z + (stackAt.z - from.z) * k;
    const yaw = Math.atan2(stackAt.x - from.x, stackAt.z - from.z) + (out ? 0 : Math.PI);
    const done = trip + (out ? 0 : 1);
    const stack = unloading ? done : trips - done;
    const working = inDock >= open && inDock <= open + dw;
    return {
      ...base,
      phase: 'loading',
      door,
      truck: {
        x: atDock.x,
        z: atDock.z,
        yaw: atDock.yaw,
        reverse: false,
        distance: r.dockS,
        box,
        fade: 1,
      },
      forklift: working ? { x: fx, z: fz, yaw, carrying: out } : null,
      stack: Math.max(0, Math.min(5, stack)),
    };
  }
  c += open * 2 + dw;
  const dep = Math.min(1, (u - c) / tl.depart);
  const s = r.dockS + (r.length - r.dockS) * dep;
  const p = poseAt(r, s);
  void last;
  return {
    ...base,
    phase: dep < 0.25 ? 'undocking' : 'departing',
    stack: unloading ? 5 : 0,
    truck: { x: p.x, z: p.z, yaw: p.yaw, reverse: false, distance: s, box, fade: fadeAt(r, s) },
  };
}
export const TRUCK_HALF_LENGTH = 6;
