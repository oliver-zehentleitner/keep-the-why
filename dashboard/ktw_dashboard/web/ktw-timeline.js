/* Keep the Why dashboard — the timeline's stage: the project's entries as cards in perspective, time running
   into the depth, the day shown at the front (the scene's clock). Its scene and camera, the layout that keeps
   the cards apart, the painter, the pointer and the keys, and the legend under it. The cards stand where the
   graph beside them stands its nodes (the scene's layout), or in a lane per topic. It reads the scene — the
   state, the clock, the focus, the held thought, the filter, the layout — keeps its two settings (where a card
   stands, which foreign entries show) through prefs, and builds its DOM from ktw-ui.js; that is all it is
   given. The page around it — the bars, the slider, the card, the play loop — is the host's. A classic script
   on globalThis.KeepTheWhy.views.timeline, listed in ktw-views.json, traced on the canvas (canvas-trace.mjs). */
(function (root) {
"use strict";
const { TYPE_KINDS, TYPE_TOKENS, SHELF, addDays, createdOn, dayDiff, daySpan, existsAt, statusAt, linkExistsAt, logDepth, markLinked, percentileBox, pushApart, stageCards, stageHeight, stageLanes, stageLinks, stampLabel, typeKind, filterActive, entryMatches, plural, timeGrid, todayISO, paletteToken } = root.KeepTheWhy.core;
const { el, setKids, pill, statusPill, evPill, typePills, typeGlyphSvg } = root.KeepTheWhy.ui;

// One stage view per page: create({ scene, nav, prefs }). The page's scene is `shared` here: `scene` is the stage's
// own (stageScene — its cards, lanes and links), as it always was.
function create({ scene: shared, nav, prefs }) {
const narrow = () => !!root.matchMedia?.("(max-width: 900px)").matches;
let ROOT_STYLE = null;
const token = (name) => (ROOT_STYLE ||= getComputedStyle(document.documentElement)).getPropertyValue(name).trim();
const isShownByFilter = (e) => entryMatches(e, shared.filter);
const topicOf = (file) => shared.state.topics.find((t) => t.file === file);
const byId = () => Object.fromEntries(shared.state.entries.map((e) => [e.id, e]));
// where a card stands: where its node stands in the graph beside, or in a lane per topic — kept per browser
let ARRANGE = prefs.get("stage-arrange") || "graph";
const setArrange = (v) => { ARRANGE = v; prefs.set("stage-arrange", v); };
// which other repositories' entries show: the ones a chain links to this project's (the default), all, or none
let FOREIGN = prefs.get("stage-foreign") || "linked";
const setForeign = (v) => { FOREIGN = v; prefs.set("stage-foreign", v); };
const foreignShown = (c) => !c.ext || FOREIGN === "all" || (FOREIGN === "linked" && c.linked);

// the legend under the stage: the kinds, the fills, the edges
function stageLegend() {
  const sw = (cls, style) => el("i", { class: `sw ${cls}`, style });
  return el("div", { class: "stage-legend" },
    el("span", { class: "grp" }, ...TYPE_KINDS.map((k) => el("span", { style: `color:${token(TYPE_TOKENS[k])}` }, typeGlyphSvg(k), " ", el("span", { style: "color:var(--fg2)" }, k))), el("span", {}, sw("", "color:var(--muted)"), el("span", {}, "no type"))),
    el("span", { class: "grp", title: "Evidence is the fill" }, el("span", {}, sw("solid", "color:var(--fg2)"), "confirmed"), el("span", {}, sw("hatch", "color:var(--fg2)"), "inferred"), el("span", {}, sw("", "color:var(--fg2)"), "unknown")),
    el("span", { class: "grp", title: "Status is the edge" }, el("span", {}, sw("dashed", "color:var(--fg3)"), "superseded"), el("span", {}, sw("ring", "color:var(--fg2)"), "open · needs review · pending")));
}

// A card's shape is its Type. decision: a plain card with a diamond. constraint: a thick band across the top, a
// barred square. workaround: a folded corner and a dashed edge, a folded square. incident: a striped band across
// the top, a triangle with a bar. The glyph as SVG for the legend, and on the canvas.
function typeGlyph(ctx, kind, x, y, s) { // `s` its size in pixels, at (x, y) top-left, in the current fill and stroke colour
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 12, s / 12); ctx.lineWidth = 1.5 * 12 / s; ctx.setLineDash([]);
  if (kind === "decision") { ctx.beginPath(); ctx.moveTo(6, 1); ctx.lineTo(11, 6); ctx.lineTo(6, 11); ctx.lineTo(1, 6); ctx.closePath(); ctx.fill(); }
  else if (kind === "constraint") { ctx.strokeRect(1.5, 1.5, 9, 9); ctx.fillRect(1.5, 5, 9, 2); }
  else if (kind === "workaround") { ctx.setLineDash([2, 1.5]); ctx.beginPath(); ctx.moveTo(1.5, 1.5); ctx.lineTo(7.5, 1.5); ctx.lineTo(10.5, 4.5); ctx.lineTo(10.5, 10.5); ctx.lineTo(1.5, 10.5); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(7.5, 1.5); ctx.lineTo(7.5, 4.5); ctx.lineTo(10.5, 4.5); ctx.stroke(); }
  else if (kind === "incident") { ctx.beginPath(); ctx.moveTo(6, 1.2); ctx.lineTo(11.2, 10.8); ctx.lineTo(0.8, 10.8); ctx.closePath(); ctx.stroke(); ctx.fillRect(5.3, 4.5, 1.4, 3.2); ctx.fillRect(5.3, 8.5, 1.4, 1.3); }
  ctx.restore();
}

// ---- the stage: scene, camera, layout, painter, input
// The scene: the graph's entry nodes as cards — ours and the ones a friend, the family or the path brought, so a
// thought that crosses repositories lights every step — the links between them, and the lanes by topic among the
// cards that show. A card keeps its node's id and reads the node afresh (the graph rebuilds its nodes on every
// render, the ids stay). Built once per view; a live update renders the view again.
function stageScene(G, span) {
  const entryNodes = (G?.nodes || []).filter((n) => n.kind === "entry" && n.entry);
  const { cards, byId } = stageCards(entryNodes, { today: span.to, selfState: shared.self });
  const links = stageLinks(cards, byId); markLinked(cards, links);
  const { lanes, cols } = stageLanes(cards, { show: foreignShown, topicTitle: (file, c) => ((c.state?.topics || shared.state.topics).find((t) => t.file === file)?.title) }); // a foreign entry's topic title from its own export
  return { G, cards, byId, links, lanes, cols, nodeOf: (c) => (G?.index?.[c.nid] != null ? G.nodes[G.index[c.nid]] : null) };
}

// The camera: the scale, the depth and the projection. World units: x across the near plane, y up, z the depth —
// days back from the day shown, logarithmic and scaled to the span so the last days spread out where the eye is and
// the past fills the stage. The scale follows the width (a plane of 5.6 units across); where the window has height
// to spare the box grows, up to twice, and the scale grows with it. As the graph, a card stands where its node
// stands in the graph beside: the graph's plane (its 4th to 96th percentile, outliers held at the edge) mapped onto
// the near plane, the positions copied while the graph settles and then kept — following its slow turn walked the
// cards around the stage without end.
function stageCamera(scene, v, o) {
  const F = 4.2; // focal length in plane units
  const spanDays = Math.max(14, dayDiff(o.span.from, o.span.to));
  const DEPTH_FAR = F * 1.4; // the depth at the span's end: size 1 / 2.4
  const camY = 1.85, floorY = -0.95; // the eye just above the top row; the floor's height
  const asGraph = () => ARRANGE === "graph" && !!scene.G;
  const baseK = () => Math.max(56, Math.min(190, (v.W - 40) / 5.6));
  const KY = () => Math.max(baseK(), Math.min(2 * baseK(), (v.H - 60) / 3.15)) * v.zoom; // up: the same in both arrangements
  const K = () => (asGraph() ? KY() : Math.max(56, Math.min(190, (v.W - 40) / (scene.cols + 1.2))) * v.zoom); // across: by topic the lanes' width
  const planeHalf = () => (asGraph() ? Math.max(1.5, (v.W / 2 - 12) / K()) : scene.cols / 2); // as the graph the plane spans the box, its edges at the bottom corners
  const horizon = () => v.H * 0.13 + v.panY; const cx = () => v.W / 2 + v.panX;
  const now = () => (shared.day || o.span.to);
  const tNow = () => dayDiff(o.span.from, now()) + (PLAY.on ? PLAY.frac * PLAY.jump : 0); // days since the first day, fractional while playing (a whole jump at the entry speed)
  const zOf = (day) => logDepth(tNow() - dayDiff(o.span.from, day), spanDays, DEPTH_FAR);
  const proj = (x, y, z) => { const s = F / (F + Math.max(z, -F * 0.9)); return [cx() + x * K() * s, horizon() + (camY - y) * KY() * s, s]; };
  const depthAlpha = (z) => Math.max(0.2, Math.min(1, 1.1 - z / (DEPTH_FAR * 1.6)));
  // the graph's positions, copied while it settles and then kept
  // (copied until the graph has settled once; from then on only a node not yet known is added — the graph is nudged
  // awake by a pointed-at thought, and following that would walk the cards along its turn a step per hover). The
  // family graph runs as the side pane's copy (`runner`), which shares its nodes but settles with an alpha of its
  // own: the family graph's own never falls, and read alone it kept the cards following the turn for good
  // the positions: the scene's layout (ktw-scene.js) — the graph beside the stage publishes them while it settles,
  // and the scene keeps them from then on; with no graph drawn beside the stage, the scene settles them itself
  let sawSettled = false; // the stage follows the layout until it has drawn it settled once
  const positions = () => { const G = scene.G; if (!G) return shared.layout; const L = shared.layoutSource ? shared.layout : shared.layoutFor(G.nodes, G.links); sawSettled = shared.layoutSettled; o.wrap.dataset.settled = sawSettled ? "1" : ""; return L; };
  const gbox = { x0: 0, x1: 1, y0: 0, y1: 1 };
  const measureGraph = (shownCards) => { const P = positions(); const xs = [], ys = []; for (const c of shownCards) { const q = P.get(c.nid); if (q) { xs.push(q.x); ys.push(q.y); } } const b = percentileBox(xs, ys); if (b) Object.assign(gbox, b); };
  const clamp01 = (u) => Math.max(0, Math.min(1, u));
  const gmap = (n) => { const ux = clamp01((n.x - gbox.x0) / (gbox.x1 - gbox.x0 || 1)), uy = clamp01((n.y - gbox.y0) / (gbox.y1 - gbox.y0 || 1)); return { x: (ux - 0.5) * (planeHalf() * 2 - 0.9), y: 1.3 - uy * (1.3 - (SHELF[0] - 0.45)) }; }; // the top row well under the eye
  const basePos = (c) => { const q = asGraph() ? shared.layout.get(c.nid) : null; return q ? gmap(q) : { x: c.x, y: c.y }; };
  // the box's height: what the window has left under everything above the stage and over the legend and note under it
  const roomBelow = () => { let below = 24; for (let n = o.wrap.nextElementSibling; n; n = n.nextElementSibling) below += n.offsetHeight + 12; const main = o.wrap.closest("#main"); if (main) below += parseFloat(getComputedStyle(main).paddingBottom) || 0; return below; };
  const roomAbove = () => { const main = o.wrap.closest("#main"); return main ? o.wrap.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop : 0; };
  const chrome = () => (narrow() ? 60 : 108); // the top bar, the strip, the status bar
  const fitHeight = () => { const h = stageHeight(baseK() * 3.15 + 60, window.innerHeight - chrome() - roomAbove() - roomBelow()); if (Math.abs(h - o.wrap.getBoundingClientRect().height) > 2) o.wrap.style.height = `${h}px`; };
  const zFar = () => Math.max(1, logDepth(tNow() + 20, spanDays, DEPTH_FAR)); // the floor's far edge: a little beyond the first day
  return { camY, floorY, asGraph, K, KY, planeHalf, now, zOf, zFar, proj, depthAlpha, measureGraph, basePos, fitHeight, following: () => asGraph() && !sawSettled };
}

// The layout: which cards show, where each stands, and the pushes that keep them apart. A push is an offset on the
// card (ox, oy in plane units); nothing pulls an offset back on its own — a steady pull against the push made the
// cards shiver — the offsets give up half their room, eased over a dozen frames, when the day or the arrangement
// changes (relax). Settling ends after SETTLE_FRAMES frames of pushes until the next relax: two cards wedged
// between their bounds would otherwise trade places forever.
function stageLayout(scene, cam, v) {
  const SETTLE_FRAMES = 120; let settleFrames = 0, easing = 0;
  const thereAt = (c, day) => existsAt(c.e, day, c.ext || shared.hasRepo(c.e));
  const shown = (c) => foreignShown(c) && thereAt(c, cam.now()) && (!PLAY.on || cam.zOf(c.day) >= -0.02);
  const posOf = (c) => { const q = cam.basePos(c); return { x: q.x + c.ox, y: q.y + c.oy }; };
  const room = (c) => { const b = cam.basePos(c); return { xlo: -1.3, xhi: 1.3, ylo: Math.max(-0.9, cam.floorY + 0.3 - b.y), yhi: Math.min(0.9, cam.camY - 0.35 - b.y) }; };
  const relax = () => { easing = 12; settleFrames = 0; };
  // one frame of settling; true while more frames are wanted
  const settle = (items) => {
    let busy = false;
    if (easing) { easing--; for (const c of scene.cards) { c.ox *= 0.944; c.oy *= 0.944; } busy = true; }
    const sOf = new Map(items.map((i) => [i.c, i.box.s])); // each card's size on screen, for the push in plane units
    if (settleFrames < SETTLE_FRAMES && pushApart(items, { px: (c) => cam.K() * (sOf.get(c) || 1), py: (c) => cam.KY() * (sOf.get(c) || 1), room })) { settleFrames++; busy = true; }
    return busy;
  };
  return { thereAt, shown, posOf, relax, settle };
}

// The painter: the floor with its days and months, the lanes' names or the topics' names, the lines between cards,
// the cards themselves — far ones first — and the names of the topics at the centre of their cards.
function stagePainter(ctx, scene, cam, layout, v, o) {
  const css = getComputedStyle(document.documentElement); const color = (name) => css.getPropertyValue(name).trim();
  const HATCH = new Map(); // colour -> pattern: diagonal lines, the fill of an inferred entry
  const hatch = (col) => { if (!HATCH.has(col)) { const pc = document.createElement("canvas"); pc.width = pc.height = 6; const x = pc.getContext("2d"); if (x) { x.strokeStyle = col; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-1, 7); x.lineTo(7, -1); x.moveTo(-1, 1); x.lineTo(1, -1); x.moveTo(5, 7); x.lineTo(7, 5); x.stroke(); } HATCH.set(col, ctx.createPattern(pc, "repeat")); } return HATCH.get(col); };
  const litIds = () => { const t = scene.G?.thought; const set = new Set(); if (t) for (const n of t.nodes) if (n.entry) set.add(n.entry.uuid || n.id); return set; };
  const font = (size, weight = "") => `${weight ? weight + " " : ""}${size}px ${color("--font") || "sans-serif"}`;
  const rects = []; // the cards drawn this frame, near ones last, each with its foot (the line down to the floor)
  const labels = []; // the topics' name pills drawn this frame (as the graph): pointed at, the topic's cards stand out

  function floor(day, xl, xr, zFar) {
    const { proj, floorY, depthAlpha, zOf } = cam;
    ctx.lineWidth = 1; ctx.strokeStyle = color("--line"); ctx.globalAlpha = 0.9;
    const edges = cam.asGraph() ? [xl, xr] : Array.from({ length: scene.cols + 1 }, (_, i) => i - scene.cols / 2); // the plane's edges, or the lane lines
    for (const x of edges) { const [ax, ay] = proj(x, floorY, -0.4); const [bx, by] = proj(x, floorY, zFar); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
    ctx.font = font(10); ctx.textBaseline = "middle"; ctx.textAlign = "left"; // the labels inside the floor's left edge: it runs out of the box at the front
    // the days: a faint line across for every day back from the one shown, as long as the lines stay apart on screen
    // (the last days are wide apart, the old ones run together), the day of the month where there is room for a number
    let lastY = -1e9, lastLabelY = -1e9;
    for (let back = 0; back < 4000; back++) {
      const d = addDays(day.slice(0, 10), -back); if (d < o.span.from.slice(0, 10)) break; if (d.endsWith("-01")) continue; const z = zOf(d); if (z > zFar) break;
      const [ax, ay] = proj(xl, floorY, z), [bx, by] = proj(xr, floorY, z); if (Math.abs(ay - lastY) < 7) continue; lastY = ay;
      ctx.globalAlpha = 0.25 + 0.4 * depthAlpha(z); ctx.strokeStyle = color("--line"); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      if (Math.abs(ay - lastLabelY) >= 16 && ay > 8 && ay < v.H - 4) { lastLabelY = ay; ctx.fillStyle = color("--fg3"); ctx.globalAlpha = 0.5 + 0.4 * depthAlpha(z); ctx.fillText(String(Number(d.slice(8, 10))), ax + 6, ay); }
    }
    // the months: a line on the first, its label in bold, the year on January's
    let [yy, mm] = day.slice(0, 7).split("-").map(Number);
    for (let guard = 0; guard < 600; guard++) {
      const first = `${yy}-${String(mm).padStart(2, "0")}-01`; const z = zOf(first); if (z > zFar) break;
      const [ax, ay] = proj(xl, floorY, z), [bx, by] = proj(xr, floorY, z);
      ctx.globalAlpha = 0.35 + 0.65 * depthAlpha(z); ctx.strokeStyle = mm === 1 ? color("--fg3") : color("--line"); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.fillStyle = color("--fg2"); ctx.font = font(10, "600"); if (ay > 8 && ay < v.H - 4) ctx.fillText(mm === 1 ? `${yy}-01` : first.slice(0, 7), ax + 6, ay); ctx.font = font(10);
      mm--; if (mm < 1) { mm = 12; yy--; }
    }
    // the day shown, in the corner
    ctx.globalAlpha = 1; ctx.textBaseline = "top"; ctx.font = `600 11px ${color("--mono") || "monospace"}`; ctx.fillStyle = color("--accent2"); ctx.fillText(`${day}${PLAY.on ? " ▶" : ""}`, 10, 9);
  }
  function laneNames(day) { // by topic: along the near edge, the upper shelf's lane above the lower's
    const { proj, floorY, K } = cam;
    ctx.font = font(10.5); ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const L of scene.lanes) {
      if (!L.items.some((c) => layout.thereAt(c, day))) continue;
      const [x, y, s] = proj(L.x, floorY, 0); const w = K() * s * 0.9 - 10; let txt = L.title; while (txt.length > 3 && ctx.measureText(txt).width > w) txt = txt.slice(0, -2); if (txt !== L.title) txt = txt.slice(0, -1) + "…";
      ctx.fillStyle = color("--fg2"); ctx.globalAlpha = L.shelf ? 0.9 : 0.65; ctx.fillText(`${L.shelf ? "▴" : "▾"} ${txt}`, x, y + (L.shelf ? 5 : 19));
    }
  }
  function topicNames(vis, boxes) { // as the graph: each at the centre of its cards on screen, on a pill — the cards recede, a name on the near plane would stand nowhere near them
    const groups = new Map();
    for (const { c } of vis) { if (c.ext) continue; const b = boxes.get(c); const g = groups.get(c.e.file) || groups.set(c.e.file, { x: 0, y: 0, n: 0 }).get(c.e.file); g.x += b.cx; g.y += b.cy; g.n++; }
    ctx.font = font(10.5, "600"); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const [file, g] of groups) { const t = (topicOf(file)?.title || file).replace(/`/g, "").slice(0, 34); const x = g.x / g.n, y = g.y / g.n; const w = ctx.measureText(t).width + 12; const on = v.hoverTopic === file; ctx.globalAlpha = on ? 0.95 : 0.82; ctx.fillStyle = on ? color("--bg3") : color("--bg"); ctx.fillRect(x - w / 2, y - 8, w, 16); ctx.globalAlpha = on ? 1 : 0.9; ctx.fillStyle = on ? color("--accent2") : color("--fg2"); ctx.fillText(t, x, y); labels.push({ file, x0: x - w / 2, y0: y - 8, x1: x + w / 2, y1: y + 8 }); }
  }
  function lines(day, boxes, lit) { // every See and Superseded by written by then; a lit thought's and the held or pointed-at card's stand out, the rest fade
    const pairs = scene.G?.thought?.pairs || null;
    for (const l of scene.links) {
      if (!boxes.has(l.a) || !boxes.has(l.b) || !linkExistsAt(day, l.day)) continue;
      const onLit = pairs && (pairs.has(`${l.a.nid}|${l.b.nid}`) || pairs.has(`${l.b.nid}|${l.a.nid}`));
      const near = [v.hover, v.held].some((c) => c && (l.a === c || l.b === c));
      const A = boxes.get(l.a), B = boxes.get(l.b);
      ctx.globalAlpha = onLit || near ? 0.95 : lit.size ? 0.08 : 0.35 * Math.min(A.s, B.s) + 0.1;
      ctx.strokeStyle = onLit || near ? color("--fg") : l.kind === "see" ? color("--accent2") : color("--fg3"); ctx.lineWidth = onLit || near ? 1.6 : 1; ctx.setLineDash(l.kind === "superseded" ? [5, 4] : []);
      ctx.beginPath(); ctx.moveTo(A.cx, A.cy); ctx.lineTo(B.cx, B.cy); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  function card(c, z, b, day, lit) { // a card in its Type's colour and shape, filled by Evidence, edged by Status, with its foot and its title
    const e = c.e; const st = statusAt(e, day, c.ext || shared.hasRepo(e)) || e.status; const sup = st === "superseded";
    const held = c === v.held, hovered = c === v.hover;
    const isLit = lit.has(e.uuid || c.nid); const isStep = shared.focus && (e.uuid === shared.focus || c.nid === shared.focus);
    const faded = (lit.size && !isLit && !hovered && !held) || (filterActive(shared.filter) && !isShownByFilter(e)) || (v.hoverTopic && (c.ext || e.file !== v.hoverTopic)); // a topic's name pointed at: its cards alone stand out
    const fresh = dayDiff(c.day, day) <= 3 && !PLAY.frac; // arrived within three days of the day shown: it glows
    const a = held ? 1 : (faded ? 0.16 : 1) * cam.depthAlpha(z); // the held card at full strength, whatever its depth
    const [fx, fy] = cam.proj(layout.posOf(c).x, cam.floorY, z); // the foot
    ctx.globalAlpha = a * (held || hovered ? 0.9 : 0.35); ctx.strokeStyle = held || hovered ? color("--fg") : color("--fg3"); ctx.lineWidth = held || hovered ? 1.5 : 1; ctx.beginPath(); ctx.moveTo(b.cx, b.y1); ctx.lineTo(fx, fy); ctx.stroke();
    b.foot = [b.cx, b.y1, fx, fy];
    const kind = typeKind(e); const fold = kind === "workaround" ? Math.min(b.h * 0.45, b.w * 0.3) : 0;
    const evc = sup ? color("--fg3") : (TYPE_TOKENS[kind] ? color(TYPE_TOKENS[kind]) : "") || color("--muted"); // the type's colour; a superseded card goes grey
    const outline = () => { ctx.beginPath(); if (fold) { ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1 - fold, b.y0); ctx.lineTo(b.x1, b.y0 + fold); ctx.lineTo(b.x1, b.y1); ctx.lineTo(b.x0, b.y1); ctx.closePath(); } else ctx.rect(b.x0, b.y0, b.w, b.h); };
    ctx.globalAlpha = a;
    if (fresh || isLit || hovered || held || isStep) { ctx.shadowColor = held || isStep ? color("--accent2") : isLit ? color("--fg") : evc; ctx.shadowBlur = held ? 36 : isStep ? 22 : 14; }
    // the body: the background, then a solid tint for confirmed, hatching for inferred, nothing for unknown
    ctx.fillStyle = color("--bg2"); ctx.globalAlpha = a * 0.9; outline(); ctx.fill(); ctx.shadowBlur = 0;
    if (e.evidence === "confirmed") { ctx.fillStyle = evc; ctx.globalAlpha = a * (sup ? 0.12 : 0.3); outline(); ctx.fill(); }
    else if (e.evidence === "inferred") { ctx.fillStyle = hatch(evc) || evc; ctx.globalAlpha = a * (sup ? 0.3 : 0.6); outline(); ctx.fill(); }
    ctx.globalAlpha = a;
    const band = Math.max(2, Math.min(5, b.h * 0.11));
    if (kind === "constraint") { ctx.fillStyle = evc; ctx.globalAlpha = a * 0.9; ctx.fillRect(b.x0, b.y0, b.w, band); ctx.globalAlpha = a; }
    if (kind === "incident") { ctx.save(); ctx.beginPath(); ctx.rect(b.x0, b.y0, b.w, band); ctx.clip(); ctx.fillStyle = evc; ctx.globalAlpha = a * 0.9; const sw = Math.max(3, band * 1.6); for (let x = b.x0 - band; x < b.x1 + band; x += sw * 2) { ctx.beginPath(); ctx.moveTo(x, b.y0); ctx.lineTo(x + sw, b.y0); ctx.lineTo(x + sw - band, b.y0 + band); ctx.lineTo(x - band, b.y0 + band); ctx.closePath(); ctx.fill(); } ctx.restore(); ctx.globalAlpha = a; }
    if (fold) { ctx.fillStyle = color("--bg"); ctx.beginPath(); ctx.moveTo(b.x1 - fold, b.y0); ctx.lineTo(b.x1 - fold, b.y0 + fold); ctx.lineTo(b.x1, b.y0 + fold); ctx.closePath(); ctx.fill(); ctx.strokeStyle = evc; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.lineWidth = held ? 2.6 : hovered ? 2 : 1.2; ctx.strokeStyle = held ? color("--fg") : evc; ctx.setLineDash(sup || kind === "workaround" ? [4, 3] : []); outline(); ctx.stroke(); ctx.setLineDash([]);
    if (held) { ctx.strokeStyle = color("--accent2"); ctx.lineWidth = 2; ctx.globalAlpha = 0.9; ctx.strokeRect(b.x0 - 6, b.y0 - 6, b.w + 12, b.h + 12); ctx.globalAlpha = a; }
    if (kind && b.w > 30) { ctx.fillStyle = evc; ctx.strokeStyle = evc; const gs = Math.max(7, Math.min(11, b.h * 0.3)); typeGlyph(ctx, kind, b.x1 - gs - 4 - (fold ? fold * 0.6 : 0), b.y1 - gs - 3, gs); }
    if (e.evidence === "unknown" && b.w > 30) { ctx.fillStyle = color("--unknown"); ctx.font = font(Math.max(8, Math.min(12, b.h * 0.32)), "700"); ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("?", b.x0 + 5, b.y1 - 2); }
    if (st === "open" || st === "needs-review" || st === "pending-confirmation") { ctx.strokeStyle = color(`--${st}`); ctx.lineWidth = 1.2; ctx.strokeRect(b.x0 - 3, b.y0 - 3, b.w + 6, b.h + 6); }
    if (isStep) { ctx.strokeStyle = color("--accent2"); ctx.lineWidth = 2.5; ctx.strokeRect(b.x0 - 5, b.y0 - 5, b.w + 10, b.h + 10); }
    // the title on every card with room for a word, the type never below reading size: a card far back shows its first words
    const fs = Math.max(9.5, Math.min(12, 11 * b.s * v.zoom)); const top = kind === "constraint" || kind === "incident" ? band + 1 : 0;
    if (b.w > 26 && b.h - 6 - top >= fs) {
      ctx.font = font(fs); ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillStyle = sup ? color("--fg3") : color("--fg");
      const words = e.title.replace(/`/g, "").split(" "); const rows = []; let cur = "";
      for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (ctx.measureText(t).width > b.w - 10 && cur) { rows.push(cur); cur = w; } else cur = t; if (rows.length >= 3) break; }
      if (rows.length < 3 && cur) rows.push(cur);
      const lh = fs * 1.2; const maxRows = Math.max(1, Math.floor((b.h - 6 - top) / lh));
      rows.slice(0, maxRows).forEach((t, i) => { let txt = t; if (i === maxRows - 1 && (rows.length > maxRows || words.length > rows.join(" ").split(" ").length)) txt += "…"; const room = b.w - 10 - (i === 0 && fold ? fold : 0); while (txt.length > 2 && ctx.measureText(txt).width > room) txt = txt.slice(0, -2) + "…"; ctx.fillText(txt, b.x0 + 5, b.y0 + 4 + top + i * lh); });
    }
  }
  // one frame; true while the layout wants another
  function draw() {
    rects.length = 0; labels.length = 0; ctx.clearRect(0, 0, v.W, v.H);
    const day = cam.now(); const lit = litIds(); const byGraph = cam.asGraph();
    const vis = scene.cards.filter(layout.shown).map((c) => ({ c, z: cam.zOf(c.day) + c.dz })).sort((a, b) => b.z - a.z); // far ones first
    if (byGraph) cam.measureGraph(vis.map((i) => i.c));
    const half = cam.planeHalf(); const xl = -half - (byGraph ? 0 : 0.1), xr = half + (byGraph ? 0 : 0.1);
    floor(day, xl, xr, cam.zFar());
    if (!byGraph) laneNames(day);
    const cardScale = byGraph ? 0.66 : 1; // as the graph the cards stand closer: smaller, the tip tells the rest
    const boxes = new Map();
    for (const { c, z } of vis) { const q = layout.posOf(c); const [x, y, s] = cam.proj(q.x, q.y, z); const grow = c === v.held ? 1.12 : 1; const w = cam.K() * s * 0.78 * cardScale * grow, h = Math.min(cam.KY(), cam.K() * 1.5) * s * 0.36 * cardScale * grow; boxes.set(c, { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2, cx: x, cy: y, s, w, h }); }
    const busy = layout.settle(vis.map((i) => ({ ...i, box: boxes.get(i.c) })));
    lines(day, boxes, lit);
    for (const { c, z } of vis) { const b = boxes.get(c); card(c, z, b, day, lit); rects.push({ ...b, c }); }
    if (byGraph) topicNames(vis, boxes);
    ctx.globalAlpha = 1;
    return busy;
  }
  // the card under a point: its box, or its foot
  const nearFoot = (r, px, py) => { const [ax, ay, bx, by] = r.foot; const dx = bx - ax, dy = by - ay; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) <= 4; };
  const pick = (px, py) => { for (let i = rects.length - 1; i >= 0; i--) { const r = rects[i]; if (px >= r.x0 && px <= r.x1 && py >= r.y0 && py <= r.y1) return r.c; } for (let i = rects.length - 1; i >= 0; i--) if (nearFoot(rects[i], px, py)) return rects[i].c; return null; };
  const pickLabel = (px, py) => labels.find((l) => px >= l.x0 && px <= l.x1 && py >= l.y0 && py <= l.y1)?.file || null; // the pills lie over the cards
  return { draw, pick, pickLabel };
}

