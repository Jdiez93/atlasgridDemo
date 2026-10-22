import type { Vector3 } from 'three';
import { CONFIG } from './config';
export const FOV = 42;
const HOME = {
  warehouse: { center: [0, 0, 6], radius: 33, dir: [51, 48, 54] },
  region: { center: [6, 0, 12], radius: 72, dir: [1, 0.8, 1.05] },
};
/** Fit-to-bounds: encuadra la nave y su patio según el aspecto real del viewport. */
export function home(
  out: { position: Vector3; target: Vector3 },
  view: string,
  aspect: number,
): void {
  if (view === 'world') {
    out.position.fromArray(CONFIG.camera.world);
    out.target.set(0, 0, 5);
    return;
  }
  const h = view === 'region' ? HOME.region : HOME.warehouse;
  const vfov = (FOV * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const dist = (h.radius / Math.sin(Math.min(vfov, hfov) / 2)) * 1.04;
  out.target.fromArray(h.center);
  out.position.fromArray(h.dir).normalize().multiplyScalar(dist).add(out.target);
}
