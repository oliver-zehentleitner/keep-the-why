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
//   thought  (t)              a thought chain lit while pointed at, or null (light)
//   pin      (key)            the thought held — its ids joined by "|" — changed, or let go (null) (setThought)
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
    pin: null, // the thought held, by its ids joined with "|" (setThought); lighting one in passing does not change it
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
    // The clock's view of an entry. An entry of the project shown goes by its repository: with one, an entry
    // without a Git date is not committed yet and exists today only; a foreign entry's export came from a
    // repository. atClock: is it there on the day shown (today with no clock); statusNow: its status then.
    hasRepo(e) { return e?.origin || e?.project ? true : !!scene.state?.project?.git?.available; },
    atClock(e, ext = false) { return root.KeepTheWhy.core.existsAt(e, scene.day, ext || scene.hasRepo(e)); },
    statusNow(e) { return scene.day ? root.KeepTheWhy.core.statusAt(e, scene.day, scene.hasRepo(e)) || e.status : e.status; },
    setDay(d, { grew = false } = {}) { scene.day = d; emit("day", d, { grew }); },
    setFocus(ref) { scene.focus = ref || null; emit("focus", scene.focus); },
    light(t) { scene.thought = t || null; emit("thought", scene.thought); }, // pointed at: lit in every graph, held by none
    // hold a thought, or let go of the one held (null); the views that list or light the held one hear `pin`
    setThought(t) { const key = t ? t.ids.join("|") : null; if (key === scene.pin) return; scene.pin = key; emit("pin", key); },
    spot(canonical, rt) { emit("spot", canonical, rt); },
    setScope(v) { scene.scope = v; emit("scope", v); },
    wake() { emit("wake"); },
    // The layout source's positions. A node's place is copied while it is being laid out: the whole graph on its
    // first settle and on a relayout, the nodes a placement lays out while it runs and once more where they came
    // to rest. A node laid out stays as it was copied, so the graph turning, or woken for a lit thought, does not
    // walk the copy along. `only(n)`: the nodes that moved; without it, all of them.
    publishLayout(nodes, { settled = false, only = null } = {}) {
      for (const n of nodes) if ((n.kind === "entry" || n.kind === "topic") && (!only || only(n) || !layout.has(n.id))) layout.set(n.id, { x: n.x, y: n.y });
      if (settled) scene.layoutSettled = true;
      emit("layout");
    },
    // a graph that is the layout source — or a copy sharing its nodes (`of`) — publishes after a step what that
    // step moved (core stepLayout's `placing`, `relayout`, `placed`, `relaidOut`); settled once it is at rest — a
    // copy shares the source's lifecycle; a step that laid nothing out (the graph turning, a wake) publishes nothing but a
    // node the copy does not know yet
    publishFrom(g, { force = false } = {}) {
      const src = scene.layoutSource;
      if (!src || (g !== src && !(g.of === src && src.runner === g))) return; // the source, or the copy it runs now
      const whole = force || !scene.layoutSettled || g.relayout || g.relaidOut;
      const placing = g.placing ? (n) => !!n.seeded : null, placed = g.placed;
      const unknown = !whole && !placing && !placed && src.nodes.some((n) => (n.kind === "entry" || n.kind === "topic") && !layout.has(n.id));
      if (!whole && !placing && !placed && !unknown) return;
      const settled = src.alpha <= root.KeepTheWhy.core.LAYOUT.MIN_ALPHA; // a copy's alpha is the source's (ktw-graph.js runnerOf)
      scene.publishLayout(src.nodes, { settled, only: whole ? null : (n) => !!(placing?.(n) || placed?.has(n)) });
      g.placed = null; g.relaidOut = false;
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
