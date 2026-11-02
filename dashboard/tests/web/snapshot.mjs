// DOM snapshots per route: the guard for refactoring the page without changing what it shows.
//
// Loads a page rendered from the frozen fixture state (fixture/make_fixture.py --page), drives every
// route in jsdom with the clock, the time zone and Math.random fixed, and writes #main and #details of
// each route — and the shell (#sidebar, #strip, #project-title) once — as an indented element tree, one
// node per line, into snapshots/. Without --update it compares instead and fails on any difference.
//
//   node snapshot.mjs PAGE            compare against snapshots/
//   node snapshot.mjs PAGE --update   rewrite snapshots/ (review the diff with git before committing)
//
// What a canvas draws is not in the DOM and not in a snapshot; a change to the graph or the stage is
// shown with before/after screenshots in its pull request instead.
process.env.TZ = "UTC"; // before the first Date: the timeline labels hours in the reader's zone

import { JSDOM, VirtualConsole } from "jsdom";
import { moduleAsClassic } from "./classic.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "snapshots");
const NOW = Date.parse("2026-06-15T12:00:00Z"); // the fixture's `generated`: "today" for the page
const [page, flag] = process.argv.slice(2);
if (!page) { console.error("usage: node snapshot.mjs PAGE [--update]"); process.exit(2); }
const update = flag === "--update";

// ---- the page, with everything that differs between two runs held still
const html = moduleAsClassic(fs.readFileSync(page, "utf8"));
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("jsdom: " + (e.detail?.stack || e.message || e).toString().split("\n").slice(0, 2).join(" | ")));
vc.on("error", (...a) => errors.push("console: " + a.join(" ")));
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "http://localhost/",
  virtualConsole: vc,
  beforeParse(window) {
    const RealDate = window.Date;
    class FixedDate extends RealDate {
      constructor(...a) { if (a.length) super(...a); else super(NOW); }
      static now() { return NOW; }
    }
    window.Date = FixedDate;
    let seed = 0x2f1c5b7e; // mulberry32: the same "random" sequence on every run
    window.Math.random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    window.ResizeObserver = class { observe() {} disconnect() {} };
    window.HTMLCanvasElement.prototype.getContext = () =>
      new Proxy({}, { get: (t, k) => (k === "measureText" ? () => ({ width: 10 }) : () => {}), set: () => true });
    window.requestAnimationFrame = (fn) => window.setTimeout(() => fn(0), 16);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
    window.matchMedia = () => ({ matches: false });
    window.CSS = { escape: (s) => s.replace(/([^\w-])/g, "\\$1") };
    window.addEventListener("error", (e) => errors.push("window: " + e.message));
  },
});
const { window } = dom;
const doc = window.document;
const tick = (ms) => new Promise((r) => setTimeout(r, ms));
const go = async (hash) => { window.location.hash = hash; window.dispatchEvent(new window.Event("hashchange")); await tick(150); };
await tick(300);
const S = window.__KTW_STATE__;
if (!S?.entries?.length) { console.log("no state on the page"); process.exit(1); }

// ---- an element tree as text: one node per line, attributes sorted, text collapsed
function tree(node, depth = 0, out = []) {
  const pad = "  ".repeat(depth);
  for (const n of node.childNodes) {
    if (n.nodeType === 3) { const t = n.textContent.replace(/\s+/g, " ").trim(); if (t) out.push(pad + JSON.stringify(t)); continue; }
    if (n.nodeType !== 1) continue;
    const attrs = [...n.attributes].map((a) => (a.value === "" ? a.name : `${a.name}=${JSON.stringify(a.value)}`)).sort();
    out.push(`${pad}<${n.localName}${attrs.length ? " " + attrs.join(" ") : ""}>`);
    tree(n, depth + 1, out);
  }
  return out;
}
const section = (name, sel) => { const n = doc.querySelector(sel); return [`## ${name}`, ...(n ? tree(n) : ["(missing)"]), ""]; };

