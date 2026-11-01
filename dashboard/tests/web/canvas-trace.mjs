// What the canvases draw, as text: the graph's and the stage's last frame, every drawing call with its
// arguments, once the layout has settled. The DOM snapshots (snapshot.mjs) cannot see into a canvas; this
// can, so a change to the graph or the stage that should draw the same is checked call by call.
//
//   node canvas-trace.mjs PAGE            compare against canvas-snapshots/
//   node canvas-trace.mjs PAGE --update   rewrite canvas-snapshots/
//
// The page is the frozen fixture's (fixture/make_fixture.py --page). The clock, the time zone and
// Math.random are held as in snapshot.mjs; the motion is off (the graph's slow turn would never settle); a
// canvas is 800 × 500; a frame runs as soon as the previous one is done, so the layout settles in the run.
process.env.TZ = "UTC";

import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "canvas-snapshots");
const NOW = Date.parse("2026-06-15T12:00:00Z");
const [page, flag] = process.argv.slice(2);
if (!page) { console.error("usage: node canvas-trace.mjs PAGE [--update]"); process.exit(2); }
const update = flag === "--update";
const round = (v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v);
const show = (v) => (typeof v === "number" ? String(round(v)) : typeof v === "string" ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(show).join(",")}]` : v && typeof v === "object" ? (v.constructor?.name || "object") : String(v));

const errors = [];
const html = fs.readFileSync(page, "utf8").replace('<script type="module">', "<script>");
const tick = (ms) => new Promise((r) => setTimeout(r, ms));
// The last frame of a canvas. The graph's painter and the stage's both open every frame with clearRect over the
// whole canvas, so the calls since the last clearRect are the frame drawn last — the one the settled layout shows.
const lastFrame = (log) => { const i = log.map((l) => l.startsWith("clearRect(")).lastIndexOf(true); return i < 0 ? log : log.slice(i); };
// One page per route, opened at that route: the graph keeps its positions across a move to another view, so
// a move made while it settles would leave it wherever the timing had got it to.
async function trace(hash) {
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(`${hash} jsdom: ` + (e.detail?.stack || e.message || e).toString().split("\n").slice(0, 2).join(" | ")));
  vc.on("error", (...a) => errors.push(`${hash} console: ` + a.join(" ")));
  const LOGS = new Map(); // canvas -> [call lines]
  const state = { pending: 0, frames: 0 };
  const dom = new JSDOM(html, {
    runScripts: "dangerously", pretendToBeVisual: true, url: `http://localhost/${hash}`, virtualConsole: vc,
    beforeParse(window) {
      const RealDate = window.Date;
      class FixedDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } }
      window.Date = FixedDate;
      let seed = 0x2f1c5b7e;
      window.Math.random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      window.localStorage.setItem("ktw-motion", "off");
      window.ResizeObserver = class { observe() {} disconnect() {} };
      window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 800, height: 500, right: 800, bottom: 500 });
      window.HTMLCanvasElement.prototype.getContext = function () {
        const log = []; LOGS.set(this, log);
        return new Proxy({}, {
          get: (t, k) => (k === "measureText" ? (s) => ({ width: String(s).length * 6 }) : typeof k === "symbol" ? undefined : (...a) => { log.push(`${String(k)}(${a.map(show).join(", ")})`); }),
          set: (t, k, v) => { log.push(`${String(k)} = ${show(v)}`); return true; },
        });
      };
      // frames run back to back, and the page's pending ones are counted: settled is when none is asked for
      let frames = 0;
      window.requestAnimationFrame = (fn) => { state.pending++; return window.setTimeout(() => { state.pending--; state.frames++; fn(++frames * 16); }, 0); };
      window.cancelAnimationFrame = (id) => { state.pending = Math.max(0, state.pending - 1); window.clearTimeout(id); };
      window.matchMedia = () => ({ matches: false });
      window.CSS = { escape: (s) => s.replace(/([^\w-])/g, "\\$1") };
      window.Path2D = class { constructor(d) { this.d = d; } };
      window.addEventListener("error", (e) => errors.push(`${hash} window: ` + e.message));
    },
  });
  // wait until the page asks for no more frames — the graph idles once its layout has settled and the stage once its
  // cards stand still — for a quarter of a second in a row; a page that never comes to rest fails instead of passing
  // on whatever frame it had reached
  const LIMIT = Date.now() + 60000; let quiet = 0;
  while (quiet < 5) {
    await tick(50);
    quiet = state.pending === 0 && state.frames > 0 ? quiet + 1 : 0;
    if (Date.now() > LIMIT) { errors.push(`${hash}: still drawing after 60 s (${state.frames} frames)`); break; }
  }
  const canvases = [...dom.window.document.querySelectorAll("canvas")].filter((c) => LOGS.has(c));
  const parts = canvases.map((c, i) => [`## canvas ${i + 1} — ${c.parentElement?.className || "?"}`, ...lastFrame(LOGS.get(c)), ""].join("\n"));
  dom.window.close();
  return `# ${hash}\n\n${parts.join("\n")}`;
}
const results = new Map();
for (const [name, hash] of [["graph", "#graph"], ["timeline", "#timeline"]]) results.set(name, await trace(hash));

const files = [...results].map(([name, text]) => [path.join(DIR, `${name}.txt`), text.endsWith("\n") ? text : text + "\n"]);
let changed = 0;
if (update) {
  fs.mkdirSync(DIR, { recursive: true });
  for (const [file, text] of files) fs.writeFileSync(file, text);
  console.log(`wrote ${files.length} canvas traces to ${path.relative(process.cwd(), DIR) || DIR}`);
} else {
  for (const [file, text] of files) {
    const name = path.basename(file);
    if (!fs.existsSync(file)) { changed++; console.log(`NEW      ${name}`); continue; }
    const old = fs.readFileSync(file, "utf8");
    if (old === text) continue;
    changed++;
    const a = old.split("\n"), b = text.split("\n");
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    console.log(`CHANGED  ${name} — first difference at line ${i + 1} of ${a.length}:`);
    for (let k = Math.max(0, i - 2); k < Math.min(a.length, i + 3); k++) console.log(`  - ${a[k]}`);
    for (let k = Math.max(0, i - 2); k < Math.min(b.length, i + 3); k++) console.log(`  + ${b[k]}`);
  }
  console.log(changed ? `${changed} canvas trace(s) differ` : `${files.length} canvas traces unchanged`);
}
if (errors.length) { console.log("ERRORS:", errors.length); for (const e of errors.slice(0, 5)) console.log("  " + e); }
process.exit(errors.length || changed ? 1 : 0);
