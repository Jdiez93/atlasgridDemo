import {
  Box,
  ChevronDown,
  Globe2,
  HelpCircle,
  LocateFixed,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Truck,
  Pause,
  Play,
  PanelBottomClose,
  Sun,
  Moon,
  Camera,
  Clapperboard,
  Layers,
  ChevronsUpDown,
  Navigation,
  Map,
} from 'lucide-react';
import { useAtlasStore, type ViewMode } from '../store/useAtlasStore';
import { calculateKPIs } from '../sim/kpis';
import { IconButton } from './shared';
export function ViewBar() {
  const view = useAtlasStore((s) => s.view);
  const sim = useAtlasStore((s) => s.sim);
  const id = useAtlasStore((s) => s.warehouseId);
  const setView = useAtlasStore((s) => s.setView);
  const toggle = useAtlasStore((s) => s.toggle);
  const w = sim.warehouses.find((w) => w.id === id)!;
  const modes: { id: ViewMode; label: string; icon: typeof Box }[] = [
    { id: 'warehouse', label: 'Warehouse', icon: Box },
    { id: 'world', label: 'World', icon: Globe2 },
    { id: 'region', label: 'Region', icon: Map },
    { id: 'fleet', label: 'Fleet', icon: Truck },
  ];
  return (
    <div className="viewbar">
      <nav className="view-tabs" aria-label="View modes">
        {modes.map((m) => (
          <button
            key={m.id}
            aria-label={m.label}
            className={view === m.id ? 'active' : ''}
            onClick={() => setView(m.id)}
          >
            <m.icon size={15} />
            {m.label}
            {m.id === 'fleet' && <span className="tab-count">{sim.trucks.length}</span>}
          </button>
        ))}
      </nav>
      <div className="scene-breadcrumb">
        <span>{view === 'world' ? 'GLOBAL NETWORK' : w.city.toUpperCase()}</span>
        <i>/</i>
        <b>{view === 'world' ? 'Eight hubs. One living network.' : w.name}</b>
        <ChevronDown size={12} />
      </div>
      <button className="new-shipment button" onClick={() => toggle('createModal')}>
        <Plus size={14} />
        Create shipment
      </button>
    </div>
  );
}
export function CameraControls() {
  const cameraAct = useAtlasStore((s) => s.cameraAct);
  const follow = useAtlasStore((s) => s.follow);
  const toggleFollow = useAtlasStore((s) => s.toggleFollow);
  const roof = useAtlasStore((s) => s.roof);
  const night = useAtlasStore((s) => s.night);
  const toggle = useAtlasStore((s) => s.toggle);
  const director = useAtlasStore((s) => s.director);
  const photoOn = useAtlasStore((s) => s.photo.on);
  const setPhoto = useAtlasStore((s) => s.setPhoto);
  return (
    <div className="camera-controls" aria-label="Camera controls">
      <div className="camera-stack">
        <IconButton label="Zoom in" onClick={() => cameraAct('zoomIn')}>
          <Plus size={17} />
        </IconButton>
        <IconButton label="Zoom out" onClick={() => cameraAct('zoomOut')}>
          <Minus size={17} />
        </IconButton>
        <i />
        <IconButton label="Rotate left (Q)" onClick={() => cameraAct('rotateLeft')}>
          <RotateCcw size={16} />
        </IconButton>
        <IconButton label="Rotate right (E)" onClick={() => cameraAct('rotateRight')}>
          <RotateCw size={16} />
        </IconButton>
        <IconButton label="Home · fit view (R)" onClick={() => cameraAct('reset')}>
          <ChevronsUpDown size={16} />
        </IconButton>
        <IconButton label="Center selection" onClick={() => cameraAct('center')}>
          <LocateFixed size={17} />
        </IconButton>
        <IconButton label="Follow selected truck (F)" active={follow} onClick={toggleFollow}>
          <Navigation size={16} />
        </IconButton>
      </div>
      <div className="camera-stack">
        <IconButton label="Toggle warehouse roof" active={roof} onClick={() => toggle('roof')}>
          <Layers size={16} />
        </IconButton>
        <IconButton label="Toggle night lighting" active={night} onClick={() => toggle('night')}>
          {night ? <Moon size={16} /> : <Sun size={16} />}
        </IconButton>
        <IconButton label="Director mode (V)" active={director} onClick={() => toggle('director')}>
          <Clapperboard size={16} />
        </IconButton>
        <IconButton
          label="Photo mode (P)"
          active={photoOn}
          onClick={() => setPhoto({ on: !photoOn })}
        >
          <Camera size={16} />
        </IconButton>
      </div>
    </div>
  );
}
export function BottomBar() {
  const sim = useAtlasStore((s) => s.sim);
  const speed = useAtlasStore((s) => s.speed);
  const setSpeed = useAtlasStore((s) => s.setSpeed);
  const toggle = useAtlasStore((s) => s.toggle);
  const collapsed = useAtlasStore((s) => s.collapsed);
  const error = useAtlasStore((s) => s.persistenceError);
  const k = calculateKPIs(sim);
  return (
    <footer className="bottom-bar">
      <div className="sim-controls">
        <IconButton
          label={speed === 0 ? 'Resume simulation' : 'Pause simulation'}
          onClick={() => setSpeed(speed === 0 ? 1 : 0)}
        >
          {speed === 0 ? <Play size={15} /> : <Pause size={15} />}
        </IconButton>
        <span className="eyebrow">SIMULATION</span>
        {([1, 2, 4, 8] as const).map((n) => (
          <button
            key={n}
            className={`speed-button ${speed === n ? 'active' : ''}`}
            onClick={() => setSpeed(n)}
          >
            ×{n}
          </button>
        ))}
        <span className="fixed-tick">10 Hz fixed tick</span>
      </div>
      <div className="fleet-counters" data-testid="fleet-counters">
        <span>
          <i className="dot cyan" />
          En route <b>{k.inRoute}</b>
        </span>
        <span>
          <i className="dot green" />
          Parked <b data-testid="parked-kpi">{k.parked}</b>
        </span>
        <span>
          <i className="dot amber" />
          At dock <b>{k.atDock}</b>
        </span>
        <span>
          <i className="dot red" />
          Maintenance <b>{k.maintenance}</b>
        </span>
      </div>
      <div className="bottom-actions">
        <span className={`save-status ${error ? 'amber' : ''}`}>
          <i className={`dot ${error ? 'amber' : 'green'}`} />
          {error ? 'Save unavailable' : 'Local autosave'}
        </span>
        <IconButton
          label="Collapse HUD panels"
          active={collapsed}
          onClick={() => toggle('collapsed')}
        >
          <PanelBottomClose size={16} />
        </IconButton>
        <IconButton label="Controls and help" onClick={() => toggle('help')}>
          <HelpCircle size={17} />
        </IconButton>
      </div>
    </footer>
  );
}
