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
const html = fs.readFileSync(W + "index.html", "utf8").split('<script type="module" src="/static/app.js"></script>').join("<script>" + lib + "\n" + app + "\nwindow.__fg = () => fgraph; window.__g = () => graph; // test hooks</script>");

const GH = "https://github.com/acme";
const config = (id, lines) => `<!-- keep-the-why:config -->\n- id: ${id}\n${lines.join("\n")}\n<!-- /keep-the-why:config -->\n`;
const entry = (title, text, extra = {}) => ({ title, file: "design.md", line: 3, end_line: 9, type: ["decision"], status: "active", evidence: "confirmed", body: { text, reason: "" }, ...extra });
const SUITE_ID = "5a1e5a1e-0000-4000-8000-000000000001";
const NOTES_ID = "5a1e5a1e-0000-4000-8000-000000000003";
const FAR_ID = "5a1e5a1e-0000-4000-8000-0000000000f1", FARTHER_ID = "5a1e5a1e-0000-4000-8000-0000000000f2";
const state = (id, project, entries) => ({ generated: "2026-09-28 10:00", dashboard: "0.2.0", linter: "0.18.0.0", project: { id, name: id, context: "context/", schema: "0.18.0", ...project }, topics: [{ file: "design.md", title: "Design", entries: entries.length }], entries, authors: [], findings: { errors: 0, warnings: 0, items: [] } });
// a lean export: state.json without bodies, naming state.body.json beside it, which holds them by entry id
const lean = (base, s) => ({ [`${base}state.json`]: { ...s, entries: s.entries.map(({ body, ...e }) => e), bodies: "state.body.json" }, [`${base}state.body.json`]: JSON.stringify({ bodies: Object.fromEntries(s.entries.map((e) => [e.id, e.body])) }) });
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
  // outside the family: no parent, no children — reached only through a See
  "https://raw.githubusercontent.com/acme/notes/HEAD/.keep-the-why": config("acme---notes", ["- dashboard-state: https://acme.github.io/notes/state.json"]),
  // notes is a lean export (dashboard 0.6.0): its state.json carries no bodies and names state.body.json beside it
  ...lean("https://acme.github.io/notes/", state("acme---notes", { canonical: `${GH}/notes` }, [entry('Notes are <img src=x onerror="window.__pwned=1"> plain text', "No needle here either.", { id: "n1", uuid: NOTES_ID, see: [{ remote: `${GH}/far`, uuid: FAR_ID, date: "2026-09-29" }] }), entry("Notes are kept short", "Short.", { id: "n2", uuid: "5a1e5a1e-0000-4000-8000-000000000005" })])),
  // a chain beyond the friends: notes cites far, far cites farther — reached only by following a thought
  "https://raw.githubusercontent.com/acme/far/HEAD/.keep-the-why": config("acme---far", ["- dashboard-state: https://acme.github.io/far/state.json"]),
  "https://acme.github.io/far/state.json": state("acme---far", { canonical: `${GH}/far` }, [entry("Far away", "Cited from notes.", { uuid: FAR_ID, status: "needs-review", git: { created: { date: "2026-08-10" } }, see: [{ remote: `${GH}/farther`, uuid: FARTHER_ID, date: "2026-09-29" }] })]),
  // the registry: a list of published states, read by the globe
  "https://keepthewhy.com/registry/index.json": JSON.stringify({ checked: "2026-10-01", projects: [{ canonical: `${GH}/farther`, state: "https://acme.github.io/farther/state.json", id: "acme---farther", entries: 1 }, { canonical: `${GH}/gone`, state: "https://acme.github.io/gone/state.json", id: "acme---gone", entries: 3, error: "HTTP Error 404", failed_since: "2026-09-30" }, { canonical: `${GH}/refs`, state: "https://acme.github.io/refs/state.json", id: "acme---refs", entries: 1 }] }),
  "https://raw.githubusercontent.com/acme/farther/HEAD/.keep-the-why": config("acme---farther", ["- dashboard-state: https://acme.github.io/farther/state.json"]),
  "https://acme.github.io/farther/state.json": state("acme---farther", { canonical: `${GH}/farther` }, [entry("The origin", "Where it started.", { uuid: FARTHER_ID, evidence: "inferred", git: { created: { date: "2026-08-01" } } })]),
  // an export that claims to be another repository's
  "https://raw.githubusercontent.com/acme/impostor/HEAD/.keep-the-why": config("acme---impostor", ["- dashboard-state: https://acme.github.io/impostor/state.json"]),
  "https://acme.github.io/impostor/state.json": state("acme---impostor", { canonical: `${GH}/suite` }, [entry("Release together", "A copy.", { uuid: NOTES_ID })]),
  // outside the family too: one entry citing entries in five other places
  "https://raw.githubusercontent.com/acme/refs/HEAD/.keep-the-why": config("acme---refs", ["- dashboard-state: https://acme.github.io/refs/state.json"]),
  "https://acme.github.io/refs/state.json": state("acme---refs", { canonical: `${GH}/refs` }, [entry("Cites elsewhere", "References only.", { uuid: "5a1e5a1e-0000-4000-8000-000000000004", git: { created: { date: "2026-09-20" } }, see: [
    { remote: `${GH}/suite`, uuid: SUITE_ID, date: "2026-09-29" },
    { remote: `${GH}/notes`, uuid: NOTES_ID, date: "2026-09-29" },
    { remote: `${GH}/notes`, uuid: "5a1e5a1e-0000-4000-8000-00000000dead", date: "2026-09-29" },
    { remote: `${GH}/cli`, uuid: NOTES_ID, date: "2026-09-29" },
    { remote: `${GH}/impostor`, uuid: NOTES_ID, date: "2026-09-29" },
  ] })]),
};
const fetched = [];
const stubFetch = async (url) => {
  const u = String(url); fetched.push(u);
  if (!(u in FILES)) return { ok: false, status: 404, text: async () => "404: Not Found", json: async () => { throw new Error("404"); } };
  const body = FILES[u];
  return { ok: true, status: 200, text: async () => (typeof body === "string" ? body : JSON.stringify(body)), json: async () => (typeof body === "string" ? JSON.parse(body) : structuredClone(body)) };
};

