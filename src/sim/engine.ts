import { enterRoad, tickTraffic } from './traffic';
import { findRoadPath, ROAD_GRAPH, roadEdge } from '../world/roads';
import { CONFIG } from '../lib/config';
import { activeShipments } from './kpis';
import { advance, angleDelta, clamp, distance, rackPosition, random } from './math';
import type {
  ActionResult,
  Dock,
  Forklift,
  PlayerAction,
  Selection,
  Shipment,
  Simulation,
  Truck,
  TruckState,
  Waypoint,
} from './types';

export const TRANSITIONS: Record<TruckState, readonly TruckState[]> = {
  EN_RUTA: ['EN_PUERTA', 'MANTENIMIENTO'],
  EN_PUERTA: ['MANIOBRANDO', 'MANTENIMIENTO'],
  MANIOBRANDO: ['EN_MUELLE', 'APARCADO', 'MANTENIMIENTO'],
  EN_MUELLE: ['CARGANDO', 'DESCARGANDO', 'SALIENDO', 'MANIOBRANDO', 'MANTENIMIENTO'],
  CARGANDO: ['EN_MUELLE', 'SALIENDO', 'MANIOBRANDO', 'MANTENIMIENTO'],
  DESCARGANDO: ['EN_MUELLE', 'SALIENDO', 'MANIOBRANDO', 'MANTENIMIENTO'],
  SALIENDO: ['EN_RUTA', 'MANIOBRANDO', 'MANTENIMIENTO'],
  APARCADO: ['MANIOBRANDO', 'SALIENDO', 'MANTENIMIENTO'],
  MANTENIMIENTO: ['MANIOBRANDO', 'SALIENDO', 'EN_RUTA'],
};
export function transitionTruck(truck: Truck, next: TruckState): void {
  if (next === truck.state) return;
  if (!TRANSITIONS[truck.state].includes(next))
    throw new Error(`Illegal truck transition ${truck.state} → ${next}`);
  truck.state = next;
  truck.stateTime = 0;
  truck.speed = 0;
  truck.stopReason = null;
}
export function addAlert(
  sim: Simulation,
  severity: 'info' | 'warning' | 'error',
  title: string,
  message: string,
  entity: Selection | null = null,
): void {
  sim.alerts.unshift({
    id: sim.nextAlert++,
    time: sim.time,
    severity,
    title,
    message,
    read: false,
    entity,
  });
  sim.alerts.length = Math.min(sim.alerts.length, CONFIG.maxAlerts);
}
const shipmentFor = (sim: Simulation, t: Truck) => sim.shipments.find((s) => s.id === t.shipmentId);
function markShipment(
  sim: Simulation,
  s: Shipment,
  stage: Exclude<Shipment['status'], 'ON_HOLD'>,
): void {
  s.status = stage;
  if (!s.timeline.some((e) => e.stage === stage)) s.timeline.push({ stage, time: sim.time });
}
function releaseReservations(sim: Simulation, t: Truck): void {
  sim.docks
    .filter((d) => d.truckId === t.id)
    .forEach((d) => {
      d.truckId = null;
    });
  sim.parking
    .filter((p) => p.truckId === t.id)
    .forEach((p) => {
      p.truckId = null;
    });
  t.dockId = null;
  t.parkingId = null;
}
function cancelForklift(sim: Simulation, f: Forklift): void {
  if (f.palletId) {
    const p = sim.pallets.find((p) => p.id === f.palletId);
    if (p) {
      if (p.location === 'FORKLIFT') {
        const occupied = new Set(
          sim.pallets
            .filter(
              (other) =>
                other.id !== p.id &&
                other.warehouseId === f.warehouseId &&
                other.location === 'RACK',
            )
            .map((other) => other.rackIndex),
        );
        if (occupied.has(p.rackIndex)) {
          let slot = 0;
          while (occupied.has(slot)) slot++;
          p.rackIndex = slot;
        }
        p.warehouseId = f.warehouseId;
      }
      p.location = 'RACK';
      p.ownerId = null;
    }
  }
  f.palletId = null;
  sim.chargers
    .filter((c) => c.forkliftId === f.id)
    .forEach((c) => {
      c.forkliftId = null;
    });
  f.truckId = null;
  f.task = null;
  f.state = 'IDLE';
  f.stateTime = 0;
}
function suspendShipment(sim: Simulation, t: Truck): void {
  const s = shipmentFor(sim, t);
  if (s && s.status !== 'DELIVERED') s.status = 'ON_HOLD';
  sim.forklifts.filter((f) => f.truckId === t.id).forEach((f) => cancelForklift(sim, f));
}
function yardBusy(sim: Simulation, warehouseId: string | null, excludeId?: string): boolean {
  return sim.trucks.some(
    (t) =>
      t.id !== excludeId &&
      t.warehouseId === warehouseId &&
      (t.state === 'MANIOBRANDO' || t.state === 'SALIENDO' || t.state === 'EN_PUERTA'),
  );
}
function setPath(sim: Simulation, t: Truck, path: Waypoint[]): void {
  t.path = path;
  t.pathIndex = 0;
  t.lastAdvanceAt = sim.time;
  t.speed = 0;
}
function pathTo(t: Truck, target: { x: number; z: number }): Waypoint[] {
  const path: Waypoint[] = [];
  if (t.position.z < 24) path.push({ x: t.position.x, z: 26 });
  else if (t.position.x > 32) path.push({ x: 35, z: 26 });
  path.push({ x: target.x, z: 26 }, { ...target, reverse: true });
  return path;
}
function freeDock(sim: Simulation, t: Truck): Dock | undefined {
  const preferred = t.targetDockId
    ? sim.docks.find(
        (d) =>
          d.id === t.targetDockId &&
          (!d.truckId || d.truckId === t.id) &&
          d.blockedUntil <= sim.time,
      )
    : undefined;
  if (preferred) return preferred;
  return (
    sim.docks.find(
      (d) =>
        d.warehouseId === t.warehouseId &&
        (!d.truckId || d.truckId === t.id) &&
        d.blockedUntil <= sim.time &&
        d.direction === (t.cargo.length ? 'IN' : 'OUT'),
    ) ??
    sim.docks.find(
      (d) =>
        d.warehouseId === t.warehouseId &&
        (!d.truckId || d.truckId === t.id) &&
        d.blockedUntil <= sim.time,
    )
  );
}
function beginDock(sim: Simulation, t: Truck, d: Dock): void {
  releaseReservations(sim, t);
  d.truckId = t.id;
  t.dockId = d.id;
  t.intent = 'SHIPMENT';
  transitionTruck(t, 'MANIOBRANDO');
  setPath(sim, t, pathTo(t, d.position));
}
function beginParking(sim: Simulation, t: Truck, maintenance = false): boolean {
  const slot = sim.parking.find(
    (p) => p.warehouseId === t.warehouseId && (!p.truckId || p.truckId === t.id),
  );
  if (!slot) return false;
  releaseReservations(sim, t);
  slot.truckId = t.id;
  t.parkingId = slot.id;
  t.intent = maintenance ? 'MAINTENANCE' : 'PARK';
  transitionTruck(t, 'MANIOBRANDO');
  setPath(sim, t, pathTo(t, slot.position));
  return true;
}
function beginDeparture(sim: Simulation, t: Truck): void {
  releaseReservations(sim, t);
  t.intent = 'DEPART';
  transitionTruck(t, 'SALIENDO');
  setPath(sim, t, [
    { x: t.position.x, z: 26 },
    { x: 35, z: 26 },
    { x: 35, z: 36 },
    { x: 55, z: 36 },
  ]);
}
function completePath(sim: Simulation, t: Truck): void {
  t.path = [];
  t.pathIndex = 0;
  t.speed = 0;
  t.yaw = 0;
  if (t.state === 'SALIENDO') {
    transitionTruck(t, 'EN_RUTA');
    t.originId = t.warehouseId ?? t.originId;
    t.warehouseId = null;
    t.routeProgress = 0;
    t.routeDuration = CONFIG.routeSeconds + random(sim) * 25;
    t.lastAdvanceAt = sim.time;
    const s = shipmentFor(sim, t);
    if (s && s.status !== 'ON_HOLD') markShipment(sim, s, 'IN_TRANSIT');
  } else if (t.dockId) {
    transitionTruck(t, 'EN_MUELLE');
    t.transferCount = 0;
  } else {
    transitionTruck(t, t.intent === 'MAINTENANCE' ? 'MANTENIMIENTO' : 'APARCADO');
    addAlert(
      sim,
      'info',
      t.state === 'MANTENIMIENTO' ? 'Maintenance bay ready' : 'Truck parked',
      `${t.id} arrived at ${t.parkingId?.split(':').pop() === '0' ? 'P01' : 'P02'}.`,
      { kind: 'truck', id: t.id },
    );
  }
}
function moveTruck(sim: Simulation, t: Truck, dt: number): void {
  const target = t.path[t.pathIndex];
  if (!target) {
    completePath(sim, t);
    return;
  }
  const d = distance(t.position, target);
  const goalYaw =
    Math.atan2(target.x - t.position.x, target.z - t.position.z) + (target.reverse ? Math.PI : 0);
  t.yaw += angleDelta(t.yaw, goalYaw) * Math.min(1, dt * 3.5);
  const desired = target.reverse ? CONFIG.truckSpeed * 0.55 : CONFIG.truckSpeed;
  t.speed += (Math.min(desired, Math.max(0.9, d * 2)) - t.speed) * Math.min(1, dt * 3);
  const proposed = { ...t.position };
  const arrived = advance(proposed, target, t.speed * dt);
  const collision = sim.trucks.some(
    (other) =>
      other.id !== t.id &&
      other.warehouseId === t.warehouseId &&
      distance(proposed, other.position) < CONFIG.truckSeparation,
  );
  if (collision) {
    t.speed = 0;
    t.stopReason = 'Yielding to yard traffic';
    return;
  }
  const traveled = distance(t.position, proposed);
  t.position = proposed;
  if (traveled > 0.0001) t.lastAdvanceAt = sim.time;
  if (arrived) {
    t.pathIndex++;
    if (t.pathIndex >= t.path.length) completePath(sim, t);
  }
}
function updateTruck(sim: Simulation, t: Truck, dt: number): void {
  t.stateTime += dt;
  if (t.paused) {
    t.speed = 0;
    t.stopReason = 'Operator pause';
    t.lastAdvanceAt = sim.time;
    return;
  }
  if (t.delayUntil > sim.time) {
    t.speed = 0;
    t.stopReason = t.warehouseId ? 'Operational hold' : 'Traffic delay';
    t.lastAdvanceAt = sim.time;
    return;
  }
  t.stopReason = null;
  if (t.state === 'EN_RUTA') {
    if (!t.road && t.routeProgress < 0.64) {
      t.routeProgress = Math.min(0.64, t.routeProgress + dt / t.routeDuration);
      t.speed = 22;
      t.lastAdvanceAt = sim.time;
      t.position = { x: 325 + (1 - t.routeProgress / 0.64) * 150, z: -100 };
      t.yaw = -Math.PI / 2;
    } else if (!t.road) enterRoad(sim, t);
    if (t.road?.finished) {
      t.speed = 0;
      t.stopReason = 'Waiting for hub entrance';
      if (
        (sim.docks.some(
          (d) => d.warehouseId === t.destinationId && !d.truckId && d.blockedUntil <= sim.time,
        ) ||
          (!t.shipmentId &&
            sim.parking.some((p) => p.warehouseId === t.destinationId && !p.truckId))) &&
        !yardBusy(sim, t.destinationId) &&
        !sim.trucks.some(
          (other) =>
            other.id !== t.id &&
            other.warehouseId === t.destinationId &&
            distance(other.position, { x: 35, z: 32 }) < CONFIG.truckSeparation,
        )
      ) {
        t.road = null;
        t.routeProgress = 1;
        t.warehouseId = t.destinationId;
        t.position = { x: 35, z: 32 };
        transitionTruck(t, 'EN_PUERTA');
        t.lastAdvanceAt = sim.time;
      }
    }
  } else if (t.state === 'EN_PUERTA') {
    if (yardBusy(sim, t.warehouseId, t.id)) {
      t.stopReason = 'Waiting for access lane';
      t.lastAdvanceAt = sim.time;
      return;
    }
    const s = shipmentFor(sim, t);
    if ((t.cargo.length || s) && t.intent !== 'PARK' && t.intent !== 'MAINTENANCE') {
      const d = freeDock(sim, t);
      if (d) beginDock(sim, t, d);
      else {
        t.stopReason = 'Waiting for a free dock';
        t.lastAdvanceAt = sim.time;
      }
    } else if (!beginParking(sim, t, t.intent === 'MAINTENANCE')) {
      const staging = freeDock(sim, t);
      if (staging) beginDock(sim, t, staging);
      else {
        t.stopReason = 'Waiting for a staging bay';
        t.lastAdvanceAt = sim.time;
      }
    }
  } else if (t.state === 'MANIOBRANDO' || t.state === 'SALIENDO') moveTruck(sim, t, dt);
  else if (t.state === 'EN_MUELLE') {
    const s = shipmentFor(sim, t);
    if (t.intent === 'DEPART') {
      if (!yardBusy(sim, t.warehouseId, t.id)) beginDeparture(sim, t);
    } else if (t.intent === 'PARK' && !s) {
      if (!yardBusy(sim, t.warehouseId, t.id)) beginParking(sim, t);
    } else if (s && s.status !== 'ON_HOLD')
      transitionTruck(
        t,
        t.cargo.length && t.warehouseId === s.destinationId ? 'DESCARGANDO' : 'CARGANDO',
      );
  } else if (t.state === 'CARGANDO') {
    const s = shipmentFor(sim, t);
    if (s && t.cargo.length >= s.palletCount) {
      markShipment(sim, s, 'LOADED');
      t.destinationId = s.destinationId;
      t.intent = 'DEPART';
      transitionTruck(t, 'EN_MUELLE');
    }
  } else if (t.state === 'DESCARGANDO') {
    const f = sim.forklifts.find((f) => f.truckId === t.id && f.palletId);
    if (!t.cargo.length && !f) {
      const s = shipmentFor(sim, t);
      if (s) {
        markShipment(sim, s, 'DELIVERED');
        s.deliveredAt = sim.time;
        sim.delivered++;
        if (sim.time <= s.eta) sim.onTime++;
        addAlert(
          sim,
          'info',
          'Shipment delivered',
          `${s.id} delivered to ${sim.warehouses.find((w) => w.id === s.destinationId)?.city}.`,
          { kind: 'shipment', id: s.id },
        );
      }
      t.shipmentId = null;
      t.intent = 'PARK';
      transitionTruck(t, 'EN_MUELLE');
    }
  }
  if (
    (t.state === 'MANIOBRANDO' || t.state === 'SALIENDO') &&
    sim.time - t.lastAdvanceAt > CONFIG.watchdogSeconds
  ) {
    // Restore to a reserved destination; never create/remove trucks or discard cargo.
    const dest = t.dockId
      ? sim.docks.find((d) => d.id === t.dockId)?.position
      : sim.parking.find((p) => p.id === t.parkingId)?.position;
    t.position = dest ? { ...dest } : { x: 55, z: 36 };
    completePath(sim, t);
    sim.watchdogResets++;
    addAlert(
      sim,
      'warning',
      'Yard watchdog recovery',
      `${t.id} was safely repositioned after 60 seconds without movement.`,
      { kind: 'truck', id: t.id },
    );
  }
}
function forkliftMove(f: Forklift, target: { x: number; z: number }, dt: number): boolean {
  const before = { ...f.position };
  const goal = Math.atan2(target.x - f.position.x, target.z - f.position.z);
  f.yaw += angleDelta(f.yaw, goal) * Math.min(1, dt * 6);
  const arrived = advance(f.position, target, CONFIG.forkliftSpeed * dt);
  const traveled = distance(before, f.position);
  f.distance += traveled;
  f.speed = traveled / dt;
  f.battery = Math.max(0, f.battery - dt * 0.026);
  return arrived;
}
function setForkliftState(f: Forklift, state: Forklift['state']): void {
  f.state = state;
  f.stateTime = 0;
}
function assignForklift(sim: Simulation, f: Forklift, t: Truck): boolean {
  if (f.battery < CONFIG.lowBattery) return false;
  const task = t.state === 'CARGANDO' ? 'LOAD' : t.state === 'DESCARGANDO' ? 'UNLOAD' : null;
  if (!task) return false;
  if (task === 'LOAD') {
    const s = shipmentFor(sim, t);
    if (!s || t.cargo.length >= s.palletCount) return false;
    const p = sim.pallets.find(
      (p) => p.warehouseId === f.warehouseId && p.location === 'RACK' && !p.ownerId,
    );
    if (!p) return false;
    p.ownerId = f.id;
    f.palletId = p.id;
    setForkliftState(f, 'TO_RACK');
  } else {
    if (!t.cargo.length) return false;
    setForkliftState(f, 'TO_TRUCK');
  }
  f.task = task;
  f.truckId = t.id;
  return true;
}
function updateForklift(sim: Simulation, f: Forklift, dt: number): void {
  f.stateTime += dt;
  f.speed = 0;
  const charger = sim.chargers.find((c) => c.id === f.chargerId)!;
  if (f.state === 'CHARGING') {
    f.battery = Math.min(100, f.battery + dt * 3);
    if (f.battery >= 98) {
      charger.forkliftId = null;
      setForkliftState(f, 'IDLE');
    }
    return;
  }
  if (f.state === 'TO_CHARGER') {
    if (forkliftMove(f, charger.position, dt)) {
      charger.forkliftId = f.id;
      setForkliftState(f, 'CHARGING');
    }
    return;
  }
  if (f.state === 'IDLE') {
    if (f.battery < CONFIG.lowBattery) {
      setForkliftState(f, 'TO_CHARGER');
      return;
    }
    const available = sim.trucks.filter(
      (t) =>
        t.warehouseId === f.warehouseId &&
        ['CARGANDO', 'DESCARGANDO'].includes(t.state) &&
        !sim.forklifts.some((other) => other.id !== f.id && other.truckId === t.id),
    );
    available.sort((a, b) => {
      const rank = { NORMAL: 0, HIGH: 1, URGENT: 2 };
      return (
        rank[shipmentFor(sim, b)?.priority ?? 'NORMAL'] -
        rank[shipmentFor(sim, a)?.priority ?? 'NORMAL']
      );
    });
    if (available[0]) assignForklift(sim, f, available[0]);
    else forkliftMove(f, { x: -16, z: Math.floor(sim.time / 14) % 2 === 0 ? -12 : -1 }, dt);
    return;
  }
  const t = sim.trucks.find((t) => t.id === f.truckId);
  if (!t || !['CARGANDO', 'DESCARGANDO'].includes(t.state)) {
    cancelForklift(sim, f);
    return;
  }
  const p = sim.pallets.find((p) => p.id === f.palletId);
  const truckTarget = { x: t.position.x - 2.8, z: 4.5 };
  if (f.state === 'TO_RACK' && p) {
    if (forkliftMove(f, rackPosition(p.rackIndex), dt)) setForkliftState(f, 'PICKING');
  } else if (f.state === 'PICKING' && f.stateTime >= CONFIG.transferSeconds && p) {
    p.location = 'FORKLIFT';
    p.ownerId = f.id;
    setForkliftState(f, 'TO_TRUCK');
    const s = shipmentFor(sim, t);
    if (s && s.status === 'CONFIRMED') markShipment(sim, s, 'PICKED');
  } else if (f.state === 'TO_TRUCK') {
    if (forkliftMove(f, truckTarget, dt)) {
      if (f.task === 'UNLOAD') {
        const palletId = t.cargo.shift();
        const incoming = sim.pallets.find((p) => p.id === palletId);
        if (incoming) {
          incoming.location = 'FORKLIFT';
          incoming.warehouseId = f.warehouseId;
          incoming.ownerId = f.id;
          f.palletId = incoming.id;
          setForkliftState(f, 'TO_STORAGE');
        } else cancelForklift(sim, f);
      } else setForkliftState(f, 'DROPPING');
    }
  } else if (f.state === 'DROPPING' && f.stateTime >= CONFIG.transferSeconds && p) {
    p.location = 'TRUCK';
    p.ownerId = t.id;
    t.cargo.push(p.id);
    t.transferCount++;
    f.palletId = null;
    f.truckId = null;
    f.task = null;
    setForkliftState(f, 'IDLE');
  } else if (f.state === 'TO_STORAGE' && p) {
    const used = new Set(
      sim.pallets
        .filter((p) => p.warehouseId === f.warehouseId && p.location === 'RACK')
        .map((p) => p.rackIndex),
    );
    let slot = 0;
    while (used.has(slot)) slot++;
    p.rackIndex = slot;
    if (forkliftMove(f, rackPosition(slot), dt)) {
      p.location = 'RACK';
      p.ownerId = null;
      p.warehouseId = f.warehouseId;
      p.receivedAt = '2026-10-06';
      t.transferCount++;
      f.palletId = null;
      f.truckId = null;
      f.task = null;
      setForkliftState(f, 'IDLE');
    }
  }
}
function createShipment(
  sim: Simulation,
  originId: string,
  destinationId: string,
  client: string,
  palletCount: number,
  priority: Shipment['priority'],
  preferredTruckId?: string,
): ActionResult {
  if (originId === destinationId) return { ok: false, message: 'Choose two different hubs.' };
  if (
    !sim.warehouses.some((w) => w.id === originId) ||
    !sim.warehouses.some((w) => w.id === destinationId)
  )
    return { ok: false, message: 'Unknown warehouse.' };
  if (activeShipments(sim).length >= CONFIG.maxActiveShipments)
    return {
      ok: false,
      message: 'The network shipment limit is reached. Complete or resume existing loads first.',
    };
  if (!Number.isInteger(palletCount) || palletCount < 1 || palletCount > 6)
    return { ok: false, message: 'Choose 1–6 pallets.' };
  const destination = sim.warehouses.find((w) => w.id === destinationId)!;
  const present = sim.pallets.filter(
    (p) => p.warehouseId === destinationId && p.location !== 'TRUCK',
  ).length;
  const incoming = activeShipments(sim)
    .filter((s) => s.destinationId === destinationId)
    .reduce((sum, s) => {
      const t = sim.trucks.find((t) => t.id === s.truckId);
      return sum + (t?.warehouseId === destinationId ? t.cargo.length : s.palletCount);
    }, 0);
  if (present + incoming + palletCount > destination.capacity)
    return { ok: false, message: 'Destination storage is fully reserved. Choose a different hub.' };
  const stock = sim.pallets.filter(
    (p) => p.warehouseId === originId && p.location === 'RACK' && !p.ownerId,
  );
  if (stock.length < palletCount)
    return { ok: false, message: 'Insufficient available stock at origin.' };
  const t =
    sim.trucks.find(
      (t) =>
        (!preferredTruckId || t.id === preferredTruckId) &&
        t.warehouseId === originId &&
        t.capacity >= palletCount &&
        !t.shipmentId &&
        t.state === 'APARCADO',
    ) ??
    sim.trucks.find(
      (t) =>
        (!preferredTruckId || t.id === preferredTruckId) &&
        t.warehouseId === originId &&
        t.capacity >= palletCount &&
        !t.shipmentId &&
        t.state === 'EN_MUELLE',
    );
  if (!t) return { ok: false, message: 'An idle truck is required at the origin hub.' };
  if (palletCount > t.capacity)
    return { ok: false, message: `This vehicle holds ${t.capacity} pallets. Reduce the load.` };
  if (yardBusy(sim, originId, t.id))
    return { ok: false, message: 'The access lane is busy. Try again in a few seconds.' };
  const d = freeDock(sim, t);
  if (!d) return { ok: false, message: 'No dock is available at the origin hub.' };
  const id = `#SHP-${sim.nextShipment++}`;
  sim.shipments.push({
    id,
    originId,
    destinationId,
    client: client.trim() || 'AtlasGrid Client',
    palletCount,
    priority,
    truckId: t.id,
    status: 'CONFIRMED',
    createdAt: sim.time,
    eta: sim.time + 350,
    deliveredAt: null,
    timeline: [{ stage: 'CONFIRMED', time: sim.time }],
  });
  t.shipmentId = id;
  t.originId = originId;
  t.destinationId = destinationId;
  t.intent = 'SHIPMENT';
  beginDock(sim, t, d);
  addAlert(
    sim,
    'info',
    'Shipment confirmed',
    `${id} · ${palletCount} pallets assigned to ${t.id}.`,
    { kind: 'shipment', id },
  );
  return {
    ok: true,
    message: `${id} created. ${t.id} is moving to ${d.label}.`,
    selection: { kind: 'shipment', id },
  };
}
export function applyAction(sim: Simulation, action: PlayerAction): ActionResult {
  if (action.type === 'PAUSE_TRUCK') {
    const t = sim.trucks.find((t) => t.id === action.truckId);
    if (!t) return { ok: false, message: 'Unknown vehicle.' };
    t.paused = !t.paused;
    return { ok: true, message: `${t.id} ${t.paused ? 'paused' : 'resumed'}.` };
  }
  if (action.type === 'ALTERNATE_ROUTE') {
    const t = sim.trucks.find((t) => t.id === action.truckId),
      a = t?.road;
    if (!a || t?.state !== 'EN_RUTA')
      return {
        ok: false,
        message: 'Alternative roads are available during the regional approach.',
      };
    const current = a.nodes[a.index + 1],
      following = a.nodes[a.index + 2];
    const closed = new Set(
      sim.closures.filter((c) => c.warehouseId === a.warehouseId).map((c) => c.edgeId),
    );
    if (following) closed.add(`${current}>${following}`);
    const path = findRoadPath(current, ROAD_GRAPH.gate, closed);
    if (!path)
      return { ok: false, message: 'No alternative from this road. Continue toward the hub.' };
    a.nodes = [...a.nodes.slice(0, a.index + 2), ...path.slice(1)];
    return { ok: true, message: `${t.id} rerouted through ${path.length - 1} road segments.` };
  }
  if (action.type === 'CREATE_SHIPMENT')
    return createShipment(
      sim,
      action.originId,
      action.destinationId,
      action.client,
      action.palletCount,
      action.priority,
    );
  if (action.type === 'PRIORITY') {
    const s = sim.shipments.find((s) => s.id === action.shipmentId);
    if (!s) return { ok: false, message: 'Shipment not found.' };
    s.priority = action.priority;
    return { ok: true, message: `${s.id} priority set to ${s.priority.toLowerCase()}.` };
  }
  if (action.type === 'UNBLOCK_DOCK') {
    const d = sim.docks.find((d) => d.id === action.dockId);
    if (!d) return { ok: false, message: 'Dock not found.' };
    d.blockedUntil = 0;
    return { ok: true, message: `${d.label} is open.` };
  }
  if (action.type === 'CHARGE' || action.type === 'REASSIGN_FORKLIFT') {
    const f = sim.forklifts.find((f) => f.id === action.forkliftId);
    if (!f) return { ok: false, message: 'Forklift not found.' };
    if (action.type === 'CHARGE') {
      cancelForklift(sim, f);
      setForkliftState(f, 'TO_CHARGER');
      return { ok: true, message: `${f.id} is heading to its charger.` };
    }
    const t = sim.trucks.find((t) => t.id === action.truckId);
    if (!t || t.warehouseId !== f.warehouseId || !['CARGANDO', 'DESCARGANDO'].includes(t.state))
      return { ok: false, message: 'Select a loading or unloading truck at the same hub.' };
    if (sim.forklifts.some((other) => other.id !== f.id && other.truckId === t.id))
      return { ok: false, message: 'That truck already has an assigned forklift.' };
    cancelForklift(sim, f);
    return assignForklift(sim, f, t)
      ? { ok: true, message: `${f.id} assigned to ${t.id}.` }
      : { ok: false, message: 'No transfer task is available, or battery is low.' };
  }
  const t = sim.trucks.find((t) => t.id === action.truckId);
  if (!t) return { ok: false, message: 'Truck not found.' };
  if (action.type === 'MAINTENANCE' && t.state === 'EN_RUTA') {
    suspendShipment(sim, t);
    transitionTruck(t, 'MANTENIMIENTO');
    t.delayUntil = 0;
    addAlert(
      sim,
      'warning',
      'Roadside maintenance',
      `${t.id} stopped safely. Release it to continue.`,
      { kind: 'truck', id: t.id },
    );
    return { ok: true, message: `${t.id} in roadside maintenance.` };
  }
  if (action.type === 'RELEASE' && t.state === 'MANTENIMIENTO' && !t.warehouseId) {
    t.delayUntil = 0;
    transitionTruck(t, 'EN_RUTA');
    const s = shipmentFor(sim, t);
    if (s) markShipment(sim, s, 'IN_TRANSIT');
    return { ok: true, message: `${t.id} returned to its route.` };
  }
  if (!t.warehouseId) return { ok: false, message: 'Wait until the truck reaches a hub.' };
  if (t.state === 'MANIOBRANDO' || t.state === 'SALIENDO' || yardBusy(sim, t.warehouseId, t.id))
    return {
      ok: false,
      message: 'A yard maneuver is in progress. Try again when the lane is clear.',
    };
  if (action.type === 'ASSIGN_DOCK') {
    const d = sim.docks.find((d) => d.id === action.dockId);
    if (
      !d ||
      d.warehouseId !== t.warehouseId ||
      d.blockedUntil > sim.time ||
      (d.truckId && d.truckId !== t.id)
    )
      return { ok: false, message: 'Choose a free, unblocked dock at this hub.' };
    sim.forklifts.filter((f) => f.truckId === t.id).forEach((f) => cancelForklift(sim, f));
    const s = shipmentFor(sim, t);
    if (s && s.status === 'ON_HOLD')
      s.status = t.cargo.length && t.warehouseId === s.destinationId ? 'IN_TRANSIT' : 'PICKED';
    beginDock(sim, t, d);
    return { ok: true, message: `${t.id} assigned to ${d.label}.` };
  }
  if (action.type === 'PARK' || action.type === 'MAINTENANCE') {
    const slot = sim.parking.find(
      (p) => p.warehouseId === t.warehouseId && (!p.truckId || p.truckId === t.id),
    );
    if (!slot) return { ok: false, message: 'No parking slot is available.' };
    suspendShipment(sim, t);
    if (action.type === 'MAINTENANCE' && t.state === 'APARCADO') {
      t.intent = 'MAINTENANCE';
      transitionTruck(t, 'MANTENIMIENTO');
    } else beginParking(sim, t, action.type === 'MAINTENANCE');
    return {
      ok: true,
      message: `${t.id} ${action.type === 'PARK' ? 'is moving to parking' : 'is entering maintenance'}. Active cargo is preserved.`,
    };
  }
  if (action.type === 'RELEASE') {
    if (t.state !== 'MANTENIMIENTO') return { ok: false, message: 'Truck is not in maintenance.' };
    t.delayUntil = 0;
    beginParking(sim, t);
    return {
      ok: true,
      message: `${t.id} released to parking. Assign a dock to resume its shipment.`,
    };
  }
  if (action.type === 'DEPART') {
    if (
      action.destinationId === t.warehouseId ||
      !sim.warehouses.some((w) => w.id === action.destinationId)
    )
      return { ok: false, message: 'Choose a different destination hub.' };
    const s = shipmentFor(sim, t);
    if (s && t.cargo.length < s.palletCount && t.warehouseId === s.originId)
      return { ok: false, message: 'Finish loading before departing.' };
    if (s) {
      s.destinationId = action.destinationId;
      if (s.status === 'ON_HOLD') markShipment(sim, s, 'LOADED');
    }
    t.destinationId = action.destinationId;
    beginDeparture(sim, t);
    return {
      ok: true,
      message: `${t.id} departing for ${sim.warehouses.find((w) => w.id === action.destinationId)?.city}.`,
    };
  }
  return { ok: false, message: 'Action unavailable.' };
}
function automaticDispatch(sim: Simulation): void {
  if (activeShipments(sim).length >= CONFIG.maxActiveShipments) return;
  const t = sim.trucks
    .filter(
      (t) =>
        t.id !== 'TRK-01' &&
        !t.paused &&
        ['APARCADO', 'EN_MUELLE'].includes(t.state) &&
        !t.shipmentId &&
        !yardBusy(sim, t.warehouseId, t.id),
    )
    .sort((a, b) => a.lastAdvanceAt - b.lastAdvanceAt || a.id.localeCompare(b.id))[0];
  if (!t?.warehouseId || yardBusy(sim, t.warehouseId, t.id)) return;
  const count = sim.pallets.filter(
    (p) => p.warehouseId === t.warehouseId && p.location === 'RACK',
  ).length;
  if (count < 2) return;
  const destinations = sim.warehouses.filter(
    (w) =>
      w.id !== t.warehouseId &&
      sim.pallets.filter((p) => p.warehouseId === w.id && p.location !== 'TRUCK').length <
        w.capacity - 6,
  );
  if (!destinations.length) return;
  const destination = destinations[Math.floor(random(sim) * destinations.length)];
  createShipment(
    sim,
    t.warehouseId,
    destination.id,
    ['Helio Manufacturing', 'Northline Works', 'Cirrus Supply', 'Solstice Devices'][
      Math.floor(random(sim) * 4)
    ],
    Math.min(count, t.capacity, 2 + Math.floor(random(sim) * 3)),
    'NORMAL',
    t.id,
  );
}
function randomEvent(sim: Simulation): void {
  const kind = Math.floor(random(sim) * 4);
  if (kind === 0) {
    const t = sim.trucks.find((t) => t.state === 'EN_RUTA');
    if (t) {
      t.delayUntil = sim.time + 8 + random(sim) * 10;
      const edge = ROAD_GRAPH.edges.find((e) => e.id === 'n12>n22')!;
      sim.closures.push({ warehouseId: t.destinationId, edgeId: edge.id, until: sim.time + 24 });
      sim.lastEvent = 'traffic';
      addAlert(
        sim,
        'warning',
        'Traffic slowdown',
        `${t.id} · brief congestion on the access corridor.`,
        { kind: 'truck', id: t.id },
      );
    }
  } else if (kind === 1) {
    const t = sim.trucks.find((t) => t.state === 'EN_RUTA');
    if (t) {
      transitionTruck(t, 'MANTENIMIENTO');
      t.delayUntil = sim.time + 12;
      sim.lastEvent = 'breakdown';
      addAlert(
        sim,
        'warning',
        'Truck diagnostics',
        `${t.id} · roadside check. Auto recovery in 12 seconds.`,
        { kind: 'truck', id: t.id },
      );
    }
  } else if (kind === 2) {
    const f = sim.forklifts[Math.floor(random(sim) * sim.forklifts.length)];
    f.battery = 12;
    sim.lastEvent = 'battery';
    addAlert(
      sim,
      'warning',
      'Forklift battery low',
      `${f.id} will recharge after the current pallet transfer.`,
      { kind: 'forklift', id: f.id },
    );
  } else {
    const d = sim.docks.find((d) => !d.truckId);
    if (d) {
      d.blockedUntil = sim.time + 18;
      sim.lastEvent = 'dock';
      addAlert(
        sim,
        'warning',
        'Temporary dock closure',
        `${d.label} · safety inspection for 18 seconds.`,
        { kind: 'dock', id: d.id },
      );
    }
  }
}
export function tickSimulation(sim: Simulation, dt: number = CONFIG.tickSeconds): void {
  sim.time += dt;
  tickTraffic(sim, dt);
  for (const t of sim.trucks) {
    if (
      t.state === 'MANTENIMIENTO' &&
      !t.warehouseId &&
      t.delayUntil > 0 &&
      sim.time >= t.delayUntil
    ) {
      t.delayUntil = 0;
      transitionTruck(t, 'EN_RUTA');
    }
    updateTruck(sim, t, dt);
  }
  for (const f of sim.forklifts) updateForklift(sim, f, dt);
  if (sim.time >= sim.nextDispatchAt) {
    sim.nextDispatchAt = sim.time + CONFIG.dispatchInterval;
    automaticDispatch(sim);
  }
  if (sim.time >= sim.nextEventAt) {
    sim.nextEventAt = sim.time + CONFIG.eventInterval + random(sim) * 60;
    randomEvent(sim);
  }
  // Bounded history, no unbounded event or shipment accumulation.
  if (sim.shipments.length > CONFIG.maxHistory) {
    const removable = sim.shipments.findIndex((s) => s.status === 'DELIVERED');
    if (removable >= 0) sim.shipments.splice(removable, 1);
  }
}
export function validateInvariants(sim: Simulation): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(sim.time) || sim.time < 0) errors.push('Invalid clock.');
  if (sim.traffic.length !== sim.warehouses.length * CONFIG.trafficPerHub)
    errors.push('Invalid traffic count.');
  if (sim.trucks.length !== CONFIG.fleetSize)
    errors.push('Fleet size differs from configured profile.');
  if (sim.forklifts.length !== CONFIG.forkliftCount)
    errors.push('Forklift count differs from configured profile.');
  if (new Set(sim.trucks.map((t) => t.id)).size !== sim.trucks.length)
    errors.push('Duplicate truck IDs.');
  if (activeShipments(sim).length > CONFIG.maxActiveShipments)
    errors.push('Too many active shipments.');
  if (sim.pallets.length !== sim.initialPallets) errors.push('Pallet conservation violated.');
  for (const w of sim.warehouses) {
    if (
      !Number.isFinite(w.map.x) ||
      !Number.isFinite(w.map.z) ||
      !Number.isFinite(w.capacity) ||
      w.capacity <= 0 ||
      !/^#[0-9a-fA-F]{6}$/.test(w.accent)
    )
      errors.push(`Invalid warehouse ${w.id}`);
    const stored = sim.pallets.filter((p) => p.warehouseId === w.id && p.location === 'RACK');
    if (new Set(stored.map((p) => p.rackIndex)).size !== stored.length)
      errors.push(`Duplicate rack slot ${w.id}`);

    if (
      sim.pallets.filter((p) => p.warehouseId === w.id && p.location !== 'TRUCK').length >
      w.capacity
    )
      errors.push(`Warehouse capacity exceeded ${w.id}`);
  }
  for (const a of [...sim.traffic, ...sim.trucks.flatMap((t) => (t.road ? [t.road] : []))]) {
    const edge = roadEdge(a.nodes[a.index], a.nodes[a.index + 1]);
    if (
      !edge ||
      !Number.isFinite(a.speed) ||
      !Number.isFinite(a.distance) ||
      a.distance < 0 ||
      a.distance > (edge?.length ?? 0) + 0.01 ||
      !Number.isInteger(a.index) ||
      a.nodes.length < 2 ||
      a.nodes.some((id) => !ROAD_GRAPH.nodes.some((n) => n.id === id)) ||
      a.nodes
        .slice(1)
        .some((id, i) => !ROAD_GRAPH.edges.some((e) => e.from === a.nodes[i] && e.to === id)) ||
      a.index < 0 ||
      a.index >= a.nodes.length - 1 ||
      !Number.isFinite(a.position.x) ||
      !Number.isFinite(a.position.z)
    )
      errors.push(`Invalid road agent ${a.id}`);
  }
  if (!['clear', 'rain', 'fog'].includes(sim.weather)) errors.push('Invalid weather.');
  for (const f of sim.forklifts) {
    if (!Number.isFinite(f.speed)) errors.push(`Invalid forklift speed ${f.id}`);
  }
  for (const p of sim.pallets) {
    if (
      p.location === 'TRUCK' &&
      !sim.trucks.some((t) => t.id === p.ownerId && t.cargo.includes(p.id))
    )
      errors.push(`Orphan truck pallet ${p.id}`);
    if (
      p.location === 'FORKLIFT' &&
      !sim.forklifts.some((f) => f.id === p.ownerId && f.palletId === p.id)
    )
      errors.push(`Orphan forklift pallet ${p.id}`);
  }
  for (const t of sim.trucks) {
    if (!Number.isFinite(t.fuel) || !Number.isFinite(t.kilometers) || typeof t.paused !== 'boolean')
      errors.push(`Invalid telemetry ${t.id}`);
    if (!Object.keys(TRANSITIONS).includes(t.state)) errors.push(`Invalid truck state ${t.id}`);
    if (!Number.isFinite(t.position.x) || !Number.isFinite(t.position.z))
      errors.push(`Invalid position ${t.id}`);
    if (t.cargo.length > t.capacity) errors.push(`Over capacity ${t.id}`);
    if (t.dockId && !sim.docks.some((d) => d.id === t.dockId && d.truckId === t.id))
      errors.push(`Lost dock reservation ${t.id}`);
    if (t.parkingId && !sim.parking.some((p) => p.id === t.parkingId && p.truckId === t.id))
      errors.push(`Lost parking reservation ${t.id}`);
  }
  return errors;
}
export function shipmentProgress(sim: Simulation, s: Shipment): number {
  if (s.status === 'DELIVERED') return 1;
  const t = sim.trucks.find((t) => t.id === s.truckId);
  if (!t) return 0;
  if (t.warehouseId === s.destinationId && t.state === 'DESCARGANDO')
    return 0.82 + 0.18 * clamp(t.transferCount / s.palletCount, 0, 1);
  if (s.status === 'IN_TRANSIT' || s.status === 'LOADED') return 0.4 + 0.4 * t.routeProgress;
  return 0.08 + 0.3 * clamp(t.cargo.length / s.palletCount, 0, 1);
}
