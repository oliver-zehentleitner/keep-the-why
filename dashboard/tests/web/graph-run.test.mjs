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
  let ids = 0; // a frame is called off by its id, as a browser does
  w.requestAnimationFrame = (fn) => { const id = ++ids; frames.push(Object.assign((t) => fn(t), { id })); return id; };
  w.cancelAnimationFrame = (id) => { const i = frames.findIndex((f) => f.id === id); if (i >= 0) frames.splice(i, 1); };
  const observers = []; // every ResizeObserver made, and whether it was let go
  w.ResizeObserver = class { constructor() { this.on = true; observers.push(this); } observe() {} disconnect() { this.on = false; } };
  const onCanvas = new Map(); // each canvas's listeners, as [type, fn]
  const cAdd = w.HTMLCanvasElement.prototype.addEventListener, cRemove = w.HTMLCanvasElement.prototype.removeEventListener;
  w.HTMLCanvasElement.prototype.addEventListener = function (t, fn, o) { if (!onCanvas.has(this)) onCanvas.set(this, []); onCanvas.get(this).push([t, fn]); return cAdd.call(this, t, fn, o); };
  w.HTMLCanvasElement.prototype.removeEventListener = function (t, fn, o) { const l = onCanvas.get(this) || []; const i = l.findIndex(([a, b]) => a === t && b === fn); if (i >= 0) l.splice(i, 1); return cRemove.call(this, t, fn, o); };
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
  const canvasTypes = (c) => (onCanvas.get(c) || []).map(([t]) => t).sort();
  return { w, core, G, fg, scene, counts, canvasTypes };
}
const snap = (fg) => ({ at: fg.nodes.map((n) => [n.x, n.y]), alpha: fg.alpha, relayout: fg.relayout, placing: !!fg.placing });

for (const motion of ["on", "off"]) {
  test(`a frame asked for by a copy the graph replaced since touches nothing (motion ${motion})`, () => {
    const { w, G, fg } = realm(motion); frames.length = 0;
    const a = w.document.body.appendChild(w.document.createElement("canvas"));
    const r1 = G.runnerOf(fg, { showEntries: true }); G.run(a, r1, {});
    assert.equal(frames.length, 1, "the old copy asked for a frame");
    const pending = frames[0];
    G.runnerOf(fg, { showEntries: true }); // the side pane shown anew: the graph runs another copy now
    assert.equal(frames.length, 0, "the old copy's frame is called off");
    const before = snap(fg);
    pending(16); // and should a browser run it all the same, it does nothing
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
    const pending = frames[0];
    G.runnerOf(fg); // shown anew in the side pane
    assert.deepEqual(counts(), base, "the window's listeners, the scene's events and both observers let go");
    assert.equal(frames.length, 0, "its frame called off");
    pending(16);
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

// a canvas keeps, once its loop is done, only the touch handlers that are its own: the loop's wakers are gone
const OWN_TOUCH = ["touchend", "touchmove", "touchstart"];
const WAKE_TYPES = ["dblclick", "mousedown", "mouseleave", "mousemove", "touchmove", "touchstart", "wheel"];

for (const motion of ["on", "off"]) {
  test(`a copy replaced while its canvas is still on the page takes its wakers off it, and lets go of the graph (motion ${motion})`, () => {
    const { w, G, fg, canvasTypes } = realm(motion); frames.length = 0;
    const a = w.document.body.appendChild(w.document.createElement("canvas"));
    const r1 = G.runnerOf(fg); G.run(a, r1, {});
    assert.deepEqual(canvasTypes(a), [...OWN_TOUCH, ...WAKE_TYPES].sort(), "running: its wakers and its touch handlers");
    G.runnerOf(fg);
    assert.ok(a.isConnected, "the old canvas is still on the page");
    assert.deepEqual(canvasTypes(a), OWN_TOUCH, "the wakers are gone");
    assert.equal(r1.wake, null, "the old copy holds no wake"); assert.equal(r1.stopLoop, null, "nor its stop");
  });

  test(`the graph keeps no wake and no stop of a loop whose canvas left the page (motion ${motion})`, () => {
    const { w, G, fg, scene, canvasTypes } = realm(motion); frames.length = 0;
    const c = w.document.body.appendChild(w.document.createElement("canvas"));
    G.run(c, fg, {});
    assert.equal(typeof fg.wake, "function"); assert.equal(typeof fg.stopLoop, "function");
    c.remove(); scene.wake();
    assert.equal(fg.wake, null, "the graph outlives the canvas: it must not hold it through the wake");
    assert.equal(fg.stopLoop, null);
    assert.deepEqual(canvasTypes(c), OWN_TOUCH);
  });

  test(`the graph run again keeps the new loop's wake, not the old one's nor none (motion ${motion})`, () => {
    const { w, G, fg } = realm(motion); frames.length = 0;
    G.run(w.document.body.appendChild(w.document.createElement("canvas")), fg, {});
    const first = fg.wake;
    G.run(w.document.body.appendChild(w.document.createElement("canvas")), fg, {});
    assert.ok(typeof fg.wake === "function" && fg.wake !== first, "the loop before retired after the new one took the graph: the new wake stays");
    assert.equal(typeof fg.stopLoop, "function");
  });
}

// press on a topic, the canvas leaves the page, the button comes up: nothing opens
function pressTopic(env, { remove }) {
  const { w, G, fg } = env; frames.length = 0;
  const c = w.document.body.appendChild(w.document.createElement("canvas"));
  const opened = []; G.run(c, fg, { onTopic: (n) => opened.push([n.id, c.isConnected]) });
  frames.shift()(16); // a frame: the canvas has its size, the view its frame
  const t = fg.nodes.find((n) => n.kind === "topic");
  const at = { clientX: 300 + fg.ox + t.x * fg.scale, clientY: 200 + fg.oy + t.y * fg.scale, button: 0, bubbles: true };
  c.dispatchEvent(new w.MouseEvent("mousedown", at));
  if (remove) c.remove();
  w.dispatchEvent(new w.MouseEvent("mouseup", at));
  return opened;
}
test("a topic pressed opens on the button's release while its canvas is on the page", () => {
  const opened = pressTopic(realm("off"), { remove: false });
  assert.equal(opened.length, 1, "the press reaches the topic: the test reaches the path it guards");
});
test("a topic pressed opens nothing if its canvas left the page before the button came up", () => {
  const opened = pressTopic(realm("off"), { remove: true });
  assert.deepEqual(opened, [], "no open for a canvas that is gone");
});
