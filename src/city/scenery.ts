import { hashString, mulberry32 } from './rng';
import type { Theme } from './profiles';

export interface Inst {
  position: [number, number, number];
  scale: [number, number, number];
  yaw?: number;
  color: string;
}
export interface Palette {
  ground: string;
  groundDark: string;
  water: string;
  treeColor: string;
  treeDensity: number;
}
export const PALETTES: Record<Theme, Palette> = {
  port: {
    ground: '#6A9A52',
    groundDark: '#4F7E3F',
    water: '#3F86A8',
    treeColor: '#3E8A4C',
    treeDensity: 0.7,
  },
  industrial: {
    ground: '#8E9B58',
    groundDark: '#74803F',
    water: '#4B8BA6',
    treeColor: '#5C8F43',
    treeDensity: 0.8,
  },
  airport: {
    ground: '#D6B97E',
    groundDark: '#B99A5E',
    water: '#3FA0B4',
    treeColor: '#7C8B4A',
    treeDensity: 0.15,
  },
  'tower-port': {
    ground: '#58A055',
    groundDark: '#3F8442',
    water: '#2F8FB0',
    treeColor: '#2E8F4F',
    treeDensity: 0.9,
  },
  'highway-hills': {
    ground: '#A3A762',
    groundDark: '#868A48',
    water: '#4B8BA6',
    treeColor: '#6B8E3F',
    treeDensity: 0.45,
  },
};
const CONTAINER = [
  '#B5472F',
  '#2D7F94',
  '#C8901C',
  '#3A7A3E',
  '#6C4A9E',
  '#A33450',
  '#E6E9EE',
  '#6B7587',
];
export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
export const inRect = (x: number, z: number, r: Rect, pad = 0) =>
  x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
/** Zonas libres alrededor de la malla viaria. */
export const ZONES = {
  northWest: { x0: -100, x1: 60, z0: -150, z1: -100 },
  southWest: { x0: -100, x1: 70, z0: 52, z1: 128 },
  northMid: { x0: 85, x1: 245, z0: -150, z1: -108 },
  quay: { x0: 242, x1: 266, z0: -140, z1: 135 },
} satisfies Record<string, Rect>;
export function containerStacks(rect: Rect, seed: string, maxTiers = 4, fill = 0.8): Inst[] {
  const rand = mulberry32(hashString(seed));
  const out: Inst[] = [];
  const cols = Math.floor((rect.x1 - rect.x0) / 13.5),
    rows = Math.floor((rect.z1 - rect.z0) / 3.4);
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      if (r % 4 === 3 || rand() > fill) continue;
      const tiers = 1 + Math.floor(rand() * maxTiers);
      const color = CONTAINER[Math.floor(rand() * CONTAINER.length)];
      for (let k = 0; k < tiers; k++)
        out.push({
          position: [rect.x0 + c * 13.5 + 6.5, 1.3 + k * 2.65, rect.z0 + r * 3.4 + 1.7],
          scale: [12, 2.6, 2.5],
          color: k % 2 && rand() > 0.5 ? CONTAINER[Math.floor(rand() * CONTAINER.length)] : color,
        });
    }
  return out;
}
/** Anillo lejano (1,5 × 1,5 km estilizados): rascacielos, naves bajas, colinas o dunas. */
export function farField(theme: Theme, hubId: string): Inst[] {
  const rand = mulberry32(hashString(`far:${hubId}`));
  const out: Inst[] = [];
  const inside = (x: number, z: number) => x > -150 && x < 370 && z > -200 && z < 200;
  const towerColors = ['#9FB3C8', '#C9D2DE', '#B7C4D1', '#D9CDB8', '#8FA3B8'];
  const lowColors = ['#C9D2DE', '#D8D0C4', '#B5C4D4', '#E0C9A6'];
  const count =
    theme === 'tower-port' ? 170 : theme === 'airport' ? 60 : theme === 'highway-hills' ? 70 : 130;
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = 330 + rand() * 520;
    const x = 110 + Math.cos(a) * r * 1.2,
      z = Math.sin(a) * r * 0.95;
    if (inside(x, z)) continue;
    const w = 10 + rand() * 18;
    if (theme === 'tower-port' || (theme === 'airport' && rand() > 0.6)) {
      const h = (theme === 'tower-port' ? 50 : 38) + rand() * (theme === 'tower-port' ? 190 : 120);
      out.push({
        position: [x, h / 2, z],
        scale: [w * 0.8, h, w * 0.8],
        color: towerColors[i % towerColors.length],
      });
    } else if (theme === 'airport') {
      out.push({
        position: [x, 5, z],
        scale: [w * 1.4, 10, w],
        color: lowColors[i % lowColors.length],
      });
    } else {
      const h = 8 + rand() * (theme === 'industrial' ? 34 : 16);
      out.push({
        position: [x, h / 2, z],
        scale: [w * 1.3, h, w],
        color: lowColors[i % lowColors.length],
      });
    }
  }
  return out;
}
export interface Mound {
  x: number;
  z: number;
  radius: number;
  height: number;
  color: string;
}
/** Dunas (aeropuerto) y colinas (autopista/industrial): semiesferas escaladas en el horizonte. */
export function terrainMounds(theme: Theme, hubId: string): Mound[] {
  if (
    theme !== 'airport' &&
    theme !== 'highway-hills' &&
    hubId !== 'verde' &&
    hubId !== 'southfield'
  )
    return [];
  const rand = mulberry32(hashString(`mound:${hubId}`));
  const dune = theme === 'airport';
  const colors = dune
    ? ['#E3C58A', '#D9B777', '#EBD09A']
    : ['#8C9A4F', '#7A8A45', '#9AA55E', '#6E7F3F'];
  const out: Mound[] = [];
  for (let i = 0; i < (dune ? 36 : 26); i++) {
    const a = rand() * Math.PI * 2;
    const r = 420 + rand() * 480;
    const x = 110 + Math.cos(a) * r * 1.15,
      z = Math.sin(a) * r * 0.9;
    if (x > -170 && x < 390 && z > -220 && z < 220) continue;
    out.push({
      x,
      z,
      radius: 70 + rand() * 120,
      height: dune ? 14 + rand() * 26 : 30 + rand() * 70,
      color: colors[i % colors.length],
    });
  }
  return out;
}
export function railSleepers(): Inst[] {
  const out: Inst[] = [];
  for (let x = -210; x < 560; x += 2.2)
    out.push({ position: [x, 0.1, 138], scale: [0.6, 0.18, 4.2], color: '#6B5A46' });
  return out;
}
