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
  scene.setDay("2026-04-15", { grew: true }); scene.setFocus("u1"); scene.setFocus(""); scene.setThought({ ids: [] });
  scene.spot("https://e.org/x", ""); scene.setScope("project"); scene.wake();
  off(); scene.setDay(null);
  assert.deepEqual(heard, [["day", "2026-04-15", true], ["focus", "u1"], ["focus", null], ["thought", { ids: [] }], ["spot", "https://e.org/x", ""], ["scope", "project"], ["wake"]]);
  assert.equal(scene.day, null, "a day set with nobody listening is still set");
  assert.equal(scene.focus, null);
});

test("the layout follows its source while it settles, then keeps what it has and only adds", () => {
  const scene = create();
  const nodes = [{ id: "t", kind: "topic", x: 1, y: 2 }, { id: "e", kind: "entry", x: 3, y: 4 }, { id: "p", kind: "project", x: 9, y: 9 }];
  scene.resetLayout({ nodes });
  let told = 0; scene.on("layout", () => told++);
  scene.publishLayout(nodes);
  assert.deepEqual([...scene.layout.keys()], ["t", "e"], "entries and topics only");
  nodes[0].x = 5; scene.publishLayout(nodes, { settled: true });
  assert.deepEqual(scene.layout.get("t"), { x: 5, y: 2 });
  nodes[0].x = 7; nodes.push({ id: "n", kind: "entry", x: 0, y: 1 }); scene.publishLayout(nodes);
  assert.deepEqual(scene.layout.get("t"), { x: 5, y: 2 }, "settled: known positions are kept");
  assert.deepEqual(scene.layout.get("n"), { x: 0, y: 1 }, "a node not yet known is added");
  assert.equal(told, 3);
  scene.resetLayout(null);
  assert.equal(scene.layout.size, 0); assert.equal(scene.layoutSettled, false); assert.equal(scene.layoutSource, null);
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
  const e = { status: "superseded", git: { created: { date: "2026-03-02" }, status_changes: [{ date: "2026-05-10", status: "superseded", from: "active" }] } };
  const fresh = { status: "active" }; // not committed yet: in a repository, it exists today only
  assert.equal(scene.atClock(e), true, "no clock: today, and the entry exists");
  assert.equal(scene.statusNow(e), "superseded");
  scene.setDay("2026-02-01"); assert.equal(scene.atClock(e), false, "before it was written");
  scene.setDay("2026-04-01"); assert.equal(scene.atClock(e), true);
  assert.equal(scene.atClock(fresh), false, "an uncommitted entry of a repository is not there on a past day");
  assert.equal(scene.atClock(fresh, true), false, "a foreign entry came from a repository's export too: without a date, today only");
  const noGit = create({ state: { project: { git: { available: false } }, entries: [] } }); noGit.setDay("2026-04-01");
  assert.equal(noGit.atClock(fresh), true, "a project without a repository has no days to go by: the entry is there");
  assert.equal(scene.hasRepo({ origin: {} }), true, "a foreign entry came from a repository");
});
