"use client";

import { useState } from "react";

const SAMPLE_SETS = {
  "Official Sample": `A->B
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
A->`,
  "Invalid Entries": `hello
1->2
AB->C
A-B
A->
A->A`,
  "Duplicate Edges": `A->B
A->B
A->B
B->C`,
  "Self Loop": `A->A
A->B`,
  "Pure Cycle": `X->Y
Y->Z
Z->X`,
  "Multi Parent": `A->D
B->D
D->E`,
  "Tie Breaker": `A->B
C->D`,
  "Empty Input": ``,
};

const DEFAULT_SAMPLE_NAME = "Official Sample";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL || "https://your-vercel-app.vercel.app";
const GITHUB_REPO_URL =
  process.env.NEXT_PUBLIC_GITHUB_REPO_URL || "https://github.com/your-username/your-repo";
const INITIAL_STATUS = "Ready to analyze your graph.";
const EDGE_PATTERN = /^([A-Z])\s*->\s*([A-Z])$/;
const USER_PROFILE = {
  user_id: "yourname_ddmmyyyy",
  email_id: "yourmail@college.edu",
  college_roll_number: "YOUR_ROLL_NUMBER",
};
const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", targetId: "dashboard-section" },
  { key: "hidden-tests", label: "Hidden Tests", targetId: "hidden-tests-section" },
  { key: "validation", label: "Validation", targetId: "validation-section" },
  { key: "deployment", label: "Deployment", targetId: "deployment-section" },
];

function parseEdges(rawText) {
  if (rawText.trim().length === 0) {
    return [];
  }

  return rawText.split(/\n|,/).map((item) => item.trim());
}

function analyzeInput(entries) {
  const invalidEntries = [];
  const duplicateEdges = [];
  const seenEdges = new Set();
  const duplicateSeen = new Set();
  let validLookingCount = 0;

  for (const entry of entries) {
    if (entry.length === 0) {
      invalidEntries.push("(empty line)");
      continue;
    }

    const match = EDGE_PATTERN.exec(entry);

    if (!match || match[1] === match[2]) {
      invalidEntries.push(entry);
      continue;
    }

    validLookingCount += 1;

    if (seenEdges.has(entry) && !duplicateSeen.has(entry)) {
      duplicateSeen.add(entry);
      duplicateEdges.push(entry);
      continue;
    }

    seenEdges.add(entry);
  }

  return {
    invalidEntries,
    duplicateEdges,
    validLookingCount,
  };
}

function formatJson(response) {
  return JSON.stringify(response, null, 2);
}

