import { CONFIG } from '../lib/config';
import type { Point } from '../sim/types';

export interface RoadNode extends Point {
  id: string;
  signal: boolean;
  offset: number;
}
export interface RoadEdge {
  id: string;
  from: string;
  to: string;
  length: number;
  limit: number;
  axis: 'x' | 'z';
  kind: 'street' | 'highway' | 'bridge';
}
export interface RoadGraph {
  nodes: RoadNode[];
  edges: RoadEdge[];
  entry: string;
  gate: string;
}
export interface RoadClosure {
  warehouseId: string;
  edgeId: string;
  until: number;
}
export interface RoadAgent {
  id: string;
  warehouseId: string;
  kind: 'CAR' | 'VAN' | 'TRUCK';
  nodes: string[];
  index: number;
  distance: number;
  speed: number;
  position: Point;
  yaw: number;
  loop: boolean;
  finished: boolean;
  junction: string | null;
  stopReason: string | null;
  /** Segundos consecutivos detenido: rompe bloqueos mutuos en cruces. */
  waited?: number;
  traveled: number;
}
const nodes: RoadNode[] = [];
for (let row = 0; row < 4; row++)
  for (let col = 0; col < 3; col++)
    nodes.push({
      id: `n${row}${col}`,
      x: [80, 155, 235][col],
      z: [-100, -30, 40, 110][row],
      signal: row > 0 && row < 3,
      offset: (row * 3 + col) * 2.3,
    });
nodes.push(
  { id: 'gate', x: 55, z: 32, signal: false, offset: 0 },
  { id: 'east0', x: 325, z: 40, signal: false, offset: 0 },
  { id: 'east1', x: 325, z: 110, signal: false, offset: 0 },
);
const edges: RoadEdge[] = [];
function link(a: string, b: string, kind: RoadEdge['kind'] = 'street') {
  for (const [from, to] of [
    [a, b],
    [b, a],
  ]) {
    const p = nodes.find((n) => n.id === from)!,
      q = nodes.find((n) => n.id === to)!;
    edges.push({
      id: `${from}>${to}`,
      from,
      to,
      length: Math.hypot(p.x - q.x, p.z - q.z),
      limit: kind === 'street' ? 13 : 19,
      axis: Math.abs(p.x - q.x) > Math.abs(p.z - q.z) ? 'x' : 'z',
      kind,
    });
  }
}
for (let row = 0; row < 4; row++)
  for (let col = 0; col < 3; col++) {
    if (col < 2) link(`n${row}${col}`, `n${row}${col + 1}`, row === 0 ? 'highway' : 'street');
    if (row < 3) link(`n${row}${col}`, `n${row + 1}${col}`, col === 2 ? 'highway' : 'street');
  }
link('n20', 'gate');
link('n22', 'east0', 'bridge');
link('n32', 'east1', 'highway');
for (let i = 0; i < 8; i++)
  nodes.push({
    id: `r${i}`,
    x: 325 + Math.sin((i * Math.PI) / 4) * 18,
    z: 75 - Math.cos((i * Math.PI) / 4) * 18,
    signal: false,
    offset: 0,
  });
for (let i = 0; i < 8; i++) {
  link(`r${i}`, `r${(i + 1) % 8}`);
  edges.pop();
}
link('east0', 'r0');
link('east1', 'r4');
export const ROAD_GRAPH: RoadGraph = { nodes, edges, entry: 'n02', gate: 'gate' };
const nodeLookup = new Map(nodes.map((n) => [n.id, n]));
const edgeLookup = new Map(edges.map((e) => [e.id, e]));
export const roadNode = (id: string, graph: RoadGraph = ROAD_GRAPH) =>
  graph === ROAD_GRAPH ? nodeLookup.get(id)! : graph.nodes.find((n) => n.id === id)!;
