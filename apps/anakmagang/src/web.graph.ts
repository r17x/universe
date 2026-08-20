import { Array as Arr, Option, Result, Schema as S } from "effect";
import { Canvas } from "foldkit";

export type Theme = "Dark" | "Light";

const BASE_REPULSION = 800;
const BASE_ATTRACTION = 0.01;
const BASE_GRAVITY = 0.08;
const DAMPING = 0.85;
const MAX_TICKS = 80;
const ALPHA_DECAY = 0.93;
const ALPHA_MIN = 0.01;

const NodeKind = S.Literals(["session", "memory", "guard", "store", "transition", "size_preset"]);
const EdgeKind = S.Literals(["memory_derived", "session_memory"]);

export class GraphNode extends S.Class<GraphNode>("GraphNode")({
  id: S.String,
  label: S.String,
  kind: NodeKind,
  active: S.Boolean,
  weight: S.Number,
}) {}

export class GraphEdge extends S.Class<GraphEdge>("GraphEdge")({
  source: S.String,
  target: S.String,
  kind: EdgeKind,
}) {}

export class GraphResponse extends S.Class<GraphResponse>("GraphResponse")({
  nodes: S.Array(GraphNode),
  edges: S.Array(GraphEdge),
}) {}

export interface SimNode {
  readonly node: GraphNode;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly pinned: boolean;
}

export interface Camera {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export type Interaction =
  | { readonly _tag: "Idle" }
  | {
      readonly _tag: "Dragging";
      readonly nodeId: string;
      readonly offsetX: number;
      readonly offsetY: number;
    }
  | {
      readonly _tag: "Panning";
      readonly startX: number;
      readonly startY: number;
      readonly cameraStartX: number;
      readonly cameraStartY: number;
    };

export interface GraphState {
  readonly simNodes: ReadonlyArray<SimNode>;
  readonly edges: ReadonlyArray<GraphEdge>;
  readonly camera: Camera;
  readonly interaction: Interaction;
  readonly isSimulating: boolean;
  readonly hoveredNodeId: string | null;
  readonly alpha: number;
  readonly tickCount: number;
  readonly lastClickTime: number;
  readonly lastClickNodeId: string | null;
}

export const initGraphState = (response: GraphResponse): GraphState => {
  const count = response.nodes.length;
  const angleStep = count > 0 ? (2 * Math.PI) / count : 0;
  const simNodes: ReadonlyArray<SimNode> = Arr.map(response.nodes, (node, i) => ({
    node,
    x: Math.cos(i * angleStep) * Math.min(400, Math.max(200, count * 5)),
    y: Math.sin(i * angleStep) * Math.min(400, Math.max(200, count * 5)),
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    pinned: false,
  }));
  return {
    simNodes,
    edges: response.edges,
    camera: { x: 0, y: 0, zoom: 1 },
    interaction: { _tag: "Idle" },
    isSimulating: true,
    hoveredNodeId: null,
    alpha: 1,
    tickCount: 0,
    lastClickTime: 0,
    lastClickNodeId: null,
  };
};

export const stepSimulation = (state: GraphState, _dt: number): GraphState => {
  const alpha = state.alpha * ALPHA_DECAY;
  const tickCount = state.tickCount + 1;

  if (alpha < ALPHA_MIN || tickCount > MAX_TICKS) {
    return { ...state, isSimulating: false };
  }

  // Imperative force accumulation: Float64Array + index loops avoid per-tick allocations
  // that functional patterns (Arr.map/reduce) would require on this O(n^2) hot path.
  const n = state.simNodes.length;
  const fx = new Float64Array(n);
  const fy = new Float64Array(n);

  // Build index for edge lookups
  const nodeIndex = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const sn = state.simNodes[i];
    if (!sn) continue;
    nodeIndex.set(sn.node.id, i);
  }

