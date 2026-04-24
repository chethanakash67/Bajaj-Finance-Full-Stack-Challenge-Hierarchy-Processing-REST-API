"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
  for (const entry of entries) {
    if (entry.length === 0) { invalidEntries.push("(empty)"); continue; }
    const match = EDGE_PATTERN.exec(entry);
    if (!match || match[1] === match[2]) { invalidEntries.push(entry); continue; }
    validLookingCount += 1;
    if (seenEdges.has(entry) && !duplicateSeen.has(entry)) {
      duplicateSeen.add(entry); duplicateEdges.push(entry); continue;
    }
    seenEdges.add(entry);
  }
  return { invalidEntries, duplicateEdges, validLookingCount };
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

function TreeDiagramNode({ nodeName, subtree, depth = 0 }) {
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
              <TreeDiagramNode nodeName={childName} subtree={childTree} depth={depth + 1} />
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const textareaRef = useRef(null);

  const parsedLines = parseEdges(input);
  const liveAnalysis = analyzeInput(parsedLines);
  const totalParsedLines = parsedLines.length;
  const jsonString = response ? JSON.stringify(response, null, 2) : null;
  const renderableTrees = response ? response.hierarchies.filter((h) => !h.has_cycle) : [];
  const hasRenderableTrees = renderableTrees.length > 0;
  const showHierarchyFallback = !response || !hasRenderableTrees;

  const handleSubmit = useCallback(async (event) => {
    if (event) event.preventDefault();
    if (totalParsedLines === 0 || (totalParsedLines === 1 && parsedLines[0] === "")) {
      setError("Please enter at least one edge.");
      setStatus("No request sent.");
      setResponse(null);
      return;
    }
    setIsLoading(true); setError(""); setCopyToast("");
    setStatus("Dispatching...");
    try {
      const apiResponse = await fetch(`${API_BASE_URL}/bfhl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: parsedLines }),
      });
      const payload = await apiResponse.json();
      if (!apiResponse.ok) throw new Error(`${apiResponse.status} · ${payload.message || "Failed"}`);
      setResponse(payload);
      setStatus("Response received.");
    } catch (submitError) {
      setError(submitError.message === "Failed to fetch"
        ? `Network error · Could not reach API.`
        : submitError.message);
      setStatus("API unreachable.");
      setResponse(null);
    } finally { setIsLoading(false); }
  }, [totalParsedLines, parsedLines]);

  async function handleCopyJson() {
    if (!jsonString) return;
    await navigator.clipboard.writeText(jsonString);
    setCopyToast("Copied ✓");
    window.setTimeout(() => setCopyToast(""), 2000);
  }

  function handleClear() {
    setInput(""); setResponse(null); setError(""); setCopyToast("");
    setStatus(INITIAL_STATUS);
    if (textareaRef.current) textareaRef.current.focus();
  }

  function handleInputChange(event) {
    setInput(event.target.value); setResponse(null); setError(""); setCopyToast("");
    setStatus("Input updated.");
  }

  function handleAutoFill() {
    setInput(SAMPLE_DATA); setResponse(null); setError(""); setCopyToast("");
    setStatus("Sample loaded. Submitting...");
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
        ["UID", responseIdentity.displayName, responseIdentity.numericSuffix ? `ID · ${responseIdentity.numericSuffix}` : "Identity"],
        ["Trees", response.summary.total_trees, "Non-cyclic"],
        ["Cycles", response.summary.total_cycles, "Cyclic groups"],
        ["Largest", response.summary.largest_tree_root ?? "N/A", "Deepest root"],
      ]
    : [
        ["UID", profileIdentity.displayName, profileIdentity.numericSuffix ? `ID · ${profileIdentity.numericSuffix}` : "Identity"],
        ["Trees", "—", "Non-cyclic"],
        ["Cycles", "—", "Cyclic groups"],
        ["Largest", "—", "Deepest root"],
      ];

  const displayedInvalid = response ? response.invalid_entries : liveAnalysis.invalidEntries;
  const displayedDuplicates = response ? response.duplicate_edges : liveAnalysis.duplicateEdges;

  function renderSummaryCard(label, value, caption) {
    const isId = label === "UID";
    return (
      <div className={`summary-card ${isId ? "identity-card" : ""}`} key={label}>
        <p className="summary-title">{label}</p>
        {isId ? (
          <div className="identity-value"><span className="identity-name">{value}</span></div>
        ) : (
          <p className={`value ${String(value).length > 12 ? "compact" : ""}`}>{value}</p>
        )}
        <p className="summary-caption">{caption}</p>
      </div>
    );
  }

  return (
    <main className="dashboard-shell">
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      <button type="button" className="mobile-menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
        {sidebarOpen ? "✕" : "☰"}
      </button>
      <div className={`sidebar-overlay ${sidebarOpen ? "active" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* SIDEBAR */}
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

      {/* MAIN */}
      <section className="dashboard-main">
        <header className="topbar">
          <div className="topbar-url">
            <span className="url-method">POST</span>
            <span>{API_ENDPOINT_DISPLAY}</span>
          </div>
          <div className="topbar-status">
            <span className="status-dot" />
            {isLoading ? "Processing" : "Ready"}
          </div>
        </header>

        {/* Hero — compact */}
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
              <span className="mini-label">Status</span>
              <strong style={{ fontSize: "0.95rem", color: isLoading ? "var(--yellow)" : "var(--green)" }}>
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
                  <label htmlFor="edge-input">Edges — one per line or comma-separated</label>
                  <textarea id="edge-input" ref={textareaRef} rows={10} spellCheck="false" value={input}
                    onChange={handleInputChange} placeholder={"A->B\nA->C\nB->D"} />
                </div>

                {/* Inline metrics — no gaps */}
                <div className="metrics-row">
                  <div className="m-cell">
                    <span>Valid</span>
                    <strong style={{ color: "var(--green)" }}>{liveAnalysis.validLookingCount}</strong>
                  </div>
                  <div className="m-cell">
                    <span>Invalid</span>
                    <strong style={{ color: liveAnalysis.invalidEntries.length > 0 ? "var(--red)" : "var(--cyan)" }}>
                      {liveAnalysis.invalidEntries.length}
                    </strong>
                  </div>
                  <div className="m-cell">
                    <span>Dupes</span>
                    <strong style={{ color: displayedDuplicates.length > 0 ? "var(--orange)" : "var(--cyan)" }}>
                      {displayedDuplicates.length}
                    </strong>
                  </div>
                </div>

                <div className="action-row">
                  <button type="submit" className="btn-primary" disabled={isLoading}>
                    {isLoading ? <span className="loading-btn"><span className="spin" /> Processing…</span> : "▶ Submit"}
                  </button>
                  <button type="button" className="ghost-button" onClick={handleClear}>Clear</button>
                </div>

                {isLoading && <div className="progress-bar-container"><div className="progress-bar" /></div>}
              </form>

              <div className={`status-card ${error ? "error" : "success"}`}>
                <span className="status-icon">{error ? "✕" : "●"}</span>
                <div>
                  <p className="status-label">{error ? "Error" : "Status"}</p>
                  <p className="status-message">{error || status}</p>
                </div>
              </div>
            </article>

            {/* VALIDATION — only when response */}
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
                      <span style={{ marginLeft: ".4rem", background: "var(--red-soft)", color: "var(--red)",
                        padding: ".1rem .35rem", borderRadius: "5px", fontSize: ".6rem", fontFamily: "var(--font-mono)" }}>
                        {displayedInvalid.length}
                      </span>
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
                      <span style={{ marginLeft: ".4rem", background: "var(--orange-soft)", color: "var(--orange)",
                        padding: ".1rem .35rem", borderRadius: "5px", fontSize: ".6rem", fontFamily: "var(--font-mono)" }}>
                        {displayedDuplicates.length}
                      </span>
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
                {response && (
                  <div style={{ display: "flex", gap: ".3rem", flexWrap: "wrap" }}>
                    <span style={{ background: "var(--green-soft)", color: "var(--green)", border: "1px solid rgba(0,245,160,.12)",
                      borderRadius: "6px", padding: ".2rem .5rem", fontFamily: "var(--font-mono)", fontSize: ".65rem", fontWeight: "600" }}>
                      {response.summary.total_trees} tree{response.summary.total_trees !== 1 ? "s" : ""}
                    </span>
                    {response.summary.total_cycles > 0 && (
                      <span style={{ background: "var(--red-soft)", color: "var(--red)", border: "1px solid rgba(255,107,107,.12)",
                        borderRadius: "6px", padding: ".2rem .5rem", fontFamily: "var(--font-mono)", fontSize: ".65rem", fontWeight: "600" }}>
                        {response.summary.total_cycles} cycle{response.summary.total_cycles !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="hierarchy-list">
                {showHierarchyFallback ? (
                  <div className="hierarchy-fallback-grid">
                    {/* Inline validation + summary when no trees */}
                    <section className="fallback-block">
                      <div className="panel-header fallback-header">
                        <div><p className="panel-kicker">Validation</p><h2>Issues</h2></div>
                      </div>
                      <div className="detail-columns">
                        <div className="detail-box">
                          <p className="detail-title">✕ Invalid{" "}
                            {displayedInvalid.length > 0 && <span style={{ marginLeft: ".3rem", background: "var(--red-soft)",
                              color: "var(--red)", padding: ".1rem .3rem", borderRadius: "4px", fontSize: ".58rem",
                              fontFamily: "var(--font-mono)" }}>{displayedInvalid.length}</span>}
                          </p>
                          {displayedInvalid.length > 0 ? (
                            <div className="token-list">{displayedInvalid.map((e, i) => <span className="token error-token" key={`${e}-${i}`}>{e}</span>)}</div>
                          ) : <p className="empty-state">None</p>}
                        </div>
                        <div className="detail-box">
                          <p className="detail-title">⚠ Duplicates{" "}
                            {displayedDuplicates.length > 0 && <span style={{ marginLeft: ".3rem", background: "var(--orange-soft)",
                              color: "var(--orange)", padding: ".1rem .3rem", borderRadius: "4px", fontSize: ".58rem",
                              fontFamily: "var(--font-mono)" }}>{displayedDuplicates.length}</span>}
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
                      <div className="summary-cards">
                        {summaryCards.map(([l, v, c]) => renderSummaryCard(l, v, c))}
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
                      {h.has_cycle ? (
                        <div className="cycle-card">Cyclic component — tree disabled.</div>
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

            <div className="dashboard-right-meta">
              {/* SUMMARY — only when response */}
              {!showHierarchyFallback && (
              <article className="panel summary-panel">
                <div className="panel-header">
                  <div><p className="panel-kicker">Summary</p><h2>Overview</h2></div>
                </div>
                <div className="summary-cards">
                  {summaryCards.map(([l, v, c]) => renderSummaryCard(l, v, c))}
                </div>
              </article>
              )}

              {/* JSON */}
              <article className="panel json-panel">
                <div className="panel-header">
                  <div><p className="panel-kicker">Payload</p><h2>JSON Response</h2></div>
                  <div className="json-header-actions">
                    <button type="button" className="secondary-button" onClick={handleCopyJson} disabled={!response}>Copy</button>
                  </div>
                </div>
                {copyToast && <p className="copy-toast">✓ {copyToast}</p>}
                <pre className="json-output" dangerouslySetInnerHTML={{
                  __html: jsonString
                    ? syntaxHighlightJson(JSON.stringify(response, null, 2))
                    : '<span style="color:var(--text-dim);font-style:italic">// Click ⚡ Auto-Fill or enter edges to see response.</span>',
                }} />
              </article>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
