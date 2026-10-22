import { useEffect, useRef, useState } from 'react';
import { Boxes, CheckCircle2, Truck, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useAtlasStore } from '../store/useAtlasStore';
import { calculateKPIs } from '../sim/kpis';
import { createInitialSimulation } from '../data/seeds';
import { Panel, Delta } from './shared';
const baseline = createInitialSimulation();
function useSeries(value: number, size = 24): number[] {
  const latest = useRef(value);
  latest.current = value;
  const [series, setSeries] = useState<number[]>(() => Array(size).fill(value));
  useEffect(() => {
    const t = setInterval(() => setSeries((s) => [...s.slice(1 - size), latest.current]), 2000);
    return () => clearInterval(t);
  }, [size]);
  return series;
}
function Spark({ data, tone = 'green' }: { data: number[]; tone?: 'green' | 'amber' }) {
  const min = Math.min(...data),
    max = Math.max(...data),
    span = max - min || 1;
  const pts = data
    .map(
      (v, i) =>
        `${((i / (data.length - 1)) * 96).toFixed(1)},${(26 - ((v - min) / span) * 22).toFixed(1)}`,
    )
    .join(' ');
  return (
    <svg className="spark" viewBox="0 0 96 28" role="img" aria-label="Trend, last minute">
      <polyline
        points={pts}
        fill="none"
        stroke={tone === 'green' ? '#10B981' : '#F5A524'}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function KPIRail() {
  const sim = useAtlasStore((s) => s.sim);
  const view = useAtlasStore((s) => s.view);
  const warehouseId = useAtlasStore((s) => s.warehouseId);
  const id = view === 'world' ? undefined : warehouseId;
  const k = calculateKPIs(sim, id);
  const start = calculateKPIs(baseline, id);
  const stockSeries = useSeries(k.stock),
    truckSeries = useSeries(k.onSite),
    timeSeries = useSeries(k.onTime);
  return (
    <div className="kpi-rail">
      <span className="eyebrow rail-caption">
        {view === 'world' ? 'NETWORK PULSE' : 'SITE PERFORMANCE'}
      </span>
      <Panel className="kpi-card" label="Stock on hand">
        <div className="kpi-label">
          <span>Stock on hand</span>
          <Boxes size={17} />
        </div>
        <div className="kpi-number">
          <b data-testid="stock-kpi">{k.stock}</b>
          <span>pallets</span>
        </div>
        <div className="kpi-footer">
          <Delta value={k.stock - start.stock} />
          <Spark data={stockSeries} />
        </div>
      </Panel>
      <Panel className="kpi-card" label="Trucks on site">
        <div className="kpi-label">
          <span>Trucks on site</span>
          <Truck size={17} />
        </div>
        <div className="kpi-number">
          <b data-testid="site-trucks-kpi">{k.onSite}</b>
          <span>vehicles</span>
        </div>
        <div className="kpi-footer">
          <Delta value={k.onSite - start.onSite} />
          <Spark data={truckSeries} tone="amber" />
        </div>
      </Panel>
      <Panel className="kpi-card delivery-kpi" label="On-time delivery">
        <div className="kpi-label">
          <span>On-time delivery</span>
          <CheckCircle2 size={17} />
        </div>
        <div className="kpi-number">
          <b>
            {k.onTime}
            <em>%</em>
          </b>
        </div>
        <div className="kpi-footer">
          <span className={k.onTime >= 95 ? 'green' : 'amber'}>
            {k.onTime >= 95 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{' '}
            {sim.delivered} delivered
          </span>
          <Spark data={timeSeries} tone={k.onTime >= 95 ? 'green' : 'amber'} />
        </div>
      </Panel>
    </div>
  );
}
