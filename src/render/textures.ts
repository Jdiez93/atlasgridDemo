import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { mulberry32 } from '../city/rng';

type Kind = 'grass' | 'concrete';
const cache = new Map<string, CanvasTexture>();
/** Texturas procedurales (sin descargas): variación tonal, manchas, grietas y juntas. */
export function proceduralTexture(kind: Kind, base: string): CanvasTexture {
  const key = `${kind}:${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const rand = mulberry32(kind === 'grass' ? 17 : 91);
  if (g) {
    g.fillStyle = base;
    g.fillRect(0, 0, size, size);
    const blobs = kind === 'grass' ? 90 : 60;
    for (let i = 0; i < blobs; i++) {
      const x = rand() * size,
        y = rand() * size,
        r = 6 + rand() * (kind === 'grass' ? 34 : 18);
      const light = rand() > 0.5;
      g.fillStyle = light ? 'rgba(255,255,230,0.035)' : 'rgba(10,30,10,0.04)';
      if (kind === 'concrete') g.fillStyle = light ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < (kind === 'grass' ? 900 : 500); i++) {
      g.fillStyle =
        kind === 'grass'
          ? `rgba(${rand() > 0.5 ? '255,255,200' : '20,50,20'},${0.03 + rand() * 0.05})`
          : `rgba(${rand() > 0.5 ? '255,255,255' : '0,0,0'},${0.04 + rand() * 0.07})`;
      g.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
    }
    if (kind === 'concrete') {
      g.strokeStyle = 'rgba(20,24,34,0.38)';
      g.lineWidth = 2;
      g.strokeRect(1, 1, size - 2, size - 2);
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(20,24,34,0.18)';
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        let x = rand() * size,
          y = rand() * size;
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (rand() - 0.5) * 30;
          y += (rand() - 0.5) * 30;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    }
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}
const repeated = new Map<string, CanvasTexture>();
/** Copia con repetición por tamaño en metros (el mapa base se comparte). */
export function tiledTexture(
  kind: Kind,
  base: string,
  w: number,
  d: number,
  tile: number,
): CanvasTexture {
  const key = `${kind}:${base}:${w}:${d}:${tile}`;
  const hit = repeated.get(key);
  if (hit) return hit;
  const t = proceduralTexture(kind, base).clone();
  t.needsUpdate = true;
  t.repeat.set(w / tile, d / tile);
  repeated.set(key, t);
  return t;
}