  // Repulsion (O(n^2) but with typed arrays)
  for (let i = 0; i < n; i++) {
    const a = state.simNodes[i];
    if (!a) continue;
    for (let j = i + 1; j < n; j++) {
      const b = state.simNodes[j];
      if (!b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distSq = dx * dx + dy * dy + 1;
      const force = BASE_REPULSION / distSq;
      const dist = Math.sqrt(distSq);
      const cfx = (dx / dist) * force * alpha;
      const cfy = (dy / dist) * force * alpha;
      fx[i] = (fx[i] ?? 0) - cfx;
      fy[i] = (fy[i] ?? 0) - cfy;
      fx[j] = (fx[j] ?? 0) + cfx;
      fy[j] = (fy[j] ?? 0) + cfy;
    }
  }

  // Attraction along edges
  const edges = state.edges;
  for (let e = 0; e < edges.length; e++) {
    const edge = edges[e];
    if (!edge) continue;
    const si = nodeIndex.get(edge.source);
    const ti = nodeIndex.get(edge.target);
    if (si === undefined || ti === undefined) continue;
    const a = state.simNodes[si];
    const b = state.simNodes[ti];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = dist * BASE_ATTRACTION;
    const cfx = (dx / dist) * force * alpha;
    const cfy = (dy / dist) * force * alpha;
    fx[si] = (fx[si] ?? 0) + cfx;
    fy[si] = (fy[si] ?? 0) + cfy;
    fx[ti] = (fx[ti] ?? 0) - cfx;
    fy[ti] = (fy[ti] ?? 0) - cfy;
  }

  // Center gravity
  for (let i = 0; i < n; i++) {
    const sn = state.simNodes[i];
    if (!sn) continue;
    const dist = Math.sqrt(sn.x * sn.x + sn.y * sn.y) || 1;
    fx[i] = (fx[i] ?? 0) - (sn.x / dist) * dist * BASE_GRAVITY * alpha;
    fy[i] = (fy[i] ?? 0) - (sn.y / dist) * dist * BASE_GRAVITY * alpha;
  }

  // Apply forces — build new array only once
  const nextNodes = new Array<SimNode>(n);
  for (let i = 0; i < n; i++) {
    const sn = state.simNodes[i];
    if (!sn) continue;
    if (sn.pinned) {
      nextNodes[i] = sn;
    } else {
      const nvx = (sn.vx + (fx[i] ?? 0)) * DAMPING;
      const nvy = (sn.vy + (fy[i] ?? 0)) * DAMPING;
      nextNodes[i] = {
        node: sn.node,
        x: sn.x + nvx,
        y: sn.y + nvy,
        vx: nvx,
        vy: nvy,
        pinned: false,
      };
    }
  }

  const stopped = alpha < ALPHA_MIN || tickCount > MAX_TICKS;
  return { ...state, simNodes: nextNodes, isSimulating: !stopped, alpha, tickCount };
};

export const autoFitCamera = (state: GraphState, width: number, height: number): GraphState => {
  if (state.simNodes.length === 0) return state;
  const bounds = Arr.reduce(
    state.simNodes,
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    (acc, sn) => ({
      minX: Math.min(acc.minX, sn.x),
      maxX: Math.max(acc.maxX, sn.x),
      minY: Math.min(acc.minY, sn.y),
      maxY: Math.max(acc.maxY, sn.y),
    }),
  );
  const padding = 60;
  const bw = bounds.maxX - bounds.minX + padding * 2;
  const bh = bounds.maxY - bounds.minY + padding * 2;
  const zoom = Math.min(1, width / bw, height / bh);
  const cx = (-(bounds.minX + bounds.maxX) / 2) * zoom;
  const cy = (-(bounds.minY + bounds.maxY) / 2) * zoom;
  return { ...state, camera: { x: cx, y: cy, zoom } };
};

const nodeColor = (kind: typeof NodeKind.Type, active: boolean, theme: Theme): string => {
  if (theme === "Light") {
    switch (kind) {
      case "session":
        return active ? "#0891b2" : "#0e7490";
      case "memory":
        return active ? "#16a34a" : "#15803d";
      case "guard":
        return active ? "#dc2626" : "#b91c1c";
      case "store":
        return active ? "#ea580c" : "#c2410c";
      case "transition":
        return active ? "#57534e" : "#78716c";
      case "size_preset":
        return active ? "#0e7490" : "#155e75";
    }
  }
  switch (kind) {
    case "session":
      return active ? "#06b6d4" : "#2d8da8";
    case "memory":
      return active ? "#22c55e" : "#2d9a5c";
    case "guard":
      return active ? "#ef4444" : "#c44040";
    case "store":
      return active ? "#f97316" : "#c46030";
    case "transition":
      return active ? "#888888" : "#888888";
    case "size_preset":
      return active ? "#22d3ee" : "#2d8da8";
  }
};

export const graphShapes = (
  state: GraphState,
  width: number,
  height: number,
  theme: Theme,
): ReadonlyArray<Canvas.Shape> => {
  const camera =
    !state.isSimulating &&
    state.camera.x === 0 &&
    state.camera.y === 0 &&
    state.camera.zoom === 1 &&
    state.simNodes.length > 0
      ? (() => {
          const bounds = Arr.reduce(
            state.simNodes,
            { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
            (acc, sn) => ({
              minX: Math.min(acc.minX, sn.x),
              maxX: Math.max(acc.maxX, sn.x),
              minY: Math.min(acc.minY, sn.y),
              maxY: Math.max(acc.maxY, sn.y),
            }),
          );
          const padding = 80;
          const bw = bounds.maxX - bounds.minX + padding * 2;
          const bh = bounds.maxY - bounds.minY + padding * 2;
          const zoom = Math.min(1, width / bw, height / bh);
          const cx = (-(bounds.minX + bounds.maxX) / 2) * zoom;
          const cy = (-(bounds.minY + bounds.maxY) / 2) * zoom;
          return { x: cx, y: cy, zoom };
        })()
      : state.camera;
  const isLight = theme === "Light";
  const edgeLines = Arr.filterMap(state.edges, (edge) =>
    Option.flatMap(
      Arr.findFirst(state.simNodes, (sn) => sn.node.id === edge.source),
      (src) =>
        Option.map(
          Arr.findFirst(state.simNodes, (sn) => sn.node.id === edge.target),
          (tgt): Canvas.Shape => {
            const isHovered =
              edge.source === state.hoveredNodeId || edge.target === state.hoveredNodeId;
            if (isHovered) {
              return Canvas.Path({
                instructions: [
                  Canvas.MoveTo({ x: src.x, y: src.y }),
                  Canvas.LineTo({ x: tgt.x, y: tgt.y }),
                ],
                stroke: isLight ? "rgba(8, 145, 178, 0.8)" : "rgba(6, 182, 212, 0.6)",
                lineWidth: 1.5,
              });
            }
            return Canvas.Path({
              instructions: [
                Canvas.MoveTo({ x: src.x, y: src.y }),
                Canvas.LineTo({ x: tgt.x, y: tgt.y }),
              ],
              stroke: isLight ? "rgba(120, 113, 108, 0.18)" : "rgba(51, 51, 51, 0.4)",
              lineWidth: 0.5,
            });
          },
        ),
    ).pipe(Result.fromOption(() => undefined)),
  );

  const hoveredNodes = Arr.filter(state.simNodes, (sn) => sn.node.id === state.hoveredNodeId);

  const glowRings: ReadonlyArray<Canvas.Shape> = Arr.map(hoveredNodes, (sn) =>
    Canvas.Circle({
      x: sn.x,
      y: sn.y,
      radius: sn.node.weight * 3 + 4 + 8,
      fill: isLight ? "rgba(8, 145, 178, 0.2)" : "rgba(6, 182, 212, 0.12)",
    }),
  );

  const nodeCircles: ReadonlyArray<Canvas.Shape> = Arr.map(state.simNodes, (sn) => {
    const radius = sn.node.weight * 3 + 4;
    const color = nodeColor(sn.node.kind, sn.node.active, theme);
    const isHovered = sn.node.id === state.hoveredNodeId;
    return Canvas.Circle({
      x: sn.x,
      y: sn.y,
      radius,
      fill: isHovered ? color : "transparent",
      stroke: color,
      lineWidth: isHovered ? 2.5 : isLight ? 2 : 1.5,
    });
  });

  const labels: ReadonlyArray<Canvas.Shape> = Arr.map(hoveredNodes, (sn) => {
    const label = sn.node.label.length > 60 ? sn.node.label.slice(0, 57) + "..." : sn.node.label;
    return Canvas.Text({
      x: sn.x,
      y: sn.y + sn.node.weight * 3 + 18,
      content: label,
      font: "11px 'Kode Mono', monospace",
      fill: isLight ? "#1c1917" : "#e0e0e0",
      align: "Center",
      baseline: "Top",
    });
  });

  return [
    Canvas.Rect({ x: 0, y: 0, width, height, fill: isLight ? "#f5f5f4" : "#0a0a0a" }),
    Canvas.Group({
      shapes: [...edgeLines, ...glowRings, ...nodeCircles, ...labels],
      translate: { x: width / 2 + camera.x, y: height / 2 + camera.y },
      scale: { x: camera.zoom, y: camera.zoom },
    }),
  ];
};

export const hitTest = (
  state: GraphState,
  canvasX: number,
  canvasY: number,
  width: number,
  height: number,
): string | null => {
  const graphX = (canvasX - width / 2 - state.camera.x) / state.camera.zoom;
  const graphY = (canvasY - height / 2 - state.camera.y) / state.camera.zoom;
  const hit = Arr.findFirst(state.simNodes, (sn) => {
    const radius = sn.node.weight * 3 + 4 + 4;
    const dx = graphX - sn.x;
    const dy = graphY - sn.y;
    return dx * dx + dy * dy <= radius * radius;
  });
  return Option.map(hit, (sn) => sn.node.id).pipe(Option.getOrElse(() => null));
};