function TreeDiagramNode({ nodeName, subtree }) {
  const children = Object.entries(subtree);

  return (
    <div className={`tree-diagram-node ${children.length > 0 ? "has-children" : ""}`}>
      <div className="tree-badge">
        <span className="tree-dot" />
        <span className="tree-label">{nodeName}</span>
      </div>
      {children.length > 0 ? (
        <div className="tree-diagram-children">
          {children.map(([childName, childTree]) => (
            <div className="tree-diagram-child" key={childName}>
              <TreeDiagramNode nodeName={childName} subtree={childTree} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function HomePage() {
  const [selectedSample, setSelectedSample] = useState(DEFAULT_SAMPLE_NAME);
  const [input, setInput] = useState(SAMPLE_SETS[DEFAULT_SAMPLE_NAME]);
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [error, setError] = useState("");
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copyToast, setCopyToast] = useState("");
  const [activeNav, setActiveNav] = useState("dashboard");

  const parsedLines = parseEdges(input);
  const liveAnalysis = analyzeInput(parsedLines);
  const totalParsedLines = parsedLines.length;
  const jsonBlock = response ? formatJson(response) : "Waiting for a response...";

  async function handleSubmit(event) {
    event.preventDefault();

    if (totalParsedLines === 0 || (totalParsedLines === 1 && parsedLines[0] === "")) {
      setError("400: Please enter at least one edge before submitting.");
      setStatus("No request sent.");
      setResponse(null);
      return;
    }

    setIsLoading(true);
    setError("");
    setCopyToast("");
    setStatus("Processing request...");

    try {
      const apiResponse = await fetch(`${API_BASE_URL}/bfhl`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: parsedLines,
        }),
      });

      const payload = await apiResponse.json();

      if (!apiResponse.ok) {
        throw new Error(`${apiResponse.status}: ${payload.message || "API request failed."}`);
      }

      setResponse(payload);
      setStatus("Response received successfully.");
    } catch (submitError) {
      setError(
        submitError.message === "Failed to fetch"
          ? `Network error: Could not reach ${API_BASE_URL}. Make sure the backend server is running.`
          : submitError.message
      );
      setStatus("Unable to reach the backend API.");
      setResponse(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopyJson() {
    if (!response) {
      return;
    }

    await navigator.clipboard.writeText(jsonBlock);
    setCopyToast("JSON copied to clipboard.");
    window.setTimeout(() => setCopyToast(""), 1800);
  }

  function handleSampleChange(event) {
    const nextSample = event.target.value;
    setSelectedSample(nextSample);
    setInput(SAMPLE_SETS[nextSample] ?? input);
    setResponse(null);
    setError("");
    setCopyToast("");
    setStatus(`${nextSample} loaded.`);
  }

  function handleClear() {
    setInput("");
    setSelectedSample("Custom");
    setResponse(null);
    setError("");
    setCopyToast("");
    setStatus(INITIAL_STATUS);
  }

  function handleNavClick(item) {
    setActiveNav(item.key);
    const element = document.getElementById(item.targetId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const summaryCards = response
    ? [
        ["UID", response.user_id, "Identity tag"],
        ["Trees", response.summary.total_trees, "Valid non-cyclic groups"],
        ["Cycles", response.summary.total_cycles, "Cyclic components"],
        ["Largest", response.summary.largest_tree_root ?? "N/A", "Greatest depth root"],
      ]
    : [
        ["UID", USER_PROFILE.user_id, "Identity tag"],
        ["Trees", 0, "Valid non-cyclic groups"],
        ["Cycles", 0, "Cyclic components"],
        ["Largest", "N/A", "Greatest depth root"],
      ];

  const displayedInvalidEntries = response ? response.invalid_entries : liveAnalysis.invalidEntries;
  const displayedDuplicateEdges = response ? response.duplicate_edges : liveAnalysis.duplicateEdges;

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-mark">BF</div>
          <nav className="nav-list">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`nav-item ${activeNav === item.key ? "active" : ""}`}
                onClick={() => handleNavClick(item)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-stack" id="deployment-section">
          <div className="sidebar-note">
            <p className="sidebar-label">Hosted API URL</p>
            <p className="sidebar-value break-text">{API_BASE_URL}</p>
            <p className="sidebar-caption">POST /bfhl</p>
          </div>
          <div className="sidebar-note">
            <p className="sidebar-label">Hosted Frontend URL</p>
            <p className="sidebar-value break-text">{FRONTEND_URL}</p>
          </div>
          <div className="sidebar-note">
            <p className="sidebar-label">GitHub Repo</p>
            <a className="sidebar-link break-text" href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
              {GITHUB_REPO_URL}
            </a>
          </div>
          <div className="sidebar-note profile-note">
            <p className="sidebar-label">User Profile</p>
            <p className="sidebar-value">{USER_PROFILE.user_id}</p>
            <p className="sidebar-caption">{USER_PROFILE.email_id}</p>
            <p className="sidebar-caption">{USER_PROFILE.college_roll_number}</p>
          </div>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="topbar">
          <div className="topbar-search">
            <span className="search-icon">o</span>
            <span>{API_BASE_URL}</span>
          </div>
          <div className="topbar-badge">Evaluator Ready</div>
        </header>

        <section className="hero-strip" id="dashboard-section">
          <div>
            <p className="eyebrow">SRM Full Stack Engineering Challenge</p>
            <h1>Hierarchy Intelligence Dashboard</h1>
            <p className="hero-copy">
              Submit graph edges, preview validation before the request, inspect cycle-safe hierarchy cards,
              and copy the exact API payload used for evaluation.
            </p>
          </div>
          <div className="hero-stats">
            <div className="mini-stat">
              <span className="mini-label">Parsed Lines</span>
              <strong>{totalParsedLines}</strong>
            </div>
            <div className="mini-stat">
              <span className="mini-label">Status</span>
              <strong>{isLoading ? "Running" : "Idle"}</strong>
            </div>
          </div>
        </section>

        <section className="dashboard-grid">
          <article className="panel compose-panel" id="hidden-tests-section">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Input Console</p>
                <h2>Edge Submission</h2>
              </div>
              <span className="panel-pill">{selectedSample}</span>
            </div>

            <form className="form-layout" onSubmit={handleSubmit}>
              <div className="field-grid">
                <div>
                  <label htmlFor="hidden-sample-select">Hidden Test Samples</label>
                  <select
                    id="hidden-sample-select"
                    className="dashboard-select"
                    value={selectedSample}
                    onChange={handleSampleChange}
                  >
                    {Object.keys(SAMPLE_SETS).map((sampleName) => (
                      <option key={sampleName} value={sampleName}>
                        {sampleName}
                      </option>
                    ))}
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div className="helper-box">
                  <p className="helper-title">Depth Rule</p>
                  <p className="helper-text">Depth equals the number of nodes in the longest root-to-leaf path.</p>
                </div>
              </div>

              <label htmlFor="edge-input">Enter one edge per line or comma-separated values</label>
              <textarea
                id="edge-input"
                rows={12}
                spellCheck="false"
                value={input}
                onChange={(event) => {
                  setSelectedSample("Custom");
                  setInput(event.target.value);
                }}
                placeholder="A->B&#10;A->C&#10;B->D"
              />

              <div className="preview-grid">
                <div className="metric-chip">
                  <span>Total parsed lines</span>
                  <strong>{totalParsedLines}</strong>
                </div>
                <div className="metric-chip">
                  <span>Valid-looking entries</span>
                  <strong>{liveAnalysis.validLookingCount}</strong>
                </div>
                <div className="metric-chip">
                  <span>Invalid-looking entries</span>
                  <strong>{liveAnalysis.invalidEntries.length}</strong>
                </div>
              </div>

              <div className="action-row">
                <button type="submit" disabled={isLoading}>
                  {isLoading ? "Processing..." : "Submit to API"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleSampleChange({ target: { value: DEFAULT_SAMPLE_NAME } })}
                >
                  Load Official Sample
                </button>
                <button type="button" className="ghost-button" onClick={handleClear}>
                  Clear
                </button>
              </div>
            </form>

            <div className={`status-card ${error ? "error" : "success"}`}>
              <p className="status-label">{error ? "API Error" : "System Status"}</p>
              <p className="status-message">{error || status}</p>
            </div>

            <div className="chip-grid">
              <div className="metric-chip">
                <span>Invalid Entries</span>
                <strong>{displayedInvalidEntries.length}</strong>
              </div>
              <div className="metric-chip">
                <span>Duplicate Edges</span>
                <strong>{displayedDuplicateEdges.length}</strong>
              </div>
              <div className="metric-chip">
                <span>Cycle-safe API</span>
                <strong>Enabled</strong>
              </div>
            </div>
          </article>

          <article className="panel summary-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">At A Glance</p>
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
              <p className="note-line"><strong>Invalid entries:</strong> anything outside single-uppercase <code>X-&gt;Y</code>, including self-loops.</p>
              <p className="note-line"><strong>Duplicate edges:</strong> only repeated exact edges, listed once.</p>
              <p className="note-line"><strong>Cyclic components:</strong> any component with a cycle returns <code>tree: {}</code> and <code>has_cycle: true</code>.</p>
            </div>
          </article>

          <article className="panel detail-panel" id="validation-section">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Validation Feed</p>
                <h2>Invalid and Duplicate Entries</h2>
              </div>
            </div>

            <div className="detail-columns">
              <div className="detail-box">
                <p className="detail-title">Invalid</p>
                <p className="detail-explainer">Trimmed before validation. Empty lines, malformed arrows, and self-loops land here.</p>
                {displayedInvalidEntries.length > 0 ? (
                  <div className="token-list">
                    {displayedInvalidEntries.map((entry, index) => (
                      <span className="token error-token" key={`${entry}-${index}`}>
                        {entry}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">No invalid entries detected.</p>
                )}
              </div>
              <div className="detail-box">
                <p className="detail-title">Duplicates</p>
                <p className="detail-explainer">Only repeated exact edges are listed, even if the edge appears many times.</p>
                {displayedDuplicateEdges.length > 0 ? (
                  <div className="token-list">
                    {displayedDuplicateEdges.map((entry, index) => (
                      <span className="token warning-token" key={`${entry}-${index}`}>
                        {entry}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">No duplicate edges detected.</p>
                )}
              </div>
            </div>
          </article>

          <article className="panel hierarchy-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Structured Insights</p>
                <h2>Hierarchy Trees</h2>
              </div>
            </div>
            <div className="hierarchy-list">
              {response ? (
                response.hierarchies.map((hierarchy) => (
                  <div className="hierarchy-card" key={hierarchy.root}>
                    <div className="hierarchy-topline">
                      <div>
                        <p className="detail-title">Root {hierarchy.root}</p>
                        <p className="hierarchy-subtitle">
                          {hierarchy.has_cycle
                            ? "This connected component is cyclic."
                            : `Longest root-to-leaf path: ${hierarchy.depth}`}
                        </p>
                      </div>
                      <span className={`badge ${hierarchy.has_cycle ? "cycle" : ""}`}>
                        {hierarchy.has_cycle ? "Cycle detected" : `Depth ${hierarchy.depth}`}
                      </span>
                    </div>
                    {hierarchy.has_cycle ? (
                      <div className="cycle-card">
                        <p>Tree preview is disabled because this component contains a cycle.</p>
                      </div>
                    ) : (
                      <div className="tree-view">
                        <div className="tree-canvas">
                          <TreeDiagramNode nodeName={hierarchy.root} subtree={hierarchy.tree} />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="empty-state">Submit a payload to render hierarchy cards for each connected component.</p>
              )}
            </div>
          </article>

          <article className="panel json-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Raw Payload</p>
                <h2>Formatted JSON</h2>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={handleCopyJson}
                disabled={!response}
              >
                Copy JSON
              </button>
            </div>
            {copyToast ? <p className="copy-toast">{copyToast}</p> : null}
            <pre className="json-output">{jsonBlock}</pre>
          </article>
        </section>
      </section>
    </main>
  );
}
