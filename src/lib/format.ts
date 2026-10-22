import { CONFIG } from './config';
import type { TruckState, ForkliftState, Simulation, Selection, Point } from '../sim/types';
import { rackPosition } from '../sim/math';
export const truckLabels: Record<TruckState, string> = {
  EN_RUTA: 'In transit',
  EN_PUERTA: 'At gate',
  MANIOBRANDO: 'Maneuvering',
  EN_MUELLE: 'At dock',
  CARGANDO: 'Loading',
  DESCARGANDO: 'Unloading',
  SALIENDO: 'Departing',
  APARCADO: 'Parked',
  MANTENIMIENTO: 'Maintenance',
};
export const forkliftLabels: Record<ForkliftState, string> = {
  IDLE: 'Available',
  TO_RACK: 'Collecting pallet',
  PICKING: 'Picking',
  TO_TRUCK: 'To truck',
  DROPPING: 'Placing pallet',
  TO_STORAGE: 'To storage',
  TO_CHARGER: 'To charger',
  CHARGING: 'Charging',
};
export const statusTone = (state: string): 'green' | 'amber' | 'red' | 'cyan' =>
  state === 'MANTENIMIENTO'
    ? 'red'
    : ['EN_RUTA', 'SALIENDO', 'IN_TRANSIT'].includes(state)
      ? 'cyan'
      : ['CARGANDO', 'DESCARGANDO', 'MANIOBRANDO', 'CHARGING', 'ON_HOLD'].includes(state)
        ? 'amber'
        : 'green';
export function clock(time: number): string {
  const minutes = Math.floor(CONFIG.startClockMinutes + time * CONFIG.simulationMinutesPerSecond);
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
export const eta = (time: number, now: number) =>
  `${Math.max(0, Math.ceil((time - now) * CONFIG.simulationMinutesPerSecond))} min`;
export function entityPosition(sim: Simulation, selection: Selection | null): Point {
  if (!selection) return { x: 0, z: 4 };
  if (selection.kind === 'truck')
    return sim.trucks.find((t) => t.id === selection.id)?.position ?? { x: 0, z: 4 };
  if (selection.kind === 'forklift')
    return sim.forklifts.find((t) => t.id === selection.id)?.position ?? { x: 0, z: 4 };
  if (selection.kind === 'dock')
    return sim.docks.find((t) => t.id === selection.id)?.position ?? { x: 0, z: 4 };
  if (selection.kind === 'parking')
    return sim.parking.find((t) => t.id === selection.id)?.position ?? { x: 0, z: 4 };
  if (selection.kind === 'charger')
    return sim.chargers.find((t) => t.id === selection.id)?.position ?? { x: 0, z: 4 };
  if (selection.kind === 'pallet') {
    const p = sim.pallets.find((t) => t.id === selection.id);
    if (p) {
      if (p.ownerId && p.location === 'TRUCK')
        return sim.trucks.find((t) => t.id === p.ownerId)?.position ?? rackPosition(p.rackIndex);
      if (p.ownerId && p.location === 'FORKLIFT')
        return sim.forklifts.find((t) => t.id === p.ownerId)?.position ?? rackPosition(p.rackIndex);
      return rackPosition(p.rackIndex);
    }
  }
  return { x: 0, z: 4 };
}
