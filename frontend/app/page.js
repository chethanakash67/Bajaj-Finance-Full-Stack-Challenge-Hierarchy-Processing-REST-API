"use client";

import { memo, useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://bajaj-finance-full-stack-challenge.onrender.com";
const API_ENDPOINT_DISPLAY =
  process.env.NEXT_PUBLIC_API_ENDPOINT_DISPLAY || "https://bajaj-finance-full-stack-challenge.onrender.com/bfhl";
const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL || "https://bajaj-finance-full-stack-challenge.vercel.app/";
const GITHUB_REPO_URL =
  process.env.NEXT_PUBLIC_GITHUB_REPO_URL || "https://github.com/chethanakash67/Bajaj-Finance-Full-Stack-Challenge-Hierarchy-Processing-REST-API";

const INITIAL_STATUS = "Awaiting graph input.";
const EDGE_PATTERN = /^([A-Z])\s*->\s*([A-Z])$/;

const USER_PROFILE = {
  user_id: "G CHETHAN AKASH",
  email_id: "ga0822@srmist.edu.in",
  college_roll_number: "RA2311028010059",
};

/* ═══════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
   ═══════════════════════════════════════════════════════════ */
function formatDisplayName(name) {
  return name.toLowerCase().split(/\s+/).filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function formatIdentityDisplay(rawValue) {
  const normalized = String(rawValue || "").replace(/_/g, " ").trim();
  const parts = normalized.split(/\s+/).filter(Boolean);
  const numericSuffix = /^\d{6,}$/.test(parts[parts.length - 1] || "") ? parts.pop() : "";
  const displayName = parts.length > 0 ? formatDisplayName(parts.join(" ")) : formatDisplayName(normalized);
  return { displayName, numericSuffix };
}

function formatMetric(value) {
  return Number(value || 0).toFixed(4).replace(/\.?0+$/, "");
}

function parseEdges(rawText) {
  if (rawText.trim().length === 0) return [];
  return rawText.split(/\n|,/).map((item) => item.trim());
}

function analyzeInput(entries) {
  const invalidEntries = [], duplicateEdges = [];
  const seenEdges = new Set(), duplicateSeen = new Set();
  let validLookingCount = 0;
  const uniqueNodes = new Set();
  let edgeCount = 0;
  for (const entry of entries) {
    if (entry.length === 0) { invalidEntries.push("(empty)"); continue; }
    const match = EDGE_PATTERN.exec(entry);
    if (!match || match[1] === match[2]) { invalidEntries.push(entry); continue; }
    validLookingCount += 1;
    uniqueNodes.add(match[1]);
    uniqueNodes.add(match[2]);
    edgeCount++;
    if (seenEdges.has(entry) && !duplicateSeen.has(entry)) {
      duplicateSeen.add(entry); duplicateEdges.push(entry); continue;
    }
    seenEdges.add(entry);
  }
  return { invalidEntries, duplicateEdges, validLookingCount, nodeCount: uniqueNodes.size, edgeCount };
}

function syntaxHighlightJson(json) {
  return json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = "json-number";
        if (/^"/.test(match)) cls = /:$/.test(match) ? "json-key" : "json-string";
        else if (/true|false/.test(match)) cls = "json-bool";
        else if (/null/.test(match)) cls = "json-null";
        return `<span class="${cls}">${match}</span>`;
      }
    );
}

/* Classify each line for syntax highlighting */
function classifyLine(line, seenEdges) {
  if (line.trim().length === 0) return "empty";
  const match = EDGE_PATTERN.exec(line.trim());
  if (!match || match[1] === match[2]) return "invalid";
  const normalized = line.trim();
  if (seenEdges.has(normalized)) return "duplicate";
  seenEdges.add(normalized);
  return "valid";
}

function buildAcceptedGraph(edgeLabels) {
  const adjacency = new Map();
  const nodes = new Set();
  const edges = [];

  for (const label of edgeLabels || []) {
    const match = EDGE_PATTERN.exec(label);
    if (!match) continue;

    const [, from, to] = match;
    nodes.add(from);
    nodes.add(to);
    if (!adjacency.has(from)) adjacency.set(from, []);
    if (!adjacency.has(to)) adjacency.set(to, []);
    adjacency.get(from).push(to);
    edges.push({ from, to, label: `${from}->${to}` });
  }

  for (const [node, children] of adjacency.entries()) {
    children.sort();
    adjacency.set(node, children);
  }

  return { nodes: [...nodes].sort(), adjacency, edges };
}

function findShortestPath(adjacency, from, to) {
  if (!from || !to || !adjacency.has(from) || !adjacency.has(to)) {
    return [];
  }

  const queue = [[from]];
  const visited = new Set([from]);

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];

    if (current === to) {
      return path;
    }

    for (const next of adjacency.get(current) || []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }

  return [];
}

function findLowestCommonAncestor(lineageByNode, from, to) {
  const fromPath = lineageByNode?.[from] || [];
  const toPath = lineageByNode?.[to] || [];
  const sharedLength = Math.min(fromPath.length, toPath.length);
  let lca = null;

  for (let index = 0; index < sharedLength; index += 1) {
    if (fromPath[index] !== toPath[index]) {
      break;
    }
    lca = fromPath[index];
  }

  return lca;
}

function buildMermaidGraph(edgeLabels) {
  const lines = ["graph TD"];
  for (const edge of edgeLabels || []) {
    const match = EDGE_PATTERN.exec(edge);
    if (!match) continue;
    lines.push(`  ${match[1]} --> ${match[2]}`);
  }
  return lines.join("\n");
}

function flattenTree(root, subtree) {
  const nodes = [];
  const edges = [];

  function walk(name, branch, depth, parent = null) {
    const children = Object.entries(branch);
    nodes.push({ name, depth, parent, childCount: children.length });

    for (const [childName, childBranch] of children) {
      edges.push({ from: name, to: childName, label: `${name}->${childName}` });
      walk(childName, childBranch, depth + 1, name);
    }
  }

  walk(root, subtree, 0);
  return { nodes, edges };
}

/* ═══════════════════════════════════════════════════════════
   SVG TREE — Multi-View Graph Canvas
   ═══════════════════════════════════════════════════════════ */
const NODE_W = 44;
const NODE_H = 32;
const H_GAP = 14;
const V_GAP = 44;
const FORCE_ITERATIONS = 140;

function countLeaves(subtree) {
  const children = Object.values(subtree);
  if (children.length === 0) return 1;
  return children.reduce((sum, child) => sum + countLeaves(child), 0);
}

function layoutVertical(root, subtree) {
  const nodes = [];
  const edges = [];
  let xCounter = 0;

  function walk(name, branch, depth, parent = null) {
    const children = Object.entries(branch);

    if (children.length === 0) {
      const node = {
        name,
        x: xCounter * (NODE_W + H_GAP),
        y: depth * (NODE_H + V_GAP),
        depth,
        childCount: 0,
        parent,
      };
      xCounter += 1;
      nodes.push(node);
      return node;
    }

    const childNodes = children.map(([childName, childBranch]) => walk(childName, childBranch, depth + 1, name));
    const node = {
      name,
      x: (Math.min(...childNodes.map((child) => child.x)) + Math.max(...childNodes.map((child) => child.x))) / 2,
      y: depth * (NODE_H + V_GAP),
      depth,
      childCount: childNodes.length,
      parent,
    };
    nodes.push(node);

    for (const child of childNodes) {
      edges.push({ from: name, to: child.name, label: `${name}->${child.name}` });
    }

    return node;
  }

  walk(root, subtree, 0);
  return { nodes, edges };
}

