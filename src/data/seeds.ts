import { CONFIG } from '../lib/config';
import { AMBIENT_LOOP, ROUNDABOUT_LOOP, makeRoadAgent } from '../world/roads';
import type { Pallet, Simulation, Truck, Warehouse } from '../sim/types';
export const WAREHOUSES: Warehouse[] = [
  {
    id: 'riverside',
    name: 'Riverside Hub',
    city: 'Rotterdam',
    code: 'RTM',
    capacity: 60,
    map: { x: -9, z: -23 },
    temperature: 'Ambient · 19°C',
    variant: 'port',
    accent: '#10B981',
  },
  {
    id: 'southfield',
    name: 'Southfield Cross-Dock',
    city: 'Madrid',
    code: 'MAD',
    capacity: 48,
    map: { x: -22, z: -5 },
    temperature: 'Ambient · 23°C',
    variant: 'crossdock',
    accent: '#F5A524',
  },
  {
    id: 'eastport',
    name: 'Eastport Cold Chain',
    city: 'Singapore',
    code: 'SIN',
    capacity: 42,
    map: { x: 56, z: 25 },
    temperature: 'Cold chain · 4°C',
    variant: 'cold',
    accent: '#22D3EE',
  },
  {
    id: 'northgate',
    name: 'Northgate Freight',
    city: 'Hamburg',
    code: 'HAM',
    capacity: 54,
    map: { x: 8, z: -28 },
    temperature: 'Ambient · 16°C',
    variant: 'hub',
    accent: '#14B8A6',
  },
  {
    id: 'jade',
    name: 'Jade River Terminal',
    city: 'Shanghai',
    code: 'SHA',
    capacity: 60,
    map: { x: 66, z: -6 },
    temperature: 'Ambient · 22°C',
    variant: 'port',
    accent: '#10B981',
  },
  {
    id: 'dune',
    name: 'Dune Air Gateway',
    city: 'Dubai',
    code: 'DXB',
    capacity: 36,
    map: { x: 25, z: 8 },
    temperature: 'Controlled · 20°C',
    variant: 'air',
    accent: '#F5A524',
  },
  {
    id: 'pacific',
    name: 'Pacific Crest Hub',
    city: 'Los Angeles',
    code: 'LAX',
    capacity: 48,
    map: { x: -67, z: -7 },
    temperature: 'Ambient · 24°C',
    variant: 'crossdock',
    accent: '#14B8A6',
  },
  {
    id: 'verde',
    name: 'Verde Logistics Park',
    city: 'São Paulo',
    code: 'GRU',
    capacity: 30,
    map: { x: -40, z: 35 },
    temperature: 'Ambient · 25°C',
    variant: 'hub',
    accent: '#10B981',
  },
];
export const SKUS = [
  { sku: 'ATL-001', name: 'Safety Helmet', quantity: 48, weight: 92 },
  { sku: 'ATL-002', name: 'LED Panel', quantity: 24, weight: 174 },
  { sku: 'ATL-003', name: 'Precision Valve', quantity: 80, weight: 248 },
  { sku: 'ATL-004', name: 'Thermal Sensor', quantity: 120, weight: 64 },
  { sku: 'ATL-005', name: 'Cooling Module', quantity: 16, weight: 310 },
  { sku: 'ATL-006', name: 'Cargo Seal', quantity: 200, weight: 38 },
];
export function createInitialSimulation(seed: number = CONFIG.seed): Simulation {
  const warehouses = structuredClone(WAREHOUSES);
  const docks = warehouses.flatMap((w) =>
    [-12, -4, 4, 12].map((x, i) => ({
      id: `${w.id}:dock:${i}`,
      warehouseId: w.id,
      label: `Dock ${i < 2 ? 'In' : 'Out'} ${(i % 2) + 1}`,
      direction: i < 2 ? ('IN' as const) : ('OUT' as const),
      position: { x, z: 8 },
      truckId: null as string | null,
      blockedUntil: 0,
    })),
  );
  const parking = warehouses.flatMap((w) =>
    [24, 32].map((x, i) => ({
      id: `${w.id}:park:${i}`,
      warehouseId: w.id,
      label: `P${String(i + 1).padStart(2, '0')}`,
      position: { x, z: 14 },
      truckId: null as string | null,
    })),
  );
  const chargers = warehouses.map((w) => ({
    id: `${w.id}:charger`,
    warehouseId: w.id,
    position: { x: -21, z: -10 },
    forkliftId: null as string | null,
  }));
  const pallets: Pallet[] = warehouses.flatMap((w, wi) =>
    Array.from({ length: [43, 35, 31, 38, 40, 24, 32, 22][wi] }, (_, i) => ({
      id: `PLT-${String(wi * 100 + i + 1).padStart(4, '0')}`,
      ...SKUS[i % SKUS.length],
      warehouseId: w.id,
      location: 'RACK' as const,
      rackIndex: i,
      ownerId: null,
      lot: `LOT-26${String(100 + wi * 10 + (i % 10))}`,
      receivedAt: `2026-10-${String(1 + (i % 5)).padStart(2, '0')}`,
    })),
  );
  const base: Omit<Truck, 'id' | 'driver' | 'plate'> = {
    state: 'APARCADO',
    warehouseId: 'riverside',
    originId: 'riverside',
    destinationId: 'southfield',
    position: { x: 24, z: 14 },
    yaw: 0,
    speed: 0,
    path: [],
    pathIndex: 0,
    stateTime: 0,
    routeProgress: 0,
    routeDuration: 85,
    cargo: [],
    capacity: 6,
    dockId: null,
    parkingId: null,
    shipmentId: null,
    lastAdvanceAt: 0,
    delayUntil: 0,
    intent: 'PARK',
    targetDockId: null,
    transferCount: 0,
    stopReason: null,
    kind: 'TRUCK',
    fuel: 86,
    paused: false,
    road: null,
    kilometers: 0,
  };
  const trucks: Truck[] = [
    {
      ...structuredClone(base),
      id: 'TRK-01',
      driver: 'Maya Vermeer',
      plate: 'AG-104-RT',
      parkingId: 'riverside:park:0',
    },
    {
      ...structuredClone(base),
      id: 'TRK-02',
      driver: 'Daniel Costa',
      plate: 'AG-208-MD',
      state: 'CARGANDO',
      dockId: 'riverside:dock:2',
      position: { x: 4, z: 8 },
      intent: 'SHIPMENT',
      shipmentId: '#SHP-20481',
    },
    {
      ...structuredClone(base),
      id: 'TRK-03',
      driver: 'Lena Fischer',
      plate: 'AG-316-RT',
      state: 'EN_RUTA',
      warehouseId: null,
      originId: 'southfield',
      destinationId: 'riverside',
      position: { x: 44, z: 30 },
      routeProgress: 0.97,
      routeDuration: 85,
      intent: 'SHIPMENT',
      shipmentId: '#SHP-20482',
    },
    {
      ...structuredClone(base),
      id: 'TRK-04',
      driver: 'Ari Tan',
      plate: 'AG-412-SG',
      state: 'EN_RUTA',
      warehouseId: null,
      originId: 'eastport',
      destinationId: 'southfield',
      position: { x: 44, z: 30 },
      routeProgress: 0.48,
      routeDuration: 105,
      intent: 'PARK',
    },
  ];
  for (let i = 4; i < CONFIG.fleetSize; i++) {
    const origin = warehouses[i % warehouses.length],
      destination = warehouses[(i + 3) % warehouses.length];
    const id = `TRK-${String(i + 1).padStart(2, '0')}`;
    const parked = i >= 26;
    const slot = parking.find((p) => p.warehouseId === origin.id && !p.truckId)!;
    const truck: Truck = {
      ...structuredClone(base),
      id,
      driver: [
        'Noah Silva',
        'Amira Haddad',
        'Kai Zhou',
        'Sofia Morales',
        'Emil Jensen',
        'Leila Santos',
      ][i % 6],
      plate: `AG-${410 + i}-NW`,
      kind: i % 4 === 0 ? 'VAN' : 'TRUCK',
      capacity: i % 4 === 0 ? 3 : 6,
      fuel: 65 + (i % 31),
      state: parked ? 'APARCADO' : 'EN_RUTA',
      warehouseId: parked ? origin.id : null,
      originId: origin.id,
      destinationId: destination.id,
      position: parked ? { ...slot.position } : { x: 100 + i * 11, z: 32 },
      routeProgress: 0.12 + ((i * 17) % 78) / 100,
      routeDuration: 85 + (i % 4) * 10,
      parkingId: parked ? slot.id : null,
      intent: parked ? 'PARK' : 'SHIPMENT',
      shipmentId: parked ? null : `#SHP-${20483 + i - 4}`,
    };
    if (parked) slot.truckId = id;
    trucks.push(truck);
  }
  parking[0].truckId = 'TRK-01';
  docks.find((d) => d.id === 'riverside:dock:2')!.truckId = 'TRK-02';
  const cargo = pallets.filter((p) => p.warehouseId === 'southfield').slice(0, 4);
  cargo.forEach((p) => {
    p.location = 'TRUCK';
    p.ownerId = 'TRK-03';
  });
  trucks[2].cargo = cargo.map((p) => p.id);
  const forklifts = warehouses.map((w, i) => ({
    id: `FLT-0${i + 1}`,
    warehouseId: w.id,
    state: 'IDLE' as const,
    position: { x: -18, z: -3 },
    yaw: 0,
    speed: 0,
    battery: 62 + ((i * 11) % 34),
    palletId: null,
    truckId: null,
    stateTime: 0,
    chargerId: chargers[i].id,
    task: null,
    distance: 0,
  }));
  const expandedShipments = trucks
    .slice(4)
    .filter((t) => t.shipmentId)
    .map((t) => {
      const loaded = pallets
        .filter((p) => p.warehouseId === t.originId && p.location === 'RACK')
        .slice(-2);
      loaded.forEach((p) => {
        p.location = 'TRUCK';
        p.ownerId = t.id;
      });
      t.cargo = loaded.map((p) => p.id);
      return {
        id: t.shipmentId!,
        originId: t.originId,
        destinationId: t.destinationId,
        client: ['Helio Manufacturing', 'Northline Works', 'Cirrus Supply', 'Solstice Devices'][
          Number(t.id.slice(-2)) % 4
        ],
        status: 'IN_TRANSIT' as const,
        truckId: t.id,
        palletCount: 2,
        eta: 330,
        priority: 'NORMAL' as const,
        createdAt: 0,
        deliveredAt: null,
        timeline: [
          { stage: 'CONFIRMED' as const, time: 0 },
          { stage: 'PICKED' as const, time: 0 },
          { stage: 'LOADED' as const, time: 0 },
          { stage: 'IN_TRANSIT' as const, time: 0 },
        ],
      };
    });
  return {
    version: CONFIG.schemaVersion,
    time: 0,
    rng: seed,
    nextShipment: 20520,
    nextPallet: 1000,
    nextAlert: 2,
    nextEventAt: CONFIG.eventInterval,
    nextDispatchAt: 2,
    warehouses,
    docks,
    parking,
    chargers,
    trucks,
    forklifts,
    pallets,
    shipments: [
      {
        id: '#SHP-20481',
        originId: 'riverside',
        destinationId: 'southfield',
        client: 'Helio Manufacturing',
        status: 'PICKED',
        truckId: 'TRK-02',
        palletCount: 3,
        eta: 300,
        priority: 'HIGH',
        createdAt: 0,
        deliveredAt: null,
        timeline: [
          { stage: 'CONFIRMED', time: 0 },
          { stage: 'PICKED', time: 0 },
        ],
      },
      {
        id: '#SHP-20482',
        originId: 'southfield',
        destinationId: 'riverside',
        client: 'Northline Works',
        status: 'IN_TRANSIT',
        truckId: 'TRK-03',
        palletCount: 4,
        eta: 100,
        priority: 'NORMAL',
        createdAt: 0,
        deliveredAt: null,
        timeline: [
          { stage: 'CONFIRMED', time: 0 },
          { stage: 'PICKED', time: 0 },
          { stage: 'LOADED', time: 0 },
          { stage: 'IN_TRANSIT', time: 0 },
        ],
      },
      ...expandedShipments,
    ],
    traffic: warehouses.flatMap((w) =>
      Array.from({ length: CONFIG.trafficPerHub }, (_, i) =>
        makeRoadAgent(
          `AMB-${w.code}-${i}`,
          w.id,
          i >= CONFIG.trafficPerHub - 3 ? ROUNDABOUT_LOOP : AMBIENT_LOOP,
          i % 3 === 0 ? 'VAN' : 'CAR',
          i / CONFIG.trafficPerHub,
          true,
        ),
      ),
    ),
    closures: [],
    weather: 'clear',
    alerts: [
      {
        id: 1,
        time: 0,
        severity: 'info',
        title: 'Control room online',
        message: `8 hubs connected. 30 fleet vehicles, 8 forklifts and ${8 * CONFIG.trafficPerHub} ambient vehicles ready.`,
        read: true,
        entity: null,
      },
    ],
    delivered: 0,
    onTime: 0,
    initialPallets: pallets.length,
    watchdogResets: 0,
    lastEvent: null,
  };
}
