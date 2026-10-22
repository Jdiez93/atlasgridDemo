import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { CanvasTexture, DoubleSide, InstancedMesh, Object3D, SRGBColorSpace } from 'three';
import { useAtlasStore } from '../store/useAtlasStore';
import type { Selection } from '../sim/types';
import { CONFIG } from '../lib/config';
interface BoxProps {
  position?: [number, number, number];
  size: [number, number, number];
  color: string;
  emissive?: boolean;
  rotation?: [number, number, number];
  opacity?: number;
}
export function Box({
  position = [0, 0, 0],
  size,
  color,
  emissive = false,
  rotation,
  opacity = 1,
}: BoxProps) {
  return (
    <mesh position={position} rotation={rotation} castShadow={!emissive} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.7}
        metalness={0.12}
        emissive={emissive ? color : '#000000'}
        emissiveIntensity={emissive ? 1.6 : 0}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}
export interface InstanceBox {
  position: [number, number, number];
  scale: [number, number, number];
  yaw?: number;
}
export function InstancedBoxes({
  items,
  color,
  emissive = false,
}: {
  items: InstanceBox[];
  color: string;
  emissive?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useEffect(() => {
    if (!ref.current) return;
    items.forEach((item, i) => {
      dummy.position.set(...item.position);
      dummy.scale.set(...item.scale);
      dummy.rotation.set(0, item.yaw ?? 0, 0);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items, dummy]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        roughness={0.75}
        emissive={emissive ? color : '#000000'}
        emissiveIntensity={emissive ? 0.65 : 0}
      />
    </instancedMesh>
  );
}
export function Label({
  text,
  position,
  width = 5,
  height = 1,
  color = '#D2D9E6',
  ground = false,
}: {
  text: string;
  position: [number, number, number];
  width?: number;
  height?: number;
  color?: string;
  ground?: boolean;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = color;
      ctx.font = '600 48px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 64, 500);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={ground ? [-Math.PI / 2, 0, 0] : undefined}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} side={DoubleSide} />
    </mesh>
  );
}
export function Interactive({
  selection,
  children,
}: {
  selection: Selection;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const select = useAtlasStore((s) => s.select);
  const setContext = useAtlasStore((s) => s.setContext);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta < 5) select(selection);
  };
  useEffect(() => {
    if (hover) document.body.style.cursor = 'pointer';
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [hover]);
  return (
    <group
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
      onContextMenu={(e) => {
        e.stopPropagation();
        e.nativeEvent.preventDefault();
        setContext({ selection, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
      }}
    >
      {children}
      {hover && (
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.85, 2.05, 32]} />
          <meshBasicMaterial
            color={CONFIG.colors.charger}
            transparent
            opacity={0.75}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
export function SelectionRing({ radius = 3 }: { radius?: number }) {
  const ref = useRef<import('three').Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.elapsedTime * 0.3;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.075, 0]}>
      <ringGeometry args={[radius, radius + 0.12, 64]} />
      <meshBasicMaterial
        color={CONFIG.colors.emerald}
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </mesh>
  );
}
export function VehiclePin({
  id,
  label,
  tone = 'green',
  selected = false,
}: {
  id: string;
  label: string;
  tone?: string;
  selected?: boolean;
}) {
  const view = useAtlasStore((st) => st.view);
  if (view === 'region' && !selected) return null;
  return (
    <Html
      position={[0, selected ? 6.2 : 5.2, 0]}
      center
      zIndexRange={[12, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div className={`vehicle-label ${selected ? 'selected' : ''}`}>
        <i className={`dot ${tone}`} />
        <b>{id}</b>
        <span>{label}</span>
      </div>
    </Html>
  );
}
