/* Keep the Why dashboard — the graph view: a graph drawn on a canvas, its force layout run a step a frame
   (ktw-core.js layoutTick), pointed at, dragged, zoomed and panned, its names placed so they do not cover
   each other, a thought lit and a project spotted, the small graph's own view. It reads what the page shares
   from the scene (ktw-scene.js) — the clock, the focus, the lit thought, the entry selected, the sidebar's
   filter, the layout the stage follows — keeps its settings (motion, the names per group) through prefs,
   and leaves the page through nav: those are all it is given. What the graph holds — its nodes and links,
   which projects, friends and family are in it — the host builds. A classic script on
   globalThis.KeepTheWhy.views.graph, listed in ktw-views.json, tested through the page (canvas-trace.mjs). */
(function (root) {
"use strict";
const { plural, stepLayout, placeShown, seedLayout, carryNode, LAYOUT, linkExistsAt, hostOf, filterActive, entryMatches, fkey, linkFamily, seeDay, supersededDay, parseSupersededBy, readToken } = root.KeepTheWhy.core;

// One graph view per page: create({ scene, nav, prefs }) — the host's scene, navigation and settings.
function create({ scene, nav, prefs }) {
const narrow = () => !!root.matchMedia?.("(max-width: 900px)").matches;
const atClock = (e, ext = false) => scene.atClock(e, ext); // the scene's clock (ktw-scene.js)
const statusNow = (e) => scene.statusNow(e);

// labels per group too — the project's own nodes, the family, the friends, the path — kept per browser, all on by default;
// on a phone only this project's names: the other groups' topic names pile up on a small screen (hub names always show)
const LABEL_DEFAULTS = (() => { const all = !narrow(); return { project: true, family: all, friends: all, friendsFamilies: all, path: all }; })();
let LABELS = (() => { try { return { ...LABEL_DEFAULTS, ...JSON.parse(prefs.get("labels", "{}")) }; } catch { return { ...LABEL_DEFAULTS }; } })(); // a value that is no JSON: the defaults
function setLabels(group, on) { LABELS = { ...LABELS, [group]: on }; prefs.set("labels", JSON.stringify(LABELS)); }
const labelGroupOf = (n) => (n.ext ? (n.unit === "family" ? "family" : String(n.unit || "").startsWith("trail:") ? "path" : n.kin ? "friendsFamilies" : "friends") : n.fam ? "family" : "project");
const labelsOn = (n) => LABELS[labelGroupOf(n)] !== false;

function lightThought(g, t) {
  g.thought = t ? { nodes: new Set(t.steps), pairs: new Set(t.ids.slice(1).map((id, i) => `${id}|${t.ids[i]}`)) } : null;
  // lighting a thought brings entries into view that may be hidden otherwise: those not laid out yet are, as any
  // node newly shown (the step's placeShown), and the small graph refits; letting go only redraws — a refit would
  // move the view the person has set
  if (t && g.miniView) g.miniView.needFit = true;
  g.wake?.(); scene.wake(); // the stage, too, shows what is lit (it follows the scene)
}

// the nodes a project hub stands for: its topics and entries, by the ids the layers give them
function projectNodes(g, hub) {
  const out = new Set([hub]);
  const m = hub.id.match(/^f:(.+):([^:]+)$/); // a layer's hub: f:<unit>:<member key>
  const pre = m ? [`ft:${m[1]}:${m[2]}:`, `fe:${m[1]}:${m[2]}:`] : hub.id.startsWith("p:") && hub.id !== "p:self" ? [`t:${hub.id.slice(2)}:`, `e:${hub.id.slice(2)}:`] : null;
  for (const n of g.nodes) {
    if (n.kind === "project") continue;
    if (pre ? pre.some((x) => n.id.startsWith(x)) : !n.ext && !n.fam) out.add(n);
  }
  return out;
}

function spotIn(G, canonical, root) {
  const same = (n) => n.kind === "project" && n.canonical && fkey(n.canonical) === fkey(canonical) && (root === undefined || (n.root || "") === (root || ""));
  const hub = canonical ? G.nodes.find(same) : null;
  G.spot = hub ? projectNodes(G, hub) : null; G.wake?.();
}

// The graph turns very slowly in its plane — one turn in about six minutes —
// and stops while it is pointed at, dragged or panned. Off with the system's
// reduced-motion setting, or with *motion* in the graph (kept per browser).
const DRIFT_RATE = (2 * Math.PI) / 360000; // radians per millisecond
// motion: on by default, off on a phone (a turning graph is hard to tap, and it keeps the battery busy); a stored choice wins
let DRIFT = (() => { const v = prefs.get("motion"); return v ? v !== "off" : !narrow(); })();
const reducedMotion = () => { try { return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches; } catch { return false; } };
const driftOn = () => DRIFT && !reducedMotion();
function setDrift(on) { DRIFT = on; prefs.set("motion", on ? "on" : "off"); }
// the platform's mark for a hub's name on the canvas, one Path2D per platform
const HOST_PATHS = new Map();
function hostPath(url) {
  const h = hostOf(url); if (!h || typeof Path2D === "undefined") return null;
  if (!HOST_PATHS.has(h.name)) HOST_PATHS.set(h.name, new Path2D(h.path));
  return HOST_PATHS.get(h.name);
}
// How long a frame may spend on the layout. A graph not drawn yet with motion off draws nothing while it settles,
// so it takes a longer slice: the page still answers at about 40 frames a second, and a family of a thousand entries
// settles in about the time its steps take (some 300 steps of 7 to 8 ms in V8). A graph that moves as it is drawn
// takes as many steps as fit in half a frame: one for a large graph, dozens for a small one, which then settles in
// a few frames instead of a few hundred.
const SETTLE_SLICE_MS = 24, FRAME_LAYOUT_MS = 8;
const miniView = (g) => (g.miniView ||= { scale: 1, ox: 0, oy: 0, userMoved: false, needFit: true, fitScale: 0 }); // the small graph's own view of a graph the page may show too
const publishLayout = (g, opts) => scene.publishFrom(g, opts); // the scene's (ktw-scene.js publishFrom)
// A graph run in a second canvas (the side pane's family graph beside the page's): it reads the graph's data as it
// is now, through its prototype, so a rebuild of the graph is what it shows; the layout's lifecycle — alpha,
// placing, relayout and what they leave for the scene — is the graph's own, read and written through, so a placement
// or a relayout settled in either is settled in both and nothing stale is left for the next rebuild. What the view
// sets (its switches, what it lights, its loop) is its own. The graph keeps the copy it has now (`runner`); a copy
// replaced since stops, and the scene takes nothing from it.
const WAKERS = ["mousemove", "mousedown", "wheel", "dblclick", "touchstart", "touchmove", "mouseleave"]; // what wakes a graph's loop
const LIFECYCLE = ["alpha", "placing", "relayout", "relaidOut", "placed", "tree"];
function runnerOf(g, own = {}) {
  g.runner?.stopLoop?.(); // the copy before is done
  const r = Object.create(g);
  for (const k of LIFECYCLE) Object.defineProperty(r, k, { get: () => g[k], set: (v) => { g[k] = v; }, enumerable: true });
  Object.assign(r, { raf: null, wake: null, stopLoop: null }, own, { of: g }); // its loop's own, not the graph's through the prototype
  g.runner = r;
  return r;
}
function runGraph(canvas, g, opts = {}) {
  const mini = !!opts.mini;
  const V = mini ? miniView(g) : g; // the view — zoom and offset — belongs to the canvas: the side pane's small graph keeps its own, the page's survives a visit elsewhere
  const ctx = canvas.getContext("2d");
  const css = getComputedStyle(canvas); // the tokens as the canvas inherits them: a host sets them on any ancestor
  const color = (v) => readToken(css, v);
  let W = 0, H = 0, dpr = window.devicePixelRatio || 1;
  let hover = null, drag = null, pan = null, moved = false;
  const resize = () => { const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  const toWorld = (px, py) => [(px - W / 2 - V.ox) / V.scale, (py - H / 2 - V.oy) / V.scale];
  // zoom limits: never below half of what the fitted view needed — a fixed floor above it made a large family
  // or the globe jump in on the first pinch and refuse to zoom out again
  const minScale = () => Math.min(0.15, (V.fitScale || 0.15) / 2);
  const zoomTo = (ns, px, py) => { ns = Math.min(6, Math.max(minScale(), ns)); const k = ns / V.scale; V.ox = px - (px - V.ox) * k; V.oy = py - (py - V.oy) * k; V.scale = ns; };
  // under the clock an entry is there from the day it was created, a topic from its first entry's day
  const topicAlive = (n) => !scene.day || g.nodes.some((m) => m.kind === "entry" && m.file === n.file && (m.unit || "") === (n.unit || "") && atClock(m.entry, !!m.ext));
  // under the clock every entry follows it, a friend's or a family member's as much as our own (their exports carry
  // the same Git days); one without Git is simply there
  const visible = (n) => n.kind === "topic" ? topicAlive(n) : n.kind !== "entry" ? true : atClock(n.entry, !!n.ext) && (g.showEntries || !!g.thought?.nodes.has(n));
  // a topic-level reference stands in for entry references only while entries are hidden
  const linkOn = (l) => visible(g.nodes[l.s]) && visible(g.nodes[l.t]) && (l.kind !== "xtopic" || !g.showEntries) && linkExistsAt(scene.day, l.day);
  const dim = (n) => n.kind === "entry" && filterActive(scene.filter) && !entryMatches(n.entry, scene.filter);
  const pick = (px, py) => { const [x, y] = toWorld(px, py); let best = null, bd = 1e9; for (const n of g.nodes) { if (!visible(n)) continue; const d = Math.hypot(n.x - x, n.y - y); if (d < Math.max(n.r + 4, 8) / Math.min(V.scale, 1) && d < bd) { best = n; bd = d; } } return best; };
  // a project's name under its hub is a link: pointed at, underlined; clicked, it goes there
  let hoverName = null, nameDown = null;
  const pickName = (px, py) => { const [x, y] = toWorld(px, py); for (const b of g.nameBoxes || []) if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return b.n; return null; };
  canvas.onmousemove = (ev) => {
    const r = canvas.getBoundingClientRect(); const px = ev.clientX - r.left, py = ev.clientY - r.top;
    if (!drag && !pan) { hoverName = pickName(px, py); if (hoverName) { hover = hoverName; canvas.style.cursor = "pointer"; return; } }
    if (drag) { const [x, y] = toWorld(px, py); drag.x = x; drag.y = y; drag.vx = drag.vy = 0; drag.fixed = true; g.alpha = Math.max(g.alpha, 0.3); moved = true; return; }
    if (pan) { V.ox = pan.ox + (px - pan.px); V.oy = pan.oy + (py - pan.py); moved = true; return; }
    hover = pick(px, py); canvas.style.cursor = hover ? "pointer" : "grab";
  };
  canvas.onmousedown = (ev) => { const r = canvas.getBoundingClientRect(); const px = ev.clientX - r.left, py = ev.clientY - r.top; moved = false; V.userMoved = true; nameDown = pickName(px, py); if (nameDown) return; const n = pick(px, py); if (n) drag = n; else pan = { px, py, ox: V.ox, oy: V.oy }; canvas.classList.add("ktw-grabbing"); };
  // a project's hub and its name do the same: go there, in place — the circle used to expand a friend (now the
  // switches' job) or open an overview, and a click on a foreign hub seemed to do nothing. This project's own
  // hub is where the reader already is: a click on it does nothing.
  const walkTo = (n) => (n.self ? null : n.walk ? n.walk() : nav.open(n.href));
  const screenOf = (n) => [W / 2 + g.ox + n.x * g.scale, H / 2 + g.oy + n.y * g.scale];
  const open = (n) => (n.kind === "project" || n.kind === "owner" ? walkTo(n) : n.kind === "entry" && opts.onEntry ? opts.onEntry(n, ...screenOf(n)) : n.kind === "topic" && opts.onTopic ? opts.onTopic(n, ...screenOf(n)) : n.action ? n.action() : nav.open(n.href));
  // the end of a drag, a pan or a click on a name: asks first whether its loop is done (a button let go after the
  // canvas left the page opens nothing); the same function is added and removed
  const onUp = () => { if (retired()) return retire(); if (nameDown) { const n = nameDown; nameDown = null; walkTo(n); return; } if (drag && !moved) open(drag); else if (pan && !moved) opts.onBlank?.(); drag = null; pan = null; canvas.classList.remove("ktw-grabbing"); };
  window.addEventListener("mouseup", onUp); // a drag or a pan ends wherever the button comes up
  canvas.onmouseleave = () => { hover = null; hoverName = null; };
  canvas.onwheel = (ev) => { ev.preventDefault(); V.userMoved = true; const r = canvas.getBoundingClientRect(); zoomTo(V.scale * Math.exp(-ev.deltaY * 0.0012), ev.clientX - r.left - W / 2, ev.clientY - r.top - H / 2); };
  canvas.ondblclick = (ev) => { const r = canvas.getBoundingClientRect(); const n = pick(ev.clientX - r.left, ev.clientY - r.top); if (n) { n.fixed = false; g.alpha = 0.4; } };
  // touch: one finger drags a node or pans (full view only), two fingers pinch-zoom around the point between them
  // and pan with it, a tap opens
  let pinch = null;
  const tpos = (t) => { const r = canvas.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; };
  const tdist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
  const tmid = (ts) => { const [ax, ay] = tpos(ts[0]), [bx, by] = tpos(ts[1]); return [(ax + bx) / 2 - W / 2, (ay + by) / 2 - H / 2]; };
  canvas.addEventListener("touchstart", (ev) => {
    V.userMoved = true; opts.onTouch?.();
    if (ev.touches.length === 2) { const [mx, my] = tmid(ev.touches); pinch = { d: tdist(ev.touches) || 1, scale: V.scale, wx: (mx - V.ox) / V.scale, wy: (my - V.oy) / V.scale }; drag = null; pan = null; return; }
    const [px, py] = tpos(ev.touches[0]); moved = false; nameDown = pickName(px, py); if (nameDown) return; const n = pick(px, py);
    if (n) drag = n; else if (!mini) pan = { px, py, ox: V.ox, oy: V.oy };
  }, { passive: true });
  canvas.addEventListener("touchmove", (ev) => {
    if (pinch && ev.touches.length === 2) {
      const [mx, my] = tmid(ev.touches); const ns = Math.min(6, Math.max(minScale(), pinch.scale * (tdist(ev.touches) / pinch.d)));
      V.scale = ns; V.ox = mx - pinch.wx * ns; V.oy = my - pinch.wy * ns; ev.preventDefault(); return; // the point under the fingers stays under them
    }
    if (!ev.touches.length) return;
    const [px, py] = tpos(ev.touches[0]);
    if (drag) { const [x, y] = toWorld(px, py); drag.x = x; drag.y = y; drag.vx = drag.vy = 0; drag.fixed = true; g.alpha = Math.max(g.alpha, 0.3); moved = true; ev.preventDefault(); }
    else if (pan) { V.ox = pan.ox + (px - pan.px); V.oy = pan.oy + (py - pan.py); moved = true; ev.preventDefault(); }
  }, { passive: false });
  canvas.addEventListener("touchend", (ev) => {
    if (pinch) { if (!ev.touches.length) pinch = null; return; }
    if (nameDown) { const n = nameDown; nameDown = null; if (!moved) walkTo(n); return; }
    if (drag && !moved) open(drag); else if (pan && !moved) opts.onBlank?.();
    drag = null; pan = null;
  });
  const ev = (n) => n.entry.evidence;
  const evColor = { confirmed: color("--ktw-confirmed"), inferred: color("--ktw-inferred"), unknown: color("--ktw-unknown") };
  let lastT = 0, frame = 0, drawn = false; // drawn: this canvas has shown the graph once
  // a loop whose canvas left the page, or a copy the graph replaced since, stops before it touches anything: a frame
  // already asked for must not turn, place or step the graph's nodes with this view's switches, nor write to the
  // lifecycle it shares with the copy that runs now
  // It lets go of everything it holds once (retire): the observers, the scene's events, the window's and the
  // canvas's listeners. A loop learns it is done in three ways: the graph runs again elsewhere, or runs another copy
  // (the next loop retires the one before, runnerOf the copy before); or anything that would wake it — a frame, the
  // scene, a resize, the pointer — finds it retired, so an idle loop whose canvas left the page lets go at the next
  // such event instead of holding the canvas and its graph for good.
  let gone = false;
  const retired = () => gone || !canvas.isConnected || (g.of && g.of.runner !== g);
  const retire = () => {
    if (gone) return; gone = true;
    ro.disconnect(); ro2.disconnect(); for (const off of listening) off();
    window.removeEventListener("mouseup", wake); window.removeEventListener("mouseup", onUp); for (const evn of WAKERS) canvas.removeEventListener(evn, wake);
    if (g.stopLoop === retire) g.stopLoop = null;
    if (g.wake === wake) g.wake = null; // the graph outlives its canvases: it must not hold this one, nor its page, through the wake
    if (g.raf) cancelAnimationFrame(g.raf); g.raf = null; // a frame still asked for is not wanted: called off
  };
  const live = (fn) => (...a) => (retired() ? retire() : fn(...a)); // a listener that first asks whether its loop is done
  function step(now) {
    if (retired()) { retire(); return; }
    const dt = lastT && now ? Math.min(100, now - lastT) : 16; lastT = now || 0;
    const drifting = driftOn() && !hover && !drag && !pan && !pinch;
    if (drifting) { const a = DRIFT_RATE * dt, c = Math.cos(a), sn = Math.sin(a); for (const n of g.nodes) { const x = n.x, y = n.y; n.x = x * c - y * sn; n.y = x * sn + y * c; } }
    // settled and only turning: every other frame is enough
    if (drifting && g.alpha <= LAYOUT.MIN_ALPHA && (frame++ & 1)) { g.raf = canvas.isConnected ? requestAnimationFrame(step) : null; return; }
    const ns = g.nodes.filter(visible);
    // a node shown that is not laid out yet — the day, a lit thought or the entries switch brought it into view — is
    // placed where it hangs now and laid out, alone (core placeShown)
    if (!g.placing && !g.relayout && g.nodes.some((n) => n.seeded && visible(n))) placeShown(g, { visible });
    const was = g.alpha;
    // the forces are ktw-core.js's. With motion off, a graph not shown yet settles first, in slices of a frame's
    // time, and is drawn once, settled and framed; with motion on, it settles a step a frame, as it is drawn.
    if (!drawn && !driftOn() && g.alpha > LAYOUT.MIN_ALPHA) {
      const t0 = performance.now();
      do stepLayout(g, { visible, linkOn }); while (g.alpha > LAYOUT.MIN_ALPHA && performance.now() - t0 < SETTLE_SLICE_MS);
      if (g.alpha > LAYOUT.MIN_ALPHA) {
        // still settling: the canvas says so instead of staying empty
        publishLayout(g); ctx.clearRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.fillStyle = color("--ktw-fg2"); ctx.font = `13px ${color("--ktw-font") || "sans-serif"}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`laying out ${plural(ns.length, "node")}…`, W / 2, H / 2);
        g.raf = canvas.isConnected ? requestAnimationFrame(step) : null; return;
      }
    } else if (g.alpha > LAYOUT.MIN_ALPHA) { const t0 = performance.now(); do stepLayout(g, { visible, linkOn }); while (g.alpha > LAYOUT.MIN_ALPHA && performance.now() - t0 < FRAME_LAYOUT_MS); }
    publishLayout(g);
    const settledNow = was > LAYOUT.MIN_ALPHA && g.alpha <= LAYOUT.MIN_ALPHA;
    // keep the canvas framed on the nodes while they settle, and once more where they came to rest: the small one
    // always, the family graph until the person moves it
    if ((mini || ((opts.fit || V.needFit) && !V.userMoved)) && (g.alpha > 0.01 || V.needFit || settledNow) && W && H) {
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (const n of ns) { minX = Math.min(minX, n.x - n.r); maxX = Math.max(maxX, n.x + n.r); minY = Math.min(minY, n.y - n.r); maxY = Math.max(maxY, n.y + n.r + 18); }
      const pad = mini || narrow() ? 60 : 140;
      // while the graph turns, the fit is centred on the point it turns around (the origin) and sized to the
      // farthest node from it, so nothing leaves the box as it comes round; still, the fit is the nodes' box
      if (ns.length && driftOn()) { let R = 0; for (const n of ns) R = Math.max(R, Math.hypot(n.x, n.y) + n.r + 18); const sw = Math.max(80, 2 * R + pad); V.scale = Math.min(mini ? 2.2 : 1.2, Math.min(W / sw, H / sw)); V.fitScale = V.scale; V.ox = 0; V.oy = 0; }
      else if (ns.length) { const sw = Math.max(80, maxX - minX + pad), sh = Math.max(80, maxY - minY + pad); V.scale = Math.min(mini ? 2.2 : 1.2, Math.min(W / sw, H / sh)); V.fitScale = V.scale; V.ox = -((minX + maxX) / 2) * V.scale; V.oy = -((minY + maxY) / 2) * V.scale; }
      V.needFit = false;
    }
    // draw
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2 + V.ox, H / 2 + V.oy); ctx.scale(V.scale, V.scale);
    const th = g.thought;
    const sp = th ? null : g.spot; // a project pointed at in the legend: its nodes stay, the rest fades
    const focus = th || sp ? null : hover || (opts.focusId && g.index[opts.focusId] != null ? g.nodes[g.index[opts.focusId]] : null) || (!mini && scene.selected ? g.nodes[g.index[`e:${scene.selected}`]] : null);
    const neigh = new Set(); if (focus) { neigh.add(focus); for (const l of g.links) { if (!linkOn(l)) continue; if (g.nodes[l.s] === focus) neigh.add(g.nodes[l.t]); if (g.nodes[l.t] === focus) neigh.add(g.nodes[l.s]); } }
    if (th) for (const n of th.nodes) neigh.add(n);
    if (sp) for (const n of sp) neigh.add(n);
    const stepNode = scene.focus ? ns.find((n) => n.kind === "entry" && (n.entry?.uuid === scene.focus || n.id === scene.focus)) : null;
    if (stepNode) neigh.add(stepNode);
    const onThought = (l) => !!th && (l.kind === "see" || l.kind === "superseded") && (th.pairs.has(`${g.nodes[l.s].id}|${g.nodes[l.t].id}`) || th.pairs.has(`${g.nodes[l.t].id}|${g.nodes[l.s].id}`));
    const LW = { topic: 1.6, ref: 1, family: 2.6, see: 1.5, xtopic: 1.5, superseded: 1.3, trail: 1.4, owner: 1.6 };
    const DASH = { member: [2, 3], hub: [2, 3], family: [9, 6], superseded: [5, 4], trail: [2, 6], owner: [1, 4] };
    for (const l of g.links) {
      if (!linkOn(l)) continue;
      const a = g.nodes[l.s], b = g.nodes[l.t]; const hi = (focus && (a === focus || b === focus)) || onThought(l) || (sp && sp.has(a) && sp.has(b));
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.lineWidth = (LW[l.kind] || 0.6) / V.scale; ctx.setLineDash((DASH[l.kind] || []).map((v) => v / V.scale));
      const base = l.kind === "see" || l.kind === "xtopic" ? (l.color || color("--ktw-accent2")) : l.kind === "superseded" || l.kind === "family" || l.kind === "trail" || l.kind === "owner" ? color("--ktw-fg3") : color("--ktw-line");
      ctx.strokeStyle = hi ? (l.kind === "see" || l.kind === "xtopic" ? color("--ktw-fg") : color("--ktw-accent2")) : base; ctx.globalAlpha = (focus || th || sp) && !hi ? (th ? 0.12 : 0.25) : l.kind === "see" || l.kind === "xtopic" ? 0.85 : 1; if (onThought(l)) ctx.lineWidth = 3 / V.scale; ctx.stroke();
      // the path is the way walked, not a citation: an arrow at its middle points the way it went, toward where the reader is now
      if (l.kind === "trail") {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, ang = Math.atan2(b.y - a.y, b.x - a.x), s = 9 / V.scale;
        ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(mx + Math.cos(ang) * s, my + Math.sin(ang) * s);
        ctx.lineTo(mx + Math.cos(ang + 2.5) * s, my + Math.sin(ang + 2.5) * s); ctx.lineTo(mx + Math.cos(ang - 2.5) * s, my + Math.sin(ang - 2.5) * s); ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle; ctx.fill();
      }
    }
    ctx.setLineDash([]);
    const drawOrder = sp ? [...ns.filter((n) => !sp.has(n)), ...ns.filter((n) => sp.has(n))] : ns; // the spotted project on top
    for (const n of drawOrder) {
      const faded = ((focus || th || sp) && !neigh.has(n)) || dim(n);
      ctx.globalAlpha = faded ? 0.18 : 1;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      if (n.kind === "project") { ctx.fillStyle = color("--ktw-bg"); ctx.fill(); ctx.lineWidth = 3.5 / V.scale; ctx.strokeStyle = n.color; if (n.chain) ctx.setLineDash([8 / V.scale, 3 / V.scale, 2 / V.scale, 3 / V.scale]); else if (n.friend) ctx.setLineDash([5 / V.scale, 3 / V.scale]); else if (n.trail) ctx.setLineDash([1.5 / V.scale, 3 / V.scale]); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 0.38, 0, Math.PI * 2); ctx.fillStyle = n.color; ctx.fill(); }
      else if (n.kind === "topic") { ctx.fillStyle = n.color || color("--ktw-accent"); ctx.fill(); }
      else if (n.kind === "owner") { ctx.fillStyle = color("--ktw-bg"); ctx.fill(); ctx.lineWidth = 1.5 / V.scale; ctx.strokeStyle = color("--ktw-fg3"); ctx.stroke(); ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 0.72, 0, Math.PI * 2); ctx.stroke(); } // the inner ring in the graph's units: a radius from the zoom went negative far out, and the canvas throws on that
      else { const st = statusNow(n.entry); const sup = st === "superseded"; ctx.fillStyle = sup ? color("--ktw-bg") : evColor[ev(n)] || color("--ktw-muted"); ctx.fill(); if (sup) { ctx.lineWidth = 1.2 / V.scale; ctx.strokeStyle = evColor[ev(n)] || color("--ktw-fg3"); ctx.stroke(); } if (st === "open" || st === "needs-review" || st === "pending-confirmation") { ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 2.5 / V.scale, 0, Math.PI * 2); ctx.lineWidth = 1.2 / V.scale; ctx.strokeStyle = color(`--ktw-status-${st}`); ctx.stroke(); } }
      if (n === focus) { ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 4 / V.scale, 0, Math.PI * 2); ctx.lineWidth = 1.5 / V.scale; ctx.strokeStyle = color("--ktw-fg"); ctx.stroke(); }
      if (n === stepNode) { ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 7 / V.scale, 0, Math.PI * 2); ctx.lineWidth = 3 / V.scale; ctx.strokeStyle = color("--ktw-accent2"); ctx.stroke(); ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 12 / V.scale, 0, Math.PI * 2); ctx.lineWidth = 1 / V.scale; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    const anyLabels = (g.showLabels && Object.values(LABELS).some(Boolean)) || focus || th || stepNode;
    g.nameBoxes = [];
    {
      // which names to draw: first the ones that must show (the focus, the step, a thought, the name pointed at), then the
      // focus's neighbours, project names (this project first), topics, entries — bigger nodes first within each. A name
      // that would cover one already drawn is left out, so a dense graph shows fewer names instead of a pile of text;
      // zooming in makes room and brings them back.
      const cand = [];
      for (const n of ns) {
        const hubName = n.kind === "project" || n.kind === "owner";
        if (sp) { if (!sp.has(n)) continue; if (!hubName && n.kind !== "topic" && !(V.scale > 1.6)) continue; } // a spotted project: its names alone
        if (!hubName && !anyLabels && !sp) continue;
        const lab = sp ? true : g.showLabels && labelsOn(n);
        const show = sp || n === stepNode || (th && th.nodes.has(n)) ? true : hubName ? true : n.kind === "topic" ? (mini ? neigh.has(n) || n === focus || g.nodes.filter((x) => x.kind === "topic").length <= 12 : lab || neigh.has(n)) : (focus && (neigh.has(n) || n === focus)) || (!mini && lab && V.scale > 1.6);
        if (!show) continue;
        const faded = (focus || th) && !neigh.has(n) && n !== focus; if (faded && !hubName) continue;
        const must = n === focus || n === stepNode || n === hoverName || (th && th.nodes.has(n));
        const rank = must ? 0 : faded ? 5 : focus && neigh.has(n) ? 1 : hubName ? (n.self ? 2 : 3) : n.kind === "topic" ? 4 : 6;
        cand.push({ n, hubName, faded, must, rank });
      }
      cand.sort((a, b) => a.rank - b.rank || b.n.r - a.n.r);
      const placed = [], maxLen = narrow() ? 32 : 48, pad = 2 / V.scale;
      const free = (b) => !placed.some((p) => b.x0 < p.x1 + pad && b.x1 > p.x0 - pad && b.y0 < p.y1 + pad && b.y1 > p.y0 - pad);
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (const { n, hubName, faded, must } of cand) {
        ctx.font = hubName ? `600 ${(mini ? 12 : 13) / V.scale}px ${color("--ktw-font") || "sans-serif"}` : `${(mini ? 11 : 12) / V.scale}px ${color("--ktw-font") || "sans-serif"}`;
        const lbl = n.label.replace(/`/g, ""); const txt = lbl.length > maxLen ? lbl.slice(0, maxLen - 2) + "…" : lbl;
        const mark = hubName ? hostPath(n.canonical) : null; const iw = mark ? (mini ? 12 : 13) / V.scale : 0; const gap = mark ? 4 / V.scale : 0;
        const tw = ctx.measureText(txt).width; const y = n.y + n.r + 3 / V.scale;
        const left = n.x - (tw + iw + gap) / 2; const tx = left + iw + gap + tw / 2; // the mark before the name, the pair centred
        const box = { x0: left - 3 / V.scale, y0: y - 1 / V.scale, x1: tx + tw / 2 + 3 / V.scale, y1: y + 15 / V.scale };
        if (!must && !free(box)) continue;
        placed.push(box);
        ctx.fillStyle = color("--ktw-bg"); ctx.globalAlpha = faded ? 0.4 : 0.75; ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, 15 / V.scale); ctx.globalAlpha = faded ? 0.5 : 1;
        ctx.fillStyle = n.kind === "entry" ? color("--ktw-fg2") : hubName && n === hoverName ? color("--ktw-accent2") : color("--ktw-fg"); ctx.fillText(txt, tx, y);
        if (mark) { ctx.save(); ctx.translate(left, y + 0.5 / V.scale); ctx.scale(iw / 24, iw / 24); ctx.fill(mark); ctx.restore(); }
        if (hubName) {
          g.nameBoxes.push({ n, ...box });
          if (n === hoverName) { ctx.fillRect(tx - tw / 2, y + 14 / V.scale, tw, 1 / V.scale); }
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    drawn = true;
    if (retired()) { retire(); return; } // gone while it drew
    const busy = g.alpha > LAYOUT.MIN_ALPHA || drag || pan || pinch || hover || driftOn();
    g.raf = busy ? requestAnimationFrame(step) : null; // idle: no frames until something happens
  }
  const wake = live(() => { if (!g.raf) g.raf = requestAnimationFrame(step); });
  // the scene's changes this graph follows, until its loop is done
  const listening = [
    scene.on("day", wake), // what the day brings into view is laid out by the step (placeShown); the rest stays
    scene.on("focus", wake),
    scene.on("thought", live((t) => lightThought(g, t))),
    scene.on("spot", live((canonical, root) => spotIn(g, canonical, root))),
    scene.on("wake", wake),
  ];
  for (const evn of WAKERS) canvas.addEventListener(evn, wake, { passive: true });
  window.addEventListener("mouseup", wake);
  g.wake = wake;
  ro.observe(canvas); // re-observe after the resize handler above; a resize wakes the loop
  const ro2 = new ResizeObserver(live(() => { resize(); if ((mini || opts.fit) && !V.userMoved) V.needFit = true; wake(); })); ro2.observe(canvas); // reframed, not laid out again
  if (g.raf) cancelAnimationFrame(g.raf);
  g.stopLoop?.(); g.stopLoop = retire; // this graph's loop before, on another canvas, is done
  g.raf = requestAnimationFrame(step);
}

// ---- the graph's data: nodes and links from topics and entries, and the neighbourhood of a topic or an entry. Links
// go through nav; `prev` holds the nodes of a graph drawn before, so a node keeps its place. A node new to the
// graph starts where ktw-core.js seedLayout puts it, once the links are known.
function seedNode(n, prev) {
  const p = prev[n.id];
  if (p) carryNode(n, p);
  else { n.x = n.y = undefined; n.vx = n.vy = 0; }
  return n;
}
function assemble(topics, entries, prev = {}) {
  const nodes = []; const links = []; const index = {};
  const add = (n) => { index[n.id] = nodes.length; nodes.push(seedNode(n, prev)); };
  for (const t of topics) add({ id: `t:${t.file}`, kind: "topic", label: t.title, file: t.file, r: 10 + Math.sqrt(t.entries) * 3.2, href: nav.href({ view: "topic", file: t.file }) });
  for (const e of entries) add({ id: `e:${e.id}`, kind: "entry", label: e.title, file: e.file, entry: e, r: 4.2, href: nav.href({ view: "entry", uuid: e.uuid || e.id }) });
  for (const e of entries) {
    if (index[`t:${e.file}`] != null) links.push({ s: index[`e:${e.id}`], t: index[`t:${e.file}`], kind: "member", len: 46 });
    for (const f of e.refs) if (index[`t:${f}`] != null) links.push({ s: index[`e:${e.id}`], t: index[`t:${f}`], kind: "ref", len: 120 });
  }
  const seen = new Set();
  for (const t of topics) for (const f of t.refs_out) { if (index[`t:${f}`] == null) continue; const k = [t.file, f].sort().join("|"); if (seen.has(k)) continue; seen.add(k); links.push({ s: index[`t:${t.file}`], t: index[`t:${f}`], kind: "topic", len: 170 }); }
  // See and Superseded by between entries, by Id; between their topics while entries are hidden
  const tpairs = new Set();
  for (const x of linkFamily([{ key: "self", role: "self", state: { entries } }]).xrefs) {
    const a = entries.find((e) => e.id === x.from.id), b = entries.find((e) => e.id === x.to.id);
    const s = index[`e:${x.from.id}`], t = index[`e:${x.to.id}`];
    if (s == null || t == null) continue;
    // the day the link came to be, for the clock: a See from its as-of day, a Superseded by from the status change
    const day = x.kind === "see" ? seeDay(a, (a.see || []).find((r) => r?.uuid === b.uuid)) : supersededDay(a);
    links.push({ s, t, kind: x.kind, len: 150, day });
    const ts = index[`t:${a.file}`], tt = index[`t:${b.file}`]; const k = `${ts}|${tt}`;
    if (a.file !== b.file && ts != null && tt != null && !tpairs.has(k)) { tpairs.add(k); links.push({ s: ts, t: tt, kind: "xtopic", len: 200, day }); }
  }
  seedLayout(nodes, links);
  return { nodes, links, index };
}
// the Ids an entry points at, and the entries of `list` that point at it
const pointsAt = (e) => [...(e.see || []).map((r) => r?.uuid), e.superseded_by ? parseSupersededBy(e.superseded_by)?.uuid : null].filter(Boolean);
const linkedTo = (e, list) => list.filter((x) => x !== e && ((e.uuid && pointsAt(x).includes(e.uuid)) || (x.uuid && pointsAt(e).includes(x.uuid))));
function buildTopicSubgraph(t, prev = {}) {
  // the topic with its entries, plus the topics it references and the ones referencing it (with the entries that do)
  const files = new Set([t.file, ...t.refs_out, ...t.refs_in]);
  const topics = scene.state.topics.filter((x) => files.has(x.file));
  const entries = scene.state.entries.filter((x) => x.file === t.file || x.refs.includes(t.file));
  return Object.assign({ scale: 1, ox: 0, oy: 0, showEntries: true, showLabels: true, alpha: 1 }, assemble(topics, entries, prev));
}
function buildSubgraph(e, prev = {}) {
  // the entry, its topic and siblings, the topics it references, and the entries elsewhere that reference its topic
  const files = new Set([e.file, ...e.refs]);
  const back = scene.state.entries.filter((x) => x.refs.includes(e.file));
  const linked = linkedTo(e, scene.state.entries); // See / Superseded by, either direction
  for (const b of [...back, ...linked]) files.add(b.file);
  const topics = scene.state.topics.filter((t) => files.has(t.file));
  const entries = scene.state.entries.filter((x) => x.file === e.file || x.id === e.id || back.includes(x) || linked.includes(x));
  return Object.assign({ scale: 1, ox: 0, oy: 0, showEntries: true, showLabels: true, alpha: 1 }, assemble(topics, entries, prev));
}

return Object.freeze({
  assemble, buildSubgraph, buildTopicSubgraph,
  run: runGraph, runnerOf, lightThought, spotIn, projectNodes, miniView, publishLayout, hostPath,
  driftOn, setDrift, labels: () => LABELS, setLabels, labelsOn,
});
}

const KTW = (root.KeepTheWhy = root.KeepTheWhy || {});
KTW.views = KTW.views || {};
KTW.views.graph = Object.freeze({ create });
})(globalThis);
