// Tests for the graph's loop (ktw-graph.js runGraph) around its end: a frame asked for before a canvas left the page,
// or before the graph replaced its side-pane copy (runnerOf), runs and must touch nothing — the nodes, which the copy
// shares with the graph, the layout's lifecycle, nor the frames asked for. jsdom, with a canvas that draws nothing
// and frames run by hand; the library files are loaded, in the manifest's order, into the jsdom window.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { JSDOM } from "jsdom";

const frames = []; // the frames asked for, run by hand
function realm(motion) {
  const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.requestAnimationFrame = (fn) => frames.push(fn);
  w.cancelAnimationFrame = () => {};
  w.ResizeObserver = class { observe() {} disconnect() {} };
  w.matchMedia = () => ({ matches: false });
  w.Path2D = class {};
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k === "measureText" ? (s) => ({ width: String(s).length * 6 }) : () => {}), set: () => true });
  w.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 600, height: 400, right: 600, bottom: 400 });
  const ctx = dom.getInternalVMContext();
  for (const name of ["ktw-core.js", "ktw-ui.js", "ktw-scene.js", "ktw-graph.js"]) {
    const file = new URL(`../../ktw_dashboard/web/${name}`, import.meta.url);
    vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: file.pathname });
  }
  const { core, scene: sceneLib, views } = w.KeepTheWhy;
  const nav = { href: (r) => core.routes.format(r), go: () => {}, current: () => ({ view: "graph" }) };
  const prefs = { get: (k, f) => (k === "motion" ? motion : f), set: () => {} };
  const topics = [], entries = [];
  for (let t = 0; t < 4; t++) {
    topics.push({ file: `t${t}.md`, title: `T${t}`, entries: 6, refs_out: t ? [`t${t - 1}.md`] : [], refs_in: [] });
    for (let e = 0; e < 6; e++) entries.push({ id: `t${t}.md#e${e}`, file: `t${t}.md`, uuid: `00000000-0000-4000-8000-0000000${t}${e}000`.slice(0, 36), title: `E${t}.${e}`, refs: [], see: [], git: {} });
  }
  const scene = sceneLib.create({ state: { topics, entries } });
  const G = views.graph.create({ scene, nav, prefs });
  const fg = core.reheatAll(Object.assign({ scale: 1, ox: 0, oy: 0, showEntries: true, showLabels: true }, G.assemble(topics, entries)));
  return { w, core, G, fg };
}
const snap = (fg) => ({ at: fg.nodes.map((n) => [n.x, n.y]), alpha: fg.alpha, relayout: fg.relayout, placing: !!fg.placing });

for (const motion of ["on", "off"]) {
  test(`a frame asked for by a copy the graph replaced since touches nothing (motion ${motion})`, () => {
    const { w, G, fg } = realm(motion); frames.length = 0;
    const a = w.document.body.appendChild(w.document.createElement("canvas"));
    const r1 = G.runnerOf(fg, { showEntries: true }); G.run(a, r1, {});
    assert.equal(frames.length, 1, "the old copy asked for a frame");
    G.runnerOf(fg, { showEntries: true }); // the side pane shown anew: the graph runs another copy now
    const before = snap(fg);
    frames.shift()(16);
    assert.deepEqual(snap(fg), before, "no node moved, the lifecycle is as it was");
    assert.equal(frames.length, 0, "and the old copy asks for no more frames");
  });

  test(`a frame asked for before its canvas left the page touches nothing (motion ${motion})`, () => {
    const { w, G, fg } = realm(motion); frames.length = 0;
    const b = w.document.body.appendChild(w.document.createElement("canvas"));
    const r = G.runnerOf(fg); G.run(b, r, {});
    b.remove();
    const before = snap(fg);
    frames.shift()(16);
    assert.deepEqual(snap(fg), before, "no node moved, the lifecycle is as it was");
    assert.equal(frames.length, 0, "no frame asked for");
    b.dispatchEvent(new w.Event("mousemove")); w.dispatchEvent(new w.Event("mouseup"));
    assert.equal(frames.length, 0, "and its listeners are gone: nothing wakes it");
  });
}

test("the copy that runs now does lay the graph out", () => {
  const { w, G, fg } = realm("off"); frames.length = 0;
  const c = w.document.body.appendChild(w.document.createElement("canvas"));
  const r = G.runnerOf(fg); G.run(c, r, {});
  const before = snap(fg);
  frames.shift()(16);
  assert.ok(fg.alpha < before.alpha, "it steps the shared layout");
});
