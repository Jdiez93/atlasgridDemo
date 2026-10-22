import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Camera, Download, X } from 'lucide-react';
import { useAtlasStore } from '../store/useAtlasStore';

/** Dibuja la marca de agua AtlasGrid sobre la captura y descarga el PNG. */
async function exportPng(dataUrl: string, watermark: boolean, caption: string): Promise<void> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  if (!g) return;
  g.drawImage(img, 0, 0);
  if (watermark) {
    const u = Math.max(1, img.width / 1920);
    const pad = 36 * u;
    g.font = `700 ${34 * u}px Inter, sans-serif`;
    const word = 'ATLASGRID';
    const sub = caption.toUpperCase();
    g.font = `500 ${15 * u}px "JetBrains Mono", monospace`;
    const subW = g.measureText(sub).width;
    g.font = `700 ${34 * u}px Inter, sans-serif`;
    const w = Math.max(g.measureText(word).width + 64 * u, subW + 64 * u);
    const x = img.width - pad - w,
      y = img.height - pad - 78 * u;
    g.fillStyle = 'rgba(23,32,51,0.72)';
    g.beginPath();
    g.roundRect(x, y, w, 78 * u, 12 * u);
    g.fill();
    g.fillStyle = '#10B981';
    g.fillRect(x + 18 * u, y + 20 * u, 22 * u, 22 * u);
    g.fillStyle = '#F5A524';
    g.fillRect(x + 28 * u, y + 30 * u, 14 * u, 14 * u);
    g.fillStyle = '#F4F7FB';
    g.textBaseline = 'alphabetic';
    g.fillText('ATLAS', x + 52 * u, y + 44 * u);
    const aw = g.measureText('ATLAS').width;
    g.fillStyle = '#10B981';
    g.fillText('GRID', x + 52 * u + aw, y + 44 * u);
    g.font = `500 ${15 * u}px "JetBrains Mono", monospace`;
    g.fillStyle = '#B6C0D4';
    g.fillText(sub, x + 52 * u, y + 66 * u);
  }
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = `atlasgrid-${Date.now()}.png`;
  a.click();
}
/** Dentro del Canvas: espera a que el render a alta resolución esté listo y captura el frame. */
export function PhotoCapture() {
  const gl = useThree((s) => s.gl);
  const request = useAtlasStore((s) => s.photo.request);
  const frames = useRef(-1);
  const seen = useRef(0);
  useEffect(() => {
    if (request > seen.current) {
      seen.current = request;
      frames.current = 5;
      useAtlasStore.getState().setPhoto({ busy: true });
    }
  }, [request]);
  useFrame(() => {
    if (frames.current < 0) return;
    frames.current--;
    if (frames.current > 0) return;
    frames.current = -1;
    const s = useAtlasStore.getState();
    const url = gl.domElement.toDataURL('image/png');
    const hub = s.sim.warehouses.find((w) => w.id === s.warehouseId);
    exportPng(url, s.photo.watermark, hub ? `${hub.name} · ${hub.city}` : 'Operations control')
      .catch(() => undefined)
      .finally(() => useAtlasStore.getState().setPhoto({ busy: false }));
  }, 1000);
  return null;
}
export function PhotoBar() {
  const photo = useAtlasStore((s) => s.photo);
  const set = useAtlasStore((s) => s.setPhoto);
  if (!photo.on) return null;
  return (
    <div className="photo-bar" role="toolbar" aria-label="Photo mode">
      <Camera size={15} aria-hidden />
      <b>PHOTO MODE</b>
      <span className="photo-sep" />
      {([1, 2, 3] as const).map((n) => (
        <button
          key={n}
          className={photo.scale === n ? 'active' : ''}
          onClick={() => set({ scale: n })}
          title={`Export at ${n}× resolution`}
        >
          {n}×
        </button>
      ))}
      <label className="photo-check">
        <input
          type="checkbox"
          checked={photo.watermark}
          onChange={(e) => set({ watermark: e.target.checked })}
        />
        Watermark
      </label>
      <button
        className="photo-export"
        disabled={photo.busy}
        onClick={() => set({ request: photo.request + 1 })}
      >
        <Download size={14} />
        {photo.busy ? 'Rendering…' : 'Export PNG'}
      </button>
      <button
        className="photo-close"
        onClick={() => set({ on: false })}
        aria-label="Close photo mode (P)"
      >
        <X size={15} />
      </button>
    </div>
  );
}
