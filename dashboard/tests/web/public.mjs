// Headless check of the page's public mode: a family published as static
// exports, fetched by the browser. fetch is stubbed with a small published
// tree — nothing goes over the network:
//
//   acme/suite (root)  children: web (repository), docs (directory of suite), cli (repository, no export)
//   acme/web           parent: suite    children: plugin (repository)
//   acme/plugin        parent: web
//
// The page starts on acme/web. The family search must reach the root, the
// sibling in the root's own repository, the child, and name the one member
// without an export as not searched; Enter opens the results page; a project
// whose published .keep-the-why has no dashboard-state line says so.
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";

const W = new URL("../../ktw_dashboard/web/", import.meta.url).pathname;
const lib = fs.readFileSync(W + "lib.js", "utf8").replace(/^export /gm, "");
const app = fs.readFileSync(W + "app.js", "utf8").replace(/^import \{[^}]*\} from "\.\/lib\.js";\n/m, "");
// jsdom runs no module scripts: lib and app go into the page as one classic
// script, which jsdom runs itself (as in smoke.mjs; this file runs no code
// strings). split/join, not replace: the sources contain `$&`-like sequences.
const html = fs.readFileSync(W + "index.html", "utf8").split('<script type="module" src="/static/app.js"></script>').join("<script>" + lib + "\n" + app + "\nwindow.__fg = () => fgraph; // test hook</script>");

const GH = "https://github.com/acme";
const config = (id, lines) => `<!-- keep-the-why:config -->\n- id: ${id}\n${lines.join("\n")}\n<!-- /keep-the-why:config -->\n`;
const entry = (title, text, extra = {}) => ({ title, file: "design.md", line: 3, end_line: 9, type: ["decision"], status: "active", evidence: "confirmed", body: { text, reason: "" }, ...extra });
const SUITE_ID = "5a1e5a1e-0000-4000-8000-000000000001";
const state = (id, project, entries) => ({ generated: "2026-09-28 10:00", dashboard: "0.2.0", linter: "0.18.0.0", project: { id, name: id, context: "context/", schema: "0.18.0", ...project }, topics: [{ file: "design.md", title: "Design", entries: entries.length }], entries, authors: [], findings: { errors: 0, warnings: 0, items: [] } });
const FILES = {
  "https://raw.githubusercontent.com/acme/suite/HEAD/.keep-the-why": config("acme---suite", ["- dashboard-state: https://acme.github.io/suite/state.json"]),
  "https://acme.github.io/suite/state.json": state("acme---suite", { canonical: `${GH}/suite`, children: [{ name: "web", location: `${GH}/web`, scope: "the web UI" }, { name: "docs", location: "docs", scope: "the manual" }, { name: "cli", location: `${GH}/cli`, scope: "the command line" }] }, [entry("Release together", "Every package ships with the same needle version.", { uuid: SUITE_ID })]),
  "https://raw.githubusercontent.com/acme/suite/HEAD/docs/.keep-the-why": config("acme---suite---docs", ["- dashboard-state: https://acme.github.io/suite/docs/state.json"]),
  "https://acme.github.io/suite/docs/state.json": state("acme---suite---docs", { canonical: `${GH}/suite`, root: "docs", parent: ".." }, [entry("Docs are built in CI", "No needle in a local build.")]),
  "https://raw.githubusercontent.com/acme/web/HEAD/.keep-the-why": config("acme---web", ["- dashboard-state: https://acme.github.io/web/state.json"]),
  "https://acme.github.io/web/state.json": state("acme---web", { canonical: `${GH}/web`, parent: `${GH}/suite`, children: [{ name: "plugin", location: `${GH}/plugin`, scope: "the plugin" }] }, [entry("Server-rendered pages", "The needle is not a single-page app.")]),
  "https://raw.githubusercontent.com/acme/plugin/HEAD/.keep-the-why": config("acme---plugin", ["- dashboard-state: https://acme.github.io/plugin/state.json"]),
  "https://acme.github.io/plugin/state.json": state("acme---plugin", { canonical: `${GH}/plugin`, parent: `${GH}/web` }, [entry("Plugins load lazily", "A needle in the plugin.", { uuid: "5a1e5a1e-0000-4000-8000-000000000002", see: [{ remote: `${GH}/suite`, uuid: SUITE_ID, date: "2026-09-28" }] })]),
  "https://raw.githubusercontent.com/acme/cli/HEAD/.keep-the-why": config("acme---cli", []),
};
const fetched = [];
const stubFetch = async (url) => {
  const u = String(url); fetched.push(u);
  if (!(u in FILES)) return { ok: false, status: 404, text: async () => "404: Not Found", json: async () => { throw new Error("404"); } };
  const body = FILES[u];
  return { ok: true, status: 200, text: async () => (typeof body === "string" ? body : JSON.stringify(body)), json: async () => (typeof body === "string" ? JSON.parse(body) : structuredClone(body)) };
};

