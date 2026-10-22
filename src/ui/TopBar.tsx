import { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, Command, Globe2, Search, Wifi, X, CheckCheck } from 'lucide-react';
import { useAtlasStore } from '../store/useAtlasStore';
import { calculateKPIs } from '../sim/kpis';
import { clock } from '../lib/format';
import { IconButton, Badge } from './shared';
import { ErrorBoundary } from '../lib/ErrorBoundary';
export function TopBar() {
  const sim = useAtlasStore((s) => s.sim);
  const id = useAtlasStore((s) => s.warehouseId);
  const view = useAtlasStore((s) => s.view);
  const speed = useAtlasStore((s) => s.speed);
  const toggle = useAtlasStore((s) => s.toggle);
  const select = useAtlasStore((s) => s.setWarehouse);
  const setView = useAtlasStore((s) => s.setView);
  const [sites, setSites] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sites) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setSites(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [sites]);
  const warehouse = sim.warehouses.find((w) => w.id === id)!;
  const unread = sim.alerts.filter((a) => !a.read).length;
  return (
    <header className="topbar">
      <a
        className="brand"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          select('riverside');
        }}
        aria-label="AtlasGrid home"
      >
        <img src="/logo.svg" alt="AtlasGrid cube" />
        <div>
          <strong>
            ATLAS<span>GRID</span>
          </strong>
          <small>LOGISTICS / OPERATIONS CONTROL</small>
        </div>
      </a>
      <button className="global-search" onClick={() => toggle('search')}>
        <Search size={16} />
        <span>Search the network…</span>
        <kbd>/</kbd>
      </button>
      <div className="site-switch" ref={ref}>
        <button
          onClick={() => setSites(!sites)}
          aria-expanded={sites}
          aria-label="Select warehouse"
        >
          <span className="site-code">{view === 'world' ? 'NET' : warehouse.code}</span>
          <div>
            <b>{view === 'world' ? 'Network overview' : warehouse.name}</b>
            <small>
              {view === 'world'
                ? `${sim.warehouses.length} hubs · globally connected`
                : `${warehouse.city} · ${calculateKPIs(sim, id).occupancy}% occupied`}
            </small>
          </div>
          <ChevronDown size={14} />
        </button>
        {sites && (
          <div className="popover site-menu">
            <button
              onClick={() => {
                setView('world');
                setSites(false);
              }}
            >
              <Globe2 size={17} />
              <div>
                <b>Network overview</b>
                <small>All hubs and routes</small>
              </div>
            </button>
            {sim.warehouses.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  select(w.id);
                  setSites(false);
                }}
                className={w.id === id && view !== 'world' ? 'selected' : ''}
              >
                <span className="site-code">{w.code}</span>
                <div>
                  <b>{w.name}</b>
                  <small>{w.city}</small>
                </div>
                <span className="mono">{calculateKPIs(sim, w.id).occupancy}%</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="topbar-end">
        <span className={`live-pill ${speed === 0 ? 'paused' : ''}`}>
          <Wifi size={12} />
          {speed === 0 ? 'Paused' : 'Live'}{' '}
          <b className="mono" data-testid="sim-clock">
            {clock(sim.time)}
          </b>
        </span>
        <IconButton label="Command palette (Ctrl+K)" onClick={() => toggle('palette')}>
          <Command size={17} />
        </IconButton>
        <div className="notification-toggle">
          <IconButton label="Notifications" onClick={() => toggle('notifications')}>
            <Bell size={18} />
          </IconButton>
          {unread > 0 && <span className="notification-count">{unread}</span>}
        </div>
        <div className="operator">
          <span className="avatar">
            AC
            <i />
          </span>
          <div>
            <b>Alex Chen</b>
            <small>Operations Manager</small>
          </div>
        </div>
      </div>
      <ErrorBoundary name="Notifications">
        <Notifications />
      </ErrorBoundary>
    </header>
  );
}
function Notifications() {
  const open = useAtlasStore((s) => s.notifications);
  const sim = useAtlasStore((s) => s.sim);
  const toggle = useAtlasStore((s) => s.toggle);
  const select = useAtlasStore((s) => s.select);
  const read = useAtlasStore((s) => s.readAlerts);
  if (!open) return null;
  return (
    <aside className="popover notifications">
      <div className="panel-header">
        <h2>Activity & alerts</h2>
        <div className="panel-head-actions">
          <IconButton label="Mark all alerts read" onClick={read}>
            <CheckCheck size={16} />
          </IconButton>
          <IconButton label="Close notifications" onClick={() => toggle('notifications')}>
            <X size={16} />
          </IconButton>
        </div>
      </div>
      <div className="notification-list">
        {sim.alerts.map((a) => (
          <button
            key={a.id}
            className={!a.read ? 'unread' : ''}
            onClick={() => {
              if (a.entity) select(a.entity, true);
              toggle('notifications');
            }}
          >
            <i
              className={`dot ${a.severity === 'error' ? 'red' : a.severity === 'warning' ? 'amber' : 'cyan'}`}
            />
            <div>
              <b>{a.title}</b>
              <p>{a.message}</p>
              <span className="mono">{clock(a.time)}</span>
            </div>
          </button>
        ))}
      </div>
      <footer>
        <Badge label="All hubs connected" />
        <span>{sim.alerts.length} recent events</span>
      </footer>
    </aside>
  );
}
