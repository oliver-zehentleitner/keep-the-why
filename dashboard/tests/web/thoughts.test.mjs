// Unit tests for the thoughts view (ktw-thoughts.js): node --test, no jsdom. The view is made with a scene, a nav
// and prefs; the library files are loaded, in the manifest's order, into this realm.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

for (const name of ["ktw-core.js", "ktw-ui.js", "ktw-scene.js", "ktw-thoughts.js"]) {
  const file = new URL(`../../ktw_dashboard/web/${name}`, import.meta.url);
  vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file.pathname });
}
const { core, scene: sceneLib, views } = globalThis.KeepTheWhy;

// three entries, c cites b cites a: one thought, a → b → c
const entry = (uuid) => ({ uuid, title: uuid, see: [], type: ["decision"], status: "active", evidence: "confirmed" });
const graph = () => {
  const nodes = ["a", "b", "c"].map((u) => ({ id: u, kind: "entry", label: u, entry: entry(u) }));
  return { nodes, links: [{ s: 2, t: 1, kind: "see" }, { s: 1, t: 0, kind: "see" }] };
};
// a host whose addresses are not the dashboard's hash grammar: a path prefix before it
const pathNav = (current) => ({
  href: (r) => "/maity/p/why" + core.routes.format(r),
  go: () => {},
  current: () => current,
});
const prefs = { get: () => null, set: () => {} };

test("a thought read directly is held and lit, whatever the host's addresses look like", () => {
  const scene = sceneLib.create({ state: { entries: [], topics: [] } });
  const nav = pathNav({ view: "thought", refs: ["a", "b", "c"] });
  const T = views.thoughts.create({ scene, nav, prefs });
  const pins = []; scene.on("pin", (k) => pins.push(k));
  const lit = [];
  const g = graph();
  T.holdReading(g, { light: (gg, t) => lit.push([gg, t.ids]) });
  assert.equal(scene.pin, "a|b|c");
  assert.deepEqual(pins, ["a|b|c"]);
  assert.deepEqual(lit, [[g, ["a", "b", "c"]]]);
  assert.equal(T.thoughtHref(T.of(g).all[0]), "/maity/p/why#thought/a,b,c", "the link is still the host's");
});

test("a reader for refs no chain here has, or another place, holds nothing", () => {
  for (const current of [{ view: "thought", refs: ["a", "b"] }, { view: "thought", refs: ["c", "b", "a"] }, { view: "overview" }]) {
    const scene = sceneLib.create({ state: { entries: [], topics: [] } });
    const T = views.thoughts.create({ scene, nav: pathNav(current), prefs });
    let lit = 0;
    T.holdReading(graph(), { light: () => lit++ });
    assert.equal(scene.pin, null, JSON.stringify(current));
    assert.equal(lit, 0);
  }
});
