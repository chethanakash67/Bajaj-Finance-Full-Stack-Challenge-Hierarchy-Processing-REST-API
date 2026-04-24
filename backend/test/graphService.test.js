const test = require("node:test");
const assert = require("node:assert/strict");
const { processGraphPayload } = require("../src/graphService");

test("official sample input matches expected logic", () => {
  const result = processGraphPayload({
    data: [
      "A->B",
      "A->C",
      "B->D",
      "C->E",
      "E->F",
      "X->Y",
      "Y->Z",
      "Z->X",
      "P->Q",
      "Q->R",
      "G->H",
      "G->H",
      "G->I",
      "hello",
      "1->2",
      "A->",
    ],
  });

  assert.deepEqual(result.invalid_entries, ["hello", "1->2", "A->"]);
  assert.deepEqual(result.duplicate_edges, ["G->H"]);
  assert.equal(result.summary.total_trees, 3);
  assert.equal(result.summary.total_cycles, 1);
  assert.equal(result.summary.largest_tree_root, "A");
});

test("invalid entries are collected correctly", () => {
  const result = processGraphPayload({
    data: ["hello", "1->2", "AB->C", "A-B", "A->", "", "A->A"],
  });

  assert.deepEqual(result.invalid_entries, ["hello", "1->2", "AB->C", "A-B", "A->", "", "A->A"]);
});

test("duplicate edge repeated three times is reported once", () => {
  const result = processGraphPayload({
    data: ["A->B", "A->B", "A->B"],
  });

  assert.deepEqual(result.duplicate_edges, ["A->B"]);
  assert.equal(result.hierarchies.length, 1);
});

test("whitespace trimming accepts spaced arrows", () => {
  const result = processGraphPayload({
    data: [" A -> B ", "B -> C"],
  });

  assert.equal(result.invalid_entries.length, 0);
  assert.equal(result.hierarchies[0].depth, 3);
});

test("self loop is treated as invalid and not a cycle", () => {
  const result = processGraphPayload({
    data: ["A->A"],
  });

  assert.deepEqual(result.invalid_entries, ["A->A"]);
  assert.equal(result.summary.total_cycles, 0);
});

test("pure cycle returns lexicographically smallest root", () => {
  const result = processGraphPayload({
    data: ["Z->X", "X->Y", "Y->Z"],
  });

  assert.deepEqual(result.hierarchies, [{ root: "X", tree: {}, has_cycle: true }]);
});

test("cycle inside connected component marks whole component cyclic", () => {
  const result = processGraphPayload({
    data: ["X->Y", "Y->Z", "Z->X", "X->A"],
  });

  assert.deepEqual(result.hierarchies, [{ root: "A", tree: {}, has_cycle: true }]);
  assert.equal(result.summary.total_cycles, 1);
});

test("multi-parent child keeps the first parent only", () => {
  const result = processGraphPayload({
    data: ["A->D", "B->D", "D->E"],
  });

  assert.deepEqual(result.hierarchies, [
    {
      root: "A",
      tree: {
        D: {
          E: {},
        },
      },
      depth: 3,
    },
  ]);
});

test("largest_tree_root uses lexicographic tie breaker", () => {
  const result = processGraphPayload({
    data: ["A->B", "C->D"],
  });

  assert.equal(result.summary.largest_tree_root, "A");
});

test("empty input is valid and returns empty summary", () => {
  const result = processGraphPayload({
    data: [],
  });

  assert.deepEqual(result.hierarchies, []);
  assert.deepEqual(result.summary, {
    total_trees: 0,
    total_cycles: 0,
    largest_tree_root: null,
  });
});

test("centrality analytics are included and rank bottlenecks", () => {
  const result = processGraphPayload({
    data: ["A->B", "B->C", "C->D"],
  });

  assert.deepEqual(result.analytics.centrality.closeness, {
    A: 0.5,
    B: 0.6667,
    C: 1,
    D: 0,
  });
  assert.equal(result.analytics.centrality.bottlenecks[0].node, "C");
  assert.equal(result.analytics.centrality.bottlenecks[0].component_root, "A");
  assert.deepEqual(
    result.analytics.connected_components[0].top_central_nodes.map((entry) => entry.node),
    ["C", "B", "A"]
  );
});
