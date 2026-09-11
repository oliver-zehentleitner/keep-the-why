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
const routes = ["#overview", "#graph", "#timeline", "#authors", "#queues", "#findings", `#topic/${S.topics[0].file}`, `#entry/${encodeURIComponent(S.entries[0].id)}`, `#entry/${encodeURIComponent(S.entries[S.entries.length - 1].id)}`];
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
await go("#overview");
report.defaultMiniGraph = window.document.querySelectorAll("#details .mini canvas").length;
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
