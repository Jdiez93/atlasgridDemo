import type { RoadAgent, RoadClosure } from '../world/roads';
export type WarehouseId = string;
export interface Point {
  x: number;
  z: number;
}
export interface Waypoint extends Point {
  reverse?: boolean;
}
export type TruckState =
  | 'EN_RUTA'
  | 'EN_PUERTA'
  | 'MANIOBRANDO'
  | 'EN_MUELLE'
  | 'CARGANDO'
  | 'DESCARGANDO'
  | 'SALIENDO'
  | 'APARCADO'
  | 'MANTENIMIENTO';
export type ForkliftState =
  | 'IDLE'
  | 'TO_RACK'
  | 'PICKING'
  | 'TO_TRUCK'
  | 'DROPPING'
  | 'TO_STORAGE'
  | 'TO_CHARGER'
  | 'CHARGING';
export type ShipmentStatus =
  | 'CONFIRMED'
  | 'PICKED'
  | 'LOADED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'ON_HOLD';
export type EntityKind =
  | 'truck'
  | 'forklift'
  | 'pallet'
  | 'dock'
  | 'warehouse'
  | 'charger'
  | 'parking'
  | 'shipment';
export interface Selection {
  kind: EntityKind;
  id: string;
}
export interface Warehouse {
  id: WarehouseId;
  name: string;
  city: string;
  code: string;
  capacity: number;
  map: Point;
  temperature: string;
  variant: 'hub' | 'crossdock' | 'cold' | 'port' | 'air';
  accent: string;
}
export interface Dock {
  id: string;
  warehouseId: WarehouseId;
  label: string;
  direction: 'IN' | 'OUT';
  position: Point;
  truckId: string | null;
  blockedUntil: number;
}
export interface ParkingSlot {
  id: string;
  warehouseId: WarehouseId;
  label: string;
  position: Point;
  truckId: string | null;
}
export interface Charger {
  id: string;
  warehouseId: WarehouseId;
  position: Point;
  forkliftId: string | null;
}
export interface Truck {
  id: string;
  driver: string;
  plate: string;
  state: TruckState;
  warehouseId: WarehouseId | null;
  originId: WarehouseId;
  destinationId: WarehouseId;
  position: Point;
  yaw: number;
  speed: number;
  path: Waypoint[];
  pathIndex: number;
  stateTime: number;
  routeProgress: number;
  routeDuration: number;
  cargo: string[];
  capacity: number;
  dockId: string | null;
  parkingId: string | null;
  shipmentId: string | null;
  lastAdvanceAt: number;
  delayUntil: number;
  intent: 'SHIPMENT' | 'PARK' | 'MAINTENANCE' | 'DEPART';
  targetDockId: string | null;
  transferCount: number;
  stopReason: string | null;
  kind: 'TRUCK' | 'VAN';
  fuel: number;
  paused: boolean;
  road: RoadAgent | null;
  kilometers: number;
}
export interface Forklift {
  id: string;
  warehouseId: WarehouseId;
  state: ForkliftState;
  position: Point;
  yaw: number;
  speed: number;
  battery: number;
  palletId: string | null;
  truckId: string | null;
  stateTime: number;
  chargerId: string;
  task: 'LOAD' | 'UNLOAD' | null;
  distance: number;
}
export interface Pallet {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  weight: number;
  warehouseId: WarehouseId;
  location: 'RACK' | 'FORKLIFT' | 'TRUCK';
  rackIndex: number;
  ownerId: string | null;
  lot: string;
  receivedAt: string;
}
export interface TimelineEntry {
  stage: Exclude<ShipmentStatus, 'ON_HOLD'>;
  time: number;
}
export interface Shipment {
  id: string;
  originId: WarehouseId;
  destinationId: WarehouseId;
  client: string;
  status: ShipmentStatus;
  truckId: string;
  palletCount: number;
  eta: number;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  createdAt: number;
  deliveredAt: number | null;
  timeline: TimelineEntry[];
}
export interface Alert {
  id: number;
  time: number;
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  entity: Selection | null;
}
export interface Simulation {
  version: number;
  time: number;
  rng: number;
  nextShipment: number;
  nextPallet: number;
  nextAlert: number;
  nextEventAt: number;
  nextDispatchAt: number;
  warehouses: Warehouse[];
  docks: Dock[];
  parking: ParkingSlot[];
  chargers: Charger[];
  trucks: Truck[];
  forklifts: Forklift[];
  pallets: Pallet[];
  shipments: Shipment[];
  alerts: Alert[];
  delivered: number;
  onTime: number;
  initialPallets: number;
  watchdogResets: number;
  lastEvent: string | null;
  traffic: RoadAgent[];
  closures: RoadClosure[];
  weather: 'clear' | 'rain' | 'fog';
}
export interface KPIs {
  stock: number;
  onSite: number;
  onTime: number;
  occupancy: number;
  parked: number;
  inRoute: number;
  atDock: number;
  maintenance: number;
  total: number;
  activeShipments: number;
  delivered: number;
}
export type PlayerAction =
  | { type: 'PAUSE_TRUCK'; truckId: string }
  | { type: 'ALTERNATE_ROUTE'; truckId: string }
  | { type: 'ASSIGN_DOCK'; truckId: string; dockId: string }
  | { type: 'PARK'; truckId: string }
  | { type: 'DEPART'; truckId: string; destinationId: WarehouseId }
  | { type: 'MAINTENANCE'; truckId: string }
  | { type: 'RELEASE'; truckId: string }
  | {
      type: 'CREATE_SHIPMENT';
      originId: WarehouseId;
      destinationId: WarehouseId;
      client: string;
      palletCount: number;
      priority: Shipment['priority'];
    }
  | { type: 'PRIORITY'; shipmentId: string; priority: Shipment['priority'] }
  | { type: 'REASSIGN_FORKLIFT'; forkliftId: string; truckId: string }
  | { type: 'CHARGE'; forkliftId: string }
  | { type: 'UNBLOCK_DOCK'; dockId: string };
export interface ActionResult {
  ok: boolean;
  message: string;
  selection?: Selection;
}
