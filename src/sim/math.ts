import type { Point } from './types';
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export function advance(position: Point, target: Point, amount: number): boolean {
  const d = distance(position, target);
  if (d <= amount) {
    position.x = target.x;
    position.z = target.z;
    return true;
  }
  position.x += ((target.x - position.x) / d) * amount;
  position.z += ((target.z - position.z) / d) * amount;
  return false;
}
export const rackPosition = (index: number): Point => ({
  x: -13 + (index % 5) * 6,
  z: -13 - (Math.floor(index / 5) % 4) * -3.5,
});
export function random(state: { rng: number }): number {
  let x = state.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.rng = x >>> 0;
  return state.rng / 4294967296;
}
