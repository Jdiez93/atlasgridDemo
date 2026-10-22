import { useEffect, useMemo, useRef, useState } from 'react';
import { type ThreeEvent } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color } from 'three';
import { useAtlasStore } from '../store/useAtlasStore';
import { rackPosition } from '../sim/math';
import { CONFIG } from '../lib/config';
import { SelectionRing, VehiclePin } from './primitives';
export function Inventory({ warehouseId }: { warehouseId: string }) {
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(
    () => () => {
      document.body.style.cursor = 'auto';
    },
    [],
  );
  const sim = useAtlasStore((s) => s.sim);
  const selection = useAtlasStore((s) => s.selection);
  const select = useAtlasStore((s) => s.select);
  const context = useAtlasStore((s) => s.setContext);
  const items = useMemo(
    () => sim.pallets.filter((p) => p.warehouseId === warehouseId && p.location === 'RACK'),
    [sim.pallets, warehouseId],
  );
  const boxes = useRef<InstancedMesh>(null);
  const bases = useRef<InstancedMesh>(null);
  const film = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useEffect(() => {
    if (!boxes.current || !bases.current || !film.current) return;
    items.forEach((p, i) => {
      const pos = rackPosition(p.rackIndex);
      const level = Math.floor(p.rackIndex / 20) * 2.05;
      dummy.position.set(pos.x, 0.72 + level, pos.z);
      dummy.scale.set(2.2, 1.15, 1.6);
      dummy.updateMatrix();
      boxes.current!.setMatrixAt(i, dummy.matrix);
      boxes.current!.setColorAt(
        i,
        new Color(
          selection?.id === p.id ? '#E9BE75' : hovered === p.id ? '#E6B978' : CONFIG.colors.pallet,
        ),
      );
      dummy.position.y = 0.13 + level;
      dummy.scale.set(2.4, 0.2, 1.8);
      dummy.updateMatrix();
      bases.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 0.95 + level;
      dummy.scale.set(2.23, 0.24, 1.63);
      dummy.updateMatrix();
      film.current!.setMatrixAt(i, dummy.matrix);
    });
    for (const ref of [boxes, bases, film]) {
      ref.current!.count = items.length;
      ref.current!.instanceMatrix.needsUpdate = true;
      ref.current!.computeBoundingSphere();
    }
    if (boxes.current.instanceColor) boxes.current.instanceColor.needsUpdate = true;
  }, [items, selection, hovered, dummy]);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const p = items[e.instanceId ?? -1];
    if (p && e.delta < 5) select({ kind: 'pallet', id: p.id });
  };
  const selected = items.find((p) => p.id === selection?.id && selection.kind === 'pallet');
  const pos = selected ? rackPosition(selected.rackIndex) : null;
  return (
    <group>
      <instancedMesh
        ref={boxes}
        args={[undefined, undefined, 128]}
        castShadow
        receiveShadow
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(items[e.instanceId ?? -1]?.id ?? null);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(null);
          document.body.style.cursor = 'auto';
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          e.nativeEvent.preventDefault();
          const p = items[e.instanceId ?? -1];
          if (p)
            context({
              selection: { kind: 'pallet', id: p.id },
              x: e.nativeEvent.clientX,
              y: e.nativeEvent.clientY,
            });
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.87} />
      </instancedMesh>
      <instancedMesh ref={bases} args={[undefined, undefined, 128]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#96774F" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={film} args={[undefined, undefined, 128]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={CONFIG.colors.film} roughness={0.4} metalness={0.22} />
      </instancedMesh>
      {selected && pos && (
        <group position={[pos.x, 0, pos.z]}>
          <SelectionRing radius={1.85} />
          <VehiclePin id={selected.id} label={selected.name} selected />
        </group>
      )}
    </group>
  );
}
