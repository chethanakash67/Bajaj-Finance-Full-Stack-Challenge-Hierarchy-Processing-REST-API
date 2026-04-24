"use client";

import { useState } from "react";

const SAMPLE_TEXT = `A->B
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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

function parseEdges(rawText) {
  return rawText
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function TreeNode({ nodeName, subtree }) {
  const children = Object.entries(subtree);

  return (
    <li>
      <span>{nodeName}</span>
      {children.length > 0 ? (
        <ul>
          {children.map(([childName, childTree]) => (
            <TreeNode key={childName} nodeName={childName} subtree={childTree} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function HomePage() {
  const [input, setInput] = useState(SAMPLE_TEXT);
  const [status, setStatus] = useState("Ready to submit.");
  const [error, setError] = useState("");
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setStatus("Submitting request to backend...");

    try {
      const apiResponse = await fetch(`${API_BASE_URL}/bfhl`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: parseEdges(input),
        }),
      });

      const payload = await apiResponse.json();

      if (!apiResponse.ok) {
        throw new Error(payload.message || "API request failed.");
      }

      setResponse(payload);
      setStatus("Response received successfully.");
    } catch (submitError) {
      setError(submitError.message);
      setStatus("Unable to reach the backend API.");
      setResponse(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">SRM Full Stack Engineering Challenge</p>
        <h1>Hierarchy Builder</h1>
        <p className="hero-copy">
          Separate Next.js frontend for Vercel and Express backend for Render.
          Paste node edges, submit them to <code>POST /bfhl</code>, and inspect
          trees, cycles, invalid entries, and duplicates.
        </p>
      </section>

      <section className="panel">
        <form className="form-layout" onSubmit={handleSubmit}>
          <label htmlFor="edge-input">Enter one edge per line or comma-separated values</label>
          <textarea
            id="edge-input"
            rows={10}
            spellCheck="false"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Submitting..." : "Submit to API"}
          </button>
        </form>
        <p className={`status ${error ? "error" : "success"}`}>{error || status}</p>
      </section>

      <section className="results-grid">
        <article className="panel">
          <div className="panel-heading">
            <h2>Summary</h2>
          </div>
          <div className="summary-cards">
            {response ? (
              [
                ["User ID", response.user_id],
                ["Total Trees", response.summary.total_trees],
                ["Total Cycles", response.summary.total_cycles],
                ["Largest Tree Root", response.summary.largest_tree_root ?? "None"],
                ["Invalid Entries", response.invalid_entries.length],
                ["Duplicate Edges", response.duplicate_edges.length],
              ].map(([label, value]) => (
                <div className="summary-card" key={label}>
                  <p>{label}</p>
                  <p className="value">{value}</p>
                </div>
              ))
            ) : (
              <p className="empty-state">Submit data to see the computed summary.</p>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Hierarchies</h2>
          </div>
          <div className="hierarchy-list">
            {response ? (
              response.hierarchies.map((hierarchy) => (
                <div className="hierarchy-card" key={hierarchy.root}>
                  <p>
                    <strong>Root:</strong> {hierarchy.root}
                  </p>
                  <div className="badge-row">
                    {hierarchy.has_cycle ? (
                      <span className="badge cycle">Cycle detected</span>
                    ) : (
                      <span className="badge">Depth {hierarchy.depth}</span>
                    )}
                  </div>
                  {hierarchy.has_cycle ? (
                    <p>This connected group contains a cycle, so no tree depth is returned.</p>
                  ) : (
                    <div className="tree-view">
                      <ul>
                        <TreeNode nodeName={hierarchy.root} subtree={hierarchy.tree} />
                      </ul>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="empty-state">No response yet.</p>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Formatted JSON</h2>
          </div>
          <pre className="json-output">
            {response ? JSON.stringify(response, null, 2) : "Waiting for a response..."}
          </pre>
        </article>
      </section>
    </main>
  );
}
