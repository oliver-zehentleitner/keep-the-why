// Tests for the pages (ktw-pages.js) under a host whose addresses are not the dashboard's hash grammar. The pages
// build DOM nodes, so this runs in jsdom (installed by the workflow's smoke step, like smoke.mjs); the library
// files are loaded, in the manifest's order, into the jsdom window.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><main></main><aside id=details></aside>", { runScripts: "outside-only" });
const { window } = dom;
for (const name of ["ktw-core.js", "ktw-ui.js", "ktw-scene.js", "ktw-pages.js"]) {
  window.eval(fs.readFileSync(new URL(`../../ktw_dashboard/web/${name}`, import.meta.url), "utf8"));
}
const { core, scene: sceneLib, views } = window.KeepTheWhy;

const entry = { id: "why.md#a-decision", uuid: "2f1c5b7e-8a3d-4c6e-9b0f-1d2e3f4a5b6c", file: "why.md", line: 3, title: "A decision", type: ["decision"], status: "active", evidence: "confirmed", body: { text: "Because.", reason: "" }, see: [], refs: [], findings: [] };
const state = { project: { id: "p", name: "p", context: "context/", config: {}, git: { available: false } }, entries: [entry], topics: [{ file: "why.md", title: "Why", entries: 1, refs_out: [], refs_in: [], status: {}, evidence: {} }], authors: [], findings: { errors: 0, warnings: 0, items: [] } };
const frag = (text) => { const f = window.document.createDocumentFragment(); f.append(String(text)); return f; };
const host = (details) => ({
  live: () => false, published: () => false, project: () => null, inline: frag, renderBody: frag,
  details: () => details, miniGraph: () => {}, canFamily: () => false, scope: () => "project",
  entryThoughts: () => [], thoughts: {}, authorLink: (n) => window.document.createTextNode(n || "—"), memberLink: (m, h) => h,
  pageUrl: () => "https://example.org/maity/p/why", isLocalPage: () => false,
});

test("an entry opened by its Id stays where it is, whatever the host's addresses look like", () => {
  const moves = [];
  const nav = {
    href: (r) => "/maity/p/why" + core.routes.format(r), // a path before the hash: not the dashboard's grammar
    go: (r, opts) => moves.push([r, opts]),
    current: () => ({ view: "entry", uuid: entry.uuid }),
  };
  const scene = sceneLib.create({ state });
  const P = views.pages.create({ scene, nav, prefs: { get: () => null, set: () => {} } });
  const main = window.document.querySelector("main"), details = window.document.querySelector("#details");
  P.entry(main, entry.uuid, host(details));
  assert.deepEqual(moves, [], "no move to the address it is already at");
  assert.equal(main.querySelector("h1").textContent, "A decision");
  assert.equal(scene.selected, entry.id);
  assert.equal(details.querySelector("h3").textContent, "Entry");
});

test("an entry opened by its old file#anchor moves to its Id", () => {
  const moves = [];
  const nav = { href: (r) => "/maity/p/why" + core.routes.format(r), go: (r, opts) => moves.push([r, opts]), current: () => ({ view: "entry", uuid: entry.id }) };
  const scene = sceneLib.create({ state });
  const P = views.pages.create({ scene, nav, prefs: { get: () => null, set: () => {} } });
  const main = window.document.createElement("main");
  P.entry(main, entry.id, host(window.document.createElement("aside")));
  assert.deepEqual(JSON.parse(JSON.stringify(moves)), [[{ view: "entry", uuid: entry.uuid }, { replace: true }]]); // objects of the page's realm
});
