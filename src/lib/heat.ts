import { Color } from 'three';

const GOOD = new Color('#10B981'),
  MID = new Color('#F5A524'),
  BAD = new Color('#EF4444');
/** Escala continua verde → ámbar → rojo (0..1). */
export function heat(v: number, out: Color): Color {
  const k = Math.max(0, Math.min(1, v));
  return k < 0.5 ? out.copy(GOOD).lerp(MID, k * 2) : out.copy(MID).lerp(BAD, (k - 0.5) * 2);
}
/** Mapa de calor de congestión viaria: carga por tramo = vehículos parados + densidad. */
export function edgeCongestion(
  agents: readonly { nodes: string[]; index: number; speed: number }[],
  from: string,
  to: string,
): number {
  let n = 0,
    stopped = 0;
  for (const a of agents)
    if (a.nodes[a.index] === from && a.nodes[a.index + 1] === to) {
      n++;
      if (a.speed < 2) stopped++;
    }
  return Math.min(1, (stopped * 1 + n * 0.25) / 4);
}
