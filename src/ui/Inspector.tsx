import { useState } from 'react';
import {
  BatteryCharging,
  ChevronRight,
  Expand,
  LocateFixed,
  Package,
  Truck as TruckIcon,
  X,
  Navigation,
  ArrowUpRight,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import { useAtlasStore } from '../store/useAtlasStore';
import { calculateKPIs } from '../sim/kpis';
import { shipmentProgress } from '../sim/engine';
import { clock, eta, forkliftLabels, statusTone, truckLabels } from '../lib/format';
import type { Selection, Shipment } from '../sim/types';
import {
  Badge,
  Empty,
  Field,
  IconButton,
  Panel,
  PanelHeader,
  Progress,
  SelectField,
} from './shared';
export function Inspector() {
  const selection = useAtlasStore((s) => s.selection);
  const select = useAtlasStore((s) => s.select);
  const camera = useAtlasStore((s) => s.cameraAct);
  const [expanded, setExpanded] = useState(false);
  return (
    <Panel className={`inspector ${expanded ? 'expanded' : ''}`} label="Entity inspector">
      <PanelHeader
        title={selection ? 'Asset inspector' : 'Hub overview'}
        meta={
          selection ? `${selection.kind.toUpperCase()} / LIVE TELEMETRY` : 'RT CONTROL / CONNECTED'
        }
      >
        {selection && (
          <>
            <IconButton label="Center inspected entity" onClick={() => camera('center')}>
              <LocateFixed size={15} />
            </IconButton>
            <IconButton label="Expand inspector" onClick={() => setExpanded(!expanded)}>
              <Expand size={14} />
            </IconButton>
            <IconButton label="Close inspector" onClick={() => select(null)}>
              <X size={16} />
            </IconButton>
          </>
        )}
      </PanelHeader>
      <div className="inspector-body">
        {selection ? (
          <EntityDetails key={`${selection.kind}:${selection.id}`} selection={selection} />
        ) : (
          <HubOverview />
        )}
      </div>
    </Panel>
  );
}
function HubOverview() {
  const sim = useAtlasStore((s) => s.sim);
  const id = useAtlasStore((s) => s.warehouseId);
  const view = useAtlasStore((s) => s.view);
  const select = useAtlasStore((s) => s.setWarehouse);
  const k = calculateKPIs(sim, view === 'world' ? undefined : id);
  const w = sim.warehouses.find((w) => w.id === id)!;
  const docks = sim.docks.filter((d) => d.warehouseId === id);
  const available = docks.filter((d) => !d.truckId && d.blockedUntil <= sim.time).length;
  return (
    <div className="hub-overview">
      <div className="overview-title">
        <span className="entity-icon">
          <WarehouseIcon size={22} />
        </span>
        <div>
          <h3>{view === 'world' ? 'AtlasGrid network' : w.name}</h3>
          <p>{view === 'world' ? 'Europe / Asia Pacific' : w.city}</p>
        </div>
      </div>
      <div className="occupancy-header">
        <span>Storage occupancy</span>
        <b className="mono">{k.occupancy}%</b>
      </div>
      <Progress value={k.occupancy / 100} />
      <div className="overview-stats">
        <div>
          <b className="mono">{view === 'world' ? 12 : available}</b>
          <span>{view === 'world' ? 'total docks' : 'free docks'}</span>
        </div>
        <div>
          <b className="mono">{view === 'world' ? 3 : 1}</b>
          <span>forklifts</span>
        </div>
        <div>
          <b className="mono">{k.activeShipments}</b>
          <span>active loads</span>
        </div>
      </div>
      {view === 'world' ? (
        <div className="network-links">
          {sim.warehouses.map((w) => (
            <button key={w.id} onClick={() => select(w.id)}>
              <span>
                {w.code} <b>{w.city}</b>
              </span>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </div>
      ) : (
        <>
          <Field label="Environment" value={w.temperature} />
          <div className="select-hint">
            <LocateFixed size={15} />
            <span>Select an asset in the scene to inspect and control it.</span>
          </div>
        </>
      )}
    </div>
  );
}
export function EntityDetails({
  selection,
  compact = false,
}: {
  selection: Selection;
  compact?: boolean;
}) {
  const sim = useAtlasStore((s) => s.sim);
  const select = useAtlasStore((s) => s.select);
  const s = selection;
  if (s.kind === 'truck') {
    const t = sim.trucks.find((t) => t.id === s.id);
    if (!t) return <Empty title="Truck unavailable" detail="Choose another asset." />;
    const shipment = sim.shipments.find((sh) => sh.id === t.shipmentId);
    const destination = sim.warehouses.find((w) => w.id === t.destinationId)!;
    return (
      <>
        <EntityTitle
          icon={<TruckIcon size={25} />}
          id={t.id}
          description="AtlasGrid / Freight / regional distribution"
          badge={<Badge label={truckLabels[t.state]} tone={statusTone(t.state)} />}
        />
        {!compact && (
          <>
            <Field label="Driver" value={t.driver} />
            <Field label="License plate" value={t.plate} mono />
            <Field label="Vehicle / fuel" value={`${t.kind} · ${Math.round(t.fuel)}%`} mono />
            <Field label="Regional distance" value={`${t.kilometers.toFixed(1)} km`} mono />
            <button
              className="button"
              onClick={() => useAtlasStore.getState().act({ type: 'PAUSE_TRUCK', truckId: t.id })}
            >
              {t.paused ? 'Resume vehicle' : 'Pause vehicle'}
            </button>
            <button
              className="button"
              disabled={!t.road}
              onClick={() =>
                useAtlasStore.getState().act({ type: 'ALTERNATE_ROUTE', truckId: t.id })
              }
            >
              Use alternative roads
            </button>
            <Field label="Speed" value={`${Math.round(t.speed * 3.6)} km/h`} mono />
            <Field
              label="Current site"
              value={sim.warehouses.find((w) => w.id === t.warehouseId)?.city ?? 'On corridor'}
            />
            <Field label="Destination" value={destination.city} />
            <Field label="Client" value={shipment?.client ?? 'Available for assignment'} />
            <div className="load-progress">
              <span>
                Cargo{' '}
                <b className="mono">
                  {t.cargo.length} / {t.capacity} pallets
                </b>
              </span>
              <Progress value={t.cargo.length / t.capacity} tone="amber" />
            </div>
            {t.stopReason && <div className="notice amber">{t.stopReason}</div>}
            {shipment && (
              <>
                <Field
                  label="Shipment"
                  value={
                    <button
                      className="text-button"
                      onClick={() => select({ kind: 'shipment', id: shipment.id })}
                    >
                      {shipment.id}
                      <ChevronRight size={12} />
                    </button>
                  }
                />
                <Field label="ETA" value={eta(shipment.eta, sim.time)} mono />
              </>
            )}
            {t.cargo.length > 0 && (
              <div className="cargo-chips">
                {t.cargo.map((id) => (
                  <button key={id} onClick={() => select({ kind: 'pallet', id })}>
                    <Package size={10} />
                    {id}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <EntityActions selection={selection} />
      </>
    );
  }
  if (s.kind === 'forklift') {
    const f = sim.forklifts.find((f) => f.id === s.id);
    if (!f) return null;
    const p = sim.pallets.find((p) => p.id === f.palletId);
    return (
      <>
        <EntityTitle
          icon={<BatteryCharging size={25} />}
          id={f.id}
          description="Electric / Counterbalance"
          badge={
            <Badge label={forkliftLabels[f.state]} tone={f.battery < 18 ? 'amber' : 'green'} />
          }
        />
        {!compact && (
          <>
            <div className="load-progress">
              <span>
                Battery <b className="mono">{Math.round(f.battery)}%</b>
              </span>
              <Progress value={f.battery / 100} tone={f.battery < 18 ? 'amber' : 'green'} />
            </div>
            <Field label="Hub" value={sim.warehouses.find((w) => w.id === f.warehouseId)?.city} />
            <Field label="Assigned truck" value={f.truckId ?? 'Unassigned'} mono />
            <Field label="Load on forks" value={p?.location === 'FORKLIFT' ? p.name : 'Empty'} />
            <Field label="Pallet" value={p?.id ?? '—'} mono />
            <Field label="Distance traveled" value={`${Math.round(f.distance)} m`} mono />
          </>
        )}
        <EntityActions selection={selection} />
      </>
    );
  }
  if (s.kind === 'pallet') {
    const p = sim.pallets.find((p) => p.id === s.id);
    if (!p) return null;
    return (
      <>
        <EntityTitle
          icon={<Package size={25} />}
          id={p.id}
          description={p.name}
          badge={
            <Badge
              label={
                p.location === 'RACK'
                  ? 'In storage'
                  : p.location === 'TRUCK'
                    ? 'On truck'
                    : 'On forks'
              }
              tone={p.location === 'RACK' ? 'green' : 'amber'}
            />
          }
        />
        {!compact && (
          <>
            <Field label="SKU" value={p.sku} mono />
            <Field label="Quantity" value={`${p.quantity} units`} mono />
            <Field label="Gross weight" value={`${p.weight} kg`} mono />
            <Field
              label="Storage slot"
              value={
                p.location === 'RACK'
                  ? `Rack ${String((p.rackIndex % 20) + 1).padStart(2, '0')} / Level ${Math.floor(p.rackIndex / 20) + 1}`
                  : p.ownerId
              }
            />
            <Field label="Batch / lot" value={p.lot} mono />
            <Field label="Received" value={p.receivedAt} mono />
            <Field label="Hub" value={sim.warehouses.find((w) => w.id === p.warehouseId)?.name} />
          </>
        )}
        <EntityActions selection={selection} />
      </>
    );
  }
  if (s.kind === 'dock') {
    const d = sim.docks.find((d) => d.id === s.id);
    if (!d) return null;
    const t = sim.trucks.find((t) => t.id === d.truckId);
    const blocked = d.blockedUntil > sim.time;
    return (
      <>
        <EntityTitle
          icon={<WarehouseIcon size={25} />}
          id={d.label}
          description={`${d.direction === 'IN' ? 'Inbound' : 'Outbound'} / Loading bay`}
          badge={
            <Badge
              label={blocked ? 'Blocked' : t ? 'Occupied' : 'Available'}
              tone={blocked ? 'red' : t ? 'amber' : 'green'}
            />
          }
        />
        {!compact && (
          <>
            <Field label="Hub" value={sim.warehouses.find((w) => w.id === d.warehouseId)?.city} />
            <Field
              label="Reserved truck"
              value={
                t ? (
                  <button
                    className="text-button"
                    onClick={() => select({ kind: 'truck', id: t.id }, true)}
                  >
                    {t.id}
                    <ChevronRight size={12} />
                  </button>
                ) : (
                  'None'
                )
              }
            />
            <Field
              label="Current operation"
              value={t ? truckLabels[t.state] : 'Awaiting assignment'}
            />
            {t && (
              <div className="load-progress">
                <span>
                  Truck capacity{' '}
                  <b>
                    {t.cargo.length}/{t.capacity}
                  </b>
                </span>
                <Progress value={t.cargo.length / t.capacity} tone="amber" />
              </div>
            )}
            {blocked && (
              <Field label="Reopens in" value={`${Math.ceil(d.blockedUntil - sim.time)} s`} />
            )}
          </>
        )}
        <EntityActions selection={selection} />
      </>
    );
  }
  if (s.kind === 'shipment') {
    const sh = sim.shipments.find((sh) => sh.id === s.id);
    if (!sh) return null;
    return (
      <>
        <EntityTitle
          icon={<Package size={25} />}
          id={sh.id}
          description={sh.client}
          badge={
            <Badge label={sh.status.replace('_', ' ').toLowerCase()} tone={statusTone(sh.status)} />
          }
        />
        {!compact && (
          <>
            <Field label="Origin" value={sim.warehouses.find((w) => w.id === sh.originId)?.city} />
            <Field
              label="Destination"
              value={sim.warehouses.find((w) => w.id === sh.destinationId)?.city}
            />
            <Field
              label="Truck"
              value={
                <button
                  className="text-button"
                  onClick={() => select({ kind: 'truck', id: sh.truckId }, true)}
                >
                  {sh.truckId}
                  <ChevronRight size={12} />
                </button>
              }
            />
            <Field label="Load" value={`${sh.palletCount} pallets`} />
            <Field
              label="ETA"
              value={sh.status === 'DELIVERED' ? clock(sh.deliveredAt ?? 0) : eta(sh.eta, sim.time)}
              mono
            />
            <Progress value={shipmentProgress(sim, sh)} />
          </>
        )}
        <EntityActions selection={selection} />
      </>
    );
  }
  if (s.kind === 'warehouse')
    return (
      <>
        <HubOverview />
        <EntityActions selection={selection} />
      </>
    );
  if (s.kind === 'parking') {
    const p = sim.parking.find((p) => p.id === s.id);
    if (!p) return null;
    return (
      <>
        <EntityTitle
          icon={<TruckIcon size={24} />}
          id={`Parking ${p.label}`}
          description="Reserved yard slot"
          badge={<Badge label={p.truckId ? 'Occupied' : 'Available'} />}
        />
        <Field label="Truck" value={p.truckId ?? 'None'} />
        <EntityActions selection={selection} />
      </>
    );
  }
  const charger = sim.chargers.find((c) => c.id === s.id);
  return (
    <>
      <EntityTitle
        icon={<BatteryCharging size={25} />}
        id="Forklift charger"
        description="Fast charge / Electric"
        badge={<Badge label={charger?.forkliftId ? 'In use' : 'Available'} tone="cyan" />}
      />
      <Field label="Connected forklift" value={charger?.forkliftId ?? 'None'} />
      <EntityActions selection={selection} />
    </>
  );
}
function EntityTitle({
  icon,
  id,
  description,
  badge,
}: {
  icon: React.ReactNode;
  id: string;
  description: string;
  badge: React.ReactNode;
}) {
  return (
    <div className="entity-title">
      <span className="entity-icon">{icon}</span>
      <div>
        <h3>{id}</h3>
        <p>{description}</p>
      </div>
      {badge}
    </div>
  );
}
export function EntityActions({ selection }: { selection: Selection }) {
  const sim = useAtlasStore((s) => s.sim);
  const act = useAtlasStore((s) => s.act);
  const select = useAtlasStore((s) => s.select);
  const toggle = useAtlasStore((s) => s.toggle);
  const camera = useAtlasStore((s) => s.cameraAct);
  const follow = useAtlasStore((s) => s.toggleFollow);
  const [dock, setDock] = useState('');
  const [target, setTarget] = useState('');
  const [truck, setTruck] = useState('');
  if (selection.kind === 'truck') {
    const t = sim.trucks.find((t) => t.id === selection.id);
    if (!t) return null;
    const dockOptions = sim.docks
      .filter((d) => d.warehouseId === t.warehouseId && !d.truckId && d.blockedUntil <= sim.time)
      .map((d) => ({ value: d.id, label: d.label }));
    const dest = target || t.destinationId;
    return (
      <div className="entity-actions">
        <span className="eyebrow">OPERATIONS</span>
        <div className="inline-control">
          <SelectField
            label="Assign free dock"
            value={dock}
            onChange={setDock}
            options={[{ value: '', label: 'Choose a dock…' }, ...dockOptions]}
          />
          <button
            className="button"
            disabled={!dock || !dockOptions.some((d) => d.value === dock)}
            onClick={() => act({ type: 'ASSIGN_DOCK', truckId: t.id, dockId: dock })}
          >
            Assign
          </button>
        </div>
        <div className="action-grid">
          <button
            className="button subtle"
            disabled={!t.warehouseId || t.state === 'APARCADO'}
            onClick={() => act({ type: 'PARK', truckId: t.id })}
          >
            Send to parking
          </button>
          <button
            className="button subtle"
            onClick={() =>
              act({ type: t.state === 'MANTENIMIENTO' ? 'RELEASE' : 'MAINTENANCE', truckId: t.id })
            }
          >
            {t.state === 'MANTENIMIENTO' ? 'Release truck' : 'Maintenance'}
          </button>
        </div>
        <div className="inline-control">
          <SelectField
            label="Depart to hub"
            value={dest}
            onChange={setTarget}
            options={sim.warehouses
              .filter((w) => w.id !== t.warehouseId)
              .map((w) => ({ value: w.id, label: w.city }))}
          />
          <button
            className="button"
            disabled={!t.warehouseId}
            onClick={() => act({ type: 'DEPART', truckId: t.id, destinationId: dest })}
          >
            Depart
          </button>
        </div>
        <button className="button full subtle" onClick={follow}>
          <Navigation size={13} />
          Follow truck · F
        </button>
      </div>
    );
  }
  if (selection.kind === 'forklift') {
    const f = sim.forklifts.find((f) => f.id === selection.id);
    if (!f) return null;
    const options = sim.trucks
      .filter(
        (t) => t.warehouseId === f.warehouseId && ['CARGANDO', 'DESCARGANDO'].includes(t.state),
      )
      .map((t) => ({ value: t.id, label: `${t.id} · ${truckLabels[t.state]}` }));
    return (
      <div className="entity-actions">
        <span className="eyebrow">TASK CONTROL</span>
        <div className="inline-control">
          <SelectField
            label="Reassign transfer"
            value={truck}
            onChange={setTruck}
            options={[{ value: '', label: 'Choose active truck…' }, ...options]}
          />
          <button
            className="button"
            disabled={!truck}
            onClick={() => act({ type: 'REASSIGN_FORKLIFT', forkliftId: f.id, truckId: truck })}
          >
            Assign
          </button>
        </div>
        <button
          className="button full subtle"
          disabled={f.state === 'CHARGING'}
          onClick={() => act({ type: 'CHARGE', forkliftId: f.id })}
        >
          <BatteryCharging size={14} />
          Send to charger
        </button>
      </div>
    );
  }
  if (selection.kind === 'dock') {
    const d = sim.docks.find((d) => d.id === selection.id);
    if (!d) return null;
    return (
      <div className="entity-actions">
        <span className="eyebrow">DOCK CONTROL</span>
        {d.blockedUntil > sim.time ? (
          <button
            className="button full"
            onClick={() => act({ type: 'UNBLOCK_DOCK', dockId: d.id })}
          >
            Reopen dock
          </button>
        ) : d.truckId ? (
          <button
            className="button full subtle"
            onClick={() => select({ kind: 'truck', id: d.truckId! }, true)}
          >
            Manage {d.truckId}
            <ChevronRight size={14} />
          </button>
        ) : (
          <div className="inline-control">
            <SelectField
              label="Available truck"
              value={truck}
              onChange={setTruck}
              options={[
                { value: '', label: 'Choose a truck…' },
                ...sim.trucks
                  .filter(
                    (t) =>
                      t.warehouseId === d.warehouseId &&
                      !['MANIOBRANDO', 'SALIENDO'].includes(t.state),
                  )
                  .map((t) => ({ value: t.id, label: t.id })),
              ]}
            />
            <button
              className="button"
              disabled={!truck}
              onClick={() => act({ type: 'ASSIGN_DOCK', truckId: truck, dockId: d.id })}
            >
              Assign
            </button>
          </div>
        )}
      </div>
    );
  }
  if (selection.kind === 'shipment') {
    const s = sim.shipments.find((s) => s.id === selection.id);
    if (!s) return null;
    return (
      <div className="entity-actions">
        <SelectField
          label="Shipment priority"
          value={s.priority}
          onChange={(value) =>
            act({ type: 'PRIORITY', shipmentId: s.id, priority: value as Shipment['priority'] })
          }
          options={['NORMAL', 'HIGH', 'URGENT'].map((value) => ({
            value,
            label: value.toLowerCase(),
          }))}
        />
        {s.status === 'ON_HOLD' && (
          <button
            className="button full"
            onClick={() => select({ kind: 'truck', id: s.truckId }, true)}
          >
            Resume through truck controls
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    );
  }
  if (selection.kind === 'pallet') {
    const p = sim.pallets.find((p) => p.id === selection.id);
    return (
      <div className="entity-actions">
        <button className="button full subtle" onClick={() => camera('center')}>
          <LocateFixed size={14} />
          Locate pallet
        </button>
        {p?.ownerId && p.location !== 'RACK' && (
          <button
            className="button full"
            onClick={() =>
              select({ kind: p.location === 'TRUCK' ? 'truck' : 'forklift', id: p.ownerId! }, true)
            }
          >
            Inspect carrier
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    );
  }
  if (selection.kind === 'parking') {
    const p = sim.parking.find((p) => p.id === selection.id);
    return (
      <div className="entity-actions">
        {p?.truckId ? (
          <button
            className="button full"
            onClick={() => select({ kind: 'truck', id: p.truckId! }, true)}
          >
            Manage {p.truckId}
          </button>
        ) : (
          <div className="inline-control">
            <SelectField
              label="Send truck to parking"
              value={truck}
              onChange={setTruck}
              options={[
                { value: '', label: 'Choose a truck…' },
                ...sim.trucks
                  .filter((t) => t.warehouseId === p?.warehouseId)
                  .map((t) => ({ value: t.id, label: t.id })),
              ]}
            />
            <button
              className="button"
              disabled={!truck}
              onClick={() => act({ type: 'PARK', truckId: truck })}
            >
              Park
            </button>
          </div>
        )}
      </div>
    );
  }
  if (selection.kind === 'charger') {
    const c = sim.chargers.find((c) => c.id === selection.id);
    const f = sim.forklifts.find((f) => f.warehouseId === c?.warehouseId);
    return (
      <div className="entity-actions">
        <button
          className="button full"
          onClick={() => {
            if (f) act({ type: 'CHARGE', forkliftId: f.id });
          }}
        >
          Charge {f?.id}
          <BatteryCharging size={14} />
        </button>
      </div>
    );
  }
  return (
    <div className="entity-actions">
      <button
        className="button full"
        onClick={() => {
          if (selection.kind === 'warehouse') useAtlasStore.getState().setWarehouse(selection.id);
          toggle('createModal');
        }}
      >
        Create shipment
        <ArrowUpRight size={14} />
      </button>
    </div>
  );
}