const errors = [];
const navigations = []; // jsdom does not navigate: a location.href to another page is reported, not followed
const tick = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(url, page = html, store = {}) {
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => /^Not implemented: navigation/.test(e.message || "") ? navigations.push(e.message) : errors.push("jsdom: " + (e.detail?.stack || e.message || e).toString().split("\n").slice(0, 2).join(" | ")));
  vc.on("error", (...a) => errors.push("console: " + a.join(" ")));
  const dom = new JSDOM(page, { url, runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { for (const [k, v] of Object.entries(store)) w.localStorage.setItem(k, v); w.fetch = stubFetch; w.ResizeObserver = class { observe() {} disconnect() {} }; w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k === "measureText" ? () => ({ width: 10 }) : () => {}), set: () => true }); w.matchMedia = () => ({ matches: false }); w.CSS = { escape: (x) => x.replace(/([^\w-])/g, "\\$1") }; } });
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
    // the scope switch merges search, queues and counts; the graph has its own family setting — back to the
    // project graph by the family's "all their entries", the scope untouched
    window.document.querySelector('#scope button[data-scope="project"]').click();
    await tick(100);
    if (!window.__fg?.() || !/references? across projects/.test(window.document.querySelector(".graph-legend")?.textContent || "")) errors.push("scope back to this project: the graph changed with the scope, though it has its own family setting");
    const famAll = window.document.querySelector(".graph-ui .family-ctl .friend-entries input");
    famAll.checked = false; famAll.dispatchEvent(new window.Event("change")); await tick(200);
    if (!/topic \(size = entries\)/.test(window.document.querySelector(".graph-legend")?.textContent || "")) errors.push("family 'all their entries' off: the graph did not switch to the project graph");
    // the legend is the family's tree: suite ▸ web (this project) ▸ plugin, suite ▸ docs — children indented under their parent
    const famLegend = [...window.document.querySelectorAll(".graph-legend .family")].map((s) => `${(parseInt(s.style.paddingLeft || "0", 10) / 14)}:${s.textContent.trim()}`);
    if (famLegend.join() !== "0:github.com/acme/suite,1:acme---web,2:plugin,1:docs") errors.push("family 'all their entries' off: the legend is not the family's tree: " + famLegend.join());
    const pg = window.__g();
    if (!pg.nodes.some((n) => n.kind === "project" && n.self)) errors.push("family beside the project: the project has no hub of its own");
    if (!pg.links.some((l) => l.kind === "family" && (pg.nodes[l.s].self || pg.nodes[l.t].self))) errors.push("family beside the project: no parent or child line joins the project's hub");
    const famColours = new Set(pg.nodes.filter((n) => n.kind === "project" && n.ext).map((n) => n.color));
    if (famColours.size < 2) errors.push("family beside the project: the members share one colour");
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
  // with the family merged, the plugin's entry is part of what is shown: a reference like any other, named by its project
  if (!/Referenced by \(See\)\s*Plugins load lazily · plugin · Design/.test(report.referencedBy || "")) errors.push("entry, scope family: the plugin's See is not listed as a reference: " + report.referencedBy);
  const modes = [...d.querySelectorAll("#details .mini-seg:not(.mini-friends):not(.mini-width) button")].map((b) => b.textContent);
  if (modes.join() !== "near,project,family") errors.push("side-pane graph in public mode: expected near,project,family, got " + modes.join());
  // on a page without an entry the side pane's graph follows the graph's own family setting, not the scope:
  // the scope merges search, queues and counts; "family entries" is on by default, so the graph is the family
  // graph, whole — off, the family stands beside the project with the entries linked here
  window.location.hash = "#overview"; window.dispatchEvent(new window.Event("hashchange")); await tick(300);
  report.miniOnOverview = d.querySelector("#details .mini-seg:not(.mini-friends):not(.mini-width) button.on")?.textContent;
  if (report.miniOnOverview !== "family") errors.push("overview: the side-pane graph shows " + report.miniOnOverview + ", not the family graph that 'family entries' (on by default) asks for");
  window.location.hash = "#graph"; window.dispatchEvent(new window.Event("hashchange")); await tick(300);
  const famAll = d.querySelector(".graph-ui .family-ctl .friend-entries input");
  if (!famAll || !famAll.checked) errors.push("graph: the family's 'family entries' is missing or off by default");
  if (!window.__fg?.()) errors.push("graph: 'family entries' on did not build the family graph");
  famAll.checked = false; famAll.dispatchEvent(new window.Event("change")); await tick(400);
  if (!window.__g?.()?.nodes.some((n) => n.family)) errors.push("graph: 'family entries' off did not put the family beside the project graph");
  famAll.checked = true; famAll.dispatchEvent(new window.Event("change")); await tick(400);
  if (!d.querySelector(".graph-ui .family-ctl .friend-entries input")?.checked) errors.push("family graph: 'family entries' is not shown as on");
  window.location.hash = "#overview"; window.dispatchEvent(new window.Event("hashchange")); await tick(300);
  const fg = window.__fg?.();
  if (fg && fg.showEntries !== true) errors.push("family graph: entries are not shown by default");
  window.close();
}
{
  // the family scope merges every view: the strip counts, the sidebar, the overview
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/web`)}#overview`);
  const d = window.document;
  const entries = () => [...d.querySelectorAll("#strip a.stat")][0]?.textContent;
  report.mergedBefore = entries();
  d.querySelector('#scope button[data-scope="family"]').click();
  await tick(300);
  report.mergedAfter = entries();
  report.mergedSidebar = [...d.querySelectorAll(".tree .tree-project")].map((x) => x.textContent);
  if (report.mergedBefore !== "1entries" || report.mergedAfter !== "4entries") errors.push(`family scope: strip should go from 1 to 4 entries, got ${report.mergedBefore} → ${report.mergedAfter}`);
  if (report.mergedSidebar.length !== 4) errors.push("family scope: the sidebar has no heading per project: " + report.mergedSidebar.join());
  if (!d.querySelector("#main .family-banner")) errors.push("family scope: no family banner on the overview");
  window.close();
}
{
  // a static export of a family member, as a docs site serves it: no local/public switch, the family scope right there,
  // and the family merged from the members' published exports. The graph beside the overview draws the family as
  // neighbours, so the members' exports are fetched with it (0.4.3) — those, and nothing from any other host
  const embedded = JSON.stringify({ ...FILES["https://acme.github.io/web/state.json"], exported: true }).replace(/</g, "\\u003c");
  const page = html.replace("<script>", `<script>window.__KTW_STATE__ = ${embedded};</script><script>`);
  const before = fetched.length;
  const window = await open("http://localhost/web/keep-the-why-dashboard/#overview", page);
  const d = window.document;
  const got = fetched.slice(before);
  report.staticFetchedBefore = got.length;
  report.staticMode = d.getElementById("mode").hidden ? "hidden" : "shown";
  report.staticScope = d.getElementById("scope").hidden ? "hidden" : "shown";
  const familyHosts = /^https:\/\/(raw\.githubusercontent\.com\/acme\/(suite|plugin|cli)\/|acme\.github\.io\/(suite|plugin|cli)\/)/;
  const stray = got.filter((u) => !familyHosts.test(u));
  if (stray.length) errors.push(`static export, scope this project: fetched beyond the family's members — ${stray.join(", ")}`);
  if (!got.some((u) => /acme\.github\.io\/suite\/state\.json/.test(u))) errors.push("static export, scope this project: the family was not loaded for the graph beside the overview");
  // the family graph is the default ("family entries" on); the lean form, the family beside the project, with it off
  window.localStorage.setItem("ktw-family-entries", "linked");
  window.location.hash = "#graph"; window.dispatchEvent(new window.Event("hashchange")); await tick(300);
  const fe0 = d.querySelector(".graph-ui .family-ctl .friend-entries input"); fe0.checked = false; fe0.dispatchEvent(new window.Event("change")); await tick(400);
  const famHubs = (window.__g?.()?.nodes || []).filter((n) => n.family).map((n) => n.label).sort();
  report.staticFamilyHubs = famHubs;
  if (!famHubs.length) errors.push("static export, 'family entries' off: no family hubs beside the project graph");
  window.location.hash = "#graph"; window.dispatchEvent(new window.Event("hashchange")); await tick(300);
  if (!d.querySelector(".graph-ui .family-toggle input")?.checked) errors.push("static export: no family switch in the graph view, or it is off");
  if (!d.querySelector(".graph-ui .family-ctl .friend-entries input")) errors.push("static export: the family group has no 'all their entries' in the graph view");
  window.location.hash = "#overview"; window.dispatchEvent(new window.Event("hashchange")); await tick(300);
  if (report.staticMode !== "hidden") errors.push("static export: a local/public switch is shown");
  if (report.staticScope !== "shown") errors.push("static export of a family member: no this-project/family switch");
  d.querySelector('#scope button[data-scope="family"]').click();
  await tick(300);
  report.staticMerged = [...d.querySelectorAll("#strip a.stat")][0]?.textContent;
  if (report.staticMerged !== "4entries") errors.push("static export, family scope: the family is not merged — " + report.staticMerged);
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
{
  // references into other repositories — family or not — are resolved when the entry is shown: the row carries the
  // target's title and links into its export; what cannot be resolved says why, and foreign text stays text
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/refs`)}#entry/5a1e5a1e-0000-4000-8000-000000000004`);
  await tick(300);
  const d = window.document;
  const rows = [...d.querySelectorAll(".refs-box .ref")];
  report.remoteRows = rows.map((r) => r.textContent.replace(/\s+/g, " "));
  const link = (i) => rows[i]?.querySelector("a")?.getAttribute("href") || "";
  if (!/^Release together · acme\/suite · active · confirmed/.test(report.remoteRows[0] || "")) errors.push("remote See, resolved: no title and state from the target: " + report.remoteRows[0]);
  if (!link(0).includes(`public=${encodeURIComponent(`${GH}/suite`)}#entry/${SUITE_ID}`)) errors.push("remote See, resolved: the row does not link into the target's export: " + link(0));
  if (d.querySelector(".refs-box img") || window.__pwned) errors.push("remote See: a foreign title was rendered as HTML");
  if (!/^Notes are <img/.test(report.remoteRows[1] || "")) errors.push("remote See: the foreign title is not shown as text: " + report.remoteRows[1]);
  if (!/not resolved: its published export .* has no entry with this Id/.test(report.remoteRows[2] || "")) errors.push("remote See, unknown Id: no reason: " + report.remoteRows[2]);
  if (!/not resolved: no dashboard-state line/.test(report.remoteRows[3] || "")) errors.push("remote See, target without export: no reason: " + report.remoteRows[3]);
  if (!/not resolved: the export at .* belongs to https:\/\/github\.com\/acme\/suite/.test(report.remoteRows[4] || "")) errors.push("remote See, export claiming another repository: shown anyway: " + report.remoteRows[4]);
  // one lookup per target: notes' export fetched once for two references
  if (fetched.filter((u) => u === "https://acme.github.io/notes/state.json").length !== 1) errors.push("remote See: the same export was fetched more than once");
  // the #ref route (a shared link) resolves the same way and goes there
  const nav = navigations.length;
  window.location.hash = `#ref/${encodeURIComponent(`${GH}/notes`)}/${NOTES_ID}`; window.dispatchEvent(new window.Event("hashchange")); await tick(300);
  if (navigations.length <= nav) errors.push("#ref route: the page did not go to the entry in the target's export");
  window.location.hash = `#ref/${encodeURIComponent(`${GH}/cli`)}/${NOTES_ID}`; window.dispatchEvent(new window.Event("hashchange")); await tick(300);
  if (!/Cannot open .* no dashboard-state line/.test(d.getElementById("main").textContent)) errors.push("#ref route, target without export: the reason is not shown");
  window.close();
}
{
  // friends: the repositories an entry cites outside the family — nothing fetched before the click, then
  // linked into the graph (the cited entries only, all of them once a hub is expanded), never merged
  const before = fetched.length;
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/refs`)}#graph`, html, { "ktw-friends": "off" });
  await tick(200);
  const d = window.document;
  let btn = d.querySelector(".graph-ui .friends-load");
  report.friendsButton = btn?.textContent;
  if (btn?.textContent !== "friends (4)") errors.push("friends: no 'friends (4)' button in the graph: " + btn?.textContent);
  const mini = () => d.querySelector("#details .mini-friends button");
  const to = async (h) => { window.location.hash = h; window.dispatchEvent(new window.Event("hashchange")); await tick(150); };
  if (!/friend — a repository cited outside the family/.test(d.getElementById("details").textContent)) errors.push("friends: not in the graph page's legend");
  await to("#overview");
  d.querySelector("#details .mini-gear")?.click(); await tick(50);
  if (!/friends \(4\)/.test(d.querySelector("#details .mini-filters")?.textContent || "")) errors.push("friends: no 'friends (4)' in the side pane graph's switches: " + d.querySelector("#details .mini-filters")?.textContent);
  if (mini()) errors.push("friends: the side pane's project graph still has the friends button beside the gear");
  await to("#graph");
  const early = fetched.slice(before).filter((u) => /acme\/(notes|suite|cli|impostor)|acme\.github\.io\/(notes|suite|impostor)/.test(u));
  if (early.length) errors.push("friends: fetched before the click: " + early.join(", "));
  btn = d.querySelector(".graph-ui .friends-load"); btn?.click(); await tick(400);
  const legend = d.querySelector(".graph-legend")?.textContent || "";
  report.friendsLegend = legend;
  for (const name of ["acme/notes", "acme/suite"]) if (![...d.querySelectorAll(".graph-legend .friend a")].some((x) => x.textContent === name)) errors.push(`friends: ${name} not in the legend`);
  // the walk stays in the graph: a friend's name opens that project's graph
  const notesLink = [...d.querySelectorAll(".graph-legend .friend a")].find((a) => a.textContent === "acme/notes")?.getAttribute("href") || "";
  if (!notesLink.endsWith(`?public=${encodeURIComponent(`${GH}/notes`)}#graph`)) errors.push("friends: the legend link does not open the friend's graph: " + notesLink);
  await to("#overview");
  if (!d.querySelector("#details .mini-filters .friends-ctl input")?.checked) errors.push("friends: the side pane graph's switches do not show the friends as on");
  await to("#graph");
  for (const name of ["acme/cli not loaded", "acme/impostor not loaded"]) if (!legend.includes(name)) errors.push(`friends: '${name}' missing from the legend`);
  // the graph's own control says it too, and leads to the Friends view, which names the reason
  const failedLink = d.querySelector(".friends-ctl .friends-failed");
  if (!failedLink) errors.push("friends: the graph control does not say that two friends could not be loaded");
  else if (!/^2 of \d+ not loaded/.test(failedLink.textContent) || failedLink.getAttribute("href") !== "#friends" || !/impostor/.test(failedLink.title)) errors.push(`friends: the not-loaded link reads wrong: '${failedLink.textContent}' → ${failedLink.getAttribute("href")} (${failedLink.title})`);
  const g = window.__g();
  const hubs = g.nodes.filter((n) => n.kind === "project" && n.friend).map((n) => n.label).sort();
  const see = g.links.filter((l) => l.kind === "see").map((l) => `${g.nodes[l.s].label}>${g.nodes[l.t].label.slice(0, 16)}`).sort();
  report.friendsGraph = { hubs, see };
  // a friend in a family comes as the whole family, one unit like a repository (cli has no export)
  if (hubs.join() !== "acme/notes,acme/suite,docs,plugin,web") errors.push("friends: wrong friend hubs " + hubs.join());
  const fam = g.links.filter((l) => l.kind === "family").map((l) => `${g.nodes[l.s].label}>${g.nodes[l.t].label}`).sort().join();
  if (fam !== "docs>acme/suite,plugin>web,web>acme/suite") errors.push("friends: the family's own parent lines are missing: " + fam);
  // the plugin's See to the suite comes along: a unit shows what its citation chains connect to the cited entries
  if (see.join() !== "Cites elsewhere>Notes are <img s,Cites elsewhere>Release together,Plugins load lazily>Release together") errors.push("friends: See lines to the friends missing: " + see.join());
  const notesEntries = () => window.__g().nodes.filter((n) => n.kind === "entry" && n.ext && n.proj === "acme/notes").length;
  // friends entries is on by default: the friend comes whole; off, a hub shows the cited entries, and a click on it expands it again
  if (notesEntries() !== 2) errors.push("friends: a friend should come whole by default, got " + notesEntries());
  if (!/^1 entries/.test(d.getElementById("counts")?.textContent || "1 entries")) errors.push("friends: merged into the counts: " + d.getElementById("counts")?.textContent);
  const fe = d.querySelector(".graph-ui .friends-ctl .friend-entries input"); fe.checked = false; fe.dispatchEvent(new window.Event("change")); await tick(150);
  if (notesEntries() !== 1) errors.push("friends entries off: a hub should show only the cited entries, got " + notesEntries());
  fe.checked = true; fe.dispatchEvent(new window.Event("change")); await tick(150);
  // a click on a hub's circle does what its name does: goes there, in place; the own hub does nothing
  const gg = window.__g(); const cv = d.querySelector("#main .graph-wrap canvas");
  const at = (n) => ({ clientX: n.x * gg.scale + gg.ox, clientY: n.y * gg.scale + gg.oy });
  const clickNode = async (n) => { cv.dispatchEvent(new window.MouseEvent("mousedown", { ...at(n), bubbles: true })); window.dispatchEvent(new window.MouseEvent("mouseup", at(n))); await tick(300); };
  const own = gg.nodes.find((n) => n.kind === "project" && n.self);
  if (own) { const h = window.location.hash; await clickNode(own); if (window.location.hash !== h || !/acme---refs/.test(d.title)) errors.push("hub click: the own hub moved the page: " + window.location.hash + " " + d.title); }
  await clickNode(gg.nodes.find((n) => n.friend && n.label === "acme/notes"));
  if (window.location.search !== `?public=${encodeURIComponent(`${GH}/notes`)}` || !/acme---notes/.test(d.title)) errors.push("hub click: a click on the friend's circle did not go there: " + window.location.search + " " + d.title);
  window.close();
}
{
  // friends from an entry's neighbourhood: the side pane's control switches to the project level and loads them there
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/refs`)}#entry/5a1e5a1e-0000-4000-8000-000000000004`, html, { "ktw-friends": "off" });
  await tick(200);
  const d = window.document;
  const b = d.querySelector("#details .mini-friends button");
  report.nearFriends = b?.textContent;
  if (b?.textContent !== "friends (4)") errors.push("friends, near: no 'friends (4)' on the neighbourhood graph: " + b?.textContent);
  b?.click(); await tick(400);
  const mode = d.querySelector("#details .mini-seg:not(.mini-friends):not(.mini-width) button.on")?.textContent;
  if (mode !== "project") errors.push("friends, near: did not switch to the project level: " + mode);
  if (!d.querySelector("#details .mini-filters .friends-ctl input")?.checked) errors.push("friends, near: the friends were not loaded at the project level");
  window.close();
}
{
  // the path: a walk to a friend changes the centre in place (no page load), the page keeps where it came from,
  // back returns along it, and a discarded path is gone
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/refs`)}#graph`);
  await tick(200);
  const d = window.document;
  await tick(400); // friends load with the graph, by default
  const navBefore = navigations.length;
  [...d.querySelectorAll(".graph-legend .friend a")].find((a) => a.textContent === "acme/notes")?.click(); await tick(300);
  report.pathWalk = { search: window.location.search, hash: window.location.hash, bar: d.querySelector(".path-bar")?.textContent.replace(/\s+/g, " ") };
  if (navigations.length !== navBefore) errors.push("path: the walk to a friend loaded a page instead of moving in place");
  if (window.location.search !== `?public=${encodeURIComponent(`${GH}/notes`)}` || window.location.hash !== "#graph") errors.push("path: the address is not the friend's graph: " + window.location.search + window.location.hash);
  if (!/1 · acme---refs › acme---notes/.test(report.pathWalk.bar || "")) errors.push("path: no path bar 'refs › notes': " + report.pathWalk.bar);
  const g = window.__g();
  const trailHub = g?.nodes.find((n) => n.trail);
  if (trailHub?.label !== "1 · acme---refs") errors.push("path: the project walked from is not a hub in the graph: " + trailHub?.label);
  if (!/the path — the way you walked here, not a citation/.test(d.querySelector(".graph-legend")?.textContent || "")) errors.push("path: the legend does not explain the path's line");
  if (!g?.links.some((l) => l.kind === "see" && g.nodes[l.s].label === "Cites elsewhere")) errors.push("path: the See from the path's project to this one is not drawn");
  if (!/acme---notes/.test(d.title)) errors.push("path: the page did not switch to the friend: " + d.title);
  // back along the path: in place, and the path shortens
  window.history.back(); await tick(300);
  if (!/acme---refs/.test(d.title) || window.location.search !== `?public=${encodeURIComponent(`${GH}/refs`)}`) errors.push("path: back did not return to the project walked from: " + d.title + " " + window.location.search);
  if (d.querySelector(".path-bar")) errors.push("path: back at the start, a path bar is still shown");
  if (navigations.length !== navBefore) errors.push("path: back loaded a page instead of moving in place");
  // forward again, then discard
  window.history.forward(); await tick(300);
  if (!/acme---notes/.test(d.title)) errors.push("path: forward did not return to the friend: " + d.title);
  window.location.hash = "#overview"; window.dispatchEvent(new window.Event("hashchange")); await tick(150);
  if (!d.querySelector("#main .path-bar")) errors.push("path: no path bar above the overview");
  [...d.querySelectorAll("#main .path-bar button")].find((b) => b.textContent === "discard")?.click(); await tick(100);
  if (d.querySelector(".path-bar")) errors.push("path: discard did not clear the path");
  window.close();
}
{
  // by default friends load as soon as a graph shows them; unchecking *friends* turns that off for this browser
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/refs`)}#graph`);
  await tick(500);
  const d = window.document;
  const hubs = () => window.__g().nodes.filter((n) => n.friend).map((n) => n.label).sort().join();
  if (hubs() !== "acme/notes,acme/suite,docs,plugin,web") errors.push("friends by default: not loaded with the graph: " + hubs());
  report.friendsDefault = { hubs: hubs(), ui: d.querySelector(".graph-ui")?.textContent, legend: d.querySelector(".graph-legend")?.textContent };
  const box = d.querySelector(".graph-ui .friends-toggle input");
  if (!box) { errors.push("friends by default: no friends box: " + JSON.stringify(report.friendsDefault)); window.close(); }
  else {
  if (!box?.checked) errors.push("friends by default: no checked 'friends' box");
  box.checked = false; box.dispatchEvent(new window.Event("change")); await tick(150);
  if (hubs()) errors.push("friends unchecked: still drawn: " + hubs());
  if (window.localStorage.getItem("ktw-friends") !== "off") errors.push("friends unchecked: not kept for this browser");
  if (d.querySelector(".graph-ui .friends-load")?.textContent !== "friends (4)") errors.push("friends unchecked: no 'friends (4)' to load them again");
  // the reset button is the last of the controls
  const last = [...d.querySelector(".graph-ui").children].pop();
  if (last?.textContent !== "reset") errors.push("graph controls: reset is not the last one: " + last?.textContent);
  window.close();
  }
}
{
  // a chain that goes on beyond the page: marked, and followed hop by hop on a click — only the repositories on it
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/refs`)}#graph`);
  await tick(600);
  const d = window.document;
  const before = fetched.length;
  const follow = [...d.querySelectorAll("#thoughts .thought.open .thought-follow")].map((b) => b.textContent);
  report.chainOpen = follow;
  if (!follow.some((t) => t === "continues ↗ acme/far")) errors.push("chains: the chain into acme/far is not marked as going on: " + follow.join(" | "));
  if (fetched.slice(before).some((u) => /acme\/far|acme\.github\.io\/far/.test(u))) errors.push("chains: acme/far was fetched before the click");
  d.querySelector("#thoughts .thought-follow-all")?.click(); await tick(1500);
  const g = window.__g();
  const chainHubs = g.nodes.filter((n) => n.chain).map((n) => n.label).sort().join();
  const heads = [...d.querySelectorAll("#thoughts .thought:not(.open) .thought-head")].map((h) => h.textContent);
  report.chainFollowed = { chainHubs, heads, open: d.querySelectorAll("#thoughts .thought.open").length, fetched: fetched.slice(before).filter((u) => /state\.json$/.test(u)) };
  if (chainHubs !== "acme/far,acme/farther") errors.push("chains: the repositories on the chain are not drawn: " + chainHubs);
  if (!heads.some((h) => /^4The origin/.test(h))) errors.push("chains: after following, no thought of four from the origin: " + heads.join(" | "));
  if (report.chainFollowed.open) errors.push("chains: still going on after following it to its end");
  if (!/via a thought/.test(d.querySelector(".graph-legend")?.textContent || "")) errors.push("chains: the legend does not say the repositories came via a thought");
  // what it rests on: an origin nobody confirmed, a step in question and what builds on it
  const pills = [...d.querySelectorAll("#thoughts .thought:not(.open) .warn-pill")].map((p) => p.textContent);
  if (!pills.includes("starts inferred") || !pills.includes("step in question")) errors.push("insights: the thought is not marked (starts inferred, step in question): " + pills.join());
  window.location.hash = "#thoughts"; window.dispatchEvent(new window.Event("hashchange")); await tick(500);
  const page = d.getElementById("main").textContent;
  report.insightsPage = [...d.querySelectorAll("#main .stat")].map((x) => x.textContent);
  if (!/Starting from an unconfirmed entry/.test(page) || !/Evidence inferred · 1 thought start here/.test(page)) errors.push("insights page: the unconfirmed first entry is not listed");
  if (!/Chains through a step in question/.test(page) || !/needs-review · 2 later entries linked after it, in 2 projects/.test(page)) errors.push("insights page: the step in question and what is linked after it are not listed: " + (page.match(/Chains through a step in question.{0,300}/) || [""])[0]);
  const read = d.querySelector("#main .thought-row a")?.getAttribute("href");
  window.location.hash = read; window.dispatchEvent(new window.Event("hashchange")); await tick(300);
  const view = d.getElementById("main").textContent;
  if (!/first entry's Evidence is inferred/.test(view)) errors.push("reader: no note on the unconfirmed first entry");
  if (!/In question — needs-review\. 2 later steps are linked after it/.test(view)) errors.push("reader: no note on the step in question");
  if (!/2026-08-01 → 2026-09-20 · grew over 50 days/.test(view)) errors.push("reader: no timeline of the steps' days: " + (d.querySelector(".thought-timeline")?.textContent || "none"));
  window.close();
}
{
  // the reader: a thought that goes on before its origin says where, and follows it on a click
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/refs`)}#thought/${NOTES_ID},5a1e5a1e-0000-4000-8000-000000000004`);
  await tick(600);
  const d = window.document;
  const beyond = d.querySelector(".thought-beyond")?.textContent || "";
  if (!/Before its origin, it goes on in acme\/far/.test(beyond)) errors.push("thought view: no note that the chain goes on in acme/far: " + beyond);
  d.querySelector(".thought-beyond button")?.click(); await tick(1500);
  report.chainView = window.location.hash;
  if (!window.location.hash.startsWith(`#thought/${FARTHER_ID},${FAR_ID},${NOTES_ID},`)) errors.push("thought view: following did not lead to the whole chain: " + window.location.hash);
  window.close();
}
{
  // friends entries: every entry of every friend, on by default; off leaves the entries that link here
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/refs`)}#graph`);
  await tick(600);
  const d = window.document;
  const notes = () => window.__g().nodes.filter((n) => n.kind === "entry" && n.ext && n.proj === "acme/notes").length;
  const box = d.querySelector(".graph-ui .friends-ctl .friend-entries input");
  if (!box || !box.checked) errors.push("friend entries: no switch in the friends group, or off by default");
  const whole = notes();
  box.checked = false; box.dispatchEvent(new window.Event("change")); await tick(150);
  if (!(notes() < whole)) errors.push(`friend entries: switching off did not reduce notes to the linked ones (${whole} → ${notes()})`);
  if (window.localStorage.getItem("ktw-friend-entries") !== "linked") errors.push("friend entries: not kept for this browser");
  box.checked = true; box.dispatchEvent(new window.Event("change")); await tick(150);
  // the state monitor: one line per project — the lean friend says so, its bodies not loaded yet, a link to its dashboard
  d.querySelector("#loaded > a").click(); await tick(50);
  const monRows = [...d.querySelectorAll(".loaded-pop .loaded-row")].map((r) => r.textContent.replace(/\s+/g, " "));
  report.monitor = monRows;
  const notesRow = [...d.querySelectorAll(".loaded-pop .loaded-row")].find((r) => /acme---notes/.test(r.textContent));
  if (!notesRow || !/lean, bodies beside it/.test(notesRow.textContent) || !/bodies not loaded/.test(notesRow.textContent)) errors.push("monitor: the lean friend's row does not say lean / bodies not loaded: " + notesRow?.textContent);
  if (notesRow?.querySelector("a.dash")?.getAttribute("href") !== "https://acme.github.io/notes/") errors.push("monitor: no dashboard link for notes: " + notesRow?.querySelector("a.dash")?.getAttribute("href"));
  if (!/\.keep-the-why/.test(notesRow?.textContent || "")) errors.push("monitor: notes' .keep-the-why is not on its row");
  if (!/this page/.test(monRows[0] || "")) errors.push("monitor: the first row is not this page's own: " + monRows[0]);
  d.querySelector("#loaded > a").click(); await tick(50);
  // friends families: a friend's family beside it, on by default; off leaves the cited repository alone
  const famSwitch = d.querySelector(".graph-ui .friends-ctl .friend-families input");
  if (!famSwitch || !famSwitch.checked) errors.push("friends families: no switch, or off by default");
  const suiteHubs = () => window.__g().nodes.filter((n) => n.kind === "project" && n.friend && /acme\/suite|acme---web|plugin|docs/.test(n.label)).length;
  const withFamilies = suiteHubs();
  if (!d.querySelector(".graph-ui .friends-ctl .friend-entries + .friend-families, .graph-ui .friends-ctl .friend-families")) errors.push("friends families: the switch is not in the friends group");
  if (![...d.querySelectorAll(".graph-ui .friends-ctl label")].some((l) => l.textContent === "friends families entries")) errors.push("friends families: no 'friends families entries'");
  if (![...d.querySelectorAll(".graph-ui .friends-ctl label")].some((l) => l.textContent === "friends families labels")) errors.push("friends families: no 'friends families labels'");
  famSwitch.checked = false; famSwitch.dispatchEvent(new window.Event("change")); await tick(200);
  if (!(suiteHubs() < withFamilies) || suiteHubs() !== 1) errors.push(`friends families off: the family is still beside the friend (${withFamilies} → ${suiteHubs()} hubs)`);
  if (!/family of 4, not shown/.test(d.querySelector(".graph-legend")?.textContent || "")) errors.push("friends families off: the legend does not say the family is not shown");
  if ([...d.querySelectorAll(".graph-ui .friends-ctl label")].some((l) => l.textContent === "friends families entries")) errors.push("friends families off: 'friends families entries' is still offered");
  famSwitch.checked = true; famSwitch.dispatchEvent(new window.Event("change")); await tick(200);
  // the Friends page: a card per friend, what cites what
  window.location.hash = "#friends"; window.dispatchEvent(new window.Event("hashchange")); await tick(400);
  const cards = [...d.querySelectorAll(".friend-card h2")].map((h) => h.textContent);
  report.friendsPage = cards;
  if (!cards.some((c) => c.startsWith("acme/notes")) || !cards.some((c) => c.startsWith("acme/suite"))) errors.push("friends page: no card for notes and suite: " + cards.join(" | "));
  if (!/A family of 4/.test(d.querySelector("#main").textContent)) errors.push("friends page: the suite's family is not named");
  if (!/Cited from here \(1\)/.test(d.querySelector("#main").textContent)) errors.push("friends page: what this project cites there is not listed");
  if (!/Not loaded/.test(d.querySelector("#main").textContent)) errors.push("friends page: the friends that could not be loaded are not listed");
  // the Thoughts page: numbers, and every thought
  window.location.hash = "#thoughts"; window.dispatchEvent(new window.Event("hashchange")); await tick(400);
  const main = d.querySelector("#main");
  report.thoughtsPage = [...main.querySelectorAll(".stat")].map((x) => x.textContent);
  if (!main.querySelector(".stats") || !/Going on beyond this page/.test(main.textContent)) errors.push("thoughts page: no numbers, or no chains going on beyond");
  const r = main.querySelector(".thought-row"); r?.dispatchEvent(new window.Event("mouseenter")); r?.dispatchEvent(new window.Event("mouseleave"));
  // pointing at a step marks it in the graph beside (no error while doing so)
  main.querySelector(".backlink, .thought-row a") && [...main.querySelectorAll(".backlink")].slice(0, 1).forEach((a) => { a.dispatchEvent(new window.Event("mouseenter")); a.dispatchEvent(new window.Event("mouseleave")); });
  window.close();
}
{
  // the side pane's width, from the top of the pane: kept per browser
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/refs`)}#overview`);
  await tick(300);
  const d = window.document;
  const btns = [...d.querySelectorAll("#details .mini-width button")].map((b) => b.textContent);
  if (btns.join() !== "1×,2×,3×,½") errors.push("side width: no 1×/2×/3×/½ control at the top of the side pane: " + btns.join());
  if (!d.querySelector("#details > .pane-width:first-child")) errors.push("side width: the control is not the first thing in the pane");
  if (d.querySelector("#details .mini .mini-width")) errors.push("side width: the control is still inside the graph");
  [...d.querySelectorAll("#details .mini-width button")].find((b) => b.textContent === "½")?.click(); await tick(50);
  if (d.getElementById("app").dataset.side !== "half" || window.localStorage.getItem("ktw-side-graph") !== "half") errors.push("side width: ½ did not take or was not kept");
  // an entry's details have a width of their own: the graph's ½ does not follow there, and 2× there does not come back
  window.location.hash = "#entry/5a1e5a1e-0000-4000-8000-000000000004"; window.dispatchEvent(new window.Event("hashchange")); await tick(200);
  if (d.getElementById("app").dataset.side !== "2") errors.push("side width: the graph's width followed into an entry's details (default 2×): " + d.getElementById("app").dataset.side);
  [...d.querySelectorAll("#details .mini-width button")].find((b) => b.textContent === "3×")?.click(); await tick(50);
  window.location.hash = "#graph"; window.dispatchEvent(new window.Event("hashchange")); await tick(200);
  if (d.getElementById("app").dataset.side !== "3") errors.push("side width: the graph view does not share the details' width: " + d.getElementById("app").dataset.side);
  window.location.hash = "#overview"; window.dispatchEvent(new window.Event("hashchange")); await tick(200);
  if (d.getElementById("app").dataset.side !== "half") errors.push("side width: back on the overview, the graph's width is gone: " + d.getElementById("app").dataset.side);
  window.close();
}
{
  // from the side pane's graph to the full one in one click, centred on the entry it showed
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/refs`)}#entry/5a1e5a1e-0000-4000-8000-000000000004`);
  await tick(300);
  const d = window.document;
  const b = d.querySelector("#details .mini-open");
  if (!b) errors.push("mini graph: no way to the full graph");
  b?.click(); window.dispatchEvent(new window.Event("hashchange")); await tick(300);
  if (window.location.hash !== "#graph" || !d.querySelector("#main .graph-wrap canvas")) errors.push("mini graph: the click did not open the full graph: " + window.location.hash);
  const g = window.__g(); const n = g?.nodes.find((x) => x.entry?.uuid === "5a1e5a1e-0000-4000-8000-000000000004");
  if (!n || !g.userMoved) errors.push("mini graph: the full graph is not centred on the entry");
  window.close();
}
{
  // a project's name under its hub: always drawn, labels on or off, and a click on it goes there
  const open0 = fetched.length;
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/refs`)}#graph`);
  await tick(600);
  const d = window.document;
  const labels = [...d.querySelectorAll(".graph-ui label")].find((l) => l.textContent === "labels")?.querySelector("input");
  labels.checked = false; labels.dispatchEvent(new window.Event("change")); await tick(200);
  const g = window.__g();
  const names = (g.nameBoxes || []).map((b) => b.n.label).sort();
  report.hubNames = names;
  if (!names.includes("acme/notes") || !names.includes("acme/suite")) errors.push("hub names: not drawn with labels off: " + names.join());
  const box = g.nameBoxes.find((b) => b.n.label === "acme/notes");
  const canvas = d.querySelector("#main .graph-wrap canvas");
  const cx = ((box.x0 + box.x1) / 2) * g.scale + g.ox, cy = ((box.y0 + box.y1) / 2) * g.scale + g.oy;
  const nav = navigations.length; const nav0 = fetched.length;
  canvas.dispatchEvent(new window.MouseEvent("mousedown", { clientX: cx, clientY: cy, bubbles: true }));
  window.dispatchEvent(new window.MouseEvent("mouseup", { clientX: cx, clientY: cy }));
  await tick(300);
  if (!fetched.slice(nav0).some((u) => /notes\/state\.body\.json/.test(u))) errors.push("lean export: the walk to notes did not fetch its bodies");
  if (fetched.slice(open0, nav0).some((u) => /notes\/state\.body\.json/.test(u))) errors.push("lean export: notes' bodies were fetched for the graph, before the walk");
  window.location.hash = `#entry/${NOTES_ID}`; window.dispatchEvent(new window.Event("hashchange")); await tick(300);
  if (!/No needle here either\./.test(d.getElementById("main").textContent)) errors.push("lean export: the entry's body is not shown after the walk");
  if (window.location.search !== `?public=${encodeURIComponent(`${GH}/notes`)}` || !/acme---notes/.test(d.title)) errors.push("hub names: a click on the friend's name did not go there: " + window.location.search);
  if (navigations.length !== nav) errors.push("hub names: the walk loaded a page instead of moving in place");
  window.close();
}
{
  // the globe: the graph alone, full width; waves out from what is loaded, each asked for with its count; the registry as a wave of its own
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/refs`)}#globe`);
  await tick(700);
  const d = window.document;
  if (!d.getElementById("app").classList.contains("globe")) errors.push("globe: the page is not in the globe layout");
  // the intro on the way in: what hops and registry do; "don't show this again" is kept
  const intro = d.querySelector(".globe-intro");
  if (!intro || !/Hops/.test(intro.textContent) || !/registry/.test(intro.textContent)) errors.push("globe: no intro explaining hops and registry on the way in");
  intro?.querySelector("input[type=checkbox]")?.click(); [...(intro?.querySelectorAll("button") || [])].find((b) => b.textContent === "got it")?.click(); await tick(50);
  if (d.querySelector(".globe-intro")) errors.push("globe: the intro did not close");
  if (window.localStorage.getItem("ktw-globe-intro") !== "off") errors.push("globe: 'don't show this again' was not kept");
  window.location.hash = "#graph"; window.dispatchEvent(new window.Event("hashchange")); await tick(150);
  window.location.hash = "#globe"; window.dispatchEvent(new window.Event("hashchange")); await tick(150);
  if (d.querySelector(".globe-intro")) errors.push("globe: the intro came back after 'don't show this again'");
  if (!d.querySelector(".statusbar .globe-egg")) errors.push("globe: no globe in the status bar");
  const ctl = d.querySelector(".graph-ui .globe-ctl");
  if (!ctl) errors.push("globe: no globe group in the control bar");
  const sel = ctl?.querySelector("select");
  if (!sel || sel.options.length !== 11 || sel.value !== "1") errors.push("globe: the hops choice is not off…10 with 1 chosen: " + sel?.options.length + " " + sel?.value);
  const before = fetched.length;
  window.__g().userMoved = true; // as if the reader had panned or zoomed
  [...ctl.querySelectorAll("button")].find((b) => b.textContent === "go")?.click(); await tick(300);
  const dialog = d.querySelector(".globe-dialog");
  if (!dialog) errors.push("globe: no dialog before the first wave");
  report.globeWave1 = dialog?.querySelector("h3")?.textContent;
  if (!/^Hop 1: 1 repository/.test(report.globeWave1 || "")) errors.push("globe: hop 1 should offer acme/far alone: " + report.globeWave1);
  if (!/acme\/far — cited by 1 entry/.test(dialog?.textContent || "")) errors.push("globe: the dialog does not list acme/far with its citation: " + dialog?.textContent?.slice(0, 200));
  if (fetched.slice(before).some((u) => /acme\/far/.test(u))) errors.push("globe: acme/far was fetched before the yes");
  [...dialog.querySelectorAll("button")].find((b) => b.textContent === "load them")?.click(); await tick(600);
  let g = window.__g();
  let hubs = g.nodes.filter((n) => n.kind === "project" && n.hop != null).map((n) => `${n.label}:${n.hop}`);
  if (hubs.join() !== "acme/far:1") errors.push("globe: after hop 1 the graph should hold acme/far at hop 1: " + hubs.join());
  if (!/acme\/far · hop 1/.test(d.querySelector(".graph-legend")?.textContent.replace(/\s+/g, " ") || "")) errors.push("globe: the legend does not say hop 1 for acme/far");
  if (g.userMoved) errors.push("globe: after a wave the view is not framed again (userMoved still set)");
  // the second wave, asked for again, finds farther; a no leaves hop 1 standing
  const sel2 = d.querySelector(".graph-ui .globe-ctl select"); sel2.value = "2"; sel2.dispatchEvent(new window.Event("change")); await tick(300);
  [...d.querySelectorAll(".graph-ui .globe-ctl button")].find((b) => /^go on/.test(b.textContent))?.click(); await tick(300);
  const dialog2 = d.querySelector(".globe-dialog");
  if (!/^Hop 2: 1 repository/.test(dialog2?.querySelector("h3")?.textContent || "")) errors.push("globe: hop 2 should offer acme/farther: " + dialog2?.querySelector("h3")?.textContent);
  [...dialog2.querySelectorAll("button")].find((b) => b.textContent === "no, stop here")?.click(); await tick(300);
  g = window.__g(); hubs = g.nodes.filter((n) => n.kind === "project" && n.hop != null).map((n) => `${n.label}:${n.hop}`);
  if (hubs.join() !== "acme/far:1") errors.push("globe: a no at hop 2 should leave hop 1 as it was: " + hubs.join());
  // the registry: what it lists and is not here yet — farther; refs is this project and is left out
  d.querySelector(".graph-ui .globe-ctl input[type=checkbox]").click(); await tick(300);
  const dialog3 = d.querySelector(".globe-dialog");
  report.globeRegistry = dialog3?.querySelector("h3")?.textContent;
  if (!/^The registry: 2 projects/.test(report.globeRegistry || "")) errors.push("globe: the registry should offer farther and gone: " + report.globeRegistry);
  if (!/acme\/gone — acme---gone · 3 entries · not answering since 2026-09-30, tried anyway/.test(dialog3?.textContent || "")) errors.push("globe: the dialog does not mark gone as not answering: " + dialog3?.textContent?.slice(0, 300));
  [...dialog3.querySelectorAll("button")].find((b) => b.textContent === "load them")?.click(); await tick(600);
  g = window.__g(); hubs = g.nodes.filter((n) => n.kind === "project" && n.hop != null).map((n) => `${n.label}:${n.hop}`).sort();
  if (hubs.join() !== "acme/far:1,acme/farther:registry") errors.push("globe: after the registry the graph should hold far (hop 1) and farther (registry): " + hubs.join());
  if (!/from the registry/.test(d.querySelector(".graph-legend")?.textContent || "")) errors.push("globe: the legend does not say 'from the registry'");
  if (!/acme\/gone not loaded · registry/.test(d.querySelector(".graph-legend")?.textContent || "")) errors.push("globe: a registry project that did not load is not named in the legend");
  // the registry switched off and on again offers its projects again (their states come from memory)
  d.querySelector(".graph-ui .globe-ctl input[type=checkbox]").click(); await tick(300);
  g = window.__g(); hubs = g.nodes.filter((n) => n.kind === "project" && n.hop === "registry").map((n) => n.label);
  if (hubs.length) errors.push("globe: the registry switched off left its projects in the graph: " + hubs.join());
  d.querySelector(".graph-ui .globe-ctl input[type=checkbox]").click(); await tick(300);
  const dialog4 = d.querySelector(".globe-dialog");
  if (!/^The registry: 2 projects/.test(dialog4?.querySelector("h3")?.textContent || "")) errors.push("globe: the registry switched on again should offer farther and, again, gone: " + dialog4?.querySelector("h3")?.textContent);
  [...(dialog4?.querySelectorAll("button") || [])].find((b) => b.textContent === "load them")?.click(); await tick(400);
  g = window.__g();
  if (!g.nodes.some((n) => n.kind === "project" && n.hop === "registry")) errors.push("globe: the registry switched on again did not bring its project back");
  // one path bar on the globe, as on the graph — the overlay, not a second one above it
  if (d.querySelectorAll(".path-bar").length > 1) errors.push("globe: " + d.querySelectorAll(".path-bar").length + " path bars");
  // a move to a project the globe brought in: it is the centre now, drawn once — not again as a neighbour
  {
    const farHub = window.__g().nodes.find((n) => n.kind === "project" && n.label === "acme/far");
    if (farHub?.walk) { farHub.walk(); await tick(500);
      const hubs2 = window.__g().nodes.filter((n) => n.kind === "project").map((n) => n.label);
      if (hubs2.includes("acme/far")) errors.push("globe: after the move to acme/far it is drawn again as a neighbour of itself: " + hubs2.join());
      if (!/acme---far/.test(d.title)) errors.push("globe: the move to acme/far did not happen: " + d.title);
      window.history.back(); await tick(500);
      if (!/acme---refs/.test(d.title)) errors.push("globe: back did not return to refs: " + d.title);
      window.history.forward(); await tick(500);
      window.location.hash = "#globe"; window.dispatchEvent(new window.Event("hashchange")); await tick(300);
      if (d.querySelectorAll(".path-bar").length !== 1) errors.push("globe with a path: expected one path bar, got " + d.querySelectorAll(".path-bar").length);
      window.history.back(); await tick(500);
      window.location.hash = "#globe"; window.dispatchEvent(new window.Event("hashchange")); await tick(300);
    } else errors.push("globe: no walkable acme/far hub");
  }
  // clear drops the globe's repositories, friends stay
  [...d.querySelectorAll(".graph-ui .globe-ctl button")].find((b) => b.textContent === "clear")?.click(); await tick(300);
  g = window.__g();
  if (g.nodes.some((n) => n.kind === "project" && n.hop != null)) errors.push("globe: clear left globe repositories in the graph");
  if (!g.nodes.some((n) => n.kind === "project" && n.friend)) errors.push("globe: clear took the friends away too");
  // hops off: the project alone — no friends, no family, no path
  const selOff = d.querySelector(".graph-ui .globe-ctl select"); selOff.value = "0"; selOff.dispatchEvent(new window.Event("change")); await tick(300);
  g = window.__g();
  if (g.nodes.some((n) => n.kind === "project")) errors.push("globe: at off the graph should hold the project alone, got hubs: " + g.nodes.filter((n) => n.kind === "project").map((n) => n.label).join());
  if (!g.nodes.some((n) => n.kind === "topic" && !n.ext)) errors.push("globe: at off the project's own topics are gone");
  window.close();
}
{
  // copy link: on a published page the page's own address; on a local one the project's published dashboard
  const suite = { ...FILES["https://acme.github.io/suite/state.json"], exported: true };
  const embed = (s) => html.replace("<script>", `<script>window.__KTW_STATE__ = ${JSON.stringify(s).replace(/</g, "\\u003c")};</script><script>`);
  let window = await open(`https://acme.github.io/suite/keep-the-why-dashboard/#entry/${SUITE_ID}`, embed(suite));
  await tick(300);
  let b = window.document.querySelector(".reader .share-btn");
  report.shareOnPages = b?.title.split("\n")[1];
  if (report.shareOnPages !== `https://acme.github.io/suite/keep-the-why-dashboard/#entry/${SUITE_ID}`) errors.push("copy link: on a published page it should be the page's address: " + b?.title);
  window.close();
  window = await open(`http://localhost:8765/#entry/${SUITE_ID}`, embed({ ...suite, project: { ...suite.project, dashboard_state: "https://acme.github.io/suite/keep-the-why-dashboard/state.json" } }));
  await tick(300);
  b = window.document.querySelector(".reader .share-btn");
  report.shareOnLocal = b?.title.split("\n")[1];
  if (report.shareOnLocal !== `https://acme.github.io/suite/keep-the-why-dashboard/#entry/${SUITE_ID}`) errors.push("copy link: on a local page it should be the published dashboard's address: " + b?.title);
  window.close();
}
console.log(JSON.stringify(report, null, 1));
console.log("ERRORS:", errors.length); for (const e of errors) console.log("  " + e);
process.exit(errors.length ? 1 : 0);