// ---- the routes: every branch of the page's router that renders without a network
const byTitle = (part) => S.entries.find((e) => e.title.includes(part));
const routes = [
  ["overview", "#overview"],
  ["graph", "#graph"],
  ["timeline", "#timeline"],
  ["timeline-day", "#timeline/2026-04-15"],
  ["authors", "#authors"],
  ["queues", "#queues"],
  ["findings", "#findings"],
  ["family", "#family"],
  ["projects", "#projects"],
  ["friends", "#friends"],
  ["thoughts", "#thoughts"],
  ...S.topics.map((t) => [`topic-${t.file.replace(/\.md$/, "")}`, `#topic/${t.file}`]),
  ["entry-superseded", `#entry/${byTitle("waits for the snapshot").uuid}`],
  ["entry-callouts-lists", `#entry/${byTitle("versioned snapshot").uuid}`],
  ["entry-open-unknown", `#entry/${byTitle("retry three times").uuid}`],
  ["entry-contradicted", `#entry/${byTitle("capped at one megabyte").uuid}`],
  ["entry-source-link", `#entry/${byTitle("stable code").uuid}`],
  ["entry-undefined-type", `#entry/${byTitle("Temporary files").uuid}`],
  ["entry-hostile-text", `#entry/${byTitle("Pasted").uuid}`],
  ["search", "#search/self/snapshot"],
];
const results = new Map();
let shell = null;
for (const [name, hash] of routes) {
  await go(hash);
  results.set(name, [`# ${hash}`, "", ...section("#main", "#main"), ...section("#details", "#details")].join("\n"));
  if (name === "overview") shell = [...section("#sidebar", "#sidebar"), ...section("#strip", "#strip"), ...section("#project-title", "#project-title")].join("\n");
}
// a thought reader: the first chain the thoughts page links to
await go("#thoughts");
const thought = doc.querySelector('#main a[href^="#thought/"]')?.getAttribute("href");
if (thought) { await go(thought); results.set("thought", [`# ${thought}`, "", ...section("#main", "#main"), ...section("#details", "#details")].join("\n")); }
else errors.push("thoughts: the page links no chain — the fixture should have one");
results.set("_shell", shell);

// ---- compare or write
const files = [...results].map(([name, text]) => [path.join(DIR, `${name}.txt`), text.endsWith("\n") ? text : text + "\n"]);
let changed = 0;
if (update) {
  fs.rmSync(DIR, { recursive: true, force: true });
  fs.mkdirSync(DIR, { recursive: true });
  for (const [file, text] of files) fs.writeFileSync(file, text);
  console.log(`wrote ${files.length} snapshots to ${path.relative(process.cwd(), DIR) || DIR}`);
} else {
  const want = new Set(fs.existsSync(DIR) ? fs.readdirSync(DIR) : []);
  for (const [file, text] of files) {
    const name = path.basename(file); want.delete(name);
    if (!fs.existsSync(file)) { changed++; console.log(`NEW      ${name} (no stored snapshot)`); continue; }
    const old = fs.readFileSync(file, "utf8");
    if (old === text) continue;
    changed++;
    const a = old.split("\n"), b = text.split("\n");
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    console.log(`CHANGED  ${name} — first difference at line ${i + 1}:`);
    for (let k = Math.max(0, i - 2); k < Math.min(a.length, i + 4); k++) console.log(`  - ${a[k]}`);
    for (let k = Math.max(0, i - 2); k < Math.min(b.length, i + 4); k++) console.log(`  + ${b[k]}`);
  }
  for (const name of want) { changed++; console.log(`MISSING  ${name} (stored, no longer produced)`); }
  console.log(changed ? `\n${changed} snapshot(s) differ. If the change is intended: node snapshot.mjs PAGE --update, review git diff, and name each changed snapshot with its reason in the pull request.` : `${files.length} snapshots unchanged`);
}
if (errors.length) { console.log("ERRORS:", errors.length); for (const e of errors) console.log("  " + e); }
window.close();
process.exit(errors.length || changed ? 1 : 0);
