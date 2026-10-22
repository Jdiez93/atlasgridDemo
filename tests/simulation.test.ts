import { describe, it, expect } from 'vitest';
import { createInitialSimulation } from '../src/data/seeds';
import {
  applyAction,
  tickSimulation,
  transitionTruck,
  validateInvariants,
} from '../src/sim/engine';
import { calculateKPIs } from '../src/sim/kpis';
import { CONFIG } from '../src/lib/config';
import { distance } from '../src/sim/math';

function run(seconds: number, seed?: number) {
  const sim = createInitialSimulation(seed);
  for (let i = 0; i < seconds / CONFIG.tickSeconds; i++) tickSimulation(sim);
  return sim;
}
describe('truck state machine', () => {
  it('starts with thirty fleet vehicles across eight hubs', () => {
    const sim = createInitialSimulation();
    expect(calculateKPIs(sim)).toMatchObject({
      parked: 5,
      atDock: 1,
      inRoute: 24,
      maintenance: 0,
      total: CONFIG.fleetSize,
    });
  });
  it('rejects a route-to-loading shortcut', () => {
    const truck = createInitialSimulation().trucks[2];
    expect(() => transitionTruck(truck, 'CARGANDO')).toThrow('Illegal truck transition');
  });
  it('follows the complete loading and delivery lifecycle', () => {
    const sim = createInitialSimulation();
    const states = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      tickSimulation(sim);
      states.add(sim.trucks[1].state);
    }
    for (const state of [
      'CARGANDO',
      'SALIENDO',
      'EN_RUTA',
      'EN_PUERTA',
      'MANIOBRANDO',
      'EN_MUELLE',
      'DESCARGANDO',
    ])
      expect(states.has(state), state).toBe(true);
    expect(sim.delivered).toBeGreaterThanOrEqual(2);
    expect(validateInvariants(sim)).toEqual([]);
  });
});
describe('inventory and KPIs', () => {
  it('moves trucks and forklifts and changes stock within ten seconds', () => {
    const initial = createInitialSimulation();
    const sim = run(9);
    expect(distance(initial.forklifts[0].position, sim.forklifts[0].position)).toBeGreaterThan(1);
    expect(distance(initial.trucks[2].position, sim.trucks[2].position)).toBeGreaterThan(1);
    expect(calculateKPIs(sim, 'riverside').stock).not.toBe(
      calculateKPIs(initial, 'riverside').stock,
    );
  });
  it('conserves physical pallets through loading, transit and unloading', () => {
    const sim = run(650);
    expect(sim.pallets.length).toBe(sim.initialPallets);
    expect(validateInvariants(sim)).toEqual([]);
    expect(sim.delivered).toBeGreaterThan(1);
  });
  it('counts every state exactly once', () => {
    const sim = createInitialSimulation();
    for (const state of [
      'EN_RUTA',
      'EN_PUERTA',
      'MANIOBRANDO',
      'EN_MUELLE',
      'CARGANDO',
      'DESCARGANDO',
      'SALIENDO',
      'APARCADO',
      'MANTENIMIENTO',
    ] as const) {
      sim.trucks[0].state = state;
      expect(calculateKPIs(sim).total).toBe(CONFIG.fleetSize);
    }
  });
  it('computes on-time delivery from actual completions', () => {
    const sim = createInitialSimulation();
    sim.delivered = 5;
    sim.onTime = 4;
    expect(calculateKPIs(sim).onTime).toBe(80);
  });
});
describe('player controls', () => {
  it('reserves a dock and drives the parked truck to it', () => {
    const sim = createInitialSimulation();
    sim.trucks
      .filter((t) => t.state === 'EN_RUTA' && t.destinationId === 'riverside')
      .forEach((t) => {
        t.paused = true;
      });
    expect(
      applyAction(sim, { type: 'ASSIGN_DOCK', truckId: 'TRK-01', dockId: 'riverside:dock:3' }).ok,
    ).toBe(true);
    for (let i = 0; i < 400; i++) tickSimulation(sim);
    expect(sim.trucks[0].state).toBe('EN_MUELLE');
    expect(sim.docks[3].truckId).toBe('TRK-01');
    for (
      let i = 0;
      i < 1000 &&
      sim.trucks.some(
        (t) =>
          t.id !== 'TRK-01' &&
          t.warehouseId === 'riverside' &&
          ['MANIOBRANDO', 'EN_PUERTA', 'SALIENDO'].includes(t.state),
      );
      i++
    )
      tickSimulation(sim);
    expect(applyAction(sim, { type: 'PARK', truckId: 'TRK-01' }).ok).toBe(true);
    for (let i = 0; i < 400; i++) tickSimulation(sim);
    expect(sim.trucks[0].state).toBe('APARCADO');
    expect(validateInvariants(sim)).toEqual([]);
  });
  it('enforces the network-shipment limit and creates a real manual shipment when free', () => {
    const sim = createInitialSimulation();
    const action = {
      type: 'CREATE_SHIPMENT',
      originId: 'riverside',
      destinationId: 'eastport',
      client: 'Test client',
      palletCount: 2,
      priority: 'URGENT',
    } as const;
    expect(applyAction(sim, action).ok).toBe(false);
    sim.nextDispatchAt = 1e9;
    for (let i = 0; i < 5500; i++) tickSimulation(sim);
    expect(applyAction(sim, action).ok).toBe(true);
    for (let i = 0; i < 4000; i++) tickSimulation(sim);
    expect(sim.shipments.find((s) => s.client === 'Test client')?.status).toBe('DELIVERED');
    expect(validateInvariants(sim)).toEqual([]);
  });
  it('keeps stock and shipments intact during maintenance and resumption', () => {
    const sim = createInitialSimulation();
    expect(applyAction(sim, { type: 'MAINTENANCE', truckId: 'TRK-03' }).ok).toBe(true);
    expect(sim.trucks[2].cargo).toHaveLength(4);
    expect(applyAction(sim, { type: 'RELEASE', truckId: 'TRK-03' }).ok).toBe(true);
    for (let i = 0; i < 1400; i++) tickSimulation(sim);
    expect(validateInvariants(sim)).toEqual([]);
  });
  it('sends a forklift to the charger without orphaning its pallet', () => {
    const sim = run(8);
    expect(applyAction(sim, { type: 'CHARGE', forkliftId: 'FLT-01' }).ok).toBe(true);
    for (let i = 0; i < 700; i++) tickSimulation(sim);
    expect(sim.forklifts[0].battery).toBeGreaterThan(80);
    expect(validateInvariants(sim)).toEqual([]);
  });
  it('prevents reserving more stock than a destination can hold', () => {
    const sim = createInitialSimulation();
    sim.nextDispatchAt = 1e9;
    for (let i = 0; i < 4000; i++) tickSimulation(sim);
    sim.warehouses.find((w) => w.id === 'eastport')!.capacity = sim.pallets.filter(
      (p) => p.warehouseId === 'eastport' && p.location !== 'TRUCK',
    ).length;
    const result = applyAction(sim, {
      type: 'CREATE_SHIPMENT',
      originId: 'riverside',
      destinationId: 'eastport',
      client: 'Capacity test',
      palletCount: 2,
      priority: 'NORMAL',
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('fully reserved');
    expect(validateInvariants(sim)).toEqual([]);
  });
  it('safely recovers an artificially obstructed truck without losing cargo or fleet size', () => {
    const sim = createInitialSimulation();
    const t = sim.trucks[0];
    applyAction(sim, { type: 'ASSIGN_DOCK', truckId: t.id, dockId: 'riverside:dock:3' });
    t.position = { ...sim.trucks[1].position };
    t.path = [{ ...t.position }];
    t.pathIndex = 0;
    t.lastAdvanceAt = -61;
    tickSimulation(sim);
    expect(sim.watchdogResets).toBe(1);
    expect(t.state).toBe('EN_MUELLE');
    expect(t.position).toEqual({ x: 12, z: 8 });
    expect(calculateKPIs(sim).total).toBe(CONFIG.fleetSize);
    expect(validateInvariants(sim)).toEqual([]);
  });
});
describe('determinism and endurance', () => {
  it('returns an interrupted incoming pallet to a unique rack slot', () => {
    const sim = createInitialSimulation();
    sim.nextDispatchAt = 1e9;
    let found = false;
    for (let i = 0; i < 5000; i++) {
      tickSimulation(sim);
      const f = sim.forklifts[0];
      const p = sim.pallets.find((p) => p.id === f.palletId);
      if (
        f.task === 'UNLOAD' &&
        f.state === 'TO_STORAGE' &&
        p &&
        sim.pallets.some(
          (other) =>
            other.location === 'RACK' &&
            other.warehouseId === f.warehouseId &&
            other.rackIndex === p.rackIndex,
        )
      ) {
        found = true;
        expect(applyAction(sim, { type: 'CHARGE', forkliftId: f.id }).ok).toBe(true);
        expect(validateInvariants(sim)).toEqual([]);
        expect(p.location).toBe('RACK');
        break;
      }
    }
    expect(found).toBe(true);
  });
  it('replays exactly from a serialized snapshot', () => {
    const sim = run(60);
    const restored = JSON.parse(JSON.stringify(sim)) as typeof sim;
    for (let i = 0; i < 1000; i++) {
      tickSimulation(sim);
      tickSimulation(restored);
    }
    expect(restored).toEqual(sim);
  });
  it('runs 72,000 ticks equivalent to thirty minutes at x4 with bounded history and no stuck trucks', () => {
    const sim = createInitialSimulation();
    let minimumSeparation = Infinity;
    for (let i = 0; i < 72000; i++) {
      tickSimulation(sim);
      if (i % 100 === 0) {
        expect(validateInvariants(sim)).toEqual([]);
        expect(calculateKPIs(sim).total).toBe(CONFIG.fleetSize);
        for (const a of sim.trucks)
          for (const b of sim.trucks)
            if (a.id < b.id && a.warehouseId && a.warehouseId === b.warehouseId)
              minimumSeparation = Math.min(minimumSeparation, distance(a.position, b.position));
      }
    }
    expect(sim.time).toBeCloseTo(7200, 5);
    expect(sim.watchdogResets).toBe(0);
    expect(sim.trucks.filter((t) => t.state === 'EN_PUERTA').every((t) => t.stateTime < 60)).toBe(
      true,
    );
    expect(minimumSeparation).toBeGreaterThan(7);
    expect(sim.delivered).toBeGreaterThan(20);
    expect(sim.alerts.length).toBeLessThanOrEqual(CONFIG.maxAlerts);
    expect(sim.shipments.length).toBeLessThanOrEqual(CONFIG.maxHistory);
    expect(sim.trucks[0].state).toBe('APARCADO');
  }, 120000);
  it('handles multiple random seeds without broken reservations', () => {
    for (const seed of [1, 42, 2026, 99999]) {
      const sim = run(1800, seed);
      expect(validateInvariants(sim)).toEqual([]);
      expect(sim.watchdogResets).toBe(0);
    }
  }, 120000);
});
