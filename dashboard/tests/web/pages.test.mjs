// Tests for the pages (ktw-pages.js) with more than one host, neither of them the dashboard's. The pages build DOM nodes, so this runs in jsdom
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

// ---- the topic and entry pages
const UUID = "2f1c5b7e-8a3d-4c6e-9b0f-1d2e3f4a5b6c", REMOTE = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const entry = { id: "why.md#a-decision", uuid: UUID, file: "why.md", line: 3, title: "A decision", type: ["decision"], status: "active", evidence: "confirmed",
  body: { text: "Because.", reason: "" }, see: [{ remote: "https://example.org/other", uuid: REMOTE }], refs: [], findings: [] };
const entryState = { ...state, project: { ...state.project, git: { available: false } }, entries: [entry],
  topics: [{ file: "why.md", title: "Why", entries: 1, refs_out: [], refs_in: [], status: {}, evidence: {} }] };
const libs = { family: { publicTree: () => { throw new Error("not asked"); }, publicState: async () => null }, search: { canFamily: () => false, pool: async () => ({ groups: [], missing: [] }) } };
// a host for the entry page: its provider answers a lookup of another repository's entry with its own name
function entryHost(name, calls) {
  let answer; const answered = new Promise((r) => { answer = r; });
  return {
    answered,
    live: () => true, published: () => false, project: () => null,
    provider: () => ({ resolveEntry: async (uuid) => { calls.push([name, "resolveEntry", uuid]); await null; answer(); return { project: name, entry: { uuid, title: `${name}'s entry`, status: "active" } }; } }),
    inline: (md) => doc.createTextNode(String(md)), renderBody: (md) => doc.createTextNode(String(md)),
    shareUrl: (route, project) => { calls.push([name, "shareUrl", route.view]); return { url: `https://example.org/maity/p/why${core.routes.format(route)}`, where: "this page" }; },
    details: () => doc.createElement("aside"), miniGraph: () => {},
    entryThoughts: () => [], thoughts: {}, authorLink: (n) => doc.createTextNode(n || "—"), memberLink: (m, h) => h,
    render: () => {},
  };
}

test("an entry opened by its Id stays where it is; an old file#anchor moves to the Id", () => {
  for (const [at, expected] of [[UUID, []], [entry.id, [[{ view: "entry", uuid: UUID }, { replace: true }]]]]) {
    const moves = [];
    const pathNav = { ...nav, go: (r, o) => moves.push([r, o]), current: () => ({ view: "entry", uuid: at }) };
    const P = views.pages.create({ scene: sceneLib.create({ state: entryState }), nav: pathNav, prefs: { get: () => null, set: () => {} }, ...libs });
    P.entry(doc.createElement("main"), at, entryHost("A", []));
    assert.deepEqual(JSON.parse(JSON.stringify(moves)), expected, at);
  }
});

test("a reference resolved later lands with the host that drew it, whichever host draws next", async () => {
  const P = views.pages.create({ scene: sceneLib.create({ state: entryState }), nav: { ...nav, current: () => ({ view: "entry", uuid: UUID }) }, prefs: { get: () => null, set: () => {} }, ...libs });
  const calls = [];
  const A = entryHost("A", calls), B = entryHost("B", calls);
  const mainA = doc.createElement("main"), mainB = doc.createElement("main");
  P.entry(mainA, UUID, A);
  P.entry(mainB, UUID, B); // B draws before A's lookup has answered
  await Promise.all([A.answered, B.answered]); await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(JSON.parse(JSON.stringify(calls.filter((c) => c[1] === "resolveEntry"))), [["A", "resolveEntry", REMOTE], ["B", "resolveEntry", REMOTE]]);
  assert.match(mainA.querySelector(".ref.remote").textContent, /A's entry/);
  assert.match(mainB.querySelector(".ref.remote").textContent, /B's entry/);
  assert.equal(mainA.querySelector(".ref.remote a").getAttribute("href"), "/maity/p/why" + core.routes.format({ view: "entry", uuid: REMOTE }), "the host's own address for the entry");
});

test("the address an entry's copy-link button copies is the host's, the path not doubled", () => {
  const P = views.pages.create({ scene: sceneLib.create({ state: entryState }), nav: { ...nav, current: () => ({ view: "entry", uuid: UUID }) }, prefs: { get: () => null, set: () => {} }, ...libs });
  const calls = [];
  const main = doc.createElement("main");
  P.entry(main, UUID, entryHost("A", calls));
  const title = main.querySelector(".share-btn").getAttribute("title");
  assert.ok(title.endsWith(`https://example.org/maity/p/why#entry/${UUID}`), title);
  assert.equal(title.split("/maity/p/why").length, 2, "the path once");
  assert.deepEqual(JSON.parse(JSON.stringify(calls.filter((c) => c[1] === "shareUrl"))), [["A", "shareUrl", "entry"]]);
});
