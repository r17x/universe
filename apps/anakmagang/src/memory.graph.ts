import { Command, Flag } from "effect/unstable/cli";
import { Array as Arr, Effect, HashMap, HashSet, Option, pipe } from "effect";
import { MemoryStore } from "./MemoryStore";
import { Output } from "./protocol.Output";
import { Document, Line } from "./protocol.Emission";
import type { MemoryNode } from "./MemoryParser";

export const nodeLabel = (node: MemoryNode) => `${node.id} [${node.scale}] ${node.name}`;

export const renderTree = (
  id: string,
  childrenMap: HashMap.HashMap<string, ReadonlyArray<string>>,
  nodeMap: HashMap.HashMap<string, MemoryNode>,
  visited: HashSet.HashSet<string>,
  prefix: string,
  isLast: boolean,
): ReadonlyArray<string> => {
  if (HashSet.has(visited, id)) return [];
  const nextVisited = HashSet.add(visited, id);
  const node = HashMap.get(nodeMap, id);
  if (Option.isNone(node)) return [];
  const connector = prefix === "" ? "" : isLast ? "└── " : "├── ";
  const line = `${prefix}${connector}${nodeLabel(node.value)}`;
  const children = Option.getOrElse(
    HashMap.get(childrenMap, id),
    () => [] as ReadonlyArray<string>,
  );
  const childPrefix = prefix === "" ? "" : prefix + (isLast ? "    " : "│   ");
  const childLines = pipe(
    children,
    Arr.flatMap((childId, idx) =>
      renderTree(
        childId,
        childrenMap,
        nodeMap,
        nextVisited,
        childPrefix,
        idx === children.length - 1,
      ),
    ),
  );
  return Arr.prepend(childLines, line);
};

export const renderDot = (nodes: ReadonlyArray<MemoryNode>): string => {
  const edges = pipe(
    nodes,
    Arr.flatMap((node) =>
      Arr.map(node.edges.derived_from, (parentId) => `  "${node.id}" -> "${parentId}";`),
    ),
  );
  const nodeLabels = Arr.map(
    nodes,
    (node) =>
      `  "${node.id}" [label="${node.id}\\n[${node.scale}]\\n${node.name.replace(/"/g, '\\"')}"];`,
  );
  return Arr.join(["digraph memory {", "  rankdir=BT;", ...nodeLabels, ...edges, "}"], "\n");
};

export const memoryGraphCommand = Command.make(
  "graph",
  {
    render: Flag.choice("render", ["tree", "dot"] as const).pipe(Flag.withDefault("tree" as const)),
  },
  ({ render }) =>
    Effect.gen(function* () {
      const store = yield* MemoryStore;
      const output = yield* Output;
      const nodes = yield* store.list();

      if (Arr.length(nodes) === 0) {
        yield* output.emit(Line({ text: "No memory nodes found." }));
        return;
      }

      if (render === "dot") {
        yield* output.emit(Document({ content: renderDot(nodes), mediaType: "text" }));
        return;
      }

      const nodeMap = HashMap.fromIterable(Arr.map(nodes, (n) => [n.id, n] as const));

      const childrenMap = pipe(
        nodes,
        Arr.reduce(HashMap.empty<string, ReadonlyArray<string>>(), (acc, node) =>
          Arr.reduce(node.edges.derived_from, acc, (innerAcc, parentId) => {
            if (Option.isNone(HashMap.get(nodeMap, parentId))) return innerAcc;
            const existing = Option.getOrElse(
              HashMap.get(innerAcc, parentId),
              () => [] as ReadonlyArray<string>,
            );
            return HashMap.set(innerAcc, parentId, Arr.append(existing, node.id));
          }),
        ),
      );

      const hasIncomingEdge = pipe(
        nodes,
        Arr.reduce(HashSet.empty<string>(), (acc, node) =>
          Arr.reduce(node.edges.derived_from, acc, (innerAcc, parentId) =>
            Option.isSome(HashMap.get(nodeMap, parentId))
              ? HashSet.add(innerAcc, node.id)
              : innerAcc,
          ),
        ),
      );

      const hasAnyEdge = pipe(
        nodes,
        Arr.reduce(HashSet.empty<string>(), (acc, node) => {
          const hasDerivedFrom = Arr.some(node.edges.derived_from, (pid) =>
            Option.isSome(HashMap.get(nodeMap, pid)),
          );
          const hasChildren = Option.isSome(HashMap.get(childrenMap, node.id));
          return hasDerivedFrom || hasChildren ? HashSet.add(acc, node.id) : acc;
        }),
      );

      const roots = Arr.filter(
        nodes,
        (n) =>
          !HashSet.has(hasIncomingEdge, n.id) &&
          (Option.isSome(HashMap.get(childrenMap, n.id)) ||
            Arr.some(n.edges.derived_from, (pid) => Option.isSome(HashMap.get(nodeMap, pid)))),
      );

      const orphans = Arr.filter(nodes, (n) => !HashSet.has(hasAnyEdge, n.id));

      const treeLines = pipe(
        roots,
        Arr.flatMap((root, idx) =>
          renderTree(root.id, childrenMap, nodeMap, HashSet.empty(), "", idx === roots.length - 1),
        ),
      );

      yield* Effect.forEach(treeLines, (line) => output.emit(Line({ text: line })));

      if (Arr.length(orphans) > 0) {
        if (Arr.length(treeLines) > 0) {
          yield* output.emit(Line({ text: "" }));
        }
        yield* output.emit(Line({ text: "Orphans:" }));
        yield* Effect.forEach(orphans, (node) =>
          output.emit(Line({ text: `  ${nodeLabel(node)}` })),
        );
      }
    }).pipe(Effect.provide(MemoryStore.layer)),
);
