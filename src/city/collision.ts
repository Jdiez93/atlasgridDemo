/** Cajas orientadas de camión (SAT): usadas por el planificador de fases y por los tests. */
export const TRUCK_BOX = { halfLength: 5.85, halfWidth: 1.6, centerShift: 0.35 };
export type Corners = number[][];
export function truckCorners(x: number, z: number, yaw: number): Corners {
  const fx = Math.sin(yaw),
    fz = Math.cos(yaw),
    rx = Math.cos(yaw),
    rz = -Math.sin(yaw);
  const cx = x - fx * TRUCK_BOX.centerShift,
    cz = z - fz * TRUCK_BOX.centerShift;
  const l = TRUCK_BOX.halfLength,
    w = TRUCK_BOX.halfWidth;
  return [
    [l, w],
    [l, -w],
    [-l, -w],
    [-l, w],
  ].map(([a, b]) => [cx + fx * a + rx * b, cz + fz * a + rz * b]);
}
export function boxesOverlap(a: Corners, b: Corners, margin = 0.05): boolean {
  for (const poly of [a, b])
    for (let i = 0; i < 4; i++) {
      const p = poly[i],
        q = poly[(i + 1) % 4];
      const nx = q[1] - p[1],
        nz = p[0] - q[0];
      const pa = a.map((v) => v[0] * nx + v[1] * nz),
        pb = b.map((v) => v[0] * nx + v[1] * nz);
      if (Math.max(...pa) < Math.min(...pb) - margin || Math.max(...pb) < Math.min(...pa) - margin)
        return false;
    }
  return true;
}
