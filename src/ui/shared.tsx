import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  XCircle,
} from 'lucide-react';
export function Panel({
  children,
  className = '',
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <motion.section
      aria-label={label}
      className={`panel ${className}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      {children}
    </motion.section>
  );
}
export function Badge({ label, tone = 'green' }: { label: string; tone?: string }) {
  return (
    <span className={`badge ${tone}`}>
      {tone === 'red' ? (
        <XCircle size={12} aria-hidden />
      ) : tone === 'amber' ? (
        <AlertTriangle size={12} aria-hidden />
      ) : tone === 'cyan' ? (
        <Activity size={12} aria-hidden />
      ) : (
        <CheckCircle2 size={12} aria-hidden />
      )}
      {label}
    </span>
  );
}
export function Progress({ value, tone = 'green' }: { value: number; tone?: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className={tone} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}
export function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <b className={mono ? 'mono' : ''}>{value}</b>
    </div>
  );
}
export function IconButton({
  children,
  label,
  onClick,
  active = false,
  disabled = false,
  className = '',
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`icon-button ${active ? 'active' : ''} ${className}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty">
      <span className="empty-icon">◇</span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}
export function PanelHeader({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel-header">
      <div>
        <h2>{title}</h2>
        {meta && <span className="eyebrow">{meta}</span>}
      </div>
      <div className="panel-head-actions">
        <button
          className="icon-button"
          aria-label={`About ${title}`}
          title={meta ?? `${title}: click an entity to inspect, focus or control it.`}
        >
          <HelpCircle size={13} />
        </button>
        {children}
      </div>
    </div>
  );
}
export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
}) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <div>
        <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={13} />
      </div>
    </label>
  );
}
export function Delta({ value, label = 'vs. start' }: { value: number; label?: string }) {
  const Icon = value < 0 ? ArrowDownRight : ArrowUpRight;
  return (
    <span className={`delta ${value < 0 ? 'amber' : 'green'}`}>
      <Icon size={14} aria-hidden />
      {value > 0 ? '+' : ''}
      {value} <span>{label}</span>
    </span>
  );
}
