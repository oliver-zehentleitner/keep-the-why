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
  const observers = []; // every ResizeObserver made, and whether it was let go
  w.ResizeObserver = class { constructor() { this.on = true; observers.push(this); } observe() {} disconnect() { this.on = false; } };
  const held = new Map(); // the window's listeners, by type: what a loop holds the page by
  const add = w.addEventListener.bind(w), remove = w.removeEventListener.bind(w);
  w.addEventListener = (t, fn, o) => { if (!held.has(t)) held.set(t, new Set()); held.get(t).add(fn); add(t, fn, o); };
  w.removeEventListener = (t, fn, o) => { held.get(t)?.delete(fn); remove(t, fn, o); };
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
  let subs = 0; const on = scene.on; scene.on = (e, fn) => { subs++; const off = on(e, fn); let done = false; return () => { if (!done) { done = true; subs--; } return off(); }; };
  const G = views.graph.create({ scene, nav, prefs });
  const fg = core.reheatAll(Object.assign({ scale: 1, ox: 0, oy: 0, showEntries: true, showLabels: true }, G.assemble(topics, entries)));
  const counts = () => ({ mouseup: held.get("mouseup")?.size || 0, subs, observers: observers.filter((o) => o.on).length });
  return { w, core, G, fg, scene, counts };
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

// what one running loop holds: the window's mouseup twice (the wake, the end of a drag or pan), five scene events, two
// resize observers
const ONE = { mouseup: 2, subs: 5, observers: 2 };
const plus = (a, b, k = 1) => ({ mouseup: a.mouseup + k * b.mouseup, subs: a.subs + k * b.subs, observers: a.observers + k * b.observers });

for (const motion of ["on", "off"]) {
  test(`a copy replaced lets go of everything it held, at once (motion ${motion})`, () => {
    const { w, G, fg, counts } = realm(motion); frames.length = 0;
    const base = counts();
    const r1 = G.runnerOf(fg); G.run(w.document.body.appendChild(w.document.createElement("canvas")), r1, {});
    assert.deepEqual(counts(), plus(base, ONE), "a running loop holds its listeners and observers");
    G.runnerOf(fg); // shown anew in the side pane
    assert.deepEqual(counts(), base, "the window's listeners, the scene's events and both observers let go");
    frames.shift()?.(16);
    assert.deepEqual(counts(), base, "and its last frame takes nothing back");
  });

  test(`a canvas gone with a frame still asked for lets go at that frame (motion ${motion})`, () => {
    const { w, G, fg, counts } = realm(motion); frames.length = 0;
    const base = counts();
    const c = w.document.body.appendChild(w.document.createElement("canvas"));
    G.run(c, G.runnerOf(fg), {}); c.remove();
    frames.shift()(16);
    assert.deepEqual(counts(), base);
  });

  test(`the graph run again on another canvas retires the loop before (motion ${motion})`, () => {
    const { w, G, fg, counts } = realm(motion); frames.length = 0;
    const base = counts();
    G.run(w.document.body.appendChild(w.document.createElement("canvas")), fg, {});
    G.run(w.document.body.appendChild(w.document.createElement("canvas")), fg, {});
    assert.deepEqual(counts(), plus(base, ONE), "one loop's worth, not two");
  });
}

test("an idle loop whose canvas left the page lets go at the next event that would wake it", () => {
  const { w, G, fg, scene, counts } = realm("off"); frames.length = 0;
  const base = counts();
  const c = w.document.body.appendChild(w.document.createElement("canvas"));
  G.run(c, fg, {});
  for (let i = 0; i < 5000 && frames.length; i++) frames.shift()(16 * (i + 1));
  assert.equal(frames.length, 0, "settled: no frames asked for");
  assert.deepEqual(counts(), plus(base, ONE), "idle, it still holds what it needs to wake");
  c.remove();
  scene.wake();
  assert.deepEqual(counts(), base, "the scene's next event finds it retired");
  assert.equal(frames.length, 0, "and asks for no frame");
});

test("an idle loop whose canvas left the page lets go at the pointer's next mouseup too", () => {
  const { w, G, fg, counts } = realm("off"); frames.length = 0;
  const base = counts();
  const c = w.document.body.appendChild(w.document.createElement("canvas"));
  G.run(c, fg, {});
  for (let i = 0; i < 5000 && frames.length; i++) frames.shift()(16 * (i + 1));
  c.remove(); w.dispatchEvent(new w.Event("mouseup"));
  assert.deepEqual(counts(), base);
});

test("the side pane's copy started leaves the graph's own loop running", () => {
  const { w, G, fg, counts } = realm("off"); frames.length = 0;
  const base = counts();
  G.run(w.document.body.appendChild(w.document.createElement("canvas")), fg, {});
  G.run(w.document.body.appendChild(w.document.createElement("canvas")), G.runnerOf(fg), {});
  assert.deepEqual(counts(), plus(base, ONE, 2), "two loops: the page's graph and the side pane's copy");
});