function layoutRadial(root, subtree) {
  const nodes = [];
  const edges = [];
  const maxDepthRef = { value: 0 };

  function walk(name, branch, depth, startAngle, endAngle, parent = null) {
    const angle = (startAngle + endAngle) / 2;
    maxDepthRef.value = Math.max(maxDepthRef.value, depth);
    const radius = depth === 0 ? 0 : depth * 88;
    nodes.push({
      name,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      depth,
      childCount: Object.keys(branch).length,
      parent,
    });

    const children = Object.entries(branch);
    if (children.length === 0) return;

    const totalLeaves = children.reduce((sum, [, childBranch]) => sum + countLeaves(childBranch), 0);
    let currentAngle = startAngle;

    for (const [childName, childBranch] of children) {
      const childLeaves = countLeaves(childBranch);
      const sweep = (childLeaves / totalLeaves) * (endAngle - startAngle);
      const nextAngle = currentAngle + sweep;
      edges.push({ from: name, to: childName, label: `${name}->${childName}` });
      walk(childName, childBranch, depth + 1, currentAngle, nextAngle, name);
      currentAngle = nextAngle;
    }
  }

  walk(root, subtree, 0, -Math.PI / 2, Math.PI * 1.5);
  const radiusShift = Math.max(1, maxDepthRef.value) * 88 + 64;

  return {
    nodes: nodes.map((node) => ({ ...node, x: node.x + radiusShift, y: node.y + radiusShift })),
    edges,
  };
}

function layoutForce(root, subtree) {
  const flat = flattenTree(root, subtree);
  const nodeNames = flat.nodes.map((node) => node.name);
  const positions = new Map();
  const velocities = new Map();
  const size = Math.max(260, flat.nodes.length * 34);
  const center = size / 2;

  flat.nodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(flat.nodes.length, 1);
    const radius = node.depth === 0 ? 0 : 40 + node.depth * 38;
    positions.set(node.name, {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
    });
    velocities.set(node.name, { x: 0, y: 0 });
  });

  for (let iteration = 0; iteration < FORCE_ITERATIONS; iteration += 1) {
    for (const name of nodeNames) {
      const force = { x: 0, y: 0 };
      const position = positions.get(name);

      for (const other of nodeNames) {
        if (name === other) continue;
        const otherPosition = positions.get(other);
        const dx = position.x - otherPosition.x;
        const dy = position.y - otherPosition.y;
        const distance = Math.max(28, Math.hypot(dx, dy));
        const repulsion = 900 / (distance * distance);
        force.x += (dx / distance) * repulsion;
        force.y += (dy / distance) * repulsion;
      }

      for (const edge of flat.edges) {
        if (edge.from !== name && edge.to !== name) continue;
        const otherName = edge.from === name ? edge.to : edge.from;
        const otherPosition = positions.get(otherName);
        const dx = otherPosition.x - position.x;
        const dy = otherPosition.y - position.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const attraction = (distance - 90) * 0.015;
        force.x += (dx / distance) * attraction;
        force.y += (dy / distance) * attraction;
      }

      if (name === root) {
        force.x += (center - position.x) * 0.08;
        force.y += (center - position.y) * 0.08;
      }

      const velocity = velocities.get(name);
      velocity.x = (velocity.x + force.x) * 0.84;
      velocity.y = (velocity.y + force.y) * 0.84;
    }

    for (const name of nodeNames) {
      const position = positions.get(name);
      const velocity = velocities.get(name);
      position.x += velocity.x;
      position.y += velocity.y;
    }
  }

  return {
    nodes: flat.nodes.map((node) => ({
      ...node,
      x: positions.get(node.name).x,
      y: positions.get(node.name).y,
    })),
    edges: flat.edges,
  };
}

function buildLayout(root, subtree, viewMode) {
  switch (viewMode) {
    case "radial":
      return layoutRadial(root, subtree);
    case "force":
      return layoutForce(root, subtree);
    default:
      return layoutVertical(root, subtree);
  }
}

function serializeSvgToPng(svgElement, fileName) {
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svgElement);
  const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const image = new Image();

  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = svgElement.viewBox?.baseVal?.width || svgElement.width.baseVal.value || 1200;
    canvas.height = svgElement.viewBox?.baseVal?.height || svgElement.height.baseVal.value || 800;
    const context = canvas.getContext("2d");
    context.fillStyle = "#0d0d12";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    URL.revokeObjectURL(url);
    const download = document.createElement("a");
    download.href = canvas.toDataURL("image/png");
    download.download = fileName;
    download.click();
  };

  image.src = url;
}

