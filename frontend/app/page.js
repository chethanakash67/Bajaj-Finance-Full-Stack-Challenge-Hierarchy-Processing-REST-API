"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

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

const SAMPLE_DATA = `A->B
A->C
B->D
C->E
E->F
X->Y
Y->Z
Z->X
P->Q
Q->R
G->H
G->H
G->I
hello
1->2
A->`;

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

/* Extract exact cycle path from adjacency */
function extractCyclePath(edges) {
  const adj = new Map();
  const nodes = new Set();
  for (const e of edges) {
    const m = EDGE_PATTERN.exec(e.trim());
    if (!m || m[1] === m[2]) continue;
    nodes.add(m[1]);
    nodes.add(m[2]);
    if (!adj.has(m[1])) adj.set(m[1], []);
    adj.get(m[1]).push(m[2]);
  }
  const visited = new Set(), inStack = new Set(), path = [];
  let cyclePath = null;
  function dfs(node) {
    if (cyclePath) return;
    visited.add(node);
    inStack.add(node);
    path.push(node);
    for (const child of (adj.get(node) || [])) {
      if (cyclePath) return;
      if (inStack.has(child)) {
        const idx = path.indexOf(child);
        cyclePath = [...path.slice(idx), child];
        return;
      }
      if (!visited.has(child)) dfs(child);
    }
    path.pop();
    inStack.delete(node);
  }
  for (const n of [...nodes].sort()) {
    if (!visited.has(n) && !cyclePath) dfs(n);
  }
  return cyclePath;
}

/* ═══════════════════════════════════════════════════════════
   SVG TREE — Compact Layout
   ═══════════════════════════════════════════════════════════ */
const NODE_W = 32, NODE_H = 24, H_GAP = 8, V_GAP = 32;

function layoutTree(root, subtree) {
  const nodes = [], edges = [];
  let xCounter = 0;
  function computeLayout(name, sub, depth) {
    const children = Object.entries(sub);
    if (children.length === 0) {
      const x = xCounter * (NODE_W + H_GAP);
      xCounter++;
      const node = { name, x, y: depth * (NODE_H + V_GAP), depth, childCount: 0 };
      nodes.push(node);
      return node;
    }
    const childNodes = children.map(([cn, cs]) => computeLayout(cn, cs, depth + 1));
    const x = (Math.min(...childNodes.map(n => n.x)) + Math.max(...childNodes.map(n => n.x))) / 2;
    const node = { name, x, y: depth * (NODE_H + V_GAP), depth, childCount: childNodes.length };
    nodes.push(node);
    childNodes.forEach(child => edges.push({ from: node, to: child }));
    return node;
  }
  computeLayout(root, subtree, 0);
  return { nodes, edges };
}

