import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { Box } from '../../scene/primitives';
import { RUNWAY, planeAt } from '../../city/population';
import { ColoredInstances, cityClock } from './ColoredInstances';
import type { Inst } from '../../city/scenery';

function Plane() {
  const g = useRef<Group>(null);
  useFrame(() => {
    const p = planeAt(cityClock.t);
    if (!g.current) return;
    g.current.visible = p.visible;
    g.current.position.set(p.x, p.y + 4.6, p.z);
    g.current.rotation.set(-p.pitch, p.yaw, 0, 'YXZ');
  });
  return (
    <group ref={g} scale={1.5}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[3.4, 3.4, 52, 16]} />
        <meshStandardMaterial color="#F4F7FB" roughness={0.35} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0, 28]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[3.4, 8, 16]} />
        <meshStandardMaterial color="#F4F7FB" roughness={0.35} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.4, -29]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[3.2, 9, 16]} />
        <meshStandardMaterial color="#F4F7FB" roughness={0.35} />
      </mesh>
      <Box position={[0, -0.6, 4]} size={[62, 0.6, 9]} color="#E8EDF3" />
      <Box position={[0, 0.2, -26]} size={[20, 0.4, 5]} color="#E8EDF3" />
      <Box position={[0, 7, -26]} size={[0.5, 11, 7]} color="#F5A524" />
      {[-1, 1].flatMap((s) =>
        [14, 24].map((x) => (
          <mesh
            key={`${s}${x}`}
            position={[s * x, -2.4, 7]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[1.5, 1.5, 6, 12]} />
            <meshStandardMaterial color="#C9CED6" metalness={0.6} roughness={0.35} />
          </mesh>
        )),
      )}
      <Box position={[0, 2.2, 22]} size={[4.6, 1, 3]} color="#1B2A3A" />
      <Box position={[0, 0.2, 2]} size={[3.5, 0.5, 40]} color="#F5A524" />
    </group>
  );
}
/** Cargo aeroportuario: pista, calles de rodaje, avión que despega/aterriza, torre, hangares y helipuerto. */
export function AirportKit() {
  const len = RUNWAY.x1 - RUNWAY.x0;
  const cx = (RUNWAY.x0 + RUNWAY.x1) / 2;
  const marks = useMemo<Inst[]>(() => {
    const out: Inst[] = [];
    for (let x = RUNWAY.x0 + 20; x < RUNWAY.x1 - 20; x += 22)
      out.push({ position: [x, 0.16, RUNWAY.z], scale: [10, 0.04, 0.7], color: '#F4F7FB' });
    for (const end of [RUNWAY.x0 + 6, RUNWAY.x1 - 6])
      for (let i = -4; i <= 4; i++)
        out.push({
          position: [end, 0.16, RUNWAY.z + i * 2.2],
          scale: [6, 0.04, 0.9],
          color: '#F4F7FB',
        });
    for (const x of [60, 190, 330])
      out.push({ position: [x, 0.15, RUNWAY.z + 20], scale: [1.2, 0.04, 36], color: '#F5C84B' });
    return out;
  }, []);
  return (
    <group>
      <Box position={[cx, 0.08, RUNWAY.z]} size={[len + 60, 0.16, RUNWAY.width]} color="#3B4150" />
      <Box position={[cx, 0.07, RUNWAY.z + 32]} size={[len + 60, 0.14, 12]} color="#4A5164" />
      <Box position={[150, 0.07, RUNWAY.z + 52]} size={[300, 0.14, 40]} color="#5B6475" />
      <ColoredInstances items={marks} castShadow={false} />
      <Plane />
      <Box position={[120, 11, RUNWAY.z + 78]} size={[90, 22, 26]} color="#E4D9C4" />
      <Box position={[120, 22.4, RUNWAY.z + 78]} size={[92, 1, 28]} color="#B7BCC7" />
      <Box position={[120, 14, RUNWAY.z + 64.6]} size={[88, 8, 0.4]} color="#7FA5BA" />
      <Box position={[40, 18, RUNWAY.z + 60]} size={[7, 36, 7]} color="#F4F7FB" />
      <Box position={[40, 38, RUNWAY.z + 60]} size={[12, 5, 12]} color="#7FA5BA" />
      <Box position={[200, 9, RUNWAY.z + 64]} size={[42, 18, 30]} color="#C9D2DE" />
      {/* helipuerto */}
      <mesh position={[-28, 0.2, 92]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[13, 28]} />
        <meshStandardMaterial color="#4A5164" />
      </mesh>
      <mesh position={[-28, 0.24, 92]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[10.5, 11.5, 28]} />
        <meshStandardMaterial color="#F5A524" />
      </mesh>
      <Box position={[-30.4, 0.26, 92]} size={[0.9, 0.05, 8]} color="#F4F7FB" />
      <Box position={[-25.6, 0.26, 92]} size={[0.9, 0.05, 8]} color="#F4F7FB" />
      <Box position={[-28, 0.26, 92]} size={[5, 0.05, 0.9]} color="#F4F7FB" />
      <group position={[-28, 0, 92]} rotation={[0, 0.6, 0]}>
        <Box position={[0, 1.8, 0]} size={[2.6, 2.6, 7]} color="#D64545" />
        <Box position={[0, 1.9, 3.4]} size={[2.2, 1.6, 1.6]} color="#1B2A3A" />
        <Box position={[0, 3.3, 0]} size={[0.5, 0.5, 0.5]} color="#2A303D" />
        <Box position={[0, 3.6, 0]} size={[14, 0.12, 0.5]} color="#14171F" />
        <Box position={[0, 2, -6]} size={[0.3, 0.3, 5]} color="#D64545" />
      </group>
    </group>
  );
}
