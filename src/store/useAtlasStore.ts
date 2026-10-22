import { create } from 'zustand';
import { CONFIG } from '../lib/config';
import { createInitialSimulation } from '../data/seeds';
import { applyAction, tickSimulation, validateInvariants } from '../sim/engine';
import type { ActionResult, PlayerAction, Selection, Simulation } from '../sim/types';
export type Quality = 'low' | 'medium' | 'high' | 'ultra';
export interface PhotoState {
  on: boolean;
  watermark: boolean;
  scale: 1 | 2 | 3;
  request: number;
  busy: boolean;
}
export type Layer = 'none' | 'congestion' | 'activity';
export type PanelKey = 'left' | 'right' | 'dock';
export type ViewMode = 'warehouse' | 'world' | 'region' | 'fleet';
export type CameraAction = 'zoomIn' | 'zoomOut' | 'rotateLeft' | 'rotateRight' | 'reset' | 'center';
export interface CameraSnapshot {
  position: [number, number, number];
  target: [number, number, number];
}
interface SavedState {
  sim: Simulation;
  speed: 0 | 1 | 2 | 4 | 8;
  warehouseId: string;
  view: ViewMode;
  camera: CameraSnapshot | null;
  roof: boolean;
  night: boolean;
  quality: Quality;
  dayCycle: boolean;
}
interface AtlasStore extends SavedState {
  selection: Selection | null;
  follow: boolean;
  cameraCommand: { action: CameraAction; seq: number };
  palette: boolean;
  search: boolean;
  notifications: boolean;
  createModal: boolean;
  help: boolean;
  collapsed: boolean;
  panels: Record<PanelKey, boolean>;
  autoQuality: boolean;
  regionalMap: boolean;
  layer: Layer;
  director: boolean;
  directorCaption: string;
  photo: PhotoState;
  tiltShift: boolean;
  homeSeq: number;
  context: { selection: Selection; x: number; y: number } | null;
  toast: { message: string; ok: boolean; id: number } | null;
  persistenceError: boolean;
  ready: boolean;
  showFPS: boolean;
  fps: number;
  step: (count: number) => void;
  setSpeed: (speed: 0 | 1 | 2 | 4 | 8) => void;
  setView: (view: ViewMode) => void;
  setWarehouse: (id: string, level?: 'warehouse' | 'region') => void;
  setWeather: (weather: Simulation['weather']) => void;
  setQuality: (quality: Quality, manual?: boolean) => void;
  setAutoQuality: (on: boolean) => void;
  togglePanel: (key: PanelKey) => void;
  setPhoto: (patch: Partial<PhotoState>) => void;
  setCaption: (text: string) => void;
  setLayer: (layer: Layer) => void;
  importGame: (text: string) => ActionResult;
  select: (selection: Selection | null, focus?: boolean) => void;
  act: (action: PlayerAction) => ActionResult;
  reset: () => void;
  cameraAct: (action: CameraAction) => void;
  setCamera: (camera: CameraSnapshot) => void;
  toggleFollow: () => void;
  toggle: (
    key:
      | 'palette'
      | 'search'
      | 'notifications'
      | 'createModal'
      | 'help'
      | 'collapsed'
      | 'tiltShift'
      | 'director'
      | 'roof'
      | 'night'
      | 'dayCycle'
      | 'showFPS',
  ) => void;
  setContext: (context: AtlasStore['context']) => void;
  readAlerts: () => void;
  dismissToast: () => void;
}
function restore(): SavedState | null {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) return null;
    const data = JSON.parse(raw) as SavedState;
    if (
      data.sim?.version !== CONFIG.schemaVersion ||
      validateInvariants(data.sim).length ||
      !data.sim.warehouses.some((w) => w.id === data.warehouseId)
    )
      return null;
    if (
      ![0, 1, 2, 4, 8].includes(data.speed) ||
      !['world', 'warehouse', 'region', 'fleet'].includes(data.view)
    )
      return null;
    return data;
  } catch {
    return null;
  }
}
const initial: SavedState = restore() ?? {
  sim: createInitialSimulation(),
  speed: 1,
  warehouseId: 'riverside',
  view: 'region',
  camera: null,
  roof: false,
  night: false,
  quality: 'medium',
  dayCycle: true,
};
export const useAtlasStore = create<AtlasStore>((set, get) => ({
  ...initial,
  selection: null,
  follow: false,
  cameraCommand: { action: 'reset', seq: 0 },
  palette: false,
  search: false,
  notifications: false,
  createModal: false,
  help: false,
  collapsed: false,
  panels: { left: true, right: true, dock: true },
  autoQuality: true,
  regionalMap: true,
  layer: 'none',
  director: false,
  directorCaption: '',
  photo: { on: false, watermark: true, scale: 2, request: 0, busy: false },
  tiltShift: true,
  homeSeq: 0,
  context: null,
  toast: null,
  persistenceError: false,
  ready: false,
  showFPS: false,
  fps: 0,
  step: (count) => {
    const previous = get().sim;
    const sim = structuredClone(previous);
    sim.warehouses = previous.warehouses;
    for (let i = 0; i < count; i++) tickSimulation(sim);
    const current = get();
    const tracked =
      current.follow && current.selection?.kind === 'truck'
        ? sim.trucks.find((t) => t.id === current.selection?.id)
        : undefined;
    if (tracked) {
      const level: ViewMode = tracked.warehouseId ? 'warehouse' : tracked.road ? 'region' : 'world';
      set({
        sim,
        view: level,
        warehouseId: tracked.warehouseId ?? tracked.destinationId,
        ...(current.view !== level ? { camera: null } : {}),
      });
    } else set({ sim });
  },
  setSpeed: (speed) => set({ speed }),
  setView: (view) => set({ view, follow: false, context: null, camera: null }),
  setWeather: (weather) => set((s) => ({ sim: { ...s.sim, weather } })),
  setQuality: (quality, manual = true) =>
    set(manual ? { quality, autoQuality: false } : { quality }),
  setAutoQuality: (autoQuality) => set({ autoQuality }),
  setPhoto: (patch) => set((s) => ({ photo: { ...s.photo, ...patch } })),
  setCaption: (directorCaption) => set({ directorCaption }),
  setLayer: (layer) => set({ layer }),
  togglePanel: (key) => set((s) => ({ panels: { ...s.panels, [key]: !s.panels[key] } })),
  importGame: (text) => {
    try {
      const data = JSON.parse(text) as SavedState;
      if (
        data.sim?.version !== CONFIG.schemaVersion ||
        validateInvariants(data.sim).length ||
        !data.sim.warehouses.some((w) => w.id === data.warehouseId)
      )
        throw new Error('Invalid v2 save');
      if (
        ![0, 1, 2, 4, 8].includes(data.speed) ||
        !['low', 'medium', 'high', 'ultra'].includes(data.quality) ||
        !['world', 'warehouse', 'region', 'fleet'].includes(data.view) ||
        typeof data.dayCycle !== 'boolean' ||
        (data.camera &&
          (!Array.isArray(data.camera.position) ||
            !Array.isArray(data.camera.target) ||
            data.camera.position.length !== 3 ||
            data.camera.target.length !== 3 ||
            ![...data.camera.position, ...data.camera.target].every(Number.isFinite)))
      )
        throw new Error('Invalid settings');
      set({
        sim: data.sim,
        speed: data.speed,
        warehouseId: data.warehouseId,
        view: data.view,
        camera: data.camera,
        roof: data.roof,
        night: data.night,
        quality: data.quality,
        dayCycle: data.dayCycle,
        selection: null,
        follow: false,
        context: null,
        ready: true,
      });
      return { ok: true, message: 'Game loaded.' };
    } catch {
      return { ok: false, message: 'Invalid save. Use an exported AtlasGrid v2 JSON.' };
    }
  },
  setWarehouse: (id, level = 'warehouse') => {
    if (!get().sim.warehouses.some((w) => w.id === id)) return;
    set({
      warehouseId: id,
      view: level,
      selection: null,
      follow: false,
      context: null,
      camera: null,
    });
    get().cameraAct('reset');
  },
  select: (selection, focus = false) => {
    set({ selection, context: null, follow: false });
    if (!selection) return;
    if (selection.kind === 'warehouse') {
      get().setWarehouse(selection.id);
      set({ selection });
      return;
    }
    const sim = get().sim;
    let warehouseId: string | undefined;
    if (selection.kind === 'truck') {
      const t = sim.trucks.find((t) => t.id === selection.id);
      warehouseId = t?.warehouseId ?? t?.destinationId;
    } else if (selection.kind === 'pallet') {
      const p = sim.pallets.find((p) => p.id === selection.id);
      const carrier =
        p?.location === 'TRUCK' ? sim.trucks.find((t) => t.id === p.ownerId) : undefined;
      warehouseId = carrier?.warehouseId ?? carrier?.destinationId ?? p?.warehouseId;
    } else if (selection.kind === 'shipment') {
      const s = sim.shipments.find((s) => s.id === selection.id);
      warehouseId = s?.originId;
    } else {
      const pool =
        selection.kind === 'forklift'
          ? sim.forklifts
          : selection.kind === 'dock'
            ? sim.docks
            : selection.kind === 'charger'
              ? sim.chargers
              : sim.parking;
      warehouseId = pool.find((e) => e.id === selection.id)?.warehouseId;
    }
    if (focus && selection.kind === 'truck') {
      const t = sim.trucks.find((t) => t.id === selection.id);
      if (t?.state === 'EN_RUTA') {
        set({
          warehouseId: t.destinationId,
          view: t.road ? 'region' : 'world',
          camera: null,
          follow: true,
        });
        get().cameraAct('center');
        return;
      }
    }
    if (focus && warehouseId) {
      if (get().warehouseId !== warehouseId || get().view !== 'warehouse')
        set({ warehouseId, view: 'warehouse', camera: null });
      get().cameraAct('center');
    }
  },
  act: (action) => {
    const previous = get().sim;
    const sim = structuredClone(previous);
    sim.warehouses = previous.warehouses;
    const result = applyAction(sim, action);
    if (result.ok) set({ sim });
    set({ toast: { message: result.message, ok: result.ok, id: Date.now() }, context: null });
    if (result.selection) set({ selection: result.selection });
    return result;
  },
  reset: () => {
    set({
      sim: createInitialSimulation(),
      speed: 1,
      view: 'warehouse',
      warehouseId: 'riverside',
      selection: null,
      follow: false,
      camera: null,
      context: null,
      toast: { message: 'Simulation reset. All entities restored.', ok: true, id: Date.now() },
    });
    get().cameraAct('reset');
  },
  cameraAct: (action) =>
    set((s) => ({
      cameraCommand: { action, seq: s.cameraCommand.seq + 1 },
      follow: action === 'center' ? s.follow : false,
    })),
  setCamera: (camera) => set({ camera }),
  toggleFollow: () => {
    const selection = get().selection;
    if (selection?.kind === 'truck') set((s) => ({ follow: !s.follow }));
    else
      set({ toast: { message: 'Select a truck first to follow it.', ok: false, id: Date.now() } });
  },
  toggle: (key) => set((s) => ({ [key]: !s[key] })),
  setContext: (context) => set({ context, selection: context?.selection ?? get().selection }),
  readAlerts: () => {
    const sim = structuredClone(get().sim);
    sim.alerts.forEach((a) => {
      a.read = true;
    });
    set({ sim });
  },
  dismissToast: () => set({ toast: null }),
}));
export function persistSnapshot(): void {
  const { sim, speed, warehouseId, view, camera, roof, night, quality, dayCycle } =
    useAtlasStore.getState();
  try {
    localStorage.setItem(
      CONFIG.storageKey,
      JSON.stringify({
        sim,
        speed,
        warehouseId,
        view,
        camera,
        roof,
        night,
        quality,
        dayCycle,
      } satisfies SavedState),
    );
    if (useAtlasStore.getState().persistenceError)
      useAtlasStore.setState({ persistenceError: false });
  } catch {
    if (!useAtlasStore.getState().persistenceError)
      useAtlasStore.setState({ persistenceError: true });
  }
}
