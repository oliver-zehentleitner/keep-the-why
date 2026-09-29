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
  // outside the family: no parent, no children — reached only through a See
  "https://raw.githubusercontent.com/acme/notes/HEAD/.keep-the-why": config("acme---notes", ["- dashboard-state: https://acme.github.io/notes/state.json"]),
  "https://acme.github.io/notes/state.json": state("acme---notes", { canonical: `${GH}/notes` }, [entry('Notes are <img src=x onerror="window.__pwned=1"> plain text', "No needle here either.", { uuid: NOTES_ID }), entry("Notes are kept short", "Short.", { uuid: "5a1e5a1e-0000-4000-8000-000000000005" })]),
  // an export that claims to be another repository's
  "https://raw.githubusercontent.com/acme/impostor/HEAD/.keep-the-why": config("acme---impostor", ["- dashboard-state: https://acme.github.io/impostor/state.json"]),
  "https://acme.github.io/impostor/state.json": state("acme---impostor", { canonical: `${GH}/suite` }, [entry("Release together", "A copy.", { uuid: NOTES_ID })]),
  // outside the family too: one entry citing entries in five other places
  "https://raw.githubusercontent.com/acme/refs/HEAD/.keep-the-why": config("acme---refs", ["- dashboard-state: https://acme.github.io/refs/state.json"]),
  "https://acme.github.io/refs/state.json": state("acme---refs", { canonical: `${GH}/refs` }, [entry("Cites elsewhere", "References only.", { uuid: "5a1e5a1e-0000-4000-8000-000000000004", see: [
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
async function open(url, page = html) {
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => /^Not implemented: navigation/.test(e.message || "") ? navigations.push(e.message) : errors.push("jsdom: " + (e.detail?.stack || e.message || e).toString().split("\n").slice(0, 2).join(" | ")));
  vc.on("error", (...a) => errors.push("console: " + a.join(" ")));
  const dom = new JSDOM(page, { url, runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
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
  // with the family merged, the plugin's entry is part of what is shown: a reference like any other, named by its project
  if (!/Referenced by \(See\)\s*Plugins load lazily · plugin · Design/.test(report.referencedBy || "")) errors.push("entry, scope family: the plugin's See is not listed as a reference: " + report.referencedBy);
  const modes = [...d.querySelectorAll("#details .mini-seg:not(.mini-friends) button")].map((b) => b.textContent);
  if (modes.join() !== "near,project,family") errors.push("side-pane graph in public mode: expected near,project,family, got " + modes.join());
  // on a page without an entry the side pane's graph follows the scope: family here
  window.location.hash = "#overview"; window.dispatchEvent(new window.Event("hashchange")); await tick(300);
  report.miniOnOverview = d.querySelector("#details .mini-seg:not(.mini-friends) button.on")?.textContent;
  if (report.miniOnOverview !== "family") errors.push("overview with the family scope: the side-pane graph shows " + report.miniOnOverview + ", not family");
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
  // and the family merged from the members' published exports — nothing fetched until the family is asked for
  const embedded = JSON.stringify({ ...FILES["https://acme.github.io/web/state.json"], exported: true }).replace(/</g, "\\u003c");
  const page = html.replace("<script>", `<script>window.__KTW_STATE__ = ${embedded};</script><script>`);
  const before = fetched.length;
  const window = await open("http://localhost/web/keep-the-why-dashboard/#overview", page);
  const d = window.document;
  report.staticFetchedBefore = fetched.length - before;
  report.staticMode = d.getElementById("mode").hidden ? "hidden" : "shown";
  report.staticScope = d.getElementById("scope").hidden ? "hidden" : "shown";
  if (report.staticFetchedBefore !== 0) errors.push(`static export, scope this project: ${report.staticFetchedBefore} request(s) before the family was asked for`);
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
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/refs`)}#graph`);
  await tick(200);
  const d = window.document;
  let btn = d.querySelector(".graph-ui .friends-load");
  report.friendsButton = btn?.textContent;
  if (btn?.textContent !== "friends (4)") errors.push("friends: no 'friends (4)' button in the graph: " + btn?.textContent);
  const mini = () => d.querySelector("#details .mini-friends button");
  const to = async (h) => { window.location.hash = h; window.dispatchEvent(new window.Event("hashchange")); await tick(150); };
  if (!/friend — a repository cited outside the family/.test(d.getElementById("details").textContent)) errors.push("friends: not in the graph page's legend");
  await to("#overview");
  if (mini()?.textContent !== "friends (4)") errors.push("friends: no 'friends (4)' button on the side pane's graph: " + mini()?.textContent);
  await to("#graph");
  const early = fetched.slice(before).filter((u) => /acme\/(notes|suite|cli|impostor)|acme\.github\.io\/(notes|suite|impostor)/.test(u));
  if (early.length) errors.push("friends: fetched before the click: " + early.join(", "));
  btn = d.querySelector(".graph-ui .friends-load"); btn?.click(); await tick(400);
  const legend = d.querySelector(".graph-legend")?.textContent || "";
  report.friendsLegend = legend;
  for (const name of ["acme/notes", "acme/suite"]) if (![...d.querySelectorAll(".graph-legend .friend")].some((x) => x.textContent === name)) errors.push(`friends: ${name} not in the legend`);
  // the walk stays in the graph: a friend's name opens that project's graph
  const notesLink = [...d.querySelectorAll(".graph-legend .friend a")].find((a) => a.textContent === "acme/notes")?.getAttribute("href") || "";
  if (!notesLink.endsWith(`?public=${encodeURIComponent(`${GH}/notes`)}#graph`)) errors.push("friends: the legend link does not open the friend's graph: " + notesLink);
  await to("#overview");
  if (!mini()?.classList.contains("on")) errors.push("friends: the side pane's graph does not show the friends as on");
  await to("#graph");
  for (const name of ["acme/cli not loaded", "acme/impostor not loaded"]) if (!legend.includes(name)) errors.push(`friends: '${name}' missing from the legend`);
  const g = window.__g();
  const hubs = g.nodes.filter((n) => n.kind === "project" && n.friend).map((n) => n.label).sort();
  const see = g.links.filter((l) => l.kind === "see").map((l) => `${g.nodes[l.s].label}>${g.nodes[l.t].label.slice(0, 16)}`).sort();
  report.friendsGraph = { hubs, see };
  if (hubs.join() !== "acme/notes,acme/suite") errors.push("friends: wrong friend hubs " + hubs.join());
  if (see.join() !== "Cites elsewhere>Notes are <img s,Cites elsewhere>Release together") errors.push("friends: See lines to the friends missing: " + see.join());
  const notesEntries = () => window.__g().nodes.filter((n) => n.kind === "entry" && n.id.startsWith("fe:https://github.com/acme/notes:")).length;
  if (notesEntries() !== 1) errors.push("friends: a hub should show only the cited entries, got " + notesEntries());
  if (!/^1 entries/.test(d.getElementById("counts")?.textContent || "1 entries")) errors.push("friends: merged into the counts: " + d.getElementById("counts")?.textContent);
  g.nodes.find((n) => n.friend && n.label === "acme/notes").action(); await tick(100);
  if (notesEntries() !== 2) errors.push("friends: an expanded hub should show all of the friend's entries, got " + notesEntries());
  window.close();
}
{
  // friends from an entry's neighbourhood: the side pane's control switches to the project level and loads them there
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/refs`)}#entry/5a1e5a1e-0000-4000-8000-000000000004`);
  await tick(200);
  const d = window.document;
  const b = d.querySelector("#details .mini-friends button");
  report.nearFriends = b?.textContent;
  if (b?.textContent !== "friends (4)") errors.push("friends, near: no 'friends (4)' on the neighbourhood graph: " + b?.textContent);
  b?.click(); await tick(400);
  const mode = d.querySelector("#details .mini-seg:not(.mini-friends) button.on")?.textContent;
  if (mode !== "project") errors.push("friends, near: did not switch to the project level: " + mode);
  if (!d.querySelector("#details .mini-friends button")?.classList.contains("on")) errors.push("friends, near: the friends were not loaded at the project level");
  window.close();
}
{
  // the path: a walk to a friend changes the centre in place (no page load), the page keeps where it came from,
  // back returns along it, and a discarded path is gone
  const window = await open(`http://localhost/?public=${encodeURIComponent(`${GH}/refs`)}#graph`);
  await tick(200);
  const d = window.document;
  d.querySelector(".graph-ui .friends-load")?.click(); await tick(400);
  const navBefore = navigations.length;
  [...d.querySelectorAll(".graph-legend .friend a")].find((a) => a.textContent === "acme/notes")?.click(); await tick(300);
  report.pathWalk = { search: window.location.search, hash: window.location.hash, bar: d.querySelector(".path-bar")?.textContent.replace(/\s+/g, " ") };
  if (navigations.length !== navBefore) errors.push("path: the walk to a friend loaded a page instead of moving in place");
  if (window.location.search !== `?public=${encodeURIComponent(`${GH}/notes`)}` || window.location.hash !== "#graph") errors.push("path: the address is not the friend's graph: " + window.location.search + window.location.hash);
  if (!/1 · acme---refs › acme---notes/.test(report.pathWalk.bar || "")) errors.push("path: no path bar 'refs › notes': " + report.pathWalk.bar);
  const g = window.__g();
  const trailHub = g?.nodes.find((n) => n.trail);
  if (trailHub?.label !== "1 · acme---refs") errors.push("path: the project walked from is not a hub in the graph: " + trailHub?.label);
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
console.log(JSON.stringify(report, null, 1));
console.log("ERRORS:", errors.length); for (const e of errors) console.log("  " + e);
process.exit(errors.length ? 1 : 0);
