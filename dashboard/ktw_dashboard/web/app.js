/* Keep the Why dashboard — plain modules (this and lib.js), no dependencies.
   The page knows only the state (see state.py): live from /api/events, or
   embedded as window.__KTW_STATE__ in an export. It renders; it never writes. */

import { esc, plural, typeName, UUID_RE, isUuid, rawFileUrl, configLine, normalizeState, slug, hostFileLink, canonicalOf, parseSupersededBy, kindLabel, groupByFamily, searchTerms, searchHit, compareHits, snippetAt, highlight, resolveLocation, linkFamily, authorLookup, mergeStates, friendsOf, thoughtsOf, thoughtInsights, hostOf, backlinksUrl, citingOf, hostAnchor , todayISO, addDays, dayDiff, existsAt, statusAt, seeDay, supersededDay, linkExistsAt, daySpan, createdOn } from "./lib.js";

const $ = (sel, root = document) => root.querySelector(sel);
const narrow = () => !!window.matchMedia?.("(max-width: 900px)").matches;
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
  return n;
};
const setKids = (node, ...kids) => node.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
const fmtDate = (d) => d || "—";
// the platform's mark before a repository's name, from its URL (lib.js HOSTS);
// none for a host no row knows
function hostMark(url) {
  const h = hostOf(url); if (!h) return null;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("class", "host-mark"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", h.name);
  // the name as aria-label, not as an SVG title element: that would join the link's text
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); path.setAttribute("d", h.path);
  svg.append(path); return svg;
}
const remoteLink = (remote) => el("a", { class: "gh", href: `https://${remote}`, target: "_blank", rel: "noopener" }, hostMark(remote), remote);
const onGitHub = (g) => !!g?.remote && /^github\.com\//.test(g.remote);
// a fork checkout: `origin` is the fork, the published repository is elsewhere — read from
// the `upstream` remote, or from `canonical` in .keep-the-why differing from `origin`
const forkTitle = (f) => f.by === "upstream" ? "this checkout has an `upstream` remote: origin is a fork of it" : "origin differs from the project's `canonical` (.keep-the-why): this checkout is a fork or mirror of it";
const forkPill = (g) => g?.fork ? el("span", { class: "pill fork", title: forkTitle(g.fork) }, "fork of ", remoteLink(g.fork.of)) : null;
const schemaPill = (p) => el("span", { class: "pill" }, el("a", { class: "gh", href: `https://github.com/oliver-zehentleitner/keep-the-why/releases/tag/v${p.schema}`, target: "_blank", rel: "noopener", title: `context-schema ${p.schema} — the Keep the Why release this context/ was last checked against` }, `schema ${p.schema}`));
const headPill = (g) => {
  if (!g?.available) return null;
  const branch = g.branch && g.branch !== "HEAD" ? g.branch : null;
  if (!onGitHub(g)) return el("span", { class: "pill", title: g.remote || "" }, `${branch || "detached"}@${g.head}`);
  const base = `https://${g.remote}`;
  return el("span", { class: "pill", title: "branch and commit on GitHub" },
    branch ? el("a", { class: "gh", href: `${base}/tree/${encodeURIComponent(branch)}`, target: "_blank", rel: "noopener" }, branch) : "detached", "@",
    el("a", { class: "gh", href: `${base}/commit/${g.head_full || g.head}`, target: "_blank", rel: "noopener", title: g.head_full || g.head }, g.head));
};
// The centre: the project the page shows. Read from the URL when the page
// loads; a walk to a friend or back along the path changes it in place
// (setCentre), without a reload — see "path" below.
let PUBLIC = new URLSearchParams(location.search).get("public"); // a canonical: browse that project's published export
let PUBLIC_ROOT = new URLSearchParams(location.search).get("root") || "";
let MODE = PUBLIC ? "public" : window.__KTW_STATE__ ? "export" : "live";
const LIVE = () => MODE === "live";
// A static page (an export on a docs site, on a phone) is public by nature: it
// has no machine to read, so it has no local/public switch, and its family —
// like public mode's — comes from the members' published exports, fetched
// when someone asks for the family, never before.
const STATIC = !!window.__KTW_STATE__;
const PUBLISHED = () => MODE === "public" || MODE === "export";
const MY_ROOT = () => (MODE === "export" ? SELF?.project?.root || "" : PUBLIC_ROOT);
const PUBLIC_STATES = {}; // `${canonical}|${root}` -> Promise<{state, url} | {error}>, one fetch per project however many ask at once
// A published file of another project: whoever owns that repository chose the
// URL, so no referrer and no credentials go with the request, a slow host
// times out, and an oversized answer is refused before it is parsed.
const FOREIGN_TIMEOUT_MS = 10000, FOREIGN_MAX_BYTES = 20 * 1024 * 1024;
// What the page has loaded: every state.json and .keep-the-why, by address, with its size — this project's
// own state, the family's, the friends', what a See into another repository resolved. The status bar
// counts the states and sums the bytes; a click lists them. Measured as bytes of the text received.
const LOADED = new Map(); // url -> { bytes, kind, at }
const FAILED = new Map(); // url -> { error, kind, canonical?, at } — a fetch that did not come back; dropped when it later succeeds
function noteFailed(url, error, extra = {}) {
  const kind = /state\.body\.json/.test(url) ? "bodies" : /state\.json/.test(url) ? "state" : /\.keep-the-why/.test(url) ? "config" : /index\.json/.test(url) ? "registry index" : "file";
  FAILED.set(String(url), { ...(FAILED.get(String(url)) || {}), error, kind, at: Date.now(), ...extra });
  renderLoaded();
}
const bytesOf = (text) => { try { return new TextEncoder().encode(text).length; } catch { return String(text).length; } };
const fmtBytes = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(2)} MB` : b >= 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`);
function noteLoaded(url, text, kind, extra = {}) {
  kind = kind || (/state\.body\.json/.test(url) ? "bodies" : /state\.json/.test(url) ? "state" : /\.keep-the-why/.test(url) ? "config" : "other");
  const r = { bytes: bytesOf(text), kind, at: Date.now(), ...extra };
  // a state says which versions made it: the project's context-schema (the Keep the Why version it is on),
  // the dashboard that exported it, the linter that parsed it; a .keep-the-why names its context-schema
  try {
    if (kind === "state" || kind === "page") { const s = JSON.parse(text); r.project = s.project?.id || ""; r.schema = s.project?.schema || ""; r.dashboard = s.dashboard || ""; r.linter = s.linter || ""; r.lean = typeof s.bodies === "string"; }
    else if (kind === "config") { r.schema = configLine(text, "context-schema") || ""; r.project = configLine(text, "id") || ""; }
  } catch { /* not JSON, or not a state: the size and address still count */ }
  LOADED.set(String(url), r); FAILED.delete(String(url));
  renderLoaded();
}
const loadedTotals = () => { let bytes = 0, states = 0; for (const r of LOADED.values()) { bytes += r.bytes; if (r.kind === "state" || r.kind === "page") states++; } return { bytes, states, files: LOADED.size }; };
function renderLoaded() {
  const box = $("#loaded"); if (!box) return;
  const { bytes, states } = loadedTotals();
  const a = box.querySelector("a"); if (a) { setKids(a, `${plural(states, "state")} · ${fmtBytes(bytes)}`, FAILED.size ? el("span", { class: "warn" }, ` · ⚠ ${FAILED.size} failed`) : null); }
  const pop = box.querySelector(".loaded-pop"); if (pop) fillLoadedPop(pop);
}
// The state monitor, one line per project: which files of it the page holds — the state, its bodies, its
// .keep-the-why — each with its size and address, the versions that made it, and a link to that project's
// dashboard. The page's own state comes first and says how it arrived: embedded in the page (an export) or
// from the local server, in full either way; a neighbour's state is lean when its export keeps the bodies beside it.
const dirOf = (url) => String(url).replace(/[?#].*$/, "").replace(/[^/]*$/, "");
function loadedProjects() {
  const groups = new Map(); const byDir = new Map();
  const group = (key) => { if (!groups.has(key)) groups.set(key, { key, files: {} }); return groups.get(key); };
  const entries = [...LOADED.entries()];
  for (const [url, r] of entries) if (r.kind === "state" || r.kind === "page") {
    const G = group(r.project || url); G.files.state = { url, ...r }; G.project ||= r.project; byDir.set(dirOf(url), G);
    G.own ||= !!r.own || (!!r.project && r.project === SELF?.project?.id); // the centre, however it arrived (embedded, local server, public mode)
    const m = String(url).match(/\/api\/state\.json\?project=([^&#]+)/);
    G.dashboard = G.own ? null : m ? `${location.pathname}?project=${m[1]}#overview` : dirOf(url);
  }
  for (const [url, r] of entries) if (r.kind === "bodies") { const G = byDir.get(dirOf(url)) || group(url); G.files.bodies = { url, ...r }; }
  for (const [url, r] of entries) if (r.kind === "config") { const G = (r.project && groups.get(r.project)) || group(r.project || url); G.files.config = { url, ...r }; G.project ||= r.project; }
  for (const [url, r] of entries) if (r.kind === "other") group(url).files.other = { url, ...r };
  const total = (G) => Object.values(G.files).reduce((n, f) => n + f.bytes, 0);
  return [...groups.values()].sort((a, b) => (b.own - a.own) || total(b) - total(a)).map((G) => ({ ...G, bytes: total(G) }));
}
function fillLoadedPop(pop) {
  const { bytes } = loadedTotals();
  const list = loadedProjects();
  const fileLink = (f, label) => el("a", { href: f.url, target: "_blank", rel: "noopener", title: f.url }, label);
  const row = (G) => {
    const st = G.files.state, b = G.files.bodies, c = G.files.config;
    const v = st ? [st.schema ? `ktw ${st.schema}` : null, st.dashboard ? `dashboard ${st.dashboard}` : null, st.linter ? `lint ${st.linter}` : null].filter(Boolean).join(" · ") : c?.schema ? `ktw ${c.schema}` : "";
    const parts = [];
    if (st) parts.push(el("span", {}, `state ${fmtBytes(st.bytes)}`,
      el("span", { class: "note" }, st.kind === "page" ? " — embedded in this page, in full" : st.own && !st.lean && LIVE() ? " — from the local server, in full" : st.lean ? " — lean, bodies beside it" : " — in full")));
    if (b) parts.push(el("span", {}, `bodies ${fmtBytes(b.bytes)}`));
    else if (st?.lean) parts.push(el("span", { class: "note" }, "bodies not loaded — fetched when an entry is opened"));
    if (c) parts.push(el("span", {}, `.keep-the-why ${fmtBytes(c.bytes)}`));
    if (G.files.other) parts.push(el("span", {}, `file ${fmtBytes(G.files.other.bytes)}`));
    // the links on a line of their own, under the name: the dashboard, then each file that came
    const links = [
      G.dashboard ? el("a", { class: "dash", href: G.dashboard, target: G.dashboard.startsWith(location.pathname) ? null : "_blank", rel: "noopener", title: "this project's dashboard" }, "dashboard ↗") : null,
      st && st.kind !== "page" ? fileLink(st, "state ↗") : null,
      b ? fileLink(b, "bodies ↗") : null,
      c ? fileLink(c, ".keep-the-why ↗") : null,
      G.files.other ? fileLink(G.files.other, "file ↗") : null,
    ].filter(Boolean);
    return el("div", { class: `loaded-row${G.own ? " own" : ""}` }, el("span", { class: "size" }, fmtBytes(G.bytes)),
      el("span", { class: "what" },
        el("b", {}, G.project || "—"), G.own ? el("span", { class: "pill" }, "this page") : null,
        links.length ? [el("br"), ...links.flatMap((a, i) => (i ? [el("span", { class: "sep" }, " · "), a] : [a]))] : null,
        v ? [el("br"), el("span", { class: "note" }, v)] : null,
        el("br"), ...parts.flatMap((p, i) => (i ? [el("span", { class: "sep" }, " · "), p] : [p]))));
  };
  // what did not come back: a block of its own at the bottom, reached from the header's warning
  const failed = [...FAILED.entries()].sort((x, y) => y[1].at - x[1].at);
  const failedBlock = failed.length ? el("div", { class: "loaded-failed", id: "loaded-failed" }, el("div", { class: "loaded-head warn" }, `Not loaded (${failed.length})`),
    ...failed.map(([url, f]) => el("div", { class: "loaded-row failed" }, el("span", { class: "size warn" }, "⚠"),
      el("span", { class: "what" }, el("b", {}, hostMark(f.canonical), f.canonical ? repoLabel(f.canonical) : f.kind), el("span", { class: "note" }, ` — ${f.kind}`),
        el("br"), el("span", { class: "err" }, (f.error.startsWith(`${url}: `) ? f.error.slice(url.length + 2) : f.error.endsWith(` for ${url}`) ? f.error.slice(0, -(url.length + 5)) : f.error)), // the address is linked below; say it once
        el("br"), el("a", { href: url, target: "_blank", rel: "noopener", title: "open it in the browser — does it answer at all?" }, `${url} ↗`))))) : null;
  const toFailed = failed.length ? el("a", { href: "#", class: "warn", onclick: (ev) => { ev.preventDefault(); pop.querySelector("#loaded-failed")?.scrollIntoView?.({ block: "start", behavior: "smooth" }); } }, ` · ⚠ ${failed.length} not loaded ↓`) : null;
  setKids(pop, el("div", { class: "loaded-head" }, `${plural(list.length, "project")} — ${plural(LOADED.size, "file")} — ${fmtBytes(bytes)}`, toFailed), ...list.map(row), failedBlock);
}
// whether this page follows the project: a dot and a word in the status bar, beside the state monitor. One node,
// kept across re-renders of the bar (every live update rebuilds it), so its state survives them.
let LIVE_NODE = null;
function liveUi() {
  if (!LIVE_NODE) LIVE_NODE = el("span", { id: "live", class: "live", title: "connecting to the dashboard server" }, el("i", { class: "live-dot" }, "●"), el("span", { class: "live-label" }, "connecting"));
  return LIVE_NODE;
}
function setLive(kind, label, title) { const n = liveUi(); n.className = `live ${kind}`; n.title = title; n.querySelector(".live-label").textContent = label; }
function loadedUi() {
  const box = el("span", { id: "loaded" });
  const pop = el("div", { class: "loaded-pop", hidden: true });
  const a = el("a", { href: "#", title: "what this page has loaded: every state.json and .keep-the-why, with its size and address — and what did not come back", onclick: (ev) => { ev.preventDefault(); pop.hidden = !pop.hidden; if (!pop.hidden) { fillLoadedPop(pop); if (FAILED.size) pop.querySelector("#loaded-failed")?.scrollIntoView?.({ block: "start" }); } } }, "");
  box.append(a, pop);
  return box;
}
async function fetchForeign(url) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), FOREIGN_TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    if (Number(res.headers?.get?.("content-length") || 0) > FOREIGN_MAX_BYTES) throw new Error(`${url} is larger than ${FOREIGN_MAX_BYTES / 1024 / 1024} MB`);
    const text = await res.text();
    if (text.length > FOREIGN_MAX_BYTES) throw new Error(`${url} is larger than ${FOREIGN_MAX_BYTES / 1024 / 1024} MB`);
    noteLoaded(url, text);
    return text;
  } catch (err) {
    // A request the browser refuses to show the page — no CORS header on the host — and a host that is down
    // reach the page as the same TypeError, by design: it may not learn why another origin said no. Name both,
    // and the header a host serving exports needs, so "blocked" is not mistaken for "nothing there". Every
    // failure is recorded for the state monitor, which lists what did not come back beside what did.
    const e = err?.name === "AbortError" ? new Error(`${url} did not answer within ${FOREIGN_TIMEOUT_MS / 1000} s`)
      : err?.name === "TypeError" ? new Error(`${url}: network error or blocked by CORS — the browser does not say which. A host serving Keep the Why exports must send Access-Control-Allow-Origin.`) : err;
    noteFailed(url, e?.message || String(e));
    throw e;
  }
  finally { clearTimeout(timer); }
}
const sameCanonical = (a, b) => String(a || "").replace(/\/+$/, "").toLowerCase() === String(b || "").replace(/\/+$/, "").toLowerCase();
function fetchPublicState(canonical, root = "") {
  const key = `${canonical}|${root}`;
  return (PUBLIC_STATES[key] ||= loadPublicState(canonical, root));
}
async function loadPublicState(canonical, root) {
  let result, url = "";
  const raw = rawFileUrl(canonical, root, ".keep-the-why");
  try {
    url = configLine(await fetchForeign(raw), "dashboard-state");
    if (!url) { result = { error: `no dashboard-state line in the published .keep-the-why (${raw}) — this project has no published export yet`, raw, missingLine: true }; noteFailed(raw, result.error, { canonical }); }
    else if (!/^https:\/\//.test(url)) { result = { error: `dashboard-state is not an https URL: ${url}`, raw }; noteFailed(raw, result.error, { canonical }); }
    else {
      const state = normalizeState(JSON.parse(await fetchForeign(url)));
      state.__url = url; // where it came from: its bodies, if kept beside it, resolve against this
      // an export names the project it was made from; one that claims another repository is not shown as this one
      const claimed = state.project?.canonical;
      // a fork's export: made in a checkout whose origin is the cited repository, declaring the repository it was
      // forked from as its canonical — shown as that fork, with what it says it is a fork of
      const origin = state.project?.git?.remote ? `https://${state.project.git.remote}` : "";
      if (claimed && !sameCanonical(claimed, canonical) && origin && sameCanonical(origin, canonical)) result = { state, url, canonical, root, raw, forkOf: claimed };
      else if (claimed && !sameCanonical(claimed, canonical)) { result = { error: `the export at ${url} belongs to ${claimed}, not to ${canonical}`, raw }; noteFailed(url, result.error, { canonical }); }
      else result = { state, url, canonical, root, raw };
    }
  } catch (err) {
    result = { error: `could not fetch the export: ${err?.message || "network error or blocked by CORS"}`, raw };
    for (const u of [raw, url]) { const f = u && FAILED.get(u); if (f) f.canonical = canonical; } // the failed fetch belongs to this repository
    renderLoaded();
  }
  return result;
}
// An export since dashboard 0.6.0 keeps its entries' bodies in state.body.json beside state.json (`bodies` names
// it) — three quarters of the file, read only when an entry is shown. The graph, the globe and the registry
// never need them; the centre, the merged family's search and the thought reader do, and ask here first.
// An older export carries its bodies inline and has no `bodies` field; nothing to fetch then.
const BODIES = new Map(); // state -> Promise
function ensureBodies(state) {
  if (!state || typeof state.bodies !== "string" || !state.__url) return Promise.resolve(state);
  if (state.__bodies) return state.__bodies;
  const url = new URL(state.bodies, state.__url).href;
  state.__bodies = fetchForeign(url).then((text) => {
    const got = JSON.parse(text).bodies || {};
    for (const e of state.entries) { const b = got[e.id]; if (b != null) e.body = b && typeof b === "object" ? b : { text: String(b || ""), reason: "" }; }
    state.bodiesLoaded = true;
    return state;
  }).catch((err) => { state.bodiesError = err?.message || "could not fetch the bodies"; return state; });
  return state.__bodies;
}
const publicHref = (canonical, root = "", hash = "#overview") => `${location.pathname}?public=${encodeURIComponent(canonical)}${root ? `&root=${encodeURIComponent(root)}` : ""}${hash}`;

// ---------------------------------------------------------------- state
let S = null; // what the page shows: this project, or with the family scope the whole family merged (lib.js, mergeStates)
let SELF = null; // this project's own state, always
let PROJECT = new URLSearchParams(location.search).get("project"); // null: the server's selected one
const api = (path) => PROJECT ? `${path}?project=${encodeURIComponent(PROJECT)}` : path;
let filter = { status: "", evidence: "", author: "" };
let selected = null; // entry id shown in the details pane
// The clock: the day the page shows — the timeline's playhead. Set while the timeline is open, null
// everywhere else. Every graph on the page follows it: only what existed on that day, with the status it
// had then, and the See and Superseded by lines that had been written by then (lib.js, existsAt and friends).
let CLOCK = null; let CLOCK_N = -1;
const atClock = (e) => existsAt(e, CLOCK);
const statusNow = (e) => (CLOCK ? statusAt(e, CLOCK) || e.status : e.status);
function setClock(day) {
  if (day === CLOCK) return;
  CLOCK = day;
  // the layout settles again only when the set of nodes changed, not on every day the playhead passes
  const n = S ? S.entries.filter(atClock).length : 0; const grew = n !== CLOCK_N; CLOCK_N = n;
  for (const g of ACTIVE_GRAPHS) { if (grew && g.alpha < 0.2) g.alpha = 0.2; g.wake?.(); }
  STAGE?.wake?.();
}
const byId = () => Object.fromEntries(S.entries.map((e) => [e.id, e]));
const byUuid = () => Object.fromEntries(S.entries.filter((e) => e.uuid).map((e) => [e.uuid, e]));
// an entry's address is its Id, so a copied link survives a renamed heading or a moved entry; file#anchor only without one
const entryHref = (e) => `#entry/${encodeURIComponent(e.uuid || e.id)}`;
const entryOf = (ref) => byId()[ref] || (isUuid(ref) ? byUuid()[ref] : null);
const topicOf = (file) => S.topics.find((t) => t.file === file);
const entriesOf = (file) => S.entries.filter((e) => e.file === file);
const authorOf = (e) => e.git?.created?.author || e.git?.last_touched?.author || "";
const matches = (e) =>
  (!filter.status || e.status === filter.status) &&
  (!filter.evidence || e.evidence === filter.evidence) &&
  (!filter.author || authorOf(e) === filter.author || e.git?.last_touched?.author === filter.author);
const filterActive = () => !!(filter.status || filter.evidence || filter.author);
const queues = () => ({
  open: S.entries.filter((e) => e.status === "open"),
  "needs-review": S.entries.filter((e) => e.status === "needs-review"),
  "pending-confirmation": S.entries.filter((e) => e.status === "pending-confirmation"),
  // Evidence is its own axis (Core rule 5): an open question with an untraced origin counts here and under open
  unknown: S.entries.filter((e) => e.evidence === "unknown" && e.status !== "superseded"),
  revisit: S.entries.filter((e) => e.revisit_when && e.status !== "superseded"),
});
// every entry that needs a person, once — an entry can wait in two queues
const queueTotal = () => { const q = queues(); return new Set([...q.open, ...q["needs-review"], ...q["pending-confirmation"], ...q.unknown]).size; };

// ---------------------------------------------------------------- markdown (small, safe)
// a merged member's entry names its own project's topic files: resolve them there
let INLINE_PROJECT = null;
const inProject = (f) => (INLINE_PROJECT ? `${INLINE_PROJECT}/${f}` : f);
function inline(md) {
  let s = esc(md);
  s = s.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:]|$)/g, "$1<i>$2</i>");
  s = s.replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s).,;:]|$)/g, "$1<i>$2</i>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
    if (/^[A-Za-z0-9._-]+\.md(#.*)?$/.test(u) && topicOf(inProject(u.split("#")[0]))) return `<a href="#topic/${inProject(u.split("#")[0])}">${t}</a>`;
    if (/^https?:\/\//.test(u)) return `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
    return `<a>${t}</a>`;
  });
  // bare topic references become links
  s = s.replace(/(^|[^\w/">#-])(<code>)?([A-Za-z0-9][A-Za-z0-9._-]*\.md)(<\/code>)?(?![\w"])/g, (m, pre, c1, f, c2) =>
    topicOf(inProject(f)) ? `${pre}<a href="#topic/${inProject(f)}">${c1 || ""}${f}${c2 || ""}</a>` : m);
  return s;
}
function renderMarkdown(md) {
  const out = [];
  const lines = md.split("\n");
  let i = 0;
  const LABEL = /^\*\*(Reason|Rejected alternative|Consequence|Considered|Why this needs an answer):\*\*\s*(.*)$/;
  const cls = { Reason: "reason", "Rejected alternative": "rejected", Consequence: "consequence", Considered: "considered", "Why this needs an answer": "why-open" };
  while (i < lines.length) {
    const ln = lines[i];
    if (!ln.trim()) { i++; continue; }
    if (/^\s*(```|~~~)/.test(ln)) {
      const fence = ln.trim().slice(0, 3); const buf = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) buf.push(lines[i++]);
      i++; out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`); continue;
    }
    if (/^#{1,6}\s/.test(ln)) { out.push(`<p><b>${inline(ln.replace(/^#+\s*/, ""))}</b></p>`); i++; continue; }
    if (/^\s*[-*]\s+/.test(ln)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*[-*]\s+/, ""); i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) item += " " + lines[i++].trim();
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push(`<ul>${items.join("")}</ul>`); continue;
    }
    if (/^\s*\d+\.\s+/.test(ln)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(`<li>${inline(lines[i++].replace(/^\s*\d+\.\s+/, ""))}</li>`);
      out.push(`<ol>${items.join("")}</ol>`); continue;
    }
    // paragraph (until blank line); labelled paragraphs get a callout
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^\s*(```|~~~|[-*]\s|\d+\.\s|#{1,6}\s)/.test(lines[i])) buf.push(lines[i++]);
    const para = buf.join(" ");
    const m = para.match(LABEL);
    if (m) out.push(`<div class="label ${cls[m[1]]}"><b>${m[1]}</b><p>${inline(m[2])}</p></div>`);
    else out.push(`<p>${inline(para)}</p>`);
  }
  return out.join("\n");
}

// ---------------------------------------------------------------- shared bits
const pill = (text, cls = "") => el("span", { class: `pill ${cls}` }, text);
const statusPill = (s) => pill(s || "—", `status-${s}`);
const evPill = (e) => pill(e || "—", `ev-${e}`);
const typePills = (types) => (types?.length ? types : ["—"]).map((t) => { const p = pill(typeName(t), "type"); if (t !== typeName(t)) p.title = t; return p; });
const entryPills = (e) => [...typePills(e.type), statusPill(e.status), evPill(e.evidence)];
function bars(counts, order, clsPrefix = "") {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const keys = [...order.filter((k) => k in counts), ...Object.keys(counts).filter((k) => !order.includes(k))];
  return el("div", { class: "bars" }, keys.map((k) => [
    el("span", { class: "k" }, k || "(none)"),
    el("div", { class: "bar" }, el("i", { class: `${clsPrefix}${k}`, style: `width:${(100 * counts[k]) / total}%` })),
    el("span", { class: "v" }, counts[k]),
  ]));
}
function stack(counts, order) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return el("div", { class: "stack" }, order.filter((k) => counts[k]).map((k) => el("i", { style: `width:${(100 * counts[k]) / total}%;background:var(--${k})`, title: `${k}: ${counts[k]}` })));
}
const count = (list, key) => list.reduce((m, e) => ((m[e[key] || ""] = (m[e[key] || ""] || 0) + 1), m), {});
const typeCounts = (list) => list.reduce((m, e) => { for (const t of e.type?.length ? e.type.map(typeName) : ["(none)"]) m[t] = (m[t] || 0) + 1; return m; }, {});
const STATUS_ORDER = ["active", "open", "needs-review", "pending-confirmation", "superseded"];
const EV_ORDER = ["confirmed", "inferred", "unknown"];
const entryLink = (e, extra = "") => el("a", { href: entryHref(e), class: extra }, e.title);
const projectOf = (x) => (x?.project ? x.project : null); // a merged family member's name, null for this project
function entryRow(e) {
  const snippet = e.body.reason || e.body.text.split("\n")[0] || "";
  const g = e.git;
  return el("a", { href: entryHref(e), class: `row ${matches(e) ? "" : "dim"}` },
    el("div", { class: "rt" }, el("span", { html: inline(e.title) }), ...entryPills(e)),
    el("div", { class: "rs" }, snippet.replace(/\*\*|`/g, "")),
    el("div", { class: "rm" }, [projectOf(e), topicOf(e.file)?.title || e.file, g?.created?.author ? `${g.created.author} · ${g.created.date}` : null, g?.last_touched?.date && g.last_touched.date !== g?.created?.date ? `touched ${g.last_touched.date}` : null].filter(Boolean).join("  ·  ")));
}


// ---------------------------------------------------------------- global strip (numbers on every view)
function renderStrip() {
  const q = queues(); const s = $("#strip"); s.replaceChildren();
  const stat = (label, n, href, cls = "", title = "") => el("a", { class: `stat ${cls} ${n ? "" : "zero"}`, href, title }, el("b", {}, n), label);
  const f = S.findings;
  s.append(
    stat("entries", S.entries.length, "#overview"), stat("topics", S.topics.length, "#overview"), stat("authors", S.authors.length, "#authors"),
    el("span", { class: "sep" }), el("span", { class: "lbl" }, "needs a person"),
    stat("open", q.open.length, "#queues", "q-open"), stat("needs review", q["needs-review"].length, "#queues", "q-needs-review"),
    stat("pending", q["pending-confirmation"].length, "#queues", "q-pending-confirmation"), stat("unknown evidence", q.unknown.length, "#queues", "q-unknown"),
    stat("revisit-when", q.revisit.length, "#queues", "", "Revisit-when triggers on record"),
    el("span", { class: "sep" }), el("span", { class: "lbl" }, "lint"),
    stat("errors", f.errors, "#findings", f.errors ? "lint-bad hot" : "lint-ok", `keep-the-why-lint ${S.linter}`),
    stat("warnings", f.warnings, "#findings", f.warnings ? "lint-warn" : "lint-ok", `keep-the-why-lint ${S.linter}`),
  );
}
function viewFindings(main) {
  const f = S.findings;
  main.append(el("h1", {}, "Linter findings"), el("p", { class: "sub" }, `keep-the-why-lint ${S.linter} · ${f.errors} error(s), ${f.warnings} warning(s) · structure only, never content`));
  if (!f.items.length) return main.append(el("p", { class: "center" }, "Clean — nothing to show."));
  main.append(el("div", { class: "table-wrap" }, el("table", { class: "t findings" }, el("thead", {}, el("tr", {}, ["Severity", "Code", "Where", "Message"].map((h) => el("th", {}, h)))),
    el("tbody", {}, f.items.map((x) => {
      const entry = S.entries.find((e) => (e.project || null) === (x.project || null) && `${(e.origin?.state?.project || S.project).context}${e.localFile || e.file}` === (x.localPath || x.path) && e.line <= x.line && x.line <= e.end_line + 1);
      return el("tr", {}, el("td", {}, pill(x.severity, `sev-${x.severity}`)), el("td", { class: "mono" }, x.code),
        el("td", { class: "mono" }, entry ? el("a", { href: entryHref(entry) }, `${x.path}:${x.line}`) : `${x.path}${x.line ? ":" + x.line : ""}`), el("td", {}, x.message));
    })))));
}

