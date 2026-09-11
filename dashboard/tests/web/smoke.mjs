// Headless smoke test: load the exported page in jsdom, drive every route, count errors.
import { JSDOM } from "jsdom";
import fs from "node:fs";
const html = fs.readFileSync(process.argv[2], "utf8");
const errors = [];
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
window.ResizeObserver = class { observe() {} disconnect() {} };
window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k === "measureText" ? () => ({ width: 10 }) : () => {}) , set: () => true });
window.requestAnimationFrame = (fn) => window.setTimeout(() => fn(0), 16);
window.cancelAnimationFrame = (id) => window.clearTimeout(id);
window.matchMedia = () => ({ matches: false });
window.CSS = { escape: (s) => s.replace(/([^\w-])/g, "\\$1") };
window.addEventListener("error", (e) => errors.push("window: " + e.message));
window.console.error = (...a) => errors.push("console: " + a.join(" "));
// extract the inline module script (export mode) and run it as a classic script
const m = html.match(/<script type="module">\n([\s\S]*?)\n<\/script>/);
const stateM = html.match(/<script>window\.__KTW_STATE__ = ([\s\S]*?);<\/script>/);
window.eval(`window.__KTW_STATE__ = ${stateM[1]};`);
try { window.eval(m[1]); } catch (e) { errors.push("boot: " + e.stack); }
await new Promise((r) => setTimeout(r, 200));
const S = window.__KTW_STATE__;
const routes = ["#overview", "#graph", "#timeline", "#authors", "#queues", `#topic/${S.topics[0].file}`, `#entry/${encodeURIComponent(S.entries[0].id)}`, `#entry/${encodeURIComponent(S.entries[S.entries.length-1].id)}`];
const report = {};
for (const r of routes) {
  window.location.hash = r;
  window.dispatchEvent(new window.Event("hashchange"));
  await new Promise((res) => setTimeout(res, 120));
  const main = window.document.getElementById("main");
  report[r] = { textLen: main.textContent.trim().length, children: main.children.length, h1: main.querySelector("h1")?.textContent?.slice(0, 50) };
}
// details pane + sidebar + search
report.sidebarLeaves = window.document.querySelectorAll(".tree .leaf").length;
report.details = window.document.getElementById("details").textContent.trim().length;
const input = window.document.getElementById("search"); input.value = "retry"; input.dispatchEvent(new window.Event("input"));
await new Promise((res) => setTimeout(res, 50));
report.search = window.document.querySelectorAll("#search-results a").length;
// filter
const sel = window.document.getElementById("f-evidence"); sel.value = "inferred"; sel.dispatchEvent(new window.Event("change"));
await new Promise((res) => setTimeout(res, 50));
report.dimmedAfterFilter = window.document.querySelectorAll(".tree .leaf.dim").length;
report.statusbar = window.document.getElementById("statusbar").textContent.trim().slice(0, 80);
console.log(JSON.stringify(report, null, 1));
console.log("ERRORS:", errors.length); for (const e of errors) console.log("  " + e.split("\n").slice(0, 3).join(" | "));
process.exit(errors.length ? 1 : 0);
