import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/lib/config';
import { createInitialSimulation } from '../src/data/seeds';
import { applyAction, tickSimulation } from '../src/sim/engine';
import { tickTraffic } from '../src/sim/traffic';
import {
  findRoadPath,
  makeRoadAgent,
  ROAD_GRAPH,
  roadEdge,
  roadNode,
  signalGreen,
} from '../src/world/roads';

describe('regional road network', () => {
  it('finds connected directed roads from highway entry to the hub', () => {
    const path = findRoadPath(ROAD_GRAPH.entry, ROAD_GRAPH.gate)!;
    expect(path[0]).toBe(ROAD_GRAPH.entry);
    expect(path.at(-1)).toBe(ROAD_GRAPH.gate);
    path.slice(1).forEach((n, i) => expect(roadEdge(path[i], n)).toBeDefined());
  });
  it('takes a real alternative when a road is closed', () => {
    const first = findRoadPath(ROAD_GRAPH.entry, ROAD_GRAPH.gate)!;
    const closed = new Set([`${first[1]}>${first[2]}`]);
    const alternative = findRoadPath(ROAD_GRAPH.entry, ROAD_GRAPH.gate, closed)!;
    expect(alternative).not.toEqual(first);
    alternative
      .slice(1)
      .forEach((n, i) => expect(closed.has(`${alternative[i]}>${n}`)).toBe(false));
  });
  it('returns no route when the only hub access is closed', () => {
    expect(findRoadPath(ROAD_GRAPH.entry, ROAD_GRAPH.gate, new Set(['n20>gate']))).toBeNull();
    expect(findRoadPath('missing', ROAD_GRAPH.gate)).toBeNull();
  });
  it('never gives perpendicular traffic a simultaneous green', () => {
    const n = roadNode('n10');
    for (let t = 0; t < 100; t += 0.1)
      expect(signalGreen(n, 'x', t) && signalGreen(n, 'z', t)).toBe(false);
  });
  it('brakes before a red light and proceeds on green', () => {
    const sim = createInitialSimulation(),
      car = makeRoadAgent('red-test', 'riverside', ['n00', 'n10', 'n20'], 'CAR');
    sim.traffic = [car];
    car.distance = 49;
    car.speed = 9;
    for (let i = 0; i < 50; i++) tickTraffic(sim, 0.1);
    expect(car.index).toBe(0);
    expect(car.distance).toBeLessThanOrEqual(53.001);
    expect(car.speed).toBe(0);
    sim.time = 10;
    for (let i = 0; i < 80; i++) tickTraffic(sim, 0.1);
    expect(car.index).toBeGreaterThan(0);
  });
  it('maintains spacing behind an immobile vehicle on the same lane', () => {
    const sim = createInitialSimulation(),
      front = makeRoadAgent('front', 'riverside', ['n00', 'n01'], 'CAR'),
      back = makeRoadAgent('back', 'riverside', ['n00', 'n01'], 'CAR');
    front.distance = 55;
    front.finished = true;
    back.distance = 20;
    back.speed = 13;
    sim.traffic = [front, back];
    for (let i = 0; i < 100; i++) {
      tickTraffic(sim, 0.1);
      expect(front.distance - back.distance).toBeGreaterThanOrEqual(CONFIG.roadGap - 0.001);
    }
    expect(back.speed).toBe(0);
  });
  it('reduces physical road speed in rain', () => {
    const clear = createInitialSimulation(),
      rain = createInitialSimulation();
    rain.weather = 'rain';
    clear.traffic = [makeRoadAgent('weather', 'riverside', ['n00', 'n01', 'n02'], 'CAR')];
    rain.traffic = structuredClone(clear.traffic);
    for (let i = 0; i < 100; i++) {
      tickTraffic(clear, 0.1);
      tickTraffic(rain, 0.1);
    }
    expect(rain.traffic[0].traveled).toBeLessThan(clear.traffic[0].traveled);
  });
  it('seeds thirty trucks/vans, eight hubs and continuous ambient vehicles', () => {
    const sim = createInitialSimulation();
    expect(sim.warehouses).toHaveLength(8);
    expect(sim.trucks).toHaveLength(30);
    expect(sim.trucks.some((t) => t.kind === 'VAN')).toBe(true);
    expect(sim.traffic).toHaveLength(8 * CONFIG.trafficPerHub);
    for (let i = 0; i < 2400; i++) tickSimulation(sim);
    expect(sim.traffic.every((a) => a.traveled > 40)).toBe(true);
  });
  it('con 16 vehículos por hub ningún coche ambiente queda detenido de forma permanente', () => {
    const sim = createInitialSimulation();
    let worst = 0;
    for (let i = 0; i < 9000; i++) {
      tickSimulation(sim);
      if (i % 50 === 0) for (const a of sim.traffic) worst = Math.max(worst, a.waited ?? 0);
    }
    expect(worst).toBeLessThan(60);
    expect(sim.traffic.every((a) => a.traveled > 200)).toBe(true);
  });
  it('pauses one fleet vehicle without losing cargo or stopping the global clock', () => {
    const sim = createInitialSimulation();
    for (let i = 0; i < 40; i++) tickSimulation(sim);
    const t = sim.trucks.find((t) => t.road)!;
    expect(t).toBeDefined();
    expect(applyAction(sim, { type: 'PAUSE_TRUCK', truckId: t.id }).ok).toBe(true);
    const pos = { ...t.position },
      cargo = [...t.cargo];
    for (let i = 0; i < 40; i++) tickSimulation(sim);
    expect(t.position).toEqual(pos);
    expect(t.cargo).toEqual(cargo);
    expect(applyAction(sim, { type: 'PAUSE_TRUCK', truckId: t.id }).ok).toBe(true);
    expect(t.paused).toBe(false);
  });
  it('reassigns an alternative through the graph without deleting the shipment', () => {
    const sim = createInitialSimulation(),
      t = sim.trucks[2];
    t.road = makeRoadAgent(
      t.id,
      t.destinationId,
      findRoadPath(ROAD_GRAPH.entry, ROAD_GRAPH.gate)!,
      'TRUCK',
    );
    const old = [...t.road.nodes],
      shipment = t.shipmentId;
    expect(applyAction(sim, { type: 'ALTERNATE_ROUTE', truckId: t.id }).ok).toBe(true);
    expect(t.road.nodes).not.toEqual(old);
    expect(t.shipmentId).toBe(shipment);
  });
});
