import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { home } from '../src/lib/framing';
import { sunFactor } from '../src/lib/sun';
import { useAtlasStore } from '../src/store/useAtlasStore';

describe('presentación v2.1', () => {
  it('sunFactor: golden hour constante, noche oscura y ciclo acotado', () => {
    expect(sunFactor(false, false, 0)).toBe(1);
    expect(sunFactor(true, false, 0)).toBeLessThan(0.2);
    for (let t = 0; t < 600; t += 7) {
      const f = sunFactor(false, true, t);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
  it('home(): encuadra a mayor distancia cuanto más estrecho es el viewport', () => {
    const wide = { position: new Vector3(), target: new Vector3() };
    const narrow = { position: new Vector3(), target: new Vector3() };
    home(wide, 'region', 2);
    home(narrow, 'region', 0.7);
    expect(narrow.position.distanceTo(narrow.target)).toBeGreaterThan(
      wide.position.distanceTo(wide.target),
    );
    expect(wide.position.y).toBeGreaterThan(20);
    expect(wide.target.y).toBe(0);
  });
  it('paneles: se colapsan de forma independiente', () => {
    const s = useAtlasStore.getState();
    s.togglePanel('left');
    expect(useAtlasStore.getState().panels).toEqual({ left: false, right: true, dock: true });
    s.togglePanel('left');
    expect(useAtlasStore.getState().panels.left).toBe(true);
  });
  it('calidad: selección manual desactiva la auto-detección; la automática no', () => {
    const s = useAtlasStore.getState();
    s.setAutoQuality(true);
    s.setQuality('high', false);
    expect(useAtlasStore.getState().autoQuality).toBe(true);
    s.setQuality('ultra');
    expect(useAtlasStore.getState().autoQuality).toBe(false);
    expect(useAtlasStore.getState().quality).toBe('ultra');
  });
});
