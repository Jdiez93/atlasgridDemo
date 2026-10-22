import { dockAgent, SITE_PERIOD } from './choreography';
import { boxesOverlap, truckCorners, type Corners } from './collision';
import type { SiteSpec } from './profiles';

function snapshot(site: SiteSpec, t: number): Corners[] {
  const out: Corners[] = [];
  for (let d = 0; d < site.docks; d++) {
    const a = dockAgent(site, d, t).truck;
    if (a) out.push(truckCorners(a.x, a.z, a.yaw));
  }
  return out;
}
function conflicts(a: SiteSpec, placed: SiteSpec[]): number {
  let n = 0;
  for (let t = 0; t < SITE_PERIOD; t += 1.5) {
    const mine = snapshot(a, t);
    if (!mine.length) continue;
    for (const other of placed)
      for (const o of snapshot(other, t)) for (const m of mine) if (boxesOverlap(m, o)) n++;
  }
  return n;
}
/** Reparte las fases de las naves para que sus camiones nunca coincidan en carriles compartidos. */
export function resolvePhases(sites: SiteSpec[]): SiteSpec[] {
  const placed: SiteSpec[] = [];
  for (const site of sites) {
    let best = site.phase,
      bestScore = Infinity;
    for (let k = 0; k < 24 && bestScore > 0; k++) {
      const phase = (site.phase + k * 10.5) % SITE_PERIOD;
      const score = conflicts({ ...site, phase }, placed);
      if (score < bestScore) {
        bestScore = score;
        best = phase;
      }
    }
    site.phase = best;
    placed.push(site);
  }
  return sites;
}
