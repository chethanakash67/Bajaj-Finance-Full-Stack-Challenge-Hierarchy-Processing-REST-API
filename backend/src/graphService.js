const EDGE_PATTERN = /^([A-Z])\s*->\s*([A-Z])$/;

function normalizeEntry(entry) {
  if (typeof entry !== "string") {
    return "";
  }

  return entry.replace(/\s+/g, " ").trim();
}

function parseValidEdges(entries) {
  const invalidEntries = [];
  const duplicateEdges = [];
  const selfLoops = [];
  const seenEdges = new Set();
  const duplicateEdgeSet = new Set();
  const acceptedEdges = [];
  const childToParent = new Map();

  for (const rawEntry of entries) {
    const normalizedEntry = normalizeEntry(rawEntry);
    const match = EDGE_PATTERN.exec(normalizedEntry);

    if (!match) {
      invalidEntries.push(normalizedEntry);
      continue;
    }

    const [, from, to] = match;

    if (from === to) {
      invalidEntries.push(normalizedEntry);
      selfLoops.push(normalizedEntry);
      continue;
    }

    if (seenEdges.has(normalizedEntry)) {
      if (!duplicateEdgeSet.has(normalizedEntry)) {
        duplicateEdgeSet.add(normalizedEntry);
        duplicateEdges.push(normalizedEntry);
      }
      continue;
    }

    seenEdges.add(normalizedEntry);

    // First valid parent wins for a child across the full submission.
    if (childToParent.has(to)) {
      continue;
    }

    childToParent.set(to, from);
    acceptedEdges.push({
      from,
      to,
      label: `${from}->${to}`,
    });
  }

  return {
    acceptedEdges,
    invalidEntries,
    duplicateEdges,
    selfLoops,
  };
}

function buildGraph(acceptedEdges) {
  const adjacency = new Map();
  const reverseAdjacency = new Map();
  const nodes = new Set();
  const inDegree = new Map();

  for (const { from, to } of acceptedEdges) {
    nodes.add(from);
    nodes.add(to);

    if (!adjacency.has(from)) {
      adjacency.set(from, []);
    }

    if (!adjacency.has(to)) {
      adjacency.set(to, []);
    }

    if (!reverseAdjacency.has(from)) {
      reverseAdjacency.set(from, []);
    }

    if (!reverseAdjacency.has(to)) {
      reverseAdjacency.set(to, []);
    }

    adjacency.get(from).push(to);
    reverseAdjacency.get(to).push(from);
    inDegree.set(to, (inDegree.get(to) || 0) + 1);

    if (!inDegree.has(from)) {
      inDegree.set(from, 0);
    }
  }

  for (const node of nodes) {
    if (!adjacency.has(node)) {
      adjacency.set(node, []);
    }

    if (!reverseAdjacency.has(node)) {
      reverseAdjacency.set(node, []);
    }
  }

  for (const [node, children] of adjacency.entries()) {
    children.sort();
    adjacency.set(node, children);
  }

  for (const [node, parents] of reverseAdjacency.entries()) {
    parents.sort();
    reverseAdjacency.set(node, parents);
  }

  return {
    nodes,
    adjacency,
    reverseAdjacency,
    inDegree,
  };
}

function buildConnectedComponents(adjacency, nodes) {
  const undirected = new Map();

  for (const node of nodes) {
    undirected.set(node, new Set());
  }

  for (const [from, children] of adjacency.entries()) {
    for (const child of children) {
      undirected.get(from).add(child);
      undirected.get(child).add(from);
    }
  }

  const visited = new Set();
  const components = [];

  for (const node of [...nodes].sort()) {
    if (visited.has(node)) {
      continue;
    }

    const queue = [node];
    const componentNodes = [];
    visited.add(node);

    while (queue.length > 0) {
      const current = queue.shift();
      componentNodes.push(current);

      for (const neighbor of undirected.get(current) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    components.push(componentNodes.sort());
  }

  return components;
}

function tarjanStronglyConnectedComponents(adjacency, nodes) {
  let index = 0;
  const stack = [];
  const stackSet = new Set();
  const indexes = new Map();
  const lowLinks = new Map();
  const components = [];

  function strongConnect(node) {
    indexes.set(node, index);
    lowLinks.set(node, index);
    index += 1;
    stack.push(node);
    stackSet.add(node);

    for (const child of adjacency.get(node) || []) {
      if (!indexes.has(child)) {
        strongConnect(child);
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(child)));
      } else if (stackSet.has(child)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indexes.get(child)));
      }
    }

    if (lowLinks.get(node) === indexes.get(node)) {
      const component = [];
      let current = null;

      while (current !== node) {
        current = stack.pop();
        stackSet.delete(current);
        component.push(current);
      }

      components.push(component.sort());
    }
  }

  for (const node of [...nodes].sort()) {
    if (!indexes.has(node)) {
      strongConnect(node);
    }
  }

  return components.sort((left, right) => left[0].localeCompare(right[0]));
}