// The input: the pointer and the fingers. A card under the pointer is pointed at (its node lit in the graph, a tip
// beside it); a click holds it (the card beside the bars shows it) and a click on the floor lets go; a drag looks
// around; the wheel scrubs the days, with ctrl it zooms; a double-click resets the view. On touch: one finger looks
// around, two pinch, a tap holds.
function stageInput(canvas, st, v, o) {
  const { pick, pickLabel, wake, openCard, closeCard, showTip, hideTip } = st;
  let drag = null, moved = false, pinch = null;
  const pos = (ev) => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  canvas.onmousemove = (ev) => {
    const [px, py] = pos(ev);
    if (drag) { v.panX = drag.panX + (px - drag.px); v.panY = drag.panY + (py - drag.py); if (Math.hypot(px - drag.px, py - drag.py) > 4) moved = true; hideTip(); wake(); return; }
    const t = pickLabel(px, py); // a topic's name: its cards stand out, nothing to open
    if (t !== v.hoverTopic) { v.hoverTopic = t; wake(); }
    if (t) { if (v.hover) { v.hover = null; shared.setFocus(null); } canvas.style.cursor = "default"; hideTip(); return; }
    const c = pick(px, py);
    if (c !== v.hover) { v.hover = c; shared.setFocus(c?.e.uuid || c?.e.id || null); wake(); }
    canvas.style.cursor = c ? "pointer" : "grab";
    if (c) showTip(c, px, py); else hideTip();
  };
  canvas.onmouseleave = () => { if (v.hover) { v.hover = null; shared.setFocus(null); wake(); } if (v.hoverTopic) { v.hoverTopic = null; wake(); } hideTip(); };
  canvas.onmousedown = (ev) => { if (ev.button !== 0) return; const [px, py] = pos(ev); drag = { px, py, panX: v.panX, panY: v.panY }; moved = false; canvas.classList.add("grabbing"); };
  const onUp = (ev) => { if (!drag) return; const [px, py] = pos(ev); drag = null; canvas.classList.remove("grabbing"); if (moved || pickLabel(px, py)) return; const c = pick(px, py); if (c) openCard(c); else if (ev.target === canvas && v.held) closeCard(); };
  window.addEventListener("mouseup", onUp);
  canvas.onwheel = (ev) => {
    ev.preventDefault();
    if (ev.ctrlKey || ev.metaKey) { v.zoom = Math.min(4, Math.max(0.5, v.zoom * Math.exp(-ev.deltaY * 0.0015))); wake(); return; }
    const d = Math.sign(ev.deltaY || ev.deltaX) * (ev.shiftKey ? o.big : 1); if (!d) return;
    o.play(false); o.setDay(o.stepBy(shared.day || o.span.to, d)); hideTip();
  };
  canvas.ondblclick = () => { v.zoom = 1; v.panX = 0; v.panY = 0; wake(); };
  const tpos = (t) => { const r = canvas.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; };
  const tdist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
  canvas.addEventListener("touchstart", (ev) => { if (ev.touches.length === 2) { pinch = { d: tdist(ev.touches) || 1, zoom: v.zoom }; drag = null; return; } const [px, py] = tpos(ev.touches[0]); drag = { px, py, panX: v.panX, panY: v.panY }; moved = false; }, { passive: true });
  canvas.addEventListener("touchmove", (ev) => { if (pinch && ev.touches.length === 2) { v.zoom = Math.min(4, Math.max(0.5, pinch.zoom * (tdist(ev.touches) / pinch.d))); wake(); ev.preventDefault(); return; } if (!drag || !ev.touches.length) return; const [px, py] = tpos(ev.touches[0]); v.panX = drag.panX + (px - drag.px); v.panY = drag.panY + (py - drag.py); if (Math.hypot(px - drag.px, py - drag.py) > 6) moved = true; wake(); ev.preventDefault(); }, { passive: false });
  canvas.addEventListener("touchend", (ev) => { if (pinch) { if (!ev.touches.length) pinch = null; return; } if (!drag) return; const d = drag; drag = null; if (moved) return; const c = pick(d.px, d.py); if (c) openCard(c); else if (v.held) closeCard(); });
  return { release: () => window.removeEventListener("mouseup", onUp) };
}

