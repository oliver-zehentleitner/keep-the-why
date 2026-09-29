// Headless smoke test: load an exported page in jsdom, drive every route, count errors.
// The page's inline module is run by jsdom itself (runScripts: "dangerously" on a
// copy of the HTML whose <script type="module"> is turned into a classic script,
// since jsdom does not execute module scripts); the test itself runs no code strings.
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";

const html = fs.readFileSync(process.argv[2], "utf8").replace('<script type="module">', "<script>");
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
const tick = (ms) => new Promise((r) => setTimeout(r, ms));
await tick(300);
const S = window.__KTW_STATE__;
if (!S || !S.entries) { console.log("ERRORS: 1\n  no state on the page"); process.exit(1); }
const withUuid = S.entries.find((e) => e.uuid);
const exportFamily = !!((S.project.parent || (S.project.children || []).length) && (S.project.canonical || S.project.git?.remote));
const routes = ["#overview", "#graph", "#timeline", "#authors", "#queues", "#findings", "#family", "#projects", `#topic/${S.topics[0].file}`, `#entry/${encodeURIComponent(S.entries[0].id)}`, `#entry/${encodeURIComponent(S.entries[S.entries.length - 1].id)}`, ...(withUuid ? [`#entry/${withUuid.uuid}`] : [])];
const go = async (hash) => { window.location.hash = hash; window.dispatchEvent(new window.Event("hashchange")); await tick(120); };
const report = {};
for (const r of routes) {
  await go(r);
  const main = window.document.getElementById("main");
  report[r] = { textLen: main.textContent.trim().length, children: main.children.length, h1: main.querySelector("h1")?.textContent?.slice(0, 50) };
  if (report[r].textLen < 20) errors.push(`route ${r} rendered almost nothing`);
}
report.sidebarLeaves = window.document.querySelectorAll(".tree .leaf").length;
report.strip = window.document.querySelectorAll("#strip a.stat").length;
report.entryMiniGraph = window.document.querySelectorAll("#details .mini canvas").length;
await go(`#topic/${S.topics[0].file}`);
report.topicMiniGraph = window.document.querySelectorAll("#details .mini canvas").length;
// content, not only "something rendered": the views built for project families
const withSee = S.entries.find((e) => e.see?.length);
const main = window.document.getElementById("main");
// an export has no family to load: the family graph falls back to the project's own
await go("#graph/family");
if (!main.querySelector(".graph-wrap canvas")) errors.push("graph/family in an export: no graph rendered");
if (window.document.getElementById("scope").hidden === exportFamily) errors.push(`export: the this-project/family switch is ${exportFamily ? "missing for a family member" : "shown without a family"}`);
// an author name links to the host (the commit page until a click has looked up the profile)
if (S.project.git?.available && /^github\.com\//.test(S.project.git.remote || "") && !S.anonymized) {
  await go(`#entry/${encodeURIComponent(S.entries[0].id)}`);
  const a = window.document.querySelector("#details a.author");
  if (!a || !/^https:\/\/github\.com\/.+\/commit\/[0-9a-f]+$/.test(a.getAttribute("href") || "")) errors.push("entry details: the author is not linked to the host: " + (a?.getAttribute("href") || "no link"));
}
// a static page is published by nature: no local/public switch at all — the family scope reaches the members' exports
{
  const box = window.document.getElementById("mode");
  report.modeSwitch = box.hidden ? "hidden" : [...box.querySelectorAll("button")].map((b) => b.textContent).join("/");
  if (!box.hidden) errors.push("export: a local/public switch on a static page — " + report.modeSwitch);
}
// the side-pane graph: near and project in an export (no family), and the switch works
await go(`#entry/${encodeURIComponent(S.entries[0].id)}`);
const modes = [...window.document.querySelectorAll("#details .mini-seg button")].map((b) => b.textContent);
const wantModes = exportFamily ? "near,project,family" : "near,project";
if (modes.join() !== wantModes) errors.push(`side-pane graph in an export: expected ${wantModes}, got ` + modes.join());
[...window.document.querySelectorAll("#details .mini-seg button")].find((b) => b.textContent === "project")?.click();
await tick(50);
if (window.document.querySelector("#details .mini-seg button.on")?.textContent !== "project" || !window.document.querySelector("#details .mini canvas")) errors.push("side-pane graph: the project switch did not take");
[...window.document.querySelectorAll("#details .mini-seg button")].find((b) => b.textContent === "near")?.click();
await tick(50);
await go("#family");
const inFamily = !!(S.project.parent || (S.project.children || []).length);
if (inFamily ? !main.querySelector(".family .member.self") : !/not part of a family/.test(main.textContent)) errors.push("family view: neither a self row (in a family) nor the not-part-of-a-family line");
if (withUuid) {
  await go(`#entry/${withUuid.uuid}`);
  if (!main.querySelector("h1")) errors.push("entry by uuid: no reader rendered");
  const idCell = [...window.document.querySelectorAll("#details .kv .v")].some((n) => n.textContent === withUuid.uuid);
  if (!idCell) errors.push("entry by uuid: the details pane does not show the Id");
  // every link to an entry that has an Id carries the Id, not file#anchor — tree, rows, pager, backlinks
  const anchorForm = new Set(S.entries.filter((e) => e.uuid).map((e) => `#entry/${encodeURIComponent(e.id)}`));
  const stale = new Set();
  for (const r of [`#topic/${withUuid.file}`, `#entry/${withUuid.uuid}`]) {
    await go(r);
    for (const a of window.document.querySelectorAll('a[href^="#entry/"]')) if (anchorForm.has(a.getAttribute("href"))) stale.add(a.getAttribute("href"));
  }
  if (stale.size) errors.push(`entry links by file#anchor instead of Id: ${[...stale].slice(0, 3).join(", ")}`);
  if (!window.document.querySelector(".tree .leaf.active")) errors.push("entry by uuid: the tree does not mark the entry");
  // an old file#anchor link still opens the entry and the address bar shows the Id from then on
  await go(`#entry/${encodeURIComponent(withUuid.id)}`);
  if (window.location.hash !== `#entry/${withUuid.uuid}`) errors.push("old file#anchor link: not rewritten to the Id address, hash is " + window.location.hash);
  if (!main.querySelector("h1")) errors.push("old file#anchor link: no reader rendered");
}
if (withSee) {
  await go(`#entry/${withSee.uuid || encodeURIComponent(withSee.id)}`);
  if (![...main.querySelectorAll(".refs-box h3")].some((h) => h.textContent === "See")) errors.push("entry with See lines: no See section in the reader");
}
// friends: an export offers the repositories its entries cite outside the family, and loads none of them on its own
{
  const cited = new Set(); const own = (S.project.canonical || "").toLowerCase();
  for (const e of S.entries) for (const r of e.see || []) if (r?.remote && r.remote.toLowerCase() !== own) cited.add(r.remote.toLowerCase());
  await go("#graph");
  const btn = window.document.querySelector(".graph-ui .friends-load");
  report.friends = btn?.textContent || "none";
  if (cited.size && !btn) errors.push(`graph: entries cite ${cited.size} other repositories, but there is no friends button`);
  if (!cited.size && btn) errors.push("graph: a friends button without a cross-project reference");
}
const search = window.document.getElementById("search");
search.value = S.entries[0].title.split(" ").slice(0, 2).join(" ");
search.dispatchEvent(new window.Event("input"));
await tick(200);
if (window.document.getElementById("search-results").hidden || !window.document.querySelector("#search-results a")) errors.push("search: no result for a known title");
// Enter without a selection: the results page, every hit with its topic
search.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
await tick(50); window.dispatchEvent(new window.Event("hashchange")); await tick(150);
report.searchPage = { hash: window.location.hash, rows: main.querySelectorAll(".search-page .row").length };
if (!/^#search\/(project|family)\//.test(window.location.hash) || !report.searchPage.rows) errors.push("search: Enter did not open a results page with rows: " + JSON.stringify(report.searchPage));
await go("#overview");
report.defaultMiniGraph = window.document.querySelectorAll("#details .mini canvas").length;
// unknown evidence is its own axis: the strip counts every entry in force with Evidence unknown, open questions included
{
  const want = S.entries.filter((e) => e.evidence === "unknown" && e.status !== "superseded").length;
  const stat = [...window.document.querySelectorAll("#strip a.stat")].find((a) => /unknown evidence/.test(a.textContent));
  report.unknownEvidence = stat?.textContent;
  if (!stat || parseInt(stat.textContent, 10) !== want) errors.push(`strip: unknown evidence shows ${stat?.textContent}, the state has ${want}`);
}
if (report.strip < 10) errors.push("strip: expected at least 10 stats, got " + report.strip);
if (report.entryMiniGraph !== 1 || report.topicMiniGraph !== 1 || report.defaultMiniGraph !== 1) errors.push(`mini graph missing: entry=${report.entryMiniGraph} topic=${report.topicMiniGraph} default=${report.defaultMiniGraph}`);
if (window.document.body.textContent.includes("[object ")) errors.push("[object ...] leaked into the page text");
if (/\bnull\b/.test(window.document.getElementById("project-title").textContent + window.document.getElementById("statusbar").textContent)) errors.push("null leaked into the top bar or status bar");
report.details = window.document.getElementById("details").textContent.trim().length;
window.__ktwApplyUpdates({ enabled: true, packages: { "keep-the-why-dashboard": { installed: S.dashboard, latest: "99.0.0", outdated: true }, "keep-the-why-lint": { installed: S.linter, latest: S.linter, outdated: false } } });
const pd = window.document.getElementById("pkg-dashboard"), pl = window.document.getElementById("pkg-lint");
report.updates = { dashboardShimmer: pd?.classList.contains("outdated"), dashboardTitle: pd?.querySelector("a")?.title, lintShimmer: pl?.classList.contains("outdated") };
if (!report.updates.dashboardShimmer || report.updates.lintShimmer || !/99\.0\.0/.test(report.updates.dashboardTitle || "") || !/pip install -U keep-the-why-dashboard/.test(report.updates.dashboardTitle || "")) errors.push("update marking wrong: " + JSON.stringify(report.updates));
if (!/→ 99\.0\.0/.test(pd?.textContent || "")) errors.push("outdated entry does not show the newer version");
report.topbarLinks = { schema: window.document.querySelectorAll('#project-title a[href*="/releases/tag/v"]').length, commit: window.document.querySelectorAll('#project-title a[href*="/commit/"]').length };
if (S.project.git?.available && /^github\.com\//.test(S.project.git.remote || "") && (report.topbarLinks.schema !== 1 || report.topbarLinks.commit !== 1)) errors.push("top bar links missing: " + JSON.stringify(report.topbarLinks));
const input = window.document.getElementById("search"); input.value = "retry"; input.dispatchEvent(new window.Event("input"));
await tick(50);
report.search = window.document.querySelectorAll("#search-results a").length;
const sel = window.document.getElementById("f-evidence"); sel.value = "inferred"; sel.dispatchEvent(new window.Event("change"));
await tick(50);
report.dimmedAfterFilter = window.document.querySelectorAll(".tree .leaf.dim").length;
report.statusbar = window.document.getElementById("statusbar").textContent.trim().slice(0, 80);
console.log(JSON.stringify(report, null, 1));
console.log("ERRORS:", errors.length); for (const e of errors) console.log("  " + e);
window.close();
process.exit(errors.length ? 1 : 0);
