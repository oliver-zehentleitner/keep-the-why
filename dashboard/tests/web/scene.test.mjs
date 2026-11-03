// Unit tests for the scene (ktw-scene.js): node --test, no jsdom. The scene's layout settles through the
// core, so both are loaded, in the manifest's order, into this realm.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

for (const name of ["ktw-core.js", "ktw-scene.js"]) {
  const file = new URL(`../../ktw_dashboard/web/${name}`, import.meta.url);
  vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file.pathname });
}
const { create } = globalThis.KeepTheWhy.scene;

test("the scene holds what the views share and tells its subscribers when it changes", () => {
  const scene = create({ state: { entries: [] }, scope: "family" });
  assert.equal(scene.scope, "family");
  const heard = [];
  const off = scene.on("day", (d, info) => heard.push(["day", d, info.grew]));
  scene.on("focus", (r) => heard.push(["focus", r]));
  scene.on("thought", (t) => heard.push(["thought", t]));
  scene.on("spot", (c, r) => heard.push(["spot", c, r]));
  scene.on("scope", (v) => heard.push(["scope", v]));
  scene.on("wake", () => heard.push(["wake"]));
  scene.setDay("2026-04-15", { grew: true }); scene.setFocus("u1"); scene.setFocus(""); scene.light({ ids: [] });
  scene.spot("https://e.org/x", ""); scene.setScope("project"); scene.wake();
  off(); scene.setDay(null);
  assert.deepEqual(heard, [["day", "2026-04-15", true], ["focus", "u1"], ["focus", null], ["thought", { ids: [] }], ["spot", "https://e.org/x", ""], ["scope", "project"], ["wake"]]);
  assert.equal(scene.day, null, "a day set with nobody listening is still set");
  assert.equal(scene.focus, null);
});

test("the layout copies what its source lays out: all of it while it first settles, then only what a step moved", () => {
  const scene = create();
  const nodes = [{ id: "t", kind: "topic", x: 1, y: 2 }, { id: "e", kind: "entry", x: 3, y: 4 }, { id: "p", kind: "project", x: 9, y: 9 }];
  const g = { nodes, alpha: 1 };
  scene.resetLayout(g);
  let told = 0; scene.on("layout", () => told++);
  scene.publishFrom(g);
  assert.deepEqual([...scene.layout.keys()], ["t", "e"], "entries and topics only");
  nodes[0].x = 5; g.alpha = 0; scene.publishFrom(g);
  assert.deepEqual(scene.layout.get("t"), { x: 5, y: 2 }); assert.equal(scene.layoutSettled, true);
  nodes[0].x = 7; scene.publishFrom(g);
  assert.deepEqual(scene.layout.get("t"), { x: 5, y: 2 }, "settled, the graph turning: nothing is copied");
  assert.equal(told, 2, "and the scene says nothing");
  nodes.push({ id: "n", kind: "entry", x: 0, y: 1, seeded: true }); scene.publishFrom(g);
  assert.deepEqual(scene.layout.get("n"), { x: 0, y: 1 }, "a node not yet known is added");
  assert.deepEqual(scene.layout.get("t"), { x: 5, y: 2 }, "the rest kept");
  // a placement: the node it lays out is copied while it moves, and once more where it came to rest
  Object.assign(g, { alpha: 1, placing: true }); nodes[3].x = 4; scene.publishFrom(g);
  assert.deepEqual(scene.layout.get("n"), { x: 4, y: 1 }); assert.equal(scene.layoutSettled, true);
  delete nodes[3].seeded; nodes[3].x = 4.05; Object.assign(g, { alpha: 0, placing: false, placed: new Set([nodes[3]]) }); scene.publishFrom(g);
  assert.deepEqual(scene.layout.get("n"), { x: 4.05, y: 1 }, "its final place"); assert.equal(g.placed, null, "taken");
  assert.deepEqual(scene.layout.get("t"), { x: 5, y: 2 }, "the placed nodes kept");
  // a relayout (the graph's shape changed): all of it again, and once more at rest
  Object.assign(g, { alpha: 1, relayout: true }); nodes[0].x = 8; scene.publishFrom(g);
  assert.deepEqual(scene.layout.get("t"), { x: 8, y: 2 });
  nodes[0].x = 8.01; Object.assign(g, { alpha: 0, relayout: false, relaidOut: true }); scene.publishFrom(g);
  assert.deepEqual(scene.layout.get("t"), { x: 8.01, y: 2 }); assert.equal(g.relaidOut, false);
  scene.resetLayout(null);
  assert.equal(scene.layout.size, 0); assert.equal(scene.layoutSettled, false); assert.equal(scene.layoutSource, null);
});

test("settled is said only at rest, at the core's floor", () => {
  const scene = create(); const g = { nodes: [{ id: "t", kind: "topic", x: 0, y: 0 }], alpha: 0.008 };
  scene.resetLayout(g); scene.publishFrom(g);
  assert.equal(scene.layoutSettled, false, "an alpha of 0.008 is still moving (the floor is LAYOUT.MIN_ALPHA, 0.003)");
  g.alpha = 0.003; scene.publishFrom(g);
  assert.equal(scene.layoutSettled, true);
});

