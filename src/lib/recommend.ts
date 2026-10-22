import type { Alert } from '../sim/types';

/** Acción recomendada derivada del contenido de la alerta. */
export function recommend(alert: Pick<Alert, 'title' | 'message'>): string {
  const text = `${alert.title} ${alert.message}`.toLowerCase();
  if (/clos|incident|block/.test(text)) return 'Divert via the alternate corridor';
  if (/delay|late|wait/.test(text)) return 'Re-assign a free dock to recover time';
  if (/batter|charge|energy/.test(text)) return 'Send the forklift to a charger';
  if (/maint|fault|broke/.test(text)) return 'Dispatch maintenance and re-plan loads';
  if (/stock|full|capacity|occup/.test(text)) return 'Rebalance pallets across racks';
  return 'Review details in the inspector';
}