function extractCyclePathForComponent(adjacency, componentNodes) {
  const componentNodeSet = new Set(componentNodes);
  const visited = new Set();
  const inStack = new Set();
  const path = [];
  let cyclePath = null;

  function dfs(node) {
    if (cyclePath) {
      return;
    }

    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const child of adjacency.get(node) || []) {
      if (!componentNodeSet.has(child)) {
        continue;
      }

      if (cyclePath) {
        return;
      }

      if (inStack.has(child)) {
        const cycleStartIndex = path.indexOf(child);
        cyclePath = [...path.slice(cycleStartIndex), child];
        return;
      }

      if (!visited.has(child)) {
        dfs(child);
      }
    }

    path.pop();
    inStack.delete(node);
  }

  for (const node of [...componentNodes].sort()) {
    if (!visited.has(node) && !cyclePath) {
      dfs(node);
    }
  }

  return cyclePath;
}

function chooseBreakingLink(cyclePath) {
  if (!Array.isArray(cyclePath) || cyclePath.length < 2) {
    return null;
  }

  const from = cyclePath[cyclePath.length - 2];
  const to = cyclePath[cyclePath.length - 1];

  return `${from}->${to}`;
}

function buildTreeStructure(root, adjacency) {
  function walk(node) {
    const children = [...(adjacency.get(node) || [])].sort();

    if (children.length === 0) {
      return {};
    }

    const branch = {};

    for (const child of children) {
      branch[child] = walk(child);
    }

    return branch;
  }

  return walk(root);
}

function calculateDepth(root, adjacency) {
  const depthCache = new Map();

  function dfs(node) {
    if (depthCache.has(node)) {
      return depthCache.get(node);
    }

    const children = adjacency.get(node) || [];

    if (children.length === 0) {
      depthCache.set(node, 1);
      return 1;
    }

    let longest = 0;

    for (const child of children) {
      longest = Math.max(longest, dfs(child));
    }

    const depth = longest + 1;
    depthCache.set(node, depth);
    return depth;
  }

  return dfs(root);
}

function buildTraversalOrders(root, adjacency) {
  const dfsOrder = [];
  const bfsOrder = [];

  function dfs(node) {
    dfsOrder.push(node);

    for (const child of adjacency.get(node) || []) {
      dfs(child);
    }
  }

  const queue = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    bfsOrder.push(current);

    for (const child of adjacency.get(current) || []) {
      queue.push(child);
    }
  }

  dfs(root);

  return {
    dfs: dfsOrder,
    bfs: bfsOrder,
  };
}

function roundMetric(value) {
  return Number(value.toFixed(4));
}

function calculateClosenessCentrality(componentNodes, adjacency) {
  const closeness = {};
  const componentNodeSet = new Set(componentNodes);

  for (const source of componentNodes) {
    const queue = [source];
    const distances = new Map([[source, 0]]);

    while (queue.length > 0) {
      const current = queue.shift();

      for (const next of adjacency.get(current) || []) {
        if (!componentNodeSet.has(next) || distances.has(next)) {
          continue;
        }

        distances.set(next, distances.get(current) + 1);
        queue.push(next);
      }
    }

    let distanceSum = 0;
    let reachableNodes = 0;

    for (const [node, distance] of distances.entries()) {
      if (node === source) {
        continue;
      }
      distanceSum += distance;
      reachableNodes += 1;
    }

    closeness[source] =
      reachableNodes > 0 && distanceSum > 0
        ? roundMetric(reachableNodes / distanceSum)
        : 0;
  }

  return closeness;
}

