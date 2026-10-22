import { Flame, Gauge, EyeOff } from 'lucide-react';
import { useAtlasStore, type Layer } from '../store/useAtlasStore';

const LAYERS: { id: Layer; label: string; icon: typeof Flame; hint: string }[] = [
  { id: 'none', label: 'Off', icon: EyeOff, hint: '' },
  {
    id: 'congestion',
    label: 'Congestion',
    icon: Gauge,
    hint: 'Road load: stopped + queued vehicles per segment',
  },
  {
    id: 'activity',
    label: 'Dock activity',
    icon: Flame,
    hint: 'Third-party docks with a truck present',
  },
];
/** Selector de capas de datos sobre el mapa 3D y leyenda. */
export function LayerLegend() {
  const layer = useAtlasStore((s) => s.layer);
  const view = useAtlasStore((s) => s.view);
  const setLayer = useAtlasStore((s) => s.setLayer);
  if (view !== 'region') return null;
  const active = LAYERS.find((l) => l.id === layer);
  return (
    <div className="layer-legend" role="group" aria-label="Data layers">
      <div className="layer-tabs">
        {LAYERS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={layer === id ? 'active' : ''}
            aria-pressed={layer === id}
            onClick={() => setLayer(id)}
          >
            <Icon size={13} aria-hidden /> {label}
          </button>
        ))}
        <kbd title="Cycle layers">L</kbd>
      </div>
      {layer !== 'none' && (
        <div className="layer-scale">
          <span>Free</span>
          <i />
          <span>Saturated</span>
          <small>{active?.hint}</small>
        </div>
      )}
    </div>
  );
}
