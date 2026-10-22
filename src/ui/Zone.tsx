import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useAtlasStore, type PanelKey } from '../store/useAtlasStore';

const META: Record<PanelKey, { label: string; key: string; side: 'left' | 'right' | 'bottom' }> = {
  left: { label: 'KPIs', key: 'K', side: 'left' },
  right: { label: 'Inspector', key: 'I', side: 'right' },
  dock: { label: 'Operations dock', key: 'T', side: 'bottom' },
};

/** Zona fija del grid: columna/fila reservada con botón de colapso. */
export function Zone({
  name,
  className,
  children,
}: {
  name: PanelKey;
  className: string;
  children: ReactNode;
}) {
  const open = useAtlasStore((s) => s.panels[name]);
  const toggle = useAtlasStore((s) => s.togglePanel);
  const m = META[name];
  const Icon =
    m.side === 'left'
      ? open
        ? ChevronLeft
        : ChevronRight
      : m.side === 'right'
        ? open
          ? ChevronRight
          : ChevronLeft
        : open
          ? ChevronDown
          : ChevronUp;
  return (
    <section
      className={`zone ${className} ${open ? '' : 'is-collapsed'}`}
      data-open={open}
      aria-label={m.label}
    >
      <button
        className="zone-toggle"
        onClick={() => toggle(name)}
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${m.label} (${m.key})`}
        title={`${open ? 'Collapse' : 'Expand'} ${m.label} · ${m.key}`}
      >
        <Icon size={15} />
        <span className="zone-toggle-label">
          {m.label} <kbd>{m.key}</kbd>
        </span>
      </button>
      <div className="zone-body">{children}</div>
    </section>
  );
}
