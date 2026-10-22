import { hashString, mulberry32 } from './rng';

/** Entidades ambientales como funciones puras del tiempo: sin estado, deterministas y testeables. */
export const RAIL_Z = 138;
export const RAIL_X0 = -210;
export const RAIL_X1 = 560;
export const TRAIN_CARS = 9;
const CAR_PITCH = 13.5;
const smooth = (x: number) => x * x * (3 - 2 * x);

/** Tren de mercancías: la locomotora recorre la vía en bucle; devuelve la x de cada vagón. */
export function trainCars(t: number, offset = 0): number[] {
  const span = RAIL_X1 - RAIL_X0 + TRAIN_CARS * CAR_PITCH;
  const head = RAIL_X0 + ((t * 11 + offset) % span);
  return Array.from({ length: TRAIN_CARS }, (_, i) => head - i * CAR_PITCH);
}
export interface PlaneState {
  visible: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  /** Tren de aterrizaje y luces: true sobre la pista o con y<12. */
  gear: boolean;
}
export const RUNWAY = { z: -158, x0: -120, x1: 430, width: 22 };
const PLANE_PERIOD = 210;
/** Avión de carga: despega hacia +x y aterriza desde +x en bucle. */
export function planeAt(t: number): PlaneState {
  const u = ((t % PLANE_PERIOD) + PLANE_PERIOD) % PLANE_PERIOD;
  const z = RUNWAY.z;
  const hidden: PlaneState = { visible: false, x: 0, y: 0, z, yaw: 0, pitch: 0, gear: false };
  if (u < 22) {
    const x = RUNWAY.x0 + 0.5 * 2.5 * u * u;
    return {
      visible: true,
      x,
      y: 0,
      z,
      yaw: Math.PI / 2,
      pitch: u > 19 ? (u - 19) * 0.08 : 0,
      gear: true,
    };
  }
  if (u < 46) {
    const k = (u - 22) / 24;
    return {
      visible: true,
      x: RUNWAY.x0 + 0.5 * 2.5 * 22 * 22 + k * 640,
      y: 4 + smooth(k) * 130,
      z,
      yaw: Math.PI / 2,
      pitch: 0.2,
      gear: k < 0.25,
    };
  }
  if (u < 112) return hidden;
  if (u < 134) {
    const k = (u - 112) / 22;
    return {
      visible: true,
      x: RUNWAY.x1 + 650 * (1 - k),
      y: 4 + 118 * (1 - k) * (1 - k),
      z,
      yaw: -Math.PI / 2,
      pitch: -0.1 * (1 - k),
      gear: true,
    };
  }
  if (u < 168) {
    const k = (u - 134) / 34;
    const v = 1 - smooth(k);
    return {
      visible: true,
      x: RUNWAY.x1 - (RUNWAY.x1 - 110) * (1 - v * v),
      y: 0,
      z,
      yaw: -Math.PI / 2,
      pitch: 0,
      gear: true,
    };
  }
  return hidden;
}
/** Ida y vuelta entre a y b con pausas: operarios con chaleco, peatones. */
export function walker(
  seed: string,
  t: number,
  a: [number, number],
  b: [number, number],
  speed = 1.2,
) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const rand = mulberry32(hashString(seed));
  const phase = rand() * 100;
  const period = (len / speed + 3) * 2;
  const u = (((t + phase) % period) + period) % period;
  const half = period / 2;
  const leg = u < half ? u : u - half;
  const walking = leg < len / speed;
  const k = walking ? leg / (len / speed) : 1;
  const f = u < half ? k : 1 - k;
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  return {
    x: a[0] + dx * f,
    z: a[1] + dz * f,
    yaw: Math.atan2(u < half ? dx : -dx, u < half ? dz : -dz),
    moving: walking,
    bob: walking ? Math.abs(Math.sin(t * 9 + phase)) * 0.12 : 0,
  };
}
/** Grúa pórtico: posición del carro (0..1) y altura de izado (0..1). */
export function craneCycle(t: number, index: number) {
  const p = t * 0.07 + index * 1.7;
  return { trolley: 0.5 + 0.5 * Math.sin(p), hoist: 0.5 + 0.5 * Math.sin(p * 2.3 + 1) };
}
/** Cajas sobre una cinta transportadora: fracción 0..1 a lo largo de la cinta. */
export function conveyorBoxes(t: number, count: number, speed = 0.05): number[] {
  return Array.from({ length: count }, (_, i) => (((t * speed + i / count) % 1) + 1) % 1);
}
/** Semáforo peatonal / de coches: true si el eje está en verde (ciclo fijo). */
export function crossingGreen(t: number, offset: number): boolean {
  return (t + offset) % 24 < 14;
}
export function bob(t: number, seed: number, amp = 0.25): number {
  return Math.sin(t * 0.6 + seed) * amp;
}