function SVGTree({ root, subtree, hasCycle, cyclePath }) {
  const containerRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [inspectedNode, setInspectedNode] = useState(null);

  const layout = useMemo(() => {
    if (hasCycle) return { nodes: [], edges: [] };
    return layoutTree(root, subtree);
  }, [root, subtree, hasCycle]);

  // Auto-fit: compute scale to fit container
  useEffect(() => {
    setTransform({ x: 10, y: 10, scale: 1 });
    setInspectedNode(null);
  }, [root, subtree]);

  const PAD = 20;
  const maxX = layout.nodes.length > 0 ? Math.max(...layout.nodes.map(n => n.x)) + NODE_W + PAD : 160;
  const maxY = layout.nodes.length > 0 ? Math.max(...layout.nodes.map(n => n.y)) + NODE_H + PAD : 80;

  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.3, Math.min(3, prev.scale * delta))
    }));
  }

  function onMouseDown(e) {
    if (e.target.closest(".svg-node-group")) return;
    setDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  }

  function onMouseMove(e) {
    if (!dragging) return;
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }));
  }

  function onMouseUp() { setDragging(false); }

  function getPathFromRoot(nodeName) {
    const path = [];
    function search(name, sub, trail) {
      trail.push(name);
      if (name === nodeName) { path.push(...trail); return true; }
      for (const [child, childSub] of Object.entries(sub)) {
        if (search(child, childSub, trail)) return true;
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
              {cyclePath.map((node, i) => (
                <span key={`${node}-${i}`}>
                  <span className={`cycle-path-node ${i === cyclePath.length - 1 ? "cycle-end" : ""}`}>{node}</span>
                  {i < cyclePath.length - 1 && <span className="cycle-arrow">→</span>}
                </span>
              ))}
            </div>
          )}
          <p className="cycle-subtitle">Tree view disabled for this component</p>
        </div>
      </div>
    );
  }

  return (
    <div className="svg-tree-wrapper" ref={containerRef}>
      <svg
        className="svg-tree"
        viewBox={`0 0 ${maxX} ${maxY}`}
        preserveAspectRatio="xMidYMin meet"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: dragging ? "grabbing" : "grab", maxHeight: Math.min(280, maxY + 20) }}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {layout.edges.map((edge, i) => {
            const x1 = edge.from.x + NODE_W / 2;
            const y1 = edge.from.y + NODE_H;
            const x2 = edge.to.x + NODE_W / 2;
            const y2 = edge.to.y;
            const midY = (y1 + y2) / 2;
            return (
              <path
                key={`e-${i}`}
                d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                className="svg-edge"
                style={{ animationDelay: `${i * 0.05}s` }}
              />
            );
          })}
          {/* Nodes */}
          {layout.nodes.map((node, i) => (
            <g
              key={`n-${node.name}-${i}`}
              className="svg-node-group"
              transform={`translate(${node.x}, ${node.y})`}
              onClick={() => setInspectedNode(inspectedNode === node.name ? null : node.name)}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                rx="8"
                ry="8"
                className={`svg-node-rect ${inspectedNode === node.name ? "inspected" : ""} ${node.name === root ? "root-node" : ""}`}
              />
              <circle cx="8" cy={NODE_H / 2} r="2.5" className="svg-node-dot" />
              <text
                x={NODE_W / 2 + 2}
                y={NODE_H / 2 + 1}
                className="svg-node-label"
                dominantBaseline="middle"
                textAnchor="middle"
              >
                {node.name}
              </text>
            </g>
          ))}
        </g>
      </svg>
      {/* Inspect tooltip */}
      {inspectedNode && (
        <div className="node-tooltip">
          <div className="node-tooltip-header">
            <span className="node-tooltip-name">{inspectedNode}</span>
            <button className="node-tooltip-close" onClick={() => setInspectedNode(null)}>✕</button>
          </div>
          {(() => {
            const n = layout.nodes.find(nd => nd.name === inspectedNode);
            const pathFromRoot = getPathFromRoot(inspectedNode);
            return (
              <>
                <div className="node-tooltip-row"><span>Depth</span><strong>{n?.depth ?? 0}</strong></div>
                <div className="node-tooltip-row"><span>Children</span><strong>{n?.childCount ?? 0}</strong></div>
                <div className="node-tooltip-row"><span>Path</span><strong className="node-tooltip-path">{pathFromRoot.join(" → ")}</strong></div>
              </>
            );
          })()}
        </div>
      )}
      <div className="svg-tree-controls">
        <button type="button" onClick={() => setTransform(p => ({ ...p, scale: Math.min(3, p.scale * 1.2) }))}>+</button>
        <button type="button" onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.3, p.scale * 0.8) }))}>−</button>
        <button type="button" onClick={() => setTransform({ x: 20, y: 20, scale: 1 })}>⟲</button>
      </div>
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
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [treeMode, setTreeMode] = useState("dfs");
  const [requestTime, setRequestTime] = useState(null);
  const textareaRef = useRef(null);

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

  // Use a ref so handleSubmit always sees latest input without re-creating
  const inputRef = useRef(input);
  inputRef.current = input;
  const parsedRef = useRef(parsedLines);
  parsedRef.current = parsedLines;

  // Extract cycle paths for all cyclic components
  const cyclePaths = useMemo(() => {
    if (!response) return {};
    const paths = {};
    for (const h of response.hierarchies) {
      if (h.has_cycle) {
        const cp = extractCyclePath(parsedRef.current);
        if (cp) paths[h.root] = cp;
      }
    }
    return paths;
  }, [response]);

  // Complexity estimate
  const complexity = useMemo(() => {
    const { nodeCount, edgeCount } = liveAnalysis;
    return { V: nodeCount, E: edgeCount, total: nodeCount + edgeCount };
  }, [liveAnalysis]);

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

  function handleAutoFill() {
    setInput(SAMPLE_DATA); setResponse(null); setError(""); setCopyToast("");
    setStatus("Sample loaded. Submitting…");
    setAutoSubmit(true);
  }

  useEffect(() => {
    if (autoSubmit && input === SAMPLE_DATA) {
      setAutoSubmit(false);
      const t = setTimeout(() => handleSubmit(), 300);
      return () => clearTimeout(t);
    }
  }, [autoSubmit, input, handleSubmit]);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleSubmit(); }
      if (e.key === "Escape") { e.preventDefault(); handleClear(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSubmit]);

  function handleNavClick(item) {
    setActiveNav(item.key); setSidebarOpen(false);
    const el = document.getElementById(item.targetId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
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
                <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                  <button type="button" className="auto-fill-button" onClick={handleAutoFill}>⚡ Auto-Fill</button>
                  <span className="panel-pill">
                    {totalParsedLines > 0
                      ? <span className="live-count-badge" key={totalParsedLines}>{totalParsedLines}</span>
                      : "0"}
                  </span>
                </div>
              </div>

              <form className="form-layout" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="edge-input">Edges — one per line, comma-separated, or drop a file</label>
                  <SyntaxInput
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
                    </>
                  )}
                  {!showHierarchyFallback && (
                    <div className="mode-toggle">
                      <button
                        type="button"
                        className={`mode-btn ${treeMode === "dfs" ? "active" : ""}`}
                        onClick={() => setTreeMode("dfs")}
                      >DFS</button>
                      <button
                        type="button"
                        className={`mode-btn ${treeMode === "bfs" ? "active" : ""}`}
                        onClick={() => setTreeMode("bfs")}
                      >BFS</button>
                    </div>
                  )}
                </div>
              </div>

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
                  response.hierarchies.map((h) => (
                    <div className="hierarchy-card" key={h.root}>
                      <div className="hierarchy-topline">
                        <div>
                          <p className="hierarchy-title">Root: {h.root}</p>
                          <p className="hierarchy-subtitle">
                            {h.has_cycle ? "Cycle detected" : `Depth: ${h.depth}`}
                          </p>
                        </div>
                        <span className={`badge ${h.has_cycle ? "cycle" : ""}`}>
                          {h.has_cycle ? "⟳ Cycle" : `${h.depth}`}
                        </span>
                      </div>
                      <SVGTree
                        root={h.root}
                        subtree={h.tree}
                        hasCycle={h.has_cycle}
                        cyclePath={cyclePaths[h.root] || null}
                      />
                    </div>
                  ))
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
                  </div>
                </div>
                {copyToast && <p className="copy-toast">✓ {copyToast}</p>}
                {isLoading ? (
                  <SkeletonPanel lines={8} wide />
                ) : (
                  <pre className="json-output" dangerouslySetInnerHTML={{
                    __html: jsonString
                      ? syntaxHighlightJson(JSON.stringify(response, null, 2))
                      : '<span style="color:var(--text-dim);font-style:italic">// Click ⚡ Auto-Fill or enter edges to see response.</span>',
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
