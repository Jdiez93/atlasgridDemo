import type { KPIs, Simulation, WarehouseId } from './types';
export const activeShipments = (sim: Simulation) =>
  sim.shipments.filter((s) => s.status !== 'DELIVERED');
export function calculateKPIs(sim: Simulation, warehouseId?: WarehouseId): KPIs {
  const stock = sim.pallets.filter(
    (p) => p.location === 'RACK' && (!warehouseId || p.warehouseId === warehouseId),
  ).length;
  const onSite = sim.trucks.filter(
    (t) => t.warehouseId !== null && (!warehouseId || t.warehouseId === warehouseId),
  ).length;
  const fleet = sim.trucks;
  const parked = fleet.filter((t) => t.state === 'APARCADO').length;
  const inRoute = fleet.filter((t) =>
    ['EN_RUTA', 'EN_PUERTA', 'MANIOBRANDO', 'SALIENDO'].includes(t.state),
  ).length;
  const atDock = fleet.filter((t) =>
    ['EN_MUELLE', 'CARGANDO', 'DESCARGANDO'].includes(t.state),
  ).length;
  const maintenance = fleet.filter((t) => t.state === 'MANTENIMIENTO').length;
  const capacity = sim.warehouses
    .filter((w) => !warehouseId || w.id === warehouseId)
    .reduce((n, w) => n + w.capacity, 0);
  return {
    stock,
    onSite,
    onTime: sim.delivered ? Math.round((100 * sim.onTime) / sim.delivered) : 100,
    occupancy: Math.round((stock / capacity) * 100),
    parked,
    inRoute,
    atDock,
    maintenance,
    total: parked + inRoute + atDock + maintenance,
    activeShipments: activeShipments(sim).length,
    delivered: sim.delivered,
  };
}
