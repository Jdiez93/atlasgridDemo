import { useRef, useState } from 'react';
import { Download, Upload, Save, Settings2, HelpCircle } from 'lucide-react';
import { useAtlasStore, persistSnapshot } from '../store/useAtlasStore';
import { ROAD_GRAPH } from '../world/roads';
import { Panel, PanelHeader } from './shared';
export function NetworkTools({ part }: { part: 'minimap' | 'settings' }) {
  const sim = useAtlasStore((s) => s.sim),
    view = useAtlasStore((s) => s.view),
    warehouseId = useAtlasStore((s) => s.warehouseId),
    camera = useAtlasStore((s) => s.camera);
  const quality = useAtlasStore((s) => s.quality),
    cycle = useAtlasStore((s) => s.dayCycle),
    showFPS = useAtlasStore((s) => s.showFPS),
    auto = useAtlasStore((s) => s.autoQuality),
    tilt = useAtlasStore((s) => s.tiltShift),
    fps = useAtlasStore((s) => s.fps);
  const file = useRef<HTMLInputElement>(null),
    regional = useAtlasStore((s) => s.regionalMap),
    setRegional = (v: boolean) => useAtlasStore.setState({ regionalMap: v }),
    [message, setMessage] = useState('');
  const region = regional && view === 'region';
  const position = (x: number, z: number) => ({
    x: region ? 12 + ((x - 40) / 310) * 240 : 12 + ((x + 85) / 170) * 240,
    y: region ? 8 + ((z + 125) / 255) * 128 : 8 + ((z + 55) / 105) * 128,
  });
  const point = camera
    ? position(
        ...(region || view === 'world'
          ? ([camera.target[0], camera.target[2]] as const)
          : ([
              sim.warehouses.find((w) => w.id === warehouseId)!.map.x,
              sim.warehouses.find((w) => w.id === warehouseId)!.map.z,
            ] as const)),
      )
    : null;
  const save = () => {
    persistSnapshot();
    const s = useAtlasStore.getState(),
      blob = new Blob(
        [
          JSON.stringify({
            sim: s.sim,
            speed: s.speed,
            warehouseId: s.warehouseId,
            view: s.view,
            camera: s.camera,
            roof: s.roof,
            night: s.night,
            quality: s.quality,
            dayCycle: s.dayCycle,
          }),
        ],
        { type: 'application/json' },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'atlasgrid-save-v2.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Save exported.');
  };
  return (
    <>
      {part === 'minimap' && (view === 'world' || view === 'region') && (
        <Panel className="network-minimap" label="Network minimap">
          <PanelHeader
            title={region ? 'Regional minimap' : 'World minimap'}
            meta={region ? 'ROADS / CAMERA / LIVE TRAFFIC' : '8 HUBS / 30 FLEET VEHICLES'}
          >
            <button
              className="text-button"
              aria-label={region ? 'Show world minimap' : 'Show regional minimap'}
              onClick={() => {
                if (view === 'world') {
                  setRegional(true);
                  useAtlasStore.getState().setView('region');
                } else setRegional(!regional);
              }}
              title="Switch regional / global minimap"
            >
              {region ? 'World' : 'Region'}
            </button>
          </PanelHeader>
          <svg
            viewBox="0 0 264 148"
            role="img"
            aria-label={
              region
                ? 'Road network with live vehicles and camera target'
                : 'All hubs and fleet locations'
            }
          >
            {region
              ? ROAD_GRAPH.edges
                  .filter((e) => e.from < e.to || e.from.startsWith('r'))
                  .map((e) => {
                    const a = ROAD_GRAPH.nodes.find((n) => n.id === e.from)!,
                      b = ROAD_GRAPH.nodes.find((n) => n.id === e.to)!,
                      p = position(a.x, a.z),
                      q = position(b.x, b.z);
                    return (
                      <line
                        key={e.id}
                        x1={p.x}
                        y1={p.y}
                        x2={q.x}
                        y2={q.y}
                        stroke="#425A6C"
                        strokeWidth="2"
                      />
                    );
                  })
              : sim.warehouses.map((w, i) => {
                  const b = sim.warehouses[(i + 1) % sim.warehouses.length],
                    p = position(w.map.x, w.map.z),
                    q = position(b.map.x, b.map.z);
                  return (
                    <line
                      key={w.id}
                      x1={p.x}
                      y1={p.y}
                      x2={q.x}
                      y2={q.y}
                      stroke="#254D47"
                      strokeDasharray="3 4"
                    />
                  );
                })}
            {!region &&
              sim.warehouses.map((w) => {
                const p = position(w.map.x, w.map.z);
                return (
                  <g
                    key={w.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Explore ${w.city}`}
                    onClick={() => useAtlasStore.getState().setWarehouse(w.id, 'region')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        useAtlasStore.getState().setWarehouse(w.id, 'region');
                      }
                    }}
                  >
                    <circle cx={p.x} cy={p.y} r={w.id === warehouseId ? 5 : 3.5} fill={w.accent} />
                    <text x={p.x + 6} y={p.y + 3} fill="#D2DAE3" fontSize="7">
                      {w.code}
                    </text>
                  </g>
                );
              })}
            {sim.trucks
              .filter(
                (t) =>
                  !region || t.road?.warehouseId === warehouseId || t.warehouseId === warehouseId,
              )
              .map((t) => {
                const a = sim.warehouses.find((w) => w.id === t.originId)!.map,
                  b = sim.warehouses.find((w) => w.id === (t.warehouseId ?? t.destinationId))!.map,
                  progress = t.warehouseId ? 1 : t.routeProgress,
                  p = region
                    ? position(t.position.x, t.position.z)
                    : position(a.x + (b.x - a.x) * progress, a.z + (b.z - a.z) * progress);
                return (
                  <circle
                    key={t.id}
                    cx={p.x}
                    cy={p.y}
                    r="1.8"
                    fill="#22D3EE"
                    onClick={() =>
                      useAtlasStore.getState().select({ kind: 'truck', id: t.id }, true)
                    }
                  >
                    <title>{t.id}</title>
                  </circle>
                );
              })}
            {region &&
              sim.traffic
                .filter((a) => a.warehouseId === warehouseId)
                .map((a) => {
                  const p = position(a.position.x, a.position.z);
                  return <circle key={a.id} cx={p.x} cy={p.y} r="1.1" fill="#839BA7" />;
                })}
            {point && (
              <circle
                cx={Math.max(4, Math.min(260, point.x))}
                cy={Math.max(4, Math.min(144, point.y))}
                r="9"
                fill="none"
                stroke="#F5A524"
                strokeWidth="1.3"
              >
                <title>Camera target</title>
              </circle>
            )}
          </svg>
          <div className="map-legend">
            <span>
              <i className="dot green" />
              Hub
            </span>
            <span>
              <i className="dot cyan" />
              Fleet
            </span>
            <span>
              <i className="dot amber" />
              Camera
            </span>
          </div>
        </Panel>
      )}
      {part === 'settings' && (
        <details className="network-settings">
          <summary>
            <Settings2 size={14} />
            Environment & save
          </summary>
          <div className="panel settings-content">
            <h3>
              Scene & game settings <HelpCircle size={14} />
            </h3>
            <p>Visual quality, road conditions and portable saved games.</p>
            <label>
              Quality
              <select
                aria-label="Visual quality"
                value={auto ? 'auto' : quality}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'auto') useAtlasStore.getState().setAutoQuality(true);
                  else useAtlasStore.getState().setQuality(v as typeof quality);
                }}
              >
                <option value="auto">Auto · detect FPS</option>
                <option value="low">Low · no postprocessing</option>
                <option value="medium">Medium · bloom + shadows</option>
                <option value="high">High · AO + SMAA</option>
                <option value="ultra">Ultra · full AO + 4K shadows</option>
              </select>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={tilt}
                onChange={() => useAtlasStore.getState().toggle('tiltShift')}
              />
              Tilt-shift depth of field (Ultra)
            </label>
            <label>
              Weather
              <select
                aria-label="Weather"
                value={sim.weather}
                onChange={(e) =>
                  useAtlasStore.getState().setWeather(e.target.value as typeof sim.weather)
                }
              >
                <option value="clear">Clear</option>
                <option value="rain">Rain · slower roads</option>
                <option value="fog">Fog · reduced visibility</option>
              </select>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={cycle}
                onChange={() => useAtlasStore.getState().toggle('dayCycle')}
              />
              Automatic day / night
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={showFPS}
                onChange={() => useAtlasStore.getState().toggle('showFPS')}
              />
              Show FPS
            </label>
            <div className="settings-save">
              <button
                className="button"
                onClick={() => {
                  persistSnapshot();
                  setMessage('Game saved locally.');
                }}
              >
                <Save size={13} />
                Save
              </button>
              <button className="button" onClick={save}>
                <Download size={13} />
                Export
              </button>
              <button className="button" onClick={() => file.current?.click()}>
                <Upload size={13} />
                Import
              </button>
            </div>
            <input
              hidden
              ref={file}
              type="file"
              accept=".json,application/json"
              aria-label="Import game JSON"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2_000_000) {
                  setMessage('Save must be under 2 MB.');
                  return;
                }
                const result = useAtlasStore.getState().importGame(await f.text());
                setMessage(result.message);
                e.target.value = '';
              }}
            />
            {message && <p role="status">{message}</p>}
            <div className="map-legend">
              <span>
                <i className="dot green" />
                Ready
              </span>
              <span>
                <i className="dot amber" />
                Warning
              </span>
              <span>
                <i className="dot red" />
                Held
              </span>
              <span>
                <i className="dot cyan" />
                Transit
              </span>
            </div>
          </div>
        </details>
      )}
      {part === 'settings' && showFPS && (
        <div className="fps-readout mono">
          {fps} FPS / {quality.toUpperCase()}
        </div>
      )}
    </>
  );
}
