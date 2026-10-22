/** 0 = noche, 1 = golden hour. El ciclo día/noche es opcional (dayCycle). */
export function sunFactor(night: boolean, dayCycle: boolean, time: number): number {
  if (night) return 0.08;
  if (dayCycle) return 0.5 + 0.5 * Math.cos((time * Math.PI) / 120);
  return 1;
}