function calculateBetweennessCentrality(componentNodes, adjacency) {
  const componentNodeSet = new Set(componentNodes);
  const betweenness = Object.fromEntries(componentNodes.map((node) => [node, 0]));

  for (const source of componentNodes) {
    const stack = [];
    const predecessors = new Map(componentNodes.map((node) => [node, []]));
    const shortestPathCounts = new Map(componentNodes.map((node) => [node, 0]));
    const distances = new Map(componentNodes.map((node) => [node, -1]));
    shortestPathCounts.set(source, 1);
    distances.set(source, 0);

    const queue = [source];

    while (queue.length > 0) {
      const current = queue.shift();
      stack.push(current);

      for (const next of adjacency.get(current) || []) {
        if (!componentNodeSet.has(next)) {
          continue;
        }

        if (distances.get(next) < 0) {
          queue.push(next);
          distances.set(next, distances.get(current) + 1);
        }

        if (distances.get(next) === distances.get(current) + 1) {
          shortestPathCounts.set(next, shortestPathCounts.get(next) + shortestPathCounts.get(current));
          predecessors.get(next).push(current);
        }
      }
    }

    const dependency = new Map(componentNodes.map((node) => [node, 0]));

    while (stack.length > 0) {
      const node = stack.pop();

      for (const predecessor of predecessors.get(node)) {
        const contribution =
          (shortestPathCounts.get(predecessor) / shortestPathCounts.get(node)) * (1 + dependency.get(node));
        dependency.set(predecessor, dependency.get(predecessor) + contribution);
      }

      if (node !== source) {
        betweenness[node] += dependency.get(node);
      }
    }
  }

  const normalizationFactor =
    componentNodes.length > 2 ? (componentNodes.length - 1) * (componentNodes.length - 2) : 1;

  for (const node of componentNodes) {
    betweenness[node] = roundMetric(betweenness[node] / normalizationFactor);
  }

  return betweenness;
}

function buildCentralityMetrics(components, adjacency) {
  const closeness = {};
  const betweenness = {};
  const bottlenecks = [];
  const topNodesByComponent = {};

  for (const componentNodes of components) {
    const componentCloseness = calculateClosenessCentrality(componentNodes, adjacency);
    const componentBetweenness = calculateBetweennessCentrality(componentNodes, adjacency);
    const componentKey = componentNodes.join("|");
    const rankedNodes = [...componentNodes]
      .sort((left, right) => {
        const betweennessDelta = componentBetweenness[right] - componentBetweenness[left];
        if (betweennessDelta !== 0) {
          return betweennessDelta;
        }

        const closenessDelta = componentCloseness[right] - componentCloseness[left];
        if (closenessDelta !== 0) {
          return closenessDelta;
        }

        return left.localeCompare(right);
      })
      .map((node) => {
        const centralityNode = {
          node,
          component_key: componentKey,
          betweenness: componentBetweenness[node],
          closeness: componentCloseness[node],
        };
        closeness[node] = componentCloseness[node];
        betweenness[node] = componentBetweenness[node];
        bottlenecks.push(centralityNode);
        return centralityNode;
      });

    topNodesByComponent[componentKey] = rankedNodes.slice(0, 3);
  }

  bottlenecks.sort((left, right) => {
    const betweennessDelta = right.betweenness - left.betweenness;
    if (betweennessDelta !== 0) {
      return betweennessDelta;
    }

    const closenessDelta = right.closeness - left.closeness;
    if (closenessDelta !== 0) {
      return closenessDelta;
    }

    return left.node.localeCompare(right.node);
  });

  return {
    closeness,
    betweenness,
    bottlenecks,
    topNodesByComponent,
  };
}

function buildLineageIndex(root, adjacency) {
  const lineageByNode = {};

  function walk(node, trail) {
    const nextTrail = [...trail, node];
    lineageByNode[node] = nextTrail;

    for (const child of adjacency.get(node) || []) {
      walk(child, nextTrail);
    }
  }

  walk(root, []);
  return lineageByNode;
}