// ---------------------------------------------------------------- sidebar
function renderSidebar() {
  const tree = $("#tree");
  tree.replaceChildren();
  const openState = JSON.parse(sessionStorage.getItem("ktw-tree") || "{}");
  let lastProject;
  for (const t of S.topics) {
    if (S.merged && t.project !== lastProject) { lastProject = t.project; tree.append(el("div", { class: "tree-project" }, t.project || (SELF.project.name || SELF.project.id))); }
    const list = entriesOf(t.file);
    const d = el("details", { open: openState[t.file] ?? (S.topics.length <= 6) });
    d.addEventListener("toggle", () => { openState[t.file] = d.open; sessionStorage.setItem("ktw-tree", JSON.stringify(openState)); });
    d.append(el("summary", { "data-file": t.file, onclick: (ev) => { if (ev.target.closest(".tw")) return; ev.preventDefault(); location.hash = `#topic/${t.file}`; d.open = true; } },
      el("span", { class: "tw" }, "▶"), el("span", { class: "tt" }, t.title), el("span", { class: "count" }, list.length)));
    for (const e of list) d.append(el("a", { href: entryHref(e), class: `leaf ${matches(e) ? "" : "dim"}`, "data-id": e.id, title: e.title },
      el("i", { class: `dot ${e.evidence} ${e.status}` }), el("span", {}, e.title.replace(/`/g, ""))));
    tree.append(d);
  }
  $("#tree-count").textContent = `${S.topics.length} · ${plural(S.entries.length, "entry")}`;
  $("#queue-count").textContent = queueTotal() || "";
  // filters
  const fill = (id, key, values, label) => {
    const sel = $(id); const cur = filter[key];
    sel.replaceChildren(el("option", { value: "" }, `${label}: all`), ...values.map((v) => el("option", { value: v, selected: v === cur }, v)));
    sel.classList.toggle("set", !!cur);
    sel.onchange = () => { filter[key] = sel.value; rerender(); };
  };
  fill("#f-status", "status", STATUS_ORDER.filter((s) => S.entries.some((e) => e.status === s)), "status");
  fill("#f-evidence", "evidence", EV_ORDER.filter((s) => S.entries.some((e) => e.evidence === s)), "evidence");
  fill("#f-author", "author", S.authors.map((a) => a.name), "author");
  $("#f-clear").hidden = !filterActive();
  $("#f-clear").onclick = () => { filter = { status: "", evidence: "", author: "" }; rerender(); };
  markActive();
}
function markActive() {
  const route = location.hash.slice(1) || "overview";
  for (const a of document.querySelectorAll(".nav a")) a.classList.toggle("active", route.startsWith(a.dataset.route));
  const entry = route.startsWith("entry/") ? entryOf(decodeURIComponent(route.slice(6))) : null;
  const file = route.startsWith("topic/") ? route.slice(6) : entry?.file || null;
  for (const s of document.querySelectorAll(".tree summary")) s.classList.toggle("active", s.dataset.file === file && route.startsWith("topic/"));
  for (const a of document.querySelectorAll(".tree .leaf")) a.classList.toggle("active", !!entry && a.dataset.id === entry.id);
  if (file) { const d = document.querySelector(`.tree summary[data-file="${CSS.escape(file)}"]`)?.parentElement; if (d) d.open = true; }
  document.querySelector(".tree .leaf.active")?.scrollIntoView?.({ block: "nearest" });
}

// ---------------------------------------------------------------- views
function viewOverview(main) {
  const list = S.entries;
  const p = S.project; const g = p.git;
  if (S.merged) main.append(el("div", { class: "family-banner" }, el("b", {}, `Family · ${plural(S.family.length, "project")}`), " — ",
    S.family.map((m, i) => [i ? " · " : "", m.project ? el("span", {}, m.project, el("span", { class: "note" }, ` ${S.entries.filter((e) => e.project === m.project).length}`)) : el("span", {}, m.name, el("span", { class: "note" }, ` ${S.entries.filter((e) => !e.project).length}`))]),
    S.missing?.length ? el("span", { class: "warn" }, ` · ${plural(S.missing.length, "member")} not available here`) : null));
  main.append(
    el("h1", {}, p.id || p.name),
    el("p", { class: "sub" }, `${p.context} · schema ${p.schema} · ${p.config["capture-confirmation"] || "?"} · source-reference ${p.config["source-reference"] || "?"}`,
      g?.available ? [" · ", headPill(g), g.remote ? [" · ", remoteLink(g.remote)] : null, g.fork ? [" · ", forkPill(g)] : null, g.shallow ? " · shallow clone (dates are the clone's edge)" : null] : " · no Git"),
    el("div", { class: "grid2" },
      el("div", { class: "card" }, el("h3", {}, "Type"), bars(typeCounts(list), ["decision", "constraint", "workaround", "incident", "undefined"])),
      el("div", { class: "card" }, el("h3", {}, "Status"), bars(count(list, "status"), STATUS_ORDER)),
      el("div", { class: "card" }, el("h3", {}, "Evidence"), bars(count(list, "evidence"), EV_ORDER)),
      el("div", { class: "card" }, el("h3", {}, "Config"), el("div", { class: "kv" }, Object.entries(p.config).map(([k, v]) => [el("span", { class: "k" }, k), el("span", { class: "v mono" }, v)])),
        Object.keys(p.personal_defaults || {}).length ? [el("h3", {}, "Personal defaults offered"), el("div", { class: "kv" }, Object.entries(p.personal_defaults).map(([k, v]) => [el("span", { class: "k" }, k), el("span", { class: "v mono" }, v)]))] : null),
    ),
    el("h2", {}, "Topics"),
    el("div", { class: "topic-cards" }, S.topics.map(topicCard)),
    el("h2", {}, "Recently touched"),
    el("div", { class: "entry-list" }, [...list].filter((e) => e.git?.last_touched?.date !== undefined).sort((a, b) => ((b.git?.last_touched?.date || "") > (a.git?.last_touched?.date || "") ? 1 : -1)).slice(0, 8).map(entryRow)),
  );
}
function topicCard(t) {
  return el("a", { class: "topic-card", href: `#topic/${t.file}` },
    el("div", { class: "tt" }, t.title, el("span", { class: "count" }, plural(t.entries, "entry"))),
    t.project ? el("div", { class: "note" }, t.project) : null,
    el("div", { class: "td" }, t.index_line || el("span", { class: "note" }, "not described in index.md")),
    stack(t.evidence, EV_ORDER),
    el("div", { class: "refs" }, `${t.file} · → ${t.refs_out.length} · ← ${t.refs_in.length}`));
}
function viewTopic(main, file) {
  const t = topicOf(file);
  if (!t) return main.append(el("p", { class: "center" }, `No topic ${file}`));
  const list = entriesOf(file);
  main.append(
    el("div", { class: "crumbs" }, el("a", { href: "#overview" }, "Overview"), " / ", t.file),
    el("h1", {}, t.title),
    el("p", { class: "sub" }, t.index_line || "—"),
    el("div", { class: "grid2" },
      el("div", { class: "card" }, el("h3", {}, "Status"), bars(t.status, STATUS_ORDER)),
      el("div", { class: "card" }, el("h3", {}, "Evidence"), bars(t.evidence, EV_ORDER)),
    ),
    el("h2", {}, "Entries"),
    el("div", { class: "entry-list" }, list.map(entryRow)),
  );
  renderDetailsTopic(t);
}
async function viewEntryElsewhere(main, uuid) {
  if (PUBLISHED()) {
    // an Id this export does not carry: look through the family's published exports
    main.append(el("p", { class: "center" }, `Looking for ${uuid} in the family's published exports…`));
    const t = await publicTree();
    for (const g of t.groups) {
      if (g.member.role === "self") continue;
      if (g.state.entries?.some((e) => e.uuid === uuid)) { location.href = publicHref(g.member.canonical, g.member.root || "", `#entry/${uuid}`); return; }
    }
    return setKids(main, el("p", { class: "center" }, `No entry with Id ${uuid} in this export, nor in the family's published exports.`));
  }
  // an Id this project does not carry: ask the server which known project does
  main.append(el("p", { class: "center" }, `Looking for ${uuid} in the other projects known here…`));
  try {
    const r = await fetch(`/api/entry?uuid=${encodeURIComponent(uuid)}${PROJECT ? `&project=${encodeURIComponent(PROJECT)}` : ""}`, { cache: "no-store" });
    if (!r.ok) throw new Error();
    const hit = await r.json();
    if (hit.project === (PROJECT || null)) return;
    location.href = `${location.pathname}?project=${encodeURIComponent(hit.project)}#entry/${uuid}`;
  } catch { setKids(main, el("p", { class: "center" }, `No entry with Id ${uuid} in this project, nor in any other project known here. A family member that is not checked out can be cloned or cached — see Family.`)); }
}
// #ref/<canonical>/<uuid>: an entry in another repository, family or not — a
// reference row's link before it resolved, or a link someone shared. Resolved
// as the row resolves it (resolveRemoteRef), then the page goes there; the
// canonical and the Id stay on the page when nothing loads.
async function viewRemoteEntry(main, canonical, uuid) {
  const here = byUuid()[uuid];
  if (here) { history.replaceState(null, "", entryHref(here)); return render(); }
  main.append(el("p", { class: "center" }, `Looking for ${uuid} in ${repoLabel(canonical)}…`));
  const r = await resolveRemoteRef(canonical, uuid);
  if (r.entry) { location.href = r.href; return; }
  setKids(main, el("div", { class: "center" }, el("p", {}, `Cannot open ${uuid} in ${repoLabel(canonical)}: ${r.error}.`),
    el("p", { class: "note" }, el("a", { href: canonical, target: "_blank", rel: "noopener" }, canonical.replace(/^https:\/\//, "")))));
}
// A reference into another repository, resolved when it is shown: the entry
// from a project known to the live server, else from the repository's
// published export (its .keep-the-why at HEAD names the dashboard-state).
// One lookup per canonical and Id per page; what comes back is shown as text
// in the reference's row, never merged into this project's counts or queues.
const REMOTE_REFS = {}; // `${canonical}|${uuid}` -> Promise<{entry, href} | {error}>
function resolveRemoteRef(canonical, uuid) {
  const key = `${canonical}|${uuid}`;
  if (!REMOTE_REFS[key]) REMOTE_REFS[key] = (async () => {
    if (LIVE()) {
      try {
        const r = await fetch(`/api/entry?uuid=${encodeURIComponent(uuid)}${PROJECT ? `&project=${encodeURIComponent(PROJECT)}` : ""}`, { cache: "no-store" });
        if (r.ok) { const hit = await r.json(); return { entry: hit.entry || {}, href: `${location.pathname}?project=${encodeURIComponent(hit.project)}#entry/${uuid}` }; }
      } catch { /* not known here: the published export */ }
    }
    const r = await fetchPublicState(canonical, "");
    if (!r.state) return { error: r.error };
    const entry = r.state.entries?.find((e) => e.uuid === uuid);
    if (!entry) return { error: `its published export (generated ${r.state.generated || "?"}) has no entry with this Id — the reference may be newer than the export, or the entry lives below the repository's top level` };
    return { entry, href: publicHref(canonical, "", `#entry/${uuid}`) };
  })();
  return REMOTE_REFS[key];
}
const repoLabel = (canonical) => canonical.replace(/^https:\/\/(github\.com|gitlab\.com|codeberg\.org|bitbucket\.org)\//, "").replace(/^https:\/\//, "");
function remoteRefLine(ref, label) {
  const lead = () => (label ? el("b", {}, label) : null);
  const date = ref.date ? el("span", { class: "note" }, ` · as of ${ref.date}`) : null;
  const repo = () => el("a", { class: "note", href: ref.remote, target: "_blank", rel: "noopener", title: "the repository on its host" }, " · repository");
  const row = el("div", { class: "ref remote" }, lead(), el("a", { href: `#ref/${encodeURIComponent(ref.remote)}/${ref.uuid}` }, hostMark(ref.remote), repoLabel(ref.remote)),
    el("span", { class: "note mono" }, ` · ${ref.uuid}`), el("span", { class: "note" }, " · resolving…"), date, repo());
  resolveRemoteRef(ref.remote, ref.uuid).then((r) => {
    if (r.entry) {
      const e = r.entry; const state = [e.status, e.evidence].filter(Boolean).join(" · ");
      setKids(row, lead(), el("a", { href: r.href }, e.title || ref.uuid), el("span", { class: "note" }, " · ", hostMark(ref.remote), `${repoLabel(ref.remote)}${state ? " · " + state : ""}`), date, repo());
    } else {
      setKids(row, lead(), el("a", { href: ref.remote, target: "_blank", rel: "noopener" }, hostMark(ref.remote), repoLabel(ref.remote)), el("span", { class: "note mono" }, ` · ${ref.uuid}`), el("span", { class: "note warn" }, ` · not resolved: ${r.error}`), date);
    }
  });
  return row;
}
function refLine(ref, label) {
  // one See / Superseded by reference as a row: local -> the entry here; remote -> the canonical, and the Id to find it there
  const target = ref.uuid ? byUuid()[ref.uuid] : null;
  const date = ref.date ? el("span", { class: "note" }, ` · as of ${ref.date}`) : null;
  if (target) return el("div", { class: "ref" }, label ? el("b", {}, label) : null, el("a", { href: entryHref(target) }, target.title), el("span", { class: "note" }, ` · ${topicOf(target.file)?.title || target.file}`), date);
  if (ref.remote && ref.uuid) return remoteRefLine(ref, label);
  if (ref.remote) return el("div", { class: "ref" }, label ? el("b", {}, label) : null, el("a", { href: ref.remote, target: "_blank", rel: "noopener" }, ref.remote.replace(/^https:\/\//, "")), date);
  if (ref.file) return el("div", { class: "ref" }, label ? el("b", {}, label) : null, topicOf(ref.file) ? el("a", { href: `#topic/${ref.file}` }, ref.locator) : ref.locator, el("span", { class: "note mono" }, ` · ${ref.uuid || ""}`), el("span", { class: "note warn" }, " · Id not found here — the locator may be stale"), date);
  return el("div", { class: "ref" }, label ? el("b", {}, label) : null, ref.text || "");
}
// The address to share an entry by: on a published page (an export, public mode) the page's own address; on
// the live server — a local address nobody else can open — the project's published dashboard, from its
// dashboard-state line, when it has one; the local address only as a last resort, and then said so.
function shareUrlOf(e) {
  const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/.test(location.hostname) || location.protocol === "file:";
  const here = location.href.split("#")[0] + entryHref(e);
  if (PUBLISHED() && !local) return { url: here, where: "this page" };
  const st = e.project ? null : (SELF?.project?.dashboard_state || S?.project?.dashboard_state || "");
  if (st && /^https:\/\//.test(st)) return { url: st.replace(/state\.json$/, "") + entryHref(e), where: "the project's published dashboard" };
  return { url: here, where: local ? "this machine only — the project publishes no dashboard" : "this page" };
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* no clipboard API: the old way */ }
  const ta = el("textarea", { style: "position:fixed;opacity:0" }); ta.value = text; document.body.append(ta); ta.select();
  let ok = false; try { ok = document.execCommand("copy"); } catch {} ta.remove(); return ok;
}
function shareButton(e) {
  const s = shareUrlOf(e);
  const b = el("button", { type: "button", class: "share-btn", title: `copy a link to this entry — ${s.where}:\n${s.url}`,
    onclick: async () => { const ok = await copyText(s.url); b.textContent = ok ? "✓ copied" : "copy failed"; b.classList.toggle("done", ok); setTimeout(() => { b.textContent = "⧉ copy link"; b.classList.remove("done"); }, 1800); } }, "⧉ copy link");
  return b;
}
function viewEntry(main, id) {
  const e = entryOf(id);
  if (!e && isUuid(id) && (LIVE() || (PUBLISHED() && canonicalOf(S.project)))) return viewEntryElsewhere(main, id);
  if (!e) return main.append(el("p", { class: "center" }, "No such entry"));
  if (location.hash !== entryHref(e)) history.replaceState(null, "", entryHref(e)); // an old file#anchor link shows the Id address from here on
  const list = entriesOf(e.file); const idx = list.indexOf(e);
  const t = topicOf(e.file);
  INLINE_PROJECT = e.project || null;
  const r = el("div", { class: `reader ${e.status}` },
    el("div", { class: "crumbs" }, el("a", { href: "#overview" }, "Overview"), " / ", el("a", { href: `#topic/${e.file}` }, t?.title || e.file), ` / line ${e.line}`, shareButton(e)),
    el("h1", { html: inline(e.title) }),
    el("div", { class: "fields" }, ...entryPills(e), e.source ? pill(`Source: ${e.source}`, "") : null, e.verification ? pill(`Verification: ${e.verification.split(/\s[—-]\s/)[0]}`, "") : null),
    el("div", { class: "body", html: renderMarkdown(e.body.text || "_(no body)_") }),
    e.revisit_when ? el("div", { class: "body" }, el("div", { class: "label", html: `<b>Revisit when</b><p>${inline(e.revisit_when)}</p>` })) : null,
    refsBox(e),
    el("div", { class: "pager" },
      idx > 0 ? el("a", { href: entryHref(list[idx - 1]) }, `← ${list[idx - 1].title}`) : el("span"),
      idx < list.length - 1 ? el("a", { href: entryHref(list[idx + 1]) }, `${list[idx + 1].title} →`) : el("span")),
  );
  INLINE_PROJECT = null;
  main.append(r);
  selected = e.id;
  renderDetailsEntry(e);
}
// #thought/<id>,<id>,…: a whole thought in one view — every entry of the chain
// in reading order, origin first, each in full, joined by how the next one
// follows from it. The Ids are the entries' own, so the address names the
// thought; entries of friends or of the path's projects are found in what the
// page has loaded, and a missing one says so.
const thoughtHref = (t) => `#thought/${t.steps.map((n) => encodeURIComponent(n.entry.uuid || n.entry.id)).join(",")}`;
function findEntry(ref) {
  const here = entryOf(ref);
  if (here) return { e: here, href: entryHref(here), where: here.project || null, own: true };
  const pools = [
    ...Object.values(FRIENDS.loaded).filter((r) => r?.state).flatMap((r) => (r.members || [r]).map((m) => ({ state: m.state, name: m.name, href: m.href }))),
    ...TRAIL.map((t) => ({ state: t.state, name: t.name, href: (e) => t.url + entryHref(e) })),
  ];
  for (const p of pools) { const e = (p.state.entries || []).find((x) => x.uuid === ref || x.id === ref); if (e) return { e, href: p.href ? p.href(e) : "#graph", where: p.name, own: false, origin: p }; }
  return null;
}
function thoughtLink(a, b) {
  if (!a || !b) return "then";
  if (a.e.uuid && (b.e.see || []).some((x) => x?.uuid === a.e.uuid)) return "cited by";
  const sb = a.e.superseded_by ? parseSupersededBy(a.e.superseded_by) : null;
  if (sb?.uuid && sb.uuid === b.e.uuid) return "superseded by";
  return "then";
}
// the days a thought's steps were created, as ticks on one line
function thoughtTimeline(steps, ins) {
  if (!ins.from || ins.from === ins.to) return ins.from ? el("p", { class: "note" }, `All its steps were written on ${ins.from}.`) : null;
  const t0 = Date.parse(ins.from), t1 = Date.parse(ins.to), days = Math.round((t1 - t0) / 86400000);
  const bar = el("div", { class: "timeline-bar" });
  steps.forEach((f, i) => { const d = f?.e?.git?.created?.date; if (!d) return; const x = ((Date.parse(d) - t0) / (t1 - t0)) * 100; bar.append(el("span", { class: "tick", style: `left:${x}%`, title: `${i + 1}: ${d} — ${f.e.title}`, ...stepHover(f.e.uuid || `e:${f.e.id}`) }, String(i + 1))); });
  return el("div", { class: "thought-timeline" }, el("div", { class: "note" }, `${ins.from} → ${ins.to} · grew over ${plural(days, "day")}`), bar);
}
function viewThought(main, refs) {
  const steps = refs.map(findEntry);
  // a step from another project may come from a lean export: its body is fetched, and the view renders again
  const lean = steps.filter((f) => f?.origin?.state && typeof f.origin.state.bodies === "string" && !f.origin.state.bodiesLoaded && !f.origin.state.bodiesError);
  if (lean.length) Promise.all(lean.map((f) => ensureBodies(f.origin.state))).then(() => { if (location.hash.startsWith("#thought/")) render(); });
  // an entry of a friend is found once the friends are in: they load with a graph, and the view renders again
  if (steps.some((f) => !f) && FRIENDS_AUTO && !FRIENDS.on && !FRIENDS.loading) buildGraph();
  const links = steps.map((f, i) => (i ? thoughtLink(steps[i - 1], f) : null));
  const ins = thoughtInsights(steps.map((f) => f?.e || {}), links.slice(1).map((l) => (l === "superseded by" ? "superseded" : "see")));
  // where the chain goes on beyond what the page has loaded: before its origin, after its newest entry
  const beyond = (f, kind) => (f ? entryRefs(f.e).filter((x) => x.kind === kind && x.remote && !findEntry(x.uuid)) : []);
  const before = beyond(steps[0], "see"), after = beyond(steps[steps.length - 1], "superseded");
  const goOn = (ends, where) => el("div", { class: "thought-beyond" }, `${where} goes on in ${[...new Set(ends.map((x) => repoLabel(x.remote)))].join(", ")} — not loaded on this page. `,
    el("button", { type: "button", class: "link-btn", disabled: CHAIN.busy, onclick: () => followThought({ anchor: steps.filter(Boolean).pop()?.e.uuid }, (c) => { if (c) location.hash = thoughtHref(c); else render(); }) }, CHAIN.busy ? "loading…" : "load the whole chain"));
  const evolution = steps.length > 1 && links.slice(1).every((l) => l === "superseded by");
  const r = el("div", { class: "reader thought-reader" },
    el("div", { class: "crumbs" }, el("a", { href: "#graph" }, "Graph"), " / thought"),
    el("h1", {}, evolution ? `An evolution in ${refs.length} entries` : `A thought in ${refs.length} entries`),
    el("p", { class: "sub" }, evolution ? "One decision, replaced step by step — from the first version to the one in force." : "A chain of linked entries, each citing the one before — read from the first to the last. A link says two entries are related: often that one follows from the other, not always."),
    before.length ? goOn(before.map((x) => ({ ...x })), "↑ Before its origin, it") : null,
    thoughtTimeline(steps, ins),
    ins.weakOrigin ? el("div", { class: "thought-warn" }, `Its first entry's Evidence is ${ins.weakOrigin}. Where a later step depends on it, it depends on a reason nobody confirmed.`) : null);
  steps.forEach((f, i) => {
    if (i) r.append(el("div", { class: "thought-link" }, `↓ ${links[i]}`));
    if (!f) { r.append(el("section", { class: "thought-step missing" }, el("div", { class: "crumbs" }, `${i + 1} / ${refs.length}`), el("p", { class: "note" }, `Entry ${refs[i]} is not loaded on this page — it lives in a project outside it (a friend, or a step of a path); load the friends in the graph, or walk there.`))); return; }
    const e = f.e;
    INLINE_PROJECT = f.own ? e.project || null : "\u0000"; // a foreign entry's file names are not this page's topics
    r.append(el("section", { class: `thought-step ${e.status}`, ...stepHover(e.uuid || `e:${e.id}`) },
      el("div", { class: "crumbs" }, `${i + 1} / ${refs.length}`, f.where ? ` · ${f.where}` : "", f.own && topicOf(e.file) ? [" · ", el("a", { href: `#topic/${e.file}` }, topicOf(e.file).title)] : null, e.git?.created?.date ? ` · ${e.git.created.date}` : ""),
      ins.shaky.some((x) => x.i === i) ? el("div", { class: "thought-warn" }, `In question — ${ins.shaky.find((x) => x.i === i).why}. ${plural(steps.length - 1 - i, "later step")} ${steps.length - 1 - i === 1 ? "is" : "are"} linked after it — worth checking whether they depend on it.`) : null,
      ins.affected.includes(i) && !ins.shaky.some((x) => x.i === i) ? el("div", { class: "thought-affected" }, `Linked after step ${ins.shaky[0].i + 1}, which is in question.`) : null,
      el("h2", {}, el("a", { href: f.href, html: inline(e.title) })),
      el("div", { class: "fields" }, ...entryPills(e)),
      el("div", { class: "body", html: renderMarkdown(e.body?.text || "_(no body)_") }),
      e.revisit_when ? el("div", { class: "body" }, el("div", { class: "label", html: `<b>Revisit when</b><p>${inline(e.revisit_when)}</p>` })) : null));
    INLINE_PROJECT = null;
  });
  if (after.length) r.append(goOn(after, "↓ After its newest entry, it"));
  main.append(r);
  renderDetailsDefault();
}
// ---------------------------------------------------------------- friends and thoughts pages
// Both read the graph of the scope (this project, or the family), with the
// friends, the path and the followed chains it has — the same data the Graph
// view shows, laid out as lists.
const graphForScope = async () => (familyGraphShown() ? buildFamilyGraph() : buildGraph());
const projOf = (n) => n.proj || n.entry?.project || SELF?.project?.id || SELF?.project?.name || "";
const lightAll = (t) => { for (const G of ACTIVE_GRAPHS) lightThought(G, t); };
async function viewFriends(main) {
  main.append(el("h1", {}, "Friends"), el("p", { class: "sub" }, "Repositories the entries here cite outside the family — linked into the graph, never merged into search, queues or counts. A friend in a family comes as the whole family. One hop: a friend's own friends are not loaded; walk there to see them."));
  const box = el("div", { class: "friends-page" }, el("p", { class: "center" }, "Loading…")); main.append(box);
  const g = await graphForScope();
  if (!box.isConnected) return;
  const list = g.friends || [];
  const units = friendUnits(g);
  const failed = list.map((f) => FRIENDS.loaded[fkey(f.canonical)]).filter((r) => r && !r.state);
  const waiting = list.filter((f) => !FRIENDS.loaded[fkey(f.canonical)]);
  const kids = [];
  if (!list.length && !units.length) kids.push(el("p", { class: "empty" }, "No entry here cites a repository outside the family yet. A See line into another project — its canonical and an entry's Id — makes it a friend."));
  if (!CITED.on && !CITED.loading && backlinksUrl(REGISTRY_URL, canonicalOf(SELF?.project))) kids.push(el("p", {}, el("button", { type: "button", class: "link-btn", title: "who in the Keep the Why registry cites this project — one file from the registry, loaded on this click", onclick: () => { CITED.url = backlinksUrl(REGISTRY_URL, canonicalOf(SELF?.project)); loadCited(); } }, "who in the registry cites this project?")));
  if (list.length && (!FRIENDS.on || waiting.length)) kids.push(el("p", {}, FRIENDS.loading ? "Loading friends…" : el("button", { type: "button", class: "link-btn", onclick: () => { setFriendsAuto(true); loadFriends(FRIENDS.on ? waiting : list); } }, `load the ${plural(FRIENDS.on ? waiting.length : list.length, "friend")}`)));
  const ours = g.nodes.filter((n) => n.kind === "entry" && !n.ext);
  const ourByUuid = Object.fromEntries(ours.filter((n) => n.entry.uuid).map((n) => [n.entry.uuid, n]));
  const card = (u, i) => {
    const canons = new Set(u.members.map((m) => fkey(m.canonical)));
    const theirs = new Map(); for (const m of u.members) for (const e of m.state.entries || []) if (e.uuid) theirs.set(e.uuid, { e, m });
    const out = []; // our entries citing into the unit
    for (const n of ours) for (const x of entryRefs(n.entry)) if (x.remote && canons.has(fkey(x.remote)) && theirs.has(x.uuid)) out.push({ from: n, to: theirs.get(x.uuid), kind: x.kind });
    const back = []; // the unit's entries citing ours
    for (const [, t] of theirs) for (const x of entryRefs(t.e)) if (x.remote && ourByUuid[x.uuid]) back.push({ from: t, to: ourByUuid[x.uuid], kind: x.kind });
    const src = u.r.centre?.mode === "live" ? "a checkout on this machine" : `the published export${u.r.state.generated ? `, generated ${u.r.state.generated}` : ""}`;
    const rel = (a, b, kind) => el("div", { class: "ref" }, a, el("span", { class: "note" }, kind === "superseded" ? " — superseded by — " : " — cites — "), b);
    return el("section", { class: "friend-card" },
      el("h2", {}, el("i", { class: "dot", style: `background:transparent;border:2px dashed ${friendColor(i)};width:11px;height:11px;margin-right:8px` }), el("a", { href: u.r.open || "#graph" }, hostMark(u.r.canonical), u.r.name),
        u.via === "chain" ? el("span", { class: "pill" }, "via a thought") : null),
      el("p", { class: "note" }, `${u.members.length > 1 ? `A family of ${u.members.length}: ${u.members.map((m) => m.name).join(", ")}. ` : ""}Read from ${src}. ${u.r.canonical}${u.r.forkOf ? ` — a fork of ${u.r.forkOf}, by its own export` : ""}`),
      el("h3", {}, `Cited from here (${out.length})`),
      ...(out.length ? out.map((x) => rel(el("a", { href: x.from.href }, x.from.label), el("a", { href: x.to.m.href ? x.to.m.href(x.to.e) : "#graph" }, x.to.e.title, u.members.length > 1 ? el("span", { class: "note" }, ` · ${x.to.m.name}`) : null), x.kind)) : [el("p", { class: "empty" }, u.via === "chain" ? "Nothing here cites it directly — it was reached by following a thought." : "—")]),
      el("h3", {}, `Citing this project (${back.length})`),
      ...(back.length ? back.map((x) => rel(el("a", { href: x.from.m.href ? x.from.m.href(x.from.e) : "#graph" }, x.from.e.title), el("a", { href: x.to.href }, x.to.label), x.kind)) : [el("p", { class: "empty" }, "None of its entries cites an entry here.")]));
  };
  const friends = units.filter((u) => u.via !== "chain" && u.via !== "cited"), chained = units.filter((u) => u.via === "chain"), citing = units.filter((u) => u.via === "cited");
  kids.push(...friends.map((u) => card(u, units.indexOf(u))));
  if (citing.length) kids.push(el("h2", { class: "section" }, "Citing this project — from the registry"), el("p", { class: "note" }, `Repositories in the Keep the Why registry whose entries cite this project, from its backlink file${CITED.checked ? `, built ${CITED.checked}` : ""}. Citations from outside the registry are not in it.`), ...citing.map((u) => card(u, units.indexOf(u))));
  if (chained.length) kids.push(el("h2", { class: "section" }, "Reached by following a thought"), ...chained.map((u) => card(u, units.indexOf(u))));
  if (failed.length) kids.push(el("h2", { class: "section" }, "Not loaded"), ...failed.map((r) => el("div", { class: "ref" }, el("a", { href: r.canonical, target: "_blank", rel: "noopener" }, hostMark(r.canonical), repoLabel(r.canonical)), el("span", { class: "note warn" }, ` · ${r.error}`))));
  setKids(box, ...kids);
}
async function viewThoughtsPage(main) {
  const minSeg = el("span", { class: "thought-min" });
  main.append(el("h1", {}, "Thoughts ", minSeg), el("p", { class: "sub" }, "Chains of linked entries: each cites the one before (See) or replaced it (Superseded by) — in this graph, with its family, friends and path. A link says two entries are related; often one follows from the other, not always. Point at a chain to light it in the graph beside."));
  const box = el("div", { class: "thoughts-page" }, el("p", { class: "center" }, "Loading…")); main.append(box);
  const g = await graphForScope();
  if (!box.isConnected) return;
  const all = graphChains(g);
  minSeg.replaceWith(thoughtMinSeg(all));
  const min = thoughtMin(all);
  const thoughts = all.filter((t) => t.steps.length >= min);
  const open = all.filter((t) => t.ends.length);
  if (!thoughts.length && !open.length) return setKids(box, el("p", { class: "empty" }, "No chain of linked entries here yet — a thought is a chain of See or Superseded by, each entry citing the one before."));
  const across = (t) => new Set(t.steps.map(projOf)).size > 1;
  const tags = (t) => [t.evolution ? el("span", { class: "pill" }, "evolution") : null, across(t) ? el("span", { class: "pill" }, "across projects") : null, t.ends.length ? el("span", { class: "pill" }, "continues ↗") : null, ...insightPills(t), span(t) ? el("span", { class: "note" }, span(t)) : null];
  const row = (t) => el("div", { class: "thought-row", onmouseenter: () => lightAll(t), onmouseleave: () => lightAll(null) },
    el("span", { class: "count" }, String(t.steps.length)),
    el("a", { href: thoughtHref(t), title: t.steps.map((n) => n.label).join("\n→ ") }, `${shortLabel(t.steps[0])} → ${shortLabel(t.steps[t.steps.length - 1])}`), ...tags(t));
  const entryLink = (n, extra) => el("a", { class: "backlink", href: n.href, ...stepHover(n.entry?.uuid || n.id) }, n.label.replace(/`/g, ""), el("div", { class: "note" }, [projOf(n), extra].filter(Boolean).join(" · ")));
  // counts
  const count = (pick) => { const m = new Map(); for (const t of thoughts) for (const n of pick(t)) m.set(n, (m.get(n) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const starts = count((t) => [t.steps[0]]), ends = count((t) => [t.steps[t.steps.length - 1]]);
  const bridges = count((t) => t.steps.slice(1, -1)).filter(([, c]) => c > 1);
  const fansTo = ends.filter(([, c]) => c > 1), fansFrom = starts.filter(([, c]) => c > 1);
  const projects = new Map(); const bump = (p, k) => { if (!projects.has(p)) projects.set(p, { starts: 0, ends: 0, through: 0 }); projects.get(p)[k]++; };
  for (const t of thoughts) { bump(projOf(t.steps[0]), "starts"); bump(projOf(t.steps[t.steps.length - 1]), "ends"); for (const p of new Set(t.steps.slice(1, -1).map(projOf))) bump(p, "through"); }
  const stat = (n, label) => el("div", { class: "stat" }, el("b", {}, String(n)), el("span", {}, label));
  const kids = [
    el("div", { class: "stats" }, stat(thoughts.length, "thoughts"), stat(thoughts.filter((t) => t.evolution).length, "evolutions"), stat(thoughts.filter(across).length, "across projects"), stat(open.length, "going on beyond"), stat(thoughts[0]?.steps.length || 0, "longest"),
      stat(thoughts.filter((t) => t.ins.weakOrigin).length, "start unconfirmed"), stat(thoughts.filter((t) => t.ins.shaky.length).length, "pass a step in question")),
  ];
  // chains whose first entry nobody confirmed, grouped by that entry
  const weak = thoughts.filter((t) => t.ins.weakOrigin);
  if (weak.length) {
    const byOrigin = new Map(); for (const t of weak) { if (!byOrigin.has(t.steps[0])) byOrigin.set(t.steps[0], []); byOrigin.get(t.steps[0]).push(t); }
    kids.push(el("h2", {}, "Starting from an unconfirmed entry"), el("p", { class: "note" }, "Chains whose first entry has Evidence inferred or unknown. Where later entries depend on it, they depend on a reason nobody confirmed — the first entry is the place to ask."),
      ...[...byOrigin.entries()].map(([n, ts]) => el("div", { class: "fan" }, entryLink(n, `Evidence ${n.entry.evidence} · ${plural(ts.length, "thought")} start here`), el("div", { class: "fan-rows" }, ...ts.map(row)))));
  }
  // entries in question and the later entries linked after them — what to check if they change
  const impact = new Map();
  for (const t of thoughts.concat(open.filter((t) => t.steps.length < min))) for (const x of t.ins.shaky) {
    const n = t.steps[x.i];
    if (!impact.has(n)) impact.set(n, { why: x.why, later: new Set(), thoughts: new Set(), projects: new Set() });
    const m = impact.get(n); m.thoughts.add(t);
    for (const j of t.steps.slice(x.i + 1)) { m.later.add(j); m.projects.add(projOf(j)); }
  }
  if (impact.size) kids.push(el("h2", {}, "Chains through a step in question"), el("p", { class: "note" }, "Entries in question — open, needing review, waiting for confirmation, or replaced yet still cited — and the later entries linked after them. If one of these changes, these are the entries to check: whether they depend on it is for a person to say."),
    ...[...impact.entries()].sort((a, b) => b[1].later.size - a[1].later.size).map(([n, m]) => el("div", { class: "fan" },
      entryLink(n, `${m.why} · ${m.later.size} later ${m.later.size === 1 ? "entry" : "entries"} linked after it${m.projects.size > 1 ? `, in ${m.projects.size} projects` : ""}`),
      el("div", { class: "fan-rows" }, ...[...m.later].map((j) => entryLink(j, j.entry.status))))));
  if (fansTo.length) kids.push(el("h2", {}, "Where many lines lead"), el("p", { class: "note" }, "Entries at the end of several chains — where chains from different starts arrive."),
    ...fansTo.map(([n, c]) => el("div", { class: "fan" }, entryLink(n, `${c} starts`), el("div", { class: "fan-rows" }, ...thoughts.filter((t) => t.steps[t.steps.length - 1] === n).map(row)))));
  if (fansFrom.length) kids.push(el("h2", {}, "Where many lines start"), el("p", { class: "note" }, "Entries several chains start from — often a decision much else refers to."),
    ...fansFrom.map(([n, c]) => el("div", { class: "fan" }, entryLink(n, `${c} thoughts`), el("div", { class: "fan-rows" }, ...thoughts.filter((t) => t.steps[0] === n).map(row)))));
  if (bridges.length) kids.push(el("h2", {}, "Bridges"), el("p", { class: "note" }, "Entries in the middle of several chains — where many links pass through."), ...bridges.slice(0, 12).map(([n, c]) => entryLink(n, `in ${c} thoughts`)));
  if (projects.size > 1) kids.push(el("h2", {}, "By project"), el("div", { class: "table-wrap" }, el("table", { class: "t" }, el("thead", {}, el("tr", {}, ["Project", "Starts", "Passes through", "Ends"].map((h) => el("th", {}, h)))),
    el("tbody", {}, [...projects.entries()].sort((a, b) => (b[1].starts + b[1].ends + b[1].through) - (a[1].starts + a[1].ends + a[1].through)).map(([p, c]) => el("tr", {}, el("td", {}, p), el("td", {}, String(c.starts)), el("td", {}, String(c.through)), el("td", {}, String(c.ends))))))));
  // time: when lines grew last, from the day each step was created
  const dated = thoughts.filter((t) => t.ins.to);
  if (dated.length > 1) {
    const recent = [...dated].sort((a, b) => b.ins.to.localeCompare(a.ins.to)).slice(0, 5);
    const resting = [...dated].sort((a, b) => a.ins.to.localeCompare(b.ins.to)).slice(0, 5);
    kids.push(el("h2", {}, "Recently grown"), el("p", { class: "note" }, "Lines whose newest step is the newest — where reasoning is moving now."), ...recent.map(row),
      el("h2", {}, "Resting longest"), el("p", { class: "note" }, "Lines that have not grown for the longest time — settled, or forgotten."), ...resting.map(row));
  }
  kids.push(el("h2", {}, `All thoughts (${thoughts.length})`), ...thoughts.map(row));
  const evo = thoughts.filter((t) => t.evolution);
  if (evo.length) kids.push(el("h2", {}, `Evolutions (${evo.length})`), el("p", { class: "note" }, "One decision, replaced step by step."), ...evo.map(row));
  if (open.length) kids.push(el("h2", {}, `Going on beyond this page (${open.length})`), el("p", { class: "note" }, "Chains that continue in a repository this page has not loaded."),
    el("button", { type: "button", class: "link-btn", disabled: CHAIN.busy, onclick: followAll }, CHAIN.busy ? "loading the chains…" : "load the whole chains"), ...open.map(row));
  setKids(box, ...kids);
}
function viewQueues(main) {
  const q = queues();
  const section = (title, why, list) => el("section", { class: "queue" },
    el("h2", {}, title, el("span", { class: "count" }, list.length)), el("p", { class: "why" }, why),
    list.length ? el("div", { class: "entry-list" }, list.map(entryRow)) : el("p", { class: "note" }, "nothing here"));
  main.append(
    el("h1", {}, "Queues"), el("p", { class: "sub" }, "What needs a person. The dashboard lists; it does not decide."),
    section("Open questions", "Status: open — the entry's central question has no answer yet.", q.open),
    section("Needs review", "Status: needs-review — a Revisit-when trigger fired and nobody re-checked yet.", q["needs-review"]),
    section("Pending confirmation", "Written in an unattended session where a question would have been asked; never confirmed by anyone.", q["pending-confirmation"]),
    section("Unknown evidence", "Where the claim came from could not be traced — on any entry still in force, an open question included: Evidence and Status are separate axes. A maintainer can often settle these in a minute.", q.unknown),
    section("Revisit-when triggers", "The conditions on record. Whether one has fired is a human judgement; the dashboard cannot tell.", q.revisit),
  );
}
function viewAuthors(main) {
  const rows = S.authors;
  main.append(el("h1", {}, "Authors"), el("p", { class: "sub" }, "Git authors of the entries — who created, touched, or superseded what. Git knows names, not who was driving."));
  if (!S.project.git?.available) return main.append(el("p", { class: "center" }, "No Git repository — nothing to attribute."));
  const tbl = el("table", { class: "t" }, el("thead", {}, el("tr", {}, ["Author", "Created", "Touched", "Superseded", "Evidence of created entries", "First", "Last"].map((h) => el("th", {}, h)))),
    el("tbody", {}, rows.map((a) => el("tr", { class: `clickable ${filter.author === a.name ? "sel" : ""}`, onclick: () => { filter.author = filter.author === a.name ? "" : a.name; rerender(); } },
      el("td", {}, authorLink(a.name, ...authorCommit(a.name))), el("td", {}, a.created), el("td", {}, a.touched), el("td", {}, a.superseded),
      el("td", {}, el("div", { style: "min-width:160px" }, stack(a.evidence, EV_ORDER))), el("td", { class: "mono" }, fmtDate(a.first)), el("td", { class: "mono" }, fmtDate(a.last))))));
  main.append(el("div", { class: "table-wrap" }, tbl), el("p", { class: "note", style: "margin-top:10px" }, "Click a name to open the author's profile on the host; click elsewhere in the row to filter every view to that author, again to clear."));
  if (filter.author) main.append(el("h2", {}, `Entries created by ${filter.author}`), el("div", { class: "entry-list" }, S.entries.filter((e) => authorOf(e) === filter.author).map(entryRow)));
}

const supersedersOf = (e) => e.uuid ? S.entries.filter((x) => x.superseded_by && parseSupersededBy(x.superseded_by)?.uuid === e.uuid) : [];
const seenFrom = (e, list) => e.uuid ? list.filter((x) => (x.see || []).some((r) => r?.uuid === e.uuid)) : [];
// See and Superseded by of an entry, and the other way round: what supersedes
// or points at it — here, and with the family scope anywhere in the tree
function refsBox(e) {
  const back = (label, rows) => rows.length ? [el("h3", {}, label), ...rows] : null;
  const localRow = (x) => el("div", { class: "ref" }, el("a", { href: entryHref(x) }, x.title), el("span", { class: "note" }, ` · ${x.project ? x.project + " · " : ""}${topicOf(x.file)?.title || x.file}`));
  const sup = supersedersOf(e), seen = seenFrom(e, S.entries);
  const box = el("div", { class: "body refs-box" },
    e.see?.length ? [el("h3", {}, "See"), ...e.see.map((r) => refLine(r))] : null,
    e.superseded_by ? [el("h3", {}, "Superseded by"), (() => { const sb = parseSupersededBy(e.superseded_by); return sb.none != null ? el("div", { class: "ref" }, el("i", {}, "none"), el("span", { class: "note" }, ` — ${sb.none}`)) : refLine(sb); })()] : null,
    back("Supersedes", sup.map(localRow)), back("Referenced by (See)", seen.map(localRow)));
  if (S.merged) return box.childNodes.length ? box : null; // the merged family holds every reference
  const family = e.uuid && canFamily();
  if (family && scope() === "family" && !S.merged) {
    const more = el("div", {}, el("p", { class: "note" }, "Looking for references from the rest of the family…")); box.append(more);
    searchPool("family").then((pool) => {
      const sups = [], sees = [];
      for (const g of pool.groups) {
        if (g.member.role === "self") continue;
        const row = (x) => el("div", { class: "ref" }, el("a", { href: g.href(x) }, x.title), el("span", { class: "note" }, ` · ${g.member.name} · ${topicTitle(g.state, x.file)}`));
        for (const x of g.state.entries || []) { if (x.superseded_by && parseSupersededBy(x.superseded_by)?.uuid === e.uuid) sups.push(row(x)); if ((x.see || []).some((r) => r?.uuid === e.uuid)) sees.push(row(x)); }
      }
      setKids(more, back("Supersedes, elsewhere in the family", sups), back("Referenced by (See), elsewhere in the family", sees),
        pool.missing.length ? el("p", { class: "note" }, `${plural(pool.missing.length, "family member")} not available here — not looked through.`) : null);
      if (!sups.length && !sees.length && !pool.missing.length) more.replaceChildren(el("p", { class: "note" }, "No references to this entry from the rest of the family."));
    });
  } else if (family) box.append(el("p", { class: "note" }, "References from the rest of the family show with the family scope — the switch next to the project menu."));
  return box.childNodes.length ? box : null;
}

// ---------------------------------------------------------------- family and projects
let FAMILY = null; // /api/family result for the current project (live mode only)
async function fetchFamily() {
  if (!LIVE()) return null;
  try { FAMILY = (await (await fetch(api("/api/family"), { cache: "no-store" })).json()).members || []; } catch { FAMILY = null; }
  return FAMILY;
}
// the family as .keep-the-why declares it — what an export or a public dump knows
function familyDeclared() {
  const p = S.project; const out = [];
  if (p.parent) out.push({ role: "parent", name: p.parent.replace(/^https:\/\//, ""), location: p.parent, scope: "", canonical: p.parent.startsWith("https://") ? p.parent : "", root: "" });
  for (const c of p.children || []) out.push({ role: "child", name: c.name, location: c.location, scope: c.scope, canonical: c.location.startsWith("https://") ? c.location : "", root: "" });
  return out;
}
function publicMemberRow(m, r) {
  const st = r?.state;
  const title = st ? el("a", { href: publicHref(m.canonical, m.root || "") }, m.name) : el("b", {}, m.name);
  return el("div", { class: `member ${m.role} ${st ? "public" : "none"}`, onmouseenter: () => spotProject(m.canonical), onmouseleave: () => spotProject(null) },
    el("div", { class: "mr" }, el("span", { class: "role" }, m.role), title, el("span", { class: `pill kind-${st ? "public" : "none"}` }, st ? "published export" : "no public export"),
      st ? el("span", { class: "pill" }, `generated ${st.generated || "?"}`) : null),
    m.scope ? el("div", { class: "ms" }, m.scope) : (m.role === "parent" ? el("div", { class: "ms note" }, "holds what is family-wide") : null),
    el("div", { class: "mm mono" }, m.canonical || m.location, st ? ` · ${st.entries.length} entries · ${st.topics.length} topics · ${r.url}` : r?.error ? ` · ${r.error}` : ""));
}
function memberRow(m) {
  const here = m.role === "self";
  const title = m.key && !here ? el("a", { href: `${location.pathname}?project=${encodeURIComponent(m.key)}#overview` }, m.name) : el("b", {}, m.name);
  return el("div", { class: `member ${m.role} ${m.available}`, onmouseenter: () => spotProject(m.canonical), onmouseleave: () => spotProject(null) },
    el("div", { class: "mr" }, el("span", { class: "role" }, m.role), title, el("span", { class: `pill kind-${m.available}` }, here ? "this project" : kindLabel(m.available))),
    m.scope ? el("div", { class: "ms" }, m.scope) : (m.role === "parent" ? el("div", { class: "ms note" }, "holds what is family-wide") : null),
    el("div", { class: "mm mono" }, hostMark(m.canonical), m.canonical || m.location || "", m.path && !here ? ` · ${m.path}` : ""),
    m.fetch ? el("details", { class: "fetch" }, el("summary", {}, "not checked out here — how to get it"),
      el("p", { class: "note" }, "A working tree, writable (the mapping learns it on next start):"), el("pre", {}, el("code", {}, m.fetch.clone)),
      el("p", { class: "note" }, "Or the read-only context cache, shared by every project on this machine:"), el("pre", {}, el("code", {}, m.fetch.cache))) : null);
}
// the tree as nested rows: every member under the one whose children block lists it
function treeRows(members, rowOf) {
  const ids = new Set(members.map((m) => m.node));
  const kids = new Map(); const roots = [];
  for (const m of members) {
    if (m.up && ids.has(m.up) && m.up !== m.node) { if (!kids.has(m.up)) kids.set(m.up, []); kids.get(m.up).push(m); }
    else roots.push(m);
  }
  const out = []; const seen = new Set();
  const walk = (m, d) => {
    if (seen.has(m.node)) return; seen.add(m.node);
    out.push(el("div", { class: "tree-row", style: `padding-left:${Math.min(d, 6) * 26}px` }, d ? el("span", { class: "tree-mark" }, "└") : null, rowOf(m)));
    for (const c of (kids.get(m.node) || []).sort((a, b) => familyRank(a) - familyRank(b) || String(a.name).localeCompare(String(b.name)))) walk(c, d + 1);
  };
  for (const r of roots) walk(r, 0);
  for (const m of members) walk(m, 0); // a cycle would otherwise drop rows
  return out;
}
async function viewFamily(main) {
  const p = S.project;
  main.append(el("h1", {}, "Family"), el("p", { class: "sub" }, "The whole tree this project belongs to, from the root down: each project under the one whose children block lists it. That block is the routing — where an entry about something belongs; what is wider than a level goes one level up, to the root at most. Every member can be read; a member checked out here can be written to. Not a dependency graph."));
  if (!p.parent && !(p.children || []).length) return main.append(el("p", { class: "center" }, "This project is not part of a family: no parent line, no children block in .keep-the-why."));
  const box = el("div", { class: "family" }); main.append(box);
  if (PUBLISHED() && canonicalOf(p)) {
    box.append(el("p", { class: "center" }, "Reading the family's published exports…"));
    const t = await publicTree();
    const members = [...t.groups.map((g) => g.member), ...t.missing.map((x) => x.member)];
    const results = await Promise.all(members.map((m) => (m.role === "self" || !m.canonical ? null : fetchPublicState(m.canonical, m.root || ""))));
    const byNode = new Map(members.map((m, i) => [m.node, results[i]]));
    if (!box.isConnected) return;
    box.replaceChildren(...treeRows(members, (m) => m.role === "self"
      ? memberRow({ role: "self", name: p.id || p.name, location: "", scope: m.scope || "", canonical: canonicalOf(p), available: "public" })
      : publicMemberRow(m, byNode.get(m.node))));
    return;
  }
  if (!LIVE()) {
    // an export knows only its own config: parent and children as declared
    if (p.parent) box.append(memberRow({ role: "parent", name: p.parent.replace(/^https:\/\//, ""), location: p.parent, scope: "", canonical: p.parent.startsWith("https://") ? p.parent : "", available: "none", fetch: null }));
    box.append(memberRow({ role: "self", name: p.id || p.name, location: "", scope: "", canonical: canonicalOf(p), available: "repository" }));
    for (const c of p.children || []) box.append(memberRow({ role: "child", name: c.name, location: c.location, scope: c.scope, canonical: c.location.startsWith("https://") ? c.location : "", available: "none", fetch: null }));
    return;
  }
  const members = await fetchTree() || [];
  if (!box.isConnected) return;
  box.replaceChildren(...treeRows(members, memberRow));
}
let PROJECTS = null; // /api/projects result
let SELECTED_DEFAULT = null; // the server's own project, for the menu when the URL names none
async function viewProjects(main) {
  main.append(el("h1", {}, "Projects"), el("p", { class: "sub" }, "Every project this machine knows — from ~/.keep-the-why/projects.json, the folder next to this one, and the personal files. Families grouped, parent first. Forgetting a row removes it from the mapping; a cache directory goes with it, a working tree is never touched."));
  if (!LIVE()) return main.append(el("p", { class: "center" }, "Static export — the project list is a live-server view."));
  let data; try { data = await (await fetch("/api/projects", { cache: "no-store" })).json(); } catch { return main.append(el("p", { class: "center" }, "Could not load the project list.")); }
  PROJECTS = data.projects || [];
  const current = PROJECT || data.selected;
  const list = PROJECTS;
  const row = (p, depth) => {
    const here = p.key === current;
    const label = p.path ? el("a", { href: `${location.pathname}?project=${encodeURIComponent(p.key)}#overview` }, p.name) : el("span", {}, p.id);
    const forget = p.source === "unresolved" ? null : el("button", { class: "link-btn danger", title: p.kind === "cache" ? "forget this cache and delete its directory (a cache is never the only copy of anything)" : "forget this path — the working tree itself is not touched", onclick: async () => {
      if (!confirm(p.kind === "cache" ? `Forget the cache of ${p.id} and delete ${p.path}?` : `Forget ${p.path}? The directory stays; only the mapping row goes.`)) return;
      try { await fetch("/api/projects/forget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: p.key }) }); } catch {}
      if (here) location.href = location.pathname; else render();
    } }, "forget");
    return el("div", { class: `prow depth-${Math.min(depth, 3)} ${here ? "here" : ""}` },
      el("div", { class: "pr" }, depth ? el("span", { class: "tree-mark" }, "└") : null, label, el("span", { class: `pill kind-${p.path ? p.kind : "none"}` }, p.path ? kindLabel(p.kind) : "location unknown"), here ? el("span", { class: "pill" }, "here") : null, p.root ? el("span", { class: "pill mono", title: "root: below the git toplevel" }, p.root) : null),
      el("div", { class: "pm mono" }, p.id, p.canonical ? ` · ${p.canonical}` : "", p.path ? ` · ${p.path}` : "", p.last_opened ? ` · seen ${p.last_opened}` : ""),
      forget);
  };
  main.append(el("div", { class: "projects" }, groupByFamily(list).map(([p, depth]) => row(p, depth))));
}

// ---------------------------------------------------------------- details pane
function renderDetailsTopic(t) {
  const d = $("#details"); d.replaceChildren();
  d.append(el("h3", {}, "Topic"), el("div", { class: "kv" }, el("span", { class: "k" }, "file"), el("span", { class: "v mono" }, t.file), el("span", { class: "k" }, "entries"), el("span", { class: "v" }, t.entries)));
  d.append(el("h3", {}, `References out (${t.refs_out.length})`), ...(t.refs_out.length ? t.refs_out.map((f) => el("a", { class: "backlink", href: `#topic/${f}` }, topicOf(f)?.title || f)) : [el("p", { class: "empty" }, "none")]));
  d.append(el("h3", {}, `Referenced by (${t.refs_in.length})`), ...(t.refs_in.length ? t.refs_in.map((f) => el("a", { class: "backlink", href: `#topic/${f}` }, topicOf(f)?.title || f)) : [el("p", { class: "empty" }, "none")]));
  miniGraph(d, { topic: t });
}
function renderDetailsEntry(e) {
  const d = $("#details"); d.replaceChildren();
  const g = e.git;
  const P = e.origin?.state?.project || S.project; // a merged member's entry lives in its own repository
  const hostHref = hostFileLink(canonicalOf(P), P.git?.branch, P.context, e.localFile || e.file, hostAnchor(e.title)); // GitHub's anchor, not the entry id
  d.append(el("h3", {}, "Entry"), el("div", { class: "kv" },
    e.uuid ? [el("span", { class: "k" }, "Id"), el("span", { class: "v mono", title: "the entry's address — what See and Superseded by lines resolve to" }, e.uuid)] : null,
    e.project ? [el("span", { class: "k" }, "project"), el("span", { class: "v" }, e.origin?.href ? el("a", { href: memberLink(e.origin.member, "#overview") }, e.project) : e.project)] : null,
    el("span", { class: "k" }, "at"), el("span", { class: "v mono" }, hostHref ? el("a", { class: "gh", href: hostHref, target: "_blank", rel: "noopener", title: "open on the host" }, e.id) : e.id),
    el("span", { class: "k" }, "type"), el("span", { class: "v" }, (e.type || []).join(", ") || "—"),
    el("span", { class: "k" }, "status"), el("span", { class: "v" }, statusPill(e.status)),
    el("span", { class: "k" }, "evidence"), el("span", { class: "v" }, evPill(e.evidence)),
    e.source ? [el("span", { class: "k" }, "source"), el("span", { class: "v" }, e.source)] : null,
    e.verification ? [el("span", { class: "k" }, "verification"), el("span", { class: "v" }, e.verification)] : null,
    e.revisit_when ? [el("span", { class: "k" }, "revisit when"), el("span", { class: "v" }, e.revisit_when)] : null,
  ));
  d.append(el("h3", {}, "Git"));
  if (!g) d.append(el("p", { class: "empty" }, S.project.git?.available ? "not in Git yet" : "no repository"));
  else {
    const who = (c) => c ? [authorLink(c.author, c.commit, P), `${c.date ? " · " + c.date : ""}${c.commit ? " · " : ""}`, c.commit ? el("code", {}, c.commit) : null] : ["—"];
    d.append(el("div", { class: "kv" },
      el("span", { class: "k" }, "created"), el("span", { class: "v" }, ...who(g.created)),
      el("span", { class: "k" }, "last touched"), el("span", { class: "v" }, ...who(g.last_touched))));
    if (g.status_history?.length) d.append(el("h3", {}, "Status history"), el("ul", { class: "hist" }, g.status_history.map((h) => el("li", { class: h.status }, `${h.status}`, el("div", { class: "d" }, authorLink(h.author, h.commit, P), ` · ${h.date} · ${h.commit}`)))));
  }
  const back = S.entries.filter((x) => x.id !== e.id && x.refs.includes(e.file));
  d.append(el("h3", {}, `Backlinks (${back.length})`), ...(back.length ? back.map((x) => el("a", { class: "backlink", href: entryHref(x) }, x.title, el("div", { class: "note" }, topicOf(x.file)?.title || x.file))) : [el("p", { class: "empty" }, `nothing references ${e.file}`)]));
  // the thoughts this entry is a step of — in the graph of the scope, friends and path included
  const mine = entryThoughts(e);
  const resting = new Set(); for (const { t, i } of mine) if (t.ins.shaky.some((x) => x.i === i)) for (const j of t.steps.slice(i + 1)) resting.add(j);
  if (resting.size) d.append(el("h3", {}, `Linked after this (${resting.size})`), el("p", { class: "note" }, `This entry is in question (${e.status}); these later entries are linked after it — check whether they depend on it.`), ...[...resting].map((n) => el("a", { class: "backlink", href: n.href }, n.label, el("div", { class: "note" }, projOf(n)))));
  if (mine.length) d.append(el("h3", {}, `In thoughts (${mine.length})`), ...mine.map(({ t, i }) => el("a", { class: "backlink", href: thoughtHref(t), title: t.steps.map((n) => n.label).join("\n→ ") },
    `${shortLabel(t.steps[0])} → ${shortLabel(t.steps[t.steps.length - 1])}`,
    el("div", { class: "note" }, `step ${i + 1} of ${t.steps.length}${t.evolution ? " · evolution" : ""}${t.ends.length ? " · continues ↗" : ""}${t.ins.weakOrigin ? ` · starts ${t.ins.weakOrigin}` : ""}${t.ins.affected.includes(i) ? " · after a step in question" : ""}`))));
  if (e.refs.length) d.append(el("h3", {}, "References"), ...e.refs.map((f) => el("a", { class: "backlink", href: `#topic/${f}` }, topicOf(f)?.title || f)));
  if (e.findings.length) d.append(el("h3", {}, "Linter"), ...e.findings.map((f) => el("div", { class: "finding" }, pill(f.code, `sev-${f.severity}`), ` line ${f.line}: ${f.message}`)));
  renderDetailsNeighbourhood(e);
}
function renderDetailsDefault() {
  const d = $("#details"); d.replaceChildren();
  const route = location.hash.slice(1) || "overview";
  if (route === "graph" || route === "graph/family" || route === "globe") {
    d.append(el("div", { id: "thoughts" }));
    renderThoughts(familyGraphShown() ? (fgraph && Date.now() - fgraph.at < 30000 ? fgraph : null) : graph);
    d.append(el("h3", {}, "Legend"), el("div", { class: "legend-list" },
      familyGraphShown() ? [
        el("span", {}, el("i", { class: "dot", style: "background:var(--bg);border:3px solid var(--accent);width:12px;height:12px" }), "project — a ring in its colour; its topics take the same colour"),
        el("span", {}, "thick dashed line — parent and child project"),
        el("span", {}, "coloured line — a See between two entries, within a project or across"),
        el("span", {}, "grey dashed line — Superseded by"),
        el("span", {}, "with entries hidden, references between projects are drawn between their topics")] : null,
      el("span", {}, el("i", { class: "dot", style: "background:var(--accent);width:12px;height:12px" }), "topic — size follows its entry count"),
      el("span", {}, el("i", { class: "dot confirmed" }), "entry, Evidence confirmed"), el("span", {}, el("i", { class: "dot inferred" }), "entry, Evidence inferred"), el("span", {}, el("i", { class: "dot unknown" }), "entry, Evidence unknown"),
      el("span", {}, el("i", { class: "dot", style: "background:transparent;border:1.5px solid var(--fg3)" }), "superseded — hollow"),
      el("span", {}, el("i", { class: "dot", style: "background:var(--bg);border:1.5px solid var(--open)" }), "ring — open, needs review, pending"),
      el("span", {}, "solid line — a reference between topics; dotted — membership"),
      el("span", {}, el("i", { class: "dot", style: "background:transparent;border:2px dashed var(--fg3);width:10px;height:10px" }), "friend — a repository cited outside the family, loaded with the graph; a click on its hub or name goes there"),
      el("span", {}, el("i", { class: "dot", style: "background:transparent;border:2px dotted var(--fg3);width:10px;height:10px" }), "path — a project you walked through to get here, numbered in order; a click goes back there")),
      el("h3", {}, "Keys"), el("p", { class: "note" }, el("kbd", {}, "/"), " search · ", el("kbd", {}, "g"), " graph · ", el("kbd", {}, "o"), " overview · ", el("kbd", {}, "q"), " queues · ", el("kbd", {}, "t"), " timeline · ", el("kbd", {}, "a"), " authors · ", el("kbd", {}, "l"), " findings"));
    return;
  }
  if (route.startsWith("timeline")) {
    // the timeline: the thoughts list first, as beside the graph, and a small project graph under it that follows the clock
    d.dataset.pane = "graph";
    d.append(el("div", { id: "thoughts" }));
    renderThoughts(graph);
    d.append(el("h3", {}, "Graph"), el("p", { class: "note" }, "What existed on the day shown, with the status it had then."));
    miniGraph(d, { tall: true });
    return;
  }
  d.dataset.pane = "graph";
  miniGraph(d, {});
}
function renderDetailsNeighbourhood(e) { miniGraph($("#details"), { entry: e }); }
// The side-pane graph: the neighbourhood of an entry or topic, the whole
// project, or the whole family — a switch in its corner, remembered per
// browser. Family is offered where the family scope is (live, public).
// An explicit choice in the corner of the side pane's graph; until then — and
// again after every scope change — it follows the page: the neighbourhood of
// the entry or topic shown, else the scope (the project, or the whole family).
let MINI = null;
function miniGraph(d, ctx) {
  const focusId = ctx.entry ? `e:${ctx.entry.id}` : ctx.topic ? `t:${ctx.topic.file}` : null;
  if (narrow()) { d.append(el("h3", {}, "Graph"), el("a", { class: "backlink", href: "#graph" }, "Open the project graph →")); return; }
  const modes = [...(focusId ? ["near"] : []), "project", ...(canFamily() ? ["family"] : [])];
  const mode = MINI && modes.includes(MINI) ? MINI : focusId ? "near" : familyGraphShown() && modes.includes("family") ? "family" : "project";
  const box = el("div", { class: `mini ${focusId || ctx.tall ? "tall" : "fill"}` });
  const seg = el("span", { class: "mini-seg" }, modes.length > 1 ? modes.map((m) => el("button", { type: "button", class: m === mode ? "on" : "", title: { near: "this entry's or topic's neighbourhood", project: "the whole project", family: "the whole family tree" }[m], onclick: () => { MINI = m; const keep = d.querySelector(".mini"); const h = keep?.previousElementSibling?.tagName === "H3" ? keep.previousElementSibling : null; h?.remove(); keep?.remove(); miniGraph(d, ctx); } }, m)) : el("span", { class: "mini-title" }, "graph"));
  const canvas = el("canvas");
  // one click to the full graph: the same level, centred on the entry or topic shown
  const full = el("button", { type: "button", class: "mini-open", title: "open the full graph — the same level, centred on what is shown here",
    onclick: () => {
      if (mode === "family") setScope("family", { rerender: false });
      GRAPH_CENTER = ctx.entry ? { entry: ctx.entry } : ctx.topic ? { topic: ctx.topic } : null;
      if (ctx.entry?.uuid) { focusStep(ctx.entry.uuid); setTimeout(() => { if (STEP_FOCUS === ctx.entry.uuid) focusStep(null); }, 4000); }
      location.hash = "#graph";
    } }, "⤢ full graph");
  // the full graph's switches, folded into the small one: a ⚙ opens the same groups
  const filters = el("div", { class: "mini-filters graph-ui", hidden: !MINI_FILTERS });
  const gear = el("button", { type: "button", class: "mini-gear", title: "the graph's switches — the same as in the full graph", onclick: () => { MINI_FILTERS = !MINI_FILTERS; filters.hidden = !MINI_FILTERS; } }, "⚙");
  const fillFilters = (g) => { if (mode !== "near") setKids(filters, ...graphControlGroups(g, mode === "family")); };
  box.append(canvas, seg, el("span", { class: "mini-hint" }, mode === "near" ? "click to open" : "hover · click"), full, mode !== "near" ? gear : null, filters);
  if (focusId) d.append(el("h3", {}, "Graph"));
  d.append(box);
  const opts = { mini: true, focusId };
  if (mode === "near") {
    // friends live at the project level: the control switches there (the family level with the family scope) and loads them
    const n = friendCandidates(S.entries.filter((e) => (e.project || null) === (ctx.entry?.project || ctx.topic?.project || null))).length;
    const up = modes.includes("family") && familyGraphShown() ? "family" : "project";
    if (n || hasFamily()) box.append(el("span", { class: "mini-seg mini-friends" }, el("button", { type: "button", title: `show the friends — switches to the ${up} level`,
      onclick: () => { MINI = up; FRIENDS.load = true; setFriendsAuto(true); render(); } }, n ? `friends (${n})` : "friends")));
    return requestAnimationFrame(() => runGraph(canvas, ctx.entry ? buildSubgraph(ctx.entry) : buildTopicSubgraph(ctx.topic), opts));
  }
  if (mode === "project") { const g = buildGraph(ctx.entry?.project || ctx.topic?.project || null); holdReading(g); fillFilters(g); /* friends are in the gear's groups */ return requestAnimationFrame(() => runGraph(canvas, g, opts)); }
  // family: the family graph's nodes, in a view of its own (its own zoom, entries shown)
  const note = el("span", { class: "mini-hint", style: "top:28px;bottom:auto" }, "loading the family…"); box.append(note);
  const show = (fg) => { note.remove(); if (!canvas.isConnected) return; const mg = { ...fg, scale: 1, ox: 0, oy: 0, showEntries: SHOW_ENTRIES, showLabels: true, raf: null, wake: null, alpha: Math.max(fg.alpha, 0.3) }; holdReading(mg); fillFilters(mg); runGraph(canvas, mg, opts); };
  if (fgraph && Date.now() - fgraph.at < 30000) requestAnimationFrame(() => show(fgraph));
  else buildFamilyGraph().then(show);
}
// ---------------------------------------------------------------- graph (canvas force layout, no library)
let MINI_FILTERS = false; // the side pane graph's switches, folded unless opened
let graph = null; // the full graph persists across re-renders so positions survive live updates
let GRAPH_CENTER = null; // { entry } or { topic }: centre the full graph there once, coming from the side pane
function seedNode(n, prev) {
  const p = prev[n.id];
  if (p) Object.assign(n, { x: p.x, y: p.y, vx: 0, vy: 0, fixed: p.fixed });
  else { n.x = (Math.random() - 0.5) * 600; n.y = (Math.random() - 0.5) * 400; n.vx = n.vy = 0; }
  return n;
}
function assemble(topics, entries, prev = {}) {
  const nodes = []; const links = []; const index = {};
  const add = (n) => { index[n.id] = nodes.length; nodes.push(seedNode(n, prev)); };
  for (const t of topics) add({ id: `t:${t.file}`, kind: "topic", label: t.title, file: t.file, r: 10 + Math.sqrt(t.entries) * 3.2, href: `#topic/${t.file}` });
  for (const e of entries) add({ id: `e:${e.id}`, kind: "entry", label: e.title, file: e.file, entry: e, r: 4.2, href: entryHref(e) });
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
  return { nodes, links, index };
}
// the Ids an entry points at, and the entries of `list` that point at it
const pointsAt = (e) => [...(e.see || []).map((r) => r?.uuid), e.superseded_by ? parseSupersededBy(e.superseded_by)?.uuid : null].filter(Boolean);
const linkedTo = (e, list) => list.filter((x) => x !== e && ((e.uuid && pointsAt(x).includes(e.uuid)) || (x.uuid && pointsAt(e).includes(x.uuid))));
function buildGraph(project = null) {
  const prev = graph ? Object.fromEntries(graph.nodes.map((n) => [n.id, n])) : {};
  const entries = S.entries.filter((e) => (e.project || null) === project);
  graph = Object.assign(graph || { scale: 1, ox: 0, oy: 0, showEntries: SHOW_ENTRIES, showLabels: true, alpha: 1 }, assemble(S.topics.filter((t) => (t.project || null) === project), entries, prev));
  graph.friends = project ? [] : friendCandidates(entries);
  autoFriends(graph);
  if (!project) autoFamily();
  addFriendLayer(graph, prev);
  graph.alpha = Math.max(graph.alpha, 0.6);
  return graph;
}
function buildTopicSubgraph(t) {
  // the topic with its entries, plus the topics it references and the ones referencing it (with the entries that do)
  const files = new Set([t.file, ...t.refs_out, ...t.refs_in]);
  const topics = S.topics.filter((x) => files.has(x.file));
  const entries = S.entries.filter((x) => x.file === t.file || x.refs.includes(t.file));
  const prev = graph ? Object.fromEntries(graph.nodes.map((n) => [n.id, n])) : {};
  return Object.assign({ scale: 1, ox: 0, oy: 0, showEntries: true, showLabels: true, alpha: 1 }, assemble(topics, entries, prev));
}
function buildSubgraph(e) {
  // the entry, its topic and siblings, the topics it references, and the entries elsewhere that reference its topic
  const files = new Set([e.file, ...e.refs]);
  const back = S.entries.filter((x) => x.refs.includes(e.file));
  const linked = linkedTo(e, S.entries); // See / Superseded by, either direction
  for (const b of [...back, ...linked]) files.add(b.file);
  const topics = S.topics.filter((t) => files.has(t.file));
  const entries = S.entries.filter((x) => x.file === e.file || x.id === e.id || back.includes(x) || linked.includes(x));
  const prev = graph ? Object.fromEntries(graph.nodes.map((n) => [n.id, n])) : {};
  return Object.assign({ scale: 1, ox: 0, oy: 0, showEntries: true, showLabels: true, alpha: 1 }, assemble(topics, entries, prev));
}
// The family graph: every project of the tree as a hub in its own colour,
// its topics and entries around it, parent and child projects joined, and
// the See and Superseded by lines between entries drawn across projects.
let fgraph = null; // kept across re-renders so positions survive live updates
// where a family member is, for a move in place (the path grows, nothing reloads)
const memberCentre = (m) => (m.role === "self" ? currentCentre() : PUBLISHED() ? { mode: "public", canonical: m.canonical, root: m.root || "" } : { mode: "live", project: m.key });
const memberLink = (m, hash) => m.role === "self" ? hash : PUBLISHED() ? publicHref(m.canonical, m.root || "", hash) : `${location.pathname}?project=${encodeURIComponent(m.key)}${hash}`;
async function buildFamilyGraph() {
  const pool = await searchPool("family");
  const groups = pool.groups.map((g, i) => ({
    g, key: g.member.role === "self" ? "self" : g.member.key || `${g.member.canonical}|${g.member.root || ""}`,
    canonical: g.state.project?.canonical || g.member.canonical || (g.member.role === "self" ? canonicalOf(S.project) : ""),
    root: g.state.project?.root || g.member.root || (g.member.role === "self" ? MY_ROOT() : ""),
    role: g.member.role, state: g.state, color: i === 0 ? color0() : PALETTE[i % PALETTE.length],
  }));
  const { parentOf, xrefs } = linkFamily(groups);
  const prev = fgraph ? Object.fromEntries(fgraph.nodes.map((n) => [n.id, n])) : {};
  const nodes = []; const links = []; const index = {};
  const add = (n, near) => {
    const p = prev[n.id];
    if (p) Object.assign(n, { x: p.x, y: p.y, vx: 0, vy: 0, fixed: p.fixed });
    else { n.x = (near?.x || 0) + (Math.random() - 0.5) * 140; n.y = (near?.y || 0) + (Math.random() - 0.5) * 140; n.vx = n.vy = 0; }
    index[n.id] = nodes.length; nodes.push(n); return n;
  };
  // this project keeps the local graph's ids, so the selected entry and the positions carry over
  const tid = (G, file) => (G.key === "self" ? `t:${file}` : `t:${G.key}:${file}`);
  const eid = (G, id) => (G.key === "self" ? `e:${id}` : `e:${G.key}:${id}`);
  // this project in the middle, the rest of the family around it — after a move to a member, that one is the middle
  const R = groups.length > 1 ? 220 + 45 * groups.length : 0;
  groups.forEach((G, i) => {
    const ang = (2 * Math.PI * (i - 1)) / Math.max(1, groups.length - 1);
    const at = G.key === "self" ? { x: 0, y: 0 } : { x: R * Math.cos(ang), y: R * Math.sin(ang) };
    const hub = add({ id: `p:${G.key}`, kind: "project", self: G.key === "self", label: G.g.member.name, canonical: G.canonical, r: 15, color: G.color, href: memberLink(G.g.member, "#overview"),
      walk: () => (G.key === "self" ? go("#overview") : moveTo({ centre: memberCentre(G.g.member), state: G.state }, "#graph")) }, at);
    for (const t of G.state.topics || []) {
      const n = add({ id: tid(G, t.file), kind: "topic", fam: G.key !== "self", label: t.title, file: t.file, color: G.color, r: 8 + Math.sqrt(t.entries || 0) * 2.8, href: memberLink(G.g.member, `#topic/${t.file}`) }, hub);
      links.push({ s: index[hub.id], t: index[n.id], kind: "hub", len: 80 });
    }
    for (const e of G.state.entries || []) {
      const t = nodes[index[tid(G, e.file)]];
      add({ id: eid(G, e.id), kind: "entry", fam: G.key !== "self", proj: G.g.member.name, label: e.title, file: e.file, entry: e, r: 4.2, href: G.key === "self" ? entryHref(e) : G.g.href(e) }, t || hub);
    }
    for (const e of G.state.entries || []) {
      const me = index[eid(G, e.id)];
      if (index[tid(G, e.file)] != null) links.push({ s: me, t: index[tid(G, e.file)], kind: "member", len: 42 });
      for (const f of e.refs || []) if (index[tid(G, f)] != null) links.push({ s: me, t: index[tid(G, f)], kind: "ref", len: 110 });
    }
    const seen = new Set();
    for (const t of G.state.topics || []) for (const f of t.refs_out || []) { if (index[tid(G, f)] == null) continue; const k = [t.file, f].sort().join("|"); if (seen.has(k)) continue; seen.add(k); links.push({ s: index[tid(G, t.file)], t: index[tid(G, f)], kind: "topic", len: 150 }); }
  });
  for (const [child, parent] of Object.entries(parentOf)) if (index[`p:${child}`] != null && index[`p:${parent}`] != null) links.push({ s: index[`p:${child}`], t: index[`p:${parent}`], kind: "family", len: 260 });
  const byKey = Object.fromEntries(groups.map((G) => [G.key, G]));
  const entryOf = (G, id) => (G.state.entries || []).find((e) => e.id === id);
  const topicPairs = new Set(); let across = 0;
  for (const x of xrefs) {
    const A = byKey[x.from.key], B = byKey[x.to.key];
    const s = index[eid(A, x.from.id)], t = index[eid(B, x.to.id)];
    if (s == null || t == null) continue;
    links.push({ s, t, kind: x.kind, len: 170, color: A.color });
    if (x.from.key === x.to.key) continue;
    across++;
    // the same reference between the two topics, for the view with entries hidden
    const ts = index[tid(A, entryOf(A, x.from.id)?.file)], tt = index[tid(B, entryOf(B, x.to.id)?.file)];
    const k = `${ts}|${tt}`;
    if (ts != null && tt != null && !topicPairs.has(k)) { topicPairs.add(k); links.push({ s: ts, t: tt, kind: "xtopic", len: 220, color: A.color }); }
  }
  fgraph = Object.assign(fgraph || { scale: 0.7, ox: 0, oy: 0, showEntries: SHOW_ENTRIES, showLabels: true, alpha: 1 }, { nodes, links, index, groups, missing: pool.missing, across, at: Date.now() });
  fgraph.friends = friendCandidates(groups.flatMap((G) => G.state.entries || []), [...groups.map((G) => G.canonical), ...pool.missing.map(({ member: m }) => m.canonical)]);
  autoFriends(fgraph);
  addFriendLayer(fgraph, prev);
  fgraph.alpha = Math.max(fgraph.alpha, 0.6);
  return fgraph;
}
const color0 = () => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#835bec";
// ---------------------------------------------------------------- friends
// Friends: repositories outside the family that the entries in the graph
// cite by a cross-project See or Superseded by. Nothing is loaded until a
// person clicks *friends* in the graph, in every mode; then each is loaded
// the way a reference row resolves it (a project known to the live server,
// else the repository's published export), one level deep — a friend's own
// friends are not followed. A friend is linked into the graph, never merged:
// search, queues, counts and the other views stay with the project or family.
// Its hub shows the entries cited there; a click on the hub goes there, as its name does.
const FRIENDS = { on: false, loaded: {}, pending: {}, expanded: new Set(), load: false, loading: false };
// Who in the registry cites this project: its backlink file, fetched from the registry on the click and not
// remembered — a remembered switch would ask the registry on every reload without one. `list` is in the
// friends' shape ({ canonical, uuids: the citing entries }), loaded and drawn like friends.
const CITED = { on: false, loading: false, error: null, list: [], elsewhere: 0, checked: "", url: null };
// Loaded as soon as a graph shows them, by default (few projects have many
// friends yet); *friends* unchecked turns that off, kept per browser — then a
// click on *friends (N)* loads them.
let FRIENDS_AUTO = (() => { try { return localStorage.getItem("ktw-friends") !== "off"; } catch { return true; } })();
// every entry of every friend, not only what links to this graph — off by default, kept per browser
// "all their entries" per kind of neighbour — friends, the path's steps, the family — each kept per browser
const readEntriesSetting = (key, dflt = false) => { try { const v = localStorage.getItem(key); return v == null ? dflt : v === "all"; } catch { return dflt; } };
let FRIEND_ENTRIES = readEntriesSetting("ktw-friend-entries", true); // every "… entries" is on by default: neighbours come whole; each is kept per browser
// a friend that has a family comes with it — the members beside the cited repository — unless this is off; their entries and labels have switches of their own
let FRIEND_FAMILIES = (() => { try { return localStorage.getItem("ktw-friend-families") !== "off"; } catch { return true; } })();
function setFriendFamilies(on) { FRIEND_FAMILIES = on; try { localStorage.setItem("ktw-friend-families", on ? "on" : "off"); } catch {} }
let FRIEND_FAM_ENTRIES = readEntriesSetting("ktw-friend-family-entries", true);
function setFriendFamEntries(on) { FRIEND_FAM_ENTRIES = on; try { localStorage.setItem("ktw-friend-family-entries", on ? "all" : "linked"); } catch {} }
let PATH_ENTRIES = readEntriesSetting("ktw-path-entries", true);
let FAMILY_ENTRIES = readEntriesSetting("ktw-family-entries", true);
function setFriendEntries(on) { FRIEND_ENTRIES = on; try { localStorage.setItem("ktw-friend-entries", on ? "all" : "linked"); } catch {} }
function setPathEntries(on) { PATH_ENTRIES = on; try { localStorage.setItem("ktw-path-entries", on ? "all" : "linked"); } catch {} }
function setFamilyEntries(on) { FAMILY_ENTRIES = on; try { localStorage.setItem("ktw-family-entries", on ? "all" : "linked"); } catch {} }
// "entries" of the main graph, kept per browser like every other switch in the bar — a move to another centre builds a new graph and must not reset it
let SHOW_ENTRIES = (() => { try { return localStorage.getItem("ktw-entries") !== "off"; } catch { return true; } })();
function setShowEntries(on) { SHOW_ENTRIES = on; try { localStorage.setItem("ktw-entries", on ? "on" : "off"); } catch {} }
// labels per group too — the project's own nodes, the family, the friends, the path — kept per browser, all on by default;
// on a phone only this project's names: the other groups' topic names pile up on a small screen (hub names always show)
const LABEL_DEFAULTS = (() => { const all = !narrow(); return { project: true, family: all, friends: all, friendsFamilies: all, path: all }; })();
let LABELS = (() => { try { return { ...LABEL_DEFAULTS, ...JSON.parse(localStorage.getItem("ktw-labels") || "{}") }; } catch { return { ...LABEL_DEFAULTS }; } })();
function setLabels(group, on) { LABELS = { ...LABELS, [group]: on }; try { localStorage.setItem("ktw-labels", JSON.stringify(LABELS)); } catch {} }
const labelGroupOf = (n) => (n.ext ? (n.unit === "family" ? "family" : String(n.unit || "").startsWith("trail:") ? "path" : n.kin ? "friendsFamilies" : "friends") : n.fam ? "family" : "project");
const labelsOn = (n) => LABELS[labelGroupOf(n)] !== false;
const labelsUi = (g, group, what) => el("label", { title: `the names of ${what} — topics, and entries when zoomed in` }, el("input", { type: "checkbox", checked: LABELS[group] !== false, onchange: (ev) => { setLabels(group, ev.target.checked); g.wake?.(); } }), group === "project" ? "labels" : group === "friendsFamilies" ? "friends families labels" : `${group} labels`);
// the "<group> entries" checkbox, the same for the three groups
const allEntriesUi = (group, checked, set, what) => el("label", { class: "friend-entries", title: `every entry of ${what}, not only the ones that link to this graph` }, el("input", { type: "checkbox", checked, onchange: (ev) => { set(ev.target.checked); if (fgraph) fgraph.at = 0; render(); } }), group === "friendsFamilies" ? "friends families entries" : `${group} entries`);
// every switch in the bar at once — motion is not a filter and stays
function selectAll(g, on) {
  g.showEntries = on; setShowEntries(on);
  for (const x of [graph, fgraph]) if (x) x.showEntries = on; // the bar may switch to the other graph on the way (family entries)
  for (const k of Object.keys(LABELS)) setLabels(k, on);
  setFamilyNeighbours(on); setFamilyEntries(on);
  setFriendEntries(on); setFriendFamilies(on); setFriendFamEntries(on); setPathEntries(on);
  setTrailShow(on); // the path is hidden or shown, never discarded here
  if (on) { setFriendsAuto(true); setKeepPath(true); autoFamily(); autoFriends(g); } else { FRIENDS.on = false; setFriendsAuto(false); }
  if (fgraph) fgraph.at = 0;
  render();
}
function setFriendsAuto(on) { FRIENDS_AUTO = on; try { localStorage.setItem("ktw-friends", on ? "on" : "off"); } catch {} }
function autoFriends(g) {
  if (!FRIENDS_AUTO || FRIENDS.loading) return;
  const list = g.friends || []; if (!list.length) return;
  const waiting = list.filter((f) => !FRIENDS.loaded[fkey(f.canonical)]);
  if (FRIENDS.on && !waiting.length) return;
  FRIENDS.loading = true;
  setTimeout(() => loadFriends(FRIENDS.on ? waiting : list).finally(() => { FRIENDS.loading = false; }), 0); // after the graph that asked is drawn
} // loaded: key -> {state, name, href(e), topicHref(file), open} | {error}
const fkey = (c) => String(c || "").replace(/\/+$/, "").toLowerCase();
const friendColor = (i) => PALETTE[(i + 5) % PALETTE.length];
const familyColor = () => PALETTE[8];
// The project's own family as neighbours of the project graph — the parent, the
// children, the siblings as hubs joined the way the family graph joins them,
// each with the entries linked to this project (all of them under "all their
// entries"), the same layer friends and the path use. The family scope stays
// the merged view (search, queues, counts); this is the lean one. Loaded on
// its own when the graph is first drawn, like friends — one export per member
// in public mode, which is the cost to watch as families grow.
let FAMILY_NB = { groups: null, missing: [], loading: false };
let FAMILY_NB_ON = (() => { try { return localStorage.getItem("ktw-family-neighbours") !== "off"; } catch { return true; } })(); // the family beside the graph; off per browser
function setFamilyNeighbours(on) { FAMILY_NB_ON = on; try { localStorage.setItem("ktw-family-neighbours", on ? "on" : "off"); } catch {} }
// How much of the family the graph shows — the graph's own setting, apart from the scope switch, which
// merges search, queues and counts: "off" (the project alone, with friends and path), "linked" (the
// members beside it with the entries linked here), "all" (the family graph, every member whole).
const graphFamily = () => (!canFamily() ? "none" : !FAMILY_NB_ON ? "off" : FAMILY_ENTRIES ? "all" : "linked");
const familyGraphShown = () => graphFamily() === "all";
function autoFamily() {
  if (!FAMILY_NB_ON || !canFamily() || FAMILY_NB.groups || FAMILY_NB.loading) return;
  FAMILY_NB.loading = true;
  setTimeout(() => searchPool("family").then((pool) => { FAMILY_NB.groups = pool.groups.filter((x) => x.member.role !== "self"); FAMILY_NB.missing = pool.missing || []; }).catch(() => { FAMILY_NB.groups = []; })
    .finally(() => { FAMILY_NB.loading = false; if (graph) graph.alpha = Math.max(graph.alpha, 0.6); if (fgraph) fgraph.at = 0; render(); }), 0); // after the graph that asked is drawn
}
// the members beside this project: the loaded ones and the ones not available here; before the load, what the config declares
// the members beside this project: the loaded ones and the ones not available here; before the load, the tree
// as the server or the published exports gave it — and no number at all while nothing has been fetched
const familyCount = () => (FAMILY_NB.groups ? FAMILY_NB.groups.length + (FAMILY_NB.missing?.length || 0) : TREE ? TREE.filter((m) => m.role !== "self").length : PUBLIC_TREE?.groups ? PUBLIC_TREE.groups.filter((x) => x.member.role !== "self").length + (PUBLIC_TREE.missing?.length || 0) : null);
function familyMembers() {
  if (!FAMILY_NB_ON || !canFamily() || !FAMILY_NB.groups?.length) return [];
  return FAMILY_NB.groups.map((x, i) => ({ ...(PUBLISHED() ? publicMember(x.member, x.state) : liveMember(x.member, x.state)), color: PALETTE[(i + 1) % PALETTE.length] })).filter((m) => m.state && !onPath(m.canonical));
}
function friendCandidates(entries, family = []) {
  const p = SELF?.project || {}; const base = canonicalOf(p); const root = MY_ROOT();
  const declared = [p.parent, ...(p.children || []).map((c) => c.location)].map((l) => resolveLocation(l, base, root)?.canonical);
  return friendsOf(entries, [base, ...declared, ...(TREE || []).map((m) => m.canonical), ...family]);
}
function loadFriend(f) {
  const k = fkey(f.canonical);
  if (FRIENDS.loaded[k]) return Promise.resolve(FRIENDS.loaded[k]);
  return (FRIENDS.pending[k] ||= (async () => {
    let r = null;
    if (LIVE() && f.uuids?.length) {
      try {
        const res = await fetch(`/api/entry?uuid=${encodeURIComponent(f.uuids[0])}${PROJECT ? `&project=${encodeURIComponent(PROJECT)}` : ""}`, { cache: "no-store" });
        if (res.ok) {
          const hit = await res.json(); const m = await memberState(hit.project);
          if (m.state) r = { ...liveMember({ key: hit.project, name: m.state.project?.id, role: "self" }, m.state), name: m.state.project?.id || repoLabel(f.canonical) };
        }
      } catch { /* not known here: the published export */ }
    }
    if (!r) {
      const p = await fetchPublicState(f.canonical, "");
      r = p.state ? { ...publicMember({ canonical: f.canonical, root: "", name: repoLabel(f.canonical), role: "self" }, p.state), forkOf: p.forkOf || null } : { error: p.error };
    }
    r.canonical = f.canonical;
    // a family is one unit, like a repository: a friend that has one comes with all of it
    if (r.state) r.members = await friendUnit(r);
    return (FRIENDS.loaded[k] = r);
  })());
}
// One member of a friend's unit, however it was found
function liveMember(m, state) {
  const at = (hash) => `${location.pathname}?project=${encodeURIComponent(m.key)}${hash}`;
  return { key: `L:${m.key}`, name: m.name || state.project?.id || m.key, role: m.role, state, canonical: canonicalOf(state.project) || m.canonical || "", root: state.project?.root || "",
    href: (e) => at(entryHref(e)), topicHref: (file) => at(`#topic/${file}`), open: at("#graph"), centre: { mode: "live", project: m.key } };
}
function publicMember(m, state) {
  return { key: `P:${fkey(m.canonical)}|${m.root || ""}`, name: m.name, role: m.role, state, canonical: m.canonical, root: m.root || "",
    href: (e) => publicHref(m.canonical, m.root || "", entryHref(e)), topicHref: (file) => publicHref(m.canonical, m.root || "", `#topic/${file}`), open: publicHref(m.canonical, m.root || "", "#graph"), centre: { mode: "public", canonical: m.canonical, root: m.root || "" } };
}
// The friend's whole family tree — on the live server what it knows about that
// project, else the members' published exports; members that cannot be read
// are left out of the unit (the friend itself is always in it).
async function friendUnit(r) {
  const p = r.state.project || {};
  const self = { ...r };
  if (!p.parent && !(p.children || []).length) return [self];
  const out = [self];
  if (r.centre?.mode === "live") {
    try {
      const members = ((await (await fetch(`/api/family?project=${encodeURIComponent(r.centre.project)}&tree=1`, { cache: "no-store" })).json()).members || []).filter((m) => m.role !== "self" && m.key);
      const states = await Promise.all(members.map((m) => memberState(m.key)));
      members.forEach((m, i) => { if (states[i].state) out.push(liveMember(m, states[i].state)); });
      return out;
    } catch { /* fall back to the published exports */ }
  }
  const t = await publicTreeFrom({ state: r.state, canonical: r.canonical, root: p.root || "", name: r.name, href: r.href });
  for (const g of t.groups) if (g.member.role !== "self") out.push(publicMember(g.member, g.state));
  return out;
}

async function loadFriends(list) {
  if (LIVE()) await fetchTree(); // the whole family is known before anything counts as a friend
  FRIENDS.on = true; FRIENDS.loading = true;
  await Promise.all(list.map(loadFriend));
  FRIENDS.loading = false; // before the render, so the controls show the result
  if (fgraph) fgraph.at = 0;
  render();
}
function toggleFriend(k) {
  if (FRIENDS.expanded.has(k)) FRIENDS.expanded.delete(k); else FRIENDS.expanded.add(k);
  if (fgraph) fgraph.at = 0;
  render();
}
// Linked projects in the graph: friends and the path. Each item is a unit —
// one repository, or a whole family, which is one unit like a repository —
// drawn as a hub per project (joined by their parent lines) with some of its
// entries: the ones that link to what the graph shows, or all of them once a
// friend's hub is expanded. See and Superseded by join them to the graph and
// to each other, both ways, a reference counting only when it names one of
// the unit's repositories and an Id there. Called by buildGraph and
// buildFamilyGraph after their own nodes.
// a unit is the repositories it holds — by canonical and root, not by how they were loaded: the same family
// read once from this machine (live keys) and once from published exports (public keys) is one unit
const unitKey = (members) => members.map((m) => `${fkey(m.canonical)}|${m.root || ""}`).sort().join(" ");
// an entry's See and Superseded by, each { uuid, remote, kind }
const entryRefs = (e) => [...(e.see || []).map((x) => x && { uuid: x.uuid, remote: x.remote, kind: "see" }), e.superseded_by ? { ...parseSupersededBy(e.superseded_by), kind: "superseded" } : null].filter((x) => x?.uuid);
function friendUnits(g) {
  // friends of one family are one unit: the Ids cited in any of its repositories together
  const units = new Map();
  const add = (f, via) => {
    const r = FRIENDS.loaded[fkey(f.canonical)];
    const centre = fkey(canonicalOf(SELF?.project));
    if (!r?.state || onPath(f.canonical) || fkey(f.canonical) === centre) return; // the centre is drawn as itself, never again as a neighbour
    const members = (FRIEND_FAMILIES ? r.members || [r] : [r]).filter((m) => fkey(m.canonical) !== centre || m === r);
    const k = unitKey(members);
    if (!units.has(k)) units.set(k, { k, r, members, uuids: new Set(), via });
    const u = units.get(k); if (via === "friend") u.via = "friend"; if (via === "cited") u.citing = true;
    for (const x of f.uuids) u.uuids.add(x);
  };
  if (FRIENDS.on) (g.friends || []).forEach((f) => add(f, "friend"));
  for (const f of CHAIN.extra.values()) add(f, "chain"); // reached by following a thought
  if (CITED.on) { const skip = new Set(citedExclude().map(fkey)); for (const f of CITED.list) if (!skip.has(fkey(f.canonical))) add(f, "cited"); }
  for (const f of GLOBE.extra.values()) { add(f, "globe"); const u = units.get(unitKey((FRIENDS.loaded[fkey(f.canonical)]?.members) || [FRIENDS.loaded[fkey(f.canonical)]])); if (u && u.via === "globe") u.hop = f.registry ? "registry" : f.hop; }
  return [...units.values()];
}
function addFriendLayer(g, prev) {
  const items = [];
  const trail = pathShown() ? TRAIL.filter((t) => !sameCentreAsGraph(g, t)) : [];
  trail.forEach((t, i) => items.push({
    k: `trail:${t.key}`, kind: "trail", color: PALETTE[(i + 2) % PALETTE.length], cited: PATH_ENTRIES ? null : "linked", // a path step is a neighbour like a friend: its own "all their entries" opens it
    members: [{ key: t.key, name: `${i + 1} · ${t.name}`, state: t.state, canonical: t.canonical, root: t.state.project?.root || "", href: (e) => t.url + entryHref(e), topicHref: (file) => `${t.url}#topic/${file}`, open: `${t.url}#graph` }],
    hub: () => moveTo(t, "#graph"), entry: () => (e) => moveTo(t, entryHref(e)), topic: () => (file) => moveTo(t, `#topic/${file}`),
    next: i + 1 < trail.length ? `trail:${trail[i + 1].key}` : null,
  }));
  const fam = g === graph ? familyMembers() : []; // the project graph only: a topic's or an entry's neighbourhood stays its own
  if (fam.length) items.push({
    k: "family", kind: "family", color: familyColor(), cited: FAMILY_ENTRIES ? null : "linked", members: fam,
    hub: null,
    entry: (m) => (m.centre ? (e) => moveTo({ centre: m.centre, state: m.state }, entryHref(e)) : null),
    topic: (m) => (m.centre ? (file) => moveTo({ centre: m.centre, state: m.state }, `#topic/${file}`) : null),
  });
  friendUnits(g).forEach((u, i) => items.push({
    k: u.k, kind: "friend", chain: u.via === "chain" || u.via === "globe", hop: u.via === "globe" ? u.hop : null, citing: !!u.citing, citedOnly: u.via === "cited", color: friendColor(i), cited: (FRIEND_ENTRIES && (FRIEND_FAM_ENTRIES || u.members.length === 1)) || FRIENDS.expanded.has(u.k) ? null : u.uuids, members: u.members,
    allFor: (m) => (m === u.members[0] ? FRIEND_ENTRIES : FRIEND_FAM_ENTRIES), kin: (m) => m !== u.members[0], // the cited repository first, then its family
    hub: () => toggleFriend(u.k),
    entry: (m) => (m.centre ? (e) => moveTo({ centre: m.centre, state: m.state }, entryHref(e)) : null),
    topic: (m) => (m.centre ? (file) => moveTo({ centre: m.centre, state: m.state }, `#topic/${file}`) : null),
  }));
  if (items.length) addLinkedLayer(g, prev, items);
}
function addLinkedLayer(g, prev, items) {
  const { nodes, links, index } = g;
  let unit = null; // the item being placed: its nodes keep together, and apart from the graph's own and the other items'
  const add = (n, near) => {
    const p = prev[n.id];
    if (p) Object.assign(n, { x: p.x, y: p.y, vx: 0, vy: 0, fixed: p.fixed });
    else { n.x = (near?.x || 0) + (Math.random() - 0.5) * 120; n.y = (near?.y || 0) + (Math.random() - 0.5) * 120; n.vx = n.vy = 0; }
    n.unit = unit; n.ext = true;
    index[n.id] = nodes.length; nodes.push(n); return n;
  };
  const refsOf = entryRefs;
  const ours = nodes.filter((n) => n.kind === "entry");
  const ourUuids = new Set(ours.map((n) => n.entry.uuid).filter(Boolean));
  const pool = new Set(ours.map((n) => n.entry.uuid).filter(Boolean));
  for (const it of items) for (const m of it.members) for (const e of m.state.entries || []) if (e.uuid) pool.add(e.uuid);
  const R = 680 + 40 * items.length;
  const placed = [];
  // with anything beside it — the family, a friend, the path — the project is a hub too, its topics on spokes, as in
  // the family graph: the parent and child lines, and the path's last step, have something to join, and the centre
  // reads as one project among the others instead of a loose cloud of topics
  let selfHub = null;
  if (items.length && !nodes.some((n) => n.kind === "project" && !n.ext)) {
    const p = SELF?.project || S.project || {};
    selfHub = add({ id: "p:self", kind: "project", self: true, label: p.id || p.name || "this project", canonical: canonicalOf(p), r: 15, color: color0(), href: "#overview" }, { x: 0, y: 0 });
    selfHub.ext = false; selfHub.unit = null;
    for (const n of nodes) if (n.kind === "topic" && !n.ext) links.push({ s: index[selfHub.id], t: index[n.id], kind: "hub", len: 90 });
  }
  items.forEach((it, i) => {
    const col = it.color;
    const canons = new Set(it.members.map((m) => fkey(m.canonical)).filter(Boolean));
    const unitUuids = new Set(it.members.flatMap((m) => (m.state.entries || []).map((e) => e.uuid).filter(Boolean)));
    let cited = it.cited; // null: all of the unit (an expanded friend)
    if (cited !== null) {
      const seeds = new Set(cited === "linked" ? [] : cited);
      if (cited === "linked") { // a path's step: what links to the rest — the graph's entries, the friends', the other steps'
        for (const m of it.members) for (const e of m.state.entries || []) if (e.uuid && refsOf(e).some((x) => pool.has(x.uuid) && !unitUuids.has(x.uuid))) seeds.add(e.uuid);
        for (const n of ours) for (const x of refsOf(n.entry)) if (unitUuids.has(x.uuid) && (!x.remote || canons.has(fkey(x.remote)))) seeds.add(x.uuid);
        for (const o of items) if (o !== it) for (const m of o.members) for (const e of m.state.entries || []) for (const x of refsOf(e)) if (unitUuids.has(x.uuid) && x.remote && canons.has(fkey(x.remote))) seeds.add(x.uuid);
      }
      // the unit's entries that cite the graph belong to it too
      for (const m of it.members) for (const e of m.state.entries || []) if (e.uuid && refsOf(e).some((x) => x.remote && ourUuids.has(x.uuid))) seeds.add(e.uuid);
      // and everything a See or Superseded by chain inside the unit connects to them, so a thought runs through the unit whole
      const adj = new Map(); const tie = (a, b) => { if (!adj.has(a)) adj.set(a, new Set()); if (!adj.has(b)) adj.set(b, new Set()); adj.get(a).add(b); adj.get(b).add(a); };
      for (const m of it.members) for (const e of m.state.entries || []) if (e.uuid) for (const x of refsOf(e)) if (unitUuids.has(x.uuid) && (!x.remote || canons.has(fkey(x.remote)))) tie(e.uuid, x.uuid);
      const stack = [...seeds];
      while (stack.length) { const u = stack.pop(); for (const v of adj.get(u) || []) if (!seeds.has(v)) { seeds.add(v); stack.push(v); } }
      cited = seeds;
    }
    const ang = (2 * Math.PI * i) / items.length + Math.PI / 5;
    const centre = { x: R * Math.cos(ang), y: R * Math.sin(ang) };
    unit = it.k;
    const idx = {}; // uuid -> node index, across the unit
    const hubs = {};
    const entriesShown = [];
    it.members.forEach((m, j) => {
      const mcol = m.color || col;
      const off = it.members.length > 1 ? { x: centre.x + 110 * Math.cos((2 * Math.PI * j) / it.members.length), y: centre.y + 110 * Math.sin((2 * Math.PI * j) / it.members.length) } : centre;
      // the hub and its name both go to that project (back along the path for a step of it)
      const walk = it.kind === "trail" ? it.hub : m.centre ? () => moveTo({ centre: m.centre, state: m.state }, "#graph") : m.open ? () => go(m.open) : null;
      const hub = add({ id: `f:${it.k}:${m.key}`, kind: "project", friend: it.kind === "friend", chain: !!it.chain, hop: it.hop ?? null, citing: j === 0 && !!it.citing, citedOnly: j === 0 && !!it.citedOnly, trail: it.kind === "trail", family: it.kind === "family", label: m.name, canonical: m.canonical, r: it.kind === "family" ? 13 : j === 0 ? 13 : 10, color: mcol, href: m.open || "#graph", action: it.hub, walk }, off);
      if (selfHub && it.kind === "family" && m.role === "child") links.push({ s: index[hub.id], t: index[selfHub.id], kind: "family", len: 260 });
      if (selfHub && it.kind === "family" && m.role === "parent") links.push({ s: index[selfHub.id], t: index[hub.id], kind: "family", len: 260 });
      hubs[m.key] = index[hub.id];
      const allOfM = !cited || !!it.allFor?.(m);
      const own = (m.state.entries || []).filter((e) => allOfM || (e.uuid && cited.has(e.uuid)));
      const files = new Set(own.map((e) => e.file));
      const kin = !!it.kin?.(m);
      hub.kin = kin;
      const tIdx = {};
      for (const t of m.state.topics || []) {
        if (!allOfM && !files.has(t.file)) continue;
        const act = it.topic(m);
        const n = add({ id: `ft:${it.k}:${m.key}:${t.file}`, kind: "topic", kin, label: t.title, file: t.file, color: mcol, r: 7 + Math.sqrt(t.entries || 0) * 2.4, href: m.topicHref ? m.topicHref(t.file) : "#graph", action: act ? () => act(t.file) : null }, hub);
        tIdx[t.file] = index[n.id];
        links.push({ s: index[hub.id], t: tIdx[t.file], kind: "hub", len: 70 });
      }
      for (const e of own) {
        const act = it.entry(m);
        const n = add({ id: `fe:${it.k}:${m.key}:${e.id}`, kind: "entry", kin, proj: m.name, label: e.title, file: e.file, entry: e, r: 4.2, href: m.href ? m.href(e) : "#graph", action: act ? () => act(e) : null }, nodes[tIdx[e.file]] || hub);
        if (e.uuid) idx[e.uuid] = index[n.id];
        if (tIdx[e.file] != null) links.push({ s: index[n.id], t: tIdx[e.file], kind: "member", len: 40 });
        entriesShown.push(e);
      }
    });
    // the unit's own shape: each project joined to its parent, as in the family graph
    if (it.members.length > 1) {
      const { parentOf } = linkFamily(it.members.map((m) => ({ key: m.key, role: m.role === "self" ? "self" : m.role || "relative", canonical: m.canonical, root: m.root, state: m.state })));
      for (const [child, parent] of Object.entries(parentOf)) if (hubs[child] != null && hubs[parent] != null) links.push({ s: hubs[child], t: hubs[parent], kind: "family", len: 170 });
    }
    placed.push({ it, canons, idx, col, entries: entriesShown, firstHub: hubs[it.members[0].key] });
  });
  // See and Superseded by between any two placed units and the graph, both ways; between their topics while entries are hidden
  const topicOfNode = {}; for (const l of links) if (l.kind === "member") topicOfNode[l.s] = l.t;
  const joined = new Set(); const pairs = new Set();
  const join = (s, t, kind, col) => {
    if (s == null || t == null || s === t) return;
    const key = `${s}|${t}|${kind}`; if (joined.has(key)) return; joined.add(key);
    links.push({ s, t, kind, len: 240, color: col });
    const ts = topicOfNode[s], tt = topicOfNode[t];
    if (ts != null && tt != null && ts !== tt && !pairs.has(`${ts}|${tt}`)) { pairs.add(`${ts}|${tt}`); links.push({ s: ts, t: tt, kind: "xtopic", len: 240, color: col }); }
  };
  const byUuid = {}; for (const n of ours) if (n.entry.uuid) byUuid[n.entry.uuid] = index[n.id];
  for (const P of placed) {
    for (const n of ours) for (const x of refsOf(n.entry)) if (x.remote && P.canons.has(fkey(x.remote)) && P.idx[x.uuid] != null) join(index[n.id], P.idx[x.uuid], x.kind, P.col);
    for (const e of P.entries) {
      const s = P.idx[e.uuid]; if (s == null) continue;
      for (const x of refsOf(e)) {
        if (!x.remote) { if (P.idx[x.uuid] != null) join(s, P.idx[x.uuid], x.kind, P.col); continue; } // within the unit's repository
        if (P.canons.has(fkey(x.remote)) && P.idx[x.uuid] != null) { join(s, P.idx[x.uuid], x.kind, P.col); continue; } // across the unit
        if (byUuid[x.uuid] != null) join(s, byUuid[x.uuid], x.kind, P.col); // citing the graph
        for (const Q of placed) if (Q !== P && Q.canons.has(fkey(x.remote)) && Q.idx[x.uuid] != null) join(s, Q.idx[x.uuid], x.kind, P.col); // citing another unit
      }
    }
    // the walk's order: one step's hub to the next
    if (P.it.next) { const Q = placed.find((q) => q.it.k === P.it.next); if (Q) links.push({ s: P.firstHub, t: Q.firstHub, kind: "trail", len: 360 }); }
    else if (P.it.kind === "trail" && selfHub) links.push({ s: P.firstHub, t: index[selfHub.id], kind: "trail", len: 360 }); // the last step walked from leads here
  }
}

// ---------------------------------------------------------------- path
// The path: the projects walked through to get here — A to a friend B, from
// B to its friend D, on to Y. A walk changes the centre in place, without a
// reload, so what was loaded stays in memory: the path is those states, kept
// for this tab and this page only. A reload, or a link opened anew, starts
// without one — a link leads to an entry, not to a path. Back and forward
// walk it; a step back shortens it; *discard* clears it; *path* in the graph
// turns keeping it off (kept per browser). The path's projects are hubs in
// the graph, joined in the order walked, with the entries that link them.
let TRAIL = []; // [{ key, centre, state, name, canonical, url }], oldest first; the centre shown is not in it
const VISITED = new Map(); // key -> the same, every centre of this page, for back and forward
let TRAIL_SHOW = (() => { try { return localStorage.getItem("ktw-path-show") !== "off"; } catch { return true; } })(); // the path drawn in the graph; off hides it, the path itself stays
function setTrailShow(on) { TRAIL_SHOW = on; try { localStorage.setItem("ktw-path-show", on ? "on" : "off"); } catch {} }
let KEEP_PATH = (() => { try { return localStorage.getItem("ktw-path") !== "off"; } catch { return true; } })();
const keepPath = () => KEEP_PATH;
function setKeepPath(on) { KEEP_PATH = on; if (!on) TRAIL = []; try { localStorage.setItem("ktw-path", on ? "on" : "off"); } catch {} }
const pathShown = () => KEEP_PATH && TRAIL_SHOW && TRAIL.length > 0;
const onPath = (canonical) => pathShown() && TRAIL.some((t) => fkey(t.canonical) === fkey(canonical));
// a step of the path that the graph already shows — a member of the family graph — is not drawn twice
const sameCentreAsGraph = (g, t) => (g.groups || []).some((G) => fkey(G.canonical) === fkey(t.canonical) && (G.root || "") === (t.state.project?.root || ""));
const currentCentre = () => (MODE === "public" ? { mode: "public", canonical: PUBLIC, root: PUBLIC_ROOT } : MODE === "export" ? { mode: "export" } : { mode: "live", project: PROJECT });
function centreKey(c) { return c.mode === "public" ? `P:${fkey(c.canonical)}|${c.root || ""}` : c.mode === "export" ? "E" : `L:${c.project || ""}`; }
function centreFromUrl(loc) {
  const q = new URLSearchParams(loc.search);
  if (q.get("public")) return { mode: "public", canonical: q.get("public"), root: q.get("root") || "" };
  return window.__KTW_STATE__ ? { mode: "export" } : { mode: "live", project: q.get("project") };
}
function centreUrl(c) {
  if (c.mode === "public") return `${location.pathname}?public=${encodeURIComponent(c.canonical)}${c.root ? `&root=${encodeURIComponent(c.root)}` : ""}`;
  if (c.mode === "live" && c.project) return `${location.pathname}?project=${encodeURIComponent(c.project)}`;
  return location.pathname;
}
function remember(c, state) {
  const e = { key: centreKey(c), centre: c, state, name: state.project?.id || state.project?.name || repoLabel(canonicalOf(state.project) || ""), canonical: canonicalOf(state.project), url: centreUrl(c) };
  VISITED.set(e.key, e); return e;
}
// Everything that belongs to one centre starts over when the centre moves; the
// fetched states (friends, members, published exports) stay cached.
function setCentre(c, state) {
  MODE = c.mode; PUBLIC = c.mode === "public" ? c.canonical : null; PUBLIC_ROOT = c.mode === "public" ? c.root || "" : ""; PROJECT = c.mode === "live" ? c.project || null : null;
  graph = null; fgraph = null; TREE = null; TREE_AT = 0; TREE_ASKED = false; PUBLIC_TREE = null; LAST_POOL = null;
  FRIENDS.on = false; FRIENDS.expanded.clear(); THOUGHT_PIN = null; MINI = null; CHAIN.extra.clear(); CHAIN.tried.clear();
  FAMILY_NB = { groups: null, missing: [], loading: false }; // the family beside the graph is the new centre's
  GLOBE.extra.clear(); GLOBE.failed.clear(); GLOBE.done = 0; GLOBE.registry = false; // the globe's waves were counted from the old centre; what was fetched stays in memory
  CITED.on = false; CITED.loading = false; CITED.error = null; CITED.list = []; CITED.elsewhere = 0; CITED.checked = ""; CITED.url = null; // who cites the old centre
  if (MODE === "public") state.exported = true;
  connectLive();
  const sel = $("#project-select");
  if (sel && !sel.hidden && MODE === "live") sel.value = PROJECT || SELECTED_DEFAULT || sel.value;
  applyState(state);
}
// Go to another centre whose state is loaded: the path grows by the centre
// left, or — when the target is already on it — goes back to it.
function moveTo(t, hash = "#graph", { push = true } = {}) {
  const target = t.key ? t : remember(t.centre, t.state);
  const here = remember(currentCentre(), SELF);
  if (target.key === here.key) { if (location.hash !== hash) location.hash = hash; return; }
  const i = TRAIL.findIndex((x) => x.key === target.key);
  if (i >= 0) TRAIL = TRAIL.slice(0, i);
  else if (KEEP_PATH) { TRAIL = TRAIL.filter((x) => x.key !== here.key); TRAIL.push(here); }
  else TRAIL = [];
  if (push) history.pushState({ ktw: target.key }, "", target.url + hash);
  ensureBodies(target.state).then(() => setCentre(target.centre, target.state));
}
// Back and forward: a step inside this centre is a hash change (rendered
// there); a step to another centre goes there in place when its state is in
// memory, else the page loads it.
function onPopState() {
  const c = centreFromUrl(location); const key = centreKey(c);
  if (key === centreKey(currentCentre())) return;
  const known = VISITED.get(key);
  if (!known) { location.reload(); return; }
  moveTo(known, location.hash || "#overview", { push: false });
}
// A link to another centre whose state is loaded (a friend, a step of the
// path) goes there in place, so the path grows; anything else loads as a link does.
function stateForUrl(url) {
  const key = centreKey(centreFromUrl(url));
  if (VISITED.has(key)) return VISITED.get(key);
  for (const r of Object.values(FRIENDS.loaded)) for (const m of (r?.state ? r.members || [r] : [])) if (m.centre && centreKey(m.centre) === key) return { centre: m.centre, state: m.state };
  return null;
}
function onLinkClick(ev) {
  if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
  const a = ev.target.closest?.("a[href]"); if (!a || a.target === "_blank") return;
  let url; try { url = new URL(a.getAttribute("href"), location.href); } catch { return; }
  if (url.origin !== location.origin || url.pathname !== location.pathname || url.search === location.search) return;
  const t = stateForUrl(url); if (!t) return;
  ev.preventDefault();
  moveTo(t, url.hash || "#overview");
}
function pathBar() {
  if (!KEEP_PATH || !TRAIL.length) return null;
  const here = SELF?.project?.id || SELF?.project?.name || "";
  const steps = TRAIL.map((t, i) => [el("a", { href: t.url + "#graph", title: `back to ${t.name} — the path shortens to here`, onclick: (ev) => { ev.preventDefault(); moveTo(t, "#graph"); }, onmouseenter: () => spotProject(t.canonical), onmouseleave: () => spotProject(null) }, `${i + 1} · ${t.name}`), el("span", { class: "sep" }, " › ")]).flat();
  return el("div", { class: "path-bar" }, el("span", { class: "label" }, "Path "), ...steps, el("b", {}, here),
    el("span", { class: "grow" }),
    el("label", { title: "show the path's projects in the graph" }, el("input", { type: "checkbox", checked: TRAIL_SHOW, onchange: (ev) => { setTrailShow(ev.target.checked); if (fgraph) fgraph.at = 0; render(); } }), "in graph"),
    el("button", { type: "button", class: "link-btn", title: "forget the path; this project becomes the start", onclick: () => { TRAIL = []; if (fgraph) fgraph.at = 0; render(); } }, "discard"));
}
function friendsUi(g) {
  const list = g.friends || [];
  if (!list.length) return null;
  const waiting = list.filter((f) => !FRIENDS.loaded[fkey(f.canonical)]);
  if (FRIENDS.loading) return el("span", { class: "friends-load note" }, "loading friends…");
  if (!FRIENDS.on || waiting.length) {
    const b = el("button", { class: "link-btn friends-load", title: "load the repositories these entries cite outside the family, now and from here on", onclick: () => { b.disabled = true; b.textContent = "loading friends…"; setFriendsAuto(true); loadFriends(FRIENDS.on ? waiting : list); } }, `friends (${FRIENDS.on ? waiting.length : list.length})`);
    return b;
  }
  // a friend whose export could not be fetched is loaded with an error and draws nothing — say so
  // here, where the reader looks for it, and point at the Friends view, which names the reason
  const failed = list.filter((f) => FRIENDS.loaded[fkey(f.canonical)]?.error);
  const shown = list.length - failed.length;
  return el("span", { class: "friends-ctl" },
    el("label", { class: "friends-toggle", title: "the repositories these entries cite outside the family — unchecked, they are no longer loaded on their own" }, el("input", { type: "checkbox", checked: true, onchange: () => { FRIENDS.on = false; setFriendsAuto(false); if (fgraph) fgraph.at = 0; render(); } }), "friends"),
    failed.length ? el("a", { class: "friends-failed warn", href: "#friends", title: failed.map((f) => `${repoLabel(f.canonical)} — ${FRIENDS.loaded[fkey(f.canonical)].error}`).join("\n") }, `${shown ? `${failed.length} of ${list.length}` : failed.length === 1 ? "the one friend" : `all ${failed.length}`} not loaded ↗`) : null,
    shown ? allEntriesUi("friends", FRIEND_ENTRIES, setFriendEntries, "every friend") : null,
    shown ? labelsUi(g, "friends", "the friends") : null,
    ...(shown && list.some((f) => (FRIENDS.loaded[fkey(f.canonical)]?.members || []).length > 1) ? [
      el("label", { class: "friend-families", title: FRIEND_FAMILIES ? "a friend's family beside it — unchecked, the cited repository alone" : "show a friend's family beside it" }, el("input", { type: "checkbox", checked: FRIEND_FAMILIES, onchange: (ev) => { setFriendFamilies(ev.target.checked); if (fgraph) fgraph.at = 0; render(); } }), "friends families"),
      ...(FRIEND_FAMILIES ? [allEntriesUi("friendsFamilies", FRIEND_FAM_ENTRIES, setFriendFamEntries, "every member of a friend's family"), labelsUi(g, "friendsFamilies", "the friends' families")] : []),
    ] : []));
}
// what this project and its family are, for "cited by": drawn already, so not again as a citing repository
function citedExclude() {
  const p = SELF?.project || {}; const base = canonicalOf(p); const root = MY_ROOT();
  const declared = [p.parent, ...(p.children || []).map((c) => c.location)].map((l) => resolveLocation(l, base, root)?.canonical);
  return [base, ...declared, ...(TREE || []).map((m) => m.canonical), ...familyMembers().map((m) => m.canonical), ...(PUBLIC_TREE?.groups || []).map((x) => x.member.canonical)];
}
async function loadCited() {
  CITED.loading = true; CITED.error = null; render();
  try {
    let file = { cited_by: [] };
    try { file = JSON.parse(await fetchForeign(CITED.url)); } catch (err) {
      // no file: nothing in the registry cites this repository — an answer, not a failure
      if (!/HTTP 404/.test(err?.message || "")) throw err;
      FAILED.delete(CITED.url);
    }
    const r = citingOf(file, (SELF?.entries || []).map((e) => e.uuid).filter(Boolean), [canonicalOf(SELF?.project)]);
    CITED.list = r.citing; CITED.elsewhere = r.elsewhere; CITED.checked = file.checked || "";
    await Promise.all(CITED.list.map(loadFriend));
    CITED.on = true;
  } catch (err) { CITED.error = err?.message || String(err); CITED.on = false; }
  CITED.loading = false;
  if (fgraph) fgraph.at = 0;
  render();
}
// "cited by": who in the registry cites this project — asked for on the click, one file from the registry
function citedUi(g) {
  if (g !== graph && g !== fgraph) return null;
  const url = backlinksUrl(REGISTRY_URL, canonicalOf(SELF?.project));
  if (!url) return null; // no repository URL the registry could hold
  CITED.url = url;
  const title = `who in the Keep the Why registry cites this project — the registry's backlink file, ${url}, loaded on the click and not remembered${CITED.checked ? `; built ${CITED.checked}` : ""}. Citations from repositories outside the registry are not in it.`;
  if (CITED.loading) return el("span", { class: "ui-group" }, el("span", { class: "note" }, "loading cited by…"));
  const failed = CITED.on ? CITED.list.filter((f) => FRIENDS.loaded[fkey(f.canonical)]?.error) : [];
  return el("span", { class: "ui-group cited-ctl" },
    el("label", { title }, el("input", { type: "checkbox", checked: CITED.on, onchange: (ev) => { if (ev.target.checked) loadCited(); else { CITED.on = false; if (fgraph) fgraph.at = 0; render(); } } }),
      CITED.on ? `cited by (${CITED.list.length})` : "cited by"),
    CITED.on && !CITED.list.length ? el("span", { class: "note" }, "nothing in the registry cites this project") : null,
    CITED.on && CITED.elsewhere ? el("span", { class: "note", title: "the registry lists citations of Ids this export does not hold — an entry since removed, or another project in the same repository" }, `${CITED.elsewhere} of Ids not here`) : null,
    failed.length ? el("a", { class: "warn", href: "#friends", title: failed.map((f) => `${repoLabel(f.canonical)} — ${FRIENDS.loaded[fkey(f.canonical)].error}`).join("\n") }, `${failed.length} not loaded ↗`) : null,
    CITED.error ? el("span", { class: "warn", title: CITED.error }, "registry not reached") : null);
}
// the family beside the project graph: on by default, off per browser (and then not loaded either)
function familyUi(g) {
  if (!canFamily()) return null;
  const merged = g !== graph; // the family graph: every member whole
  return el("span", { class: "family-ctl" },
    el("label", { class: "family-toggle", title: FAMILY_NB_ON ? "the family's projects in the graph — unchecked, the project alone, with its friends and path" : "show the family's projects in the graph, with the entries linked here" },
      el("input", { type: "checkbox", checked: FAMILY_NB_ON, onchange: (ev) => { setFamilyNeighbours(ev.target.checked); if (ev.target.checked) autoFamily(); render(); } }), FAMILY_NB.loading ? "family (loading…)" : familyCount() == null ? "family" : `family (${familyCount()})`),
    FAMILY_NB_ON && (merged || familyMembers().length) ? allEntriesUi("family", FAMILY_ENTRIES, setFamilyEntries, "every member of the family — the family graph, every member whole") : null);
}
// the same control, small, in the corner of the side pane's graph
function miniFriends(g) {
  const want = FRIENDS.load; FRIENDS.load = false; // asked for from the neighbourhood view: that click is the request
  const list = g.friends || [];
  if (!list.length) return null;
  const waiting = list.filter((f) => !FRIENDS.loaded[fkey(f.canonical)]);
  if (want) { if (!FRIENDS.on || waiting.length) { loadFriends(FRIENDS.on ? waiting : list); return el("span", { class: "mini-seg mini-friends" }, el("button", { type: "button", disabled: true }, "loading…")); } }
  const on = FRIENDS.on && !waiting.length;
  if (FRIENDS.loading && !want) return el("span", { class: "mini-seg mini-friends" }, el("button", { type: "button", disabled: true }, "loading…"));
  const failed = on ? list.filter((f) => FRIENDS.loaded[fkey(f.canonical)]?.error) : [];
  const b = el("button", { type: "button", class: on ? "on" : "", title: on ? (failed.length ? `${failed.length} of ${list.length} could not be loaded — the Friends view names the reason` : "hide the friends — they are no longer loaded on their own") : "load the repositories these entries cite outside the family, now and from here on",
    onclick: () => { if (on) { FRIENDS.on = false; setFriendsAuto(false); if (fgraph) fgraph.at = 0; render(); } else { b.disabled = true; b.textContent = "loading…"; setFriendsAuto(true); loadFriends(FRIENDS.on ? waiting : list); } } },
    on ? (failed.length ? `friends (${failed.length} not loaded)` : "friends") : `friends (${FRIENDS.on ? waiting.length : list.length})`);
  return el("span", { class: "mini-seg mini-friends" }, b);
}
// ---------------------------------------------------------------- thoughts
// Thoughts: chains of linked entries through the graph — the longest chains of See
// and Superseded by between entries (each one cites the one before), at least
// four entries long, across projects where the graph spans them (family,
// friends). Listed beside the graph; pointing at one lights its path, a click
// holds it and lists its steps in reading order, origin first. A chain made
// only of Superseded by is how one decision changed over time: an evolution.
let THOUGHT_MIN = (() => { try { return Number(localStorage.getItem("ktw-thought-min")) || 4; } catch { return 4; } })(); // entries a thought has at least, kept per browser
// the choices go from 2 (one link) up to the longest chain in the graph on the page, and grow with
// it when a friend or a path brings a longer one; a kept choice above the longest here is drawn
// down to it, so a sparse project shows its chains instead of an empty list
const longestChain = (all) => Math.max(2, ...all.map((t) => t.steps.length));
const thoughtMin = (all) => Math.min(THOUGHT_MIN, longestChain(all));
function thoughtMinSeg(all, onpick = render) {
  const top = longestChain(all), cur = thoughtMin(all);
  return el("span", { class: "thought-min", title: "entries a thought has at least — from one link up to the longest chain here" }, "from ",
    ...Array.from({ length: top - 1 }, (_, i) => i + 2).map((m) => el("button", { type: "button", class: m === cur ? "on" : "", onclick: () => { THOUGHT_MIN = m; try { localStorage.setItem("ktw-thought-min", String(m)); } catch {} onpick(); } }, String(m))));
}
// Every chain in the graph, at least two entries long: the entry-to-entry
// edges in reading order (later → earlier), plus an edge to a placeholder for
// every reference into an entry the page has not loaded — a chain that ends
// in a placeholder goes on beyond this page, before its origin (a See into
// an unloaded repository) or after its newest entry (a Superseded by naming a
// successor there). What cites a chain's newest entry from a repository that
// is not loaded cannot be known; there is no index of the web, by design.
function graphChains(g) {
  const kind = {};
  const edges = [];
  for (const l of g.links) {
    if (l.kind !== "see" && l.kind !== "superseded") continue;
    const a = g.nodes[l.s], b = g.nodes[l.t];
    if (a?.kind !== "entry" || b?.kind !== "entry") continue;
    // later first: a See runs from the entry that cites to the one cited, a Superseded by from the old entry to its successor
    const [later, earlier] = l.kind === "see" ? [a, b] : [b, a];
    edges.push([later.id, earlier.id]); kind[`${later.id}|${earlier.id}`] = l.kind;
  }
  const present = new Set(g.nodes.filter((n) => n.kind === "entry" && n.entry.uuid).map((n) => n.entry.uuid));
  for (const n of g.nodes) {
    if (n.kind !== "entry") continue;
    for (const x of entryRefs(n.entry)) {
      if (!x.remote || present.has(x.uuid)) continue;
      const v = `?${x.remote}|${x.uuid}`;
      edges.push(x.kind === "see" ? [n.id, v] : [v, n.id]);
    }
  }
  const byId = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
  const merged = new Map(); // one chain per run of real entries, its open ends together
  for (const ids of thoughtsOf(edges, 2)) {
    const real = ids.filter((id) => !id.startsWith("?"));
    if (real.length < 2) continue;
    const ends = ids.filter((id) => id.startsWith("?")).map((v) => { const cut = v.lastIndexOf("|"); return { canonical: v.slice(1, cut), uuid: v.slice(cut + 1) }; });
    const key = real.join("|");
    if (!merged.has(key)) {
      const steps = real.map((id) => byId[id]);
      const kinds = real.slice(1).map((id, i) => kind[`${id}|${real[i]}`]);
      merged.set(key, { ids: real, steps, kinds, evolution: kinds.every((k) => k === "superseded"), ends: [], ins: thoughtInsights(steps.map((n) => n.entry), kinds) });
    }
    const t = merged.get(key);
    for (const e of ends) if (!t.ends.some((x) => x.uuid === e.uuid && x.canonical === e.canonical)) t.ends.push(e);
  }
  return [...merged.values()].sort((a, b) => b.steps.length - a.steps.length || a.ids.join().localeCompare(b.ids.join()));
}
// a chain's first entry and steps in question, as marks for a list row
const insightPills = (t) => [
  t.ins?.weakOrigin ? el("span", { class: "pill warn-pill", title: `its first entry's Evidence is ${t.ins.weakOrigin}: where later entries depend on it, they depend on a reason nobody confirmed` }, `starts ${t.ins.weakOrigin}`) : null,
  t.ins?.shaky.length ? el("span", { class: "pill warn-pill", title: t.ins.shaky.map((x) => `step ${x.i + 1}: ${x.why}`).join("\n") + `\n${t.ins.affected.length} later ${t.ins.affected.length === 1 ? "step is" : "steps are"} linked after it` }, "step in question") : null,
];
const span = (t) => (t.ins?.from ? (t.ins.from === t.ins.to ? t.ins.from : `${t.ins.from} → ${t.ins.to}`) : "");
const shortLabel = (n) => { const t = (n?.label || "").replace(/`/g, ""); return t.length > 34 ? t.slice(0, 32) + "…" : t; };
// the thoughts an entry is a step of, with its place in each
function entryThoughts(e) {
  const g = familyGraphShown() && fgraph && Date.now() - fgraph.at < 30000 ? fgraph : graph && !e.project ? graph : buildGraph(e.project || null);
  const same = (n) => n.entry === e || (e.uuid && n.entry?.uuid === e.uuid);
  const all = graphChains(g), min = thoughtMin(all);
  return all.filter((t) => t.steps.length >= min || t.ends.length).map((t) => ({ t, i: t.steps.findIndex(same) })).filter((x) => x.i >= 0);
}
// the thoughts (at least the chosen number of entries, drawn down to the longest chain here), and
// the shorter chains that go on beyond this page
function graphThoughts(g) {
  const all = graphChains(g), min = thoughtMin(all);
  return { all, thoughts: all.filter((t) => t.steps.length >= min), open: all.filter((t) => t.ends.length && t.steps.length < min) };
}
// Following a chain: a click loads exactly the repositories a chain goes on
// into, each as a unit, and again from there, until the chain ends, reaches a
// repository without a published export, or eight hops. Only what lies on the
// chain is loaded, not its friends; it is drawn like a friend, marked as
// reached through a thought.
const CHAIN = { extra: new Map(), tried: new Set(), busy: false }; // canonical key -> { canonical, uuids }
const graphNow = async () => (familyGraphShown() ? buildFamilyGraph() : buildGraph());
async function loadEnds(ends) {
  const own = new Set([fkey(canonicalOf(SELF?.project)), ...((fgraph?.groups || []).map((G) => fkey(G.canonical)))]);
  const fresh = [];
  for (const x of ends) {
    const k = fkey(x.canonical);
    if (own.has(k) || CHAIN.tried.has(`${k}|${x.uuid}`)) continue;
    CHAIN.tried.add(`${k}|${x.uuid}`);
    if (!CHAIN.extra.has(k)) CHAIN.extra.set(k, { canonical: x.canonical, uuids: [] });
    const f = CHAIN.extra.get(k); if (!f.uuids.includes(x.uuid)) f.uuids.push(x.uuid);
    if (!fresh.includes(f)) fresh.push(f);
  }
  await Promise.all(fresh.map(loadFriend));
  return fresh.length;
}
async function followChains(pick) {
  if (CHAIN.busy) return;
  CHAIN.busy = true; render();
  try {
    for (let hop = 0; hop < 8; hop++) {
      if (fgraph) fgraph.at = 0;
      const ends = pick(await graphNow());
      if (!ends.length || !(await loadEnds(ends))) break;
    }
  } finally { CHAIN.busy = false; if (fgraph) fgraph.at = 0; render(); }
}
// ---------------------------------------------------------------- globe
// The globe: from what the page has loaded, every repository cited outside it, in waves — hop 1 is what the
// loaded entries cite, hop 2 what those cite, and so on, up to ten — each wave asked for with its count, since
// the next wave can only be counted once the last one is in. Optionally the registry: every project listed
// in keepthewhy.com's registry, loaded as a wave of its own. Nothing of this is kept per browser: every load
// from another host is a click, and a reload starts without it.
const REGISTRY_URL = "https://keepthewhy.com/registry/index.json";
const GLOBE = { view: false, hops: 0, extra: new Map(), failed: new Map(), busy: false, registry: false, registryUrl: REGISTRY_URL, done: 0, log: [] }; // failed: canonical key -> { canonical, error, hop }
function loadedCanonicals() {
  // what the page shows beside the project — not everything it ever fetched: a repository dropped from the
  // globe (clear, the registry switched off) is offered again, its state coming from memory
  const out = new Set([fkey(canonicalOf(S?.project))]);
  for (const m of familyMembers()) out.add(fkey(m.canonical));
  for (const t of TRAIL) out.add(fkey(t.canonical));
  const unit = (k) => { const r = FRIENDS.loaded[k]; if (r?.state) { out.add(k); for (const m of r.members || []) out.add(fkey(m.canonical)); } };
  if (FRIENDS.on) for (const f of graph?.friends || fgraph?.friends || []) unit(fkey(f.canonical));
  for (const k of CHAIN.extra.keys()) unit(k);
  for (const k of GLOBE.extra.keys()) unit(k);
  return out;
}
// what the loaded entries cite outside everything loaded — the next wave
function globeCandidates() {
  const have = loadedCanonicals(); const out = new Map();
  const scan = (entries) => { for (const e of entries || []) for (const x of entryRefs(e)) { if (!x.remote) continue; const k = fkey(x.remote); if (have.has(k) || FRIENDS.loaded[k]?.error) continue; if (!out.has(k)) out.set(k, { canonical: x.remote.replace(/\/+$/, ""), uuids: new Set() }); out.get(k).uuids.add(x.uuid); } };
  // from what is drawn — the project, its family, the path's steps, the units beside it — not from everything
  // ever fetched: a project walked away from is not where the next hop starts
  scan(S?.entries); for (const m of familyMembers()) scan(m.state?.entries);
  if (pathShown()) for (const t of TRAIL) scan(t.state?.entries);
  if (graph) for (const u of friendUnits(graph)) for (const m of u.members) scan(m.state?.entries);
  return [...out.values()].map((c) => ({ ...c, uuids: [...c.uuids] }));
}
// a small dialog in the page: what would load, how many files, yes or no
function globeDialog({ title, lines, note }) {
  return new Promise((resolve) => {
    const close = (v) => { box.remove(); resolve(v); };
    const box = el("div", { class: "globe-dialog" }, el("div", { class: "globe-card" },
      el("h3", {}, title), note ? el("p", { class: "note" }, note) : null,
      el("div", { class: "globe-list" }, ...lines.map((l) => el("div", {}, l))),
      el("div", { class: "globe-actions" }, el("button", { type: "button", class: "link-btn", onclick: () => close(false) }, "no, stop here"), el("button", { type: "button", class: "primary", onclick: () => close(true) }, "load them"))));
    document.body.append(box);
  });
}
async function globeRun(hops) {
  if (GLOBE.busy) return;
  GLOBE.busy = true; render();
  try {
    for (let hop = GLOBE.done + 1; hop <= hops; hop++) {
      const cands = globeCandidates();
      if (!cands.length) { GLOBE.log.push(`hop ${hop}: nothing left to load — the web ends here`); break; }
      const yes = await globeDialog({ title: `Hop ${hop}: ${plural(cands.length, "repository")}`, note: `${plural(cands.length * 2, "file")} — a .keep-the-why and a state.json each${FRIEND_FAMILIES ? ", plus their families, if any (friends families is on)" : ""} — from their hosts, in the browser.`, lines: cands.map((c) => `${repoLabel(c.canonical)} — cited by ${plural(c.uuids.length, "entry")}`) });
      if (!yes) break;
      await Promise.all(cands.map(loadFriend));
      let ok = 0; for (const c of cands) { const k = fkey(c.canonical); const r = FRIENDS.loaded[k]; if (r?.state) { GLOBE.extra.set(k, { ...c, hop }); GLOBE.failed.delete(k); ok++; } else GLOBE.failed.set(k, { canonical: c.canonical, error: r?.error || "could not be loaded", hop }); }
      GLOBE.done = hop; GLOBE.log.push(`hop ${hop}: ${ok} of ${cands.length} loaded`);
      globeRefit();
      if (fgraph) fgraph.at = 0; render();
    }
  } finally { GLOBE.busy = false; if (fgraph) fgraph.at = 0; render(); }
}
async function globeRegistry() {
  if (GLOBE.busy) return;
  GLOBE.busy = true; render();
  try {
    const idx = JSON.parse(await fetchForeign(GLOBE.registryUrl));
    const have = loadedCanonicals();
    // a project that failed before is offered again — much of that is temporary; its old error is forgotten for the try
    const list = (idx.projects || []).filter((p) => p.canonical && !have.has(fkey(p.canonical)));
    for (const p of list) { const k = fkey(p.canonical); if (FRIENDS.loaded[k]?.error) { delete FRIENDS.loaded[k]; delete FRIENDS.pending[k]; delete PUBLIC_STATES[`${p.canonical}|`]; } }
    if (!list.length) { GLOBE.log.push("registry: everything listed is already here"); GLOBE.registry = true; return; }
    const yes = await globeDialog({ title: `The registry: ${plural(list.length, "project")}`, note: `${plural(list.length * 2, "file")} — a .keep-the-why and a state.json each${FRIEND_FAMILIES ? ", plus their families, if any" : ""} — from their hosts, in the browser. The registry is ${GLOBE.registryUrl}, checked ${idx.checked || "—"}.`, lines: list.map((p) => `${repoLabel(p.canonical)}${p.id ? ` — ${p.id}` : ""}${p.entries != null ? ` · ${plural(p.entries, "entry")}` : ""}${p.failed_since ? ` · not answering since ${p.failed_since}, tried anyway` : ""}${p.cors === false ? " · served without a CORS header — a browser will likely be refused" : ""}`) });
    if (!yes) return;
    const cands = list.map((p) => ({ canonical: p.canonical, uuids: [] }));
    await Promise.all(cands.map(loadFriend));
    let ok = 0; for (const c of cands) { const k = fkey(c.canonical); const r = FRIENDS.loaded[k]; if (r?.state) { GLOBE.extra.set(k, { ...c, hop: 0, registry: true }); GLOBE.failed.delete(k); ok++; } else GLOBE.failed.set(k, { canonical: c.canonical, error: r?.error || "could not be loaded", hop: "registry" }); }
    GLOBE.registry = true; GLOBE.log.push(`registry: ${ok} of ${list.length} loaded`);
    globeRefit();
  } catch (err) { GLOBE.log.push(`registry: could not be read (${err?.message || "network"})`); }
  finally { GLOBE.busy = false; if (fgraph) fgraph.at = 0; render(); }
}
// The way into the globe: what it does, and that nothing loads by itself — the graph starts as the project
// alone and grows only by a choice. "Don't show this again" is kept per browser, a convenience and nothing more.
let GLOBE_INTRO_SHOWN = false;
const globeIntroOff = () => { try { return localStorage.getItem("ktw-globe-intro") === "off"; } catch { return false; } };
function globeIntro() {
  if (GLOBE_INTRO_SHOWN || globeIntroOff() || !GLOBE.view) return;
  GLOBE_INTRO_SHOWN = true;
  const never = el("input", { type: "checkbox" });
  const close = () => { if (never.checked) { try { localStorage.setItem("ktw-globe-intro", "off"); } catch {} } box.remove(); };
  const box = el("div", { class: "globe-dialog globe-intro", onclick: (ev) => { if (ev.target === box) close(); } }, el("div", { class: "globe-card" },
    el("h3", {}, "🌐 The globe"),
    el("p", {}, "This project's graph, full width — and from here as far out as you choose. Nothing loads by itself: the graph grows only when you ask, with the controls at the top left."),
    el("div", { class: "globe-list" },
      el("p", {}, el("b", {}, "Hops"), " — choose 1 to 10, then ", el("i", {}, "go"), ". Hop 1 is every repository the drawn entries cite beyond what the graph shows, hop 2 what those cite, and so on. Before each wave a dialog lists the repositories and files it would fetch; you load them or stop there. ", el("i", {}, "0 hops"), " — the default — shows what the graph shows: the project with its family and friends, as their switches have them; going back to it drops the waves."),
      el("p", {}, el("b", {}, "registry"), " — every project listed in the Keep the Why registry (keepthewhy.com/registry), loaded as a wave of its own, asked for the same way: projects that cite nothing of yours, and the ones that cite you. The ⓘ beside it says how a project gets listed."),
      el("p", {}, el("b", {}, "clear"), " drops what the globe loaded; friends, family and path stay.")),
    el("div", { class: "globe-actions" }, el("label", { class: "note", style: "margin-right:auto" }, never, " don't show this again"), el("button", { type: "button", class: "primary", onclick: close }, "got it"))));
  document.body.append(box);
}
// what a wave brought in may lie outside the view: frame the whole graph again, whatever the reader had moved
function globeRefit() { for (const x of [graph, fgraph]) if (x) { x.userMoved = false; x.alpha = Math.max(x.alpha, 0.5); } }
function globeClear() { globeRefit(); GLOBE.extra.clear(); GLOBE.failed.clear(); GLOBE.done = 0; GLOBE.registry = false; GLOBE.log = []; if (fgraph) fgraph.at = 0; render(); }
function globeUi(g) {
  if (!GLOBE.view) return null;
  const sel = el("select", { title: "how many hops out from what is loaded — each wave is asked for with its count", onchange: (ev) => { GLOBE.hops = Number(ev.target.value); if (GLOBE.hops === 0) globeClear(); else render(); } }, ...Array.from({ length: 11 }, (_, i) => el("option", { value: String(i), selected: i === GLOBE.hops }, `${i} hop${i === 1 ? "" : "s"}`)));
  const go = el("button", { type: "button", class: "link-btn", disabled: GLOBE.busy || GLOBE.hops <= GLOBE.done, title: "load the next waves, one asked after the other", onclick: () => globeRun(GLOBE.hops) }, GLOBE.busy ? "loading…" : GLOBE.done ? `go on (${GLOBE.done} done)` : "go");
  const reg = el("label", { title: `every project listed in the registry — ${GLOBE.registryUrl}` }, el("input", { type: "checkbox", checked: GLOBE.registry, disabled: GLOBE.busy, onchange: (ev) => { if (ev.target.checked) globeRegistry(); else { for (const [k, f] of GLOBE.extra) if (f.registry) GLOBE.extra.delete(k); GLOBE.registry = false; render(); } } }), "registry");
  // an ⓘ beside the switch: what the registry is, and that one line in a pull request puts a project on it
  const info = el("span", { class: "globe-info", tabindex: "0" }, "ⓘ",
    el("span", { class: "globe-info-box" },
      el("b", {}, "The registry"),
      el("p", {}, "A list of repositories with a published Keep the Why dashboard export, kept in the keep-the-why repository and built into an index the globe can load as a wave of its own. Nothing needs it: the globe finds repositories by their citations. The registry is for being found from a project that cites nothing of yours — and for seeing who cites you."),
      el("p", {}, "To be listed, open a pull request that adds one line to ", el("code", {}, "registry/projects.txt"), ": your repository's canonical URL. A workflow follows its ", el("code", {}, ".keep-the-why"), " to the ", el("code", {}, "dashboard-state"), " export and checks that the export names your repository — move the export later and the listing follows. A family is listed by its root project: its members come with it through their parent/children lines (with friends families on)."),
      el("p", {}, el("a", { href: "https://keepthewhy.com/registry/", target: "_blank", rel: "noopener" }, "keepthewhy.com/registry"), " · ", el("a", { href: "https://github.com/oliver-zehentleitner/keep-the-why/blob/main/registry/projects.txt", target: "_blank", rel: "noopener" }, "registry/projects.txt on GitHub"))));
  const clear = GLOBE.extra.size ? el("button", { type: "button", class: "link-btn", title: "drop everything the globe loaded; friends, family and path stay", onclick: globeClear }, "clear") : null;
  return el("span", { class: "ui-group globe-ctl" }, el("a", { class: "globe-mark", href: "https://keepthewhy.com/registry/", target: "_blank", rel: "noopener", title: "the registry — what the globe can load, and how to be listed" }, "🌐"), sel, go, reg, info, clear);
}
const followAll = () => followChains((g) => { const t = graphThoughts(g); return [...t.thoughts, ...t.open].flatMap((c) => c.ends); });
// one chain, found again after each hop by its newest entry's Id
function followThought(t, then) {
  const anchor = t.anchor || t.steps[t.steps.length - 1].entry.uuid;
  let last = null;
  return followChains((g) => { last = graphChains(g).filter((c) => c.steps.some((n) => n.entry.uuid === anchor)).sort((a, b) => b.steps.length - a.steps.length)[0] || null; return last ? last.ends : []; })
    .then(() => then?.(last));
}
let THOUGHT_PIN = null; // the ids of the held thought, joined
// One step pointed at — in a thought's list of steps, in the reader, on the
// Thoughts page — is marked in every graph on the page.
let STEP_FOCUS = null; // an entry's Id (or node id)
const ACTIVE_GRAPHS = new Set();
function focusStep(ref) { STEP_FOCUS = ref || null; for (const g of ACTIVE_GRAPHS) g.wake?.(); STAGE?.wake?.(); }
const stepHover = (ref) => ({ onmouseenter: () => focusStep(ref), onmouseleave: () => focusStep(null) });
function lightThought(g, t) {
  g.thought = t ? { nodes: new Set(t.steps), pairs: new Set(t.ids.slice(1).map((id, i) => `${id}|${t.ids[i]}`)) } : null;
  g.alpha = Math.max(g.alpha, 0.02); g.wake?.(); STAGE?.wake?.();
}
// the thought being read (#thought/…) is held in every graph shown beside it, however the reader was reached —
// read › without a click first, a link, a reload — the same as a thought clicked and then read
function holdReading(g) {
  if (!g || !location.hash.startsWith("#thought/")) return;
  const t = graphThoughts(g).all.find((x) => thoughtHref(x) === location.hash);
  if (!t) return;
  THOUGHT_PIN = t.ids.join("|");
  lightThought(g, t);
}
function renderThoughts(g) {
  const box = $("#thoughts");
  if (!box || !g) return;
  const { all, thoughts: list, open } = graphThoughts(g);
  const short = (n) => { const t = (n?.label || "").replace(/`/g, ""); return t.length > 34 ? t.slice(0, 32) + "…" : t; };
  const held = [...list, ...open].find((t) => t.ids.join("|") === THOUGHT_PIN) || null;
  lightThought(g, held);
  const minSeg = thoughtMinSeg(all, () => { THOUGHT_PIN = null; renderThoughts(g); });
  const repos = (ends) => [...new Set(ends.map((e) => repoLabel(e.canonical)))];
  const row = (t) => {
    const key = t.ids.join("|"); const on = key === THOUGHT_PIN;
    return el("div", { class: `thought ${on ? "on" : ""} ${t.ends.length ? "open" : ""}` },
      el("button", { type: "button", class: "thought-head", title: t.steps.map((n) => n.label).join("\n→ ") + (t.ends.length ? `\n… goes on in ${repos(t.ends).join(", ")}` : ""),
        onmouseenter: () => lightThought(g, t), onmouseleave: () => lightThought(g, held), // a held thought gives way while another is pointed at, and comes back
        onclick: () => { THOUGHT_PIN = on ? null : key; renderThoughts(g); } },
        el("span", { class: "count" }, String(t.steps.length)), `${short(t.steps[0])} → ${short(t.steps[t.steps.length - 1])}`, t.evolution ? el("span", { class: "pill" }, "evolution") : null, ...insightPills(t)),
      el("a", { class: "thought-read", href: thoughtHref(t), title: "read the whole thought — every entry in order, in full" }, "read ›"),
      t.ends.length ? el("button", { type: "button", class: "thought-follow link-btn", disabled: CHAIN.busy, title: `load the repositories this chain goes on into — ${repos(t.ends).join(", ")} — hop by hop, until it ends`, onclick: () => followThought(t) }, `continues ↗ ${repos(t.ends).join(", ")}`) : null,
      on ? el("ol", { class: "thought-steps" }, t.steps.map((n) => el("li", stepHover(n.entry?.uuid || n.id), el("a", { href: n.href, onclick: (ev) => { if (n.entry && STAGE?.pick && location.hash.startsWith("#timeline")) { ev.preventDefault(); STAGE.pick(n.entry); } } }, n.label.replace(/`/g, ""))))) : null);
  };
  const openEnds = [...list, ...open].flatMap((t) => t.ends);
  const followBtn = openEnds.length ? el("button", { type: "button", class: "link-btn thought-follow-all", disabled: CHAIN.busy, title: "load every repository the chains here go on into, hop by hop — nothing else", onclick: followAll }, CHAIN.busy ? "loading the chains…" : `load the whole chains (${repos(openEnds).length} ${repos(openEnds).length === 1 ? "repository" : "repositories"})`) : null;
  const head = list.length
    ? [el("h3", {}, `Thoughts (${list.length}) `, minSeg), el("p", { class: "note" }, "Chains of linked entries — See and Superseded by — first entry first. Point at one to light its path, click to hold it.")]
    : [el("h3", {}, "Thoughts ", minSeg), el("p", { class: "note" }, "No chain of linked entries in this graph yet — a thought is a chain of See or Superseded by, each entry citing the one before.")];
  setKids(box, ...head, followBtn, ...list.map(row),
    open.length ? el("h3", { class: "thought-open-head" }, `Going on beyond this page (${open.length})`) : null,
    open.length ? el("p", { class: "note" }, "Shorter chains that continue in a repository this page has not loaded — loading it may make them thoughts.") : null,
    ...open.map(row));
}
function friendsLegend(g) {
  if (!FRIENDS.on && !CHAIN.extra.size && !GLOBE.extra.size && !GLOBE.failed.size) return [];
  const out = friendUnits(g).map((u, i) => el("span", { class: "friend", title: `friend: ${u.r.canonical}${u.members.length > 1 ? ` — a family of ${u.members.length}, shown whole` : ""} — its hub shows the entries cited there; a click on its hub or its name goes there` },
    el("i", { class: "dot", style: `background:transparent;border:2px dashed ${friendColor(i)};width:10px;height:10px` }),
    el("a", { href: u.r.open, onclick: (ev) => { if (!u.r.centre) return; ev.preventDefault(); moveTo({ centre: u.r.centre, state: u.r.state }, "#graph"); } }, u.r.name),
    u.members.length > 1 ? el("span", { class: "note" }, ` · family of ${u.members.length}`) : (u.r.members || []).length > 1 ? el("span", { class: "note" }, ` · family of ${u.r.members.length}, not shown`) : null,
    u.via === "chain" ? el("span", { class: "note" }, " · via a thought") : null));
  for (const f of g.friends || []) { const r = FRIENDS.loaded[fkey(f.canonical)]; if (r && !r.state) out.push(el("span", { class: "warn", title: r.error }, `${repoLabel(r.canonical)} not loaded`)); }
  // the globe's waves and the registry: what could not be loaded is named, not dropped — often it is back tomorrow
  if (GLOBE.view) for (const f of GLOBE.failed.values()) out.push(el("span", { class: "warn", title: f.error }, `${repoLabel(f.canonical)} not loaded · ${f.hop === "registry" ? "registry" : `hop ${f.hop}`}`));
  return out;
}
// Every project the graph holds, one line each, from its hub nodes: this project first, then the path's
// steps, the family, the friends with their families — each with the ring the canvas draws for it, the
// name a link that goes there in place. The hubs carry what the legend needs, so what is listed is
// exactly what is drawn.
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
// light a project in every graph on the page — the path bar and the Family view point at projects the way the legend does
function spotProject(canonical) {
  for (const G of ACTIVE_GRAPHS) {
    const hub = canonical ? G.nodes.find((n) => n.kind === "project" && n.canonical && fkey(n.canonical) === fkey(canonical)) : null;
    G.spot = hub ? projectNodes(G, hub) : null; G.alpha = Math.max(G.alpha, 0.02); G.wake?.();
  }
}
function projectsLegend(g) {
  const p = S?.project || {};
  const hubs = g.nodes.filter((n) => n.kind === "project");
  const out = [];
  if (!hubs.some((n) => n.self)) out.push(el("span", { class: "family" }, el("i", { class: "dot", style: "background:var(--accent);width:10px;height:10px" }), el("b", {}, p.id || p.name || "this project")));
  const kind = (n) => (n.self ? "this project" : n.trail ? "a step of the path" : n.chain ? "reached by a thought" : n.citedOnly ? "cites this project — from the registry" : n.friend ? (n.kin ? "a friend's family member" : n.citing ? "a friend that also cites this project" : "a friend") : "family");
  const ring = (n) => (n.self ? `background:${n.color};` : `background:transparent;border:2px ${n.chain ? "dashed" : n.friend ? "dashed" : n.trail ? "dotted" : "solid"} ${n.color};`);
  const units = new Map(friendUnits(g).map((u) => [u.k, u]));
  // the family's shape, from the parent lines the graph draws (child → parent): roots first, children indented
  const parentOf = new Map();
  for (const l of g.links) if (l.kind === "family") { const a = g.nodes[l.s], b = g.nodes[l.t]; if (a?.kind === "project" && b?.kind === "project") parentOf.set(a, b); }
  const ordered = []; const seen = new Set();
  const walk = (n, depth) => { if (seen.has(n)) return; seen.add(n); ordered.push([n, depth]); for (const c of hubs) if (parentOf.get(c) === n) walk(c, depth + 1); };
  for (const n of hubs) if (!parentOf.has(n) || !hubs.includes(parentOf.get(n))) walk(n, 0);
  for (const n of hubs) walk(n, 0); // anything left (a cycle, a parent not drawn)
  for (const [n, depth] of ordered) {
    const name = n.self ? el("b", {}, n.label) : el("a", { href: n.href || "#graph", title: `${kind(n)} — go there`, onclick: (ev) => { if (!n.walk) return; ev.preventDefault(); n.walk(); } }, n.label);
    const u = n.friend && !n.kin ? units.get(n.unit) : null;
    const notShown = u && u.members.length === 1 && (u.r.members || []).length > 1 ? u.r.members.length : 0;
    const forkOf = u?.r.forkOf || null;
    out.push(el("span", { class: n.friend ? "friend" : "family", style: depth ? `padding-left:${depth * 14}px` : "", title: kind(n), onmouseenter: () => { g.spot = projectNodes(g, n); g.alpha = Math.max(g.alpha, 0.02); g.wake?.(); }, onmouseleave: () => { g.spot = null; g.alpha = Math.max(g.alpha, 0.02); g.wake?.(); } }, el("i", { class: "dot", style: `${ring(n)}width:10px;height:10px` }), hostMark(n.canonical), name,
      notShown ? el("span", { class: "note" }, ` · family of ${notShown}, not shown`) : null,
      forkOf ? el("span", { class: "note", title: `the export names ${forkOf} as its canonical and was made in a checkout of ${u.r.canonical}` }, " · fork of ", el("a", { href: forkOf, target: "_blank", rel: "noopener" }, hostMark(forkOf), repoLabel(forkOf))) : null,
      n.hop != null ? el("span", { class: "note" }, n.hop === "registry" ? " · from the registry" : ` · hop ${n.hop}`) : n.chain ? el("span", { class: "note" }, " · via a thought") : null,
      n.citing ? el("span", { class: "note" }, n.citedOnly ? " · cites this project" : " · cites this project too") : null));
  }
  return out;
}
// the path's line, explained where it is drawn: it is the way walked, not a relation between the projects
const pathLegend = (g) => (pathShown() && TRAIL.some((t) => !sameCentreAsGraph(g, t)) ? [el("span", { class: "path-legend", title: "the projects you came through, in the order walked; the line says nothing about how they relate" }, "···› the path — the way you walked here, not a citation")] : []);
function familyLegend(g) {
  if (g !== graph) return [];
  const fam = familyMembers();
  // each member with its ring colour, as the family graph's legend has it; the name goes there
  const out = fam.map((m) => el("span", { class: "family", title: `family: ${m.role || "member"} — its hub shows the entries linked to this project; a click on the name goes there` },
    el("i", { class: "dot", style: `background:transparent;border:2px solid ${m.color || familyColor()};width:10px;height:10px` }),
    el("a", { href: m.open || "#graph", onclick: (ev) => { if (!m.centre) return; ev.preventDefault(); moveTo({ centre: m.centre, state: m.state }, "#graph"); } }, m.name)));
  if (FAMILY_NB.loading) out.push(el("span", { class: "note" }, "loading the family…"));
  if (FAMILY_NB.missing?.length && canFamily()) out.push(el("span", { class: "warn", title: FAMILY_NB.missing.map(({ member: m, reason }) => `${m.name}: ${reason}`).join("\n") }, `${plural(FAMILY_NB.missing.length, "member")} not available here`));
  return out;
}
// the graph's control bar, in groups: this project (entries · labels) · family · friends · path · motion · select / unselect all · reset.
// The same groups serve the side pane's small graph, so every switch is reachable from both.
function graphControlGroups(g, family) {
  const fui = friendsUi(g);
  const famUi = familyUi(g);
  const globe = globeUi(g);
  return [
    globe,
    el("span", { class: "ui-group" }, el("label", {}, el("input", { type: "checkbox", checked: g.showEntries, onchange: (ev) => { g.showEntries = ev.target.checked; setShowEntries(ev.target.checked); g.alpha = 0.5; g.wake?.(); } }), "entries"), labelsUi(g, "project", "this project's topics and entries")),
    famUi ? el("span", { class: "ui-group" }, famUi, FAMILY_NB_ON ? labelsUi(g, "family", "the family's projects") : null) : null,
    fui ? el("span", { class: "ui-group" }, fui) : null,
    citedUi(g),
    el("span", { class: "ui-group" }, el("label", { title: "the path's projects in the graph — the projects you came through; unchecked they are hidden, not forgotten (the path bar discards)" }, el("input", { type: "checkbox", checked: keepPath() && TRAIL_SHOW, onchange: (ev) => { if (ev.target.checked && !keepPath()) setKeepPath(true); setTrailShow(ev.target.checked); if (fgraph) fgraph.at = 0; render(); } }), "path"),
      ...(pathShown() && TRAIL.some((t) => !sameCentreAsGraph(g, t)) ? [allEntriesUi("path", PATH_ENTRIES, setPathEntries, "every step of the path"), labelsUi(g, "path", "the path's projects")] : [])),
    el("span", { class: "ui-group" }, el("label", { title: "the graph turns very slowly; it stops while you point at it" }, el("input", { type: "checkbox", checked: driftOn(), onchange: (ev) => { setDrift(ev.target.checked); g.wake?.(); } }), "motion")),
    el("span", { class: "ui-group" },
      el("button", { class: "link-btn", title: "every switch in this bar on", onclick: () => selectAll(g, true) }, "select all"),
      el("button", { class: "link-btn", title: "every switch in this bar off — the project's topics alone", onclick: () => selectAll(g, false) }, "unselect all")),
    el("span", { class: "ui-group" }, el("button", { class: "link-btn graph-reset", title: "fit the graph and let go of every node you placed", onclick: () => { g.scale = family ? 0.7 : 1; g.ox = 0; g.oy = 0; g.userMoved = false; for (const n of g.nodes) { n.fixed = false; } g.alpha = 1; g.wake?.(); } }, "reset")),
  ].filter(Boolean);
}
let TREE_ASKED = false;
function viewGraph(main) {
  // live: the whole family tree is known before anything counts as a friend — the server's own API, no other host
  if (LIVE() && !TREE && !TREE_ASKED) { TREE_ASKED = true; fetchTree().then((t) => { if (t && /^#(graph|globe)$/.test(location.hash)) render(); }); }
  const family = familyGraphShown();
  const wrap = el("div", { class: "graph-wrap" });
  main.append(wrap);
  const fill = (g) => {
    const canvas = el("canvas");
    const ui = el("div", { class: "graph-ui" }, ...graphControlGroups(g, family));
    const legend = family
      ? el("div", { class: "graph-legend" },
        ...projectsLegend(g),
        el("span", {}, `${plural(g.across, "reference")} across projects`), ...pathLegend(g),
        g.missing.length ? el("span", { class: "warn", title: g.missing.map(({ member: m, reason }) => `${m.name}: ${reason}`).join("\n") }, `${plural(g.missing.length, "member")} not available here`) : null, ...friendsLegend(g).filter((x) => x.classList.contains("warn")))
      : el("div", { class: "graph-legend" },
        el("span", {}, el("i", { class: "dot", style: "background:var(--accent);width:12px;height:12px" }), "topic (size = entries)"),
        el("span", {}, el("i", { class: "dot confirmed" }), "confirmed"), el("span", {}, el("i", { class: "dot inferred" }), "inferred"), el("span", {}, el("i", { class: "dot unknown" }), "unknown"),
        el("span", {}, el("i", { class: "dot", style: "background:transparent;border:1.5px solid var(--fg3)" }), "superseded"),
        el("span", {}, "— reference · ··· membership"), ...pathLegend(g), ...projectsLegend(g), ...familyLegend(g).filter((x) => x.classList.contains("warn") || x.classList.contains("note")), ...friendsLegend(g).filter((x) => x.classList.contains("warn")));
    // on a phone the switches and the legend sit behind two buttons, so the graph gets the screen (CSS shows them there only)
    const toggle = (cls, label, other) => el("button", { type: "button", class: `graph-toggle ${cls}-toggle`, "aria-expanded": "false",
      onclick: (ev) => { const open = wrap.classList.toggle(`${cls}-open`); wrap.classList.remove(`${other}-open`); ev.currentTarget.setAttribute("aria-expanded", String(open)); } }, label);
    wrap.replaceChildren(canvas, ui, legend, ...[pathBar()].filter(Boolean), toggle("ui", "Layers", "legend"), toggle("legend", "Legend", "ui"),
      el("div", { class: "graph-hint" }, family ? "family — a project's name goes there, in place · drag nodes · wheel zoom · drag background to pan" : "drag nodes · wheel zoom · drag background to pan · click to open"),
      el("div", { class: "graph-hint-touch" }, "pinch to zoom · drag to pan · tap to open"));
    // on a phone the graph opens fitted to the screen, also one that settled earlier and was moved then
    if (narrow()) { g.userMoved = false; g.needFit = true; }
    // arriving from the side pane's graph: centred on the entry or topic it showed
    if (GRAPH_CENTER) {
      const c = GRAPH_CENTER; GRAPH_CENTER = null;
      const n = g.nodes.find((x) => (c.entry && x.entry && (x.entry === c.entry || (c.entry.uuid && x.entry.uuid === c.entry.uuid))) || (c.topic && x.kind === "topic" && x.file === c.topic.file));
      if (n) { g.ox = -n.x * g.scale; g.oy = -n.y * g.scale; g.userMoved = true; }
    }
    // the family graph and the globe keep everything in view; on a phone every graph does, until it is touched
    runGraph(canvas, g, { fit: family || GLOBE.view || narrow(), onTouch: () => wrap.classList.remove("ui-open", "legend-open") });
    renderThoughts(g);
  };
  if (!family) return fill(buildGraph());
  if (fgraph && Date.now() - fgraph.at < 30000) return fill(fgraph); // a live update re-renders: no refetch
  wrap.append(el("p", { class: "center" }, "Loading the family…"));
  buildFamilyGraph().then((g) => { if (wrap.isConnected && /^#(graph|globe)$/.test(location.hash) && familyGraphShown()) fill(g); });
}
const go = (href) => { if (href.startsWith("#")) location.hash = href; else location.href = href; };
// The graph turns very slowly in its plane — one turn in about six minutes —
// and stops while it is pointed at, dragged or panned. Off with the system's
// reduced-motion setting, or with *motion* in the graph (kept per browser).
const DRIFT_RATE = (2 * Math.PI) / 360000; // radians per millisecond
// motion: on by default, off on a phone (a turning graph is hard to tap, and it keeps the battery busy); a stored choice wins
let DRIFT = (() => { try { const v = localStorage.getItem("ktw-motion"); return v ? v !== "off" : !narrow(); } catch { return !narrow(); } })();
const reducedMotion = () => { try { return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches; } catch { return false; } };
const driftOn = () => DRIFT && !reducedMotion();
function setDrift(on) { DRIFT = on; try { localStorage.setItem("ktw-motion", on ? "on" : "off"); } catch {} }
// the platform's mark for a hub's name on the canvas, one Path2D per platform
const HOST_PATHS = new Map();
function hostPath(url) {
  const h = hostOf(url); if (!h || typeof Path2D === "undefined") return null;
  if (!HOST_PATHS.has(h.name)) HOST_PATHS.set(h.name, new Path2D(h.path));
  return HOST_PATHS.get(h.name);
}
function runGraph(canvas, g, opts = {}) {
  const mini = !!opts.mini;
  const ctx = canvas.getContext("2d");
  const css = getComputedStyle(document.documentElement);
  const color = (v) => css.getPropertyValue(v).trim();
  let W = 0, H = 0, dpr = window.devicePixelRatio || 1;
  let hover = null, drag = null, pan = null, moved = false;
  const resize = () => { const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  const toWorld = (px, py) => [(px - W / 2 - g.ox) / g.scale, (py - H / 2 - g.oy) / g.scale];
  // zoom limits: never below half of what the fitted view needed — a fixed floor above it made a large family
  // or the globe jump in on the first pinch and refuse to zoom out again
  const minScale = () => Math.min(0.15, (g.fitScale || 0.15) / 2);
  const zoomTo = (ns, px, py) => { ns = Math.min(6, Math.max(minScale(), ns)); const k = ns / g.scale; g.ox = px - (px - g.ox) * k; g.oy = py - (py - g.oy) * k; g.scale = ns; };
  // under the clock an entry is there from the day it was created, a topic from its first entry's day
  const topicAlive = (n) => !CLOCK || g.nodes.some((m) => m.kind === "entry" && m.file === n.file && (m.unit || "") === (n.unit || "") && atClock(m.entry));
  // other repositories (friends, the family, the path) have no day on this page's clock: under it they stay out
  const visible = (n) => (CLOCK && n.ext) ? false : n.kind === "topic" ? topicAlive(n) : n.kind !== "entry" ? true : atClock(n.entry) && (g.showEntries || !!g.thought?.nodes.has(n));
  // a topic-level reference stands in for entry references only while entries are hidden
  const linkOn = (l) => visible(g.nodes[l.s]) && visible(g.nodes[l.t]) && (l.kind !== "xtopic" || !g.showEntries) && linkExistsAt(CLOCK, l.day);
  const dim = (n) => n.kind === "entry" && filterActive() && !matches(n.entry);
  const pick = (px, py) => { const [x, y] = toWorld(px, py); let best = null, bd = 1e9; for (const n of g.nodes) { if (!visible(n)) continue; const d = Math.hypot(n.x - x, n.y - y); if (d < Math.max(n.r + 4, 8) / Math.min(g.scale, 1) && d < bd) { best = n; bd = d; } } return best; };
  // a project's name under its hub is a link: pointed at, underlined; clicked, it goes there
  let hoverName = null, nameDown = null;
  const pickName = (px, py) => { const [x, y] = toWorld(px, py); for (const b of g.nameBoxes || []) if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return b.n; return null; };
  canvas.onmousemove = (ev) => {
    const r = canvas.getBoundingClientRect(); const px = ev.clientX - r.left, py = ev.clientY - r.top;
    if (!drag && !pan) { hoverName = pickName(px, py); if (hoverName) { hover = hoverName; canvas.style.cursor = "pointer"; return; } }
    if (drag) { const [x, y] = toWorld(px, py); drag.x = x; drag.y = y; drag.vx = drag.vy = 0; drag.fixed = true; g.alpha = Math.max(g.alpha, 0.3); moved = true; return; }
    if (pan) { g.ox = pan.ox + (px - pan.px); g.oy = pan.oy + (py - pan.py); moved = true; return; }
    hover = pick(px, py); canvas.style.cursor = hover ? "pointer" : "grab";
  };
  canvas.onmousedown = (ev) => { const r = canvas.getBoundingClientRect(); const px = ev.clientX - r.left, py = ev.clientY - r.top; moved = false; g.userMoved = true; nameDown = pickName(px, py); if (nameDown) return; const n = pick(px, py); if (n) drag = n; else pan = { px, py, ox: g.ox, oy: g.oy }; canvas.classList.add("grabbing"); };
  // a project's hub and its name do the same: go there, in place — the circle used to expand a friend (now the
  // switches' job) or open an overview, and a click on a foreign hub seemed to do nothing. This project's own
  // hub is where the reader already is: a click on it does nothing.
  const walkTo = (n) => (n.self ? null : n.walk ? n.walk() : go(n.href));
  const open = (n) => (n.kind === "project" ? walkTo(n) : n.action ? n.action() : go(n.href));
  window.addEventListener("mouseup", () => { if (nameDown) { const n = nameDown; nameDown = null; walkTo(n); return; } if (drag && !moved) open(drag); drag = null; pan = null; canvas.classList.remove("grabbing"); });
  canvas.onmouseleave = () => { hover = null; hoverName = null; };
  canvas.onwheel = (ev) => { ev.preventDefault(); g.userMoved = true; const r = canvas.getBoundingClientRect(); zoomTo(g.scale * Math.exp(-ev.deltaY * 0.0012), ev.clientX - r.left - W / 2, ev.clientY - r.top - H / 2); };
  canvas.ondblclick = (ev) => { const r = canvas.getBoundingClientRect(); const n = pick(ev.clientX - r.left, ev.clientY - r.top); if (n) { n.fixed = false; g.alpha = 0.4; } };
  // touch: one finger drags a node or pans (full view only), two fingers pinch-zoom around the point between them
  // and pan with it, a tap opens
  let pinch = null;
  const tpos = (t) => { const r = canvas.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; };
  const tdist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
  const tmid = (ts) => { const [ax, ay] = tpos(ts[0]), [bx, by] = tpos(ts[1]); return [(ax + bx) / 2 - W / 2, (ay + by) / 2 - H / 2]; };
  canvas.addEventListener("touchstart", (ev) => {
    g.userMoved = true; opts.onTouch?.();
    if (ev.touches.length === 2) { const [mx, my] = tmid(ev.touches); pinch = { d: tdist(ev.touches) || 1, scale: g.scale, wx: (mx - g.ox) / g.scale, wy: (my - g.oy) / g.scale }; drag = null; pan = null; return; }
    const [px, py] = tpos(ev.touches[0]); moved = false; nameDown = pickName(px, py); if (nameDown) return; const n = pick(px, py);
    if (n) drag = n; else if (!mini) pan = { px, py, ox: g.ox, oy: g.oy };
  }, { passive: true });
  canvas.addEventListener("touchmove", (ev) => {
    if (pinch && ev.touches.length === 2) {
      const [mx, my] = tmid(ev.touches); const ns = Math.min(6, Math.max(minScale(), pinch.scale * (tdist(ev.touches) / pinch.d)));
      g.scale = ns; g.ox = mx - pinch.wx * ns; g.oy = my - pinch.wy * ns; ev.preventDefault(); return; // the point under the fingers stays under them
    }
    if (!ev.touches.length) return;
    const [px, py] = tpos(ev.touches[0]);
    if (drag) { const [x, y] = toWorld(px, py); drag.x = x; drag.y = y; drag.vx = drag.vy = 0; drag.fixed = true; g.alpha = Math.max(g.alpha, 0.3); moved = true; ev.preventDefault(); }
    else if (pan) { g.ox = pan.ox + (px - pan.px); g.oy = pan.oy + (py - pan.py); moved = true; ev.preventDefault(); }
  }, { passive: false });
  canvas.addEventListener("touchend", (ev) => {
    if (pinch) { if (!ev.touches.length) pinch = null; return; }
    if (nameDown) { const n = nameDown; nameDown = null; if (!moved) walkTo(n); return; }
    if (drag && !moved) open(drag);
    drag = null; pan = null;
  });
  const ev = (n) => n.entry.evidence;
  const evColor = { confirmed: color("--confirmed"), inferred: color("--inferred"), unknown: color("--unknown") };
  let lastT = 0, frame = 0;
  function step(now) {
    const dt = lastT && now ? Math.min(100, now - lastT) : 16; lastT = now || 0;
    const drifting = driftOn() && !hover && !drag && !pan && !pinch;
    if (drifting) { const a = DRIFT_RATE * dt, c = Math.cos(a), sn = Math.sin(a); for (const n of g.nodes) { const x = n.x, y = n.y; n.x = x * c - y * sn; n.y = x * sn + y * c; } if (g === graph && STAGE?.follows?.()) STAGE.wake(); }
    if (g === graph && g.alpha > 0.003 && STAGE?.follows?.()) STAGE.wake(); // settling: the stage settles with it
    // settled and only turning: every other frame is enough
    if (drifting && g.alpha <= 0.003 && (frame++ & 1)) { g.raf = canvas.isConnected ? requestAnimationFrame(step) : null; return; }
    const ns = g.nodes.filter(visible);
    if (g.alpha > 0.003) {
      const k = g.alpha;
      // repulsion
      for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i], b = ns[j]; let dx = b.x - a.x, dy = b.y - a.y; let d2 = dx * dx + dy * dy + 0.01;
        const hubs = a.kind === "project" && b.kind === "project";
        const apart = (a.unit || "") !== (b.unit || ""); // this graph and a friend, or two friends: a family keeps together, strangers keep their distance
        if (d2 > (hubs ? (apart ? 9000000 : 4000000) : apart ? 640000 : 250000)) continue;
        const base = hubs ? (apart ? 70000 : 22000) : a.kind === "entry" && b.kind === "entry" ? 260 : a.kind === "entry" || b.kind === "entry" ? 900 : 2600;
        const rep = (apart && !hubs ? base * 2.5 : base) / d2; const d = Math.sqrt(d2);
        const fx = (dx / d) * rep * k, fy = (dy / d) * rep * k;
        if (!a.fixed) { a.vx -= fx; a.vy -= fy; } if (!b.fixed) { b.vx += fx; b.vy += fy; }
      }
      // springs
      for (const l of g.links) { if (!linkOn(l)) continue; const a = g.nodes[l.s], b = g.nodes[l.t]; const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 0.01; const f = (d - l.len) * (l.kind === "member" || l.kind === "hub" ? 0.05 : l.kind === "family" ? 0.03 : 0.02) * k; const fx = (dx / d) * f, fy = (dy / d) * f; if (!a.fixed) { a.vx += fx; a.vy += fy; } if (!b.fixed) { b.vx -= fx; b.vy -= fy; } }
      // gravity + integrate
      for (const n of ns) { if (n.fixed) continue; const gr = n.ext ? 0.0015 : 0.004; n.vx -= n.x * gr * k; n.vy -= n.y * gr * k; n.vx *= 0.82; n.vy *= 0.82; n.x += n.vx; n.y += n.vy; }
      g.alpha *= 0.985;
    }
    // keep the canvas framed on the nodes while they settle: the small one always, the family graph until the person moves it
    if ((mini || ((opts.fit || g.needFit) && !g.userMoved)) && (g.alpha > 0.01 || g.needFit) && W && H) {
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (const n of ns) { minX = Math.min(minX, n.x - n.r); maxX = Math.max(maxX, n.x + n.r); minY = Math.min(minY, n.y - n.r); maxY = Math.max(maxY, n.y + n.r + 18); }
      const pad = mini || narrow() ? 60 : 140;
      if (ns.length) { const sw = Math.max(80, maxX - minX + pad), sh = Math.max(80, maxY - minY + pad); g.scale = Math.min(mini ? 2.2 : 1.2, Math.min(W / sw, H / sh)); g.fitScale = g.scale; g.ox = -((minX + maxX) / 2) * g.scale; g.oy = -((minY + maxY) / 2) * g.scale; }
      g.needFit = false;
    }
    // draw
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2 + g.ox, H / 2 + g.oy); ctx.scale(g.scale, g.scale);
    const th = g.thought;
    const sp = th ? null : g.spot; // a project pointed at in the legend: its nodes stay, the rest fades
    const focus = th || sp ? null : hover || (opts.focusId && g.index[opts.focusId] != null ? g.nodes[g.index[opts.focusId]] : null) || (!mini && selected ? g.nodes[g.index[`e:${selected}`]] : null);
    const neigh = new Set(); if (focus) { neigh.add(focus); for (const l of g.links) { if (!linkOn(l)) continue; if (g.nodes[l.s] === focus) neigh.add(g.nodes[l.t]); if (g.nodes[l.t] === focus) neigh.add(g.nodes[l.s]); } }
    if (th) for (const n of th.nodes) neigh.add(n);
    if (sp) for (const n of sp) neigh.add(n);
    const stepNode = STEP_FOCUS ? ns.find((n) => n.kind === "entry" && (n.entry?.uuid === STEP_FOCUS || n.id === STEP_FOCUS)) : null;
    if (stepNode) neigh.add(stepNode);
    const onThought = (l) => !!th && (l.kind === "see" || l.kind === "superseded") && (th.pairs.has(`${g.nodes[l.s].id}|${g.nodes[l.t].id}`) || th.pairs.has(`${g.nodes[l.t].id}|${g.nodes[l.s].id}`));
    const LW = { topic: 1.6, ref: 1, family: 2.6, see: 1.5, xtopic: 1.5, superseded: 1.3, trail: 1.4 };
    const DASH = { member: [2, 3], hub: [2, 3], family: [9, 6], superseded: [5, 4], trail: [2, 6] };
    for (const l of g.links) {
      if (!linkOn(l)) continue;
      const a = g.nodes[l.s], b = g.nodes[l.t]; const hi = (focus && (a === focus || b === focus)) || onThought(l) || (sp && sp.has(a) && sp.has(b));
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.lineWidth = (LW[l.kind] || 0.6) / g.scale; ctx.setLineDash((DASH[l.kind] || []).map((v) => v / g.scale));
      const base = l.kind === "see" || l.kind === "xtopic" ? (l.color || color("--accent2")) : l.kind === "superseded" || l.kind === "family" || l.kind === "trail" ? color("--fg3") : color("--line");
      ctx.strokeStyle = hi ? (l.kind === "see" || l.kind === "xtopic" ? color("--fg") : color("--accent2")) : base; ctx.globalAlpha = (focus || th || sp) && !hi ? (th ? 0.12 : 0.25) : l.kind === "see" || l.kind === "xtopic" ? 0.85 : 1; if (onThought(l)) ctx.lineWidth = 3 / g.scale; ctx.stroke();
      // the path is the way walked, not a citation: an arrow at its middle points the way it went, toward where the reader is now
      if (l.kind === "trail") {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, ang = Math.atan2(b.y - a.y, b.x - a.x), s = 9 / g.scale;
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
      if (n.kind === "project") { ctx.fillStyle = color("--bg"); ctx.fill(); ctx.lineWidth = 3.5 / g.scale; ctx.strokeStyle = n.color; if (n.chain) ctx.setLineDash([8 / g.scale, 3 / g.scale, 2 / g.scale, 3 / g.scale]); else if (n.friend) ctx.setLineDash([5 / g.scale, 3 / g.scale]); else if (n.trail) ctx.setLineDash([1.5 / g.scale, 3 / g.scale]); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 0.38, 0, Math.PI * 2); ctx.fillStyle = n.color; ctx.fill(); }
      else if (n.kind === "topic") { ctx.fillStyle = n.color || color("--accent"); ctx.fill(); }
      else { const st = statusNow(n.entry); const sup = st === "superseded"; ctx.fillStyle = sup ? color("--bg") : evColor[ev(n)] || color("--muted"); ctx.fill(); if (sup) { ctx.lineWidth = 1.2 / g.scale; ctx.strokeStyle = evColor[ev(n)] || color("--fg3"); ctx.stroke(); } if (st === "open" || st === "needs-review" || st === "pending-confirmation") { ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 2.5 / g.scale, 0, Math.PI * 2); ctx.lineWidth = 1.2 / g.scale; ctx.strokeStyle = color(`--${st}`); ctx.stroke(); } }
      if (n === focus) { ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 4 / g.scale, 0, Math.PI * 2); ctx.lineWidth = 1.5 / g.scale; ctx.strokeStyle = color("--fg"); ctx.stroke(); }
      if (n === stepNode) { ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 7 / g.scale, 0, Math.PI * 2); ctx.lineWidth = 3 / g.scale; ctx.strokeStyle = color("--accent2"); ctx.stroke(); ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 12 / g.scale, 0, Math.PI * 2); ctx.lineWidth = 1 / g.scale; ctx.stroke(); }
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
        const hubName = n.kind === "project";
        if (sp) { if (!sp.has(n)) continue; if (!hubName && n.kind !== "topic" && !(g.scale > 1.6)) continue; } // a spotted project: its names alone
        if (!hubName && !anyLabels && !sp) continue;
        const lab = sp ? true : g.showLabels && labelsOn(n);
        const show = sp || n === stepNode || (th && th.nodes.has(n)) ? true : hubName ? true : n.kind === "topic" ? (mini ? neigh.has(n) || n === focus || g.nodes.filter((x) => x.kind === "topic").length <= 12 : lab || neigh.has(n)) : (focus && (neigh.has(n) || n === focus)) || (!mini && lab && g.scale > 1.6);
        if (!show) continue;
        const faded = (focus || th) && !neigh.has(n) && n !== focus; if (faded && !hubName) continue;
        const must = n === focus || n === stepNode || n === hoverName || (th && th.nodes.has(n));
        const rank = must ? 0 : faded ? 5 : focus && neigh.has(n) ? 1 : hubName ? (n.self ? 2 : 3) : n.kind === "topic" ? 4 : 6;
        cand.push({ n, hubName, faded, must, rank });
      }
      cand.sort((a, b) => a.rank - b.rank || b.n.r - a.n.r);
      const placed = [], maxLen = narrow() ? 32 : 48, pad = 2 / g.scale;
      const free = (b) => !placed.some((p) => b.x0 < p.x1 + pad && b.x1 > p.x0 - pad && b.y0 < p.y1 + pad && b.y1 > p.y0 - pad);
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (const { n, hubName, faded, must } of cand) {
        ctx.font = hubName ? `600 ${(mini ? 12 : 13) / g.scale}px ${color("--font") || "sans-serif"}` : `${(mini ? 11 : 12) / g.scale}px ${color("--font") || "sans-serif"}`;
        const lbl = n.label.replace(/`/g, ""); const txt = lbl.length > maxLen ? lbl.slice(0, maxLen - 2) + "…" : lbl;
        const mark = hubName ? hostPath(n.canonical) : null; const iw = mark ? (mini ? 12 : 13) / g.scale : 0; const gap = mark ? 4 / g.scale : 0;
        const tw = ctx.measureText(txt).width; const y = n.y + n.r + 3 / g.scale;
        const left = n.x - (tw + iw + gap) / 2; const tx = left + iw + gap + tw / 2; // the mark before the name, the pair centred
        const box = { x0: left - 3 / g.scale, y0: y - 1 / g.scale, x1: tx + tw / 2 + 3 / g.scale, y1: y + 15 / g.scale };
        if (!must && !free(box)) continue;
        placed.push(box);
        ctx.fillStyle = color("--bg"); ctx.globalAlpha = faded ? 0.4 : 0.75; ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, 15 / g.scale); ctx.globalAlpha = faded ? 0.5 : 1;
        ctx.fillStyle = n.kind === "entry" ? color("--fg2") : hubName && n === hoverName ? color("--accent2") : color("--fg"); ctx.fillText(txt, tx, y);
        if (mark) { ctx.save(); ctx.translate(left, y + 0.5 / g.scale); ctx.scale(iw / 24, iw / 24); ctx.fill(mark); ctx.restore(); }
        if (hubName) {
          g.nameBoxes.push({ n, ...box });
          if (n === hoverName) { ctx.fillRect(tx - tw / 2, y + 14 / g.scale, tw, 1 / g.scale); }
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    if (!canvas.isConnected) { ro.disconnect(); g.raf = null; ACTIVE_GRAPHS.delete(g); return; }
    const busy = g.alpha > 0.003 || drag || pan || pinch || hover || driftOn();
    g.raf = busy ? requestAnimationFrame(step) : null; // idle: no frames until something happens
  }
  const wake = () => { if (!g.raf && canvas.isConnected) g.raf = requestAnimationFrame(step); };
  ACTIVE_GRAPHS.add(g);
  for (const evn of ["mousemove", "mousedown", "wheel", "dblclick", "touchstart", "touchmove", "mouseleave"]) canvas.addEventListener(evn, wake, { passive: true });
  window.addEventListener("mouseup", wake);
  g.wake = wake;
  ro.observe(canvas); // re-observe after the resize handler above; a resize wakes the loop
  const ro2 = new ResizeObserver(() => { resize(); if (g.alpha < 0.05) g.alpha = 0.05; wake(); }); ro2.observe(canvas);
  if (g.raf) cancelAnimationFrame(g.raf);
  g.raf = requestAnimationFrame(step);
}

// ---------------------------------------------------------------- timeline (SVG)
const PALETTE = ["#835bec", "#4aa3df", "#4fbf7a", "#e0a83a", "#e0574f", "#d66fd6", "#3fbfbf", "#b0b04a", "#ff8c5a", "#8b8b98"];
const authorColor = (name) => PALETTE[Math.max(0, S.authors.findIndex((a) => a.name === name)) % PALETTE.length];
// The playhead and the stage. The timeline owns the clock: the slider, the play button, the keys and a
// wheel over the stage set it, and every graph on the page follows it (setClock). The stage is a
// perspective view of the same entries: time runs into the depth — the day shown is the near plane, what
// came before recedes behind it, what a day brings arrives at the front — one lane per topic across the
// width, an entry a card in its lane with the graph's colours (Evidence fills, Status rings), the See and
// Superseded by lines between cards from the day they were written. Plain canvas, projected by hand:
// three numbers per point, no library. #timeline/<day> opens the page on that day.
const PLAY = { on: false, speed: 7, raf: null, last: 0, acc: 0, frac: 0 }; // speed: days per second; frac: the part of a day between two whole ones, for the stage's motion
const SPEEDS = [[1 / 24, "1 hour /s"], [1, "1 day /s"], [7, "1 week /s"], [30, "1 month /s"], [120, "4 months /s"]];
let STAGE = null; // the stage on the page: { wake }
let STAGE_LINKS = (() => { try { return localStorage.getItem("ktw-stage-links") || "lit"; } catch { return "lit"; } })(); // "all" | "lit" | "none": the lines between cards
// "graph": a card stands where its node stands in the graph beside, the stage is the graph with time pulled out as depth;
// "topics": a lane per topic across the width. An experiment with a switch, kept per browser.
let STAGE_ARRANGE = (() => { try { return localStorage.getItem("ktw-stage-arrange") || "graph"; } catch { return "graph"; } })();
function setStageArrange(v) { STAGE_ARRANGE = v; try { localStorage.setItem("ktw-stage-arrange", v); } catch {} STAGE?.wake?.(); }
function setStageLinks(v) { STAGE_LINKS = v; try { localStorage.setItem("ktw-stage-links", v); } catch {} STAGE?.wake?.(); }
function stopPlay() { PLAY.on = false; if (PLAY.raf) cancelAnimationFrame(PLAY.raf); PLAY.raf = null; PLAY.last = 0; PLAY.acc = 0; PLAY.frac = 0; }
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
function viewTimeline(main, day) {
  main.append(el("h1", {}, "Timeline"));
  const sub = el("p", { class: "sub" }, "The project day by day. The stage shows what existed on the day shown, the graph beside it the same; the playhead sets the day. The card shows the entry that appeared last by then, or the one clicked on the stage. The bars count the entries by the month their heading first appeared in Git, stacked by author, grey ticks for entries superseded that month.");
  if (!S.project.git?.available) return main.append(el("p", { class: "center" }, "No Git repository — no dates to draw."));
  if (S.project.git.shallow) main.append(el("p", { class: "sub warn" }, "Shallow clone: the history stops at the clone's edge, so every entry older than that appears to start there. Fetch the full history (git fetch --unshallow) for real dates."));
  const created = S.entries.filter((e) => e.git?.created?.date && matches(e));
  const months = {}; const sup = {};
  for (const e of created) { const m = e.git.created.date.slice(0, 7); (months[m] ||= {})[e.git.created.author] = ((months[m] || {})[e.git.created.author] || 0) + 1; }
  for (const e of S.entries) for (const h of e.git?.status_history || []) if (h.status === "superseded" && h.date) sup[h.date.slice(0, 7)] = (sup[h.date.slice(0, 7)] || 0) + 1;
  const keys = Object.keys({ ...months, ...sup }).sort();
  if (!keys.length) return main.append(el("p", { class: "center" }, "Nothing dated yet."));
  // fill gaps, up to this month
  const all = []; let [y, m] = keys[0].split("-").map(Number); const [ey, em] = todayISO().slice(0, 7).split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) { all.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
  const max = Math.max(1, ...all.map((k) => Object.values(months[k] || {}).reduce((a, b) => a + b, 0)));
  // the drawing is as wide as the column beside the card, so its text keeps its size (an SVG scales as a whole)
  const mainW = main.clientWidth || 900; const Wd = Math.max(360, Math.round(narrow() ? mainW - 28 : mainW - 64 - 18 - Math.min(420, Math.max(280, (mainW - 82) * 0.42))));
  const Hd = 130, padL = 34, padB = 32, padT = 10; const colW = (Wd - padL) / all.length; const bw = colW - 2; // a bar spans its month, first day to last, a hair between months
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", `0 0 ${Wd} ${Hd}`);
  const ns = (tag, attrs, text) => { const n = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text != null) n.textContent = text; return n; };
  const axis = ns("g", { class: "axis" }); svg.append(axis);
  const scaleY = (v) => padT + (Hd - padB - padT) * (1 - v / max);
  for (const tick of [0, Math.ceil(max / 2), max]) { axis.append(ns("line", { x1: padL, x2: Wd, y1: scaleY(tick), y2: scaleY(tick) })); axis.append(ns("text", { x: padL - 6, y: scaleY(tick) + 3, "text-anchor": "end" }, tick)); }
  // the clock
  const span = daySpan(S.entries) || { from: `${all[0]}-01`, to: todayISO() };
  const clamp = (d) => (d < span.from ? span.from : d > span.to ? span.to : d);
  const total = Math.max(1, dayDiff(span.from, span.to));
  const monthX = (d) => { const i = all.indexOf(d.slice(0, 7)); if (i < 0) return d < all[0] ? padL : Wd; const dim = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 0)).getUTCDate(); return padL + (i + (Math.min(+d.slice(8, 10), dim) - 1) / dim) * colW + 1; };
  const marker = ns("line", { class: "now", x1: padL, x2: padL, y1: padT, y2: Hd - padB + 14 }); const markerLabel = ns("text", { class: "now-label", x: padL, y: padT + 4, "text-anchor": "start" }, "");
  const listBox = el("div", { class: "entry-list", style: "margin-top:16px" });
  all.forEach((k, i) => {
    const x = padL + i * colW + 1; let yTop = scaleY(0);
    for (const a of S.authors.map((a) => a.name)) { const v = months[k]?.[a]; if (!v) continue; const h = scaleY(0) - scaleY(v); yTop -= h; const rect = ns("rect", { class: "b", x, y: yTop, width: bw, height: h, fill: authorColor(a), rx: 2 }); rect.append(ns("title", {}, `${k} · ${a}: ${v} — click: that month's entries, and the day moves to its end`)); rect.addEventListener("click", () => { listBox.replaceChildren(el("h2", {}, `${k}`), ...created.filter((e) => e.git.created.date.startsWith(k)).map(entryRow)); const last = new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7), 0)).toISOString().slice(0, 10); setDay(clamp(last)); }); svg.append(rect); }
    if (sup[k]) for (let s = 0; s < sup[k]; s++) svg.append(ns("rect", { class: "sup", x: x + s * 5, y: Hd - padB + 6, width: 3, height: 6 }));
    if (all.length <= 18 || i % Math.ceil(all.length / 18) === 0) axis.append(ns("text", { x: x + bw / 2, y: Hd - padB + 22, "text-anchor": "middle" }, k));
  });
  svg.append(marker, markerLabel);
  // the playhead: a slider over the same days, play, speed; the day in the URL (#timeline/<day>) wins, then where the clock was, else today
  const range = el("input", { type: "range", min: 0, max: total, step: 1, class: "playhead-range", title: "the day the page shows — drag, or ← → (a day), shift ← → (a week), space plays" });
  const dayLabel = el("b", { class: "playhead-day" }); const counts = el("span", { class: "playhead-counts" });
  const playBtn = el("button", { type: "button", class: "play-btn", title: "play the days — space" });
  const speedSel = el("select", { class: "play-speed", title: "how fast the days pass" }, SPEEDS.map(([v, l]) => el("option", { value: v }, l)));
  speedSel.onchange = () => { PLAY.speed = Number(speedSel.value) || 7; };
  for (const o of speedSel.options) if (Math.abs(Number(o.value) - PLAY.speed) < 1e-9) o.selected = true;
  const upd = () => {
    const d = CLOCK || span.to;
    range.value = dayDiff(span.from, d); dayLabel.textContent = d;
    const x = monthX(d); marker.setAttribute("x1", x); marker.setAttribute("x2", x); markerLabel.setAttribute("x", Math.min(Wd - 64, x + 4)); markerLabel.textContent = d;
    const here = S.entries.filter(atClock); const st = count(here.map((e) => ({ s: statusNow(e) })), "s"); refreshCard();
    setKids(counts, `${plural(here.length, "entry")} by then`, st.active ? ` · ${st.active} active` : "", st.superseded ? ` · ${st.superseded} superseded` : "", (st.open || 0) + (st["needs-review"] || 0) + (st["pending-confirmation"] || 0) ? ` · ${(st.open || 0) + (st["needs-review"] || 0) + (st["pending-confirmation"] || 0)} in question` : "");
    playBtn.textContent = PLAY.on ? "⏸" : "▶"; playBtn.classList.toggle("on", PLAY.on);
    try { history.replaceState(null, "", d === span.to ? "#timeline" : `#timeline/${d}`); } catch {}
  };
  const setDay = (d) => { d = clamp(d); setClock(d); upd(); };
  function play(on) {
    if (on === PLAY.on) return;
    if (!on) { stopPlay(); upd(); return; }
    if ((CLOCK || span.to) >= span.to) setClock(span.from); // at the end: once more from the start
    PLAY.on = true; PLAY.last = 0; PLAY.acc = 0;
    const step = (now) => {
      if (!PLAY.on || !range.isConnected) { stopPlay(); return; }
      const dt = PLAY.last ? Math.min(0.1, (now - PLAY.last) / 1000) : 0; PLAY.last = now;
      PLAY.acc += dt * PLAY.speed;
      const whole = Math.floor(PLAY.acc); PLAY.frac = PLAY.acc - whole;
      if (whole >= 1) { PLAY.acc -= whole; const d = addDays(CLOCK, whole); if (d >= span.to) { setClock(span.to); stopPlay(); upd(); return; } setDay(d); }
      else STAGE?.wake?.();
      PLAY.raf = requestAnimationFrame(step);
    };
    upd(); PLAY.raf = requestAnimationFrame(step);
  }
  playBtn.onclick = () => play(!PLAY.on);
  range.oninput = () => { play(false); setDay(addDays(span.from, Number(range.value))); };
  const jump = (to, title, label) => el("button", { type: "button", class: "play-jump", title, onclick: () => { play(false); setDay(to()); } }, label);
  // the card beside the bars: the entry that appeared last by the day shown, or the one clicked on the stage
  const card = el("div", { class: "stage-card" }); let HELD = null; // the held entry's id, after a click
  const latestEntry = (d) => { let best = null; for (const e of S.entries) { if (!existsAt(e, d)) continue; const c = createdOn(e) || span.to; if (!best || c >= best.c) best = { e, c }; } return best?.e || null; };
  function fillCard(e, held) {
    const d = CLOCK || span.to; const lane = (e.project ? `${e.project} · ` : "") + (topicOf(e.file)?.title || e.file).replace(/`/g, "");
    const body = e.body?.text || ""; const reason = e.body?.reason || ""; const excerpt = (reason ? `Reason: ${reason}` : body).replace(/\s+/g, " ").trim();
    const cut = excerpt.length > 520 ? excerpt.slice(0, 518).replace(/\s\S*$/, "") + "…" : excerpt;
    setKids(card, el("div", { class: "stage-card-head" }, el("span", { class: "note mono" }, `${createdOn(e) || "today"} · ${lane}`), held ? el("button", { type: "button", class: "pill stage-card-held", title: "let go — back to the latest entry by the day shown", onclick: () => STAGE?.close?.() }, "picked ", el("b", {}, "×")) : el("span", { class: "pill" }, "latest by then")),
      el("h3", {}, el("a", { href: entryHref(e), title: "read the whole entry" }, e.title.replace(/`/g, ""))),
      el("div", { class: "pills" }, ...typePills(e.type), statusPill(statusAt(e, d) || e.status), evPill(e.evidence)),
      el("p", {}, cut || el("span", { class: "empty" }, typeof S.bodies === "string" ? "loading the text…" : "no text")),
      el("div", { class: "stage-card-foot" }, e.git?.created?.author ? el("span", { class: "note" }, `recorded by ${e.git.created.author}`) : el("span"), el("a", { href: entryHref(e) }, "open ›")));
    if (typeof S.bodies === "string") ensureBodies(SELF).then(() => { if (card.isConnected && (HELD ? HELD === e.id : latestEntry(CLOCK || span.to) === e)) fillCard(e, held); });
  }
  const refreshCard = () => { if (HELD) return; const e = latestEntry(CLOCK || span.to); if (e) fillCard(e, false); else setKids(card, el("p", { class: "empty" }, "No entry by this day.")); };
  const slot = el("div", { class: "stage-card-slot" }, card);
  // the stage first, the playhead under it, then the bars with the card beside them
  const wrap = el("div", { class: "stage-wrap" });
  const canvas = el("canvas", { class: "stage" });
  const tip = el("div", { class: "stage-tip", hidden: true });
  const linksSeg = el("span", { class: "mini-seg stage-links", title: "the See and Superseded by lines between cards: every one, only a thought pointed at or held, or none" },
    ...[["all", "all links"], ["lit", "lit only"], ["none", "no links"]].map(([v, l]) => el("button", { type: "button", class: v === STAGE_LINKS ? "on" : "", onclick: (ev) => { setStageLinks(v); for (const b of ev.currentTarget.parentNode.children) b.classList.toggle("on", b === ev.currentTarget); } }, l)));
  const arrangeSeg = el("span", { class: "mini-seg stage-links stage-arrange", title: "where a card stands: where its node stands in the graph beside (the stage is the graph, time pulled out as depth), or in a lane per topic" },
    ...[["graph", "as the graph"], ["topics", "by topic"]].map(([v, l]) => el("button", { type: "button", class: v === STAGE_ARRANGE ? "on" : "", onclick: (ev) => { setStageArrange(v); for (const b of ev.currentTarget.parentNode.children) b.classList.toggle("on", b === ev.currentTarget); } }, l)));
  wrap.append(canvas, tip, arrangeSeg, linksSeg);
  main.append(el("div", { class: "timeline-head" },
      el("div", { class: "timeline-head-text" }, sub, el("div", { class: "timeline" }, svg),
        el("div", { class: "legend" }, S.authors.map((a) => el("span", {}, el("i", { class: "sw", style: `background:${authorColor(a.name)}` }), a.name)), el("span", {}, el("i", { class: "sw", style: "background:var(--superseded)" }), "superseded that month")),
        el("div", { class: "playhead" }, jump(() => span.from, "the first day", "⏮"), playBtn, jump(() => span.to, "today", "⏭"), range, dayLabel, speedSel, counts)),
      slot),
    wrap,
    stageLegend(),
    el("p", { class: "note stage-note" }, el("span", { class: "stage-hint" }, "On the stage: wheel — a day forward or back, shift for a week · drag — look around · ctrl+wheel — zoom · double-click — reset the view · click a card to read it, the floor to let go. The thoughts beside: point at one to light its chain here and in the graph."), el("span", { class: "stage-hint-touch" }, "On the stage: drag — look around · pinch — zoom · tap a card to read it, the floor to let go. The slider sets the day.")),
    listBox);
  buildGraph(); // the thoughts beside the stage are the graph's; pointing at one lights it in the stage and in the graph alike
  const want = day && DAY_RE.test(day) ? clamp(day) : span.to;
  CLOCK = null; setClock(want); upd();
  runStage(canvas, { wrap, tip, span, setDay, play,
    open: (e) => { HELD = e.id; selected = e.id; fillCard(e, true); },
    close: () => { HELD = null; selected = null; refreshCard(); } });
  // keys while the timeline is open: ← → a day, shift a week, space plays
  const onKey = (ev) => {
    if (!wrap.isConnected) return document.removeEventListener("keydown", onKey);
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(ev.target?.tagName) && ev.target !== range) return;
    const d = CLOCK || span.to;
    if (ev.key === "ArrowLeft") { play(false); setDay(addDays(d, ev.shiftKey ? -7 : -1)); ev.preventDefault(); }
    else if (ev.key === "ArrowRight") { play(false); setDay(addDays(d, ev.shiftKey ? 7 : 1)); ev.preventDefault(); }
    else if (ev.key === " " && ev.target !== range) { play(!PLAY.on); ev.preventDefault(); }
  };
  document.addEventListener("keydown", onKey);
}
// A card's shape is its Type — the first of decision, constraint, workaround, incident on the entry; none: a plain card.
// decision: a plain card with a diamond. constraint: a thick band across the top, a barred square. workaround: a folded
// corner and a dashed edge, a folded square. incident: a striped band across the top, a triangle with a bar.
const TYPE_KINDS = ["decision", "constraint", "workaround", "incident"];
const typeKind = (e) => (e.type || []).map((t) => typeName(t)).find((t) => TYPE_KINDS.includes(t)) || null;
// on the stage the colour is the Type (the graph colours by Evidence; here Evidence is the fill: solid confirmed,
// hatched inferred, empty unknown), the Status the edge: dashed grey superseded, a ring for open / needs-review / pending
const TYPE_COLORS = { decision: "#835bec", constraint: "#4aa3df", workaround: "#e0a83a", incident: "#e0574f" };
const typeColor = (kind, fallback) => TYPE_COLORS[kind] || fallback;
function stageLegend() {
  const sw = (cls, style) => el("i", { class: `sw ${cls}`, style });
  return el("div", { class: "stage-legend" },
    el("span", { class: "grp" }, ...TYPE_KINDS.map((k) => el("span", { style: `color:${TYPE_COLORS[k]}`, html: `${typeGlyphSvg(k)} <span style="color:var(--fg2)">${k}</span>` })), el("span", {}, sw("", "color:var(--muted)"), el("span", {}, "no type"))),
    el("span", { class: "grp", title: "Evidence is the fill" }, el("span", {}, sw("solid", "color:var(--fg2)"), "confirmed"), el("span", {}, sw("hatch", "color:var(--fg2)"), "inferred"), el("span", {}, sw("", "color:var(--fg2)"), "unknown")),
    el("span", { class: "grp", title: "Status is the edge" }, el("span", {}, sw("dashed", "color:var(--fg3)"), "superseded"), el("span", {}, sw("ring", "color:var(--fg2)"), "open · needs review · pending")));
}
function typeGlyphSvg(kind) {
  const d = { decision: '<path d="M6 1 11 6 6 11 1 6z"/>', constraint: '<path d="M1.5 1.5h9v9h-9z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1.5 5h9v2h-9z"/>',
    workaround: '<path d="M1.5 1.5h6l3 3v6h-9z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 1.5"/><path d="M7.5 1.5v3h3" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    incident: '<path d="M6 1.2 11.2 10.8H.8z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.3 4.5h1.4v3.2H5.3zM5.3 8.5h1.4v1.3H5.3z"/>' }[kind] || "";
  return `<svg class="type-glyph" viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" fill="currentColor">${d}</svg>`;
}
// the same glyph on the canvas, `s` its size in pixels, drawn at (x, y) top-left in the current fill and stroke colour
function typeGlyph(ctx, kind, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 12, s / 12); ctx.lineWidth = 1.5 * 12 / s; ctx.setLineDash([]);
  if (kind === "decision") { ctx.beginPath(); ctx.moveTo(6, 1); ctx.lineTo(11, 6); ctx.lineTo(6, 11); ctx.lineTo(1, 6); ctx.closePath(); ctx.fill(); }
  else if (kind === "constraint") { ctx.strokeRect(1.5, 1.5, 9, 9); ctx.fillRect(1.5, 5, 9, 2); }
  else if (kind === "workaround") { ctx.setLineDash([2, 1.5]); ctx.beginPath(); ctx.moveTo(1.5, 1.5); ctx.lineTo(7.5, 1.5); ctx.lineTo(10.5, 4.5); ctx.lineTo(10.5, 10.5); ctx.lineTo(1.5, 10.5); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(7.5, 1.5); ctx.lineTo(7.5, 4.5); ctx.lineTo(10.5, 4.5); ctx.stroke(); }
  else if (kind === "incident") { ctx.beginPath(); ctx.moveTo(6, 1.2); ctx.lineTo(11.2, 10.8); ctx.lineTo(0.8, 10.8); ctx.closePath(); ctx.stroke(); ctx.fillRect(5.3, 4.5, 1.4, 3.2); ctx.fillRect(5.3, 8.5, 1.4, 1.3); }
  ctx.restore();
}
// The stage: a perspective view of the entries at the day shown. World units: x — one per topic lane,
// y — rows within a lane, z — days back from the day shown, scaled so the whole span fits the depth.
function runStage(canvas, o) {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const css = getComputedStyle(document.documentElement); const color = (v) => css.getPropertyValue(v).trim();
  let W = 0, H = 0, dpr = window.devicePixelRatio || 1;
  const resize = () => { const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  resize();
  const ro = new ResizeObserver(() => { resize(); fitHeight(); wake(); }); ro.observe(canvas);
  // the scene, rebuilt when the entries change (a live update re-renders the view, so once per view)
  const laneOf = (e) => `${e.project || ""}|${e.file}`;
  const byLane = new Map();
  for (const e of S.entries) { if (!byLane.has(laneOf(e))) byLane.set(laneOf(e), { key: laneOf(e), file: e.file, project: e.project || "", title: (e.project ? `${e.project} · ` : "") + (topicOf(e.file)?.title || e.file).replace(/`/g, ""), items: [], first: "" }); byLane.get(laneOf(e)).items.push(e); }
  const lanes = [...byLane.values()];
  for (const L of lanes) { L.items.sort((a, b) => (createdOn(a) || "9") < (createdOn(b) || "9") ? -1 : 1); L.first = L.items.map(createdOn).filter(Boolean).sort()[0] || "9"; }
  lanes.sort((a, b) => a.first < b.first ? -1 : a.first > b.first ? 1 : a.title.localeCompare(b.title)); // the oldest topic on the left: the stage fills left to right
  // two shelves, the lanes alternating between them: half the width, and the picture gets a second height
  const nL = lanes.length || 1; const cols = Math.ceil(nL / 2);
  const SHELF = [-0.3, 1.0]; // the rows' base height on the lower and the upper shelf
  const cards = []; const byId = {};
  const weekOf = (day) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  lanes.forEach((L, li) => {
    L.x = Math.floor(li / 2) - (cols - 1) / 2; L.shelf = li % 2;
    // entries of one lane and one calendar week sit at nearly one depth: they take three rows and two columns in turn,
    // and entries of one day a step of depth each, so a busy week stacks up instead of on top of itself
    const sameWeek = {}, sameDay = {};
    L.items.forEach((e) => { const day = createdOn(e) || o.span.to; const w = (sameWeek[weekOf(day)] = (sameWeek[weekOf(day)] || 0) + 1) - 1; const k = (sameDay[day] = (sameDay[day] || 0) + 1) - 1;
      const c = { e, lane: L, x: L.x + ((Math.floor(w / 3) % 2) - 0.5) * 0.34, y: SHELF[L.shelf] + ((w % 3) - 1) * 0.44, dz: (k % 4) * 0.1, day }; cards.push(c); byId[e.id] = c; if (e.uuid) byId[e.uuid] = c; });
  });
  const links = [];
  for (const c of cards) {
    for (const r of c.e.see || []) { const t = r?.uuid && byId[r.uuid]; if (t && t !== c) links.push({ a: c, b: t, kind: "see", day: seeDay(c.e, r) }); }
    const sb = c.e.superseded_by ? parseSupersededBy(c.e.superseded_by)?.uuid : null; const t = sb && byId[sb]; if (t && t !== c) links.push({ a: c, b: t, kind: "superseded", day: supersededDay(c.e) });
  }
  // depth is logarithmic in days: yesterday is a step away, last week two, a year ago fourteen — the last
  // days spread out where the eye is, the whole past stays in view
  const depth = (days) => 4 * Math.log1p(Math.max(0, days) / 10);
  const F = 4.2; // focal length in lane units: a month back is still half size, so the past spreads instead of piling at the centre
  let zoom = 1, panX = 0, panY = 0; // the camera: zoom around the near plane, pan in screen pixels
  const camY = 1.85; // the eye just above the upper shelf's top row: the floor runs up toward the horizon
  const K = () => Math.max(56, Math.min(190, (W - 40) / (cols + 1.2))) * zoom; // pixels per lane unit on the near plane
  // the box is as tall as the near plane needs — a narrow pane gets a low stage, a wide one a tall one
  const fitHeight = () => { const h = Math.round(Math.max(220, Math.min(760, K() / zoom * 3.15 + 60))); if (Math.abs(h - o.wrap.getBoundingClientRect().height) > 2) o.wrap.style.height = `${h}px`; };
  const horizon = () => H * 0.13 + panY; const cx = () => W / 2 + panX;
  const now = () => (CLOCK || o.span.to);
  const tNow = () => dayDiff(o.span.from, now()) + (PLAY.on ? PLAY.frac : 0); // days since the first day, fractional while playing
  const zOf = (day) => depth(tNow() - dayDiff(o.span.from, day)); // depth units back from the day shown
  const zCard = (c) => zOf(c.day) + c.dz;
  const proj = (x, y, z) => { const s = F / (F + Math.max(z, -F * 0.9)); return [cx() + x * K() * s, horizon() + (camY - y) * K() * s, s]; };
  // where a card stands. "graph": its node's place in the graph beside, read live — the graph's plane mapped onto the
  // stage's near plane, so the eye finds a node here where it finds it there, and the stage turns with the graph;
  // "topics": its lane and row. A node the graph does not have (another project's entry) falls back to the lane.
  const asGraph = () => STAGE_ARRANGE === "graph" && !!graph;
  const gnode = new Map(); for (const n of graph?.nodes || []) if (n.kind === "entry" && !n.ext) gnode.set(n.entry.id, n);
  const tnodes = (graph?.nodes || []).filter((n) => n.kind === "topic" && !n.ext);
  const gbox = { x0: 0, x1: 1, y0: 0, y1: 1 };
  const gmap = (n) => { const ux = (n.x - gbox.x0) / (gbox.x1 - gbox.x0 || 1), uy = (n.y - gbox.y0) / (gbox.y1 - gbox.y0 || 1); return { x: (ux - 0.5) * (cols + 0.2), y: SHELF[1] + 0.55 - uy * (SHELF[1] + 0.55 - (SHELF[0] - 0.5)) }; };
  const measureGraph = () => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const n of gnode.values()) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); } if (x0 < x1) Object.assign(gbox, { x0, x1, y0, y1 }); };
  const posOf = (c) => { const q = asGraph() ? (gnode.get(c.e.id) ? gmap(gnode.get(c.e.id)) : { x: c.x, y: c.y }) : { x: c.x, y: c.y }; return { x: q.x + (c.ox || 0), y: q.y + (c.oy || 0) }; };
  // Cards keep apart: two cards at about one depth whose boxes overlap push each other off, by the smaller overlap,
  // a little each frame until they clear, within bounds so no stack grows into a tower; the push is kept as an
  // offset on the card (near-plane units, bounded) and fades slowly, so a card drifts back when the room frees up
  // (the day moves on, the graph turns). A frame with pushes left asks for another, so the picture settles in a moment.
  let unsettled = false;
  function keepApart(vis, boxes) {
    unsettled = false;
    for (let i = 0; i < vis.length; i++) {
      const A = vis[i], a = boxes.get(A.c);
      for (let j = i + 1; j < vis.length; j++) {
        const B = vis[j]; if (Math.abs(A.z - B.z) > 1.4) continue;
        const b = boxes.get(B.c);
        const dx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), dy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (dx <= 1 || dy <= 1) continue;
        unsettled = true;
        const sx = Math.sign(a.cx - b.cx) || (i & 1 ? 1 : -1), sy = Math.sign(a.cy - b.cy) || (j & 1 ? 1 : -1);
        if (dx < dy) { const u = (dx + 2) * 0.3; const ua = u / (K() * a.s), ub = u / (K() * b.s); A.c.ox = (A.c.ox || 0) + sx * ua; B.c.ox = (B.c.ox || 0) - sx * ub; a.x0 += sx * u; a.x1 += sx * u; a.cx += sx * u; b.x0 -= sx * u; b.x1 -= sx * u; b.cx -= sx * u; }
        else { const u = (dy + 2) * 0.3; const ua = u / (K() * a.s), ub = u / (K() * b.s); A.c.oy = (A.c.oy || 0) - sy * ua; B.c.oy = (B.c.oy || 0) + sy * ub; a.y0 += sy * u; a.y1 += sy * u; a.cy += sy * u; b.y0 -= sy * u; b.y1 -= sy * u; b.cy -= sy * u; }
      }
    }
    for (const { c } of vis) { c.ox = Math.max(-1.3, Math.min(1.3, (c.ox || 0) * 0.98)); c.oy = Math.max(-0.9, Math.min(0.9, (c.oy || 0) * 0.98)); }
  }
  const depthAlpha = (z) => Math.max(0.14, Math.min(1, 1.08 - z / 16));
  const HATCH = new Map(); // colour -> pattern: diagonal lines, the fill of an inferred entry
  const hatch = (col) => { if (!HATCH.has(col)) { const pc = document.createElement("canvas"); pc.width = pc.height = 6; const x = pc.getContext("2d"); if (x) { x.strokeStyle = col; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-1, 7); x.lineTo(7, -1); x.moveTo(-1, 1); x.lineTo(1, -1); x.moveTo(5, 7); x.lineTo(7, 5); x.stroke(); } HATCH.set(col, ctx.createPattern(pc, "repeat")); } return HATCH.get(col); };
  const litIds = () => { const t = graph?.thought; const set = new Set(); if (t) for (const n of t.nodes) if (n.entry) { set.add(n.entry.id); if (n.entry.uuid) set.add(n.entry.uuid); } return set; };
  const litPairs = () => graph?.thought?.pairs || null;
  let hover = null, held = null, drag = null, moved = false, pinch = null, raf = null, lastDraw = 0;
  const shown = (c) => existsAt(c.e, now()) && (!PLAY.on || zOf(c.day) >= -0.02);
  const zFarOf = () => Math.max(1, depth(tNow() + 20));
  const rects = []; // screen boxes of the cards drawn, near ones last; each with its foot, the line down to the floor
  const nearFoot = (r, px, py) => { const [ax, ay, bx, by] = r.foot; const dx = bx - ax, dy = by - ay; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) <= 4; };
  const pick = (px, py) => { for (let i = rects.length - 1; i >= 0; i--) { const r = rects[i]; if (px >= r.x0 && px <= r.x1 && py >= r.y0 && py <= r.y1) return r.c; } for (let i = rects.length - 1; i >= 0; i--) if (nearFoot(rects[i], px, py)) return rects[i].c; return null; };
  function draw() {
    raf = null; rects.length = 0;
    ctx.clearRect(0, 0, W, H);
    const day = now(); const lit = litIds(); const pairs = litPairs(); const anyLit = lit.size > 0; const step = STEP_FOCUS;
    const zFar = zFarOf(); const byGraph = asGraph(); if (byGraph) measureGraph();
    // the floor: lane lines into the depth (by topic), a line per month across, the year at its first month
    ctx.lineWidth = 1; ctx.strokeStyle = color("--line"); ctx.globalAlpha = 0.9;
    const xl = -cols / 2 - 0.1, xr = cols / 2 + 0.1, floorY = -0.95;
    for (let i = 0; i <= (byGraph ? 0 : cols); i++) { const x = byGraph ? 0 : i - cols / 2; const [ax, ay] = proj(byGraph ? xl : x, floorY, -0.4); const [bx, by] = proj(byGraph ? xl : x, floorY, zFar); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); if (byGraph) { const [cx2, cy2] = proj(xr, floorY, -0.4), [dx2, dy2] = proj(xr, floorY, zFar); ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(dx2, dy2); ctx.stroke(); } }
    ctx.font = `10px ${color("--font") || "sans-serif"}`; ctx.textBaseline = "middle";
    let [yy, mm] = day.slice(0, 7).split("-").map(Number); // from the month of the day shown back to the first
    for (let guard = 0; guard < 600; guard++) {
      const first = `${yy}-${String(mm).padStart(2, "0")}-01`; const z = zOf(first); if (z > zFar) break;
      const [ax, ay] = proj(xl, floorY, z), [bx, by] = proj(xr, floorY, z);
      ctx.globalAlpha = 0.35 + 0.65 * depthAlpha(z); ctx.strokeStyle = mm === 1 ? color("--fg3") : color("--line"); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.fillStyle = mm === 1 ? color("--fg2") : color("--fg3"); ctx.textAlign = "right"; if (ay > 8 && ay < H - 4 && (mm === 1 || z < 9)) ctx.fillText(mm === 1 ? String(yy) : first.slice(0, 7), ax - 6, ay);
      mm--; if (mm < 1) { mm = 12; yy--; }
    }
    // the day shown, in the corner
    { ctx.globalAlpha = 1; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = `600 11px ${color("--mono") || "monospace"}`; ctx.fillStyle = color("--accent2"); ctx.fillText(`${day}${PLAY.on ? " ▶" : ""}`, 10, 9); ctx.textBaseline = "middle"; }
    // the lanes' names along the near edge — or, as the graph, the topics' names where their hubs stand, faint, behind the cards
    ctx.font = `10.5px ${color("--font") || "sans-serif"}`; ctx.textAlign = "center"; ctx.textBaseline = "top";
    if (byGraph) for (const n of tnodes) { const alive = !CLOCK || S.entries.some((e) => e.file === n.file && !e.project && existsAt(e, day)); if (!alive) continue; const q = gmap(n); const [x, y] = proj(q.x, q.y, 0); ctx.fillStyle = color("--fg3"); ctx.globalAlpha = 0.55; ctx.fillText((n.label || n.file).replace(/`/g, "").slice(0, 28), x, y); }
    else for (const L of lanes) { const alive = L.items.some((e) => existsAt(e, day)); if (!alive) continue; const [x, y, s] = proj(L.x, floorY, 0); const w = K() * s * 0.9 - 10; const t = L.title; let txt = t; while (txt.length > 3 && ctx.measureText(txt).width > w) txt = txt.slice(0, -2); if (txt !== t) txt = txt.slice(0, -1) + "…"; ctx.fillStyle = color("--fg2"); ctx.globalAlpha = L.shelf ? 0.9 : 0.65; ctx.fillText(`${L.shelf ? "▴" : "▾"} ${txt}`, x, y + (L.shelf ? 5 : 19)); }
    // the cards, far ones first
    const vis = cards.filter(shown).map((c) => ({ c, z: zCard(c) })).sort((a, b) => b.z - a.z);
    const cardScale = byGraph ? 0.66 : 1; // as the graph the cards stand closer: smaller, the tip tells the rest
    const box = (c, z) => { const q = posOf(c); const [x, y, s] = proj(q.x, q.y, z); const w = K() * s * 0.78 * cardScale, h = K() * s * 0.36 * cardScale; return { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2, cx: x, cy: y, s, w, h }; };
    const boxes = new Map(); for (const { c, z } of vis) boxes.set(c, box(c, z));
    keepApart(vis, boxes);
    // the lines between cards: every one, the lit thought's, or none
    if (STAGE_LINKS !== "none") for (const l of links) {
      if (!boxes.has(l.a) || !boxes.has(l.b) || !linkExistsAt(day, l.day)) continue;
      const onLit = pairs && (pairs.has(`e:${l.a.e.id}|e:${l.b.e.id}`) || pairs.has(`e:${l.b.e.id}|e:${l.a.e.id}`));
      const near = hover && (l.a === hover || l.b === hover);
      if (STAGE_LINKS === "lit" && !onLit && !near && !(held && (l.a === held || l.b === held))) continue;
      const A = boxes.get(l.a), B = boxes.get(l.b);
      ctx.globalAlpha = onLit || near ? 0.95 : anyLit ? 0.08 : 0.35 * Math.min(A.s, B.s) + 0.1;
      ctx.strokeStyle = onLit || near ? color("--fg") : l.kind === "see" ? color("--accent2") : color("--fg3"); ctx.lineWidth = onLit || near ? 1.6 : 1; ctx.setLineDash(l.kind === "superseded" ? [5, 4] : []);
      ctx.beginPath(); ctx.moveTo(A.cx, A.cy); ctx.lineTo(B.cx, B.cy); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const { c, z } of vis) {
      const b = boxes.get(c); const e = c.e; const st = statusAt(e, day) || e.status; const sup = st === "superseded";
      const isLit = lit.has(e.id) || (e.uuid && lit.has(e.uuid)); const isStep = step && (e.uuid === step || e.id === step);
      const faded = (anyLit && !isLit && c !== hover && c !== held) || (filterActive() && !matches(e));
      const fresh = dayDiff(c.day, day) <= 3 && !PLAY.frac; // arrived within three days of the day shown: it glows
      const a = (faded ? 0.16 : 1) * depthAlpha(z);
      // a foot: the card's drop line to the floor
      const [fx, fy] = proj(posOf(c).x, floorY, z); const lit1 = c === hover || c === held; ctx.globalAlpha = a * (lit1 ? 0.9 : 0.35); ctx.strokeStyle = lit1 ? color("--fg") : color("--fg3"); ctx.lineWidth = lit1 ? 1.5 : 1; ctx.beginPath(); ctx.moveTo(b.cx, b.y1); ctx.lineTo(fx, fy); ctx.stroke();
      b.foot = [b.cx, b.y1, fx, fy];
      const kind = typeKind(e); const fold = kind === "workaround" ? Math.min(b.h * 0.45, b.w * 0.3) : 0;
      const evc = sup ? color("--fg3") : typeColor(kind, color("--muted")); // the type's colour; a superseded card goes grey
      // the card's outline: a rectangle, or one with its top-right corner folded
      const outline = () => { ctx.beginPath(); if (fold) { ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1 - fold, b.y0); ctx.lineTo(b.x1, b.y0 + fold); ctx.lineTo(b.x1, b.y1); ctx.lineTo(b.x0, b.y1); ctx.closePath(); } else ctx.rect(b.x0, b.y0, b.w, b.h); };
      ctx.globalAlpha = a;
      if (fresh || isLit || c === hover || c === held || isStep) { ctx.shadowColor = isStep ? color("--accent2") : isLit ? color("--fg") : evc; ctx.shadowBlur = isStep ? 22 : 14; }
      // the body: a solid tint for confirmed, hatching for inferred, the background alone for unknown
      ctx.fillStyle = color("--bg2"); ctx.globalAlpha = a * 0.9; outline(); ctx.fill(); ctx.shadowBlur = 0;
      if (e.evidence === "confirmed") { ctx.fillStyle = evc; ctx.globalAlpha = a * (sup ? 0.12 : 0.3); outline(); ctx.fill(); }
      else if (e.evidence === "inferred") { ctx.fillStyle = hatch(evc) || evc; ctx.globalAlpha = a * (sup ? 0.3 : 0.6); outline(); ctx.fill(); }
      ctx.globalAlpha = a;
      const band = Math.max(2, Math.min(5, b.h * 0.11));
      if (kind === "constraint") { ctx.fillStyle = sup ? color("--fg3") : evc; ctx.globalAlpha = a * 0.9; ctx.fillRect(b.x0, b.y0, b.w, band); ctx.globalAlpha = a; }
      if (kind === "incident") { ctx.save(); ctx.beginPath(); ctx.rect(b.x0, b.y0, b.w, band); ctx.clip(); ctx.fillStyle = sup ? color("--fg3") : evc; ctx.globalAlpha = a * 0.9; const st = Math.max(3, band * 1.6); for (let x = b.x0 - band; x < b.x1 + band; x += st * 2) { ctx.beginPath(); ctx.moveTo(x, b.y0); ctx.lineTo(x + st, b.y0); ctx.lineTo(x + st - band, b.y0 + band); ctx.lineTo(x - band, b.y0 + band); ctx.closePath(); ctx.fill(); } ctx.restore(); ctx.globalAlpha = a; }
      if (fold) { ctx.fillStyle = color("--bg"); ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(b.x1 - fold, b.y0); ctx.lineTo(b.x1 - fold, b.y0 + fold); ctx.lineTo(b.x1, b.y0 + fold); ctx.closePath(); ctx.fill(); ctx.strokeStyle = sup ? color("--fg3") : evc; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.lineWidth = c === hover || c === held ? 2 : 1.2; ctx.strokeStyle = sup ? color("--fg3") : evc; ctx.setLineDash(sup || kind === "workaround" ? [4, 3] : []); outline(); ctx.stroke(); ctx.setLineDash([]);
      if (kind && b.w > 30) { ctx.fillStyle = evc; ctx.strokeStyle = evc; const gs = Math.max(7, Math.min(11, b.h * 0.3)); typeGlyph(ctx, kind, b.x1 - gs - 4 - (fold ? fold * 0.6 : 0), b.y1 - gs - 3, gs); }
      if (e.evidence === "unknown" && b.w > 30) { ctx.fillStyle = color("--unknown"); ctx.font = `700 ${Math.max(8, Math.min(12, b.h * 0.32))}px ${color("--font") || "sans-serif"}`; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("?", b.x0 + 5, b.y1 - 2); }
      if (st === "open" || st === "needs-review" || st === "pending-confirmation") { ctx.strokeStyle = color(`--${st}`); ctx.lineWidth = 1.2; ctx.strokeRect(b.x0 - 3, b.y0 - 3, b.w + 6, b.h + 6); }
      if (isStep) { ctx.strokeStyle = color("--accent2"); ctx.lineWidth = 2.5; ctx.strokeRect(b.x0 - 5, b.y0 - 5, b.w + 10, b.h + 10); }
      // the title, where it fits
      const fs = Math.min(12, 11 * b.s * zoom); const top = kind === "constraint" || kind === "incident" ? band + 1 : 0;
      if (b.w > 54 && fs >= 8.5) {
        ctx.font = `${fs}px ${color("--font") || "sans-serif"}`; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillStyle = sup ? color("--fg3") : color("--fg");
        ctx.setLineDash([]); const words = e.title.replace(/`/g, "").split(" "); const lines = []; let cur = "";
        for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (ctx.measureText(t).width > b.w - 10 && cur) { lines.push(cur); cur = w; } else cur = t; if (lines.length >= 3) break; }
        if (lines.length < 3 && cur) lines.push(cur);
        const lh = fs * 1.2; const maxLines = Math.max(1, Math.floor((b.h - 6 - top) / lh));
        lines.slice(0, maxLines).forEach((t, i) => { let txt = t; if (i === maxLines - 1 && (lines.length > maxLines || words.length > lines.join(" ").split(" ").length)) txt += "…"; const room = b.w - 10 - (i === 0 && fold ? fold : 0); while (txt.length > 2 && ctx.measureText(txt).width > room) txt = txt.slice(0, -2) + "…"; ctx.fillText(txt, b.x0 + 5, b.y0 + 4 + top + i * lh); });
      }
      rects.push({ ...b, c });
    }
    ctx.globalAlpha = 1;
    if (unsettled) wake();
  }
  const wake = () => { if (!raf && canvas.isConnected) raf = requestAnimationFrame(draw); };
  // pick: an entry chosen elsewhere on the page (a thought's step in the pane) is held like a clicked card, and
  // the day moves to the entry's, so it arrives at the front of the stage
  STAGE = { wake, follows: asGraph, close: closeCard, pick: (e) => { held = byId[e.id] || (e.uuid && byId[e.uuid]) || null; o.play(false); o.open(e); o.setDay(createdOn(e) || o.span.to); wake(); } };
  // the tip under the pointer, the card panel on a click
  const place = (box, px, py) => { const r = canvas.getBoundingClientRect(); box.style.left = `${Math.min(r.width - 280, Math.max(8, px + 14))}px`; box.style.top = `${Math.min(r.height - 90, py + 14)}px`; };
  const showTip = (c, px, py) => { const e = c.e; setKids(o.tip, el("b", {}, e.title.replace(/`/g, "")), el("div", { class: "note" }, `${c.lane.title} · ${c.day}${e.git?.created?.author ? " · " + e.git.created.author : ""}`), el("div", { class: "pills" }, ...typePills(e.type), statusPill(statusAt(e, now()) || e.status), evPill(e.evidence))); o.tip.hidden = false; place(o.tip, px, py); };
  const hideTip = () => { o.tip.hidden = true; };
  function openCard(c) { held = c; o.open(c.e); wake(); }
  function closeCard() { if (!held) return; held = null; o.close(); wake(); }
  const pos = (ev) => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  canvas.onmousemove = (ev) => {
    const [px, py] = pos(ev);
    if (drag) { panX = drag.panX + (px - drag.px); panY = drag.panY + (py - drag.py); if (Math.hypot(px - drag.px, py - drag.py) > 4) moved = true; hideTip(); wake(); return; }
    const c = pick(px, py);
    if (c !== hover) { hover = c; focusStep(c?.e.uuid || c?.e.id || null); wake(); }
    canvas.style.cursor = c ? "pointer" : "grab";
    if (c) showTip(c, px, py); else hideTip();
  };
  canvas.onmouseleave = () => { if (hover) { hover = null; focusStep(null); wake(); } hideTip(); };
  canvas.onmousedown = (ev) => { if (ev.button !== 0) return; const [px, py] = pos(ev); drag = { px, py, panX, panY }; moved = false; canvas.classList.add("grabbing"); };
  const onUp = (ev) => { if (!drag) return; const [px, py] = pos(ev); drag = null; canvas.classList.remove("grabbing"); if (moved) return; const c = pick(px, py); if (c) openCard(c); else if (ev.target === canvas && held) closeCard(); };
  window.addEventListener("mouseup", onUp);
  canvas.onwheel = (ev) => {
    ev.preventDefault();
    if (ev.ctrlKey || ev.metaKey) { zoom = Math.min(4, Math.max(0.5, zoom * Math.exp(-ev.deltaY * 0.0015))); wake(); return; }
    const d = Math.sign(ev.deltaY || ev.deltaX) * (ev.shiftKey ? 7 : 1); if (!d) return;
    o.play(false); o.setDay(addDays(now(), d)); hideTip();
  };
  canvas.ondblclick = () => { zoom = 1; panX = 0; panY = 0; wake(); };
  // touch: one finger looks around, two pinch, a tap opens a card
  const tpos = (t) => { const r = canvas.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; };
  const tdist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
  canvas.addEventListener("touchstart", (ev) => { if (ev.touches.length === 2) { pinch = { d: tdist(ev.touches) || 1, zoom }; drag = null; return; } const [px, py] = tpos(ev.touches[0]); drag = { px, py, panX, panY }; moved = false; }, { passive: true });
  canvas.addEventListener("touchmove", (ev) => { if (pinch && ev.touches.length === 2) { zoom = Math.min(4, Math.max(0.5, pinch.zoom * (tdist(ev.touches) / pinch.d))); wake(); ev.preventDefault(); return; } if (!drag || !ev.touches.length) return; const [px, py] = tpos(ev.touches[0]); panX = drag.panX + (px - drag.px); panY = drag.panY + (py - drag.py); if (Math.hypot(px - drag.px, py - drag.py) > 6) moved = true; wake(); ev.preventDefault(); }, { passive: false });
  canvas.addEventListener("touchend", (ev) => { if (pinch) { if (!ev.touches.length) pinch = null; return; } if (!drag) return; const d = drag; drag = null; if (moved) return; const c = pick(d.px, d.py); if (c) openCard(c); else if (held) closeCard(); });
  const ro2 = new ResizeObserver(() => { if (!canvas.isConnected) { ro.disconnect(); ro2.disconnect(); window.removeEventListener("mouseup", onUp); if (STAGE?.wake === wake) STAGE = null; } }); ro2.observe(canvas);
  fitHeight(); wake();
}

// ---------------------------------------------------------------- search
// What a search runs over: this project, or every member of its tree — the
// whole family from the root down, not only the parent chain. Shared by the
// dropdown under the search field and the results page (#search/<scope>/<q>).
const familyRank = (m) => (m.role === "self" ? -100 : m.role === "ancestor" || m.role === "grandparent" ? -(m.depth || 2) : { parent: 0, sibling: 2, child: 3, relative: 4 }[m.role] ?? 5);
let TREE = null; let TREE_AT = 0; // /api/family?tree=1, live mode
async function fetchTree() {
  if (!LIVE()) return null;
  if (TREE && Date.now() - TREE_AT < 30000) return TREE;
  try { TREE = (await (await fetch(`${api("/api/family")}${PROJECT ? "&" : "?"}tree=1`, { cache: "no-store" })).json()).members || []; TREE_AT = Date.now(); } catch { TREE = null; }
  return TREE;
}
const MEMBER_STATES = {}; // project key -> { at, p: Promise<{state}|{error}> }, live mode
function memberState(key) {
  const c = MEMBER_STATES[key];
  if (c && Date.now() - c.at < 30000) return c.p;
  const url = `/api/state.json?project=${encodeURIComponent(key)}`;
  const p = fetch(url, { cache: "no-store" })
    .then(async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); const text = await r.text(); noteLoaded(new URL(url, location.href).href, text, "state"); return JSON.parse(text); })
    .then((st) => ({ state: normalizeState(st) }), (err) => ({ error: `could not load its state (${err?.message || "server gone"})` }));
  MEMBER_STATES[key] = { at: Date.now(), p };
  return p;
}
let PUBLIC_TREE = null; // the tree read from published exports, public mode
async function publicTree() {
  if (PUBLIC_TREE) return PUBLIC_TREE;
  PUBLIC_TREE = await publicTreeFrom({ state: SELF, canonical: canonicalOf(S.project), root: MY_ROOT(), name: S.project.id || S.project.name, href: (e) => entryHref(e) });
  await Promise.all(PUBLIC_TREE.groups.map((g) => ensureBodies(g.state))); // merged into search and lists: the bodies are needed
  return PUBLIC_TREE;
}
// The family tree around one published project, read from the members'
// published exports: this page's own (publicTree), or a friend's.
async function publicTreeFrom(start) {
  const canon = start.canonical; const myRoot = start.root || "";
  const keyOf = (c, r) => `${c}|${r}`;
  const self = { member: { role: "self", name: start.name, canonical: canon, root: myRoot, node: keyOf(canon, myRoot), up: null }, state: start.state, href: start.href };
  const groups = [self]; const missing = []; const seen = new Set([keyOf(canon, myRoot)]);
  const label = (loc) => loc.root ? `${loc.canonical.replace(/^https:\/\//, "")}/${loc.root}` : loc.canonical.replace(/^https:\/\//, "");
  const add = (m, r) => { if (r.state) groups.push({ member: m, state: r.state, href: (e) => publicHref(m.canonical, m.root, entryHref(e)) }); else missing.push({ member: m, reason: r.error }); return r.state; };
  // up: the parent chain, as far as each level is published
  let cur = { state: start.state, canonical: canon, root: myRoot }; let depth = 1; let parentKey = null; let below = self.member;
  while (cur.state?.project?.parent && depth < 12) {
    const loc = resolveLocation(cur.state.project.parent, cur.canonical, cur.root);
    if (!loc || seen.has(keyOf(loc.canonical, loc.root))) break;
    seen.add(keyOf(loc.canonical, loc.root));
    if (depth === 1) parentKey = keyOf(loc.canonical, loc.root);
    const m = { role: depth === 1 ? "parent" : depth === 2 ? "grandparent" : "ancestor", depth, name: label(loc), ...loc, node: keyOf(loc.canonical, loc.root), up: null };
    below.up = m.node; below = m; // the tree's shape: each level names the one above it
    const st = add(m, await fetchPublicState(loc.canonical, loc.root));
    cur = { state: st, canonical: loc.canonical, root: loc.root }; depth++;
  }
  // down: every published children block, level by level from the top
  let level = groups.map((g) => ({ state: g.state, canonical: g.member.canonical, root: g.member.root || "", key: keyOf(g.member.canonical, g.member.root || "") }));
  for (let round = 0; level.length && round < 12; round++) {
    const next = [];
    const kids = level.flatMap((l) => (l.state?.project?.children || []).map((c) => ({ c, from: l, loc: resolveLocation(c.location, l.canonical, l.root) })))
      .filter(({ loc }) => loc && !seen.has(keyOf(loc.canonical, loc.root)));
    for (const k of kids) seen.add(keyOf(k.loc.canonical, k.loc.root));
    const results = await Promise.all(kids.map((k) => fetchPublicState(k.loc.canonical, k.loc.root)));
    kids.forEach((k, i) => {
      const role = k.from.key === keyOf(canon, myRoot) ? "child" : k.from.key === parentKey ? "sibling" : "relative";
      const st = add({ role, name: k.c.name, scope: k.c.scope, via: k.from.state?.project?.id || "", ...k.loc, node: keyOf(k.loc.canonical, k.loc.root), up: k.from.key }, results[i]);
      if (st) next.push({ state: st, canonical: k.loc.canonical, root: k.loc.root, key: keyOf(k.loc.canonical, k.loc.root) });
    });
    level = next;
  }
  groups.sort((a, b) => familyRank(a.member) - familyRank(b.member));
  return { groups, missing };
}
// { groups: [{ member, state, href(e) }], missing: [{ member, reason }] } — this project first
// Four scopes, chosen per search (the dropdown's rows, the results page's bar): this project alone,
// the family tree, the friends, or both. The top bar's scope switch governs the graph and the lists,
// not the search — Enter in the search field always searches this project.
const SEARCH_SCOPES = { project: "this project", family: "family", friends: "friends", all: "family & friends" };
async function searchPool(scope) {
  const self = { member: { role: "self", name: S.project.name || S.project.id, canonical: canonicalOf(S.project) }, state: SELF, href: (e) => entryHref(e) };
  if (!(scope in SEARCH_SCOPES) || scope === "project") return { groups: [self], missing: [] };
  const fam = scope === "friends" ? { groups: [self], missing: [] } : await familyPool(self);
  if (scope === "family") return fam;
  const fr = await friendPool(fam);
  return { groups: [...fam.groups, ...fr.groups], missing: [...fam.missing, ...fr.missing] };
}
async function familyPool(self) {
  if (PUBLISHED()) return publicTree();
  if (!LIVE()) return { groups: [self], missing: [] };
  const others = [...(await fetchTree() || [])].filter((m) => m.role !== "self").sort((a, b) => familyRank(a) - familyRank(b));
  const results = await Promise.all(others.map((m) => m.key ? memberState(m.key) : { error: m.available === "none" ? "not checked out or cached on this machine" : "location unknown" }));
  const groups = [self]; const missing = [];
  others.forEach((m, i) => { const r = results[i]; if (r.state) groups.push({ member: m, state: r.state, href: (e) => `${location.pathname}?project=${encodeURIComponent(m.key)}${entryHref(e)}` }); else missing.push({ member: m, reason: r.error }); });
  return { groups, missing };
}
// The friends of the projects in a pool — the repositories their entries cite outside the family —
// read the way the graph reads them (loadFriend: a local checkout the live server knows, else the
// published export), bodies included, since the search reads them. A friend that has a family comes
// with it, as in the graph. What does not load is listed under "Not searched", never dropped.
async function friendPool(pool) {
  if (LIVE()) await fetchTree(); // the whole family is known before anything counts as a friend
  const known = [...pool.groups.map((g) => g.member.canonical), ...pool.missing.map(({ member: m }) => m.canonical)].filter(Boolean);
  const list = friendCandidates(pool.groups.flatMap((g) => g.state.entries || []), known);
  const results = await Promise.all(list.map(loadFriend));
  const groups = []; const missing = []; const seen = new Set(known.map(fkey));
  results.forEach((r, i) => {
    const f = list[i];
    if (!r.state) { missing.push({ member: { role: "friend", name: repoLabel(f.canonical), canonical: f.canonical }, reason: r.error || "could not load the export" }); return; }
    for (const u of r.members || [r]) {
      const k = fkey(u.canonical); if (!k || seen.has(k)) continue; seen.add(k);
      groups.push({ member: { role: "friend", name: u.name, canonical: u.canonical, root: u.root || "", key: u.key, open: u.open, via: k === fkey(r.canonical) ? "" : r.name }, state: u.state, href: u.href });
    }
  });
  await Promise.all(groups.map((g) => ensureBodies(g.state)));
  return { groups, missing };
}
// every hit, best first; the dropdown keeps this project's hits on top
function searchRows(pool, q) {
  const rows = [];
  for (const g of pool.groups) for (const e of g.state.entries || []) { const hit = searchHit(e, q); if (hit) rows.push({ e, hit, g }); }
  return rows.sort((a, b) => compareHits(a.hit, b.hit));
}
const searchScopes = () => (LIVE() || MODE === "public" || (MODE === "export" && !!canonicalOf(S?.project)) ? ["project", "family"] : ["project"]);
// One setting for every view that can span projects (search, graph): this
// project, or the whole family tree. Kept per browser; a results-page link
// carries its own scope and sets it.
const hasFamily = () => !!(S?.project?.parent || (S?.project?.children || []).length);
const canFamily = () => searchScopes().includes("family") && hasFamily();
// friends can be searched where the family can be read, and there are any: entries citing outside the family
const canFriends = () => searchScopes().includes("family") && !!SELF && friendCandidates(SELF.entries || []).length > 0;
const canSearch = (s) => s === "project" || (s === "family" ? canFamily() : s === "friends" ? canFriends() : s === "all" ? canFamily() || canFriends() : false);
let SCOPE = (() => { try { return localStorage.getItem("ktw-scope") || localStorage.getItem("ktw-search-scope") || "project"; } catch { return "project"; } })();
const scope = () => (canFamily() && SCOPE === "family" ? "family" : "project");
function markScope() {
  const box = $("#scope"); if (!box) return;
  box.hidden = !canFamily();
  for (const b of box.querySelectorAll("button")) b.classList.toggle("on", b.dataset.scope === scope());
}
function setScope(v, { rerender: again = true } = {}) {
  if (v !== "project" && v !== "family") return;
  const changed = SCOPE !== v; SCOPE = v;
  if (changed) MINI = null; // the side pane's graph follows the new scope
  try { localStorage.setItem("ktw-scope", v); } catch {}
  markScope();
  if (!changed) return;
  if (!again) { setTimeout(showScope); return; } // the caller renders now; the merge follows
  showScope();
}
function setupScope() { for (const b of $("#scope").querySelectorAll("button")) b.onclick = () => setScope(b.dataset.scope); markScope(); }
const searchHref = (scope, q) => `#search/${scope}/${encodeURIComponent(q)}`;
const memberLabel = (m) => m.role === "self" ? "this project" : m.role === "friend" ? (m.via ? `friend's family, with ${m.via}` : "friend") : m.role === "relative" && m.via ? `relative, via ${m.via}` : m.role;
const topicTitle = (st, file) => st.topics?.find((t) => t.file === file)?.title || file;
function hitSnippet(hit) {
  const w = hit.where; if (!w) return "";
  const text = snippetAt(w.text.replace(/\*\*|`/g, ""), Math.max(0, w.text.slice(0, w.i).replace(/\*\*|`/g, "").length), w.len);
  return (w.field === "body" || w.field === "title" ? "" : `<b>${esc(w.field)}:</b> `) + highlight(text, hit.terms);
}
let RESTORE_SCROLL = 0; // a live update re-renders the results page; its rows arrive after the scroll was restored
async function viewSearch(main, linkScope, q) {
  const scope = canSearch(linkScope) ? linkScope : "project"; // a shared link may carry a scope this project cannot search: it falls back
  if (scope !== linkScope) { history.replaceState(null, "", searchHref(scope, q)); }
  const input = $("#search"); if (document.activeElement !== input) input.value = q;
  const terms = searchTerms(q);
  const sub = el("p", { class: "sub" }, "Searching…");
  const bar = el("span", { class: "search-scope", title: "where to search — the switch next to the project menu sets the graph and the lists, not the search" },
    ...Object.entries(SEARCH_SCOPES).filter(([k]) => canSearch(k)).map(([k, label]) => el("a", { href: searchHref(k, q), class: k === scope ? "on" : "" }, label)));
  main.append(el("div", { class: "search-head" }, el("h1", {}, "Search ", el("span", { class: "q" }, `“${q}”`)), bar), sub);
  if (terms.length === 0 || q.trim().length < 2) { sub.textContent = "Type at least two characters in the search field and press Enter."; return; }
  const pool = await searchPool(scope);
  if (location.hash !== searchHref(scope, q) && decodeURIComponent(location.hash) !== decodeURIComponent(searchHref(scope, q))) return; // navigated away meanwhile
  const rows = searchRows(pool, q);
  const shown = rows.filter(({ e }) => matches(e)).length;
  const projectsHit = new Set(rows.map((r) => r.g)).size;
  sub.textContent = `${plural(rows.length, "entry")} in ${plural(projectsHit, "project")}` +
    (scope !== "project" ? ` · ${plural(pool.groups.length, "project")} searched` : "") +
    (terms.length > 1 ? ` · all of: ${terms.join(", ")}` : "") +
    (filterActive() ? ` · ${shown} match the sidebar filters, the rest dimmed` : "") +
    " · searched: title, body, Revisit when, Source, Verification, Superseded by, Id, file, type, status, evidence";
  const box = el("div", { class: "search-page" });
  for (const g of pool.groups) {
    const mine = rows.filter((r) => r.g === g);
    if (!mine.length) continue;
    const m = g.member;
    const head = el("div", { class: "sg-head" },
      m.role === "self" ? el("b", {}, m.name) : el("a", { href: m.open || (PUBLISHED() ? publicHref(m.canonical, m.root || "") : `${location.pathname}?project=${encodeURIComponent(m.key)}#overview`) }, m.name),
      pill(memberLabel(m), "role"), el("span", { class: "count" }, plural(mine.length, "hit")));
    box.append(el("section", { class: "sgroup" }, head, m.scope ? el("div", { class: "ms note" }, m.scope) : null,
      el("div", { class: "entry-list" }, mine.map(({ e, hit }) => {
        const gt = e.git;
        const meta = [topicTitle(g.state, e.file), e.file, gt?.created?.author ? `${gt.created.author} · ${gt.created.date}` : null,
          gt?.last_touched?.date && gt.last_touched.date !== gt?.created?.date ? `touched ${gt.last_touched.date}` : null,
          e.uuid ? `Id ${e.uuid.slice(0, 8)}` : null, plural(hit.count, "match").replace("matchs", "matches")].filter(Boolean).join("  ·  ");
        return el("a", { href: g.href(e), class: `row ${matches(e) ? "" : "dim"}` },
          el("div", { class: "rt" }, el("span", { html: highlight(e.title.replace(/`/g, ""), hit.terms) }), ...entryPills(e)),
          el("div", { class: "rs", html: hitSnippet(hit) }),
          el("div", { class: "rm" }, meta));
      }))));
  }
  const wider = scope === "all" ? null : canSearch("all") ? "all" : scope === "project" && canSearch("family") ? "family" : scope === "project" && canSearch("friends") ? "friends" : null;
  if (!rows.length) box.append(el("p", { class: "center" }, `No entry matches “${q}”`, scope === "project" ? " in this project" : scope === "all" ? " in the family or the friends" : ` in the ${SEARCH_SCOPES[scope]}`,
    wider ? [" — ", el("a", { href: searchHref(wider, q) }, `search ${SEARCH_SCOPES[wider]}`)] : "", "."));
  if (pool.missing.length) box.append(el("section", { class: "sgroup missing" }, el("div", { class: "sg-head" }, el("b", {}, "Not searched"), el("span", { class: "count" }, pool.missing.length)),
    pool.missing.map(({ member: m, reason }) => el("div", { class: "sr-missing" }, el("b", {}, m.name), ` (${memberLabel(m)}) — ${reason}`)),
    el("p", { class: "note" }, [pool.missing.some(({ member: m }) => m.role !== "friend") ? "Family shows how to get a member that is not on this machine. " : "",
      pool.missing.some(({ member: m }) => m.role === "friend") ? "Friends lists the repositories the entries cite outside the family, and what could not be loaded." : ""].join("").trim())));
  main.append(box);
  if (RESTORE_SCROLL) main.scrollTop = RESTORE_SCROLL;
}
function setupSearch() {
  const input = $("#search"); const box = $("#search-results"); let sel = -1; let seq = 0;
  const close = () => { box.hidden = true; sel = -1; };
  const run = async () => {
    const q = input.value.trim(); if (q.length < 2 || !S) return close();
    const mine = ++seq;
    // the dropdown searches this project alone — on hand, nothing to fetch; the wider scopes are its last rows
    const pool = await searchPool("project");
    if (mine !== seq) return; // a newer keystroke won
    const all = searchRows(pool, q);
    const rows = all.slice(0, 12);
    const wider = Object.entries(SEARCH_SCOPES).filter(([k]) => k !== "project" && canSearch(k));
    // the wider scopes first, so they are in view however long the list of hits gets
    box.replaceChildren(...[...wider.map(([k, label]) => el("a", { class: "sr-all sr-scope", href: searchHref(k, q), onclick: close }, `Search in ${label}`)),
      el("div", { class: "sr-head" }, rows.length ? `Results in this project${all.length > rows.length ? ` (${rows.length} of ${all.length})` : ` (${all.length})`}` : "Results in this project"),
      ...(rows.length ? rows.map(({ e, hit, g }) => el("a", { href: g.href(e), onclick: close },
      el("div", { html: highlight(e.title.replace(/`/g, ""), hit.terms) }),
      el("div", { class: "sr-file" }, topicTitle(g.state, e.file)),
      el("div", { class: "sr-snip", html: hitSnippet(hit) }))) : [el("div", { style: "padding:10px 12px;color:var(--fg3)" }, "no matches in this project")]),
      el("a", { class: "sr-all", href: searchHref("project", q), onclick: close }, all.length > rows.length ? `↵  all ${all.length} results in this project` : "↵  results page")].filter(Boolean)); // replaceChildren writes a null as the text "null"
    box.hidden = false; sel = -1;
  };
  input.oninput = run; input.onfocus = () => { if (input.value.trim().length >= 2 && !location.hash.startsWith("#search/")) run(); };
  input.onkeydown = (ev) => {
    const items = [...box.querySelectorAll("a")];
    if (ev.key === "Escape") { input.blur(); close(); }
    else if (ev.key === "ArrowDown") { sel = Math.min(items.length - 1, sel + 1); items.forEach((a, i) => a.classList.toggle("sel", i === sel)); items[sel]?.scrollIntoView?.({ block: "nearest" }); ev.preventDefault(); }
    else if (ev.key === "ArrowUp") { sel = Math.max(0, sel - 1); items.forEach((a, i) => a.classList.toggle("sel", i === sel)); ev.preventDefault(); }
    else if (ev.key === "Enter") {
      ev.preventDefault();
      if (!box.hidden && items[sel]) { items[sel].click(); input.blur(); return; }
      const q = input.value.trim(); if (q.length < 2) return;
      seq++; close(); input.blur(); // Enter without a selection: the results page, this project
      location.hash = searchHref("project", q);
    }
  };
  document.addEventListener("click", (ev) => { if (!ev.target.closest(".topbar-right")) close(); });
  document.addEventListener("keydown", (ev) => {
    if (ev.target.matches("input,select,textarea") || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key === "/") { ev.preventDefault(); input.focus(); input.select(); }
    else if (ev.key === "g") location.hash = "#graph"; else if (ev.key === "l") location.hash = "#findings"; else if (ev.key === "o") location.hash = "#overview"; else if (ev.key === "q") location.hash = "#queues"; else if (ev.key === "t") location.hash = "#timeline"; else if (ev.key === "a") location.hash = "#authors";
  });
}

// ---------------------------------------------------------------- router + live
function render() {
  if (!S) return;
  const main = $("#main"); main.replaceChildren();
  const route = location.hash.slice(1) || "overview";
  selected = null;
  if (!route.startsWith("timeline")) { CLOCK = null; CLOCK_N = -1; stopPlay(); STAGE = null; } // the clock lives in the timeline; everywhere else the page shows today
  GLOBE.view = route === "globe"; $("#app").classList.toggle("globe", GLOBE.view); // the globe: the graph alone, full width
  if (GLOBE.view) setTimeout(globeIntro, 0); else GLOBE_INTRO_SHOWN = false; // explained on the way in, once per visit
  $("#details").dataset.pane = "other";
  if (!route.startsWith("graph") && route !== "globe") { const bar = pathBar(); if (bar) main.append(bar); } // the graph and the globe carry it as an overlay
  if (route === "overview") { viewOverview(main); renderDetailsDefault(); }
  else if (route === "graph/family") { setScope("family", { rerender: false }); setFamilyNeighbours(true); setFamilyEntries(true); history.replaceState(null, "", "#graph"); viewGraph(main); renderDetailsDefault(); } // an old link to the family graph: the family whole, in the graph and in the scope
  else if (route === "graph") { viewGraph(main); renderDetailsDefault(); }
  else if (route === "globe") { viewGraph(main); renderDetailsDefault(); }
  else if (route === "timeline" || route.startsWith("timeline/")) { viewTimeline(main, route.slice(9) || null); renderDetailsDefault(); }
  else if (route === "authors") { viewAuthors(main); renderDetailsDefault(); }
  else if (route === "queues") { viewQueues(main); renderDetailsDefault(); }
  else if (route === "findings") { viewFindings(main); renderDetailsDefault(); }
  else if (route === "family") { viewFamily(main); renderDetailsDefault(); }
  else if (route === "projects") { viewProjects(main); renderDetailsDefault(); }
  else if (route === "friends") { viewFriends(main); renderDetailsDefault(); }
  else if (route === "thoughts") { viewThoughtsPage(main); renderDetailsDefault(); }
  else if (route.startsWith("topic/")) viewTopic(main, route.slice(6));
  else if (route.startsWith("entry/")) viewEntry(main, decodeURIComponent(route.slice(6)));
  else if (route.startsWith("thought/")) viewThought(main, route.slice(8).split(",").filter(Boolean).map(decodeURIComponent));
  else if (route.startsWith("ref/")) { const cut = route.lastIndexOf("/"); viewRemoteEntry(main, decodeURIComponent(route.slice(4, cut)), route.slice(cut + 1)); renderDetailsDefault(); }
  else if (route.startsWith("search/")) { const [, scope, ...q] = route.split("/"); viewSearch(main, scope, decodeURIComponent(q.join("/"))); renderDetailsDefault(); }
  else { viewOverview(main); renderDetailsDefault(); }
  markActive(); applySide();
  if (!route.startsWith("graph")) { main.scrollTop = 0; if (narrow()) { const stuck = $("#sidebar").getBoundingClientRect().height; window.scrollTo(0, Math.max(0, main.getBoundingClientRect().top + window.scrollY - stuck - 8)); } }
}
function rerender() { renderSidebar(); renderStrip(); renderCounts(); render(); }
// With the family scope every view shows the family merged; the merge needs
// the members' states, so it runs after them — the last merge is kept, so a
// live update of this project re-merges at once and refreshes behind it.
let LAST_POOL = null; let MERGE_SEQ = 0;
function mergeWith(pool) { S = mergeStates([{ ...pool.groups[0], state: SELF }, ...pool.groups.slice(1)]); S.missing = pool.missing; }
async function showScope() {
  const mine = ++MERGE_SEQ;
  if (!SELF) return; // no state yet: the first applyState merges when it arrives
  if (scope() !== "family") { S = SELF; LAST_POOL = null; return rerender(); }
  if (LAST_POOL) { mergeWith(LAST_POOL); rerender(); }
  const pool = await searchPool("family");
  if (mine !== MERGE_SEQ || scope() !== "family") return;
  LAST_POOL = pool; const keep = $("#main").scrollTop; mergeWith(pool); rerender(); $("#main").scrollTop = keep;
}
// the numbers in the status bar follow what is shown
function renderCounts() { const c = $("#counts"); if (c) c.textContent = `${S.entries.length} entries · ${S.topics.length} topics · ${S.authors.length} authors${S.merged ? ` · family of ${S.family.length}` : ""}`; }
// A Git author as a link to their profile on the host: the host's API names
// the account behind one of their commits (asked on click, in the browser);
// when it cannot, the commit's page opens, where the host links the author.
const AUTHOR_URLS = {};
function authorCommit(name) {
  // the newest commit of this author among the entries shown, and the project it is in
  let best = null;
  for (const e of S.entries) for (const c of [e.git?.created, e.git?.last_touched, ...(e.git?.status_history || [])]) if (c?.author === name && c.commit && (!best || (c.date || "") > (best.c.date || ""))) best = { c, e };
  return best ? [best.c.commit, best.e.origin?.state?.project || SELF.project] : [null, null];
}
function authorLink(name, commit, project) {
  const look = !S.anonymized && project ? authorLookup(canonicalOf(project), commit) : null;
  if (!name || !look) return el("span", {}, name || "—");
  const key = `${canonicalOf(project)}|${name}`;
  return el("a", { class: "author", href: AUTHOR_URLS[key] || look.fallback, target: "_blank", rel: "noopener", title: `${name} — open the profile on the host (looked up from commit ${commit})`, onclick: async (ev) => {
    ev.stopPropagation();
    if (AUTHOR_URLS[key] || !look.api) return; // known, or a host whose API names no account: the link goes straight there
    ev.preventDefault();
    const w = window.open("about:blank", "_blank"); if (w) w.opener = null;
    let url = look.fallback;
    try { const r = await fetch(look.api, { headers: { Accept: "application/json" } }); if (r.ok) url = look.pick(await r.json()) || look.fallback; } catch { /* offline or rate-limited: the commit page names the author too */ }
    if (url !== look.fallback) AUTHOR_URLS[key] = url;
    ev.target.closest("a").href = url;
    if (w) w.location.href = url; else window.open(url, "_blank", "noopener");
  } }, name);
}
// The badges, ready to paste: the static one, and the two live ones from this project's published export
// (`dashboard-state`), each as Markdown and HTML with a copy button. Pointed at, the ⚙ beside the search shows them.
function renderBadges() {
  const pop = $("#badges-pop"); if (!pop || !S) return;
  const st = SELF?.project?.dashboard_state || S.project?.dashboard_state || "";
  const base = /^https:\/\//.test(st) ? st.replace(/state\.json$/, "") : "";
  const list = [{ name: "Keep the Why", img: "https://keepthewhy.com/assets/badge.svg", href: "https://keepthewhy.com", alt: "Keep the Why" }];
  if (base) list.push({ name: "live", img: `${base}badge-entries.svg`, href: base, alt: "Keep the Why · live" }, { name: "live, flat", img: `${base}badge-entries-flat.svg`, href: base, alt: "keep the why" });
  const field = (label, text) => {
    const b = el("button", { type: "button", class: "link-btn", onclick: async () => { const ok = await copyText(text); b.textContent = ok ? "✓" : "✗"; setTimeout(() => { b.textContent = "copy"; }, 1500); } }, "copy");
    return el("div", { class: "badge-field" }, el("span", { class: "note" }, label), el("input", { type: "text", readonly: true, value: text, onfocus: (ev) => ev.target.select() }), b);
  };
  setKids(pop, el("b", {}, "Badges"),
    ...list.map((x) => el("div", { class: "badge-item" },
      el("a", { href: x.href, target: "_blank", rel: "noopener" }, el("img", { src: x.img, alt: x.alt })),
      field("MD", `[![${x.alt}](${x.img})](${x.href})`),
      field("HTML", `<a href="${x.href}"><img alt="${x.alt}" src="${x.img}"></a>`))),
    base ? null : el("p", { class: "note" }, "The live badges come with a published export — a dashboard-state line in .keep-the-why."));
}
function applyState(state) {
  SELF = state; S = state;
  const p = S.project;
  setKids($("#project-title"), $("#project-select").hidden ? el("b", {}, p.id || p.name) : null, schemaPill(p), headPill(p.git), p.git?.remote ? el("span", { class: "pill" }, remoteLink(p.git.remote)) : null, forkPill(p.git));
  document.title = `Keep the Why Dashboard · ${p.id || p.name}`;
  setKids($("#statusbar"),
    el("span", { id: "pkg-dashboard" }, el("a", { href: "https://pypi.org/project/keep-the-why-dashboard/", target: "_blank", rel: "noopener", title: "keep-the-why-dashboard on PyPI" }, `keep-the-why-dashboard ${S.dashboard}`)),
    el("span", { id: "pkg-lint" }, el("a", { href: "https://pypi.org/project/keep-the-why-lint/", target: "_blank", rel: "noopener", title: "keep-the-why-lint on PyPI" }, `keep-the-why-lint ${S.linter}`)),
    el("span", {}, MODE === "public" ? `public export · generated ${S.generated}` : S.exported ? `exported ${S.generated}` : `state ${S.generated}`),
    el("span", { id: "counts" }, `${S.entries.length} entries · ${S.topics.length} topics · ${S.authors.length} authors`),
    liveUi(), loadedUi(),
    el("span", { class: "grow" }, el("a", { href: "https://keepthewhy.com", target: "_blank", rel: "noopener" }, "keepthewhy.com")));
  renderBadges();
  renderLoaded();
  FAMILY = null;
  if (LIVE()) $("#nav-projects").hidden = false;
  setupMode(); markScope();
  const main = $("#main"); const scroll = main.scrollTop;
  RESTORE_SCROLL = scroll;
  if (scope() === "family") { if (LAST_POOL) mergeWith(LAST_POOL); showScope(); }
  rerender();
  main.scrollTop = scroll;
  markUpdates();
}
let UPDATES = null; // /api/updates result; null until fetched, never in export mode
function markUpdates() {
  if (!UPDATES?.packages) return;
  for (const [name, id] of [["keep-the-why-dashboard", "pkg-dashboard"], ["keep-the-why-lint", "pkg-lint"]]) {
    const info = UPDATES.packages[name]; const span = $(`#${id}`); if (!info || !span) continue;
    const a = span.querySelector("a");
    span.classList.toggle("outdated", !!info.outdated);
    if (info.outdated) { a.title = `${name} ${info.latest} is on PyPI — installed ${info.installed}. Update: pip install -U ${name}`; a.textContent = `${name} ${info.installed} → ${info.latest}`; }
    else if (a) a.title = `${name} on PyPI${info.latest ? ` — ${info.latest} is the newest, you are current` : ""}`;
  }
}
window.__ktwApplyUpdates = (u) => { UPDATES = u; markUpdates(); }; // test hook (jsdom smoke), not used by the page
async function pollUpdates() {
  if (window.__KTW_STATE__) return;
  try { UPDATES = await (await fetch("/api/updates", { cache: "no-store" })).json(); markUpdates(); } catch { /* server gone; the live dot says so */ }
}
let LIVE_ES = null;
function connectLive() {
  if (LIVE_ES) { LIVE_ES.close(); LIVE_ES = null; }
  if (window.__KTW_STATE__ && MODE === "export") { setLive("export", "export", "static export — the state when it was exported, no live updates"); return; }
  if (!LIVE()) { setLive("export", "public export", "public export — read from the published state.json, no live updates"); return; }
  let es;
  const open = () => {
    es = LIVE_ES = new EventSource(api("/api/events"));
    es.addEventListener("state", (ev) => { try { applyState(normalizeState(JSON.parse(ev.data))); setLive("on", "live", `live — last update ${new Date().toLocaleTimeString()}`); } catch (err) { console.error(err); } });
    es.onopen = () => setLive("on", "live", "live — the server watches the project and sends every change");
    es.onerror = () => setLive("off", "offline", "connection lost — the server is gone; retrying");
  };
  open();
}
// The side pane's width: 1×, 2× (the default), 3×, or half the page beside
// the text — kept per browser, ignored on a narrow screen. Two widths: one
// where the pane is the graph (the overview, the Friends and Thoughts pages,
// the reader), one where it holds something else (an entry's or a topic's
// details, the graph view's legend).
const SIDE_WIDTHS = ["1", "2", "3", "half"];
const readSide = (key, fallback = "2") => { try { const v = localStorage.getItem(key); return SIDE_WIDTHS.includes(v) ? v : fallback; } catch { return fallback; } };
const SIDE = { graph: readSide("ktw-side-graph", readSide("ktw-side")), other: readSide("ktw-side-other"), timeline: readSide("ktw-side-timeline", "1") };
// three kinds of pane, each with its own remembered width: the graph beside a page, the graph beside the timeline (narrower by default — the stage wants the room), anything else
const paneKind = () => ($("#details")?.dataset.pane === "graph" ? (location.hash.startsWith("#timeline") ? "timeline" : "graph") : "other");
const sideLabel = (v) => (v === "half" ? "½" : `${v}×`);
function applySide() {
  const v = SIDE[paneKind()];
  $("#app").dataset.side = v;
  const d = $("#details");
  if (d && !d.querySelector(":scope > .pane-width")) d.prepend(paneWidthBar());
  for (const b of document.querySelectorAll(".mini-width button")) b.classList.toggle("on", b.textContent === sideLabel(v));
  for (const G of ACTIVE_GRAPHS) G.wake?.();
}
function setSide(v) { const k = paneKind(); SIDE[k] = v; try { localStorage.setItem(`ktw-side-${k}`, v); } catch {} applySide(); }
// the choice sits at the top of the pane, above whatever it holds, on every page
function paneWidthBar() {
  return el("div", { class: "pane-width", title: "the width of this pane: 1×, 2×, 3×, or half the page — one width where the pane is the graph, one where it holds details" },
    el("span", { class: "label" }, "Width"),
    el("span", { class: "mini-width" }, ...SIDE_WIDTHS.map((v) => el("button", { type: "button", class: v === SIDE[paneKind()] ? "on" : "", onclick: () => setSide(v) }, sideLabel(v)))));
}
function setupSideToggle() {
  const btn = $("#side-toggle"); const app = $("#app");
  btn.onclick = () => { const open = app.classList.toggle("side-open"); btn.setAttribute("aria-expanded", String(open)); btn.textContent = open ? "Topics ▴" : "Topics ▾"; };
  window.addEventListener("hashchange", () => { if (narrow() && app.classList.contains("side-open")) btn.click(); });
}
function setupTheme() {
  const saved = localStorage.getItem("ktw-theme");
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  if (saved === "light" || (!saved && prefersLight)) document.documentElement.dataset.theme = "light";
  $("#theme").onclick = () => { const light = document.documentElement.dataset.theme === "light"; if (light) delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = "light"; localStorage.setItem("ktw-theme", light ? "dark" : "light"); if (graph) { graph.alpha = Math.max(graph.alpha, 0.05); graph.wake?.(); } };
}
function fitSelect(sel) {
  // size the select to its current option's text, not the browser's default width
  const opt = sel.selectedOptions[0]; if (!opt) return;
  const probe = el("span", { style: "position:absolute;visibility:hidden;white-space:nowrap;font:inherit" }, opt.textContent);
  sel.parentElement.append(probe); const w = probe.getBoundingClientRect().width; probe.remove();
  if (w) sel.style.width = `${Math.ceil(w) + 44}px`;
}
async function setupProjects() {
  if (window.__KTW_STATE__) return;
  let data;
  try { data = await (await fetch("/api/projects", { cache: "no-store" })).json(); } catch { return; }
  const sel = $("#project-select");
  const list = data.projects || [];
  if (list.filter((p) => p.path).length < 2 && !list.some((p) => !p.path)) return;
  const current = PROJECT || data.selected;
  PROJECTS = list;
  const opt = (p, indent = "") => el("option", { value: p.key, selected: p.key === current, disabled: !p.path, title: p.path || "location unknown — start the dashboard in that project once, or pass --scan" },
    p.path ? `${indent}${p.name}  (${p.kind === "cache" ? "cache, read only" : "repository"})${p.source === "cwd" ? "  · here" : ""}` : `${p.id}  (location unknown)`);
  // families grouped: a parent, its children indented below it (children found by canonical or path)
  const flat = groupByFamily(list);
  const groups = [["Projects", flat.filter(([p]) => p.path)], ["Known, location unknown", flat.filter(([p]) => !p.path)]];
  sel.replaceChildren(...groups.filter(([, items]) => items.length).map(([label, items]) => el("optgroup", { label }, items.map(([p, d]) => opt(p, "\u00a0\u00a0".repeat(d) + (d ? "└ " : ""))))));
  sel.hidden = false;
  fitSelect(sel);
  if (S) { const t = $("#project-title").querySelector("b"); if (t) t.remove(); }
  sel.onchange = () => { location.href = `${location.pathname}?project=${encodeURIComponent(sel.value)}${location.hash || "#overview"}`; };
  SELECTED_DEFAULT = data.selected;
}
function setupMode() {
  const box = $("#mode"); const p = S.project;
  const canonical = canonicalOf(p);
  // two sources exist only on the live server: this machine's clones, or the
  // published exports. A static page has one — it is published — so no switch
  const hasFamily = !!(p.parent || (p.children || []).length || p.dashboard_state);
  if (STATIC || (!hasFamily && MODE !== "public")) { box.hidden = true; return; }
  box.hidden = false;
  for (const b of box.querySelectorAll("button")) {
    const on = b.dataset.mode === (MODE === "public" ? "public" : "local");
    b.classList.toggle("on", on);
    b.disabled = b.dataset.mode === "public" && !canonical;
    b.title = b.dataset.mode === "public" ? (canonical ? "read this project's family from its published exports" : "no canonical — cannot be looked up publicly") : "read clones and caches on this machine";
    b.onclick = () => {
      if (on) return;
      if (b.dataset.mode === "public") location.href = publicHref(canonical, p.root || "", location.hash || "#overview");
      else location.href = `${location.pathname}${location.hash || "#overview"}`;
    };
  }
  $("#mode-note").textContent = MODE === "public" ? `generated ${S.generated}` : "";
}
async function boot() {
  setupTheme(); setupSearch(); setupScope(); setupSideToggle();
  window.addEventListener("hashchange", () => { RESTORE_SCROLL = 0; render(); });
  window.addEventListener("popstate", onPopState);
  document.addEventListener("click", onLinkClick);
  if (MODE === "public") {
    const r = await fetchPublicState(PUBLIC, PUBLIC_ROOT);
    setLive("export", "public export", "public export — read from the published state.json, no live updates");
    if (!r.state) {
      const msg = el("div", { class: "center" }, el("p", {}, `Cannot browse ${PUBLIC} publicly: ${r.error}.`));
      $("#main").append(msg);
      if (r.missingLine) {
        // the live server may know a local checkout that already carries the line, on a branch the default branch has not merged
        try {
          const local = ((await (await fetch("/api/projects", { cache: "no-store" })).json()).projects || []).find((p) => p.canonical === PUBLIC && p.dashboard_state);
          if (local) msg.append(el("p", { class: "note" }, `Your checkout at ${local.path} names ${local.dashboard_state} — on a branch that is not on the default branch yet. Public mode reads what is published: the line counts once it is merged, and the family once the published export carries it.`));
        } catch { /* not served by a live dashboard */ }
      }
      msg.append(el("p", {}, el("a", { href: location.pathname }, "back to local")));
      return;
    }
    r.state.exported = true;
    applyState(r.state);
    return;
  }
  setupProjects();
  if (window.__KTW_STATE__) { noteLoaded(location.href.split("#")[0], JSON.stringify(window.__KTW_STATE__), "page", { own: true }); applyState(normalizeState(window.__KTW_STATE__)); }
  else {
    try { const text = await (await fetch(api("/api/state.json"), { cache: "no-store" })).text(); noteLoaded(new URL(api("/api/state.json"), location.href).href, text, "state", { own: true }); applyState(normalizeState(JSON.parse(text))); }
    catch (err) { $("#main").append(el("p", { class: "center" }, PROJECT ? `No state for project "${PROJECT}" — unknown id or unknown location.` : "Could not load the state — is the server running?")); }
  }
  connectLive();
  pollUpdates(); setTimeout(pollUpdates, 20000); // the server's first check may still be running at boot
  setInterval(pollUpdates, 60 * 60 * 1000);
}
boot();
