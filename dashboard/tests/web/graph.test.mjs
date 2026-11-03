// Unit tests for the graph's data (ktw-graph.js: assemble and the neighbourhoods): node --test, no jsdom. The
// library files are loaded, in the manifest's order, into this realm; the graph's drawing is not touched.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

for (const name of ["ktw-core.js", "ktw-ui.js", "ktw-scene.js", "ktw-graph.js"]) {
  const file = new URL(`../../ktw_dashboard/web/${name}`, import.meta.url);
  vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file.pathname });
}
const { core, scene: sceneLib, views } = globalThis.KeepTheWhy;
const atRest = (g) => { for (let i = 0; i < 3000 && g.alpha > core.LAYOUT.MIN_ALPHA; i++) core.stepLayout(g); return g; };

// a host whose addresses are not the dashboard's hash grammar: a path before the hash
const nav = { href: (r) => "/maity/p/why" + core.routes.format(r), go: () => {}, current: () => ({ view: "graph" }) };
const prefs = { get: (k, f) => f, set: () => {} };
const A = "2f1c5b7e-8a3d-4c6e-9b0f-1d2e3f4a5b6c", B = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const entry = (id, file, uuid, extra = {}) => ({ id, file, uuid, title: id, refs: [], see: [], git: {}, ...extra });
const topics = [
  { file: "a.md", title: "A", entries: 1, refs_out: ["b.md"], refs_in: [] },
  { file: "b.md", title: "B", entries: 1, refs_out: [], refs_in: ["a.md"] },
];
const entries = [
  entry("a.md#one", "a.md", A, { refs: ["b.md"], see: [{ uuid: B, locator: "b.md#two", date: "2026-11-02" }] }),
  entry("b.md#two", "b.md", B),
];
const make = () => views.graph.create({ scene: sceneLib.create({ state: { topics, entries } }), nav, prefs });

test("assemble: the nodes and links of topics and entries, linked through the host's nav", () => {
  const g = make().assemble(topics, entries);
  assert.deepEqual(g.nodes.map((n) => n.id), ["t:a.md", "t:b.md", "e:a.md#one", "e:b.md#two"]);
  assert.deepEqual(g.links.map((l) => `${g.nodes[l.s].id}>${g.nodes[l.t].id}:${l.kind}`).sort(), [
    "e:a.md#one>e:b.md#two:see", "e:a.md#one>t:a.md:member", "e:a.md#one>t:b.md:ref", "e:b.md#two>t:b.md:member",
    "t:a.md>t:b.md:topic", "t:a.md>t:b.md:xtopic",
  ]);
  assert.deepEqual(g.nodes.map((n) => n.href), ["/maity/p/why#topic/a.md", "/maity/p/why#topic/b.md", `/maity/p/why#entry/${A}`, `/maity/p/why#entry/${B}`]);
  for (const n of g.nodes) assert.equal(n.href.split("/maity/p/why").length, 2, `${n.id}: the host's path once`);
});

test("assemble keeps a node where a graph drawn before had it", () => {
  const g = make().assemble(topics, entries, { "t:a.md": { x: 5, y: 7, fixed: true } });
  const t = g.nodes[g.index["t:a.md"]];
  assert.deepEqual([t.x, t.y, t.vx, t.vy, t.fixed], [5, 7, 0, 0, true]);
});

test("assemble seeds the nodes it has no place for, the same way every time, each near its topic", () => {
  const a = make().assemble(topics, entries), b = make().assemble(topics, entries);
  assert.ok(a.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y) && n.seeded), "every new node placed, and marked as seeded");
  assert.deepEqual(a.nodes.map((n) => [n.x, n.y]), b.nodes.map((n) => [n.x, n.y]), "no randomness");
  const at = (g, id) => g.nodes[g.index[id]];
  assert.ok(Math.hypot(at(a, "e:a.md#one").x - at(a, "t:a.md").x, at(a, "e:a.md#one").y - at(a, "t:a.md").y) < 120, "an entry starts near its topic");
  const kept = make().assemble(topics, entries, { "t:a.md": { x: 5, y: 7 } });
  assert.ok(!at(kept, "t:a.md").seeded && at(kept, "e:a.md#one").seeded, "a node kept from before is not seeded again");
});

test("the neighbourhood of an entry and of a topic", () => {
  const G = make();
  assert.deepEqual(G.buildSubgraph(entries[1]).nodes.map((n) => n.id), ["t:a.md", "t:b.md", "e:a.md#one", "e:b.md#two"], "B's topic is referenced from A, and A cites B");
  assert.deepEqual(G.buildTopicSubgraph(topics[0]).nodes.map((n) => n.id), ["t:a.md", "t:b.md", "e:a.md#one"]);
});

test("the side pane's copy of a graph shares its layout's lifecycle: a relayout settled there is settled, and nothing moves after", () => {
  const G = make();
  const g = core.reheatAfterBuild(Object.assign({ alpha: 1 }, G.assemble(topics, entries))); atRest(g);
  core.reheatAll(g); // the shape changed (the owners switch, a hub coming in)
  const r = G.runnerOf(g, { showEntries: true });
  assert.ok(r.relayout && r.alpha === 1, "the copy sees the graph's relayout");
  atRest(r); // only the side pane's copy runs
  assert.ok(!g.relayout && g.alpha <= core.LAYOUT.MIN_ALPHA, "settled in the copy, settled in the graph");
  const placed = g.nodes.map((n) => [n.x, n.y]);
  // a rebuild that changes nothing, as the next live update brings
  Object.assign(g, G.assemble(topics, entries, Object.fromEntries(g.nodes.map((n) => [n.id, n])))); core.reheatAfterBuild(g);
  assert.ok(g.alpha <= core.LAYOUT.MIN_ALPHA && !g.relayout && !g.placing, "no relayout left over, no new one");
  assert.equal(r.nodes, g.nodes, "the copy reads the graph's nodes as they are now");
  atRest(r);
  assert.deepEqual(g.nodes.map((n) => [n.x, n.y]), placed, "nothing moves");
  // the side pane shown again: a new copy, the old one stale
  const r2 = G.runnerOf(g);
  assert.ok(r2.alpha <= core.LAYOUT.MIN_ALPHA && !r2.relayout, "the new copy starts at rest");
  assert.ok(g.runner === r2 && r.of.runner !== r, "the graph runs the new copy only");
  const scene = sceneLib.create(); scene.resetLayout(g); scene.publishFrom(g, { force: true });
  const before = scene.layout.get(g.nodes[0].id); g.nodes[0].x += 50; g.placed = new Set([g.nodes[0]]);
  scene.publishFrom(r);
  assert.deepEqual(scene.layout.get(g.nodes[0].id), before, "the scene takes nothing from a stale copy");
  scene.publishFrom(r2);
  assert.equal(scene.layout.get(g.nodes[0].id).x, g.nodes[0].x, "and takes it from the copy run now");
});
