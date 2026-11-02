// Tests for the pages (ktw-pages.js) with more than one host. The pages build DOM nodes, so this runs in jsdom
// (installed by the workflow's smoke step, like smoke.mjs); the library files are loaded, in the manifest's
// order, into the jsdom window.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const { window } = dom;
const realm = dom.getInternalVMContext();
for (const name of ["ktw-core.js", "ktw-ui.js", "ktw-scene.js", "ktw-pages.js"]) {
  const file = new URL(`../../ktw_dashboard/web/${name}`, import.meta.url);
  vm.runInContext(fs.readFileSync(file, "utf8"), realm, { filename: file.pathname });
}
const { core, scene: sceneLib, views } = window.KeepTheWhy;
const doc = window.document;

const state = {
  project: { id: "p", name: "p", context: "context/", config: {}, git: { available: true } },
  entries: [], topics: [], authors: [], findings: { errors: 0, warnings: 0, items: [] },
};
// a nav whose addresses are not the dashboard's hash grammar: a path before the hash
const nav = { href: (r) => "/maity/p/why" + core.routes.format(r), go: () => {}, current: () => ({ view: "authors" }) };
// a host that records which of its hooks were called
function host(name, calls) {
  return {
    inline: (md) => { calls.push([name, "inline"]); return doc.createTextNode(String(md)); },
    authorLink: (n) => doc.createTextNode(n || "—"),
    authorProjects: () => [{ name: "p", canonical: "", state, open: "#authors", role: "self", anonymized: false }],
    friendsWaiting: () => [{ canonical: `https://example.org/${name}-friend` }],
    friendsLoading: () => false,
    loadFriends: (waiting) => calls.push([name, "loadFriends", waiting[0].canonical]),
    render: () => calls.push([name, "render"]), rerender: () => calls.push([name, "rerender"]),
  };
}

test("what a page leaves behind answers to the host that drew it, whichever host draws next", () => {
  const scene = sceneLib.create({ state });
  const P = views.pages.create({ scene, nav, prefs: { get: () => null, set: () => {} } });
  const calls = [];
  const A = host("A", calls), B = host("B", calls);
  const mainA = doc.createElement("main"), mainB = doc.createElement("main");
  P.authors(mainA, A);
  P.authors(mainB, B); // B draws last
  mainA.querySelector("button.link-btn").click();
  mainB.querySelector("button.link-btn").click();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [["A", "loadFriends", "https://example.org/A-friend"], ["B", "loadFriends", "https://example.org/B-friend"]]);
});

test("an entry's row is drawn with the Markdown of the host it is asked for", () => {
  const scene = sceneLib.create({ state });
  const P = views.pages.create({ scene, nav, prefs: { get: () => null, set: () => {} } });
  const calls = [];
  const e = { id: "why.md#a", uuid: "2f1c5b7e-8a3d-4c6e-9b0f-1d2e3f4a5b6c", file: "why.md", title: "A", type: ["decision"], status: "active", evidence: "confirmed", body: { text: "Because.", reason: "" } };
  P.entryRow(e, host("A", calls));
  const row = P.entryRow(e, host("B", calls));
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [["A", "inline"], ["B", "inline"]]);
  assert.equal(row.getAttribute("href"), "/maity/p/why#entry/2f1c5b7e-8a3d-4c6e-9b0f-1d2e3f4a5b6c", "the host's own address");
});
