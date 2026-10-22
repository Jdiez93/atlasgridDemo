import { describe, expect, it } from 'vitest';
import { createInitialSimulation } from '../src/data/seeds';
import { tickSimulation } from '../src/sim/engine';
import { candidateShots, nextShot, shotPose } from '../src/director/shots';
import { edgeCongestion, heat } from '../src/lib/heat';
import { recommend } from '../src/lib/recommend';
import { Color } from 'three';

describe('modo director', () => {
  it('siempre hay planos válidos en cada vista y hub', () => {
    const sim = createInitialSimulation();
    for (let i = 0; i < 600; i++) tickSimulation(sim);
    for (const w of sim.warehouses)
      for (const view of ['region', 'warehouse', 'world'] as const) {
        const shots = candidateShots(sim, view, w.id, sim.time);
        expect(shots.length).toBeGreaterThan(0);
        for (const s of shots) expect(s.target.every(Number.isFinite)).toBe(true);
      }
  });
  it('el aeropuerto ofrece el plano del avión cuando está en pista y el puerto el de grúas', () => {
    const sim = createInitialSimulation();
    const ids = (hub: string, t: number) => candidateShots(sim, 'region', hub, t).map((s) => s.id);
    expect(ids('dune', 5)).toContain('plane');
    expect(ids('riverside', 5)).toContain('quay');
  });
  it('nextShot no repite el plano anterior y shotPose orbita sin saltos', () => {
    const sim = createInitialSimulation();
    const shots = candidateShots(sim, 'region', 'riverside', 10);
    for (let i = 0; i < 30; i++) expect(nextShot(shots, shots[0].id, i).id).not.toBe(shots[0].id);
    const p0 = shotPose(shots[0], 0).position,
      p1 = shotPose(shots[0], 0.5).position;
    expect(Math.hypot(p1[0] - p0[0], p1[2] - p0[2])).toBeLessThan(shots[0].distance * 0.2);
  });
});
describe('capas de datos y torre de control', () => {
  it('heat va de verde a rojo y la congestión cuenta vehículos parados', () => {
    const lo = heat(0, new Color()),
      hi = heat(1, new Color());
    expect(lo.g).toBeGreaterThan(lo.r);
    expect(hi.r).toBeGreaterThan(hi.g);
    const queue = Array.from({ length: 4 }, () => ({ nodes: ['a', 'b'], index: 0, speed: 0 }));
    expect(edgeCongestion(queue, 'a', 'b')).toBe(1);
    expect(edgeCongestion([{ nodes: ['a', 'b'], index: 0, speed: 12 }], 'a', 'b')).toBeLessThan(
      0.1,
    );
    expect(edgeCongestion(queue, 'b', 'a')).toBe(0);
  });
  it('recomienda una acción coherente con la alerta', () => {
    expect(recommend({ title: 'Corridor closed', message: '' })).toMatch(/Divert/);
    expect(recommend({ title: 'Delay', message: 'late arrival' })).toMatch(/dock/);
    expect(recommend({ title: 'Something', message: 'else' })).toMatch(/inspector/);
  });
});
