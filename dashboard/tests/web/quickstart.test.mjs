// The quick start in docs/dashboard-views.md is quickstart/index.html, and this test runs it: served the way the
// docs tell a host to serve it (the library files in ktw/, a published state.json beside the page), loaded in
// jsdom, and checked to show the overview and the graph, and to follow a link, without an error. It also holds the
// page's scripts to the manifest's order and the docs' copy of the page to the file, byte for byte, so the docs
// never show code that does not run.
//
//   node --test quickstart.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM, VirtualConsole } from "jsdom";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, "quickstart", "index.html");
const WEB = path.resolve(HERE, "../../ktw_dashboard/web");
const STATE = path.join(HERE, "fixture", "state.json");
const DOCS = path.resolve(HERE, "../../../docs/dashboard-views.md");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

// the page's folder as a host deploys it: index.html, ktw/<the library's files>, state.json
function serve() {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = p === "/" || p === "/index.html" ? PAGE
      : p === "/state.json" ? STATE
      : p.startsWith("/ktw/") ? path.join(WEB, path.basename(p)) : null;
    if (!file || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const tick = (ms) => new Promise((r) => setTimeout(r, ms));

test("the quick start page loads the library in the manifest's order", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(WEB, "ktw-views.json"), "utf8"));
  const html = fs.readFileSync(PAGE, "utf8");
  const scripts = [...html.matchAll(/<script src="ktw\/([^"]+)"><\/script>/g)].map((m) => m[1]);
  assert.deepEqual(scripts, manifest.scripts);
  for (const css of manifest.styles) assert.match(html, new RegExp(`<link rel="stylesheet" href="ktw/${css.replace(".", "\\.")}">`));
});

test("docs/dashboard-views.md quotes the quick start page as it is", () => {
  const docs = fs.readFileSync(DOCS, "utf8");
  const m = docs.match(/<!-- quickstart:begin[^>]*-->\n```html\n([\s\S]*?)```\n<!-- quickstart:end -->/);
  assert.ok(m, "the docs carry the quick start between <!-- quickstart:begin --> and <!-- quickstart:end -->");
  assert.equal(m[1], fs.readFileSync(PAGE, "utf8"), "the docs' quick start differs from tests/web/quickstart/index.html");
});

test("the quick start names no version that would go stale", () => {
  // a pinned number in prose no test reads would point at an old release after the next one; the quick start
  // says "pin the version you vendor" instead
  const docs = fs.readFileSync(DOCS, "utf8");
  const quick = docs.slice(docs.indexOf("## Quick start"), docs.indexOf("## The files"));
  assert.ok(quick.length > 0, "the docs have a Quick start before The files");
  // three numbers, not four (127.0.0.1 is an address)
  assert.doesNotMatch(quick, /(?<![\d.])\d+\.\d+\.\d+(?![\d.])/, "the quick start names a version number");
});

test("the quick start says how to open the page: served over HTTP, not as a file", () => {
  // the page fetches state.json, which a browser blocks for a page opened from file://; the test serves it, and a
  // reader has to as well
  const docs = fs.readFileSync(DOCS, "utf8");
  const quick = docs.slice(docs.indexOf("## Quick start"), docs.indexOf("## The files"));
  assert.match(quick, /python -m http\.server 8000 --bind 127\.0\.0\.1/, "the quick start names a command that serves the page");
  assert.match(quick, /http:\/\/127\.0\.0\.1:8000\//, "the quick start names the URL to open");
  assert.match(quick, /file:\/\//, "the quick start says why not to open it as a file");
});

test("the quick start page shows the overview and the graph, with no error", async () => {
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push("jsdom: " + (e.message || e)));
  vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));
  vc.on("warn", (...a) => errors.push("console.warn: " + a.join(" ")));
  const dom = await JSDOM.fromURL(url, { runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.ResizeObserver = class { observe() {} disconnect() {} }; w.matchMedia = () => ({ matches: false });
      w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k === "measureText" ? () => ({ width: 10 }) : () => {}), set: () => true });
      w.fetch = (u, o) => fetch(new URL(String(u), url), o);
      w.addEventListener("unhandledrejection", (e) => errors.push("rejection: " + (e.reason?.message || e.reason)));
    } });
  try {
    const w = dom.window, doc = w.document, main = () => doc.getElementById("why");
    const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
    const h1 = () => main().querySelector("h1")?.textContent.replace(/\s+/g, " ").trim() || "";
    const until = async (ok, what) => { for (let i = 0; i < 50; i++) { if (ok()) return; await tick(100); } assert.fail(`${what}; errors: ${errors.join(" | ")}`); };

    await until(() => h1() === (state.project.id || state.project.name), "the overview's heading");
    const topic = state.topics[0];
    assert.ok(main().textContent.includes(topic.title), "the overview lists the topics");
    assert.ok(main().querySelectorAll(".ktw-pill").length > 0, "the overview draws its pills");

    w.location.hash = "#graph";
    await until(() => main().querySelectorAll(".ktw-graph-wrap canvas").length === 1, "the graph's canvas");

    // the views' links are this page's routes, and following one goes through its nav without an error
    w.location.hash = "#overview";
    await until(() => h1() === (state.project.id || state.project.name), "back on the overview");
    const link = main().querySelector(`a[href="#topic/${topic.file}"]`);
    assert.ok(link, "the overview links its topics by route");
    link.click();
    await tick(300);
    assert.equal(w.location.hash, `#topic/${topic.file}`);

    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
    server.close();
  }
});
