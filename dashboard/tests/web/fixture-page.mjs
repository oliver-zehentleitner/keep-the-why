// The fixture page in jsdom, as snapshot.mjs and textnodes.mjs drive it: rendered from the frozen fixture state
// (fixture/make_fixture.py --page), the clock, the time zone and Math.random held still, and the page's routes —
// every branch of its router that renders without a network.
process.env.TZ = "UTC"; // before the first Date: the timeline labels hours in the reader's zone

import { JSDOM, VirtualConsole } from "jsdom";
import { moduleAsClassic } from "./classic.mjs";
import fs from "node:fs";

const NOW = Date.parse("2026-06-15T12:00:00Z"); // the fixture's `generated`: "today" for the page

// the page at `file`, started: { window, doc, go(hash), tick(ms), errors, state }
export async function openPage(file) {
  const html = moduleAsClassic(fs.readFileSync(file, "utf8"));
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
  const tick = (ms) => new Promise((r) => setTimeout(r, ms));
  const go = async (hash) => { window.location.hash = hash; window.dispatchEvent(new window.Event("hashchange")); await tick(150); };
  await tick(300);
  return { window, doc: window.document, go, tick, errors, state: window.__KTW_STATE__ };
}

// the routes: [name, hash] for every branch of the page's router that renders without a network
export function routesOf(S) {
  const byTitle = (part) => S.entries.find((e) => e.title.includes(part));
  return [
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
    // no hit in each scope (the wider search with its link: public.mjs), a query too short, a topic and an entry
    // that do not exist
    ["search-none", "#search/project/zzzznotfoundzzzz"],
    ["search-none-family", "#search/family/zzzznotfoundzzzz"],
    ["search-none-all", "#search/all/zzzznotfoundzzzz"],
    ["search-short", "#search/project/z"],
    ["topic-missing", "#topic/no-such-topic.md"],
    ["entry-missing", "#entry/no-such-entry"],
  ];
}
