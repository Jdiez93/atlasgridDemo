import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Package,
  Truck as TruckIcon,
  ArrowUpRight,
} from 'lucide-react';
import { useAtlasStore } from '../store/useAtlasStore';
import { CONFIG } from '../lib/config';
import { activeShipments } from '../sim/kpis';
import { shipmentProgress } from '../sim/engine';
import { clock, eta, forkliftLabels, statusTone, truckLabels } from '../lib/format';
import type { ShipmentStatus } from '../sim/types';
import { Badge, Empty, Panel, PanelHeader, Progress } from './shared';
const STAGES: { id: ShipmentStatus; label: string }[] = [
  { id: 'CONFIRMED', label: 'Order confirmed' },
  { id: 'PICKED', label: 'Picked' },
  { id: 'LOADED', label: 'Loaded' },
  { id: 'IN_TRANSIT', label: 'In transit' },
  { id: 'DELIVERED', label: 'Delivered' },
];
export function ShipmentTracking() {
  const sim = useAtlasStore((s) => s.sim);
  const selection = useAtlasStore((s) => s.selection);
  const select = useAtlasStore((s) => s.select);
  const [chosen, setChosen] = useState('');
  const sorted = [...sim.shipments].sort(
    (a, b) =>
      Number(a.status === 'DELIVERED') - Number(b.status === 'DELIVERED') ||
      b.createdAt - a.createdAt,
  );
  // Selección → envío: un envío directo, o el envío vigente del camión (o de su palé) seleccionado.
  const selectedTruckId =
    selection?.kind === 'truck'
      ? selection.id
      : selection?.kind === 'pallet'
        ? sim.pallets.find((p) => p.id === selection.id)?.ownerId
        : undefined;
  const selectedTruck = selectedTruckId
    ? sim.trucks.find((t) => t.id === selectedTruckId)
    : undefined;
  const fromTruck = selectedTruck
    ? (sim.shipments.find((x) => x.id === selectedTruck.shipmentId) ??
      sorted.find((x) => x.truckId === selectedTruck.id))
    : undefined;
  const fromSelection =
    selection?.kind === 'shipment' ? sim.shipments.find((x) => x.id === selection.id) : fromTruck;
  useEffect(() => {
    if (fromSelection) setChosen(fromSelection.id);
  }, [fromSelection?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = fromSelection ?? sim.shipments.find((x) => x.id === chosen) ?? sorted[0];
  const noShipmentTruck = selectedTruck && !fromTruck ? selectedTruck : undefined;
  const active = activeShipments(sim).length;
  return (
    <Panel className="tracking-panel" label="Shipment tracking">
      <PanelHeader
        title="Shipment Tracking"
        meta={`${active} ACTIVE / MAX ${CONFIG.maxActiveShipments}`}
      >
        <span className="subtle-live">
          <i className="dot green" />
          Live
        </span>
      </PanelHeader>
      {!s ? (
        <Empty title="No active shipments" detail="Create a shipment to start a transfer." />
      ) : (
        <div className="tracking-body">
          {noShipmentTruck && (
            <div className="tracking-note" role="status">
              <TruckIcon size={13} />
              <b className="mono">{noShipmentTruck.id}</b> has no shipment assigned — showing the
              latest one.
            </div>
          )}
          {selectedTruck && fromTruck && (
            <div className="tracking-note follow" role="status">
              <TruckIcon size={13} />
              Following <b className="mono">{selectedTruck.id}</b> ·{' '}
              {truckLabels[selectedTruck.state]}
            </div>
          )}
          <div className="tracking-summary">
            <button className="shipment-id" onClick={() => select({ kind: 'shipment', id: s.id })}>
              <Package size={14} />
              <b className="mono">{s.id}</b>
              <ArrowUpRight size={12} />
            </button>
            <div className="shipment-switch">
              <select
                aria-label="Track shipment"
                value={s.id}
                onChange={(e) => {
                  setChosen(e.target.value);
                  select({ kind: 'shipment', id: e.target.value });
                }}
              >
                {sorted.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} · {s.client}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
            <Badge
              label={s.status === 'ON_HOLD' ? 'On hold' : s.priority.toLowerCase()}
              tone={s.priority === 'URGENT' ? 'red' : s.priority === 'HIGH' ? 'amber' : 'green'}
            />
          </div>
          <div className="shipment-route">
            <b>{sim.warehouses.find((w) => w.id === s.originId)?.city}</b>
            <ArrowRight size={14} />
            <b>{sim.warehouses.find((w) => w.id === s.destinationId)?.city}</b>
            <span className="mono">
              {s.status === 'DELIVERED' ? 'Delivered' : `ETA ${eta(s.eta, sim.time)}`}
            </span>
          </div>
          <div className="timeline">
            {STAGES.map((stage, i) => {
              const event = s.timeline.find((t) => t.stage === stage.id);
              return (
                <div key={stage.id} className={event ? 'completed' : ''}>
                  <span className="timeline-point">{event ? <Check size={10} /> : i + 1}</span>
                  <b>{stage.label}</b>
                  <small className="mono">{event ? clock(event.time) : '—'}</small>
                </div>
              );
            })}
          </div>
          <div className="tracking-foot">
            <Progress value={shipmentProgress(sim, s)} />
            <span className="mono">{Math.round(shipmentProgress(sim, s) * 100)}%</span>
            <span>
              {s.palletCount} pallets · {s.client}
            </span>
          </div>
        </div>
      )}
    </Panel>
  );
}
export function AssetsPanel() {
  const sim = useAtlasStore((s) => s.sim);
  const id = useAtlasStore((s) => s.warehouseId);
  const view = useAtlasStore((s) => s.view);
  const selection = useAtlasStore((s) => s.selection);
  const select = useAtlasStore((s) => s.select);
  const [tab, setTab] = useState<'docks' | 'forklifts' | 'trucks'>('docks');
  const docks = sim.docks.filter((d) => view === 'world' || d.warehouseId === id);
  const forklifts = sim.forklifts.filter((f) => view === 'world' || f.warehouseId === id);
  return (
    <Panel className="assets-panel" label="Operational assets">
      <div className="asset-tabs" role="tablist" aria-label="Operational assets">
        {(['docks', 'forklifts', 'trucks'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={tab === t ? 'active' : ''}
          >
            {t === 'docks' ? 'Docks' : t === 'forklifts' ? 'Forklifts' : 'Trucks'}
            <span>
              {t === 'docks'
                ? docks.length
                : t === 'forklifts'
                  ? forklifts.length
                  : sim.trucks.length}
            </span>
          </button>
        ))}
      </div>
      <div className="asset-rows">
        {tab === 'docks'
          ? docks.map((d) => {
              const t = sim.trucks.find((t) => t.id === d.truckId);
              const blocked = d.blockedUntil > sim.time;
              return (
                <button
                  className={`asset-row ${selection?.id === d.id ? 'selected' : ''}`}
                  key={d.id}
                  onClick={() => select({ kind: 'dock', id: d.id }, true)}
                >
                  <span className="asset-row-icon">
                    <Package size={15} />
                  </span>
                  <span>
                    <b>{d.label}</b>
                    <small>
                      {view === 'world'
                        ? sim.warehouses.find((w) => w.id === d.warehouseId)?.code
                        : (t?.id ?? 'Ready for assignment')}
                    </small>
                  </span>
                  <Badge
                    label={blocked ? 'Blocked' : t ? truckLabels[t.state] : 'Free'}
                    tone={blocked ? 'red' : t ? 'amber' : 'green'}
                  />
                  <div className="asset-row-progress">
                    <Progress value={t ? t.cargo.length / t.capacity : 0} tone="amber" />
                  </div>
                </button>
              );
            })
          : tab === 'forklifts'
            ? forklifts.map((f) => (
                <button
                  className={`asset-row ${selection?.id === f.id ? 'selected' : ''}`}
                  key={f.id}
                  onClick={() => select({ kind: 'forklift', id: f.id }, true)}
                >
                  <span className="asset-row-icon amber">
                    <TruckIcon size={15} />
                  </span>
                  <span>
                    <b>{f.id}</b>
                    <small>{forkliftLabels[f.state]}</small>
                  </span>
                  <span className={`mono ${f.battery < 18 ? 'amber' : 'green'}`}>
                    {Math.round(f.battery)}%
                  </span>
                  <div className="asset-row-progress">
                    <Progress value={f.battery / 100} />
                  </div>
                </button>
              ))
            : sim.trucks.map((t) => (
                <button
                  className={`asset-row ${selection?.id === t.id ? 'selected' : ''}`}
                  key={t.id}
                  onClick={() => select({ kind: 'truck', id: t.id }, true)}
                >
                  <span className="asset-row-icon">
                    <TruckIcon size={15} />
                  </span>
                  <span>
                    <b>{t.id}</b>
                    <small>
                      {t.warehouseId
                        ? sim.warehouses.find((w) => w.id === t.warehouseId)?.city
                        : `To ${sim.warehouses.find((w) => w.id === t.destinationId)?.city}`}
                    </small>
                  </span>
                  <Badge label={truckLabels[t.state]} tone={statusTone(t.state)} />
                  <div className="asset-row-progress">
                    <Progress
                      value={t.state === 'EN_RUTA' ? t.routeProgress : t.cargo.length / t.capacity}
                      tone={statusTone(t.state)}
                    />
                  </div>
                </button>
              ))}
      </div>
      <div className="asset-panel-foot">
        <span>Click an asset to locate</span>
        <LocateIcon />
      </div>
    </Panel>
  );
}
function LocateIcon() {
  return <span className="mono">↗ FOCUS</span>;
}
