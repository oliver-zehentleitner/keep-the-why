/* Keep the Why dashboard — the scene: what every view on a page shares, and nothing that draws. The state
   shown and the project's own, the day the clock stands at, the entry or thought in focus, a project
   pointed at, the scope, and the layout the graph has found, with subscriptions so a view hears when one
   of them changes. A view reads the scene and asks it to change; it does not reach into another view.
   One scene per page, made by the host. A classic script on globalThis.KeepTheWhy.scene, listed in
   ktw-views.json after the core, tested with node:test (tests/web/scene.test.mjs). */
(function (root) {
"use strict";

// Events a view can subscribe to, and what comes with them:
//   day      (day, { grew })  the clock moved; `grew`: the set of entries shown changed, so a layout may settle again
//   focus    (ref)            an entry pointed at (an Id or a node id), or null
//   thought  (t)              a thought chain lit, or null
//   spot     (canonical, root) a project pointed at outside the graph, or null
//   scope    (scope)          "project" or "family"
//   layout   ()               the layout source published positions
//   wake     ()               something every view should redraw for
function create({ state = null, self = null, day = null, scope = "project" } = {}) {
  const subs = new Map();
  const emit = (event, ...args) => { for (const fn of [...(subs.get(event) || [])]) fn(...args); };
  const layout = new Map(); // node id -> { x, y }, entries and topics
  const scene = {
    state, self, day, scope,
    focus: null, thought: null,
    selected: null, // the entry the page shows in its details, by id
    filter: { status: "", evidence: "", author: "" }, // the sidebar's: what is not matched is dimmed (core entryMatches)
    layout, layoutSettled: false,
    // the graph whose positions the layout follows; null: none is drawn, and the layout is settled here (layoutFor)
    layoutSource: null,
    on(event, fn) {
      if (!subs.has(event)) subs.set(event, new Set());
      subs.get(event).add(fn);
      return () => subs.get(event)?.delete(fn);
    },
    setDay(d, { grew = false } = {}) { scene.day = d; emit("day", d, { grew }); },
    setFocus(ref) { scene.focus = ref || null; emit("focus", scene.focus); },
    setThought(t) { scene.thought = t || null; emit("thought", scene.thought); },
    spot(canonical, rt) { emit("spot", canonical, rt); },
    setScope(v) { scene.scope = v; emit("scope", v); },
    wake() { emit("wake"); },
    // The layout source's positions: copied while it settles, then kept — from then on only a node not yet
    // known is added, so the graph nudged awake later (a thought pointed at) does not walk the copy along.
    publishLayout(nodes, { settled = false } = {}) {
      for (const n of nodes) if ((n.kind === "entry" || n.kind === "topic") && (!scene.layoutSettled || !layout.has(n.id))) layout.set(n.id, { x: n.x, y: n.y });
      if (settled) scene.layoutSettled = true;
      emit("layout");
    },
    resetLayout(source = null) { layout.clear(); scene.layoutSettled = false; scene.layoutSource = source; },
    // The layout for these nodes and links: the source's, or — with no source — settled here at once, without a
    // canvas (core settleLayout), so a view that needs positions gets them with no graph drawn.
    layoutFor(nodes, links, opts = {}) {
      if (!scene.layoutSource && !scene.layoutSettled) {
        root.KeepTheWhy.core.settleLayout(nodes, links, opts);
        scene.publishLayout(nodes, { settled: true });
      }
      return layout;
    },
  };
  return scene;
}

const KTW = (root.KeepTheWhy = root.KeepTheWhy || {});
KTW.scene = Object.freeze({ create });
})(globalThis);