function buildHierarchyResponse(acceptedEdges, selfLoops) {
  const { nodes, adjacency, reverseAdjacency, inDegree } = buildGraph(acceptedEdges);
  const components = buildConnectedComponents(adjacency, nodes);
  const stronglyConnectedComponents = tarjanStronglyConnectedComponents(adjacency, nodes);
  const centrality = buildCentralityMetrics(components, adjacency);
  const hierarchies = [];
  const componentDetails = [];
  const cycleComponents = [];
  const componentRootByKey = {};
  let totalTrees = 0;
  let totalCycles = 0;
  let largestTreeRoot = null;
  let largestTreeDepth = -1;

  for (const componentNodes of components) {
    const componentKey = componentNodes.join("|");
    const roots = componentNodes.filter((node) => (inDegree.get(node) || 0) === 0);
    const componentSccs = stronglyConnectedComponents.filter((component) =>
      component.every((node) => componentNodes.includes(node))
    );
    const cyclicSccs = componentSccs.filter((component) => component.length > 1);
    const hasCycle = cyclicSccs.length > 0;
    const root =
      roots.length > 0
        ? [...roots].sort()[0]
        : [...componentNodes].sort()[0];
    componentRootByKey[componentKey] = root;
    const componentEdges = acceptedEdges
      .filter(({ from, to }) => componentNodes.includes(from) && componentNodes.includes(to))
      .map(({ label }) => label)
      .sort();

    if (hasCycle) {
      const cyclePath = extractCyclePathForComponent(adjacency, componentNodes);
      const breakingLink = chooseBreakingLink(cyclePath);

      hierarchies.push({
        root,
        tree: {},
        has_cycle: true,
      });

      componentDetails.push({
        root,
        type: "cycle",
        nodes: componentNodes,
        edges: componentEdges,
        strongly_connected_components: cyclicSccs,
        cycle_path: cyclePath,
        breaking_link: breakingLink,
        top_central_nodes: centrality.topNodesByComponent[componentKey] || [],
      });

      cycleComponents.push({
        root,
        nodes: componentNodes,
        cycle_path: cyclePath,
        breaking_link: breakingLink,
      });

      totalCycles += 1;
      continue;
    }

    const depth = calculateDepth(root, adjacency);
    const tree = buildTreeStructure(root, adjacency);
    const traversal = buildTraversalOrders(root, adjacency);
    const lineage = buildLineageIndex(root, adjacency);

    hierarchies.push({
      root,
      tree,
      depth,
    });

    componentDetails.push({
      root,
      type: "tree",
      nodes: componentNodes,
      edges: componentEdges,
      depth,
      traversal,
      lineage,
      top_central_nodes: centrality.topNodesByComponent[componentKey] || [],
    });

    totalTrees += 1;

    if (
      depth > largestTreeDepth ||
      (depth === largestTreeDepth && (largestTreeRoot === null || root < largestTreeRoot))
    ) {
      largestTreeDepth = depth;
      largestTreeRoot = root;
    }
  }

  hierarchies.sort((left, right) => left.root.localeCompare(right.root));
  componentDetails.sort((left, right) => left.root.localeCompare(right.root));
  cycleComponents.sort((left, right) => left.root.localeCompare(right.root));
  const centralityBottlenecks = centrality.bottlenecks.map((entry) => ({
    ...entry,
    component_root: componentRootByKey[entry.component_key] || null,
  }));

  return {
    hierarchies,
    summary: {
      total_trees: totalTrees,
      total_cycles: totalCycles,
      largest_tree_root: largestTreeRoot,
    },
    analytics: {
      accepted_edges: acceptedEdges.map(({ label }) => label),
      self_loops: selfLoops,
      disconnected_components: components.length,
      connected_components: componentDetails,
      cycle_components: cycleComponents,
      strongly_connected_components: stronglyConnectedComponents,
      centrality: {
        closeness: centrality.closeness,
        betweenness: centrality.betweenness,
        bottlenecks: centralityBottlenecks,
      },
      parser: {
        vertices: nodes.size,
        edges: acceptedEdges.length,
        complexity: `O(${nodes.size}+${acceptedEdges.length})`,
      },
      reverse_adjacency: Object.fromEntries(
        [...reverseAdjacency.entries()].map(([node, parents]) => [node, parents])
      ),
    },
  };
}

function processGraphPayload(payload) {
  const inputData = payload?.data;

  if (!Array.isArray(inputData)) {
    const error = new Error('Request body must contain a "data" array.');
    error.statusCode = 400;
    throw error;
  }

  const { acceptedEdges, invalidEntries, duplicateEdges, selfLoops } = parseValidEdges(inputData);
  const { hierarchies, summary, analytics } = buildHierarchyResponse(acceptedEdges, selfLoops);

  return {
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: duplicateEdges,
    summary,
    analytics,
  };
}

module.exports = {
  calculateBetweennessCentrality,
  calculateClosenessCentrality,
  normalizeEntry,
  parseValidEdges,
  tarjanStronglyConnectedComponents,
  processGraphPayload,
};