function SVGTree({
  root,
  subtree,
  hasCycle,
  cyclePath,
  breakingLink,
  viewMode,
  playbackNodes,
  highlightNodes,
  highlightEdges,
  registerSvgRef,
}) {
  const wrapperRef = useRef(null);
  const svgRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [draggingCanvas, setDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [inspectedNode, setInspectedNode] = useState(null);
  const [draggingNode, setDraggingNode] = useState(null);
  const [nodeOffsets, setNodeOffsets] = useState({});

  const layout = useMemo(() => {
    if (hasCycle) return { nodes: [], edges: [] };
    return buildLayout(root, subtree, viewMode);
  }, [root, subtree, hasCycle, viewMode]);

  useEffect(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
    setInspectedNode(null);
    setDraggingNode(null);
    setNodeOffsets({});
  }, [root, subtree, viewMode]);

  useEffect(() => {
    if (typeof registerSvgRef === "function") {
      registerSvgRef(root, svgRef.current);
    }
  }, [registerSvgRef, root, layout]);

  const PAD = 30;
  const renderedNodes = layout.nodes.map((node) => {
    const offset = nodeOffsets[node.name] || { x: 0, y: 0 };
    return {
      ...node,
      x: node.x + offset.x,
      y: node.y + offset.y,
    };
  });
  const nodePositions = new Map(renderedNodes.map((node) => [node.name, node]));
  const minX = renderedNodes.length > 0 ? Math.min(...renderedNodes.map((node) => node.x)) : 0;
  const maxX = renderedNodes.length > 0 ? Math.max(...renderedNodes.map((node) => node.x)) : 200;
  const minY = renderedNodes.length > 0 ? Math.min(...renderedNodes.map((node) => node.y)) : 0;
  const maxY = renderedNodes.length > 0 ? Math.max(...renderedNodes.map((node) => node.y)) : 120;
  const canvasW = Math.max(maxX - minX + NODE_W + PAD * 2, 300);
  const canvasH = Math.max(maxY - minY + NODE_H + PAD * 2, 120);
  const translateX = PAD - minX;
  const translateY = PAD - minY;

  function onMouseDown(event) {
    if (event.target.closest(".svg-node-group")) return;
    setDraggingCanvas(true);
    setDragStart({ x: event.clientX - transform.x, y: event.clientY - transform.y });
  }

  function onMouseMove(event) {
    if (draggingNode) {
      const dx = (event.clientX - draggingNode.startX) / transform.scale;
      const dy = (event.clientY - draggingNode.startY) / transform.scale;
      setNodeOffsets((prev) => ({
        ...prev,
        [draggingNode.name]: {
          x: draggingNode.origin.x + dx,
          y: draggingNode.origin.y + dy,
        },
      }));
      return;
    }

    if (!draggingCanvas) return;
    setTransform((prev) => ({ ...prev, x: event.clientX - dragStart.x, y: event.clientY - dragStart.y }));
  }

  function onMouseUp() {
    setDraggingCanvas(false);
    setDraggingNode(null);
  }

  function getPathFromRoot(nodeName) {
    const path = [];

    function search(name, branch, trail) {
      trail.push(name);
      if (name === nodeName) {
        path.push(...trail);
        return true;
      }

      for (const [childName, childBranch] of Object.entries(branch)) {
        if (search(childName, childBranch, trail)) return true;
      }

      trail.pop();
      return false;
    }

    search(root, subtree, []);
    return path;
  }

  if (hasCycle) {
    return (
      <div className="cycle-viz-container">
        <div className="cycle-card-v2">
          <div className="cycle-icon">⟳</div>
          <p className="cycle-title">Cyclic Component Detected</p>
          {cyclePath && cyclePath.length > 0 && (
            <div className="cycle-path-chain">
              {cyclePath.map((node, index) => (
                <span key={`${node}-${index}`}>
                  <span className={`cycle-path-node ${index === cyclePath.length - 1 ? "cycle-end" : ""}`}>{node}</span>
                  {index < cyclePath.length - 1 && <span className="cycle-arrow">→</span>}
                </span>
              ))}
            </div>
          )}
          {breakingLink && (
            <p className="cycle-break-hint">
              Suggested breaking link: <strong>{breakingLink}</strong>
            </p>
          )}
          <p className="cycle-subtitle">Tree view disabled for this component</p>
        </div>
      </div>
    );
  }

  return (
    <div className="svg-tree-wrapper" ref={wrapperRef}>
      <div className="svg-tree-controls">
        <button type="button" onClick={() => setTransform((prev) => ({ ...prev, scale: Math.min(3, prev.scale * 1.25) }))}>+</button>
        <button type="button" onClick={() => setTransform((prev) => ({ ...prev, scale: Math.max(0.3, prev.scale * 0.8) }))}>−</button>
        <button type="button" onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}>⟲</button>
        <button type="button" onClick={() => svgRef.current && serializeSvgToPng(svgRef.current, `${root}-${viewMode}.png`)}>⇩</button>
      </div>
      <svg
        ref={svgRef}
        className="svg-tree"
        width={canvasW}
        height={canvasH}
        viewBox={`0 0 ${canvasW} ${canvasH}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: draggingNode ? "grabbing" : draggingCanvas ? "grabbing" : "grab" }}
      >
        <g transform={`translate(${transform.x + translateX}, ${transform.y + translateY}) scale(${transform.scale})`}>
          {layout.edges.map((edge, index) => {
            const fromNode = nodePositions.get(edge.from);
            const toNode = nodePositions.get(edge.to);
            if (!fromNode || !toNode) return null;

            const x1 = fromNode.x + NODE_W / 2;
            const y1 = fromNode.y + NODE_H / 2;
            const x2 = toNode.x + NODE_W / 2;
            const y2 = toNode.y + NODE_H / 2;
            const isHighlightedEdge = highlightEdges?.has(edge.label);

            if (viewMode === "vertical") {
              const midY = (y1 + y2) / 2;
              return (
                <path
                  key={`edge-${edge.label}-${index}`}
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  className={`svg-edge ${isHighlightedEdge ? "highlighted" : ""}`}
                />
              );
            }

            return (
              <line
                key={`edge-${edge.label}-${index}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className={`svg-edge ${isHighlightedEdge ? "highlighted" : ""}`}
              />
            );
          })}
          {renderedNodes.map((node, index) => {
            const isSelected = inspectedNode === node.name;
            const isPlayback = playbackNodes?.has(node.name);
            const isHighlightedNode = highlightNodes?.has(node.name);

            return (
              <g
                key={`node-${node.name}-${index}`}
                className="svg-node-group"
                transform={`translate(${node.x}, ${node.y})`}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  setDraggingNode({
                    name: node.name,
                    startX: event.clientX,
                    startY: event.clientY,
                    origin: nodeOffsets[node.name] || { x: 0, y: 0 },
                  });
                }}
                onClick={() => setInspectedNode(inspectedNode === node.name ? null : node.name)}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx="6"
                  ry="6"
                  className={[
                    "svg-node-rect",
                    isSelected ? "inspected" : "",
                    node.name === root ? "root-node" : "",
                    isPlayback ? "playback-node" : "",
                    isHighlightedNode ? "highlighted-node" : "",
                  ].filter(Boolean).join(" ")}
                />
                <text
                  x={NODE_W / 2}
                  y={NODE_H / 2}
                  className="svg-node-label"
                  dominantBaseline="central"
                  textAnchor="middle"
                >
                  {node.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {inspectedNode && (
        <div className="node-tooltip">
          <div className="node-tooltip-header">
            <span className="node-tooltip-name">{inspectedNode}</span>
            <button className="node-tooltip-close" onClick={() => setInspectedNode(null)}>✕</button>
          </div>
          {(() => {
            const node = renderedNodes.find((item) => item.name === inspectedNode);
            const pathFromRoot = getPathFromRoot(inspectedNode);
            return (
              <>
                <div className="node-tooltip-row"><span>Depth</span><strong>{node?.depth ?? 0}</strong></div>
                <div className="node-tooltip-row"><span>Children</span><strong>{node?.childCount ?? 0}</strong></div>
                <div className="node-tooltip-row"><span>Path</span><strong className="node-tooltip-path">{pathFromRoot.join(" → ")}</strong></div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function HierarchyPreviewCard({
  root,
  depth,
  hasCycle,
  breakingLink,
  onSelect,
  childrenCount,
}) {
  return (
    <div className="hierarchy-preview">
      <div>
        <p className="hierarchy-preview-title">{root}</p>
        <p className="hierarchy-preview-meta">
          {hasCycle
            ? `Cycle detected${breakingLink ? ` · break ${breakingLink}` : ""}`
            : `Depth ${depth} · ${childrenCount} direct child${childrenCount === 1 ? "" : "ren"}`}
        </p>
      </div>
      <button type="button" className="secondary-button preview-open-btn" onClick={onSelect}>
        Open
      </button>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   SYNTAX-HIGHLIGHTED INPUT
   ═══════════════════════════════════════════════════════════ */
function SyntaxInput({ value, onChange, textareaRef, onFileDrop }) {
  const preRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function syncScroll(e) {
    if (preRef.current) {
      preRef.current.scrollTop = e.target.scrollTop;
      preRef.current.scrollLeft = e.target.scrollLeft;
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        try {
          // Try JSON format: { data: [...] }
          const parsed = JSON.parse(text);
          if (parsed.data && Array.isArray(parsed.data)) {
            onFileDrop(parsed.data.join("\n"));
            return;
          }
        } catch {
          // Not JSON, treat as plain text
        }
        onFileDrop(text);
      };
      reader.readAsText(file);
    }
  }

  // Build highlighted lines
  const lines = value.split("\n");
  const seenEdges = new Set();
  const highlightedLines = lines.map((line) => {
    const cls = classifyLine(line, seenEdges);
    return { text: line, cls };
  });

  return (
    <div
      className={`syntax-input-wrapper ${isDragOver ? "drag-over" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="drop-overlay">
          <div className="drop-icon">📄</div>
          <p>Drop .txt or .json file</p>
        </div>
      )}
      <div className="line-numbers">
        {lines.map((_, i) => (
          <span key={i} className="line-num">{i + 1}</span>
        ))}
      </div>
      <div className="syntax-editor-area">
        <pre ref={preRef} className="syntax-highlight-layer" aria-hidden="true">
          {highlightedLines.map((hl, i) => (
            <span key={i} className={`hl-line hl-${hl.cls}`}>
              {hl.text || " "}
              {"\n"}
            </span>
          ))}
        </pre>
        <textarea
          ref={textareaRef}
          className="syntax-textarea"
          value={value}
          onChange={onChange}
          onScroll={syncScroll}
          spellCheck="false"
          placeholder={"A->B\nA->C\nB->D"}
        />
      </div>
    </div>
  );
}

const MemoSyntaxInput = memo(SyntaxInput);

/* ═══════════════════════════════════════════════════════════
   SKELETON LOADER
   ═══════════════════════════════════════════════════════════ */
function SkeletonPanel({ lines = 4, wide = false }) {
  return (
    <div className="skeleton-panel">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`skeleton-bar ${i === 0 ? "skeleton-title" : ""} ${wide && i > 0 ? "skeleton-wide" : ""}`}
          style={{ animationDelay: `${i * 0.1}s`, width: i === 0 ? "40%" : `${60 + Math.random() * 35}%` }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function HomePage() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [error, setError] = useState("");
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copyToast, setCopyToast] = useState("");
  const [activeNav, setActiveNav] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [viewMode, setViewMode] = useState("vertical");
  const [traversalMode, setTraversalMode] = useState("dfs");
  const [requestTime, setRequestTime] = useState(null);
  const [searchNode, setSearchNode] = useState("");
  const [pathFrom, setPathFrom] = useState("");
  const [pathTo, setPathTo] = useState("");
  const [pathResult, setPathResult] = useState([]);
  const [pathStatus, setPathStatus] = useState("");
  const [lcaFrom, setLcaFrom] = useState("");
  const [lcaTo, setLcaTo] = useState("");
  const [lcaStatus, setLcaStatus] = useState("");
  const [selectedRoot, setSelectedRoot] = useState(null);
  const [playbackActive, setPlaybackActive] = useState(false);
  const [playbackStep, setPlaybackStep] = useState(-1);
  const textareaRef = useRef(null);
  const treeSvgRefs = useRef({});

  // Theme persistence
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("hi-theme") : null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("hi-theme", theme);
  }, [theme]);

  const parsedLines = useMemo(() => parseEdges(input), [input]);
  const liveAnalysis = useMemo(() => analyzeInput(parsedLines), [parsedLines]);
  const totalParsedLines = parsedLines.length;
  const jsonString = useMemo(() => response ? JSON.stringify(response, null, 2) : null, [response]);
  const renderableTrees = response ? response.hierarchies.filter((h) => !h.has_cycle) : [];
  const hasRenderableTrees = renderableTrees.length > 0;
  const showHierarchyFallback = !response || !hasRenderableTrees;
  const analytics = response?.analytics || null;
  const graphCentrality = analytics?.centrality || null;
  const componentDetails = analytics?.connected_components || [];
  const componentByRoot = useMemo(
    () => Object.fromEntries(componentDetails.map((detail) => [detail.root, detail])),
    [componentDetails]
  );
  const acceptedGraph = useMemo(
    () => buildAcceptedGraph(analytics?.accepted_edges || []),
    [analytics]
  );
  const allGraphNodes = acceptedGraph.nodes;
  const cyclePaths = useMemo(
    () => Object.fromEntries((analytics?.cycle_components || []).map((cycle) => [cycle.root, cycle.cycle_path || []])),
    [analytics]
  );
  const breakingLinks = useMemo(
    () => Object.fromEntries((analytics?.cycle_components || []).map((cycle) => [cycle.root, cycle.breaking_link || null])),
    [analytics]
  );
  const selfLoopEntries = analytics?.self_loops || [];
  const disconnectedComponents = analytics?.disconnected_components || 0;

  const parsedRef = useRef(parsedLines);
  parsedRef.current = parsedLines;

  // Complexity estimate
  const complexity = useMemo(() => {
    if (analytics?.parser) {
      const { vertices, edges } = analytics.parser;
      return { V: vertices, E: edges, total: vertices + edges };
    }
    const { nodeCount, edgeCount } = liveAnalysis;
    return { V: nodeCount, E: edgeCount, total: nodeCount + edgeCount };
  }, [analytics, liveAnalysis]);

  const selectedComponent = selectedRoot ? componentByRoot[selectedRoot] : null;
  const selectedTreeNodes =
    selectedComponent?.type === "tree"
      ? [...(selectedComponent.nodes || [])].sort()
      : [];
  const selectedTopBottlenecks = selectedComponent?.top_central_nodes || [];
  const globalTopBottlenecks = graphCentrality?.bottlenecks?.slice(0, 5) || [];
  const playbackOrder =
    selectedComponent?.type === "tree"
      ? selectedComponent.traversal?.[traversalMode] || []
      : [];
  const playbackNodes = useMemo(
    () => new Set(playbackOrder.slice(0, playbackStep + 1)),
    [playbackOrder, playbackStep]
  );

  const normalizedSearchNode = searchNode.trim().toUpperCase();
  const searchContext = useMemo(() => {
    if (!normalizedSearchNode) {
      return null;
    }

    const detail = componentDetails.find((component) => component.nodes?.includes(normalizedSearchNode));

    if (!detail) {
      return null;
    }

    const lineage = detail.lineage?.[normalizedSearchNode] || [normalizedSearchNode];
    return {
      root: detail.root,
      nodes: new Set(lineage),
      edges: new Set(lineage.slice(1).map((node, index) => `${lineage[index]}->${node}`)),
    };
  }, [componentDetails, normalizedSearchNode]);

  const pathNodes = useMemo(() => new Set(pathResult), [pathResult]);
  const pathEdges = useMemo(
    () => new Set(pathResult.slice(1).map((node, index) => `${pathResult[index]}->${node}`)),
    [pathResult]
  );

  const handleSubmit = useCallback(async (event) => {
    if (event) event.preventDefault();
    const lines = parsedRef.current;
    const count = lines.length;
    if (count === 0 || (count === 1 && lines[0] === "")) {
      setError("Please enter at least one edge.");
      setStatus("No request sent.");
      setResponse(null);
      return;
    }
    setIsLoading(true); setError(""); setCopyToast("");
    setStatus("Dispatching…");
    setRequestTime(null);
    const t0 = performance.now();
    try {
      const apiResponse = await fetch(`${API_BASE_URL}/bfhl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: lines }),
      });
      const payload = await apiResponse.json();
      const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
      setRequestTime(elapsed);
      if (!apiResponse.ok) throw new Error(`${apiResponse.status} · ${payload.message || "Failed"}`);
      setResponse(payload);
      setStatus(`Response in ${elapsed}s`);
    } catch (submitError) {
      setRequestTime(((performance.now() - t0) / 1000).toFixed(2));
      setError(submitError.message === "Failed to fetch"
        ? "Network error · Could not reach API."
        : submitError.message);
      setStatus("API unreachable.");
      setResponse(null);
    } finally { setIsLoading(false); }
  }, []);

  async function handleCopyJson() {
    if (!jsonString) return;
    await navigator.clipboard.writeText(jsonString);
    setCopyToast("Copied ✓");
    window.setTimeout(() => setCopyToast(""), 2000);
  }

  function handleDownloadJson() {
    if (!jsonString) return;
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hierarchy-response.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleClear() {
    setInput(""); setResponse(null); setError(""); setCopyToast("");
    setStatus(INITIAL_STATUS); setRequestTime(null);
    if (textareaRef.current) textareaRef.current.focus();
  }

  function handleInputChange(event) {
    setInput(event.target.value); setResponse(null); setError(""); setCopyToast("");
    setStatus("Input updated."); setRequestTime(null);
  }

  function handleFileDrop(text) {
    setInput(text); setResponse(null); setError(""); setCopyToast("");
    setStatus("File loaded.");
  }

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleSubmit(); }
      if (e.key === "Escape") { e.preventDefault(); handleClear(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSubmit]);

  useEffect(() => {
    if (renderableTrees.length > 0) {
      setSelectedRoot((current) => {
        if (current && componentByRoot[current]) {
          return current;
        }
        return renderableTrees[0].root;
      });
    } else {
      setSelectedRoot(null);
    }

    setPlaybackActive(false);
    setPlaybackStep(-1);
    setPathResult([]);
    setPathStatus("");
    setLcaFrom("");
    setLcaTo("");
    setLcaStatus("");
  }, [renderableTrees, componentByRoot]);

  useEffect(() => {
    if (searchContext?.root) {
      setSelectedRoot(searchContext.root);
    }
  }, [searchContext]);

  useEffect(() => {
    setPlaybackActive(false);
    setPlaybackStep(-1);
  }, [selectedRoot, traversalMode]);

  useEffect(() => {
    setLcaFrom("");
    setLcaTo("");
    setLcaStatus("");
  }, [selectedRoot]);

  useEffect(() => {
    if (!playbackActive || playbackOrder.length === 0) {
      return undefined;
    }

    if (playbackStep >= playbackOrder.length - 1) {
      setPlaybackActive(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setPlaybackStep((current) => current + 1);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [playbackActive, playbackOrder, playbackStep]);

  function handleNavClick(item) {
    setActiveNav(item.key); setSidebarOpen(false);
    const el = document.getElementById(item.targetId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handlePlaybackToggle() {
    if (!playbackOrder.length) {
      return;
    }

    if (playbackStep < 0 || playbackStep >= playbackOrder.length - 1) {
      setPlaybackStep(0);
    }

    setPlaybackActive((current) => !current);
  }

  function handlePlaybackReset() {
    setPlaybackActive(false);
    setPlaybackStep(-1);
  }

  function handleFindPath() {
    if (!pathFrom || !pathTo) {
      setPathStatus("Choose both start and end nodes.");
      setPathResult([]);
      return;
    }

    const result = findShortestPath(acceptedGraph.adjacency, pathFrom, pathTo);
    setPathResult(result);

    if (result.length > 0) {
      const matchingComponent = componentDetails.find((component) => result.every((node) => component.nodes?.includes(node)));
      if (matchingComponent) {
        setSelectedRoot(matchingComponent.root);
      }
      setPathStatus(`Shortest path: ${result.join(" → ")}`);
    } else {
      setPathStatus("No directed path found for the selected nodes.");
    }
  }

  function handleClearPath() {
    setPathResult([]);
    setPathStatus("");
    setPathFrom("");
    setPathTo("");
  }

  function handleFindLca() {
    if (selectedComponent?.type !== "tree") {
      setLcaStatus("LCA is available only for non-cyclic tree components.");
      return;
    }

    if (!lcaFrom || !lcaTo) {
      setLcaStatus("Choose both nodes to compute the LCA.");
      return;
    }

    const ancestor = findLowestCommonAncestor(selectedComponent.lineage, lcaFrom, lcaTo);

    if (!ancestor) {
      setLcaStatus("No shared ancestor found in the selected component.");
      return;
    }

    setLcaStatus(`Lowest common ancestor: ${ancestor} (${lcaFrom}, ${lcaTo})`);
  }

  function handleDownloadMermaid() {
    if (!analytics?.accepted_edges?.length) {
      return;
    }

    const mermaidSource = buildMermaidGraph(analytics.accepted_edges);
    const blob = new Blob([mermaidSource], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hierarchy-intelligence.mmd";
    link.click();
    URL.revokeObjectURL(url);
  }

  function registerSvgRef(root, element) {
    if (!root) {
      return;
    }
    treeSvgRefs.current[root] = element;
  }

  function handleDownloadSelectedPng() {
    if (!selectedRoot || !treeSvgRefs.current[selectedRoot]) {
      return;
    }

    serializeSvgToPng(treeSvgRefs.current[selectedRoot], `${selectedRoot}-${viewMode}.png`);
  }

  const responseIdentity = formatIdentityDisplay(response?.user_id || USER_PROFILE.user_id);
  const profileIdentity = formatIdentityDisplay(USER_PROFILE.user_id);

  const summaryCards = response
    ? [
        { label: "UID", value: responseIdentity.displayName, caption: responseIdentity.numericSuffix ? `ID · ${responseIdentity.numericSuffix}` : "Identity", accent: "accent" },
        { label: "Trees", value: response.summary.total_trees, caption: "Non-cyclic", accent: "green" },
        { label: "Cycles", value: response.summary.total_cycles, caption: "Cyclic groups", accent: "red" },
        { label: "Deepest", value: response.summary.largest_tree_root ?? "N/A", caption: "Largest root", accent: "cyan" },
      ]
    : [
        { label: "UID", value: profileIdentity.displayName, caption: profileIdentity.numericSuffix ? `ID · ${profileIdentity.numericSuffix}` : "Identity", accent: "accent" },
        { label: "Trees", value: "—", caption: "Non-cyclic", accent: "green" },
        { label: "Cycles", value: "—", caption: "Cyclic groups", accent: "red" },
        { label: "Deepest", value: "—", caption: "Largest root", accent: "cyan" },
      ];

  const displayedInvalid = response ? response.invalid_entries : liveAnalysis.invalidEntries;
  const displayedDuplicates = response ? response.duplicate_edges : liveAnalysis.duplicateEdges;

  function buildHighlightStateForRoot(root) {
    const nodes = new Set();
    const edges = new Set();

    if (selectedRoot === root) {
      playbackNodes.forEach((node) => nodes.add(node));
    }

    if (searchContext?.root === root) {
      searchContext.nodes.forEach((node) => nodes.add(node));
      searchContext.edges.forEach((edge) => edges.add(edge));
    }

    const component = componentByRoot[root];
    const pathWithinComponent =
      pathResult.length > 0 &&
      component?.nodes &&
      pathResult.every((node) => component.nodes.includes(node));

    if (pathWithinComponent) {
      pathNodes.forEach((node) => nodes.add(node));
      pathEdges.forEach((edge) => edges.add(edge));
    }

    return { nodes, edges };
  }

  return (
    <main className="dashboard-shell">
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      <button type="button" className="mobile-menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
        {sidebarOpen ? "✕" : "☰"}
      </button>
      <div className={`sidebar-overlay ${sidebarOpen ? "active" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div>
          <div className="brand-mark">
            <div className="brand-icon">BF</div>
            <div className="brand-info">
              <div className="brand-text">Bajaj Finance</div>
              <div className="brand-subtitle">Hierarchy Engine</div>
            </div>
          </div>
          <nav className="nav-list">
            {[
              { key: "dashboard", label: "Dashboard", targetId: "dashboard-section" },
              { key: "validation", label: "Validation", targetId: "validation-section" },
              { key: "deployment", label: "Deployment", targetId: "deployment-section" },
            ].map((item) => (
              <button key={item.key} type="button" className={`nav-item ${activeNav === item.key ? "active" : ""}`}
                onClick={() => handleNavClick(item)}>
                <span className="nav-label"><span className="nav-dot" />{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-stack" id="deployment-section">
          <div className="sidebar-note">
            <span className="sidebar-label">API</span>
            <p className="sidebar-value break-text" style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem" }}>{API_ENDPOINT_DISPLAY}</p>
          </div>
          <div className="sidebar-note">
            <span className="sidebar-label">Frontend</span>
            <p className="sidebar-value break-text" style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem" }}>{FRONTEND_URL}</p>
          </div>
          <div className="sidebar-note">
            <span className="sidebar-label">GitHub</span>
            <a className="sidebar-link" href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">{GITHUB_REPO_URL}</a>
          </div>
          <div className="sidebar-note profile-note">
            <span className="sidebar-label">Profile</span>
            <p className="sidebar-value" style={{ marginTop: "0.2rem" }}>{profileIdentity.displayName}</p>
            <span className="sidebar-caption">{USER_PROFILE.email_id}</span>
            <span className="sidebar-caption">{USER_PROFILE.college_roll_number}</span>
          </div>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <section className="dashboard-main">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-url">
            <span className="url-method">POST</span>
            <span>{API_ENDPOINT_DISPLAY}</span>
          </div>
          <div className="topbar-right">
            <div className="topbar-status">
              <span className="status-dot" />
              {isLoading ? "Processing" : "Ready"}
            </div>
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </div>
        </header>

        {/* Hero */}
        <section className="hero-strip" id="dashboard-section">
          <div className="hero-grid-bg" />
          <div style={{ position: "relative", zIndex: 1 }}>
            <p className="eyebrow">SRM Full Stack Challenge</p>
            <h1>Hierarchy Intelligence</h1>
          </div>
          <div className="hero-stats" style={{ position: "relative", zIndex: 1 }}>
            <div className="mini-stat">
              <span className="mini-label">Lines</span>
              <strong>{totalParsedLines}</strong>
            </div>
            <div className="mini-stat">
              <span className="mini-label">O(V+E)</span>
              <strong>{complexity.total || 0}</strong>
            </div>
            <div className="mini-stat">
              <span className="mini-label">Status</span>
              <strong style={{ fontSize: "0.85rem", color: isLoading ? "var(--yellow)" : "var(--green)" }}>
                {isLoading ? "RUN" : "IDLE"}
              </strong>
            </div>
          </div>
        </section>

        {/* Grid */}
        <section className="dashboard-grid">
          <div className="dashboard-left-column">

            {/* COMPOSE */}
            <article className="panel compose-panel">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">Input</p>
                  <h2>Edge Submission</h2>
                </div>
                <span className="panel-pill">
                  {totalParsedLines > 0
                    ? <span className="live-count-badge" key={totalParsedLines}>{totalParsedLines}</span>
                    : "0"}
                </span>
              </div>

              <form className="form-layout" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="edge-input">Edges — one per line, comma-separated, or drop a file</label>
                  <MemoSyntaxInput
                    value={input}
                    onChange={handleInputChange}
                    textareaRef={textareaRef}
                    onFileDrop={handleFileDrop}
                  />
                </div>

                {/* Inline metrics */}
                <div className="metrics-row">
                  <div className="m-cell">
                    <span>Valid</span>
                    <strong style={{ color: "var(--green)" }}>{liveAnalysis.validLookingCount}</strong>
                  </div>
                  <div className="m-cell">
                    <span>Invalid</span>
                    <strong style={{ color: liveAnalysis.invalidEntries.length > 0 ? "var(--red)" : "var(--text-muted)" }}>
                      {liveAnalysis.invalidEntries.length}
                    </strong>
                  </div>
                  <div className="m-cell">
                    <span>Dupes</span>
                    <strong style={{ color: displayedDuplicates.length > 0 ? "var(--orange)" : "var(--text-muted)" }}>
                      {displayedDuplicates.length}
                    </strong>
                  </div>
                  <div className="m-cell">
                    <span>V</span>
                    <strong>{complexity.V}</strong>
                  </div>
                  <div className="m-cell">
                    <span>E</span>
                    <strong>{complexity.E}</strong>
                  </div>
                </div>

                <div className="action-row">
                  <button type="submit" className="btn-primary" disabled={isLoading}>
                    {isLoading ? <span className="loading-btn"><span className="spin" /> Processing…</span> : "▶ Submit"}
                  </button>
                  <button type="button" className="ghost-button" onClick={handleClear}>Clear</button>
                  {requestTime && <span className="timing-badge">{requestTime}s</span>}
                </div>

                {isLoading && (
                  <div className="progress-bar-container">
                    <div className="progress-bar" />
                  </div>
                )}
              </form>

              <div className={`status-card ${error ? "error" : "success"}`}>
                <span className="status-icon">{error ? "✕" : "●"}</span>
                <div>
                  <p className="status-label">{error ? "Error" : "Status"}</p>
                  <p className="status-message">{error || status}</p>
                  {isLoading && <p className="cold-start-hint">First request may take 30–60s (Render free tier)</p>}
                </div>
              </div>
            </article>

            {/* VALIDATION  */}
            {!showHierarchyFallback && (
            <article className="panel detail-panel" id="validation-section">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">Validation</p>
                  <h2>Issues Detected</h2>
                </div>
              </div>
              <div className="detail-columns">
                <div className="detail-box">
                  <p className="detail-title">
                    ✕ Invalid{" "}
                    {displayedInvalid.length > 0 && (
                      <span className="count-chip count-red">{displayedInvalid.length}</span>
                    )}
                  </p>
                  {displayedInvalid.length > 0 ? (
                    <div className="token-list">
                      {displayedInvalid.map((entry, i) => (
                        <span className="token error-token" key={`${entry}-${i}`}>{entry}</span>
                      ))}
                    </div>
                  ) : <p className="empty-state">None</p>}
                </div>
                <div className="detail-box">
                  <p className="detail-title">
                    ⚠ Duplicates{" "}
                    {displayedDuplicates.length > 0 && (
                      <span className="count-chip count-orange">{displayedDuplicates.length}</span>
                    )}
                  </p>
                  {displayedDuplicates.length > 0 ? (
                    <div className="token-list">
                      {displayedDuplicates.map((entry, i) => (
                        <span className="token warning-token" key={`${entry}-${i}`}>{entry}</span>
                      ))}
                    </div>
                  ) : <p className="empty-state">None</p>}
                </div>
                <div className="detail-box">
                  <p className="detail-title">
                    ◎ Self-Loops{" "}
                    {selfLoopEntries.length > 0 && (
                      <span className="count-chip count-red">{selfLoopEntries.length}</span>
                    )}
                  </p>
                  {selfLoopEntries.length > 0 ? (
                    <div className="token-list">
                      {selfLoopEntries.map((entry, i) => (
                        <span className="token error-token" key={`${entry}-loop-${i}`}>{entry}</span>
                      ))}
                    </div>
                  ) : <p className="empty-state">None</p>}
                </div>
              </div>
            </article>
            )}
          </div>

          <div className="dashboard-right-column">

            {/* HIERARCHY */}
            <article className={`panel hierarchy-panel ${showHierarchyFallback ? "hierarchy-fallback-active" : ""}`}>
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">Trees</p>
                  <h2>Hierarchy View</h2>
                </div>
                <div style={{ display: "flex", gap: ".3rem", alignItems: "center", flexWrap: "wrap" }}>
                  {response && (
                    <>
                      <span className="tag-pill tag-green">
                        {response.summary.total_trees} tree{response.summary.total_trees !== 1 ? "s" : ""}
                      </span>
                      {response.summary.total_cycles > 0 && (
                        <span className="tag-pill tag-red">
                          {response.summary.total_cycles} cycle{response.summary.total_cycles !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="tag-pill tag-cyan">
                        {disconnectedComponents} component{disconnectedComponents !== 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {response && (
                <div className="insight-toolbar">
                  <div className="insight-row">
                    <div className="insight-field">
                      <label htmlFor="node-search">Search Node</label>
                      <input
                        id="node-search"
                        className="control-input"
                        value={searchNode}
                        onChange={(event) => setSearchNode(event.target.value.toUpperCase().slice(0, 1))}
                        placeholder="A"
                      />
                    </div>
                    <div className="insight-field">
                      <label htmlFor="selected-root">Debugger Root</label>
                      <select
                        id="selected-root"
                        className="control-select"
                        value={selectedRoot || ""}
                        onChange={(event) => setSelectedRoot(event.target.value)}
                      >
                        {renderableTrees.map((tree) => (
                          <option key={tree.root} value={tree.root}>{tree.root}</option>
                        ))}
                      </select>
                    </div>
                    <div className="insight-field insight-grow">
                      <label>View Mode</label>
                      <div className="mode-toggle">
                        {["vertical", "radial", "force"].map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            className={`mode-btn ${viewMode === mode ? "active" : ""}`}
                            onClick={() => setViewMode(mode)}
                          >
                            {mode === "vertical" ? "Tree" : mode === "radial" ? "Radial" : "Force"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="insight-row">
                    <div className="insight-field">
                      <label htmlFor="path-from">Path From</label>
                      <select
                        id="path-from"
                        className="control-select"
                        value={pathFrom}
                        onChange={(event) => setPathFrom(event.target.value)}
                      >
                        <option value="">Select</option>
                        {allGraphNodes.map((node) => (
                          <option key={`from-${node}`} value={node}>{node}</option>
                        ))}
                      </select>
                    </div>
                    <div className="insight-field">
                      <label htmlFor="path-to">Path To</label>
                      <select
                        id="path-to"
                        className="control-select"
                        value={pathTo}
                        onChange={(event) => setPathTo(event.target.value)}
                      >
                        <option value="">Select</option>
                        {allGraphNodes.map((node) => (
                          <option key={`to-${node}`} value={node}>{node}</option>
                        ))}
                      </select>
                    </div>
                    <div className="insight-field insight-grow">
                      <label>Playback</label>
                      <div className="mode-toggle">
                        <button
                          type="button"
                          className={`mode-btn ${traversalMode === "dfs" ? "active" : ""}`}
                          onClick={() => setTraversalMode("dfs")}
                        >
                          DFS
                        </button>
                        <button
                          type="button"
                          className={`mode-btn ${traversalMode === "bfs" ? "active" : ""}`}
                          onClick={() => setTraversalMode("bfs")}
                        >
                          BFS
                        </button>
                        <button type="button" className="mode-btn" onClick={handlePlaybackToggle} disabled={!playbackOrder.length}>
                          {playbackActive ? "Pause" : "Play"}
                        </button>
                        <button type="button" className="mode-btn" onClick={handlePlaybackReset} disabled={!playbackOrder.length}>
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="insight-row">
                    <div className="insight-field">
                      <label htmlFor="lca-from">LCA Node A</label>
                      <select
                        id="lca-from"
                        className="control-select"
                        value={lcaFrom}
                        onChange={(event) => setLcaFrom(event.target.value)}
                        disabled={selectedComponent?.type !== "tree"}
                      >
                        <option value="">Select</option>
                        {selectedTreeNodes.map((node) => (
                          <option key={`lca-from-${node}`} value={node}>{node}</option>
                        ))}
                      </select>
                    </div>
                    <div className="insight-field">
                      <label htmlFor="lca-to">LCA Node B</label>
                      <select
                        id="lca-to"
                        className="control-select"
                        value={lcaTo}
                        onChange={(event) => setLcaTo(event.target.value)}
                        disabled={selectedComponent?.type !== "tree"}
                      >
                        <option value="">Select</option>
                        {selectedTreeNodes.map((node) => (
                          <option key={`lca-to-${node}`} value={node}>{node}</option>
                        ))}
                      </select>
                    </div>
                    <div className="insight-field insight-grow">
                      <label>Analytics Actions</label>
                      <div className="toolbar-actions">
                        <button type="button" className="secondary-button" onClick={handleFindLca} disabled={selectedComponent?.type !== "tree"}>
                          Find LCA
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="analytics-strip">
                    <div className="analytics-box">
                      <p className="analytics-box-title">Selected Bottlenecks</p>
                      {selectedTopBottlenecks.length > 0 ? (
                        <div className="analytics-list">
                          {selectedTopBottlenecks.map((entry) => (
                            <div className="analytics-item" key={`selected-bottleneck-${selectedRoot}-${entry.node}`}>
                              <strong>{entry.node}</strong>
                              <span>B {formatMetric(entry.betweenness)}</span>
                              <span>C {formatMetric(entry.closeness)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="analytics-empty">No centrality data available.</p>
                      )}
                    </div>
                    <div className="analytics-box">
                      <p className="analytics-box-title">Global Bottlenecks</p>
                      {globalTopBottlenecks.length > 0 ? (
                        <div className="analytics-list">
                          {globalTopBottlenecks.map((entry) => (
                            <div className="analytics-item" key={`global-bottleneck-${entry.node}`}>
                              <strong>{entry.node}</strong>
                              <span>{entry.component_root || "—"}</span>
                              <span>B {formatMetric(entry.betweenness)}</span>
                              <span>C {formatMetric(entry.closeness)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="analytics-empty">No centrality data available.</p>
                      )}
                    </div>
                  </div>

                  <div className="insight-row insight-actions-row">
                    <div className="toolbar-actions">
                      <button type="button" className="secondary-button" onClick={handleFindPath} disabled={!response}>
                        Find Path
                      </button>
                      <button type="button" className="secondary-button" onClick={handleClearPath} disabled={!pathResult.length && !pathStatus}>
                        Clear Path
                      </button>
                      <button type="button" className="secondary-button" onClick={handleDownloadSelectedPng} disabled={!selectedRoot || !treeSvgRefs.current[selectedRoot]}>
                        Export PNG
                      </button>
                      <button type="button" className="secondary-button" onClick={handleDownloadMermaid} disabled={!analytics?.accepted_edges?.length}>
                        Export Mermaid
                      </button>
                    </div>
                    <div className="insight-feedback">
                      {pathStatus && <span className="path-status">{pathStatus}</span>}
                      {lcaStatus && <span className="path-status">{lcaStatus}</span>}
                      {searchContext?.root && (
                        <span className="path-status">
                          Lineage focus: {normalizedSearchNode} in root {searchContext.root}
                        </span>
                      )}
                      {selectedRoot && playbackOrder.length > 0 && (
                        <span className="path-status">
                          {traversalMode.toUpperCase()} playback {playbackStep >= 0 ? `${Math.min(playbackStep + 1, playbackOrder.length)}/${playbackOrder.length}` : `0/${playbackOrder.length}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="hierarchy-list">
                {isLoading ? (
                  <SkeletonPanel lines={6} wide />
                ) : showHierarchyFallback ? (
                  <div className="hierarchy-fallback-grid">
                    <section className="fallback-block">
                      <div className="panel-header fallback-header">
                        <div><p className="panel-kicker">Validation</p><h2>Issues</h2></div>
                      </div>
                      <div className="detail-columns">
                        <div className="detail-box">
                          <p className="detail-title">✕ Invalid{" "}
                            {displayedInvalid.length > 0 && <span className="count-chip count-red">{displayedInvalid.length}</span>}
                          </p>
                          {displayedInvalid.length > 0 ? (
                            <div className="token-list">{displayedInvalid.map((e, i) => <span className="token error-token" key={`${e}-${i}`}>{e}</span>)}</div>
                          ) : <p className="empty-state">None</p>}
                        </div>
                        <div className="detail-box">
                          <p className="detail-title">⚠ Duplicates{" "}
                            {displayedDuplicates.length > 0 && <span className="count-chip count-orange">{displayedDuplicates.length}</span>}
                          </p>
                          {displayedDuplicates.length > 0 ? (
                            <div className="token-list">{displayedDuplicates.map((e, i) => <span className="token warning-token" key={`${e}-${i}`}>{e}</span>)}</div>
                          ) : <p className="empty-state">None</p>}
                        </div>
                        <div className="detail-box">
                          <p className="detail-title">◎ Self-Loops{" "}
                            {selfLoopEntries.length > 0 && <span className="count-chip count-red">{selfLoopEntries.length}</span>}
                          </p>
                          {selfLoopEntries.length > 0 ? (
                            <div className="token-list">{selfLoopEntries.map((e, i) => <span className="token error-token" key={`${e}-fallback-${i}`}>{e}</span>)}</div>
                          ) : <p className="empty-state">None</p>}
                        </div>
                      </div>
                    </section>
                    <section className="fallback-block">
                      <div className="panel-header fallback-header">
                        <div><p className="panel-kicker">Summary</p><h2>Overview</h2></div>
                      </div>
                      <div className="bento-grid">
                        {summaryCards.map((card) => (
                          <div className={`bento-card bento-${card.accent}`} key={card.label}>
                            <p className="bento-label">{card.label}</p>
                            {card.label === "UID" ? (
                              <p className="bento-value bento-uid">{card.value}</p>
                            ) : (
                              <p className="bento-value">{card.value}</p>
                            )}
                            <p className="bento-caption">{card.caption}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                ) : (
                  response.hierarchies.map((h) => {
                    const highlightState = buildHighlightStateForRoot(h.root);
                    const isSelectedRoot = selectedRoot === h.root;
                    const childrenCount = Object.keys(h.tree || {}).length;
                    return (
                    <div
                      className={`hierarchy-card ${isSelectedRoot ? "selected-card" : ""}`}
                      key={h.root}
                      onClick={() => setSelectedRoot(h.root)}
                    >
                      <div className="hierarchy-topline">
                        <div>
                          <p className="hierarchy-title">Root: {h.root}</p>
                          <p className="hierarchy-subtitle">
                            {h.has_cycle
                              ? `Cycle detected${breakingLinks[h.root] ? ` · break ${breakingLinks[h.root]}` : ""}`
                              : `Depth: ${h.depth}`}
                          </p>
                        </div>
                        <span className={`badge ${h.has_cycle ? "cycle" : ""}`}>
                          {h.has_cycle ? "⟳ Cycle" : `${h.depth}`}
                        </span>
                      </div>
                      {isSelectedRoot ? (
                        <SVGTree
                          root={h.root}
                          subtree={h.tree}
                          hasCycle={h.has_cycle}
                          cyclePath={cyclePaths[h.root] || null}
                          breakingLink={breakingLinks[h.root] || null}
                          viewMode={viewMode}
                          playbackNodes={playbackNodes}
                          highlightNodes={highlightState.nodes}
                          highlightEdges={highlightState.edges}
                          registerSvgRef={registerSvgRef}
                        />
                      ) : (
                        <HierarchyPreviewCard
                          root={h.root}
                          depth={h.depth}
                          hasCycle={h.has_cycle}
                          breakingLink={breakingLinks[h.root] || null}
                          onSelect={() => setSelectedRoot(h.root)}
                          childrenCount={childrenCount}
                        />
                      )}
                    </div>
                  );
                  })
                )}
              </div>
            </article>

            <div className="dashboard-right-meta">
              {/* SUMMARY  */}
              {!showHierarchyFallback && (
              <article className="panel summary-panel">
                <div className="panel-header">
                  <div><p className="panel-kicker">Summary</p><h2>Overview</h2></div>
                </div>
                <div className="bento-grid">
                  {summaryCards.map((card) => (
                    <div className={`bento-card bento-${card.accent}`} key={card.label}>
                      <p className="bento-label">{card.label}</p>
                      {card.label === "UID" ? (
                        <p className="bento-value bento-uid">{card.value}</p>
                      ) : (
                        <p className="bento-value">{card.value}</p>
                      )}
                      <p className="bento-caption">{card.caption}</p>
                    </div>
                  ))}
                </div>
              </article>
              )}

              {/* JSON */}
              <article className="panel json-panel">
                <div className="panel-header">
                  <div><p className="panel-kicker">Payload</p><h2>JSON Response</h2></div>
                  <div className="json-header-actions">
                    <button type="button" className="secondary-button" onClick={handleCopyJson} disabled={!response}>Copy</button>
                    <button type="button" className="secondary-button" onClick={handleDownloadJson} disabled={!response}>↓ Download</button>
                    <button type="button" className="secondary-button" onClick={handleDownloadMermaid} disabled={!analytics?.accepted_edges?.length}>Mermaid</button>
                  </div>
                </div>
                {copyToast && <p className="copy-toast">✓ {copyToast}</p>}
                {isLoading ? (
                  <SkeletonPanel lines={8} wide />
                ) : (
                  <pre className="json-output" dangerouslySetInnerHTML={{
                    __html: jsonString
                      ? syntaxHighlightJson(JSON.stringify(response, null, 2))
                      : '<span style="color:var(--text-dim);font-style:italic">// Enter edges manually or drop a CSV/JSON file to see response.</span>',
                  }} />
                )}
              </article>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