const errors = [];
const tick = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(url) {
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push("jsdom: " + (e.detail?.stack || e.message || e).toString().split("\n").slice(0, 2).join(" | ")));
  vc.on("error", (...a) => errors.push("console: " + a.join(" ")));
  const dom = new JSDOM(html, { url, runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { w.fetch = stubFetch; w.ResizeObserver = class { observe() {} disconnect() {} }; w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k === "measureText" ? () => ({ width: 10 }) : () => {}), set: () => true }); w.matchMedia = () => ({ matches: false }); w.CSS = { escape: (x) => x.replace(/([^\w-])/g, "\\$1") }; } });
  await tick(300);
  return dom.window;
}

const report = {};
{
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/web`)}#overview`);
  const d = window.document;
  if (d.getElementById("mode").hidden) errors.push("public mode: the local/public switch is hidden — no way back to local");
  // one scope switch, next to the project menu, for search and graph alike
  if (d.getElementById("scope").hidden) errors.push("public mode: the this-project/family switch is hidden");
  d.querySelector('#scope button[data-scope="family"]').click();
  const input = d.getElementById("search"); input.value = "needle"; input.dispatchEvent(new window.Event("input"));
  await tick(300);
  report.dropdown = d.querySelectorAll("#search-results a").length;
  input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await tick(50); window.dispatchEvent(new window.Event("hashchange")); await tick(300);
  report.hash = window.location.hash;
  const main = d.getElementById("main");
  report.groups = [...main.querySelectorAll(".sgroup:not(.missing) .sg-head")].map((h) => h.textContent);
  report.missing = [...main.querySelectorAll(".sgroup.missing .sr-missing")].map((m) => m.textContent);
  report.links = [...main.querySelectorAll(".sgroup .row")].map((a) => a.getAttribute("href"));
  if (report.hash !== "#search/family/needle") errors.push("Enter without a selection did not open the results page: " + report.hash);
  const want = [["acme---web", "this project"], ["github.com/acme/suite", "parent"], ["docs", "sibling"], ["plugin", "child"]];
  for (const [name, role] of want) if (!report.groups.some((g) => g.startsWith(name) && g.includes(role))) errors.push(`results page: no group for ${name} (${role})`);
  if (report.groups.length !== 4) errors.push("results page: expected 4 groups, got " + report.groups.length);
  if (!report.missing.some((m) => m.startsWith("cli") && /no dashboard-state line/.test(m))) errors.push("results page: cli (no export) not named as not searched");
  if (!report.links.some((h) => h.includes("public=https%3A%2F%2Fgithub.com%2Facme%2Fsuite&root=docs#entry/"))) errors.push("results page: the docs hit does not link to the docs export");
  window.close();
}
{
  // the family graph over the same published tree; an old #graph/family link sets the scope and lands on #graph
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/web`)}#graph/family`);
  await tick(300);
  if (window.location.hash !== "#graph") errors.push("#graph/family did not land on #graph: " + window.location.hash);
  const g = window.__fg();
  if (!g) errors.push("family graph: not built");
  else {
    const hubs = g.nodes.filter((n) => n.kind === "project").map((n) => n.label).sort();
    const fam = g.links.filter((l) => l.kind === "family").map((l) => `${g.nodes[l.s].label}>${g.nodes[l.t].label}`).sort();
    const see = g.links.filter((l) => l.kind === "see").map((l) => `${g.nodes[l.s].label}>${g.nodes[l.t].label}`);
    report.familyGraph = { hubs, fam, see, missing: g.missing.length };
    if (hubs.join() !== "acme---web,docs,github.com/acme/suite,plugin") errors.push("family graph: wrong project hubs " + hubs.join());
    if (fam.join() !== "docs>github.com/acme/suite,plugin>acme---web,acme---web>github.com/acme/suite".split(",").sort().join()) errors.push("family graph: wrong parent links " + fam.join());
    if (see.join() !== "Plugins load lazily>Release together") errors.push("family graph: the See from the plugin to the suite is missing");
    if (window.document.querySelector("#scope button.on")?.dataset.scope !== "family") errors.push("family graph: the scope switch does not show family");
    if (!/references? across projects/.test(window.document.querySelector(".graph-legend")?.textContent || "")) errors.push("family graph: no family legend");
    // back to this project: the local graph, from the same switch
    window.document.querySelector('#scope button[data-scope="project"]').click();
    await tick(100);
    if (!/topic \(size = entries\)/.test(window.document.querySelector(".graph-legend")?.textContent || "")) errors.push("scope back to this project: the graph did not switch to the local one");
  }
  window.close();
}
{
  // references to an entry from elsewhere in the family: the plugin's See to the suite's entry, seen from the suite
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/suite`)}#entry/${SUITE_ID}`);
  const d = window.document;
  if (!/switch next to the project menu/.test(d.querySelector(".refs-box")?.textContent || "")) errors.push("entry, scope this project: no hint that references from the family need the family scope");
  d.querySelector('#scope button[data-scope="family"]').click();
  await tick(300);
  report.referencedBy = d.querySelector(".refs-box")?.textContent.replace(/\s+/g, " ").slice(0, 160);
  if (!/Referenced by \(See\), elsewhere in the family\s*Plugins load lazily · plugin/.test(report.referencedBy || "")) errors.push("entry, scope family: the plugin's See is not listed as a reference: " + report.referencedBy);
  const modes = [...d.querySelectorAll("#details .mini-seg button")].map((b) => b.textContent);
  if (modes.join() !== "near,project,family") errors.push("side-pane graph in public mode: expected near,project,family, got " + modes.join());
  window.close();
}
{
  // the Family view: the whole published tree, each member under the one that lists it
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/web`)}#family`);
  await tick(300);
  const rows = [...window.document.querySelectorAll(".family .tree-row")].map((r) => [parseInt(r.style.paddingLeft || "0", 10) / 26, r.querySelector(".mr b, .mr a")?.textContent]);
  report.familyTree = rows.map(([d, n]) => `${d}:${n}`);
  const want = ["0:github.com/acme/suite", "1:acme---web", "2:plugin", "1:cli", "1:docs"]; // this project first, then its siblings by name
  if (report.familyTree.join() !== want.join()) errors.push("Family view: wrong tree " + report.familyTree.join() + " — expected " + want.join());
  window.close();
}
{
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/cli`)}#overview`);
  const text = window.document.getElementById("main").textContent;
  report.noExport = text.slice(0, 160);
  if (!/no dashboard-state line in the published \.keep-the-why \(https:\/\/raw\.githubusercontent\.com\/acme\/cli\/HEAD\/\.keep-the-why\)/.test(text)) errors.push("a project without dashboard-state: the page does not say which file lacks the line");
  window.close();
}
console.log(JSON.stringify(report, null, 1));
console.log("ERRORS:", errors.length); for (const e of errors) console.log("  " + e);
process.exit(errors.length ? 1 : 0);
