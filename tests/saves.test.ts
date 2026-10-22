import { describe, expect, it } from 'vitest';
import { useAtlasStore } from '../src/store/useAtlasStore';
function save() {
  const s = useAtlasStore.getState();
  return {
    sim: structuredClone(s.sim),
    speed: 8,
    warehouseId: 'northgate',
    view: 'region',
    camera: null,
    roof: false,
    night: true,
    quality: 'low',
    dayCycle: false,
  };
}
describe('portable saved games', () => {
  it('loads a complete v2 game with settings and preserves store actions', () => {
    useAtlasStore.getState().reset();
    const data = { ...save(), step: 'untrusted extra property' };
    expect(useAtlasStore.getState().importGame(JSON.stringify(data)).ok).toBe(true);
    expect(useAtlasStore.getState()).toMatchObject({
      warehouseId: 'northgate',
      speed: 8,
      quality: 'low',
      night: true,
      dayCycle: false,
    });
    expect(typeof useAtlasStore.getState().step).toBe('function');
  });
  it('rejects an incompatible v1 save or invalid speed without changing the game', () => {
    const before = useAtlasStore.getState().sim,
      data = save();
    data.speed = 500;
    expect(useAtlasStore.getState().importGame(JSON.stringify(data)).ok).toBe(false);
    expect(useAtlasStore.getState().sim).toBe(before);
    data.speed = 1;
    data.sim.version = 1;
    expect(useAtlasStore.getState().importGame(JSON.stringify(data)).ok).toBe(false);
  });
  it('rejects malformed roads before the next tick can execute', () => {
    const data = save();
    data.sim.traffic[0].nodes[1] = 'missing-node';
    expect(useAtlasStore.getState().importGame(JSON.stringify(data)).ok).toBe(false);
  });
  it('keeps following the same vehicle through world, region and hub levels', () => {
    useAtlasStore.getState().reset();
    useAtlasStore.getState().sim.nextDispatchAt = 1e9;
    useAtlasStore.getState().select({ kind: 'truck', id: 'TRK-03' }, true);
    expect(useAtlasStore.getState().view).toBe('world');
    useAtlasStore.getState().step(1);
    expect(useAtlasStore.getState().view).toBe('region');
    useAtlasStore.getState().step(2000);
    expect(useAtlasStore.getState()).toMatchObject({
      view: 'warehouse',
      warehouseId: 'riverside',
      follow: true,
    });
  });
});