test("the stage's layout follows the graph through every day step: each shown node where the graph has it", () => {
  const core = globalThis.KeepTheWhy.core;
  const nodes = [], links = [];
  for (let t = 0; t < 6; t++) { nodes.push({ id: `t${t}`, kind: "topic", r: 12 }); const ti = nodes.length - 1; if (t) links.push({ s: ti, t: ti - 1, kind: "topic", len: 150 });
    for (let e = 0; e < 12; e++) { nodes.push({ id: `e${t}.${e}`, kind: "entry", r: 4.2, day: (t * 12 + e) % 8 }); links.push({ s: nodes.length - 1, t: ti, kind: "member", len: 42 }); } }
  core.seedLayout(nodes, links);
  const g = core.reheatSeeded({ nodes, links, alpha: 1 });
  const scene = create(); scene.resetLayout(g);
  let day = 2; const visible = (n) => n.kind !== "entry" || n.day <= day;
  // the graph's loop: what is newly shown is placed, a step, and the scene takes what the step laid out
  const settle = () => { for (let i = 0; i < 2000 && (g.alpha > core.LAYOUT.MIN_ALPHA || g.placed || g.relaidOut); i++) { if (!g.placing && !g.relayout) core.placeShown(g, { visible }); if (g.alpha > core.LAYOUT.MIN_ALPHA) core.stepLayout(g, { visible }); scene.publishFrom(g); } };
  const off = () => { let d = 0; for (const n of nodes) if (visible(n)) { const q = scene.layout.get(n.id); d = Math.max(d, q ? Math.hypot(q.x - n.x, q.y - n.y) : Infinity); } return d; };
  settle(); assert.equal(off(), 0, "settled: the copy is the graph");
  for (day = 3; day <= 7; day++) { core.placeShown(g, { visible }); settle(); assert.equal(off(), 0, `day ${day}: the copy is the graph, the nodes the day brought included`); }
  // a relayout (the shape changed), followed as well
  core.reheatAll(g); settle(); assert.equal(off(), 0, "after a relayout");
});

test("with no graph drawn, the scene settles the layout itself; with one, it waits for it", () => {
  const mk = () => ({ nodes: [{ id: "a", kind: "topic", x: 0, y: 0, vx: 0, vy: 0 }, { id: "b", kind: "entry", x: 5, y: 0, vx: 0, vy: 0 }], links: [{ s: 0, t: 1, len: 60, kind: "member" }] });
  const headless = create(); const g = mk();
  const layout = headless.layoutFor(g.nodes, g.links);
  assert.equal(headless.layoutSettled, true);
  assert.ok(Math.hypot(layout.get("b").x - layout.get("a").x, layout.get("b").y - layout.get("a").y) > 20, "settled: the spring has opened the pair up");
  const drawn = create(); const h = mk(); drawn.resetLayout(h);
  assert.equal(drawn.layoutFor(h.nodes, h.links).size, 0, "a source is set: nothing is settled here");
  assert.deepEqual([h.nodes[1].x, h.nodes[1].y], [5, 0], "and the source's nodes are left alone");
});

test("the clock's view of an entry: there on the day shown, with the status it had then", () => {
  const scene = create({ state: { project: { git: { available: true } }, entries: [] } });
  const e = { status: "superseded", git: { created: { date: "2026-03-02" }, status_history: [{ date: "2026-03-02", status: "active" }, { date: "2026-05-10", status: "superseded" }] } };
  const fresh = { status: "active" }; // not committed yet: in a repository, it exists today only
  assert.equal(scene.atClock(e), true, "no clock: today, and the entry exists");
  assert.equal(scene.statusNow(e), "superseded");
  scene.setDay("2026-02-01"); assert.equal(scene.atClock(e), false, "before it was written");
  scene.setDay("2026-04-01"); assert.equal(scene.atClock(e), true);
  assert.equal(scene.statusNow(e), "active", "on a day before it was superseded, the status it had then");
  scene.setDay("2026-06-01"); assert.equal(scene.statusNow(e), "superseded");
  scene.setDay("2026-04-01");
  assert.equal(scene.atClock(fresh), false, "an uncommitted entry of a repository is not there on a past day");
  assert.equal(scene.atClock(fresh, true), false, "a foreign entry came from a repository's export too: without a date, today only");
  const noGit = create({ state: { project: { git: { available: false } }, entries: [] } }); noGit.setDay("2026-04-01");
  assert.equal(noGit.atClock(fresh), true, "a project without a repository has no days to go by: the entry is there");
  assert.equal(scene.hasRepo({ origin: {} }), true, "a foreign entry came from a repository");
});

test("a thought held is the scene's pin: set and let go through setThought, told once per change; lighting in passing leaves it", () => {
  const scene = create();
  const pins = []; scene.on("pin", (k) => pins.push(k));
  const t = { ids: ["a", "b", "c"] }, u = { ids: ["x", "y"] };
  scene.setThought(t); assert.equal(scene.pin, "a|b|c");
  scene.setThought(t); // the same thought again: no change, no event
  scene.light(u); scene.light(null); assert.equal(scene.pin, "a|b|c", "pointing at another thought does not move the pin");
  scene.setThought(u); scene.setThought(null); scene.setThought(null);
  assert.deepEqual(pins, ["a|b|c", "x|y", null]);
  assert.equal(scene.pin, null);
});
