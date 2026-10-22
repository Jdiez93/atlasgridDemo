import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  Command,
  Globe2,
  Keyboard,
  Package,
  Plus,
  RotateCcw,
  Search,
  Truck,
  X,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { useAtlasStore } from '../store/useAtlasStore';
import { CONFIG } from '../lib/config';
import { activeShipments, calculateKPIs } from '../sim/kpis';
import { truckLabels, statusTone, clock } from '../lib/format';
import type { EntityKind, Shipment } from '../sim/types';
import { EntityActions } from './Inspector';
import { Badge, IconButton, Panel, PanelHeader, Progress, SelectField } from './shared';
export function useShortcuts() {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const s = useAtlasStore.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        s.toggle('palette');
        return;
      }
      if (e.key === 'Escape') {
        useAtlasStore.setState({
          palette: false,
          search: false,
          help: false,
          createModal: false,
          notifications: false,
          context: null,
          selection: null,
        });
        return;
      }
      if (
        e.target instanceof HTMLElement &&
        (e.target.matches('input,textarea,select') || e.target.isContentEditable)
      )
        return;
      if (s.palette || s.search || s.help || s.createModal) return;
      if (e.key === '/') {
        e.preventDefault();
        s.toggle('search');
      } else if (e.code === 'Space') {
        e.preventDefault();
        s.setSpeed(s.speed === 0 ? 1 : 0);
      } else if (e.key.toLowerCase() === 'r') s.cameraAct('reset');
      else if (e.key.toLowerCase() === 'f') s.toggleFollow();
      else if (e.key === '1') s.setView('warehouse');
      else if (e.key === '2') s.setView('world');
      else if (e.key === '3') s.setView('fleet');
      else if (e.key === '4') s.setView('region');
      else if (e.key.toLowerCase() === 'h') s.toggle('collapsed');
      else if (e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.metaKey)
        s.setLayer(
          s.layer === 'none' ? 'congestion' : s.layer === 'congestion' ? 'activity' : 'none',
        );
      else if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey) s.toggle('director');
      else if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey)
        s.setPhoto({ on: !s.photo.on });
      else if (e.key.toLowerCase() === 'k' && !e.ctrlKey && !e.metaKey) s.togglePanel('left');
      else if (e.key.toLowerCase() === 'i') s.togglePanel('right');
      else if (e.key.toLowerCase() === 't') s.togglePanel('dock');
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
}
function Modal({
  title,
  children,
  onClose,
  className = '',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const el = ref.current;
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !el) return;
      const focusable = el.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input,select,[tabindex="0"]',
      );
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    el?.addEventListener('keydown', trap);
    (el?.querySelector<HTMLElement>('input') ?? el?.querySelector<HTMLElement>('button'))?.focus();
    return () => {
      el?.removeEventListener('keydown', trap);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal panel ${className}`}
        initial={{ y: 16, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
      >
        <PanelHeader title={title}>
          <IconButton label={`Close ${title}`} onClick={onClose}>
            <X size={18} />
          </IconButton>
        </PanelHeader>
        {children}
      </motion.div>
    </motion.div>
  );
}
interface SearchItem {
  id: string;
  title: string;
  detail: string;
  kind: EntityKind | 'command';
  run: () => void;
}
export function CommandPalette() {
  const palette = useAtlasStore((s) => s.palette);
  const search = useAtlasStore((s) => s.search);
  if (!palette && !search) return null;
  return <PaletteContent key={palette ? 'commands' : 'search'} commandMode={palette} />;
}
function PaletteContent({ commandMode }: { commandMode: boolean }) {
  const sim = useAtlasStore((s) => s.sim);
  const select = useAtlasStore((s) => s.select);
  const setView = useAtlasStore((s) => s.setView);
  const camera = useAtlasStore((s) => s.cameraAct);
  const reset = useAtlasStore((s) => s.reset);
  const toggle = useAtlasStore((s) => s.toggle);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const close = () => useAtlasStore.setState({ search: false, palette: false });
  const make = (kind: EntityKind, id: string, title: string, detail: string): SearchItem => ({
    id: `${kind}:${id}`,
    title,
    detail,
    kind,
    run: () => select({ kind, id }, true),
  });
  const entities: SearchItem[] = [
    ...sim.warehouses.map((w) => make('warehouse', w.id, w.name, `${w.city} · ${w.code}`)),
    ...sim.trucks.map((t) => make('truck', t.id, t.id, `${t.driver} · ${truckLabels[t.state]}`)),
    ...sim.forklifts.map((f) =>
      make(
        'forklift',
        f.id,
        f.id,
        `Forklift · ${sim.warehouses.find((w) => w.id === f.warehouseId)?.city}`,
      ),
    ),
    ...sim.docks.map((d) =>
      make(
        'dock',
        d.id,
        d.label,
        `${sim.warehouses.find((w) => w.id === d.warehouseId)?.city} · ${d.truckId ?? 'Free'}`,
      ),
    ),
    ...sim.pallets.map((p) => make('pallet', p.id, p.id, `${p.name} · ${p.sku} · ${p.location}`)),
    ...sim.shipments.map((s) => make('shipment', s.id, s.id, `${s.client} · ${s.status}`)),
    ...sim.chargers.map((c) =>
      make(
        'charger',
        c.id,
        'Forklift charger',
        sim.warehouses.find((w) => w.id === c.warehouseId)?.city ?? '',
      ),
    ),
    ...sim.parking.map((p) =>
      make(
        'parking',
        p.id,
        `Parking ${p.label}`,
        `${sim.warehouses.find((w) => w.id === p.warehouseId)?.city} · ${p.truckId ?? 'Free'}`,
      ),
    ),
  ];
  const commands: SearchItem[] = commandMode
    ? [
        {
          id: 'world',
          title: 'Open network overview',
          detail: 'World view · 2',
          kind: 'command',
          run: () => setView('world'),
        },
        {
          id: 'warehouse',
          title: 'Open warehouse',
          detail: 'Warehouse view · 1',
          kind: 'command',
          run: () => setView('warehouse'),
        },
        {
          id: 'fleet',
          title: 'Open fleet table',
          detail: '30 vehicles · 8 hubs',
          kind: 'command',
          run: () => setView('fleet'),
        },
        {
          id: 'shipment',
          title: 'Create a shipment',
          detail: 'Manual dispatch',
          kind: 'command',
          run: () => toggle('createModal'),
        },
        {
          id: 'pause',
          title: 'Pause / resume simulation',
          detail: 'Space',
          kind: 'command',
          run: () => {
            const s = useAtlasStore.getState();
            s.setSpeed(s.speed === 0 ? 1 : 0);
          },
        },
        {
          id: 'camera',
          title: 'Reset camera',
          detail: 'R',
          kind: 'command',
          run: () => camera('reset'),
        },
        {
          id: 'follow',
          title: 'Follow selected truck',
          detail: 'F',
          kind: 'command',
          run: () => useAtlasStore.getState().toggleFollow(),
        },
        {
          id: 'restart',
          title: 'Reset simulation',
          detail: 'Restore all initial demo data',
          kind: 'command',
          run: reset,
        },
      ]
    : [];
  const results = [...commands, ...entities]
    .filter((i) => `${i.title} ${i.detail} ${i.kind}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 24);
  const current = Math.min(index, results.length - 1);
  const choose = (item: SearchItem) => {
    close();
    item.run();
  };
  return (
    <Modal
      title={commandMode ? 'Command center' : 'Search the network'}
      onClose={close}
      className="palette-modal"
    >
      <div className="palette-input">
        <Search size={19} />
        <input
          aria-label="Search all entities and commands"
          placeholder={
            commandMode
              ? 'Type a command or asset…'
              : 'Hubs, trucks, forklifts, pallets, shipments…'
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex(Math.min(index + 1, results.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex(Math.max(0, index - 1));
            }
            if (e.key === 'Enter' && results[current]) choose(results[current]);
          }}
          autoFocus
        />
        <kbd>ESC</kbd>
      </div>
      <div className="palette-results">
        {results.length ? (
          results.map((r, i) => (
            <button
              key={r.id}
              className={i === current ? 'current' : ''}
              onClick={() => choose(r)}
              onMouseEnter={() => setIndex(i)}
            >
              <span className="entity-icon">
                {r.kind === 'truck' ? (
                  <Truck size={17} />
                ) : r.kind === 'warehouse' ? (
                  <Globe2 size={17} />
                ) : r.kind === 'command' ? (
                  <Command size={17} />
                ) : (
                  <Package size={17} />
                )}
              </span>
              <span>
                <b>{r.title}</b>
                <small>{r.detail}</small>
              </span>
              <span className="palette-kind">{r.kind}</span>
              <ArrowUpRight size={13} />
            </button>
          ))
        ) : (
          <div className="empty">
            <strong>No matching assets</strong>
            <p>Try a truck ID, city, SKU or client name.</p>
          </div>
        )}
      </div>
      <footer className="palette-footer">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> navigate
        </span>
        <span>
          <kbd>↵</kbd> open / focus
        </span>
        <span className="mono">{sim.pallets.length} physical pallets</span>
      </footer>
    </Modal>
  );
}
export function CreateShipment() {
  const open = useAtlasStore((s) => s.createModal);
  return open ? <CreateForm /> : null;
}
function CreateForm() {
  const sim = useAtlasStore((s) => s.sim);
  const current = useAtlasStore((s) => s.warehouseId);
  const act = useAtlasStore((s) => s.act);
  const toggle = useAtlasStore((s) => s.toggle);
  const [origin, setOrigin] = useState(current);
  const [destination, setDestination] = useState(sim.warehouses.find((w) => w.id !== current)!.id);
  const [client, setClient] = useState('');
  const [count, setCount] = useState('2');
  const [priority, setPriority] = useState<Shipment['priority']>('NORMAL');
  const [error, setError] = useState('');
  const active = activeShipments(sim).length;
  const stock = sim.pallets.filter(
    (p) => p.warehouseId === origin && p.location === 'RACK' && !p.ownerId,
  ).length;
  const idle = sim.trucks.filter(
    (t) => t.warehouseId === origin && !t.shipmentId && ['APARCADO', 'EN_MUELLE'].includes(t.state),
  );
  return (
    <Modal title="Create shipment" onClose={() => toggle('createModal')} className="create-modal">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const result = act({
            type: 'CREATE_SHIPMENT',
            originId: origin,
            destinationId: destination,
            client,
            palletCount: Number(count),
            priority,
          });
          if (result.ok) toggle('createModal');
          else setError(result.message);
        }}
      >
        <div className="modal-intro">
          <span className="entity-icon">
            <Plus size={22} />
          </span>
          <div>
            <h3>Put the network in motion.</h3>
            <p>A real stock transfer with a reserved truck and dock.</p>
          </div>
        </div>
        <div className="form-grid">
          <SelectField
            label="Origin hub"
            value={origin}
            onChange={(value) => {
              setOrigin(value);
              if (value === destination)
                setDestination(sim.warehouses.find((w) => w.id !== value)!.id);
            }}
            options={sim.warehouses.map((w) => ({ value: w.id, label: `${w.code} · ${w.city}` }))}
          />
          <SelectField
            label="Destination hub"
            value={destination}
            onChange={setDestination}
            options={sim.warehouses
              .filter((w) => w.id !== origin)
              .map((w) => ({ value: w.id, label: `${w.code} · ${w.city}` }))}
          />
        </div>
        <label className="input-field">
          <span>Client name</span>
          <input
            required
            maxLength={60}
            placeholder="e.g. Solstice Devices"
            value={client}
            onChange={(e) => setClient(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <SelectField
            label="Pallets to transfer"
            value={count}
            onChange={setCount}
            options={[1, 2, 3, 4, 5, 6].map((n) => ({
              value: String(n),
              label: `${n} pallet${n === 1 ? '' : 's'}`,
            }))}
          />
          <SelectField
            label="Priority"
            value={priority}
            onChange={(value) => setPriority(value as Shipment['priority'])}
            options={['NORMAL', 'HIGH', 'URGENT'].map((value) => ({
              value,
              label: value.toLowerCase(),
            }))}
          />
        </div>
        <div className="dispatch-check">
          <span>
            <i className="dot green" />
            {stock} pallets available
          </span>
          <span>
            <i className={`dot ${idle.length ? 'green' : 'amber'}`} />
            {idle.length} idle trucks at origin
          </span>
          <span>
            <i className={`dot ${active < CONFIG.maxActiveShipments ? 'green' : 'amber'}`} />
            {active}/{CONFIG.maxActiveShipments} active shipments
          </span>
        </div>
        {active >= CONFIG.maxActiveShipments && (
          <div className="notice amber">
            The active shipment limit is reached. Keep this form open or wait for a delivery before
            creating another.
          </div>
        )}
        {error && (
          <div role="alert" className="notice red">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="button subtle" onClick={() => toggle('createModal')}>
            Cancel
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={active >= CONFIG.maxActiveShipments || !idle.length || Number(count) > stock}
          >
            Create & dispatch
            <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function Help() {
  const open = useAtlasStore((s) => s.help);
  const toggle = useAtlasStore((s) => s.toggle);
  const reset = useAtlasStore((s) => s.reset);
  if (!open) return null;
  const rows = [
    ['Left drag', 'Orbit camera'],
    ['Right drag / WASD', 'Pan'],
    ['Mouse wheel', 'Zoom toward cursor'],
    ['Q / E', 'Rotate'],
    ['R', 'Reset camera'],
    ['F', 'Follow selected truck'],
    ['Space', 'Pause / resume'],
    ['1 / 2 / 3 / 4', 'Hub / World / Fleet / Region'],
    ['/', 'Global search'],
    ['Ctrl+K / ⌘K', 'Command palette'],
    ['Right click', 'Asset actions'],
    ['H', 'Collapse HUD panels'],
    ['Esc', 'Close overlays / clear selection'],
  ];
  return (
    <Modal title="Control room guide" onClose={() => toggle('help')} className="help-modal">
      <div className="modal-intro">
        <span className="entity-icon">
          <Keyboard size={24} />
        </span>
        <div>
          <h3>Your network. Your decisions.</h3>
          <p>Select assets, dispatch freight, and watch every pallet move.</p>
        </div>
      </div>
      <div className="help-shortcuts">
        {rows.map(([key, action]) => (
          <div key={key}>
            <kbd>{key}</kbd>
            <span>{action}</span>
          </div>
        ))}
      </div>
      <div className="notice">
        The clock is accelerated. The engine runs 10 fixed ticks per simulated second. Yard
        maneuvers reserve a shared access lane; rejected actions explain what must clear first.
      </div>
      <div className="modal-actions">
        <span className="muted">Local demo · Seeded simulation</span>
        <button
          className="button danger"
          onClick={() => {
            reset();
            toggle('help');
          }}
        >
          <RotateCcw size={14} />
          Reset simulation
        </button>
      </div>
    </Modal>
  );
}
export function ContextMenu() {
  const context = useAtlasStore((s) => s.context);
  const setContext = useAtlasStore((s) => s.setContext);
  const select = useAtlasStore((s) => s.select);
  if (!context) return null;
  return (
    <div
      className="context-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setContext(null);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="context-menu panel"
        style={{
          left: Math.min(context.x, window.innerWidth - 322),
          top: Math.min(context.y, window.innerHeight - 390),
        }}
      >
        <div className="context-title">
          <span className="eyebrow">{context.selection.kind.toUpperCase()}</span>
          <b>{context.selection.id}</b>
        </div>
        <button className="context-inspect" onClick={() => select(context.selection, true)}>
          <SlidersHorizontal size={15} />
          Inspect & focus
          <ArrowUpRight size={14} />
        </button>
        <EntityActions key={context.selection.id} selection={context.selection} />
      </div>
    </div>
  );
}
export function Toast() {
  const toast = useAtlasStore((s) => s.toast);
  const dismiss = useAtlasStore((s) => s.dismissToast);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismiss, 5000);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          role="status"
          className={`toast ${toast.ok ? 'green' : 'amber'}`}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 6, opacity: 0 }}
        >
          {toast.ok ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
          <span>{toast.message}</span>
          <IconButton label="Dismiss message" onClick={dismiss}>
            <X size={14} />
          </IconButton>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
export function FleetView() {
  const sim = useAtlasStore((s) => s.sim);
  const select = useAtlasStore((s) => s.select);
  const k = calculateKPIs(sim);
  const [state, setState] = useState('ALL'),
    [hub, setHub] = useState('ALL'),
    [kind, setKind] = useState('ALL');
  const filtered = sim.trucks.filter(
    (t) =>
      (state === 'ALL' || state === 'PAUSED' ? state === 'ALL' || t.paused : t.state === state) &&
      (hub === 'ALL' || t.warehouseId === hub || t.destinationId === hub) &&
      (kind === 'ALL' || t.kind === kind),
  );
  return (
    <Panel className="fleet-view" label="Fleet overview">
      <PanelHeader title="Fleet overview" meta={`${sim.trucks.length} VEHICLES / LIVE TELEMETRY`}>
        <Badge label="All assets reporting" />
      </PanelHeader>
      <div className="fleet-summary">
        <div>
          <Truck size={20} />
          <b>{sim.trucks.length}</b>
          <span>fleet vehicles</span>
        </div>
        <div>
          <b className="cyan">{k.inRoute}</b>
          <span>in transit / maneuvering</span>
        </div>
        <div>
          <b className="green">{k.parked}</b>
          <span>parked</span>
        </div>
        <div>
          <b className="amber">{k.atDock}</b>
          <span>at dock</span>
        </div>
        <div>
          <b className="red">{k.maintenance}</b>
          <span>maintenance</span>
        </div>
      </div>
      <div className="fleet-filters">
        <SelectField
          label="Fleet status"
          value={state}
          onChange={setState}
          options={[
            { value: 'ALL', label: 'All states' },
            { value: 'PAUSED', label: 'Operator paused' },
            ...Object.entries(truckLabels).map(([value, label]) => ({ value, label })),
          ]}
        />
        <SelectField
          label="Hub / destination"
          value={hub}
          onChange={setHub}
          options={[
            { value: 'ALL', label: 'All hubs' },
            ...sim.warehouses.map((w) => ({ value: w.id, label: w.city })),
          ]}
        />
        <SelectField
          label="Vehicle type"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'ALL', label: 'Trucks & vans' },
            { value: 'TRUCK', label: 'Trucks' },
            { value: 'VAN', label: 'Vans' },
          ]}
        />
        <span className="mono">
          {filtered.length} / {sim.trucks.length}
        </span>
      </div>
      <div className="fleet-table-wrapper">
        <table className="fleet-table">
          <thead>
            <tr>
              <th>Vehicle / driver</th>
              <th>Status</th>
              <th>Location → Destination</th>
              <th>Load</th>
              <th>Fuel / Speed</th>
              <th>Progress</th>
              <th>Camera</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td>
                  <div className="fleet-identity">
                    <span className="entity-icon">
                      <Truck size={18} />
                    </span>
                    <span>
                      <b className="mono">{t.id}</b>
                      <small>
                        {t.driver} · {t.plate}
                      </small>
                    </span>
                  </div>
                </td>
                <td>
                  <Badge
                    label={
                      t.paused
                        ? 'Paused'
                        : t.delayUntil > sim.time
                          ? 'Traffic delay'
                          : truckLabels[t.state]
                    }
                    tone={t.paused ? 'amber' : statusTone(t.state)}
                  />
                </td>
                <td>
                  <div className="fleet-route">
                    <b>
                      {sim.warehouses.find((w) => w.id === t.warehouseId)?.city ?? 'In transit'}
                    </b>
                    <span>
                      <ArrowRight size={11} />
                      {sim.warehouses.find((w) => w.id === t.destinationId)?.city}
                    </span>
                  </div>
                </td>
                <td>
                  <span className="mono">
                    {t.cargo.length} / {t.capacity}
                  </span>
                  <small>pallets · {t.kind}</small>
                </td>
                <td className="mono">
                  {Math.round(t.fuel)}%<small>{Math.round(t.speed * 3.6)} km/h</small>
                </td>
                <td>
                  <Progress
                    value={t.state === 'EN_RUTA' ? t.routeProgress : t.cargo.length / t.capacity}
                    tone={statusTone(t.state)}
                  />
                </td>
                <td>
                  <button
                    className="button subtle"
                    aria-label={`Focus ${t.id}`}
                    onClick={() => select({ kind: 'truck', id: t.id }, true)}
                  >
                    Locate
                    <ArrowUpRight size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7}>
                  No matching vehicles. Clear the filters to show the whole fleet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="fleet-table-foot">
        <span>
          <i className="dot green" />
          Fixed fleet · 30 vehicles / 8 hubs
        </span>
        <span className="mono">LIVE {clock(sim.time)}</span>
      </div>
    </Panel>
  );
}
