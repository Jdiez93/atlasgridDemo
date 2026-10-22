import { describe, expect, it } from 'vitest';
import { cityProfile, SLOTS } from '../src/city/profiles';
import { dockAgent, dockRoute, timelineFor, type DockPhase } from '../src/city/choreography';
import { planeAt, RUNWAY, trainCars, walker, crossingGreen } from '../src/city/population';
import { boxesOverlap, truckCorners } from '../src/city/collision';
import { containerStacks, farField, terrainMounds, ZONES } from '../src/city/scenery';

const HUBS = [
  'riverside',
  'southfield',
  'eastport',
  'northgate',
  'jade',
  'dune',
  'pacific',
  'verde',
];

describe('ciudad viva: perfiles', () => {
  it('cada hub tiene 5-8 naves de terceros con empresa propia y parcelas válidas', () => {
    for (const id of HUBS) {
      const p = cityProfile(id);
      expect(p.sites.length).toBeGreaterThanOrEqual(5);
      expect(p.sites.length).toBeLessThanOrEqual(8);
      expect(new Set(p.sites.map((s) => s.company.id)).size).toBe(p.sites.length);
      expect(new Set(p.sites.map((s) => s.id)).size).toBe(p.sites.length);
      for (const s of p.sites) {
        expect(SLOTS).toContainEqual(expect.objectContaining({ x: s.x, z: s.z }));
        expect(s.docks).toBeGreaterThanOrEqual(3);
      }
    }
  });
  it('es determinista y distintos hubs tienen temas reconocibles', () => {
    expect(cityProfile('riverside')).toBe(cityProfile('riverside'));
    expect(cityProfile('riverside').theme).toBe('port');
    expect(cityProfile('southfield').theme).toBe('industrial');
    expect(cityProfile('dune').theme).toBe('airport');
    expect(cityProfile('eastport').theme).toBe('tower-port');
    expect(cityProfile('pacific').theme).toBe('highway-hills');
  });
});

describe('ciudad viva: coreografía de muelles', () => {
  it('ninguna nave está muerta: en un día simulado todos los muelles ven camiones, puertas y carretillas', () => {
    for (const id of HUBS) {
      for (const site of cityProfile(id).sites) {
        for (let d = 0; d < site.docks; d++) {
          const phases = new Set<DockPhase>();
          let door = 0,
            fork = 0;
          for (let t = 0; t < 86400 / 8; t += 2) {
            const a = dockAgent(site, d, t);
            phases.add(a.phase);
            door = Math.max(door, a.door);
            if (a.forklift) fork++;
          }
          expect(phases).toContain('arriving');
          expect(phases).toContain('loading');
          expect(phases).toContain('departing');
          expect(phases).toContain('idle');
          expect(door).toBe(1);
          expect(fork).toBeGreaterThan(0);
        }
      }
    }
  });
  it('los camiones nunca atraviesan la nave y la puerta solo está abierta con el camión en el muelle', () => {
    const site = cityProfile('southfield').sites[0];
    const dir = site.facing === 'S' ? 1 : -1;
    const face = site.z + dir * (site.sz / 2);
    for (let d = 0; d < site.docks; d++)
      for (let t = 0; t < 600; t += 0.5) {
        const a = dockAgent(site, d, t);
        if (a.truck) {
          expect(Number.isFinite(a.truck.x + a.truck.z + a.truck.yaw)).toBe(true);
          // el eje del camión no cruza la fachada (6 m de semilargo del remolque en reversa incluidos)
          expect((a.truck.z - face) * dir).toBeGreaterThan(5.5);
        }
        if (a.door > 0) expect(a.phase).toBe('loading');
        expect(a.stack).toBeGreaterThanOrEqual(0);
        expect(a.stack).toBeLessThanOrEqual(5);
      }
  });
  it('rutas y tiempos: ciclo coherente y movimiento continuo', () => {
    const site = cityProfile('pacific').sites[1];
    const route = dockRoute(site, 0);
    const tl = timelineFor(site, 0);
    expect(route.dockS).toBeGreaterThan(route.reverseStart);
    expect(tl.period).toBeGreaterThan(tl.active);
    let prev = dockAgent(site, 0, 0).truck;
    for (let t = 0.2; t < tl.period * 2; t += 0.2) {
      const cur = dockAgent(site, 0, t).truck;
      if (cur && prev) expect(Math.hypot(cur.x - prev.x, cur.z - prev.z)).toBeLessThan(2.4); // < 12 u/s
      prev = cur;
    }
  });
  it('ningún par de camiones de una misma nave se solapa (cajas orientadas) ni entra en el edificio', () => {
    const corners = truckCorners;
    const overlap = boxesOverlap;
    for (const id of HUBS) {
      const sites = cityProfile(id).sites;
      for (let t = 0; t < 560; t += 1) {
        const all = sites.flatMap((site) =>
          Array.from({ length: site.docks }, (_, d) => ({
            site,
            a: dockAgent(site, d, t).truck,
          })).filter((e) => e.a),
        );
        for (let i = 0; i < all.length; i++) {
          const a = all[i].a!;
          const ca = corners(a.x, a.z, a.yaw);
          for (const st of sites) {
            const inside = ca.some(
              ([x, z]) =>
                Math.abs(x - st.x) < st.sx / 2 - 0.01 && Math.abs(z - st.z) < st.sz / 2 - 0.01,
            );
            expect(inside, `${st.id} t=${t}`).toBe(false);
          }
          for (let j = i + 1; j < all.length; j++) {
            const b = all[j].a!;
            expect(
              overlap(ca, corners(b.x, b.z, b.yaw)),
              `${id} t=${t} ${all[i].site.id} vs ${all[j].site.id}`,
            ).toBe(false);
          }
        }
      }
    }
  });
});

describe('ciudad viva: población ambiental', () => {
  it('tren, avión, operarios y semáforos son funciones puras y acotadas', () => {
    const cars = trainCars(100);
    expect(cars).toHaveLength(9);
    expect(trainCars(100)).toEqual(cars);
    let visible = 0;
    for (let t = 0; t < 420; t += 1) {
      const p = planeAt(t);
      if (p.visible) {
        visible++;
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(Math.abs(p.z - RUNWAY.z)).toBeLessThan(1);
      }
    }
    expect(visible).toBeGreaterThan(60);
    const w = walker('x', 33, [0, 0], [10, 0]);
    expect(w.x).toBeGreaterThanOrEqual(0);
    expect(w.x).toBeLessThanOrEqual(10);
    const greens = Array.from({ length: 48 }, (_, t) => crossingGreen(t, 0)).filter(Boolean).length;
    expect(greens).toBeGreaterThan(0);
    expect(greens).toBeLessThan(48);
  });
  it('escenografía: contenedores, skyline y relieve generados de forma determinista', () => {
    expect(containerStacks(ZONES.northWest, 's').length).toBeGreaterThan(40);
    expect(containerStacks(ZONES.northWest, 's')).toEqual(containerStacks(ZONES.northWest, 's'));
    expect(farField('tower-port', 'eastport').some((b) => b.scale[1] > 100)).toBe(true);
    expect(terrainMounds('airport', 'dune').length).toBeGreaterThan(10);
    expect(terrainMounds('port', 'riverside')).toHaveLength(0);
  });
});
