import { CONFIG } from '../lib/config';
import { angleDelta } from './math';
import type { Simulation, Truck } from './types';
import {
  findRoadPath,
  makeRoadAgent,
  ROAD_GRAPH,
  roadEdge,
  roadLength,
  roadNode,
  roadPosition,
  signalGreen,
} from '../world/roads';

export function enterRoad(sim: Simulation, t: Truck): void {
  const closed = new Set(
    sim.closures
      .filter((c) => c.warehouseId === t.destinationId && c.until > sim.time)
      .map((c) => c.edgeId),
  );
  const path = findRoadPath(ROAD_GRAPH.entry, ROAD_GRAPH.gate, closed);
  if (!path) {
    t.stopReason = 'Corridor closed';
    return;
  }
  const proposed = makeRoadAgent(
    t.id,
    t.destinationId,
    path,
    t.kind,
    Math.max(0, (t.routeProgress - 0.64) / 0.36),
  );
  const others = [
    ...sim.traffic,
    ...sim.trucks.flatMap((other) => (other.id !== t.id && other.road ? [other.road] : [])),
  ];
  if (
    others.some(
      (a) =>
        a.warehouseId === proposed.warehouseId &&
        Math.hypot(a.position.x - proposed.position.x, a.position.z - proposed.position.z) <
          CONFIG.roadGap,
    )
  ) {
    t.speed = 0;
    t.stopReason = 'Joining regional traffic';
    return;
  }
  t.road = proposed;
  t.position = { ...t.road.position };
}

/** Lane queues and junction reservations are shared by fleet and ambient traffic. */
export function tickTraffic(sim: Simulation, dt: number): void {
  sim.closures = sim.closures.filter((c) => c.until > sim.time);
  const trucks = new Map(sim.trucks.map((t) => [t.id, t]));
  const all = [...sim.traffic, ...sim.trucks.flatMap((t) => (t.road ? [t.road] : []))];
  for (const w of sim.warehouses) {
    const agents = all.filter((a) => a.warehouseId === w.id);
    const reservations = new Map<string, string>();
    for (const a of agents) {
      if (a.junction && a.nodes[a.index] === a.junction && a.distance > 7) a.junction = null;
      if (a.junction) reservations.set(a.junction, a.id);
    }
    // Front-to-back processing permits a following vehicle to use newly cleared road space.
    agents.sort((a, b) => b.distance - a.distance || a.id.localeCompare(b.id));
    for (const a of agents) {
      const t = trucks.get(a.id),
        edge = roadEdge(a.nodes[a.index], a.nodes[a.index + 1]);
      if (!edge || a.finished) {
        a.speed = 0;
        continue;
      }
      const next = roadNode(edge.to),
        remaining = edge.length - a.distance;
      const closed = new Set(
        sim.closures.filter((c) => c.warehouseId === w.id).map((c) => c.edgeId),
      );
      const nextEdge = roadEdge(edge.to, a.nodes[a.index + 2]);
      if (t && nextEdge && closed.has(nextEdge.id)) {
        const alternative = findRoadPath(edge.to, ROAD_GRAPH.gate, closed);
        if (alternative) a.nodes = [...a.nodes.slice(0, a.index + 2), ...alternative.slice(1)];
      }
      const leader = agents
        .filter(
          (b) =>
            b.id !== a.id &&
            b.nodes[b.index] === edge.from &&
            b.nodes[b.index + 1] === edge.to &&
            b.distance > a.distance,
        )
        .sort((b, c) => b.distance - c.distance)[0];
      let space = leader ? Math.max(0, leader.distance - a.distance - CONFIG.roadGap) : Infinity;
      let desired =
        Math.min(edge.limit, CONFIG.roadSpeed) *
        (sim.weather === 'rain' ? 0.78 : sim.weather === 'fog' ? 0.65 : 1);
      a.stopReason = null;
      if (t && (t.paused || t.delayUntil > sim.time || t.state !== 'EN_RUTA')) {
        desired = 0;
        space = 0;
        a.stopReason = t.paused ? 'Operator pause' : 'Roadside hold';
      }
      if (closed.has(edge.id)) {
        desired = Math.min(desired, 4);
        a.stopReason = 'Traffic incident';
      }
      const ownReservation = reservations.get(next.id) === a.id;
      const outgoing = roadEdge(next.id, a.nodes[a.index + 2]);
      const exitBlocked =
        outgoing &&
        agents.some(
          (b) =>
            b.id !== a.id &&
            b.nodes[b.index] === outgoing.from &&
            b.nodes[b.index + 1] === outgoing.to &&
            b.distance < CONFIG.roadGap + 18,
        );
      // paciencia: tras 6 s detenido en verde, el vehículo fuerza el paso (evita deadlocks de cola)
      const patient = (a.waited ?? 0) > 6;
      if (next.signal && !ownReservation) {
        const green = signalGreen(next, edge.axis, sim.time);
        const free = !reservations.has(next.id) || patient;
        if (green && free && (!exitBlocked || patient) && remaining < 21) {
          a.junction = next.id;
          reservations.set(next.id, a.id);
        } else {
          space = Math.min(space, Math.max(0, remaining - 17));
          a.stopReason = !green
            ? 'Red signal'
            : exitBlocked
              ? 'Junction queue'
              : 'Yield at junction';
        }
      }
      desired = Math.min(desired, Math.sqrt(2 * CONFIG.roadBraking * space));
      const acceleration = desired > a.speed ? CONFIG.roadAcceleration : CONFIG.roadBraking;
      a.speed += Math.max(-acceleration * dt, Math.min(acceleration * dt, desired - a.speed));
      const moved = Math.min(a.speed * dt, space, remaining);
      a.distance += moved;
      a.traveled += moved;
      if (moved < 0.001 && desired < 0.1) a.speed = 0;
      a.waited = a.speed < 0.05 ? (a.waited ?? 0) + dt : 0;
      if (a.distance >= edge.length - 0.001) {
        a.index++;
        a.distance = 0;
        if (a.index >= a.nodes.length - 1) {
          if (a.loop) a.index = 0;
          else {
            a.index = a.nodes.length - 2;
            a.distance = edge.length;
            a.finished = true;
            a.speed = 0;
          }
        }
      }
      a.position = roadPosition(a);
      const goal = roadEdge(a.nodes[a.index], a.nodes[a.index + 1]);
      if (goal) {
        const p = roadNode(goal.from),
          q = roadNode(goal.to);
        a.yaw += angleDelta(a.yaw, Math.atan2(q.x - p.x, q.z - p.z)) * Math.min(1, dt * 3);
      }
      if (t) {
        t.position = { ...a.position };
        t.speed = a.speed;
        t.yaw = a.yaw;
        t.stopReason = a.stopReason;
        t.kilometers += moved / 1000;
        t.fuel = Math.max(5, t.fuel - moved * 0.00012);
        const before = a.nodes.slice(0, a.index + 1);
        t.routeProgress = Math.min(
          0.999,
          0.64 + (0.36 * (roadLength(before) + a.distance)) / Math.max(1, roadLength(a.nodes)),
        );
        t.lastAdvanceAt = sim.time;
      }
    }
  }
}
