# Hierarchy Intelligence Pro

## System Architecture

### 1. Frontend
- Framework: Next.js App Router with React client components
- Rendering: Interactive SVG graph canvas
- Styling: Existing glassmorphism CSS system, with a Tailwind-ready component breakdown below
- Responsibilities:
  - syntax-highlighted edge input
  - CSV / JSON drag-and-drop ingestion
  - real-time validation preview
  - multi-view graph rendering
  - playback debugger for DFS / BFS
  - search, lineage highlight, shortest path finding
  - exports for JSON, Mermaid, and PNG

### 2. Backend
- Runtime: Node.js + Express
- Primary endpoint: `POST /bfhl`
- Core responsibilities:
  - normalize and validate input
  - enforce first-parent-wins semantics
  - collect invalid entries, duplicates, self-loops
  - build connected components
  - detect cycles with Tarjan SCC
  - compute tree depth, traversal order, lineage index
  - suggest a deterministic breaking link for cyclic components

### 3. Data Flow
1. User enters edges or drops a CSV / JSON file.
2. Frontend parses text into edge rows and shows live validation.
3. Frontend sends the normalized payload to `POST /bfhl`.
4. Backend returns the challenge-safe response plus `analytics`.
5. Frontend hydrates:
   - hierarchy cards
   - cycle insights
   - disconnected component stats
   - traversal playback
   - search / path-finder highlights

## Backend Graph Engine

### Parsing Layer
- Time complexity: `O(E)`
- Validates only `X->Y` edges
- Rejects:
  - malformed syntax
  - self-loops
  - empty lines
- Silently discards later multi-parent conflicts

### Graph Analysis Layer
- Connected components: `O(V + E)`
- Tarjan SCC cycle detection: `O(V + E)`
- Tree depth: `O(V + E)` with memoization
- BFS / DFS traversal extraction: `O(V + E)`
- Shortest path support: `O(V + E)` per query on the client

### Enriched Analytics Returned
- `accepted_edges`
- `self_loops`
- `disconnected_components`
- `connected_components`
- `cycle_components`
- `strongly_connected_components`
- `parser.vertices`
- `parser.edges`
- `parser.complexity`

## Frontend Visualization Model

### View Modes
- `vertical`: classic hierarchy tree
- `radial`: radial cluster layout
- `force`: force-directed graph layout

### Interaction Model
- drag the canvas
- drag individual nodes
- explicit zoom controls
- click a node to inspect path / depth / child count
- playback traversal order for DFS or BFS

### Intelligence Layer
- search a node and highlight its lineage
- compute shortest directed path between two nodes
- surface breaking-link suggestions for cycles
- distinguish:
  - invalid entries
  - duplicate edges
  - self-loops
  - disconnected components

## Tailwind-Ready React Structure

If you want to migrate the current UI into Tailwind CSS without changing product behavior, use this component split:

```text
app/
  page.tsx
components/
  dashboard-shell.tsx
  sidebar.tsx
  topbar.tsx
  graph-input-panel.tsx
  validation-panel.tsx
  hierarchy-panel.tsx
  graph-canvas.tsx
  playback-toolbar.tsx
  path-finder.tsx
  summary-panel.tsx
  payload-panel.tsx
lib/
  graph-engine.ts
  graph-layouts.ts
  graph-exports.ts
```

Example Tailwind direction:

```tsx
<section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
  <aside className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl" />
  <main className="grid gap-4">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/20 bg-slate-950/60 px-4 py-3" />
    <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.4fr)]" />
  </main>
</section>
```

## Recommended Next Steps
- move the monolithic page into smaller React components
- migrate the current CSS tokens into Tailwind theme extensions
- add persisted graph sessions in local storage or a database
- benchmark 100+ node force layouts with memoized simulation caching
