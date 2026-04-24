export type GraphEdge = {
  from: string;
  to: string;
  label: string;
};

export type ComponentDetail = {
  root: string;
  type: "tree" | "cycle";
  nodes: string[];
  edges: string[];
  depth?: number;
  traversal?: {
    dfs: string[];
    bfs: string[];
  };
  lineage?: Record<string, string[]>;
  cyclePath?: string[];
  breakingLink?: string | null;
};

export type HierarchyAnalysis = {
  components: ComponentDetail[];
  stronglyConnectedComponents: string[][];
};

const EDGE_PATTERN = /^([A-Z])\s*->\s*([A-Z])$/;

export function parseAcceptedEdges(input: string[]): GraphEdge[] {
  const seenEdges = new Set<string>();
  const childToParent = new Map<string, string>();
  const accepted: GraphEdge[] = [];

  for (const entry of input) {
    const normalized = entry.replace(/\s+/g, " ").trim();
    const match = EDGE_PATTERN.exec(normalized);

    if (!match) continue;

    const [, from, to] = match;
    if (from === to) continue;
    if (seenEdges.has(normalized)) continue;
    seenEdges.add(normalized);
    if (childToParent.has(to)) continue;

    childToParent.set(to, from);
    accepted.push({ from, to, label: `${from}->${to}` });
  }

  return accepted;
}

export function buildAdjacency(edges: GraphEdge[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
    adjacency.get(edge.from)!.push(edge.to);
  }

  for (const [node, children] of adjacency.entries()) {
    adjacency.set(node, [...children].sort());
  }

  return adjacency;
}

export function tarjanScc(adjacency: Map<string, string[]>): string[][] {
  let index = 0;
  const stack: string[] = [];
  const stackSet = new Set<string>();
  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const components: string[][] = [];

  function strongConnect(node: string) {
    indexes.set(node, index);
    lowLinks.set(node, index);
    index += 1;
    stack.push(node);
    stackSet.add(node);

    for (const child of adjacency.get(node) ?? []) {
      if (!indexes.has(child)) {
        strongConnect(child);
        lowLinks.set(node, Math.min(lowLinks.get(node)!, lowLinks.get(child)!));
      } else if (stackSet.has(child)) {
        lowLinks.set(node, Math.min(lowLinks.get(node)!, indexes.get(child)!));
      }
    }

    if (lowLinks.get(node) === indexes.get(node)) {
      const component: string[] = [];
      let current = "";
      while (current !== node) {
        current = stack.pop()!;
        stackSet.delete(current);
        component.push(current);
      }
      components.push(component.sort());
    }
  }

  for (const node of [...adjacency.keys()].sort()) {
    if (!indexes.has(node)) {
      strongConnect(node);
    }
  }

  return components.sort((a, b) => a[0].localeCompare(b[0]));
}

export function shortestPath(adjacency: Map<string, string[]>, from: string, to: string): string[] {
  if (!adjacency.has(from) || !adjacency.has(to)) return [];

  const queue: string[][] = [[from]];
  const visited = new Set<string>([from]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];
    if (current === to) return path;

    for (const child of adjacency.get(current) ?? []) {
      if (!visited.has(child)) {
        visited.add(child);
        queue.push([...path, child]);
      }
    }
  }

  return [];
}

export function buildTraversal(adjacency: Map<string, string[]>, root: string) {
  const dfs: string[] = [];
  const bfs: string[] = [];

  function walk(node: string) {
    dfs.push(node);
    for (const child of adjacency.get(node) ?? []) {
      walk(child);
    }
  }

  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift()!;
    bfs.push(current);
    for (const child of adjacency.get(current) ?? []) {
      queue.push(child);
    }
  }

  walk(root);
  return { dfs, bfs };
}