// The stage on the page: the scene from the graph, the camera, the layout, the painter and the input wired to one
// view state, redrawn on demand (wake) — never idle-looping — and the API the rest of the page uses (STAGE).
function runStage(canvas, o) {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const v = { W: 0, H: 0, zoom: 1, panX: 0, panY: 0, hover: null, hoverTopic: null, held: null, raf: null }; // the view: the box, the camera's zoom and pan, what is pointed at and held
  const scene = stageScene(o.graph, o.span);
  // the stage stands its cards where the graph beside it stands its nodes: that graph is the scene's layout source,
  // and its positions so far are the start (a graph already settled publishes nothing more on its own)
  shared.resetLayout(o.graph && o.graphBeside ? o.graph : null);
  if (shared.layoutSource) shared.publishFrom(o.graph, { force: true });
  canvas.dataset.lanes = scene.lanes.map((L) => L.title).join(" | "); // what the stage holds, readable from outside (tests)
  const cam = stageCamera(scene, v, o);
  const layout = stageLayout(scene, cam, v);
  const painter = stagePainter(ctx, scene, cam, layout, v, o);
  const dpr = window.devicePixelRatio || 1;
  const resize = () => { const r = canvas.getBoundingClientRect(); v.W = r.width; v.H = r.height; canvas.width = v.W * dpr; canvas.height = v.H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const frame = () => { v.raf = null; if (painter.draw()) wake(); };
  const wake = () => { if (!v.raf && canvas.isConnected) v.raf = requestAnimationFrame(frame); };
  // the tip beside the pointer, inside the box
  const place = (box, px, py) => { const r = canvas.getBoundingClientRect(); const w = box.offsetWidth || 280, h = box.offsetHeight || 80; box.style.left = `${px + 14 + w > r.width - 8 ? Math.max(8, px - 14 - w) : px + 14}px`; box.style.top = `${py + 14 + h > r.height - 8 ? Math.max(8, py - 14 - h) : py + 14}px`; };
  const showTip = (c, px, py) => { const e = c.e; setKids(o.tip, el("b", {}, e.title.replace(/`/g, "")), el("div", { class: "note" }, `${c.lane?.title || e.file} · ${stampLabel(c.day)}${e.git?.created?.author ? " · " + e.git.created.author : ""}`), el("div", { class: "pills" }, ...typePills(e.type), statusPill(statusAt(e, cam.now(), c.ext || shared.hasRepo(e)) || e.status), evPill(e.evidence))); o.tip.hidden = false; place(o.tip, px, py); };
  const hideTip = () => { o.tip.hidden = true; };
  const openCard = (c) => { v.held = c; o.open(c.e, c); wake(); };
  const closeCard = () => { if (!v.held) return; v.held = null; o.close(); wake(); };
  const input = stageInput(canvas, { pick: painter.pick, pickLabel: painter.pickLabel, wake, openCard, closeCard, showTip, hideTip }, v, o);
  const handle = { wake, graph: scene.G, relax: layout.relax, follows: cam.asGraph, close: closeCard,
    // reset: let go of the held card and the held thought, every card alike again, the view as it opened
    reset: () => { shared.setThought(null); shared.setFocus(null); closeCard(); v.zoom = 1; v.panX = 0; v.panY = 0; v.hover = null; hideTip(); cam.fitHeight(); wake(); },
    // pick: an entry chosen elsewhere on the page (a thought's step in the pane) is held like a clicked card, and the day moves to its, so it arrives at the front
    pick: (e) => { v.held = (e.uuid && scene.byId[e.uuid]) || scene.byId[e.id] || null; o.play(false); o.open(e, v.held); o.setDay(createdOn(e) || o.span.to); wake(); } };
  resize();
  // the scene's changes the stage follows, until its canvas leaves the page: the clock, the focus, a lit thought,
  // the graph's layout while it settles (the cards stand where its nodes stand), and anything every view redraws for
  const listening = [
    shared.on("day", (day, { grew }) => { if (grew) layout.relax(); wake(); }),
    shared.on("focus", () => wake()),
    shared.on("thought", () => wake()),
    shared.on("layout", () => { if (cam.following()) wake(); }),
    shared.on("wake", () => wake()),
  ];
  const ro = new ResizeObserver(() => { if (!canvas.isConnected) { ro.disconnect(); input.release(); for (const off of listening) off(); o.onClose?.(handle); return; } resize(); cam.fitHeight(); wake(); }); ro.observe(canvas);
  cam.fitHeight(); wake();
  return handle;
}

// ---- the timeline page around the stage: the clock and its play loop, the bars, the slider, the card
// What the host gives the page when it shows it (view's `host`): which graph the stage stands on (`graph`, the
// host's builders), a row for an entry in a list (`entryRow`), a body as nodes (`renderBody`, the host's
// Markdown with its topic links), an export's bodies loaded (`bodies`, the provider's), and a redraw of the
// whole page (`render`). Until a page is shown, a body is plain text and nothing loads.
let HOST = { graph: () => null, entryRow: (e) => el("div", {}, e.title), renderBody: (md) => document.createTextNode(String(md || "")), bodies: (st) => Promise.resolve(st), render: () => {} };
let STAGE = null; // the stage on the page (runStage's handle), null when there is none
const count = (list, key) => list.reduce((m, e) => ((m[e[key] || ""] = (m[e[key] || ""] || 0) + 1), m), {});
const palette = (i) => token(paletteToken(i));
const entryHref = (e) => nav.href({ view: "entry", uuid: e.uuid || e.id });

let CLOCK_N = -1; // how many entries the clock's day shows: a layout settles again only when that changes
function setClock(day) {
  if (day === shared.day) return;
  // the layout settles again only when the set of nodes changed, not on every day the playhead passes
  const n = shared.state ? shared.state.entries.filter((e) => existsAt(e, day, shared.hasRepo(e))).length : 0; const grew = n !== CLOCK_N; CLOCK_N = n;
  shared.setDay(day, { grew }); // every graph follows (runGraph), and the stage
}

// ---------------------------------------------------------------- timeline (SVG)
const authorColor = (name) => palette(Math.max(0, shared.state.authors.findIndex((a) => a.name === name)));
// ---------------------------------------------------------------- timeline: the clock, the playhead, the stage
// The Timeline owns the clock. The slider, the play button, the keys and a wheel over the stage set the day, and
// every graph on the page follows it (setClock). The stage is a perspective view of the graph's entries: time runs
// into the depth — the day shown is the near plane, what came before recedes, what a day brings arrives at the
// front — a card per entry in the colours of its Type, filled by Evidence, edged by Status, the See and Superseded
// by lines between cards from the day they were written. Plain canvas, projected by hand: three numbers per point,
// no library. The scene and the layout are pure functions in ktw-core.js (stageCards … pushApart); this file holds the
// page, the camera, the painter and the input. #timeline/<day> opens the page on that day.
// speed: days per second, or "entry" — a step per second to the next day an entry appeared on, the days between
// slid through in that second (several entries of one day are one step); frac: the part of a step between two
// whole ones, for the stage's motion; jump: the days the current step spans (1 for a speed in days)
const PLAY = { on: false, speed: 7, raf: null, last: 0, acc: 0, frac: 0, jump: 1 };
const SPEEDS = [["entry", "1 entry /s"], [1 / 24, "1 hour /s"], [3 / 24, "3 hours /s"], [1, "1 day /s"], [7, "1 week /s"], [30, "1 month /s"], [120, "4 months /s"]];
// The stage (ktw-timeline.js) keeps its two settings — where a card stands ("graph" or "topics"), which other
// repositories' entries show ("linked", "all", "none") — per browser; the page's switches set them and redraw.
function setStageArrange(v) { setArrange(v); STAGE?.relax?.(); STAGE?.wake?.(); }
function setStageForeign(v) { setForeign(v); HOST.render(); } // the lanes are the shown cards': the view is rebuilt
function stopPlay() { PLAY.on = false; if (PLAY.raf) cancelAnimationFrame(PLAY.raf); PLAY.raf = null; PLAY.last = 0; PLAY.acc = 0; PLAY.frac = 0; PLAY.jump = 1; }
const DAY_RE = /^\d{4}-\d{2}-\d{2}(T\d{2})?$/; // a day, or an hour of it
// a segment of buttons on the stage, one of them on
const stageSeg = (cls, title, options, current, pick, label = null) => el("span", { class: `stage-seg ${cls}`, title }, label ? el("span", { class: "seg-label" }, label) : null,
  ...options.map(([v, l]) => el("button", { type: "button", class: v === current ? "on" : "", onclick: (ev) => { pick(v); for (const b of ev.currentTarget.parentNode.querySelectorAll("button")) b.classList.toggle("on", b === ev.currentTarget); } }, l)));

function view(main, day, host) {
  HOST = host;
  main.append(el("h1", {}, "Timeline"));
  if (!shared.state.project.git?.available) return main.append(el("p", { class: "center" }, "No Git repository — no dates to draw."));
  if (shared.state.project.git.shallow) main.append(el("p", { class: "sub warn" }, "Shallow clone: the history stops at the clone's edge, so every entry older than that appears to start there. Fetch the full history (git fetch --unshallow) for real dates."));
  const sub = el("p", { class: "sub" }, "The project day by day. The stage shows what existed on the day shown, the graph beside it the same; the playhead sets the day. The card shows the entry that appeared last by then, or the one clicked on the stage. The bars count the entries by the month their heading first appeared in Git, stacked by author, grey ticks for entries superseded that month.");
  // the graph the stage is a view of and the thoughts beside it are drawn from: the family graph with the family
  // scope (built once it is asked for, the view rendered again when it arrives), else this project's
  const g = host.graph(); // the host's graph builders: which graph the stage stands on (the family's, when it is shown and built)
  // the clock runs from the first day of any entry on the page — ours, or one a friend, the family or the path brought — to today
  const span = daySpan([...shared.state.entries, ...g.nodes.filter((n) => n.kind === "entry" && n.entry).map((n) => n.entry)]);
  if (!span) return main.append(sub, el("p", { class: "center" }, "Nothing dated yet."));
  const clamp = (d) => (d < span.from ? span.from : d > span.to ? span.to : d);
  const bars = timelineBars(main, span, (d) => setDay(d));
  const listBox = el("div", { class: "entry-list", style: "margin-top:16px" });
  bars.onMonth = (k, entries) => { listBox.replaceChildren(el("h2", {}, k), ...entries.map(HOST.entryRow)); };
  // the playhead: a slider over the days, play with a speed, the counts of the day
  const grid = timeGrid(span); const big = grid.hours ? 24 : 7; // a step: an hour or a day; shift: a day or a week
  const range = el("input", { type: "range", min: 0, max: grid.steps, step: 1, class: "playhead-range", title: grid.hours ? "the hour the page shows — drag, or ← → (an hour), shift ← → (a day), space plays" : "the day the page shows — drag, or ← → (a day), shift ← → (a week), space plays" });
  const dayLabel = el("b", { class: "playhead-day" }); const counts = el("span", { class: "playhead-counts" });
  const playBtn = el("button", { type: "button", class: "play-btn", title: "play the days — space" });
  const speedSel = el("select", { class: "play-speed", title: "how fast the days pass" }, SPEEDS.map(([v, l]) => el("option", { value: v }, l)));
  speedSel.onchange = () => { PLAY.speed = speedSel.value === "entry" ? "entry" : Number(speedSel.value) || 7; PLAY.acc = 0; PLAY.frac = 0; PLAY.jump = 1; };
  for (const opt of speedSel.options) if (opt.value === String(PLAY.speed) || (opt.value !== "entry" && Math.abs(Number(opt.value) - PLAY.speed) < 1e-9)) opt.selected = true;
  // the days entries appeared on, for the "1 entry /s" speed: ours and the graph's foreign ones, as the span counts them
  const entryDays = [...new Set([...shared.state.entries, ...g.nodes.filter((n) => n.kind === "entry" && n.entry).map((n) => n.entry)].map(createdOn).filter(Boolean).map(grid.toClock))].sort();
  const nextEntryDay = (d) => entryDays.find((x) => x > d) || span.to;
  const upd = () => {
    const d = shared.day || span.to;
    range.value = grid.stepOf(d); dayLabel.textContent = grid.label(d); bars.mark(d, grid.label(d));
    const here = shared.state.entries.filter((e) => shared.atClock(e)); const st = count(here.map((e) => ({ s: shared.statusNow(e) })), "s"); const open = (st.open || 0) + (st["needs-review"] || 0) + (st["pending-confirmation"] || 0);
    setKids(counts, `${plural(here.length, "entry")} by then`, st.active ? ` · ${st.active} active` : "", st.superseded ? ` · ${st.superseded} superseded` : "", open ? ` · ${open} in question` : "");
    playBtn.textContent = PLAY.on ? "⏸" : "▶"; playBtn.classList.toggle("on", PLAY.on);
    card.refresh();
    try { nav.go({ view: "timeline", day: d === span.to ? null : grid.url(d) }, { replace: true }); } catch {}
  };
  const setDay = (d) => { setClock(clamp(grid.toClock(d))); upd(); };
  const stepBy = (d, n) => (span.timed ? grid.at(grid.stepOf(d) + n) : addDays(d, n));
  function play(on) {
    if (on === PLAY.on) return;
    if (!on) { stopPlay(); upd(); return; }
    if ((shared.day || span.to) >= span.to) setClock(span.from); // at the end: once more from the start
    PLAY.on = true; PLAY.last = 0; PLAY.acc = 0;
    const step = (now) => {
      if (!PLAY.on || !range.isConnected) { stopPlay(); return; }
      const dt = PLAY.last ? Math.min(0.1, (now - PLAY.last) / 1000) : 0; PLAY.last = now;
      if (PLAY.speed === "entry") {
        // one step per second to the next day with an entry; the stage slides through the days between
        const target = nextEntryDay(shared.day); PLAY.jump = span.timed ? dayDiff(shared.day, target) : Math.max(1, dayDiff(shared.day, target)); PLAY.acc += dt; PLAY.frac = Math.min(1, PLAY.acc);
        if (PLAY.acc >= 1) { PLAY.acc = 0; PLAY.frac = 0; if (target >= span.to) { setClock(span.to); stopPlay(); upd(); return; } setDay(target); }
        else STAGE?.wake?.();
      } else {
        // the speed in days a second, the clock in steps of the grid's unit — an hour or a day
        const U = grid.unit; PLAY.jump = U; PLAY.acc += dt * PLAY.speed;
        const whole = Math.floor(PLAY.acc / U); PLAY.frac = (PLAY.acc - whole * U) / U;
        if (whole >= 1) { PLAY.acc -= whole * U; const d = stepBy(shared.day, whole); if (d >= span.to) { setClock(span.to); stopPlay(); upd(); return; } setDay(d); }
        else STAGE?.wake?.();
      }
      PLAY.raf = requestAnimationFrame(step);
    };
    upd(); PLAY.raf = requestAnimationFrame(step);
  }
  playBtn.onclick = () => play(!PLAY.on);
  range.oninput = () => { play(false); setDay(grid.at(Number(range.value))); };
  const jump = (to, title, label) => el("button", { type: "button", class: "play-jump", title, onclick: () => { play(false); setDay(to()); } }, label);
  const card = entryCard(span);
  // the stage and its switches
  const wrap = el("div", { class: "stage-wrap" }); const canvas = el("canvas", { class: "stage" }); const tip = el("div", { class: "stage-tip", hidden: true });
  wrap.append(canvas, tip,
    stageSeg("stage-arrange", "where a card stands: where its node stands in the graph beside (the stage is the graph, time pulled out as depth), or in a lane per topic", [["graph", "as the graph"], ["topics", "by topic"]], ARRANGE, setStageArrange),
    stageSeg("stage-foreign", "other repositories' entries — friends, family, path: only the ones a chain of See or Superseded by joins to this project's, every one the graph holds, or none", [["linked", "linked"], ["all", "all"], ["none", "none"]], FOREIGN, setStageForeign, "others"),
    el("button", { type: "button", class: "stage-reset", title: "let go of the held thought and card — every card alike again — and reset the view (Esc)", onclick: () => STAGE?.reset?.() }, "reset"));
  main.append(el("div", { class: "timeline-head" },
      el("div", { class: "timeline-head-text" }, sub, bars.node, bars.legend,
        el("div", { class: "playhead" }, jump(() => span.from, "the first day", "⏮"), playBtn, jump(() => span.to, "today", "⏭"), range, dayLabel, speedSel, counts)),
      el("div", { class: "stage-card-slot" }, card.node)),
    wrap, stageLegend(),
    el("p", { class: "note stage-note" }, el("span", { class: "stage-hint" }, (grid.hours ? "On the stage: wheel — an hour forward or back, shift for a day ·" : "On the stage: wheel — a day forward or back, shift for a week ·") + " drag — look around · ctrl+wheel — zoom · double-click — reset the view · click a card to read it, the floor to let go. The thoughts beside: point at one to light its chain here and in the graph."), el("span", { class: "stage-hint-touch" }, "On the stage: drag — look around · pinch — zoom · tap a card to read it, the floor to let go. The slider sets the day.")),
    listBox);
  shared.day = null; setClock(day && DAY_RE.test(day) ? clamp(grid.toClock(day)) : span.to); upd();
  STAGE = runStage(canvas, { wrap, tip, span, graph: g, graphBeside: !narrow(), setDay, stepBy, big, play, playing: PLAY, open: card.hold, close: card.release, onClose: (h) => { if (STAGE === h) STAGE = null; } }); // the side pane draws no graph on a narrow screen (miniGraph)
  // keys while the timeline is open: ← → a day, shift a week, space plays
  const onKey = (ev) => {
    if (!wrap.isConnected) return document.removeEventListener("keydown", onKey);
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(ev.target?.tagName) && ev.target !== range) return;
    const d = shared.day || span.to;
    if (ev.key === "ArrowLeft") { play(false); setDay(stepBy(d, ev.shiftKey ? -big : -1)); ev.preventDefault(); }
    else if (ev.key === "ArrowRight") { play(false); setDay(stepBy(d, ev.shiftKey ? big : 1)); ev.preventDefault(); }
    else if (ev.key === " " && ev.target !== range) { play(!PLAY.on); ev.preventDefault(); }
  };
  document.addEventListener("keydown", onKey);
}
// The bars: entries by the month their heading first appeared in Git, stacked by author, grey ticks for entries
// superseded that month, a marker for the day shown. Returns the SVG, the authors' legend, `mark(day)` and a click
// on a month (`onMonth(month, entries)` to set, and the day moves to the month's end through `setDay`).
function timelineBars(main, span, setDay) {
  const created = shared.state.entries.filter((e) => e.git?.created?.date && isShownByFilter(e));
  const months = {}; const sup = {};
  for (const e of created) { const m = e.git.created.date.slice(0, 7); (months[m] ||= {})[e.git.created.author] = ((months[m] || {})[e.git.created.author] || 0) + 1; }
  for (const e of shared.state.entries) for (const h of e.git?.status_history || []) if (h.status === "superseded" && h.date) sup[h.date.slice(0, 7)] = (sup[h.date.slice(0, 7)] || 0) + 1;
  // every month from the first dated one to this month
  const all = []; let [y, m] = (Object.keys({ ...months, ...sup }).sort()[0] || span.from.slice(0, 7)).split("-").map(Number); const [ey, em] = todayISO().slice(0, 7).split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) { all.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
  const max = Math.max(1, ...all.map((k) => Object.values(months[k] || {}).reduce((a, b) => a + b, 0)));
  // the drawing is as wide as the column beside the card, so its text keeps its size (an SVG scales as a whole);
  // padT leaves room above the bars for the day's label, clear of them; a bar spans its month, a hair between two
  const mainW = main.clientWidth || 900; const Wd = Math.max(360, Math.round(narrow() ? mainW - 28 : mainW - 64 - 18 - Math.min(420, Math.max(280, (mainW - 82) * 0.42))));
  const Hd = 130, padL = 34, padB = 32, padT = 18; const colW = (Wd - padL) / all.length; const bw = colW - 2;
  const ns = (tag, attrs, text) => { const n = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text != null) n.textContent = text; return n; };
  const svg = ns("svg", { viewBox: `0 0 ${Wd} ${Hd}` }); const axis = ns("g", { class: "axis" }); svg.append(axis);
  const scaleY = (v) => padT + (Hd - padB - padT) * (1 - v / max);
  for (const tick of [0, Math.ceil(max / 2), max]) { axis.append(ns("line", { x1: padL, x2: Wd, y1: scaleY(tick), y2: scaleY(tick) })); axis.append(ns("text", { x: padL - 6, y: scaleY(tick) + 3, "text-anchor": "end" }, tick)); }
  const monthX = (d) => { const i = all.indexOf(d.slice(0, 7)); if (i < 0) return d < all[0] ? padL : Wd; const dim = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 0)).getUTCDate(); return padL + (i + (Math.min(+d.slice(8, 10), dim) - 1) / dim) * colW + 1; };
  const marker = ns("line", { class: "now", x1: padL, x2: padL, y1: padT - 4, y2: Hd - padB + 14 }); const markerLabel = ns("text", { class: "now-label", x: padL, y: 9, "text-anchor": "start" }, "");
  const out = { node: el("div", { class: "timeline" }, svg), onMonth: null,
    legend: el("div", { class: "legend" }, shared.state.authors.map((a) => el("span", {}, el("i", { class: "sw", style: `background:${authorColor(a.name)}` }), a.name)), el("span", {}, el("i", { class: "sw", style: "background:var(--superseded)" }), "superseded that month")),
    mark: (d, label = d) => { const x = monthX(d); marker.setAttribute("x1", x); marker.setAttribute("x2", x); markerLabel.setAttribute("x", Math.min(Wd - 64, x + 4)); markerLabel.textContent = label; } };
  all.forEach((k, i) => {
    const x = padL + i * colW + 1; let yTop = scaleY(0);
    for (const a of shared.state.authors.map((a) => a.name)) {
      const v = months[k]?.[a]; if (!v) continue; const h = scaleY(0) - scaleY(v); yTop -= h;
      const rect = ns("rect", { class: "b", x, y: yTop, width: bw, height: h, fill: authorColor(a), rx: 2 }); rect.append(ns("title", {}, `${k} · ${a}: ${v} — click: that month's entries, and the day moves to its end`));
      rect.addEventListener("click", () => { out.onMonth?.(k, created.filter((e) => e.git.created.date.startsWith(k))); const last = new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7), 0)).toISOString().slice(0, 10); setDay(last < span.from ? span.from : last > span.to ? span.to : last); });
      svg.append(rect);
    }
    if (sup[k]) for (let s = 0; s < sup[k]; s++) svg.append(ns("rect", { class: "sup", x: x + s * 5, y: Hd - padB + 6, width: 3, height: 6 }));
    if (all.length <= 18 || i % Math.ceil(all.length / 18) === 0) axis.append(ns("text", { x: x + bw / 2, y: Hd - padB + 22, "text-anchor": "middle" }, k));
  });
  svg.append(marker, markerLabel);
  return out;
}
// The card beside the bars: the entry that appeared last by the day shown, or the one held — clicked on the stage
// or in the thoughts list — until let go. The whole body, rendered as the reader renders it; the bodies sit beside
// an export by default, this project's and a friend's alike, and are fetched once, on demand.
// An entry as a card: the day and topic, a badge, the title linking the entry, its pills, the whole body as the
// reader renders it, who recorded it and open ›. The timeline's card beside the bars and the graph's preview are
// the same card. `badge` is the head's right-hand element; `state` the export the entry came from, for the bodies
// that sit beside an export and are fetched once, on demand (`again` is called when they arrived).
function fillEntryCard(node, e, { lane, href, state, day, badge, again, onOpen = null, topic = null, renderBody = HOST.renderBody, bodies = HOST.bodies }) {
  const body = e.body?.text || "";
  // a friend's entry opens by walking to that project in place (the node's action), not by a plain link
  const link = (text, extra = {}) => el("a", { href, ...extra, onclick: onOpen ? (ev) => { ev.preventDefault(); onOpen(); } : null }, text);
  // the topic in the head is a link where there is somewhere to go: the topic's preview in the graph, its page on the timeline
  const topicLink = topic ? el("a", { class: "card-topic", href: topic.href || "#", title: topic.title || "the topic", onclick: topic.onClick ? (ev) => { ev.preventDefault(); topic.onClick(); } : null }, lane) : lane;
  setKids(node, el("div", { class: "stage-card-head" }, el("span", { class: "note mono" }, `${stampLabel(createdOn(e)) || "today"} · `, topicLink), badge),
    el("h3", {}, link(e.title.replace(/`/g, ""), { title: "read the whole entry" })),
    el("div", { class: "pills" }, ...typePills(e.type), statusPill((day ? statusAt(e, day, state !== shared.self || shared.hasRepo(e)) : null) || e.status), evPill(e.evidence)),
    body ? el("div", { class: "body stage-card-body" }, renderBody(body)) : el("p", { class: "empty stage-card-body" }, typeof (state || shared.state).bodies === "string" ? "loading the text…" : "no text"),
    el("div", { class: "stage-card-foot" }, e.git?.created?.author ? el("span", { class: "note" }, `recorded by ${e.git.created.author}`) : el("span"), link("open ›")));
  const st = state || shared.self;
  if (st && typeof st.bodies === "string" && !st.bodiesLoaded && !st.bodiesError) bodies(st).then(() => { if (node.isConnected) again?.(); });
}
const laneTitle = (e) => (e.project ? `${e.project} · ` : "") + (topicOf(e.file)?.title || e.file).replace(/`/g, "");
function entryCard(span) {
  const node = el("div", { class: "stage-card" }); let held = null; // the held entry's Id
  const latest = (d) => { let best = null; for (const e of shared.state.entries) { if (!existsAt(e, d, shared.hasRepo(e))) continue; const c = createdOn(e) || span.to; if (!best || c >= best.c) best = { e, c }; } return best?.e || null; };
  const fill = (e, isHeld, c = null) => fillEntryCard(node, e, { lane: c?.lane?.title || laneTitle(e), href: c?.href || entryHref(e), state: c?.state || shared.self, day: shared.day || span.to,
    topic: !(c?.ext) && !e.project ? { title: "open the topic's page", href: nav.href({ view: "topic", file: e.file }) } : null,
    badge: isHeld ? el("button", { type: "button", class: "pill stage-card-held", title: "let go — back to the latest entry by the day shown", onclick: () => STAGE?.close?.() }, "picked ", el("b", {}, "×")) : el("span", { class: "pill" }, "latest by then"),
    again: () => { if (held ? held === (e.uuid || e.id) : latest(shared.day || span.to) === e) fill(e, isHeld, c); } });
  return { node,
    refresh: () => { if (held) return; const e = latest(shared.day || span.to); if (e) fill(e, false); else setKids(node, el("p", { class: "empty" }, "No entry by this day.")); },
    hold: (e, c) => { held = e.uuid || e.id; shared.selected = e.id; fill(e, true, c); },
    release: () => { held = null; shared.selected = null; const e = latest(shared.day || span.to); if (e) fill(e, false); } };
}



// leaving the timeline: the page shows today again, the clock and its playing stop, the stage is gone
const leave = () => { shared.day = null; CLOCK_N = -1; stopPlay(); STAGE = null; };

return Object.freeze({ view, leave, stage: () => STAGE, setClock, stopPlay, fillEntryCard, runStage, stageLegend, typeGlyph, arrange: () => ARRANGE, setArrange, foreign: () => FOREIGN, setForeign, foreignShown });
}

const KTW = (root.KeepTheWhy = root.KeepTheWhy || {});
KTW.views = KTW.views || {};
KTW.views.timeline = Object.freeze({ create });
})(globalThis);