export function roadEdge(
  from: string,
  to: string,
  graph: RoadGraph = ROAD_GRAPH,
): RoadEdge | undefined {
  return graph === ROAD_GRAPH
    ? edgeLookup.get(`${from}>${to}`)
    : graph.edges.find((e) => e.from === from && e.to === to);
}
/** Deterministic Dijkstra. Closure edges are excluded; ties retain seed-independent ID order. */
export function findRoadPath(
  from: string,
  to: string,
  closed: ReadonlySet<string> = new Set(),
  graph: RoadGraph = ROAD_GRAPH,
): string[] | null {
  if (!graph.nodes.some((n) => n.id === from) || !graph.nodes.some((n) => n.id === to)) return null;
  const cost = new Map<string, number>([[from, 0]]),
    previous = new Map<string, string>(),
    pending = new Set(graph.nodes.map((n) => n.id));
  while (pending.size) {
    const current = [...pending].sort(
      (a, b) => (cost.get(a) ?? Infinity) - (cost.get(b) ?? Infinity) || a.localeCompare(b),
    )[0];
    const base = cost.get(current);
    if (base === undefined) return null;
    pending.delete(current);
    if (current === to) {
      const path = [to];
      while (path[0] !== from) path.unshift(previous.get(path[0])!);
      return path;
    }
    for (const e of graph.edges.filter((e) => e.from === current && !closed.has(e.id))) {
      const next = base + e.length / e.limit;
      if (next < (cost.get(e.to) ?? Infinity)) {
        cost.set(e.to, next);
        previous.set(e.to, current);
      }
    }
  }
  return null;
}
export function signalGreen(node: RoadNode, axis: 'x' | 'z', time: number): boolean {
  if (!node.signal) return true;
  const phase = (time + node.offset) % CONFIG.signalCycle;
  return axis === 'x' ? phase < 10 : phase >= 12 && phase < 22;
}
export function roadLength(path: readonly string[]): number {
  return path.slice(1).reduce((sum, id, i) => sum + (roadEdge(path[i], id)?.length ?? 0), 0);
}
export function roadPosition(a: RoadAgent): Point {
  const p = roadNode(a.nodes[a.index]),
    q = roadNode(a.nodes[a.index + 1] ?? a.nodes[a.index]);
  const length = Math.hypot(q.x - p.x, q.z - p.z),
    f = length ? Math.min(1, a.distance / length) : 0;
  return {
    x: p.x + (q.x - p.x) * f + (length ? (-(q.z - p.z) / length) * CONFIG.roadLaneOffset : 0),
    z: p.z + (q.z - p.z) * f + (length ? ((q.x - p.x) / length) * CONFIG.roadLaneOffset : 0),
  };
}
export function makeRoadAgent(
  id: string,
  warehouseId: string,
  path: string[],
  kind: RoadAgent['kind'],
  fraction = 0,
  loop = false,
): RoadAgent {
  const agent: RoadAgent = {
    id,
    warehouseId,
    kind,
    nodes: [...path],
    index: 0,
    distance: 0,
    speed: 0,
    position: { x: 0, z: 0 },
    yaw: 0,
    loop,
    finished: false,
    junction: null,
    stopReason: null,
    traveled: 0,
  };
  let remaining = roadLength(path) * Math.max(0, Math.min(0.99, fraction));
  while (agent.index < path.length - 2) {
    const e = roadEdge(path[agent.index], path[agent.index + 1])!;
    if (remaining < e.length) break;
    remaining -= e.length;
    agent.index++;
  }
  agent.distance = remaining;
  agent.position = roadPosition(agent);
  const p = roadNode(path[agent.index]),
    q = roadNode(path[agent.index + 1]);
  agent.yaw = Math.atan2(q.x - p.x, q.z - p.z);
  return agent;
}
export const AMBIENT_LOOP = [
  'n00',
  'n01',
  'n02',
  'n12',
  'n22',
  'n32',
  'n31',
  'n30',
  'n20',
  'n10',
  'n00',
];
export const ROUNDABOUT_LOOP = [
  'n22',
  'east0',
  'r0',
  'r1',
  'r2',
  'r3',
  'r4',
  'east1',
  'n32',
  'n22',
];
export function roadHeight(p: Point): number {
  return Math.abs(p.z - 40) < 8 ? Math.max(0, 4.2 * (1 - Math.abs(p.x - 280) / 45)) : 0;
}
