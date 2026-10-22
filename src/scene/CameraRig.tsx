import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { MOUSE, Plane, Raycaster, Spherical, Vector2, Vector3 } from 'three';
import { useAtlasStore } from '../store/useAtlasStore';
import { CONFIG } from '../lib/config';
import { home } from '../lib/framing';
import { candidateShots, nextShot, shotPose, type Shot } from '../director/shots';
import { entityPosition } from '../lib/format';
import type { Selection, Simulation } from '../sim/types';
function viewPosition(sim: Simulation, selection: Selection | null, view: string) {
  if (view === 'world' && selection?.kind === 'truck') {
    const t = sim.trucks.find((t) => t.id === selection.id);
    if (t) {
      const a = sim.warehouses.find((w) => w.id === t.originId)!.map,
        b = sim.warehouses.find((w) => w.id === t.destinationId)!.map;
      return { x: a.x + (b.x - a.x) * t.routeProgress, z: a.z + (b.z - a.z) * t.routeProgress };
    }
  }
  return entityPosition(sim, selection);
}
function clampTarget(target: Vector3, view: string): void {
  const b =
    view === 'world'
      ? { x: [-150, 150], z: [-110, 110] }
      : view === 'region'
        ? { x: [-110, 400], z: [-160, 160] }
        : { x: [-70, 70], z: [-50, 70] };
  target.x = Math.max(b.x[0], Math.min(b.x[1], target.x));
  target.z = Math.max(b.z[0], Math.min(b.z[1], target.z));
  target.y = Math.max(0, Math.min(12, target.y));
}
function clearInertia(controls: OrbitControlsImpl): void {
  const position = controls.object.position.clone();
  const target = controls.target.clone();
  const damping = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  controls.object.position.copy(position);
  controls.target.copy(target);
  controls.object.lookAt(target);
  controls.enableDamping = damping;
  controls.update();
}
export function CameraRig() {
  const ref = useRef<OrbitControlsImpl>(null);
  const { camera, gl, size } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  const view = useAtlasStore((s) => s.view);
  const warehouseId = useAtlasStore((s) => s.warehouseId);
  const command = useAtlasStore((s) => s.cameraCommand);
  const homeSeq = useAtlasStore((s) => s.homeSeq);
  const desired = useMemo(
    () => ({
      position: new Vector3(...CONFIG.camera.warehouse),
      target: new Vector3(...CONFIG.camera.target),
      active: false,
    }),
    [],
  );
  const keys = useRef(new Set<string>());
  const dir = useRef<{ shot: Shot | null; start: number; refresh: number }>({
    shot: null,
    start: 0,
    refresh: 0,
  });
  const lastSave = useRef(0);
  const lastView = useRef<string | null>(null);
  const vectors = useMemo(
    () => ({
      offset: new Vector3(),
      forward: new Vector3(),
      right: new Vector3(),
      spherical: new Spherical(),
      up: new Vector3(0, 1, 0),
      ray: new Raycaster(),
      plane: new Plane(new Vector3(0, 1, 0), 0),
      pointer: new Vector2(),
      cursor: new Vector3(),
    }),
    [],
  );
  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    clearInertia(controls);
    if (lastView.current === null) {
      // primer encuadre: sin animación, nunca arranca vacío
      home(desired, view, aspect);
      camera.position.copy(desired.position);
      controls.target.copy(desired.target);
      controls.update();
      desired.active = false;
    } else {
      home(desired, view, aspect);
      desired.active = true;
    }
    lastView.current = view + warehouseId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, warehouseId, camera, desired]);
  useEffect(() => {
    const controls = ref.current;
    if (!controls || command.seq === 0) return;
    clearInertia(controls);
    if (command.action === 'reset') {
      home(desired, view, aspect);
      desired.active = true;
    } else if (command.action === 'center') {
      const store = useAtlasStore.getState();
      const pos = viewPosition(store.sim, store.selection, view);
      desired.target.set(pos.x, 0, pos.z);
      desired.position.copy(desired.target).add(new Vector3(28, 26, 32));
      desired.active = true;
    } else if (command.action === 'zoomIn' || command.action === 'zoomOut') {
      desired.target.copy(controls.target);
      desired.position
        .copy(camera.position)
        .sub(controls.target)
        .multiplyScalar(command.action === 'zoomIn' ? 0.82 : 1.22)
        .add(controls.target);
      desired.active = true;
    } else {
      vectors.offset.copy(camera.position).sub(controls.target);
      vectors.spherical.setFromVector3(vectors.offset);
      vectors.spherical.theta += command.action === 'rotateLeft' ? -0.35 : 0.35;
      desired.target.copy(controls.target);
      desired.position
        .copy(controls.target)
        .add(vectors.offset.setFromSpherical(vectors.spherical));
      desired.active = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command, homeSeq, view, camera, desired, vectors]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.matches('input,textarea,select') || e.target.isContentEditable)
      )
        return;
      if (['w', 'a', 's', 'd', 'q', 'e'].includes(e.key.toLowerCase()))
        keys.current.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const clear = () => keys.current.clear();
    const stop = () => {
      desired.active = false;
      useAtlasStore.setState({ follow: false });
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const controls = ref.current;
      if (!controls) return;
      useAtlasStore.setState({ follow: false });
      const rect = gl.domElement.getBoundingClientRect();
      vectors.pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      vectors.ray.setFromCamera(vectors.pointer, camera);
      if (!vectors.ray.ray.intersectPlane(vectors.plane, vectors.cursor))
        vectors.cursor.copy(controls.target);
      if (!desired.active) {
        clearInertia(controls);
        desired.position.copy(camera.position);
        desired.target.copy(controls.target);
      }
      const distance = desired.position.distanceTo(desired.target);
      const scale = Math.max(
        CONFIG.camera.minDistance / distance,
        Math.min(
          CONFIG.camera.maxDistance / distance,
          Math.exp(Math.max(-120, Math.min(120, e.deltaY)) * 0.0014),
        ),
      );
      desired.position.sub(vectors.cursor).multiplyScalar(scale).add(vectors.cursor);
      desired.target.sub(vectors.cursor).multiplyScalar(scale).add(vectors.cursor);
      desired.active = true;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    gl.domElement.addEventListener('pointerdown', stop);
    gl.domElement.addEventListener('wheel', wheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      gl.domElement.removeEventListener('pointerdown', stop);
      gl.domElement.removeEventListener('wheel', wheel);
    };
  }, [gl, desired, vectors, camera]);
  useFrame(({ clock }, dt) => {
    const controls = ref.current;
    if (!controls) return;
    const store = useAtlasStore.getState();
    let blend = 1 - Math.exp(-Math.min(dt, 0.1) * 4);
    controls.enabled = !store.director;
    if (store.director) {
      // Modo Director: la cámara sigue los eventos relevantes con transiciones suaves
      const d = dir.current,
        now = clock.elapsedTime;
      const dv = view === 'warehouse' ? 'warehouse' : view === 'world' ? 'world' : 'region';
      if (!d.shot || now - d.start > d.shot.duration) {
        const picked = nextShot(
          candidateShots(store.sim, dv, warehouseId, store.sim.time),
          d.shot?.id ?? null,
          now,
        );
        d.shot = picked;
        d.start = now;
        d.refresh = now;
        store.setCaption(picked.label);
      } else if (now - d.refresh > 0.4) {
        d.refresh = now;
        const live = candidateShots(store.sim, dv, warehouseId, store.sim.time).find(
          (c) => c.id === d.shot?.id,
        );
        if (live) d.shot = { ...d.shot, target: live.target };
      }
      const pose = shotPose(d.shot, now - d.start);
      desired.position.set(...pose.position);
      desired.target.set(...pose.target);
      desired.active = true;
      blend = 1 - Math.exp(-Math.min(dt, 0.1) * 1.7);
    } else if (dir.current.shot) {
      dir.current.shot = null;
      store.setCaption('');
    }
    if (store.follow && store.selection?.kind === 'truck') {
      const p = viewPosition(store.sim, store.selection, view);
      desired.target.set(p.x, 0, p.z);
      desired.position.set(p.x + 18, 18, p.z + 23);
      desired.active = true;
    }
    if (desired.active) {
      camera.position.lerp(desired.position, blend);
      controls.target.lerp(desired.target, blend);
      if (camera.position.distanceToSquared(desired.position) < 0.006 && !store.follow)
        desired.active = false;
    }
    if (keys.current.size) {
      desired.active = false;
      const speed = Math.min(camera.position.distanceTo(controls.target), 80) * dt * 0.4;
      vectors.forward.copy(controls.target).sub(camera.position).setY(0).normalize();
      vectors.right.crossVectors(vectors.forward, vectors.up).normalize();
      for (const key of keys.current) {
        if (key === 'w' || key === 's') {
          vectors.offset.copy(vectors.forward).multiplyScalar(speed * (key === 'w' ? 1 : -1));
          camera.position.add(vectors.offset);
          controls.target.add(vectors.offset);
        }
        if (key === 'a' || key === 'd') {
          vectors.offset.copy(vectors.right).multiplyScalar(speed * (key === 'd' ? 1 : -1));
          camera.position.add(vectors.offset);
          controls.target.add(vectors.offset);
        }
        if (key === 'q' || key === 'e') {
          vectors.offset.copy(camera.position).sub(controls.target);
          vectors.spherical.setFromVector3(vectors.offset);
          vectors.spherical.theta += dt * (key === 'q' ? -0.8 : 0.8);
          camera.position
            .copy(controls.target)
            .add(vectors.offset.setFromSpherical(vectors.spherical));
        }
      }
    }
    clampTarget(controls.target, view);
    controls.update();
    if (clock.elapsedTime - lastSave.current > 1) {
      lastSave.current = clock.elapsedTime;
      store.setCamera({
        position: camera.position.toArray() as [number, number, number],
        target: controls.target.toArray() as [number, number, number],
      });
    }
  });
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping
      dampingFactor={0.09}
      enableZoom={false}
      minDistance={CONFIG.camera.minDistance}
      maxDistance={CONFIG.camera.maxDistance}
      minPolarAngle={CONFIG.camera.minPolar}
      maxPolarAngle={CONFIG.camera.maxPolar}
      mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
    />
  );
}
