import { COMPANIES, type Company } from './companies';
import { hashString, mulberry32 } from './rng';
import { resolvePhases } from './schedule';

export type Theme = 'port' | 'industrial' | 'airport' | 'tower-port' | 'highway-hills';
export type SiteKind = 'shed' | 'cold' | 'office' | 'robotic' | 'sorting' | 'terminal';
export interface Slot {
  /** Centro y tamaño de la nave. */
  x: number;
  z: number;
  sx: number;
  sz: number;
  /** 'S': muelles hacia +z. 'N': muelles hacia -z. */
  facing: 'S' | 'N';
  /** Eje z de la carretera a la que da el patio. */
  roadZ: number;
}
/** Parcelas disponibles alrededor de la malla viaria. */
export const SLOTS: readonly Slot[] = [
  { x: 112, z: -65, sx: 24, sz: 30, facing: 'S', roadZ: -30 },
  { x: 192, z: -65, sx: 30, sz: 27, facing: 'S', roadZ: -30 },
  { x: 112, z: 5, sx: 24, sz: 28, facing: 'S', roadZ: 40 },
  { x: 194, z: 5, sx: 33, sz: 28, facing: 'S', roadZ: 40 },
  { x: 112, z: 72, sx: 30, sz: 23, facing: 'S', roadZ: 110 },
  { x: 193, z: 72, sx: 25, sz: 29, facing: 'S', roadZ: 110 },
  { x: -54, z: -71, sx: 28, sz: 24, facing: 'S', roadZ: -30 },
  { x: -60, z: 8, sx: 30, sz: 28, facing: 'N', roadZ: -30 },
];
export interface SiteSpec extends Slot {
  id: string;
  company: Company;
  kind: SiteKind;
  height: number;
  docks: number;
  /** Desfase temporal del ciclo, en segundos. */
  phase: number;
}
export interface CityProfile {
  hubId: string;
  theme: Theme;
  /** Nombre de la zona urbana. */
  district: string;
  sites: SiteSpec[];
}
const THEME_BY_HUB: Record<
  string,
  { theme: Theme; district: string; sites: number; kinds: SiteKind[] }
> = {
  riverside: {
    theme: 'port',
    district: 'Port of Rotterdam · Maasvlakte',
    sites: 7,
    kinds: ['terminal', 'shed', 'cold', 'shed'],
  },
  southfield: {
    theme: 'industrial',
    district: 'Polígono Industrial · Madrid Sur',
    sites: 8,
    kinds: ['shed', 'office', 'sorting', 'shed'],
  },
  eastport: {
    theme: 'tower-port',
    district: 'Tuas Cold Chain · Singapore',
    sites: 7,
    kinds: ['cold', 'terminal', 'cold', 'shed'],
  },
  northgate: {
    theme: 'port',
    district: 'Hafen Hamburg · Waltershof',
    sites: 6,
    kinds: ['terminal', 'shed', 'sorting', 'shed'],
  },
  jade: {
    theme: 'tower-port',
    district: 'Yangshan River Terminal · Shanghai',
    sites: 7,
    kinds: ['terminal', 'sorting', 'shed', 'cold'],
  },
  dune: {
    theme: 'airport',
    district: 'Dubai Cargo Village · DWC',
    sites: 6,
    kinds: ['sorting', 'cold', 'shed', 'terminal'],
  },
  pacific: {
    theme: 'highway-hills',
    district: 'South Bay Logistics · Los Angeles',
    sites: 8,
    kinds: ['robotic', 'robotic', 'shed', 'sorting'],
  },
  verde: {
    theme: 'industrial',
    district: 'Parque Logístico · Guarulhos',
    sites: 6,
    kinds: ['shed', 'sorting', 'cold', 'shed'],
  },
};
const DEFAULT = {
  theme: 'industrial' as Theme,
  district: 'Industrial district',
  sites: 6,
  kinds: ['shed' as SiteKind],
};
const cache = new Map<string, CityProfile>();
/** Perfil urbano determinista de un hub: tema, polígono y naves de terceros (5-8). */
export function cityProfile(hubId: string): CityProfile {
  const hit = cache.get(hubId);
  if (hit) return hit;
  const def = THEME_BY_HUB[hubId] ?? DEFAULT;
  const rand = mulberry32(hashString(`city:${hubId}`));
  const order = [...COMPANIES].sort(() => rand() - 0.5);
  const slots = [...SLOTS.keys()]
    .sort(() => rand() - 0.5)
    .slice(0, def.sites)
    .sort((a, b) => a - b);
  const sites: SiteSpec[] = slots.map((slot, i) => {
    const kind = def.kinds[i % def.kinds.length];
    return {
      ...SLOTS[slot],
      id: `${hubId}:site:${slot}`,
      company: order[i % order.length],
      kind,
      height: kind === 'office' ? 16 + Math.floor(rand() * 8) : 8 + Math.floor(rand() * 4),
      docks: 3 + Math.floor(rand() * 2),
      phase: rand() * 150,
    };
  });
  const profile = { hubId, theme: def.theme, district: def.district, sites: resolvePhases(sites) };
  cache.set(hubId, profile);
  return profile;
}
