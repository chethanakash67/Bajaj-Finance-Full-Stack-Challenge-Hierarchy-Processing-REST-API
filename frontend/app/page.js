"use client";

import { useState } from "react";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://bajaj-finance-full-stack-challenge.onrender.com";
const API_ENDPOINT_DISPLAY =
  process.env.NEXT_PUBLIC_API_ENDPOINT_DISPLAY || "https://bajaj-finance-full-stack-challenge.onrender.com/bfhl";
const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL || "https://bajaj-finance-full-stack-challenge.vercel.app/";
const GITHUB_REPO_URL =
  process.env.NEXT_PUBLIC_GITHUB_REPO_URL || "https://github.com/chethanakash67/Bajaj-Finance-Full-Stack-Challenge-Hierarchy-Processing-REST-API";
const INITIAL_STATUS = "Awaiting graph input. Enter edges below.";
const EDGE_PATTERN = /^([A-Z])\s*->\s*([A-Z])$/;
const USER_PROFILE = {
  user_id: "G CHETHAN AKASH",
  email_id: "ga0822@srmist.edu.in",
  college_roll_number: "RA2311028010059",
};

function formatDisplayName(name) {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const NAV_ITEMS = [
  { key: "dashboard",  label: "Dashboard",  targetId: "dashboard-section" },
  { key: "validation", label: "Validation", targetId: "validation-section" },
  { key: "deployment", label: "Deployment", targetId: "deployment-section" },
];

function parseEdges(rawText) {
  if (rawText.trim().length === 0) return [];
  return rawText.split(/\n|,/).map((item) => item.trim());
}

function analyzeInput(entries) {
  const invalidEntries = [];
  const duplicateEdges = [];
  const seenEdges = new Set();
  const duplicateSeen = new Set();
  let validLookingCount = 0;

  for (const entry of entries) {
    if (entry.length === 0) { invalidEntries.push("(empty line)"); continue; }
    const match = EDGE_PATTERN.exec(entry);
    if (!match || match[1] === match[2]) { invalidEntries.push(entry); continue; }
    validLookingCount += 1;
    if (seenEdges.has(entry) && !duplicateSeen.has(entry)) {
      duplicateSeen.add(entry);
      duplicateEdges.push(entry);
      continue;
    }
    seenEdges.add(entry);
  }

  return { invalidEntries, duplicateEdges, validLookingCount };
}

function syntaxHighlightJson(json) {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = "json-number";
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? "json-key" : "json-string";
        } else if (/true|false/.test(match)) {
          cls = "json-bool";
        } else if (/null/.test(match)) {
          cls = "json-null";
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
}

function TreeDiagramNode({ nodeName, subtree }) {
  const children = Object.entries(subtree);
  return (
    <div className={`tree-diagram-node ${children.length > 0 ? "has-children" : ""}`}>
      <div className="tree-badge">
        <span className="tree-dot" />
        <span className="tree-label">{nodeName}</span>
      </div>
      {children.length > 0 && (
        <div className="tree-diagram-children">
          {children.map(([childName, childTree]) => (
            <div className="tree-diagram-child" key={childName}>
              <TreeDiagramNode nodeName={childName} subtree={childTree} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [error, setError] = useState("");
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copyToast, setCopyToast] = useState("");
  const [activeNav, setActiveNav] = useState("dashboard");

  const parsedLines    = parseEdges(input);
  const liveAnalysis   = analyzeInput(parsedLines);
  const totalParsedLines = parsedLines.length;
  const jsonString     = response ? JSON.stringify(response, null, 2) : null;
  const renderableTrees = response ? response.hierarchies.filter((h) => !h.has_cycle) : [];
  const hasRenderableTrees = renderableTrees.length > 0;
  const showHierarchyFallback = !response || !hasRenderableTrees;

  async function handleSubmit(event) {
    event.preventDefault();
    if (totalParsedLines === 0 || (totalParsedLines === 1 && parsedLines[0] === "")) {
      setError("400 · Please enter at least one edge before submitting.");
      setStatus("No request sent.");
      setResponse(null);
      return;
    }
    setIsLoading(true);
    setError("");
    setCopyToast("");
    setStatus("Dispatching request to API...");
    try {
      const apiResponse = await fetch(`${API_BASE_URL}/bfhl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: parsedLines }),
      });
      const payload = await apiResponse.json();
      if (!apiResponse.ok) {
        throw new Error(`${apiResponse.status} · ${payload.message || "API request failed."}`);
      }
      setResponse(payload);
      setStatus("Response received successfully.");
    } catch (submitError) {
      setError(
        submitError.message === "Failed to fetch"
          ? `Network error · Could not reach ${API_ENDPOINT_DISPLAY}. Ensure the backend is running.`
          : submitError.message
      );
      setStatus("Unable to reach the backend API.");
      setResponse(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopyJson() {
    if (!jsonString) return;
    await navigator.clipboard.writeText(jsonString);
    setCopyToast("Payload copied to clipboard ✓");
    window.setTimeout(() => setCopyToast(""), 2000);
  }

  function handleClear() {
    setInput("");
    setResponse(null);
    setError("");
    setCopyToast("");
    setStatus(INITIAL_STATUS);
  }

  function handleNavClick(item) {
    setActiveNav(item.key);
    const el = document.getElementById(item.targetId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const summaryCards = response
    ? [
        ["UID",     formatDisplayName(response.user_id.replace(/_/g, " ")), "Identity tag"],
        ["Trees",   response.summary.total_trees,                           "Valid non-cyclic"],
        ["Cycles",  response.summary.total_cycles,                          "Cyclic groups"],
        ["Largest", response.summary.largest_tree_root ?? "N/A",            "Greatest depth root"],
      ]
    : [
        ["UID",     formatDisplayName(USER_PROFILE.user_id), "Identity tag"],
        ["Trees",   "—", "Valid non-cyclic"],
        ["Cycles",  "—", "Cyclic groups"],
        ["Largest", "—", "Greatest depth root"],
      ];

  const displayedInvalid    = response ? response.invalid_entries    : liveAnalysis.invalidEntries;
  const displayedDuplicates = response ? response.duplicate_edges     : liveAnalysis.duplicateEdges;

  return (
    <main className="dashboard-shell">
      {/* ── SIDEBAR ─────────────────────────── */}
      <aside className="sidebar">
        <div>
          <div className="brand-mark">
            <span className="brand-text">BF</span>
          </div>
          <nav className="nav-list" style={{ marginTop: "1.25rem" }}>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`nav-item ${activeNav === item.key ? "active" : ""}`}
                onClick={() => handleNavClick(item)}
              >
                <span className="nav-label">
                  <span className="nav-dot" />
                  {item.label}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-stack" id="deployment-section">
          <div className="sidebar-note">
            <span className="sidebar-label">API Endpoint</span>
            <p className="sidebar-value break-text" style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
              {API_ENDPOINT_DISPLAY}
            </p>
          </div>
          <div className="sidebar-note">
            <span className="sidebar-label">Frontend</span>
            <p className="sidebar-value break-text" style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
              {FRONTEND_URL}
            </p>
          </div>
          <div className="sidebar-note">
            <span className="sidebar-label">GitHub</span>
            <a className="sidebar-link" href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
              {GITHUB_REPO_URL}
            </a>
          </div>
          <div className="sidebar-note profile-note">
            <span className="sidebar-label">Profile</span>
            <p className="sidebar-value" style={{ marginTop: "0.35rem" }}>{USER_PROFILE.user_id}</p>
            <span className="sidebar-caption">{USER_PROFILE.email_id}</span>
            <span className="sidebar-caption">{USER_PROFILE.college_roll_number}</span>
          </div>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────── */}
      <section className="dashboard-main">

        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-url">
            <span className="url-method">POST</span>
            <span>{API_ENDPOINT_DISPLAY}</span>
          </div>
          <div className="topbar-status">
            <span className="status-dot" />
            Evaluator Ready
          </div>
        </header>

        {/* Hero */}
        <section className="hero-strip" id="dashboard-section">
          <div className="hero-grid-bg" />
          <div style={{ position: "relative", zIndex: 1 }}>
            <p className="eyebrow">SRM Full Stack Engineering Challenge</p>
            <h1>Hierarchy<br />Intelligence</h1>
            <p className="hero-copy">
              Submit graph edges, preview validation in real-time, inspect
              cycle-safe hierarchy trees, and copy the exact API payload for evaluation.
            </p>
          </div>
          <div className="hero-stats" style={{ position: "relative", zIndex: 1 }}>
            <div className="mini-stat">
              <span className="mini-label">Parsed Lines</span>
              <strong>{totalParsedLines}</strong>
            </div>
            <div className="mini-stat">
              <span className="mini-label">Engine Status</span>
              <strong style={{ fontSize: "1.2rem", color: isLoading ? "var(--yellow)" : "var(--green)" }}>
                {isLoading ? "RUNNING" : "IDLE"}
              </strong>
            </div>
          </div>
        </section>

        {/* Grid */}
        <section className="dashboard-grid">

          {/* ── COMPOSE ─────────────────────── */}
          <article className="panel compose-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Input Console</p>
                <h2>Edge Submission</h2>
              </div>
              <span className="panel-pill">Manual Input Only</span>
            </div>

            <form className="form-layout" onSubmit={handleSubmit}>
              <div className="field-grid">
                <div className="helper-box helper-box-wide">
                  <p className="helper-title">Manual Detection</p>
                  <p className="helper-text">
                    Enter your own edges only. The app will automatically detect valid trees,
                    cyclic groups, invalid entries, and duplicate edges from what you type.
                  </p>
                </div>
                <div className="helper-box">
                  <p className="helper-title">Depth Rule</p>
                  <p className="helper-text">
                    Depth = node count on the longest root-to-leaf path.
                    <br />e.g. A→B→C = 3
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="edge-input">Edges — one per line or comma-separated</label>
                <textarea
                  id="edge-input"
                  rows={12}
                  spellCheck="false"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={"A->B\nA->C\nB->D"}
                  style={{ minHeight: "260px" }}
                />
              </div>

              <div className="preview-grid">
                <div className="metric-chip">
                  <span>Total Lines</span>
                  <strong>{totalParsedLines}</strong>
                </div>
                <div className="metric-chip">
                  <span>Valid-looking</span>
                  <strong style={{ color: "var(--green)" }}>{liveAnalysis.validLookingCount}</strong>
                </div>
                <div className="metric-chip">
                  <span>Invalid</span>
                  <strong style={{ color: liveAnalysis.invalidEntries.length > 0 ? "var(--red)" : "var(--cyan)" }}>
                    {liveAnalysis.invalidEntries.length}
                  </strong>
                </div>
              </div>

              <div className="action-row">
                <button type="submit" className="btn-primary" disabled={isLoading}>
                  {isLoading ? (
                    <span className="loading-btn"><span className="spin" /> Processing…</span>
                  ) : (
                    "▶ Submit to API"
                  )}
                </button>
                <button type="button" className="ghost-button" onClick={handleClear}>
                  Clear
                </button>
              </div>
            </form>

            <div className={`status-card ${error ? "error" : "success"}`}>
              <span className="status-icon">{error ? "✕" : "●"}</span>
              <div>
                <p className="status-label">{error ? "API Error" : "System Status"}</p>
                <p className="status-message">{error || status}</p>
              </div>
            </div>

            <div className="chip-grid" style={{ marginTop: "0.9rem" }}>
              <div className="metric-chip">
                <span>Invalid Entries</span>
                <strong style={{ color: displayedInvalid.length > 0 ? "var(--red)" : "var(--cyan)" }}>
                  {displayedInvalid.length}
                </strong>
              </div>
              <div className="metric-chip">
                <span>Duplicate Edges</span>
                <strong style={{ color: displayedDuplicates.length > 0 ? "var(--orange)" : "var(--cyan)" }}>
                  {displayedDuplicates.length}
                </strong>
              </div>
              <div className="metric-chip">
                <span>Cycle Guard</span>
                <strong style={{ color: "var(--green)", fontSize: "0.9rem" }}>ACTIVE</strong>
              </div>
            </div>
          </article>

          {/* ── SUMMARY ─────────────────────── */}
          {!showHierarchyFallback && (
          <article className="panel summary-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">At a Glance</p>
                <h2>Summary Board</h2>
              </div>
            </div>
            <div className="summary-cards">
              {summaryCards.map(([label, value, caption]) => (
                <div className="summary-card" key={label}>
                  <p className="summary-title">{label}</p>
                  <p className={`value ${String(value).length > 12 ? "compact" : ""}`}>{value}</p>
                  <p className="summary-caption">{caption}</p>
                </div>
              ))}
            </div>
            <div className="notes-list">
              <p className="note-line">
                <strong>Invalid entries</strong> — anything outside single-uppercase{" "}
                <code>X-&gt;Y</code>, including self-loops.
              </p>
              <p className="note-line">
                <strong>Duplicate edges</strong> — only repeated exact edges, listed once.
              </p>
              <p className="note-line">
                <strong>Cyclic groups</strong> — any cycle returns <code>tree: {"{}"}</code> with{" "}
                <code>has_cycle: true</code>.
              </p>
            </div>
          </article>
          )}

          {/* ── VALIDATION ──────────────────── */}
          {!showHierarchyFallback && (
          <article className="panel detail-panel" id="validation-section">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Validation Feed</p>
                <h2>Issues Detected</h2>
              </div>
            </div>

            <div className="detail-columns">
              <div className="detail-box">
                <p className="detail-title">
                  ✕ Invalid Entries{" "}
                  {displayedInvalid.length > 0 && (
                    <span style={{
                      marginLeft: "0.5rem",
                      background: "var(--red-soft)",
                      color: "var(--red)",
                      padding: "0.1rem 0.4rem",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      fontFamily: "var(--font-mono)",
                    }}>{displayedInvalid.length}</span>
                  )}
                </p>
                <p className="detail-explainer">
                  Trimmed before validation. Empty lines, malformed arrows, and self-loops land here.
                </p>
                {displayedInvalid.length > 0 ? (
                  <div className="token-list">
                    {displayedInvalid.map((entry, i) => (
                      <span className="token error-token" key={`${entry}-${i}`}>{entry}</span>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">No invalid entries detected.</p>
                )}
              </div>

              <div className="detail-box">
                <p className="detail-title">
                  ⚠ Duplicate Edges{" "}
                  {displayedDuplicates.length > 0 && (
                    <span style={{
                      marginLeft: "0.5rem",
                      background: "var(--orange-soft)",
                      color: "var(--orange)",
                      padding: "0.1rem 0.4rem",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      fontFamily: "var(--font-mono)",
                    }}>{displayedDuplicates.length}</span>
                  )}
                </p>
                <p className="detail-explainer">
                  Only repeated exact edges are listed — even if an edge appears many times.
                </p>
                {displayedDuplicates.length > 0 ? (
                  <div className="token-list">
                    {displayedDuplicates.map((entry, i) => (
                      <span className="token warning-token" key={`${entry}-${i}`}>{entry}</span>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">No duplicate edges detected.</p>
                )}
              </div>
            </div>
          </article>
          )}

          {/* ── HIERARCHY ───────────────────── */}
          <article className={`panel hierarchy-panel ${showHierarchyFallback ? "hierarchy-fallback-active" : ""}`} id="validation-section">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Structured Insights</p>
                <h2>Hierarchy Trees</h2>
              </div>
              {response && (
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{
                    background: "var(--green-soft)",
                    color: "var(--green)",
                    border: "1px solid rgba(0,255,136,0.2)",
                    borderRadius: "8px",
                    padding: "0.4rem 0.75rem",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.78rem",
                  }}>
                    {response.summary.total_trees} tree{response.summary.total_trees !== 1 ? "s" : ""}
                  </span>
                  {response.summary.total_cycles > 0 && (
                    <span style={{
                      background: "var(--red-soft)",
                      color: "var(--red)",
                      border: "1px solid rgba(255,58,92,0.2)",
                      borderRadius: "8px",
                      padding: "0.4rem 0.75rem",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.78rem",
                    }}>
                      {response.summary.total_cycles} cycle{response.summary.total_cycles !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="hierarchy-list">
              {showHierarchyFallback ? (
                <div className="hierarchy-fallback-grid">
                  <section className="fallback-block">
                    <div className="panel-header fallback-header">
                      <div>
                        <p className="panel-kicker">At a Glance</p>
                        <h2>Summary Board</h2>
                      </div>
                    </div>
                    <div className="summary-cards">
                      {summaryCards.map(([label, value, caption]) => (
                        <div className="summary-card" key={label}>
                          <p className="summary-title">{label}</p>
                          <p className={`value ${String(value).length > 12 ? "compact" : ""}`}>{value}</p>
                          <p className="summary-caption">{caption}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="fallback-block">
                    <div className="panel-header fallback-header">
                      <div>
                        <p className="panel-kicker">Validation Feed</p>
                        <h2>Issues Detected</h2>
                      </div>
                    </div>
                    <div className="detail-columns">
                      <div className="detail-box">
                        <p className="detail-title">
                          ✕ Invalid Entries{" "}
                          {displayedInvalid.length > 0 && (
                            <span style={{
                              marginLeft: "0.5rem",
                              background: "var(--red-soft)",
                              color: "var(--red)",
                              padding: "0.1rem 0.4rem",
                              borderRadius: "6px",
                              fontSize: "0.72rem",
                              fontFamily: "var(--font-mono)",
                            }}>{displayedInvalid.length}</span>
                          )}
                        </p>
                        <p className="detail-explainer">
                          Trimmed before validation. Empty lines, malformed arrows, and self-loops land here.
                        </p>
                        {displayedInvalid.length > 0 ? (
                          <div className="token-list">
                            {displayedInvalid.map((entry, i) => (
                              <span className="token error-token" key={`${entry}-${i}`}>{entry}</span>
                            ))}
                          </div>
                        ) : (
                          <p className="empty-state">No invalid entries detected.</p>
                        )}
                      </div>

                      <div className="detail-box">
                        <p className="detail-title">
                          ⚠ Duplicate Edges{" "}
                          {displayedDuplicates.length > 0 && (
                            <span style={{
                              marginLeft: "0.5rem",
                              background: "var(--orange-soft)",
                              color: "var(--orange)",
                              padding: "0.1rem 0.4rem",
                              borderRadius: "6px",
                              fontSize: "0.72rem",
                              fontFamily: "var(--font-mono)",
                            }}>{displayedDuplicates.length}</span>
                          )}
                        </p>
                        <p className="detail-explainer">
                          Only repeated exact edges are listed — even if an edge appears many times.
                        </p>
                        {displayedDuplicates.length > 0 ? (
                          <div className="token-list">
                            {displayedDuplicates.map((entry, i) => (
                              <span className="token warning-token" key={`${entry}-${i}`}>{entry}</span>
                            ))}
                          </div>
                        ) : (
                          <p className="empty-state">No duplicate edges detected.</p>
                        )}
                      </div>
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
                          {h.has_cycle
                            ? "This component contains a cycle."
                            : `Longest path: ${h.depth} node${h.depth !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                      <span className={`badge ${h.has_cycle ? "cycle" : ""}`}>
                        {h.has_cycle ? "⟳ Cycle" : `Depth ${h.depth}`}
                      </span>
                    </div>
                    {h.has_cycle ? (
                      <div className="cycle-card">
                        Tree preview disabled — cyclic component detected.
                      </div>
                    ) : (
                      <div className="tree-view">
                        <div className="tree-canvas">
                          <TreeDiagramNode nodeName={h.root} subtree={h.tree} />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </article>

          {/* ── JSON ────────────────────────── */}
          <article className="panel json-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Raw Payload</p>
                <h2>JSON Response</h2>
              </div>
              <div className="json-header-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCopyJson}
                  disabled={!response}
                >
                  Copy JSON
                </button>
              </div>
            </div>
            {copyToast && <p className="copy-toast">✓ {copyToast}</p>}
            <pre
              className="json-output"
              dangerouslySetInnerHTML={{
                __html: jsonString
                  ? syntaxHighlightJson(JSON.stringify(response, null, 2))
                  : '<span style="color:var(--muted);font-style:italic">// Waiting for API response…\n// Submit edges above to see the full JSON payload.</span>',
              }}
            />
          </article>

        </section>
      </section>
    </main>
  );
}
