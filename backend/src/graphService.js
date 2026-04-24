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
    acceptedEdges.push({ from, to });
  }

  return {
    acceptedEdges,
    invalidEntries,
    duplicateEdges,
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

function detectCycleInComponent(adjacency, componentNodeSet) {
  const visitState = new Map();

  function dfs(node) {
    visitState.set(node, 1);

    for (const child of adjacency.get(node) || []) {
      if (!componentNodeSet.has(child)) {
        continue;
      }

      const state = visitState.get(child) || 0;
      if (state === 1) {
        return true;
      }

      if (state === 0 && dfs(child)) {
        return true;
      }
    }

    visitState.set(node, 2);
    return false;
  }

  for (const node of [...componentNodeSet].sort()) {
    if ((visitState.get(node) || 0) === 0 && dfs(node)) {
      return true;
    }
  }

  return false;
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

function buildHierarchyResponse(acceptedEdges) {
  const adjacency = new Map();
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

    adjacency.get(from).push(to);
    inDegree.set(to, (inDegree.get(to) || 0) + 1);
    if (!inDegree.has(from)) {
      inDegree.set(from, 0);
    }
  }

  for (const [node, children] of adjacency.entries()) {
    children.sort();
    adjacency.set(node, children);
  }

  const components = buildConnectedComponents(adjacency, nodes);
  const hierarchies = [];
  let totalTrees = 0;
  let totalCycles = 0;
  let largestTreeRoot = null;
  let largestTreeDepth = -1;

  for (const componentNodes of components) {
    const componentNodeSet = new Set(componentNodes);
    const roots = componentNodes.filter((node) => (inDegree.get(node) || 0) === 0);
    const hasCycle = detectCycleInComponent(adjacency, componentNodeSet);

    if (hasCycle) {
      const root =
        roots.length > 0
          ? [...roots].sort()[0]
          : [...componentNodes].sort()[0];
      hierarchies.push({
        root,
        tree: {},
        has_cycle: true,
      });
      totalCycles += 1;
      continue;
    }

    const root = roots[0];
    const depth = calculateDepth(root, adjacency);
    const tree = buildTreeStructure(root, adjacency);

    hierarchies.push({
      root,
      tree,
      depth,
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

  return {
    hierarchies,
    summary: {
      total_trees: totalTrees,
      total_cycles: totalCycles,
      largest_tree_root: largestTreeRoot,
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

  const { acceptedEdges, invalidEntries, duplicateEdges } = parseValidEdges(inputData);
  const { hierarchies, summary } = buildHierarchyResponse(acceptedEdges);

  return {
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: duplicateEdges,
    summary,
  };
}

module.exports = {
  processGraphPayload,
};
