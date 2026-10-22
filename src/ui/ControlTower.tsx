import { useMemo, useState } from 'react';
import { AlertTriangle, Info, OctagonAlert, Radar, Crosshair } from 'lucide-react';
import { useAtlasStore } from '../store/useAtlasStore';
import type { Alert } from '../sim/types';
import { recommend } from '../lib/recommend';

type Filter = 'all' | Alert['severity'];
const META: Record<Alert['severity'], { label: string; rank: number; tone: string }> = {
  error: { label: 'Critical', rank: 0, tone: 'red' },
  warning: { label: 'Warning', rank: 1, tone: 'amber' },
  info: { label: 'Info', rank: 2, tone: 'cyan' },
};
const age = (seconds: number) =>
  seconds < 90 ? `${Math.max(0, Math.round(seconds))}s` : `${Math.round(seconds / 60)}m`;
function Icon({ severity }: { severity: Alert['severity'] }) {
  const p = { size: 14, 'aria-hidden': true } as const;
  return severity === 'error' ? (
    <OctagonAlert {...p} />
  ) : severity === 'warning' ? (
    <AlertTriangle {...p} />
  ) : (
    <Info {...p} />
  );
}
/** Torre de control: alertas priorizadas con filtros, acción recomendada y salto a la escena. */
export function ControlTower() {
  const alerts = useAtlasStore((s) => s.sim.alerts);
  const now = useAtlasStore((s) => s.sim.time);
  const select = useAtlasStore((s) => s.select);
  const cameraAct = useAtlasStore((s) => s.cameraAct);
  const [filter, setFilter] = useState<Filter>('all');
  const counts = useMemo(() => {
    const c = { error: 0, warning: 0, info: 0 };
    for (const a of alerts) c[a.severity]++;
    return c;
  }, [alerts]);
  const rows = useMemo(
    () =>
      alerts
        .filter((a) => filter === 'all' || a.severity === filter)
        .sort((a, b) => META[a.severity].rank - META[b.severity].rank || b.time - a.time)
        .slice(0, 12),
    [alerts, filter],
  );
  return (
    <section className="tower panel" aria-label="Control tower">
      <header className="tower-head">
        <Radar size={15} aria-hidden />
        <h2>Control tower</h2>
        <span className="tower-count">{alerts.length}</span>
      </header>
      <div className="tower-filters" role="tablist">
        {(['all', 'error', 'warning', 'info'] as const).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={filter === f ? 'active' : ''}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : META[f].label}
            <em>{f === 'all' ? alerts.length : counts[f]}</em>
          </button>
        ))}
      </div>
      <ul className="tower-list">
        {rows.length === 0 && (
          <li className="tower-empty">All clear — no alerts in this filter.</li>
        )}
        {rows.map((a) => (
          <li key={a.id} className={`tower-item ${META[a.severity].tone} ${a.read ? 'read' : ''}`}>
            <div className="tower-line">
              <span className={`tower-sev ${META[a.severity].tone}`}>
                <Icon severity={a.severity} />
                {META[a.severity].label}
              </span>
              <time>{age(now - a.time)} ago</time>
            </div>
            <strong>{a.title}</strong>
            <p>{a.message}</p>
            <div className="tower-actions">
              <span className="tower-reco">→ {recommend(a)}</span>
              {a.entity && (
                <button
                  onClick={() => {
                    select(a.entity);
                    cameraAct('center');
                  }}
                >
                  <Crosshair size={13} /> Jump to scene
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
