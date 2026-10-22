import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import {
  CanvasTexture,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  ShaderMaterial,
  SRGBColorSpace,
  Sprite,
  Vector3,
  AmbientLight,
  BackSide,
} from 'three';
import { useAtlasStore } from '../store/useAtlasStore';
import { sunFactor } from '../lib/sun';

const SUN_DIR = new Vector3(-0.62, 0.34, 0.7).normalize();
const PALETTE = {
  day: {
    top: new Color('#4F86CF'),
    mid: new Color('#9EC3E8'),
    horizon: new Color('#FFD7A3'),
    glow: new Color('#FFB35E'),
    fog: new Color('#EBCFA6'),
    sun: new Color('#FFC689'),
    hemiSky: new Color('#D4E2EF'),
    hemiGround: new Color('#B8A07C'),
  },
  night: {
    top: new Color('#101C3F'),
    mid: new Color('#243762'),
    horizon: new Color('#46598C'),
    glow: new Color('#6C7FB8'),
    fog: new Color('#2E3E69'),
    sun: new Color('#8FA6E6'),
    hemiSky: new Color('#4C629B'),
    hemiGround: new Color('#222B45'),
  },
};
const tmp = new Color();
function mix(a: Color, b: Color, t: number, out: Color): Color {
  return out.copy(b).lerp(a, t);
}

export function Lighting() {
  const sunRef = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const amb = useRef<AmbientLight>(null);
  const quality = useAtlasStore((s) => s.quality);
  const view = useAtlasStore((s) => s.view);
  const { scene } = useThree();
  useFrame(() => {
    const s = useAtlasStore.getState();
    const f = sunFactor(s.night, s.dayCycle, s.sim.time);
    if (sunRef.current) {
      mix(PALETTE.day.sun, PALETTE.night.sun, f, sunRef.current.color);
      sunRef.current.intensity = 0.35 + f * 3.1;
    }
    if (hemi.current) {
      mix(PALETTE.day.hemiSky, PALETTE.night.hemiSky, f, hemi.current.color);
      mix(PALETTE.day.hemiGround, PALETTE.night.hemiGround, f, hemi.current.groundColor);
      hemi.current.intensity = 0.7 + f * 0.95;
    }
    if (amb.current) amb.current.intensity = 0.3 + f * 0.32;
    if (scene.fog instanceof Fog) mix(PALETTE.day.fog, PALETTE.night.fog, f, scene.fog.color);
  });
  const mapSize = quality === 'ultra' ? 4096 : quality === 'high' ? 2048 : 1024;
  return (
    <>
      <hemisphereLight ref={hemi} args={['#BBD6F2', '#8C7B5E', 1.2]} />
      <ambientLight ref={amb} color="#FFE8CF" intensity={0.4} />
      <directionalLight
        ref={sunRef}
        position={[SUN_DIR.x * 110, SUN_DIR.y * 110, SUN_DIR.z * 110]}
        castShadow={quality !== 'low' && view !== 'world'}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-camera-left={-78}
        shadow-camera-right={78}
        shadow-camera-top={72}
        shadow-camera-bottom={-72}
        shadow-camera-near={1}
        shadow-camera-far={260}
        shadow-bias={-0.0006}
        shadow-normalBias={0.05}
        shadow-radius={4}
        shadow-intensity={0.6}
      />
      {quality !== 'low' && (
        <Environment resolution={128} frames={1} environmentIntensity={0.45}>
          <Lightformer
            form="rect"
            intensity={2.2}
            color="#FFD3A0"
            position={[-30, 12, 30]}
            scale={[40, 12, 1]}
          />
          <Lightformer
            form="rect"
            intensity={1.1}
            color="#9EC3E8"
            position={[0, 40, 0]}
            rotation-x={Math.PI / 2}
            scale={[80, 80, 1]}
          />
          <Lightformer
            form="ring"
            intensity={0.8}
            color="#FFFFFF"
            position={[25, 18, -30]}
            scale={14}
          />
        </Environment>
      )}
    </>
  );
}

const SKY_VERT = `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position,1.0);
  gl_Position = projectionMatrix * p;
}`;
const SKY_FRAG = `
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uSun;
varying vec3 vDir;
void main(){
  float h = clamp(vDir.y, -0.2, 1.0);
  vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
  c = mix(c, uTop, smoothstep(0.22, 0.95, h));
  float s = max(dot(normalize(vDir), normalize(uSun)), 0.0);
  c += uGlow * (pow(s, 6.0) * 0.55 + pow(s, 48.0) * 0.8);
  c = mix(c, uHorizon, smoothstep(0.0, -0.2, vDir.y) * 0.85);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export function SkyDome() {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new Color() },
          uMid: { value: new Color() },
          uHorizon: { value: new Color() },
          uGlow: { value: new Color() },
          uSun: { value: SUN_DIR.clone() },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
      }),
    [],
  );
  useFrame(({ camera }) => {
    const s = useAtlasStore.getState();
    const f = sunFactor(s.night, s.dayCycle, s.sim.time);
    const u = material.uniforms;
    mix(PALETTE.day.top, PALETTE.night.top, f, u.uTop.value as Color);
    mix(PALETTE.day.mid, PALETTE.night.mid, f, u.uMid.value as Color);
    mix(PALETTE.day.horizon, PALETTE.night.horizon, f, u.uHorizon.value as Color);
    mix(PALETTE.day.glow, PALETTE.night.glow, f, u.uGlow.value as Color);
    if (mesh.current) mesh.current.position.copy(camera.position);
  });
  return (
    <mesh ref={mesh} renderOrder={-10} frustumCulled={false} material={material}>
      <sphereGeometry args={[620, 32, 16]} />
    </mesh>
  );
}

function cloudTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0.4)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function Clouds() {
  const group = useRef<Group>(null);
  const texture = useMemo(cloudTexture, []);
  const items = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        x: ((i * 211) % 900) - 450,
        y: 150 + ((i * 37) % 70),
        z: ((i * 349) % 900) - 450,
        s: 90 + ((i * 53) % 110),
        o: 0.45 + ((i * 17) % 30) / 100,
      })),
    [],
  );
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const s = useAtlasStore.getState();
    const f = sunFactor(s.night, s.dayCycle, s.sim.time);
    for (const child of g.children) {
      child.position.x += dt * 2.4 * Math.max(0.3, s.speed);
      if (child.position.x > 460) child.position.x = -460;
      const sprite = child as Sprite;
      mix(new Color('#FFE4C4'), new Color('#4A5A88'), f, tmp);
      sprite.material.color.copy(tmp);
    }
  });
  return (
    <group ref={group}>
      {items.map((c, i) => (
        <sprite key={i} position={[c.x, c.y, c.z]} scale={[c.s * 2, c.s * 0.7, 1]}>
          <spriteMaterial map={texture} transparent opacity={c.o} depthWrite={false} fog={false} />
        </sprite>
      ))}
    </group>
  );
}
