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
  user_id: "G CHETHAN AKASH",
  email_id: "ga0822@srmist.edu.in",
  college_roll_number: "RA2311028010059",
};

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

function formatDisplayName(name) {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function TreeDiagramNode({ nodeName, subtree }) {
  const children = Object.entries(subtree);

  return (
    <div className={`branch-node ${children.length > 0 ? "has-children" : ""}`}>
      <div className="branch-badge">
        <span className="branch-core" />
        <span className="branch-label">{nodeName}</span>
      </div>
      {children.length > 0 ? (
        <div className="branch-children">
          {children.map(([childName, childTree]) => (
            <div className="branch-child" key={childName}>
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

  const parsedLines = parseEdges(input);
  const liveAnalysis = analyzeInput(parsedLines);
  const totalParsedLines = parsedLines.length;
  const jsonBlock = response ? formatJson(response) : "Waiting for a response...";

  async function handleSubmit(event) {
    event.preventDefault();

    if (totalParsedLines === 0) {
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
      setStatus("Analysis complete.");
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

  const summaryCards = response
    ? [
        ["Identity", formatDisplayName(response.user_id.replace(/_/g, " ")), "Submission owner"],
        ["Trees", response.summary.total_trees, "Valid non-cyclic groups"],
        ["Cycles", response.summary.total_cycles, "Cyclic components"],
        ["Largest Root", response.summary.largest_tree_root ?? "N/A", "Greatest depth root"],
      ]
    : [
        ["Identity", formatDisplayName(USER_PROFILE.user_id), "Submission owner"],
        ["Trees", 0, "Valid non-cyclic groups"],
        ["Cycles", 0, "Cyclic components"],
        ["Largest Root", "N/A", "Greatest depth root"],
      ];

  const displayedInvalidEntries = response ? response.invalid_entries : liveAnalysis.invalidEntries;
  const displayedDuplicateEdges = response ? response.duplicate_edges : liveAnalysis.duplicateEdges;

  return (
    <main className="studio-shell">
      <section className="studio-hero">
        <div className="hero-copy-block">
          <p className="eyebrow">SRM Full Stack Engineering Challenge</p>
          <h1>Graph Atlas</h1>
          <p className="hero-text">
            A bright, editorial-style graph workspace for validating edge inputs, mapping hierarchies,
            isolating cyclic components, and reviewing the exact API response before submission.
          </p>
        </div>

        <div className="hero-panel">
          <div className="hero-kpis">
            <div className="hero-kpi">
              <span>Parsed Lines</span>
              <strong>{totalParsedLines}</strong>
            </div>
            <div className="hero-kpi">
              <span>Status</span>
              <strong>{isLoading ? "Running" : "Idle"}</strong>
            </div>
          </div>
          <div className="hero-links">
            <span className="hero-link-tag">API {API_BASE_URL}</span>
            <span className="hero-link-tag">Web {FRONTEND_URL}</span>
          </div>
        </div>
      </section>

      <section className="layout-grid">
        <article className="paper-card composer-card">
          <div className="section-head">
            <div>
              <p className="section-kicker">Compose</p>
              <h2>Edge Studio</h2>
            </div>
            <span className="sample-tag">{selectedSample}</span>
          </div>

          <form className="composer-form" onSubmit={handleSubmit}>
            <div className="control-strip">
              <label className="field-block">
                <span>Hidden Test Samples</span>
                <select
                  className="studio-select"
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
              </label>

              <div className="explain-box">
                <p className="explain-title">Validation Preview</p>
                <p className="explain-copy">
                  Spacing like <code>A -&gt; B</code> is normalized. Self-loops and malformed entries stay invalid.
                </p>
              </div>
            </div>

            <label className="field-block">
              <span>Enter one edge per line or comma-separated values</span>
              <textarea
                className="studio-input"
                rows={12}
                spellCheck="false"
                value={input}
                onChange={(event) => {
                  setSelectedSample("Custom");
                  setInput(event.target.value);
                }}
                placeholder="A->B&#10;A->C&#10;B->D"
              />
            </label>

            <div className="preview-band">
              <div className="preview-pill">
                <span>Lines</span>
                <strong>{totalParsedLines}</strong>
              </div>
              <div className="preview-pill">
                <span>Valid-looking</span>
                <strong>{liveAnalysis.validLookingCount}</strong>
              </div>
              <div className="preview-pill">
                <span>Invalid-looking</span>
                <strong>{liveAnalysis.invalidEntries.length}</strong>
              </div>
            </div>

            <div className="action-band">
              <button type="submit" className="primary-cta" disabled={isLoading}>
                {isLoading ? "Processing..." : "Analyze Graph"}
              </button>
              <button
                type="button"
                className="secondary-cta"
                onClick={() => handleSampleChange({ target: { value: DEFAULT_SAMPLE_NAME } })}
              >
                Load Official Sample
              </button>
              <button type="button" className="ghost-cta" onClick={handleClear}>
                Clear Canvas
              </button>
            </div>
          </form>

          <div className={`message-strip ${error ? "error" : "ok"}`}>
            <p className="message-title">{error ? "API Error" : "System Status"}</p>
            <p className="message-body">{error || status}</p>
          </div>
        </article>

        <article className="paper-card summary-card-block">
          <div className="section-head">
            <div>
              <p className="section-kicker">Overview</p>
              <h2>Result Snapshot</h2>
            </div>
          </div>

          <div className="mosaic-grid">
            {summaryCards.map(([label, value, caption]) => (
              <div className="mosaic-card" key={label}>
                <p className="mosaic-label">{label}</p>
                <p className={`mosaic-value ${String(value).length > 14 ? "small" : ""}`}>{value}</p>
                <p className="mosaic-caption">{caption}</p>
              </div>
            ))}
          </div>

          <div className="rule-notes">
            <p><strong>Invalid entries:</strong> anything outside single-uppercase <code>X-&gt;Y</code>, including self-loops.</p>
            <p><strong>Duplicate edges:</strong> only repeated exact edges are listed, once.</p>
            <p><strong>Cyclic components:</strong> any component with a loop returns <code>tree: {}</code> and <code>has_cycle: true</code>.</p>
          </div>
        </article>

        <article className="paper-card ledger-card">
          <div className="section-head">
            <div>
              <p className="section-kicker">Signals</p>
              <h2>Validation Ledger</h2>
            </div>
          </div>

          <div className="ledger-grid">
            <div className="ledger-box">
              <p className="ledger-title">Invalid Entries</p>
              <p className="ledger-help">Trimmed before validation. Empty rows, malformed arrows, and self-loops show here.</p>
              <div className="token-row">
                {displayedInvalidEntries.length > 0 ? (
                  displayedInvalidEntries.map((entry, index) => (
                    <span className="token-chip token-red" key={`${entry}-${index}`}>
                      {entry}
                    </span>
                  ))
                ) : (
                  <span className="empty-line">No invalid entries detected.</span>
                )}
              </div>
            </div>

            <div className="ledger-box">
              <p className="ledger-title">Duplicate Edges</p>
              <p className="ledger-help">Only repeated exact edges appear here, even if the same edge repeats many times.</p>
              <div className="token-row">
                {displayedDuplicateEdges.length > 0 ? (
                  displayedDuplicateEdges.map((entry, index) => (
                    <span className="token-chip token-amber" key={`${entry}-${index}`}>
                      {entry}
                    </span>
                  ))
                ) : (
                  <span className="empty-line">No duplicate edges detected.</span>
                )}
              </div>
            </div>
          </div>
        </article>

        <article className="paper-card hierarchy-stage">
          <div className="section-head">
            <div>
              <p className="section-kicker">Structures</p>
              <h2>Hierarchy Gallery</h2>
            </div>
          </div>

          <div className="gallery-stack">
            {response ? (
              response.hierarchies.map((hierarchy) => (
                <div className="hierarchy-sheet" key={hierarchy.root}>
                  <div className="hierarchy-header">
                    <div>
                      <p className="hierarchy-root">Root {hierarchy.root}</p>
                      <p className="hierarchy-meta">
                        {hierarchy.has_cycle
                          ? "Cyclic component"
                          : `Depth ${hierarchy.depth} • longest root-to-leaf path`}
                      </p>
                    </div>
                    <span className={`status-chip ${hierarchy.has_cycle ? "cycle" : "tree"}`}>
                      {hierarchy.has_cycle ? "Cycle detected" : `Depth ${hierarchy.depth}`}
                    </span>
                  </div>

                  {hierarchy.has_cycle ? (
                    <div className="cycle-banner">
                      Tree rendering is intentionally disabled because this connected component contains a cycle.
                    </div>
                  ) : (
                    <div className="tree-stage">
                      <div className="tree-wrap">
                        <TreeDiagramNode nodeName={hierarchy.root} subtree={hierarchy.tree} />
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-gallery">
                Submit a payload to render hierarchy sheets for each connected component.
              </div>
            )}
          </div>
        </article>

        <article className="paper-card identity-card">
          <div className="section-head">
            <div>
              <p className="section-kicker">Submission</p>
              <h2>Identity & Links</h2>
            </div>
          </div>

          <div className="identity-grid">
            <div className="identity-box">
              <span>Name</span>
              <strong>{formatDisplayName(USER_PROFILE.user_id)}</strong>
            </div>
            <div className="identity-box">
              <span>Email</span>
              <strong>{USER_PROFILE.email_id}</strong>
            </div>
            <div className="identity-box">
              <span>Roll Number</span>
              <strong>{USER_PROFILE.college_roll_number}</strong>
            </div>
            <div className="identity-box">
              <span>Hosted API</span>
              <strong>{API_BASE_URL}</strong>
            </div>
            <div className="identity-box">
              <span>Hosted Frontend</span>
              <strong>{FRONTEND_URL}</strong>
            </div>
            <div className="identity-box">
              <span>GitHub Repo</span>
              <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
                {GITHUB_REPO_URL}
              </a>
            </div>
          </div>
        </article>

        <article className="paper-card json-card">
          <div className="section-head">
            <div>
              <p className="section-kicker">Receipt</p>
              <h2>Raw JSON</h2>
            </div>
            <button
              type="button"
              className="secondary-cta"
              onClick={handleCopyJson}
              disabled={!response}
            >
              Copy JSON
            </button>
          </div>
          {copyToast ? <p className="copy-note">{copyToast}</p> : null}
          <pre className="json-panel">{jsonBlock}</pre>
        </article>
      </section>
    </main>
  );
}
