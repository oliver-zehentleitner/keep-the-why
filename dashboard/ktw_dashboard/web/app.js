/* Keep the Why dashboard — this module and the classic scripts in ktw-views.json (ktw-core.js), no dependencies.
   The page knows only the state (see state.py): live from /api/events, or
   embedded as window.__KTW_STATE__ in an export. It renders; it never writes. */

const { esc, plural, typeName, UUID_RE, isUuid, rawFileUrl, configLine, normalizeState, slug, hostFileLink, hostTreeLink, canonicalOf, parseSupersededBy, kindLabel, groupByFamily, familyRank, familyOrder, searchTerms, searchHit, registryMatches, shuffled, compareHits, snippetAt, highlightParts, resolveLocation, linkFamily, authorLookup, mergeStates, friendsOf, thoughtsOf, thoughtInsights, hostOf, projectLabel, backlinksUrl, citingOf, hostAnchor, todayISO, addDays, dayDiff, timeGrid, stampLabel, existsAt, statusAt, seeDay, supersededDay, linkExistsAt, daySpan, createdOn, TYPE_KINDS, TYPE_TOKENS, paletteToken, typeKind, SHELF, stageCards, stageLinks, markLinked, stageLanes, logDepth, percentileBox, pushApart, stageHeight, mergeAuthors, sortAuthors, AUTHOR_SORTS, ownerOf, exportStateUrl, exportVerdict, resolveSee, layoutTick , NO_FILTER, filterActive, entryMatches, fkey } = globalThis.KeepTheWhy.core; // ktw-core.js, loaded before this module
const MD = globalThis.KeepTheWhy.markdown; // ktw-markdown.js

// ---------------------------------------------------------------- prefs (host)
// The settings a reader makes — the graph's switches, the pane widths, the
// timeline's arrangement, the theme — kept per browser. The views ask prefs by
// a short name ("friends") for a string or the fallback they name, and set a
// string; this dashboard keeps each in localStorage as ktw-<name>, the names
// they have always had, so nobody's settings are reset. Storage that is
// blocked or full (a private window, a preview) reads as the fallback and
// keeps nothing. Another host hands the views a prefs of its own.
const prefs = {
  get(key, fallback) { try { const v = localStorage.getItem(`ktw-${key}`); return v == null ? fallback : v; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`ktw-${key}`, value); } catch {} },
};
// ---------------------------------------------------------------- end of prefs (host)

// ---------------------------------------------------------------- nav (host)
// The dashboard's navigation, and the one place the page reads or writes its
// own address. The views name places by route (ktw-core.js, routes) and ask nav
// for a link (href), a move (go), where the page is (current) or to be told
// when that changes (onChange); this dashboard writes a route as today's hash
// on location.hash, so every link and bookmark keeps working. A route with a
// `centre` is a place in another project — its published export (?public=) or
// another project on this machine (?project=) — reached as a link is. Another
// host hands the views a nav of its own and never sees this grammar.
const ROUTES = globalThis.KeepTheWhy.core.routes;
const QUERY = new URLSearchParams(location.search); // the centre the page was opened on
const pagePath = () => location.pathname;
const pageUrl = () => location.href.split("#")[0];
// the page's address for a centre: ?public= for a published export, ?project= for a project on this machine
function centreUrl(c) {
  if (c.mode === "public") return `${pagePath()}?public=${encodeURIComponent(c.canonical)}${c.root ? `&root=${encodeURIComponent(c.root)}` : ""}`;
  if (c.mode === "live" && c.project) return `${pagePath()}?project=${encodeURIComponent(c.project)}`;
  return pagePath();
}
const nav = {
  href: (route) => (route.centre ? centreUrl(route.centre) : "") + ROUTES.format(route),
  go(route, { replace = false } = {}) {
    if (route.centre) { location.href = nav.href(route); return; }
    const hash = ROUTES.format(route);
    if (replace) history.replaceState(null, "", hash); else location.hash = hash;
  },
  current: () => ROUTES.parse(location.hash),
  onChange: (fn) => window.addEventListener("hashchange", () => fn(nav.current())),
  // follow an address nav.href made (a graph node carries its own): a place on this page, or another page
  open(href) { if (href.startsWith("#")) nav.go(ROUTES.parse(href)); else location.href = href; },
};
const onView = (...views) => { const r = nav.current(); return !r.alias && !r.unknown && views.includes(r.view); };
// a link to a place: a real anchor — middle-click, a new tab and a screen reader work — whose plain click moves
// through nav. `href` in attrs is the route; it keeps its place among the attributes, so the markup is as before.
function navLink(attrs, ...kids) {
  const route = attrs.href; const own = attrs.onclick;
  return el("a", { ...attrs, href: nav.href(route), onclick: (ev) => {
    own?.(ev);
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || attrs.target) return;
    ev.preventDefault(); nav.go(route);
  } }, ...kids);
}
// The host's own moves, for what is not a place: an address nav.href made
// (a graph node's), a walk to another centre in place, a reload, and whether
// the page is on this machine.
const go = (href) => nav.open(href);
const pushUrl = (url, state) => history.pushState(state, "", url);
const onWalk = (fn) => window.addEventListener("popstate", fn); // back and forward between centres (onPopState)
const reloadPage = () => location.reload();
const isLocalPage = () => /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/.test(location.hostname) || location.protocol === "file:";
// below this block the page asks nav where it is and where to go, and touches neither the hash nor the history
// ---------------------------------------------------------------- end of nav (host)

const $ = (sel, root = document) => root.querySelector(sel);
const narrow = () => !!window.matchMedia?.("(max-width: 900px)").matches;
const fmtDate = (d) => d || "—";
// the platform's mark before a repository's name, from its URL (ktw-core.js HOSTS);
// none for a host no row knows
function hostMark(url) {
  const h = hostOf(url); if (!h) return null;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("class", "host-mark"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", h.name);
  // the name as aria-label, not as an SVG title element: that would join the link's text
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); path.setAttribute("d", h.path);
  svg.append(path); return svg;
}
// the "opens elsewhere" mark after a link that leaves the page: a box with an arrow out of it
function extIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("class", "ext-icon"); svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z");
  svg.append(path); return svg;
}
const extLink = (href, text, cls = "") => el("a", { class: `ext ${cls}`.trim(), href, target: "_blank", rel: "noopener" }, text, extIcon());
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
let PUBLIC = QUERY.get("public"); // a canonical: browse that project's published export
let PUBLIC_ROOT = QUERY.get("root") || "";
let MODE = PUBLIC ? "public" : window.__KTW_STATE__ ? "export" : "live";
const LIVE = () => MODE === "live";
// A static page (an export on a docs site, on a phone) is public by nature: it
// has no machine to read, so it has no local/public switch, and its family —
// like public mode's — comes from the members' published exports, fetched
// when someone asks for the family, never before.
const STATIC = !!window.__KTW_STATE__;
const PUBLISHED = () => MODE === "public" || MODE === "export";
const MY_ROOT = () => (MODE === "export" ? SCENE.self?.project?.root || "" : PUBLIC_ROOT);
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
    G.own ||= !!r.own || (!!r.project && r.project === SCENE.self?.project?.id); // the centre, however it arrived (embedded, local server, public mode)
    const m = String(url).match(/\/api\/state\.json\?project=([^&#]+)/);
    G.dashboard = G.own ? null : m ? `${pagePath()}?project=${m[1]}#overview` : dirOf(url);
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
      G.dashboard ? el("a", { class: "dash", href: G.dashboard, target: G.dashboard.startsWith(pagePath()) ? null : "_blank", rel: "noopener", title: "this project's dashboard" }, "dashboard ↗") : null,
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
// ---------------------------------------------------------------- provider: every request the page makes
// The views read data only through the provider interface (context/dashboard.md, the library entry):
// state, subscribe, bodies, family, memberState, exportState, resolveEntry, authorProfile, backlinks.
// Every method but state is optional: provider() leaves out what the current mode cannot answer — a
// family, a member's state and an Id's project need the live server — and a feature whose method is
// absent hides. What a result means (an export that claims another repository, a fork) is decided in
// ktw-core.js; how it travels (timeouts, size caps, CORS wording, the state monitor) stays here. HOST
// holds what only the dashboard's own shell asks for: the project menu, forget, the update check, the
// registry for the globe and its search. Nothing else in this file makes a request (test_views.py).
//
// Every result says where it came from: `url`, and for a project `canonical`, `root`, `forkOf` as they
// apply; a failure is `error` beside them, never a throw. `loaded` lists the files read to make it — url,
// text, kind — and `failed` the files read and refused (a .keep-the-why without a dashboard-state line, an
// export that claims another repository); provider() hands both to the state monitor, loaded first: a file
// that was read and then refused ends up among the failures. Transport failures fetchForeign records itself.
async function fetchForeign(url) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), FOREIGN_TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    if (Number(res.headers?.get?.("content-length") || 0) > FOREIGN_MAX_BYTES) throw new Error(`${url} is larger than ${FOREIGN_MAX_BYTES / 1024 / 1024} MB`);
    const text = await res.text();
    if (text.length > FOREIGN_MAX_BYTES) throw new Error(`${url} is larger than ${FOREIGN_MAX_BYTES / 1024 / 1024} MB`);
    return text; // what was read is recorded by the provider's caller, from the result's `loaded`
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
const absolute = (url) => new URL(url, location.href).href;
const failure = (err, fallback) => err?.message || fallback;
const DASHBOARD = {
  // this page's own project: { state, url } — the state embedded in an export, or the live server's
  async state() {
    if (window.__KTW_STATE__) {
      const url = location.href.split("#")[0];
      return { state: normalizeState(window.__KTW_STATE__), url, loaded: [{ url, text: JSON.stringify(window.__KTW_STATE__), kind: "page", extra: { own: true } }] };
    }
    const url = absolute(api("/api/state.json"));
    try {
      const text = await (await fetch(url, { cache: "no-store" })).text();
      return { state: normalizeState(JSON.parse(text)), url, loaded: [{ url, text, kind: "state", extra: { own: true } }] };
    } catch (err) { return { error: failure(err, "could not load the state"), url }; }
  },
  // every change of this project, as the server sends it: onState({ state, url }); returns the function that stops listening
  subscribe(onState, onStatus) {
    const url = absolute(api("/api/events"));
    const es = new EventSource(url);
    es.addEventListener("state", (ev) => { try { onState({ state: normalizeState(JSON.parse(ev.data)), url }); } catch (err) { console.error(err); } });
    es.onopen = () => onStatus("open");
    es.onerror = () => onStatus("error");
    return () => es.close();
  },
  // An export since dashboard 0.6.0 keeps its entries' bodies in state.body.json beside state.json (`bodies`
  // names it) — three quarters of the file, read only when an entry is shown. The graph, the globe and the
  // registry never need them; the centre, the merged family's search and the thought reader do, and ask here
  // first. An older export carries its bodies inline and has no `bodies` field; nothing to fetch then.
  // { state, url } with the bodies filled in, or { state, url, error } with them missing; asked twice, one fetch.
  bodies(state) {
    if (!state || typeof state.bodies !== "string" || !state.__url) return Promise.resolve({ state, url: state?.__url || null });
    if (state.__bodies) return state.__bodies;
    const url = new URL(state.bodies, state.__url).href;
    state.__bodies = fetchForeign(url).then((text) => {
      const got = JSON.parse(text).bodies || {};
      for (const e of state.entries) { const b = got[e.id]; if (b != null) e.body = b && typeof b === "object" ? b : { text: String(b || ""), reason: "" }; }
      state.bodiesLoaded = true;
      return { state, url, loaded: [{ url, text }] };
    }).catch((err) => { state.bodiesError = failure(err, "could not fetch the bodies"); return { state, url, error: state.bodiesError }; });
    return state.__bodies;
  },
  // the family the live server knows — this project's (or `project`'s), the whole tree with `tree`: { members, url }
  async family({ project = PROJECT, tree = false } = {}) {
    const q = [project ? `project=${encodeURIComponent(project)}` : "", tree ? "tree=1" : ""].filter(Boolean).join("&");
    const url = absolute(`/api/family${q ? `?${q}` : ""}`);
    try { return { members: (await (await fetch(url, { cache: "no-store" })).json()).members || [], url }; }
    catch (err) { return { error: failure(err, "could not load the family"), url }; }
  },
  // a project the live server knows, by its key: { state, url, key }
  async memberState(key) {
    const url = absolute(`/api/state.json?project=${encodeURIComponent(key)}`);
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      return { state: normalizeState(JSON.parse(text)), url, key, loaded: [{ url, text, kind: "state" }] };
    } catch (err) { return { error: `could not load its state (${failure(err, "server gone")})`, url, key }; }
  },
  // A repository's published export, found through its .keep-the-why at HEAD: { state, url, canonical, root,
  // raw, forkOf? } or { error, canonical, root, raw, missingLine? }. The verdicts are ktw-core.js's
  // (exportStateUrl, exportVerdict).
  async exportState(canonical, root = "") {
    let url = "";
    const raw = rawFileUrl(canonical, root, ".keep-the-why");
    const loaded = [];
    const read = async (u) => { const text = await fetchForeign(u); loaded.push({ url: u, text }); return text; };
    try {
      const found = exportStateUrl(await read(raw), raw);
      if (found.error) return { ...found, canonical, root, raw, loaded, failed: [{ url: raw, error: found.error, extra: { canonical } }] };
      url = found.url;
      const state = normalizeState(JSON.parse(await read(url)));
      state.__url = url; // where it came from: its bodies, if kept beside it, resolve against this
      const verdict = exportVerdict(state, canonical, url);
      if (verdict.error) return { error: verdict.error, url, canonical, root, raw, loaded, failed: [{ url, error: verdict.error, extra: { canonical } }] };
      return { state, url, canonical, root, raw, ...(verdict.forkOf ? { forkOf: verdict.forkOf } : {}), loaded };
    } catch (err) {
      for (const u of [raw, url]) { const f = u && FAILED.get(u); if (f) f.canonical = canonical; } // the failed fetch belongs to this repository
      renderLoaded();
      return { error: `could not fetch the export: ${failure(err, "network error or blocked by CORS")}`, ...(url ? { url } : {}), canonical, root, raw, loaded };
    }
  },
  // which project the live server knows carries this Id: { project, entry, url }; not known there is an error
  async resolveEntry(uuid) {
    const url = absolute(`/api/entry?uuid=${encodeURIComponent(uuid)}${PROJECT ? `&project=${encodeURIComponent(PROJECT)}` : ""}`);
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return { error: `no project known here carries ${uuid}`, url };
      const hit = await r.json();
      return { project: hit.project, entry: hit.entry, url };
    } catch (err) { return { error: failure(err, "server gone"), url }; }
  },
  // a commit author's profile on the host, looked up when asked for: { profile, url }; a host whose API
  // does not name the account answers { profile: null }
  async authorProfile(canonical, sha) {
    const look = authorLookup(canonical, sha);
    if (!look?.api) return { profile: null, url: null };
    try {
      const r = await fetch(look.api, { headers: { Accept: "application/json" } });
      return { profile: r.ok ? look.pick(await r.json()) || null : null, url: look.api };
    } catch (err) { return { error: failure(err, "offline or rate-limited"), url: look.api }; }
  },
  // who in the registry cites this repository: { file, url }; no file is an answer (nobody does), not a failure
  async backlinks(canonical) {
    const url = backlinksUrl(REGISTRY_URL, canonical);
    try { const text = await fetchForeign(url); return { file: JSON.parse(text), url, loaded: [{ url, text }] }; } catch (err) {
      if (!/HTTP 404/.test(err?.message || "")) return { error: failure(err, "network"), url };
      FAILED.delete(url);
      return { file: { cited_by: [] }, url };
    }
  },
};
// the state monitor reads what a result says it loaded and refused, once per result — loaded first, since
// noting a file as loaded clears it from the failures, and a refused file was loaded before it was refused
const TRACED = new WeakSet();
function trace(result) {
  if (result && typeof result === "object" && !TRACED.has(result)) {
    TRACED.add(result);
    for (const l of result.loaded || []) noteLoaded(l.url, l.text, l.kind, l.extra);
    for (const f of result.failed || []) noteFailed(f.url, f.error, f.extra);
  }
  return result;
}
const traced = (fn) => (...args) => Promise.resolve(fn(...args)).then(trace);
// the methods the current mode can answer; the rest are absent
function provider() {
  const live = LIVE();
  return {
    state: traced(DASHBOARD.state), bodies: traced(DASHBOARD.bodies), exportState: traced(DASHBOARD.exportState),
    authorProfile: DASHBOARD.authorProfile, backlinks: traced(DASHBOARD.backlinks),
    subscribe: live ? DASHBOARD.subscribe : undefined, family: live ? DASHBOARD.family : undefined,
    memberState: live ? traced(DASHBOARD.memberState) : undefined, resolveEntry: live ? DASHBOARD.resolveEntry : undefined,
  };
}
// what only the dashboard's shell asks for — no view does
const HOST = {
  async projects() { return (await fetch("/api/projects", { cache: "no-store" })).json(); },
  async forget(key) { await fetch("/api/projects/forget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) }); },
  async updates() { return (await fetch("/api/updates", { cache: "no-store" })).json(); },
  async registryIndex(url) { const text = await fetchForeign(url); noteLoaded(url, text); return JSON.parse(text); },
};
// ---------------------------------------------------------------- provider end
// the page's caches over the provider: one request per project, however many ask at once
function fetchPublicState(canonical, root = "") {
  const key = `${canonical}|${root}`;
  return (PUBLIC_STATES[key] ||= provider().exportState(canonical, root));
}
const ensureBodies = (state) => provider().bodies(state).then((r) => r.state);
const publicHref = (canonical, root = "", hash = "#overview") => centreUrl({ mode: "public", canonical, root }) + hash;

// ---------------------------------------------------------------- state
// The scene (ktw-scene.js): what every view on the page shares — SCENE.state, what the page shows (this project,
// or with the family scope the whole family merged, ktw-core.js mergeStates); SCENE.self, this project's own
// state, always; SCENE.day, the clock; SCENE.focus, SCENE.scope, the layout — and the events views follow.
// DOM helpers, pills and glyphs every view uses (ktw-ui.js): no state, only nodes
const { el, setKids, pill, statusPill, evPill, typePills, entryPills, typeGlyphSvg } = globalThis.KeepTheWhy.ui;
const SCENE = globalThis.KeepTheWhy.scene.create({ scope: prefs.get("scope") || prefs.get("search-scope") || "project" }); // search-scope: the name before the scope switched the graph too
// The graph view (ktw-graph.js): it draws what the host builds, given the scene, navigation and settings only.
const GRAPH = globalThis.KeepTheWhy.views.graph.create({ scene: SCENE, nav, prefs });
const { run: runGraph, lightThought, spotIn, projectNodes, miniView, driftOn, setDrift, setLabels } = GRAPH;
// The timeline's stage (ktw-timeline.js): the same three, and the page around it stays here.
const TIMELINE = globalThis.KeepTheWhy.views.timeline.create({ scene: SCENE, nav, prefs });
let PROJECT = QUERY.get("project"); // null: the server's SCENE.selected one
const api = (path) => PROJECT ? `${path}?project=${encodeURIComponent(PROJECT)}` : path;
// The clock: the day the page shows — the timeline's playhead. Set while the timeline is open, null
// everywhere else. Every graph on the page follows it: only what existed on that day, with the status it
// had then, and the See and Superseded by lines that had been written by then (ktw-core.js, existsAt and friends).
// an entry of this project goes by this project's repository: with one, an entry without a Git date is not committed
// yet and exists today only; without one there are no days to go by. A foreign entry's export came from a repository.
const hasRepo = (e) => SCENE.hasRepo(e);
const atClock = (e, ext = false) => SCENE.atClock(e, ext);
const statusNow = (e) => SCENE.statusNow(e);
const byId = () => Object.fromEntries(SCENE.state.entries.map((e) => [e.id, e]));
const byUuid = () => Object.fromEntries(SCENE.state.entries.filter((e) => e.uuid).map((e) => [e.uuid, e]));
// an entry's address is its Id, so a copied link survives a renamed heading or a moved entry; file#anchor only without one
const entryRoute = (e) => ({ view: "entry", uuid: e.uuid || e.id });
const entryHref = (e) => nav.href(entryRoute(e));
const entryOf = (ref) => byId()[ref] || (isUuid(ref) ? byUuid()[ref] : null);
const topicOf = (file) => SCENE.state.topics.find((t) => t.file === file);
const entriesOf = (file) => SCENE.state.entries.filter((e) => e.file === file);
const authorOf = (e) => e.git?.created?.author || e.git?.last_touched?.author || "";
// the sidebar's filter and the entry in the details are the scene's (SCENE.filter, SCENE.selected): the graph reads them too
const matches = (e) => entryMatches(e, SCENE.filter);
const pageFiltered = () => filterActive(SCENE.filter);
const queues = () => ({
  open: SCENE.state.entries.filter((e) => e.status === "open"),
  "needs-review": SCENE.state.entries.filter((e) => e.status === "needs-review"),
  "pending-confirmation": SCENE.state.entries.filter((e) => e.status === "pending-confirmation"),
  // Evidence is its own axis (Core rule 5): an open question with an untraced origin counts here and under open
  unknown: SCENE.state.entries.filter((e) => e.evidence === "unknown" && e.status !== "superseded"),
  revisit: SCENE.state.entries.filter((e) => e.revisit_when && e.status !== "superseded"),
});
// every entry that needs a person, once — an entry can wait in two queues
const queueTotal = () => { const q = queues(); return new Set([...q.open, ...q["needs-review"], ...q["pending-confirmation"], ...q.unknown]).size; };

// ---------------------------------------------------------------- markdown (ktw-markdown.js: DOM nodes, never HTML strings)
// a merged member's entry names its own project's topic files: resolve them there
let INLINE_PROJECT = null;
const inProject = (f) => (INLINE_PROJECT ? `${INLINE_PROJECT}/${f}` : f);
const topicHref = (f) => { const file = inProject(f); return topicOf(file) ? nav.href({ view: "topic", file }) : null; };
// one line of Markdown (a title, a field's value) and a whole body, as a fragment of nodes
const inline = (md) => MD.renderInline(document, md, { topicHref });
const renderMarkdown = (md) => MD.render(document, md, { topicHref });
// a label before a line of Markdown, joined to its first text the way the HTML string joined them
const labelled = (label, md) => { const f = inline(md); if (f.firstChild?.nodeType === 3) f.firstChild.data = label + f.firstChild.data; else f.prepend(label); return f; };
// ---------------------------------------------------------------- shared bits
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
const entryLink = (e, extra = "") => navLink({ href: entryRoute(e), class: extra }, e.title);
const projectOf = (x) => (x?.project ? x.project : null); // a merged family member's name, null for this project
function entryRow(e) {
  const snippet = e.body.reason || e.body.text.split("\n")[0] || "";
  const g = e.git;
  return navLink({ href: entryRoute(e), class: `row ${matches(e) ? "" : "dim"}` },
    el("div", { class: "rt" }, el("span", {}, inline(e.title)), ...entryPills(e)),
    el("div", { class: "rs" }, snippet.replace(/\*\*|`/g, "")),
    el("div", { class: "rm" }, [projectOf(e), topicOf(e.file)?.title || e.file, g?.created?.author ? `${g.created.author} · ${g.created.date}` : null, g?.last_touched?.date && g.last_touched.date !== g?.created?.date ? `touched ${g.last_touched.date}` : null].filter(Boolean).join("  ·  ")));
}


// ---------------------------------------------------------------- global strip (numbers on every view)
function renderStrip() {
  const q = queues(); const s = $("#strip"); s.replaceChildren();
  const stat = (label, n, href, cls = "", title = "") => el("a", { class: `stat ${cls} ${n ? "" : "zero"}`, href, title }, el("b", {}, n), label);
  const f = SCENE.state.findings;
  s.append(
    stat("entries", SCENE.state.entries.length, "#overview"), stat("topics", SCENE.state.topics.length, "#overview"), stat("authors", SCENE.state.authors.length, "#authors"),
    el("span", { class: "sep" }), el("span", { class: "lbl" }, "needs a person"),
    stat("open", q.open.length, "#queues", "q-open"), stat("needs review", q["needs-review"].length, "#queues", "q-needs-review"),
    stat("pending", q["pending-confirmation"].length, "#queues", "q-pending-confirmation"), stat("unknown evidence", q.unknown.length, "#queues", "q-unknown"),
    stat("revisit-when", q.revisit.length, "#queues", "", "Revisit-when triggers on record"),
    el("span", { class: "sep" }), el("span", { class: "lbl" }, "lint"),
    stat("errors", f.errors, "#findings", f.errors ? "lint-bad hot" : "lint-ok", `keep-the-why-lint ${SCENE.state.linter}`),
    stat("warnings", f.warnings, "#findings", f.warnings ? "lint-warn" : "lint-ok", `keep-the-why-lint ${SCENE.state.linter}`),
  );
}
function viewFindings(main) {
  const f = SCENE.state.findings;
  main.append(el("h1", {}, "Linter findings"), el("p", { class: "sub" }, `keep-the-why-lint ${SCENE.state.linter} · ${f.errors} error(s), ${f.warnings} warning(s) · structure only, never content`));
  if (!f.items.length) return main.append(el("p", { class: "center" }, "Clean — nothing to show."));
  main.append(el("div", { class: "table-wrap" }, el("table", { class: "t findings" }, el("thead", {}, el("tr", {}, ["Severity", "Code", "Where", "Message"].map((h) => el("th", {}, h)))),
    el("tbody", {}, f.items.map((x) => {
      const entry = SCENE.state.entries.find((e) => (e.project || null) === (x.project || null) && `${(e.origin?.state?.project || SCENE.state.project).context}${e.localFile || e.file}` === (x.localPath || x.path) && e.line <= x.line && x.line <= e.end_line + 1);
      return el("tr", {}, el("td", {}, pill(x.severity, `sev-${x.severity}`)), el("td", { class: "mono" }, x.code),
        el("td", { class: "mono" }, entry ? navLink({ href: entryRoute(entry) }, `${x.path}:${x.line}`) : `${x.path}${x.line ? ":" + x.line : ""}`), el("td", {}, x.message));
    })))));
}

// ---------------------------------------------------------------- sidebar
function renderSidebar() {
  const tree = $("#tree");
  tree.replaceChildren();
  const openState = JSON.parse(sessionStorage.getItem("ktw-tree") || "{}");
  let lastProject;
  for (const t of SCENE.state.topics) {
    if (SCENE.state.merged && t.project !== lastProject) { lastProject = t.project; tree.append(el("div", { class: "tree-project" }, t.project || (SCENE.self.project.name || SCENE.self.project.id))); }
    const list = entriesOf(t.file);
    const d = el("details", { open: openState[t.file] ?? (SCENE.state.topics.length <= 6) });
    d.addEventListener("toggle", () => { openState[t.file] = d.open; sessionStorage.setItem("ktw-tree", JSON.stringify(openState)); });
    d.append(el("summary", { "data-file": t.file, onclick: (ev) => { if (ev.target.closest(".tw")) return; ev.preventDefault(); nav.go({ view: "topic", file: t.file }); d.open = true; } },
      el("span", { class: "tw" }, "▶"), el("span", { class: "tt" }, t.title), el("span", { class: "count" }, list.length)));
    for (const e of list) d.append(navLink({ href: entryRoute(e), class: `leaf ${matches(e) ? "" : "dim"}`, "data-id": e.id, title: e.title },
      el("i", { class: `dot ${e.evidence} ${e.status}` }), el("span", {}, e.title.replace(/`/g, ""))));
    tree.append(d);
  }
  $("#tree-count").textContent = `${SCENE.state.topics.length} · ${plural(SCENE.state.entries.length, "entry")}`;
  $("#queue-count").textContent = queueTotal() || "";
  // filters
  const fill = (id, key, values, label) => {
    const sel = $(id); const cur = SCENE.filter[key];
    sel.replaceChildren(el("option", { value: "" }, `${label}: all`), ...values.map((v) => el("option", { value: v, selected: v === cur }, v)));
    sel.classList.toggle("set", !!cur);
    sel.onchange = () => { SCENE.filter[key] = sel.value; rerender(); };
  };
  fill("#f-status", "status", STATUS_ORDER.filter((s) => SCENE.state.entries.some((e) => e.status === s)), "status");
  fill("#f-evidence", "evidence", EV_ORDER.filter((s) => SCENE.state.entries.some((e) => e.evidence === s)), "evidence");
  fill("#f-author", "author", SCENE.state.authors.map((a) => a.name), "author");
  $("#f-clear").hidden = !pageFiltered();
  $("#f-clear").onclick = () => { SCENE.filter = { ...NO_FILTER }; rerender(); };
  markActive();
}
function markActive() {
  const route = nav.current();
  for (const a of document.querySelectorAll(".nav a")) a.classList.toggle("active", !route.unknown && route.view === a.dataset.route);
  const entry = route.view === "entry" ? entryOf(route.uuid) : null;
  const file = route.view === "topic" ? route.file : entry?.file || null;
  for (const s of document.querySelectorAll(".tree summary")) s.classList.toggle("active", s.dataset.file === file && route.view === "topic");
  for (const a of document.querySelectorAll(".tree .leaf")) a.classList.toggle("active", !!entry && a.dataset.id === entry.id);
  if (file) { const d = document.querySelector(`.tree summary[data-file="${CSS.escape(file)}"]`)?.parentElement; if (d) d.open = true; }
  document.querySelector(".tree .leaf.active")?.scrollIntoView?.({ block: "nearest" });
}

// ---------------------------------------------------------------- views
// the .keep-the-why file itself on the host, beside the card's heading — under the root in a mono repository
function configFileLink(p) {
  const href = hostFileLink(canonicalOf(p), p.git?.branch, p.root ? `${p.root.replace(/\/$/, "")}/` : "", p.config_file || ".keep-the-why", null);
  return href ? [" ", extLink(href, p.config_file || ".keep-the-why", "mono note config-file")] : null;
}
// a Config value: the three that are addresses open where they point — canonical and dashboard-state as
// written, context as the directory on the host (under the root in a mono repository); the rest is text
function configValue(p, key, v) {
  const href = key === "canonical" || key === "dashboard-state" ? (/^https?:\/\//.test(v) ? v : null)
    : key === "context" ? hostTreeLink(canonicalOf(p), p.git?.branch, [p.root, p.context || String(v).replace(/^`|`$/g, "")].filter(Boolean).join("/")) : null;
  return href ? extLink(href, v, "v mono") : el("span", { class: "v mono" }, v);
}

function viewOverview(main) {
  const list = SCENE.state.entries;
  const p = SCENE.state.project; const g = p.git;
  if (SCENE.state.merged) main.append(el("div", { class: "family-banner" }, el("b", {}, `Family · ${plural(SCENE.state.family.length, "project")}`), " — ",
    SCENE.state.family.map((m, i) => [i ? " · " : "", m.project ? el("span", {}, m.project, el("span", { class: "note" }, ` ${SCENE.state.entries.filter((e) => e.project === m.project).length}`)) : el("span", {}, m.name, el("span", { class: "note" }, ` ${SCENE.state.entries.filter((e) => !e.project).length}`))]),
    SCENE.state.missing?.length ? el("span", { class: "warn" }, ` · ${plural(SCENE.state.missing.length, "member")} not available here`) : null));
  main.append(
    el("h1", {}, p.id || p.name),
    el("p", { class: "sub" }, `${p.context} · schema ${p.schema} · ${p.config["capture-confirmation"] || "?"} · source-reference ${p.config["source-reference"] || "?"}`,
      g?.available ? [" · ", headPill(g), g.remote ? [" · ", remoteLink(g.remote)] : null, g.fork ? [" · ", forkPill(g)] : null, g.shallow ? " · shallow clone (dates are the clone's edge)" : null] : " · no Git"),
    // Type, Status and Evidence stacked in one column, the Config beside them
    el("div", { class: "grid2" },
      el("div", { class: "overview-stats" },
        el("div", { class: "card" }, el("h3", {}, "Type"), bars(typeCounts(list), ["decision", "constraint", "workaround", "incident", "undefined"])),
        el("div", { class: "card" }, el("h3", {}, "Status"), bars(count(list, "status"), STATUS_ORDER)),
        el("div", { class: "card" }, el("h3", {}, "Evidence"), bars(count(list, "evidence"), EV_ORDER))),
      el("div", { class: "card" }, el("h3", {}, "Config", configFileLink(p)), el("div", { class: "kv" }, Object.entries(p.config).map(([k, v]) => [el("span", { class: "k" }, k), configValue(p, k, v)])),
        Object.keys(p.personal_defaults || {}).length ? [el("h3", {}, "Personal defaults offered"), el("div", { class: "kv" }, Object.entries(p.personal_defaults).map(([k, v]) => [el("span", { class: "k" }, k), el("span", { class: "v mono" }, v)]))] : null),
    ),
    el("h2", {}, "Topics"),
    el("div", { class: "topic-cards" }, SCENE.state.topics.map(topicCard)),
    el("h2", {}, "Recently touched"),
    el("div", { class: "entry-list" }, [...list].filter((e) => e.git?.last_touched?.date !== undefined).sort((a, b) => ((b.git?.last_touched?.date || "") > (a.git?.last_touched?.date || "") ? 1 : -1)).slice(0, 8).map(entryRow)),
  );
}
function topicCard(t) {
  return navLink({ class: "topic-card", href: { view: "topic", file: t.file } },
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
    el("div", { class: "crumbs" }, navLink({ href: { view: "overview" } }, "Overview"), " / ", t.file, copyLinkButton(shareUrlFor(nav.href({ view: "topic", file: t.file }), t.project), "topic"), sourceLink(topicHostHref(t))),
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
      if (g.state.entries?.some((e) => e.uuid === uuid)) { nav.go({ view: "entry", uuid, centre: { mode: "public", canonical: g.member.canonical, root: g.member.root || "" } }); return; }
    }
    return setKids(main, el("p", { class: "center" }, `No entry with Id ${uuid} in this export, nor in the family's published exports.`));
  }
  // an Id this project does not carry: ask the server which known project does
  main.append(el("p", { class: "center" }, `Looking for ${uuid} in the other projects known here…`));
  try {
    const P = provider(); if (!P.resolveEntry) throw new Error();
    const hit = await P.resolveEntry(uuid);
    if (hit.error) throw new Error(hit.error);
    if (hit.project === (PROJECT || null)) return;
    nav.go({ view: "entry", uuid, centre: { mode: "live", project: hit.project } });
  } catch { setKids(main, el("p", { class: "center" }, `No entry with Id ${uuid} in this project, nor in any other project known here. A family member that is not checked out can be cloned or cached — see Family.`)); }
}
// #ref/<canonical>/<uuid>: an entry in another repository, family or not — a
// reference row's link before it resolved, or a link someone shared. Resolved
// as the row resolves it (resolveRemoteRef), then the page goes there; the
// canonical and the Id stay on the page when nothing loads.
async function viewRemoteEntry(main, canonical, uuid) {
  const here = byUuid()[uuid];
  if (here) { nav.go(entryRoute(here), { replace: true }); return render(); }
  main.append(el("p", { class: "center" }, `Looking for ${uuid} in ${repoLabel(canonical)}…`));
  const r = await resolveRemoteRef(canonical, uuid);
  if (r.entry) { go(r.href); return; }
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
    const P = provider();
    const known = P.resolveEntry ? await P.resolveEntry(uuid) : null; // the rules are resolveSee's (ktw-core.js)
    const r = resolveSee(uuid, { known, published: known && !known.error ? null : await fetchPublicState(canonical, "") });
    if (r.error) return { error: r.error };
    return { entry: r.entry, href: nav.href({ view: "entry", uuid, centre: r.via === "live" ? { mode: "live", project: r.project } : { mode: "public", canonical, root: "" } }) };
  })();
  return REMOTE_REFS[key];
}
const repoLabel = (canonical) => canonical.replace(/^https:\/\/(github\.com|gitlab\.com|codeberg\.org|bitbucket\.org)\//, "").replace(/^https:\/\//, "");
function remoteRefLine(ref, label) {
  const lead = () => (label ? el("b", {}, label) : null);
  const date = ref.date ? el("span", { class: "note" }, ` · as of ${ref.date}`) : null;
  const repo = () => el("a", { class: "note", href: ref.remote, target: "_blank", rel: "noopener", title: "the repository on its host" }, " · repository");
  const row = el("div", { class: "ref remote" }, lead(), navLink({ href: { view: "ref", canonical: ref.remote, uuid: ref.uuid } }, hostMark(ref.remote), repoLabel(ref.remote)),
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
  if (target) return el("div", { class: "ref" }, label ? el("b", {}, label) : null, navLink({ href: entryRoute(target) }, target.title), el("span", { class: "note" }, ` · ${topicOf(target.file)?.title || target.file}`), date);
  if (ref.remote && ref.uuid) return remoteRefLine(ref, label);
  if (ref.remote) return el("div", { class: "ref" }, label ? el("b", {}, label) : null, el("a", { href: ref.remote, target: "_blank", rel: "noopener" }, ref.remote.replace(/^https:\/\//, "")), date);
  if (ref.file) return el("div", { class: "ref" }, label ? el("b", {}, label) : null, topicOf(ref.file) ? navLink({ href: { view: "topic", file: ref.file } }, ref.locator) : ref.locator, el("span", { class: "note mono" }, ` · ${ref.uuid || ""}`), el("span", { class: "note warn" }, " · Id not found here — the locator may be stale"), date);
  return el("div", { class: "ref" }, label ? el("b", {}, label) : null, ref.text || "");
}
// The address to share an entry by: on a published page (an export, public mode) the page's own address; on
// the live server — a local address nobody else can open — the project's published dashboard, from its
// dashboard-state line, when it has one; the local address only as a last resort, and then said so.
// the address to share for a hash on this page — an entry's or a topic's: the page itself when it is published,
// else the project's published dashboard (its own entries and topics only), else this machine
function shareUrlFor(hash, project) {
  const local = isLocalPage();
  const here = pageUrl() + hash;
  if (PUBLISHED() && !local) return { url: here, where: "this page" };
  const st = project ? null : (SCENE.self?.project?.dashboard_state || SCENE.state?.project?.dashboard_state || "");
  if (st && /^https:\/\//.test(st)) return { url: st.replace(/state\.json$/, "") + hash, where: "the project's published dashboard" };
  return { url: here, where: local ? "this machine only — the project publishes no dashboard" : "this page" };
}
const shareUrlOf = (e) => shareUrlFor(entryHref(e), e.project);
// the entry's or topic's file on the host, in the repository it lives in (a merged member's in its own)
const hostProjectOf = (x) => x.origin?.state?.project || SCENE.state.project;
// the context directory as a path in the repository: under the root in a mono repository (core/context/)
const hostContextDir = (P) => `${P.root ? P.root.replace(/\/$/, "") + "/" : ""}${P.context || "context/"}`;
const entryHostHref = (e) => { const P = hostProjectOf(e); return hostFileLink(canonicalOf(P), P.git?.branch, hostContextDir(P), e.localFile || e.file, hostAnchor(e.title)); }; // GitHub's anchor, not the entry id
const topicHostHref = (t) => { const P = hostProjectOf(t); return hostFileLink(canonicalOf(P), P.git?.branch, hostContextDir(P), t.localFile || t.file, null); };
// "open source": the Markdown file on the host, beside the copy-link button; nothing without a canonical
const sourceLink = (href) => href ? extLink(href, "open source", "share-btn source-link") : null;
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* no clipboard API: the old way */ }
  const ta = el("textarea", { style: "position:fixed;opacity:0" }); ta.value = text; document.body.append(ta); ta.select();
  let ok = false; try { ok = document.execCommand("copy"); } catch {} ta.remove(); return ok;
}
function shareButton(e) { return copyLinkButton(shareUrlOf(e), "entry"); }
function copyLinkButton(s, what) {
  const b = el("button", { type: "button", class: "share-btn", title: `copy a link to this ${what} — ${s.where}:\n${s.url}`,
    onclick: async () => { const ok = await copyText(s.url); b.textContent = ok ? "✓ copied" : "copy failed"; b.classList.toggle("done", ok); setTimeout(() => { b.textContent = "⧉ copy link"; b.classList.remove("done"); }, 1800); } }, "⧉ copy link");
  return b;
}
function viewEntry(main, id) {
  const e = entryOf(id);
  if (!e && isUuid(id) && (LIVE() || (PUBLISHED() && canonicalOf(SCENE.state.project)))) return viewEntryElsewhere(main, id);
  if (!e) return main.append(el("p", { class: "center" }, "No such entry"));
  if (ROUTES.format(nav.current()) !== entryHref(e)) nav.go(entryRoute(e), { replace: true }); // an old file#anchor link shows the Id address from here on
  const list = entriesOf(e.file); const idx = list.indexOf(e);
  const t = topicOf(e.file);
  INLINE_PROJECT = e.project || null;
  const r = el("div", { class: `reader ${e.status}` },
    el("div", { class: "crumbs" }, navLink({ href: { view: "overview" } }, "Overview"), " / ", navLink({ href: { view: "topic", file: e.file } }, t?.title || e.file), ` / line ${e.line}`, shareButton(e), sourceLink(entryHostHref(e))),
    el("h1", {}, inline(e.title)),
    el("div", { class: "fields" }, ...entryPills(e), e.source ? el("span", { class: "pill" }, labelled("Source: ", e.source)) : null, e.verification ? el("span", { class: "pill" }, labelled("Verification: ", e.verification.split(/\s[—-]\s/)[0])) : null),
    el("div", { class: "body" }, renderMarkdown(e.body.text || "_(no body)_")),
    e.revisit_when ? el("div", { class: "body" }, el("div", { class: "label" }, el("b", {}, "Revisit when"), el("p", {}, inline(e.revisit_when)))) : null,
    refsBox(e),
    el("div", { class: "pager" },
      idx > 0 ? navLink({ href: entryRoute(list[idx - 1]) }, `← ${list[idx - 1].title}`) : el("span"),
      idx < list.length - 1 ? navLink({ href: entryRoute(list[idx + 1]) }, `${list[idx + 1].title} →`) : el("span")),
  );
  INLINE_PROJECT = null;
  main.append(r);
  SCENE.selected = e.id;
  renderDetailsEntry(e);
}
// #thought/<id>,<id>,…: a whole thought in one view — every entry of the chain
// in reading order, origin first, each in full, joined by how the next one
// follows from it. The Ids are the entries' own, so the address names the
// thought; entries of friends or of the path's projects are found in what the
// page has loaded, and a missing one says so.
const thoughtRoute = (t) => ({ view: "thought", refs: t.steps.map((n) => n.entry.uuid || n.entry.id) });
const thoughtHref = (t) => nav.href(thoughtRoute(t));
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
  if (lean.length) Promise.all(lean.map((f) => ensureBodies(f.origin.state))).then(() => { if (nav.current().view === "thought") render(); });
  // an entry of a friend is found once the friends are in: they load with a graph, and the view renders again
  if (steps.some((f) => !f) && FRIENDS_AUTO && !FRIENDS.on && !FRIENDS.loading) buildGraph();
  const links = steps.map((f, i) => (i ? thoughtLink(steps[i - 1], f) : null));
  const ins = thoughtInsights(steps.map((f) => f?.e || {}), links.slice(1).map((l) => (l === "superseded by" ? "superseded" : "see")));
  // where the chain goes on beyond what the page has loaded: before its origin, after its newest entry
  const beyond = (f, kind) => (f ? entryRefs(f.e).filter((x) => x.kind === kind && x.remote && !findEntry(x.uuid)) : []);
  const before = beyond(steps[0], "see"), after = beyond(steps[steps.length - 1], "superseded");
  const goOn = (ends, where) => el("div", { class: "thought-beyond" }, `${where} goes on in ${[...new Set(ends.map((x) => repoLabel(x.remote)))].join(", ")} — not loaded on this page. `,
    el("button", { type: "button", class: "link-btn", disabled: CHAIN.busy, onclick: () => followThought({ anchor: steps.filter(Boolean).pop()?.e.uuid }, (c) => { if (c) nav.go(thoughtRoute(c)); else render(); }) }, CHAIN.busy ? "loading…" : "load the whole chain"));
  const evolution = steps.length > 1 && links.slice(1).every((l) => l === "superseded by");
  const r = el("div", { class: "reader thought-reader" },
    el("div", { class: "crumbs" }, navLink({ href: { view: "graph" } }, "Graph"), " / thought"),
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
      el("div", { class: "crumbs" }, `${i + 1} / ${refs.length}`, f.where ? ` · ${f.where}` : "", f.own && topicOf(e.file) ? [" · ", navLink({ href: { view: "topic", file: e.file } }, topicOf(e.file).title)] : null, e.git?.created?.date ? ` · ${e.git.created.date}` : ""),
      ins.shaky.some((x) => x.i === i) ? el("div", { class: "thought-warn" }, `In question — ${ins.shaky.find((x) => x.i === i).why}. ${plural(steps.length - 1 - i, "later step")} ${steps.length - 1 - i === 1 ? "is" : "are"} linked after it — worth checking whether they depend on it.`) : null,
      ins.affected.includes(i) && !ins.shaky.some((x) => x.i === i) ? el("div", { class: "thought-affected" }, `Linked after step ${ins.shaky[0].i + 1}, which is in question.`) : null,
      el("h2", {}, el("a", { href: f.href }, inline(e.title))),
      el("div", { class: "fields" }, ...entryPills(e)),
      el("div", { class: "body" }, renderMarkdown(e.body?.text || "_(no body)_")),
      e.revisit_when ? el("div", { class: "body" }, el("div", { class: "label" }, el("b", {}, "Revisit when"), el("p", {}, inline(e.revisit_when)))) : null));
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
const projOf = (n) => n.proj || n.entry?.project || SCENE.self?.project?.id || SCENE.self?.project?.name || "";
const lightAll = (t) => SCENE.light(t); // every graph lights it (runGraph)
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
  if (!CITED.on && !CITED.loading && backlinksUrl(REGISTRY_URL, canonicalOf(SCENE.self?.project))) kids.push(el("p", {}, el("button", { type: "button", class: "link-btn", title: "who in the Keep the Why registry cites this project — one file from the registry, loaded on this click", onclick: () => { CITED.url = backlinksUrl(REGISTRY_URL, canonicalOf(SCENE.self?.project)); loadCited(); } }, "who in the registry cites this project?")));
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
    navLink({ href: thoughtRoute(t), title: t.steps.map((n) => n.label).join("\n→ ") }, `${shortLabel(t.steps[0])} → ${shortLabel(t.steps[t.steps.length - 1])}`), ...tags(t));
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
// The projects the page holds, each with its state and a link to its dashboard: this one, the family members
// (the family scope's merge, or the family loaded beside the graph), the friends loaded into the graph with the
// members their families brought, the projects of the path. One per project — its id beside its canonical, since
// the isolated sub-projects of one repository share the canonical and differ by id; this project first.
function authorProjects() {
  const out = []; const seen = new Set();
  const add = (name, canonical, state, open, role) => { const k = `${fkey(canonical || name)}\u0000${state?.project?.id || ""}`; if (!state || seen.has(k)) return; seen.add(k); out.push({ name, canonical: canonical || "", state, open, role, anonymized: !!state.anonymized }); };
  add(SCENE.self?.project?.id || SCENE.self?.project?.name || "this project", canonicalOf(SCENE.self?.project), SCENE.self, "#authors", "self");
  for (const G of (LAST_POOL?.groups || []).slice(1)) add(G.member?.name, G.member?.canonical || canonicalOf(G.state?.project), G.state, memberLink(G.member, "#authors"), "family");
  for (const m of familyMembers()) add(m.name, m.canonical, m.state, m.open?.replace("#graph", "#authors") || "#graph", "family");
  for (const r of Object.values(FRIENDS.loaded)) { if (!r?.state) continue; for (const m of r.members || [r]) add(m.name || repoLabel(m.canonical), m.canonical, m.state, (m.open || r.open || "").replace("#graph", "#authors") || null, "friend"); }
  for (const t of TRAIL) add(t.name || repoLabel(t.canonical), t.canonical, t.state, t.url?.replace(/#.*$/, "#authors") || null, "path");
  return out;
}
// the newest commit of an author among a state's entries, for the profile link on that project's host
function authorCommitIn(name, state) {
  let best = null;
  for (const e of state?.entries || []) for (const c of [e.git?.created, e.git?.last_touched, ...(e.git?.status_history || [])]) if (c?.author === name && c.commit && (!best || (c.date || "") > (best.date || ""))) best = c;
  return best?.commit || null;
}
// The Authors view: every Git author of every project the page holds — this one, the family, the friends, the
// path — in one table with the sums and a pill per project, and a table per project under it. Names are Git
// authors as the projects' .mailmap files map them; one name across projects is one row, an anonymized name
// (author-1) a row per project. A click on a row filters every view to that author. Rows go A–Z by name; a click on
// a column's name sorts every table by it, from the most for counts and dates, again to turn the order round.
const AUTHOR_SORT = { key: "author", dir: "asc" };
function viewAuthors(main) {
  main.append(el("h1", {}, "Authors"), el("p", { class: "sub" }, "Git authors of the entries — who created, touched, or superseded what, in every project this page holds: this one, its family, the friends in the graph, the path. Git knows names, not who was driving."));
  if (!SCENE.state.project.git?.available) return main.append(el("p", { class: "center" }, "No Git repository — nothing to attribute."));
  const projects = authorProjects();
  const sorted = (list) => sortAuthors(list, AUTHOR_SORT.key, AUTHOR_SORT.dir);
  const rows = sorted(mergeAuthors(projects.map((P) => ({ name: P.name, canonical: P.canonical, anonymized: P.anonymized, authors: P.state.authors || [] }))));
  const byName = Object.fromEntries(projects.map((P) => [P.name, P]));
  const projPill = (per) => { const P = byName[per.project]; const t = `${per.project}: ${per.created} created · ${per.touched} touched · ${per.superseded} superseded${per.first ? ` · ${per.first} → ${per.last}` : ""}`; return P?.open ? el("a", { class: "pill proj-pill", href: P.open, title: t, onclick: (ev) => ev.stopPropagation() }, per.project) : el("span", { class: "pill proj-pill", title: t }, per.project); };
  const sortBy = (key) => { AUTHOR_SORT.dir = AUTHOR_SORT.key === key ? (AUTHOR_SORT.dir === "asc" ? "desc" : "asc") : AUTHOR_SORTS[key]; AUTHOR_SORT.key = key; render(); };
  const th = (h) => {
    const key = h.toLowerCase();
    if (!(key in AUTHOR_SORTS)) return el("th", {}, h);
    const on = AUTHOR_SORT.key === key;
    return el("th", { class: "sortable", "aria-sort": on ? (AUTHOR_SORT.dir === "asc" ? "ascending" : "descending") : "none" },
      el("button", { type: "button", class: "sort-btn", title: `Sort by ${key}`, onclick: () => sortBy(key) }, h, el("span", { class: "sort-mark" }, on ? (AUTHOR_SORT.dir === "asc" ? " ▲" : " ▼") : "")));
  };
  const head = (cols) => el("thead", {}, el("tr", {}, cols.map(th)));
  const numCells = (a) => [el("td", {}, a.created), el("td", {}, a.touched), el("td", {}, a.superseded), el("td", {}, el("div", { style: "min-width:160px" }, stack(a.evidence, EV_ORDER))), el("td", { class: "mono" }, fmtDate(a.first)), el("td", { class: "mono" }, fmtDate(a.last))];
  const rowOf = (a, nameCell) => el("tr", { class: `clickable ${SCENE.filter.author === a.name ? "sel" : ""}`, onclick: () => { SCENE.filter.author = SCENE.filter.author === a.name ? "" : a.name; rerender(); } }, nameCell, ...numCells(a));
  // what was counted, and the friends not loaded yet
  const g = graph || buildGraph(); const waiting = (g.friends || []).filter((f) => !FRIENDS.loaded[fkey(f.canonical)]);
  const byRole = (role) => projects.filter((P) => P.role === role).map((P) => P.name);
  main.append(el("p", { class: "note" }, `Counted: this project`, byRole("family").length ? ` · family: ${byRole("family").join(", ")}` : "", byRole("friend").length ? ` · friends: ${byRole("friend").join(", ")}` : "", byRole("path").length ? ` · path: ${byRole("path").join(", ")}` : "",
    waiting.length ? [" · ", el("button", { type: "button", class: "link-btn", disabled: FRIENDS.loading, onclick: () => { setFriendsAuto(true); loadFriends(waiting).then(() => { if (onView("authors")) render(); }); } }, FRIENDS.loading ? "loading the friends…" : `load the ${plural(waiting.length, "friend")} not here yet`)] : null));
  const many = projects.length > 1;
  const all = el("table", { class: "t" }, head(["Author", ...(many ? ["Projects"] : []), "Created", "Touched", "Superseded", "Evidence of created entries", "First", "Last"]),
    el("tbody", {}, rows.map((a) => { const P = byName[a.per[0].project]; const link = a.anonymized ? el("span", {}, a.label) : authorLink(a.name, authorCommitIn(a.name, P?.state), P?.state?.project); return rowOf(a, [el("td", {}, link), ...(many ? [el("td", {}, el("div", { class: "proj-pills" }, a.per.map(projPill)))] : [])]); })));
  main.append(el("div", { class: "table-wrap" }, all), el("p", { class: "note", style: "margin-top:10px" }, "Click a name to open the author's profile on the host; click elsewhere in the row to filter every view to that author, again to clear. Click a column's name to sort by it, again to turn the order round.", many ? " A name that recurs across projects is one row with the sums; a name an export anonymized (author-1) says nothing across projects and stays a row per project." : ""));
  if (many) {
    main.append(el("h2", {}, "By project"));
    for (const P of projects) {
      const prow = sorted(mergeAuthors([{ name: P.name, canonical: P.canonical, anonymized: P.anonymized, authors: P.state.authors || [] }]));
      const d = el("details", { class: "authors-project", open: P.role === "self" });
      d.append(el("summary", {}, el("span", { class: "tt" }, P.name), el("span", { class: "pill" }, P.role === "self" ? "this project" : P.role), el("span", { class: "count" }, plural(prow.length, "author")), P.open && P.role !== "self" ? el("a", { class: "backlink", href: P.open, onclick: (ev) => ev.stopPropagation() }, "open ›") : null));
      d.append(el("div", { class: "table-wrap" }, el("table", { class: "t" }, head(["Author", "Created", "Touched", "Superseded", "Evidence of created entries", "First", "Last"]),
        el("tbody", {}, prow.map((a) => rowOf(a, el("td", {}, P.anonymized ? el("span", {}, a.name) : authorLink(a.name, authorCommitIn(a.name, P.state), P.state.project))))))));
      main.append(d);
    }
  }
  if (SCENE.filter.author) main.append(el("h2", {}, `Entries created by ${SCENE.filter.author}`), el("div", { class: "entry-list" }, SCENE.state.entries.filter((e) => authorOf(e) === SCENE.filter.author).map(entryRow)));
}

const supersedersOf = (e) => e.uuid ? SCENE.state.entries.filter((x) => x.superseded_by && parseSupersededBy(x.superseded_by)?.uuid === e.uuid) : [];
const seenFrom = (e, list) => e.uuid ? list.filter((x) => (x.see || []).some((r) => r?.uuid === e.uuid)) : [];
// See and Superseded by of an entry, and the other way round: what supersedes
// or points at it — here, and with the family scope anywhere in the tree
function refsBox(e) {
  const back = (label, rows) => rows.length ? [el("h3", {}, label), ...rows] : null;
  const localRow = (x) => el("div", { class: "ref" }, navLink({ href: entryRoute(x) }, x.title), el("span", { class: "note" }, ` · ${x.project ? x.project + " · " : ""}${topicOf(x.file)?.title || x.file}`));
  const sup = supersedersOf(e), seen = seenFrom(e, SCENE.state.entries);
  const box = el("div", { class: "body refs-box" },
    e.see?.length ? [el("h3", {}, "See"), ...e.see.map((r) => refLine(r))] : null,
    e.superseded_by ? [el("h3", {}, "Superseded by"), (() => { const sb = parseSupersededBy(e.superseded_by); return sb.none != null ? el("div", { class: "ref" }, el("i", {}, "none"), el("span", { class: "note" }, ` — ${sb.none}`)) : refLine(sb); })()] : null,
    back("Supersedes", sup.map(localRow)), back("Referenced by (See)", seen.map(localRow)));
  if (SCENE.state.merged) return box.childNodes.length ? box : null; // the merged family holds every reference
  const family = e.uuid && canFamily();
  if (family && scope() === "family" && !SCENE.state.merged) {
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
  const P = provider(); if (!P.family) return null;
  const r = await P.family(); FAMILY = r.error ? null : r.members;
  return FAMILY;
}
// the family as .keep-the-why declares it — what an export or a public dump knows
function familyDeclared() {
  const p = SCENE.state.project; const out = [];
  if (p.parent) out.push({ role: "parent", name: p.parent.replace(/^https:\/\//, ""), location: p.parent, scope: "", canonical: p.parent.startsWith("https://") ? p.parent : "", root: "" });
  for (const c of p.children || []) out.push({ role: "child", name: c.name, location: c.location, scope: c.scope, canonical: c.location.startsWith("https://") ? c.location : "", root: "" });
  return out;
}
function publicMemberRow(m, r) {
  const st = r?.state;
  const title = st ? el("a", { href: publicHref(m.canonical, m.root || "") }, m.name) : el("b", {}, m.name);
  return el("div", { class: `member ${m.role} ${st ? "public" : "none"}`, onmouseenter: () => spotProject(m.canonical, m.root || ""), onmouseleave: () => spotProject(null) },
    el("div", { class: "mr" }, el("span", { class: "role" }, m.role), title, el("span", { class: `pill kind-${st ? "public" : "none"}` }, st ? "published export" : "no public export"),
      st ? el("span", { class: "pill" }, `generated ${st.generated || "?"}`) : null),
    m.scope ? el("div", { class: "ms" }, m.scope) : (m.role === "parent" ? el("div", { class: "ms note" }, "holds what is family-wide") : null),
    el("div", { class: "mm mono" }, m.canonical || m.location, st ? ` · ${st.entries.length} entries · ${st.topics.length} topics · ${r.url}` : r?.error ? ` · ${r.error}` : ""));
}
function memberRow(m) {
  const here = m.role === "self";
  const title = m.key && !here ? el("a", { href: nav.href({ view: "overview", centre: { mode: "live", project: m.key } }) }, m.name) : el("b", {}, m.name);
  return el("div", { class: `member ${m.role} ${m.available}`, onmouseenter: () => spotProject(m.canonical, m.root || ""), onmouseleave: () => spotProject(null) },
    el("div", { class: "mr" }, el("span", { class: "role" }, m.role), title, el("span", { class: `pill kind-${m.available}` }, here ? "this project" : kindLabel(m.available))),
    m.scope ? el("div", { class: "ms" }, m.scope) : (m.role === "parent" ? el("div", { class: "ms note" }, "holds what is family-wide") : null),
    el("div", { class: "mm mono" }, hostMark(m.canonical), m.canonical || m.location || "", m.path && !here ? ` · ${m.path}` : ""),
    m.fetch ? el("details", { class: "fetch" }, el("summary", {}, "not checked out here — how to get it"),
      el("p", { class: "note" }, "A working tree, writable (the mapping learns it on next start):"), el("pre", {}, el("code", {}, m.fetch.clone)),
      el("p", { class: "note" }, "Or the read-only context cache, shared by every project on this machine:"), el("pre", {}, el("code", {}, m.fetch.cache))) : null);
}
// the tree as nested rows: every member under the one whose children block lists it
function treeRows(members, rowOf) {
  return familyOrder(members).map(([m, d]) => el("div", { class: "tree-row", style: `padding-left:${Math.min(d, 6) * 26}px` }, d ? el("span", { class: "tree-mark" }, "└") : null, rowOf(m)));
}
async function viewFamily(main) {
  const p = SCENE.state.project;
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
      ? memberRow({ role: "self", name: p.id || p.name, location: "", scope: m.scope || "", canonical: canonicalOf(p), root: p.root || "", available: "public" })
      : publicMemberRow(m, byNode.get(m.node))));
    return;
  }
  if (!LIVE()) {
    // an export knows only its own config: parent and children as declared
    if (p.parent) box.append(memberRow({ role: "parent", name: p.parent.replace(/^https:\/\//, ""), location: p.parent, scope: "", canonical: p.parent.startsWith("https://") ? p.parent : "", available: "none", fetch: null }));
    box.append(memberRow({ role: "self", name: p.id || p.name, location: "", scope: "", canonical: canonicalOf(p), root: p.root || "", available: "repository" }));
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
  let data; try { data = await HOST.projects(); } catch { return main.append(el("p", { class: "center" }, "Could not load the project list.")); }
  PROJECTS = data.projects || [];
  const current = PROJECT || data.selected;
  const list = PROJECTS;
  const row = (p, depth) => {
    const here = p.key === current;
    const label = p.path ? el("a", { href: nav.href({ view: "overview", centre: { mode: "live", project: p.key } }) }, p.name) : el("span", {}, p.id);
    const forget = p.source === "unresolved" ? null : el("button", { class: "link-btn danger", title: p.kind === "cache" ? "forget this cache and delete its directory (a cache is never the only copy of anything)" : "forget this path — the working tree itself is not touched", onclick: async () => {
      if (!confirm(p.kind === "cache" ? `Forget the cache of ${p.id} and delete ${p.path}?` : `Forget ${p.path}? The directory stays; only the mapping row goes.`)) return;
      try { await HOST.forget(p.key); } catch {}
      if (here) go(pagePath()); else render();
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
  d.append(el("h3", {}, `References out (${t.refs_out.length})`), ...(t.refs_out.length ? t.refs_out.map((f) => navLink({ class: "backlink", href: { view: "topic", file: f } }, topicOf(f)?.title || f)) : [el("p", { class: "empty" }, "none")]));
  d.append(el("h3", {}, `Referenced by (${t.refs_in.length})`), ...(t.refs_in.length ? t.refs_in.map((f) => navLink({ class: "backlink", href: { view: "topic", file: f } }, topicOf(f)?.title || f)) : [el("p", { class: "empty" }, "none")]));
  miniGraph(d, { topic: t });
}
function renderDetailsEntry(e) {
  const d = $("#details"); d.replaceChildren();
  const g = e.git;
  const P = hostProjectOf(e); // a merged member's entry lives in its own repository
  const hostHref = entryHostHref(e);
  d.append(el("h3", {}, "Entry"), el("div", { class: "kv" },
    e.uuid ? [el("span", { class: "k" }, "Id"), el("span", { class: "v mono", title: "the entry's address — what See and Superseded by lines resolve to" }, e.uuid)] : null,
    e.project ? [el("span", { class: "k" }, "project"), el("span", { class: "v" }, e.origin?.href ? el("a", { href: memberLink(e.origin.member, "#overview") }, e.project) : e.project)] : null,
    el("span", { class: "k" }, "at"), el("span", { class: "v mono" }, hostHref ? el("a", { class: "gh", href: hostHref, target: "_blank", rel: "noopener", title: "open on the host" }, e.id) : e.id),
    el("span", { class: "k" }, "type"), el("span", { class: "v" }, (e.type || []).join(", ") || "—"),
    el("span", { class: "k" }, "status"), el("span", { class: "v" }, statusPill(e.status)),
    el("span", { class: "k" }, "evidence"), el("span", { class: "v" }, evPill(e.evidence)),
    e.source ? [el("span", { class: "k" }, "source"), el("span", { class: "v" }, inline(e.source))] : null,
    e.verification ? [el("span", { class: "k" }, "verification"), el("span", { class: "v" }, inline(e.verification))] : null,
    e.revisit_when ? [el("span", { class: "k" }, "revisit when"), el("span", { class: "v" }, inline(e.revisit_when))] : null,
  ));
  d.append(el("h3", {}, "Git"));
  if (!g) d.append(el("p", { class: "empty" }, SCENE.state.project.git?.available ? "not in Git yet" : "no repository"));
  else {
    const who = (c) => c ? [authorLink(c.author, c.commit, P), `${c.date ? " · " + c.date : ""}${c.commit ? " · " : ""}`, c.commit ? el("code", {}, c.commit) : null] : ["—"];
    d.append(el("div", { class: "kv" },
      el("span", { class: "k" }, "created"), el("span", { class: "v" }, ...who(g.created)),
      el("span", { class: "k" }, "last touched"), el("span", { class: "v" }, ...who(g.last_touched))));
    if (g.status_history?.length) d.append(el("h3", {}, "Status history"), el("ul", { class: "hist" }, g.status_history.map((h) => el("li", { class: h.status }, `${h.status}`, el("div", { class: "d" }, authorLink(h.author, h.commit, P), ` · ${h.date} · ${h.commit}`)))));
  }
  const back = SCENE.state.entries.filter((x) => x.id !== e.id && x.refs.includes(e.file));
  d.append(el("h3", {}, `Backlinks (${back.length})`), ...(back.length ? back.map((x) => navLink({ class: "backlink", href: entryRoute(x) }, x.title, el("div", { class: "note" }, topicOf(x.file)?.title || x.file))) : [el("p", { class: "empty" }, `nothing references ${e.file}`)]));
  // the thoughts this entry is a step of — in the graph of the scope, friends and path included
  const mine = entryThoughts(e);
  const resting = new Set(); for (const { t, i } of mine) if (t.ins.shaky.some((x) => x.i === i)) for (const j of t.steps.slice(i + 1)) resting.add(j);
  if (resting.size) d.append(el("h3", {}, `Linked after this (${resting.size})`), el("p", { class: "note" }, `This entry is in question (${e.status}); these later entries are linked after it — check whether they depend on it.`), ...[...resting].map((n) => el("a", { class: "backlink", href: n.href }, n.label, el("div", { class: "note" }, projOf(n)))));
  if (mine.length) d.append(el("h3", {}, `In thoughts (${mine.length})`), ...mine.map(({ t, i }) => navLink({ class: "backlink", href: thoughtRoute(t), title: t.steps.map((n) => n.label).join("\n→ ") },
    `${shortLabel(t.steps[0])} → ${shortLabel(t.steps[t.steps.length - 1])}`,
    el("div", { class: "note" }, `step ${i + 1} of ${t.steps.length}${t.evolution ? " · evolution" : ""}${t.ends.length ? " · continues ↗" : ""}${t.ins.weakOrigin ? ` · starts ${t.ins.weakOrigin}` : ""}${t.ins.affected.includes(i) ? " · after a step in question" : ""}`))));
  if (e.refs.length) d.append(el("h3", {}, "References"), ...e.refs.map((f) => navLink({ class: "backlink", href: { view: "topic", file: f } }, topicOf(f)?.title || f)));
  if (e.findings.length) d.append(el("h3", {}, "Linter"), ...e.findings.map((f) => el("div", { class: "finding" }, pill(f.code, `sev-${f.severity}`), ` line ${f.line}: ${f.message}`)));
  renderDetailsNeighbourhood(e);
}
function renderDetailsDefault() {
  const d = $("#details"); d.replaceChildren();
  const route = nav.current();
  if (route.view === "graph" || route.view === "globe") {
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
  if (route.view === "timeline") {
    // the timeline: the thoughts list first, as beside the graph, and a small project graph under it that follows the clock
    d.dataset.pane = "graph";
    d.append(el("div", { id: "thoughts" }));
    renderThoughts(TIMELINE.stage()?.graph || graph);
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
  if (narrow()) { d.append(el("h3", {}, "Graph"), navLink({ class: "backlink", href: { view: "graph" } }, "Open the project graph →")); return; }
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
      if (ctx.entry?.uuid) { focusStep(ctx.entry.uuid); setTimeout(() => { if (SCENE.focus === ctx.entry.uuid) focusStep(null); }, 4000); }
      nav.go({ view: "graph" });
    } }, "⤢ full graph");
  // the full graph's switches, folded into the small one: a ⚙ opens the same groups
  const filters = el("div", { class: "mini-filters graph-ui", hidden: !MINI_FILTERS });
  const gear = el("button", { type: "button", class: "mini-gear", title: "the graph's switches — the same as in the full graph", onclick: () => { MINI_FILTERS = !MINI_FILTERS; filters.hidden = !MINI_FILTERS; } }, "⚙");
  const fillFilters = (g) => { if (mode !== "near") setKids(filters, ...graphControlGroups(g, mode === "family", miniView(g))); };
  // fit and reset beside it, for the graph this box runs: fit the view, let go of the held thought
  const corner = el("span", { class: "mini-corner" });
  const cornerFor = (g) => { const letGo = () => { SCENE.setThought(null); focusStep(null); lightThought(g, null); g.wake?.(); }; ESC.pane = letGo; setKids(corner,
    el("button", { type: "button", class: "mini-corner-btn", title: "fit the view: everything in the box", onclick: () => { const v = miniView(g); v.userMoved = false; v.needFit = true; g.wake?.(); } }, "fit"),
    el("button", { type: "button", class: "mini-corner-btn", title: "let go of the held thought — every node alike again (Esc, on a page without a reset of its own)", onclick: letGo }, "reset")); };
  box.append(canvas, seg, el("span", { class: "mini-hint" }, mode === "near" ? "click to open" : "hover · click"), corner, full, mode !== "near" ? gear : null, filters);
  if (focusId) d.append(el("h3", {}, "Graph"));
  d.append(box);
  const opts = { mini: true, focusId };
  if (mode === "near") {
    // friends live at the project level: the control switches there (the family level with the family scope) and loads them
    const n = friendCandidates(SCENE.state.entries.filter((e) => (e.project || null) === (ctx.entry?.project || ctx.topic?.project || null))).length;
    const up = modes.includes("family") && familyGraphShown() ? "family" : "project";
    if (n || hasFamily()) box.append(el("span", { class: "mini-seg mini-friends" }, el("button", { type: "button", title: `show the friends — switches to the ${up} level`,
      onclick: () => { MINI = up; FRIENDS.load = true; setFriendsAuto(true); render(); } }, n ? `friends (${n})` : "friends")));
    const near = ctx.entry ? buildSubgraph(ctx.entry) : buildTopicSubgraph(ctx.topic); cornerFor(near);
    return requestAnimationFrame(() => runGraph(canvas, near, opts));
  }
  if (mode === "project") { const g = buildGraph(ctx.entry?.project || ctx.topic?.project || null); holdReading(g); fillFilters(g); cornerFor(g); /* friends are in the gear's groups */ return requestAnimationFrame(() => runGraph(canvas, g, opts)); }
  // family: the family graph's nodes, with switches of their own (entries shown); the zoom is the small graph's own either way
  const note = el("span", { class: "mini-hint", style: "top:28px;bottom:auto" }, "loading the family…"); box.append(note);
  const show = (fg) => { note.remove(); if (!canvas.isConnected) return; const mg = { ...fg, showEntries: SHOW_ENTRIES, showLabels: true, raf: null, wake: null, alpha: Math.max(fg.alpha, 0.3), of: fg }; fg.runner = mg; holdReading(mg); fillFilters(mg); cornerFor(mg); runGraph(canvas, mg, opts); };
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
  for (const t of topics) add({ id: `t:${t.file}`, kind: "topic", label: t.title, file: t.file, r: 10 + Math.sqrt(t.entries) * 3.2, href: nav.href({ view: "topic", file: t.file }) });
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
  const entries = SCENE.state.entries.filter((e) => (e.project || null) === project);
  graph = Object.assign(graph || { scale: 1, ox: 0, oy: 0, showEntries: SHOW_ENTRIES, showLabels: true, alpha: 1 }, assemble(SCENE.state.topics.filter((t) => (t.project || null) === project), entries, prev));
  graph.friends = project ? [] : friendCandidates(entries);
  autoFriends(graph);
  if (!project) autoFamily();
  addFriendLayer(graph, prev);
  addOwnerGroups(graph, prev);
  graph.alpha = Math.max(graph.alpha, 0.6);
  return graph;
}
function buildTopicSubgraph(t) {
  // the topic with its entries, plus the topics it references and the ones referencing it (with the entries that do)
  const files = new Set([t.file, ...t.refs_out, ...t.refs_in]);
  const topics = SCENE.state.topics.filter((x) => files.has(x.file));
  const entries = SCENE.state.entries.filter((x) => x.file === t.file || x.refs.includes(t.file));
  const prev = graph ? Object.fromEntries(graph.nodes.map((n) => [n.id, n])) : {};
  return Object.assign({ scale: 1, ox: 0, oy: 0, showEntries: true, showLabels: true, alpha: 1 }, assemble(topics, entries, prev));
}
function buildSubgraph(e) {
  // the entry, its topic and siblings, the topics it references, and the entries elsewhere that reference its topic
  const files = new Set([e.file, ...e.refs]);
  const back = SCENE.state.entries.filter((x) => x.refs.includes(e.file));
  const linked = linkedTo(e, SCENE.state.entries); // See / Superseded by, either direction
  for (const b of [...back, ...linked]) files.add(b.file);
  const topics = SCENE.state.topics.filter((t) => files.has(t.file));
  const entries = SCENE.state.entries.filter((x) => x.file === e.file || x.id === e.id || back.includes(x) || linked.includes(x));
  const prev = graph ? Object.fromEntries(graph.nodes.map((n) => [n.id, n])) : {};
  return Object.assign({ scale: 1, ox: 0, oy: 0, showEntries: true, showLabels: true, alpha: 1 }, assemble(topics, entries, prev));
}
// The family graph: every project of the tree as a hub in its own colour,
// its topics and entries around it, parent and child projects joined, and
// the See and Superseded by lines between entries drawn across projects.
let fgraph = null; // kept across re-renders so positions survive live updates
// where a family member is, for a move in place (nothing reloads; inside the family the path stays as it is)
const memberCentre = (m) => (m.role === "self" ? currentCentre() : PUBLISHED() ? { mode: "public", canonical: m.canonical, root: m.root || "" } : { mode: "live", project: m.key });
const memberLink = (m, hash) => m.role === "self" ? hash : PUBLISHED() ? publicHref(m.canonical, m.root || "", hash) : centreUrl({ mode: "live", project: m.key }) + hash;
async function buildFamilyGraph() {
  const pool = await searchPool("family");
  const groups = pool.groups.map((g, i) => ({
    g, key: g.member.role === "self" ? "self" : g.member.key || `${g.member.canonical}|${g.member.root || ""}`,
    canonical: g.state.project?.canonical || g.member.canonical || (g.member.role === "self" ? canonicalOf(SCENE.state.project) : ""),
    root: g.state.project?.root || g.member.root || (g.member.role === "self" ? MY_ROOT() : ""),
    role: g.member.role, state: g.state, color: i === 0 ? color0() : palette(i),
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
  // this project keeps the local graph's ids, so the SCENE.selected entry and the positions carry over
  const tid = (G, file) => (G.key === "self" ? `t:${file}` : `t:${G.key}:${file}`);
  const eid = (G, id) => (G.key === "self" ? `e:${id}` : `e:${G.key}:${id}`);
  // this project in the middle, the rest of the family around it — after a move to a member, that one is the middle
  const R = groups.length > 1 ? 220 + 45 * groups.length : 0;
  groups.forEach((G, i) => {
    const ang = (2 * Math.PI * (i - 1)) / Math.max(1, groups.length - 1);
    const at = G.key === "self" ? { x: 0, y: 0 } : { x: R * Math.cos(ang), y: R * Math.sin(ang) };
    const hub = add({ id: `p:${G.key}`, kind: "project", self: G.key === "self", label: G.g.member.name, canonical: G.canonical, root: G.root, r: 15, color: G.color, href: memberLink(G.g.member, "#overview"),
      walk: () => (G.key === "self" ? go("#overview") : moveTo({ centre: memberCentre(G.g.member), state: G.state }, "#graph")) }, at);
    for (const t of G.state.topics || []) {
      const n = add({ id: tid(G, t.file), kind: "topic", fam: G.key !== "self", label: t.title, file: t.file, color: G.color, r: 8 + Math.sqrt(t.entries || 0) * 2.8, href: memberLink(G.g.member, nav.href({ view: "topic", file: t.file })) }, hub);
      links.push({ s: index[hub.id], t: index[n.id], kind: "hub", len: 80 });
    }
    for (const e of G.state.entries || []) {
      const t = nodes[index[tid(G, e.file)]];
      add({ id: eid(G, e.id), kind: "entry", fam: G.key !== "self", proj: G.g.member.name, state: G.g.state, label: e.title, file: e.file, entry: e, r: 4.2, href: G.key === "self" ? entryHref(e) : G.g.href(e) }, t || hub);
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
  addOwnerGroups(fgraph, prev);
  fgraph.alpha = Math.max(fgraph.alpha, 0.6);
  return fgraph;
}
// a colour token's value (style.css :root); the computed style is live, so a theme switch is read too
let ROOT_STYLE = null;
const token = (name) => (ROOT_STYLE ||= getComputedStyle(document.documentElement)).getPropertyValue(name).trim();
const palette = (i) => token(paletteToken(i));
const color0 = () => palette(0);
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
let FRIENDS_AUTO = prefs.get("friends") !== "off";
// every entry of every friend, not only what links to this graph — off by default, kept per browser
// "all their entries" per kind of neighbour — friends, the path's steps, the family — each kept per browser
const readEntriesSetting = (key, dflt = false) => { const v = prefs.get(key); return v == null ? dflt : v === "all"; };
let FRIEND_ENTRIES = readEntriesSetting("friend-entries", true); // every "… entries" is on by default: neighbours come whole; each is kept per browser
// a friend that has a family comes with it — the members beside the cited repository — unless this is off; their entries and labels have switches of their own
let FRIEND_FAMILIES = prefs.get("friend-families") !== "off";
function setFriendFamilies(on) { FRIEND_FAMILIES = on; prefs.set("friend-families", on ? "on" : "off"); }
let FRIEND_FAM_ENTRIES = readEntriesSetting("friend-family-entries", true);
function setFriendFamEntries(on) { FRIEND_FAM_ENTRIES = on; prefs.set("friend-family-entries", on ? "all" : "linked"); }
let PATH_ENTRIES = readEntriesSetting("path-entries", true);
let FAMILY_ENTRIES = readEntriesSetting("family-entries", true);
function setFriendEntries(on) { FRIEND_ENTRIES = on; prefs.set("friend-entries", on ? "all" : "linked"); }
function setPathEntries(on) { PATH_ENTRIES = on; prefs.set("path-entries", on ? "all" : "linked"); }
function setFamilyEntries(on) { FAMILY_ENTRIES = on; prefs.set("family-entries", on ? "all" : "linked"); }
// "owners": the projects of one owner bundled around a node for the owner — off by default, kept per browser
let OWNER_GROUPS = prefs.get("owner-groups") === "on";
function setOwnerGroups(on) { OWNER_GROUPS = on; prefs.set("owner-groups", on ? "on" : "off"); }
// "entries" of the main graph, kept per browser like every other switch in the bar — a move to another centre builds a new graph and must not reset it
let SHOW_ENTRIES = prefs.get("entries") !== "off";
function setShowEntries(on) { SHOW_ENTRIES = on; prefs.set("entries", on ? "on" : "off"); }
const labelsUi = (g, group, what) => el("label", { title: `the names of ${what} — topics, and entries when zoomed in` }, el("input", { type: "checkbox", checked: GRAPH.labels()[group] !== false, onchange: (ev) => { setLabels(group, ev.target.checked); g.wake?.(); } }), group === "project" ? "labels" : group === "friendsFamilies" ? "friends families labels" : `${group} labels`);
// the "<group> entries" checkbox, the same for the three groups
const allEntriesUi = (group, checked, set, what) => el("label", { class: "friend-entries", title: `every entry of ${what}, not only the ones that link to this graph` }, el("input", { type: "checkbox", checked, onchange: (ev) => { set(ev.target.checked); if (fgraph) fgraph.at = 0; render(); } }), group === "friendsFamilies" ? "friends families entries" : `${group} entries`);
// every switch in the bar at once — motion is not a filter and stays
function selectAll(g, on) {
  g.showEntries = on; setShowEntries(on);
  for (const x of [graph, fgraph]) if (x) x.showEntries = on; // the bar may switch to the other graph on the way (family entries)
  for (const k of Object.keys(GRAPH.labels())) setLabels(k, on);
  setFamilyNeighbours(on); setFamilyEntries(on);
  setFriendEntries(on); setFriendFamilies(on); setFriendFamEntries(on); setPathEntries(on);
  setTrailShow(on); // the path is hidden or shown, never discarded here
  setOwnerGroups(on);
  if (on) { setFriendsAuto(true); setKeepPath(true); autoFamily(); autoFriends(g); } else { FRIENDS.on = false; setFriendsAuto(false); }
  if (fgraph) fgraph.at = 0;
  render();
}
function setFriendsAuto(on) { FRIENDS_AUTO = on; prefs.set("friends", on ? "on" : "off"); }
function autoFriends(g) {
  if (!FRIENDS_AUTO || FRIENDS.loading) return;
  const list = g.friends || []; if (!list.length) return;
  const waiting = list.filter((f) => !FRIENDS.loaded[fkey(f.canonical)]);
  if (FRIENDS.on && !waiting.length) return;
  FRIENDS.loading = true;
  setTimeout(() => loadFriends(FRIENDS.on ? waiting : list).finally(() => { FRIENDS.loading = false; }), 0); // after the graph that asked is drawn
} // loaded: key -> {state, name, href(e), topicHref(file), open} | {error}
const friendColor = (i) => palette(i + 5);
const familyColor = () => palette(8);
// The project's own family as neighbours of the project graph — the parent, the
// children, the siblings as hubs joined the way the family graph joins them,
// each with the entries linked to this project (all of them under "all their
// entries"), the same layer friends and the path use. The family scope stays
// the merged view (search, queues, counts); this is the lean one. Loaded on
// its own when the graph is first drawn, like friends — one export per member
// in public mode, which is the cost to watch as families grow.
let FAMILY_NB = { groups: null, missing: [], loading: false };
let FAMILY_NB_ON = prefs.get("family-neighbours") !== "off"; // the family beside the graph; off per browser
function setFamilyNeighbours(on) { FAMILY_NB_ON = on; prefs.set("family-neighbours", on ? "on" : "off"); }
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
  return FAMILY_NB.groups.map((x, i) => ({ ...(PUBLISHED() ? publicMember(x.member, x.state) : liveMember(x.member, x.state)), color: palette(i + 1) })).filter((m) => m.state && !onPath(m.canonical));
}
function friendCandidates(entries, family = []) {
  const p = SCENE.self?.project || {}; const base = canonicalOf(p); const root = MY_ROOT();
  const declared = [p.parent, ...(p.children || []).map((c) => c.location)].map((l) => resolveLocation(l, base, root)?.canonical);
  return friendsOf(entries, [base, ...declared, ...(TREE || []).map((m) => m.canonical), ...family]);
}
function loadFriend(f) {
  const k = fkey(f.canonical);
  if (FRIENDS.loaded[k]) return Promise.resolve(FRIENDS.loaded[k]);
  return (FRIENDS.pending[k] ||= (async () => {
    let r = null;
    const P = provider();
    if (P.resolveEntry && P.memberState && f.uuids?.length) {
      try {
        const hit = await P.resolveEntry(f.uuids[0]);
        if (!hit.error) {
          const m = await memberState(hit.project);
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
  const at = (hash) => centreUrl({ mode: "live", project: m.key }) + hash;
  return { key: `L:${m.key}`, name: m.name || state.project?.id || m.key, role: m.role, state, canonical: canonicalOf(state.project) || m.canonical || "", root: state.project?.root || "",
    href: (e) => at(entryHref(e)), topicHref: (file) => at(nav.href({ view: "topic", file: file })), open: at("#graph"), centre: { mode: "live", project: m.key } };
}
function publicMember(m, state) {
  return { key: `P:${fkey(m.canonical)}|${m.root || ""}`, name: m.name, role: m.role, state, canonical: m.canonical, root: m.root || "",
    href: (e) => publicHref(m.canonical, m.root || "", entryHref(e)), topicHref: (file) => publicHref(m.canonical, m.root || "", nav.href({ view: "topic", file: file })), open: publicHref(m.canonical, m.root || "", "#graph"), centre: { mode: "public", canonical: m.canonical, root: m.root || "" } };
}
// The friend's whole family tree — on the live server what it knows about that
// project, else the members' published exports; members that cannot be read
// are left out of the unit (the friend itself is always in it).
async function friendUnit(r) {
  const p = r.state.project || {};
  const self = { ...r };
  if (!p.parent && !(p.children || []).length) return [self];
  const out = [self];
  const P = provider();
  if (r.centre?.mode === "live" && P.family && P.memberState) {
    try {
      const fam = await P.family({ project: r.centre.project, tree: true });
      if (fam.error) throw new Error(fam.error);
      const members = fam.members.filter((m) => m.role !== "self" && m.key);
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
  // this project's family is drawn already — the whole tree in the family graph, the members beside the project
  // graph — so a repository of it reached by a thought, a wave or a citation is not drawn again as a neighbour,
  // nor as part of a neighbour's family
  const projectKey = (m) => `${fkey(m.canonical)}|${m.root || m.state?.project?.root || ""}`;
  const drawn = new Set((g === fgraph ? g.groups || [] : g === graph ? familyMembers() : []).map(projectKey));
  const add = (f, via) => {
    const r = FRIENDS.loaded[fkey(f.canonical)];
    const centre = fkey(canonicalOf(SCENE.self?.project));
    if (!r?.state || onPath(f.canonical) || fkey(f.canonical) === centre || drawn.has(projectKey(r))) return; // the centre is drawn as itself, never again as a neighbour
    const members = (FRIEND_FAMILIES ? r.members || [r] : [r]).filter((m) => (fkey(m.canonical) !== centre || m === r) && !drawn.has(projectKey(m)));
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
    k: `trail:${t.key}`, kind: "trail", color: palette(i + 2), cited: PATH_ENTRIES ? null : "linked", // a path step is a neighbour like a friend: its own "all their entries" opens it
    members: [{ key: t.key, name: `${i + 1} · ${t.name}`, state: t.state, canonical: t.canonical, root: t.state.project?.root || "", href: (e) => t.url + entryHref(e), topicHref: (file) => `${t.url}#topic/${file}`, open: `${t.url}#graph` }],
    hub: () => moveTo(t, "#graph"), entry: () => (e) => moveTo(t, entryHref(e)), topic: () => (file) => moveTo(t, nav.href({ view: "topic", file: file })),
    next: i + 1 < trail.length ? `trail:${trail[i + 1].key}` : null,
  }));
  const fam = g === graph ? familyMembers() : []; // the project graph only: a topic's or an entry's neighbourhood stays its own
  if (fam.length) items.push({
    k: "family", kind: "family", color: familyColor(), cited: FAMILY_ENTRIES ? null : "linked", members: fam,
    hub: null,
    entry: (m) => (m.centre ? (e) => moveTo({ centre: m.centre, state: m.state }, entryHref(e)) : null),
    topic: (m) => (m.centre ? (file) => moveTo({ centre: m.centre, state: m.state }, nav.href({ view: "topic", file: file })) : null),
  });
  friendUnits(g).forEach((u, i) => items.push({
    k: u.k, kind: "friend", chain: u.via === "chain" || u.via === "globe", hop: u.via === "globe" ? u.hop : null, citing: !!u.citing, citedOnly: u.via === "cited", color: friendColor(i), cited: (FRIEND_ENTRIES && (FRIEND_FAM_ENTRIES || u.members.length === 1)) || FRIENDS.expanded.has(u.k) ? null : u.uuids, members: u.members,
    allFor: (m) => (m === u.members[0] ? FRIEND_ENTRIES : FRIEND_FAM_ENTRIES), kin: (m) => m !== u.members[0], // the cited repository first, then its family
    hub: () => toggleFriend(u.k),
    entry: (m) => (m.centre ? (e) => moveTo({ centre: m.centre, state: m.state }, entryHref(e)) : null),
    topic: (m) => (m.centre ? (file) => moveTo({ centre: m.centre, state: m.state }, nav.href({ view: "topic", file: file })) : null),
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
    const p = SCENE.self?.project || SCENE.state.project || {};
    selfHub = add({ id: "p:self", kind: "project", self: true, label: p.id || p.name || "this project", canonical: canonicalOf(p), root: p.root || "", r: 15, color: color0(), href: "#overview" }, { x: 0, y: 0 });
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
      const hub = add({ id: `f:${it.k}:${m.key}`, kind: "project", friend: it.kind === "friend", chain: !!it.chain, hop: it.hop ?? null, citing: j === 0 && !!it.citing, citedOnly: j === 0 && !!it.citedOnly, trail: it.kind === "trail", family: it.kind === "family", label: m.name, canonical: m.canonical, root: m.state?.project?.root || m.root || "", r: it.kind === "family" ? 13 : j === 0 ? 13 : 10, color: mcol, href: m.open || "#graph", action: it.hub, walk }, off);
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
        const n = add({ id: `fe:${it.k}:${m.key}:${e.id}`, kind: "entry", kin, proj: m.name, state: m.state, label: e.title, file: e.file, entry: e, r: 4.2, href: m.href ? m.href(e) : "#graph", action: act ? () => act(e) : null }, nodes[tIdx[e.file]] || hub);
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
// The owners: with "owners" on, the projects in the graph that share an owner — the account or group before the
// repository's name in its address — are tied to one node for that owner, and pulled together around it. Only an
// owner with more than one project here gets a node; a project alone stays as it is. The node opens the owner's
// page on the host. Every hub counts as a project, so the members of a family in one repository count each. A family
// keeps its shape: only its root hangs on the owner, the members below hang on their parent as they already do.
function addOwnerGroups(g, prev) {
  if (!OWNER_GROUPS) return;
  const { nodes, links, index } = g;
  const groups = new Map();
  for (const n of nodes) {
    if (n.kind !== "project") continue;
    const o = ownerOf(n.canonical); if (!o) continue;
    if (!groups.has(o.key)) groups.set(o.key, { o, hubs: [] });
    groups.get(o.key).hubs.push(n);
  }
  const hasParent = new Set(); // a family's parent lines run child → parent
  for (const l of links) if (l.kind === "family" && nodes[l.s]?.kind === "project" && nodes[l.t]?.kind === "project") hasParent.add(nodes[l.s]);
  for (const { o, hubs } of groups.values()) {
    if (hubs.length < 2) continue;
    const id = `o:${o.key}`; const p = prev[id];
    const cx = hubs.reduce((a, n) => a + n.x, 0) / hubs.length, cy = hubs.reduce((a, n) => a + n.y, 0) / hubs.length;
    const owner = { id, kind: "owner", ext: true, unit: id, label: o.label, canonical: o.url, r: 17, x: p ? p.x : cx, y: p ? p.y : cy, vx: 0, vy: 0, fixed: p?.fixed, href: o.url, walk: () => window.open(o.url, "_blank", "noopener") };
    index[id] = nodes.length; nodes.push(owner);
    for (const n of hubs) {
      n.owner = id;
      if (!hasParent.has(n)) links.push({ s: index[id], t: index[n.id], kind: "owner", len: 190 });
      // the owner's node names the owner; a hub on it keeps only the repository's part — `keep-the-why`, not `oliver-zehentleitner/keep-the-why` (or the id, `oliver-zehentleitner---keep-the-why`)
      const lc = n.label.toLowerCase();
      for (const pre of [`${o.key}/`, `${o.label.toLowerCase()}/`, `${o.label.toLowerCase().replace(/\//g, "---")}---`]) if (lc.startsWith(pre) && lc.length > pre.length) { n.label = n.label.slice(pre.length); break; }
    }
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
let TRAIL_SHOW = prefs.get("path-show") !== "off"; // the path drawn in the graph; off hides it, the path itself stays
function setTrailShow(on) { TRAIL_SHOW = on; prefs.set("path-show", on ? "on" : "off"); }
let KEEP_PATH = prefs.get("path") !== "off";
const keepPath = () => KEEP_PATH;
function setKeepPath(on) { KEEP_PATH = on; if (!on) TRAIL = []; prefs.set("path", on ? "on" : "off"); }
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
function remember(c, state) {
  const e = { key: centreKey(c), centre: c, state, name: state.project?.id || state.project?.name || repoLabel(canonicalOf(state.project) || ""), canonical: canonicalOf(state.project), root: state.project?.root || "", url: centreUrl(c) };
  VISITED.set(e.key, e); return e;
}
// Everything that belongs to one centre starts over when the centre moves; the
// fetched states (friends, members, published exports) stay cached.
function setCentre(c, state) {
  MODE = c.mode; PUBLIC = c.mode === "public" ? c.canonical : null; PUBLIC_ROOT = c.mode === "public" ? c.root || "" : ""; PROJECT = c.mode === "live" ? c.project || null : null;
  graph = null; fgraph = null; TREE = null; TREE_AT = 0; TREE_ASKED = false; PUBLIC_TREE = null; LAST_POOL = null;
  FRIENDS.on = false; FRIENDS.expanded.clear(); SCENE.setThought(null); MINI = null; CHAIN.extra.clear(); CHAIN.tried.clear();
  FAMILY_NB = { groups: null, missing: [], loading: false }; // the family beside the graph is the new centre's
  GLOBE.extra.clear(); GLOBE.failed.clear(); GLOBE.done = 0; registryOff(); // the globe's waves were counted from the old centre; what was fetched stays in memory
  CITED.on = false; CITED.loading = false; CITED.error = null; CITED.list = []; CITED.elsewhere = 0; CITED.checked = ""; CITED.url = null; // who cites the old centre
  if (MODE === "public") state.exported = true;
  connectLive();
  const sel = $("#project-select");
  if (sel && !sel.hidden && MODE === "live") sel.value = PROJECT || SELECTED_DEFAULT || sel.value;
  applyState(state);
}
// The projects of this project's family, as canonical|root: from whichever tree the page holds (the live
// tree, the published one, the members beside the graph, the family graph) and what the config declares.
function familyKeys() {
  const out = new Set(); const add = (c, r) => { if (c) out.add(`${fkey(c)}|${r || ""}`); };
  const p = SCENE.self?.project || {}; const base = canonicalOf(p); const root = p.root || "";
  add(base, root);
  for (const l of [p.parent, ...(p.children || []).map((c) => c.location)]) { const loc = l && resolveLocation(l, base, root); if (loc) add(loc.canonical, loc.root); }
  for (const m of TREE || []) add(m.canonical, m.root);
  for (const x of [...(PUBLIC_TREE?.groups || []), ...(PUBLIC_TREE?.missing || [])]) add(x.member.canonical, x.member.root);
  for (const m of familyMembers()) add(m.canonical, m.root);
  for (const G of fgraph?.groups || []) add(G.canonical, G.root);
  return out;
}
// Go to another centre whose state is loaded: the path grows by the centre
// left, or — when the target is already on it — goes back to it. A move inside
// the family leaves the path as it is: the family is drawn as one, its parent
// once, however often the reader moves between its members.
function moveTo(t, hash = "#graph", { push = true } = {}) {
  const target = t.key ? t : remember(t.centre, t.state);
  const here = remember(currentCentre(), SCENE.self);
  if (target.key === here.key) { nav.go(ROUTES.parse(hash)); return; }
  const tp = target.state?.project || {};
  const inFamily = familyKeys().has(`${fkey(canonicalOf(tp))}|${tp.root || ""}`);
  const i = TRAIL.findIndex((x) => x.key === target.key);
  if (i >= 0) TRAIL = TRAIL.slice(0, i);
  else if (inFamily) { /* the path stays */ }
  else if (KEEP_PATH) { TRAIL = TRAIL.filter((x) => x.key !== here.key); TRAIL.push(here); }
  else TRAIL = [];
  if (push) pushUrl(target.url + hash, { ktw: target.key });
  ensureBodies(target.state).then(() => setCentre(target.centre, target.state));
}
// Back and forward: a step inside this centre is a hash change (rendered
// there); a step to another centre goes there in place when its state is in
// memory, else the page loads it.
function onPopState() {
  const c = centreFromUrl(new URL(pageUrl())); const key = centreKey(c);
  if (key === centreKey(currentCentre())) return;
  const known = VISITED.get(key);
  if (!known) { reloadPage(); return; }
  moveTo(known, ROUTES.format(nav.current()), { push: false });
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
  let url; try { url = new URL(a.getAttribute("href"), pageUrl()); } catch { return; }
  const page = new URL(pageUrl());
  if (url.origin !== page.origin || url.pathname !== page.pathname || url.search === page.search) return;
  const t = stateForUrl(url); if (!t) return;
  ev.preventDefault();
  moveTo(t, url.hash || "#overview");
}
function pathBar() {
  if (!KEEP_PATH || !TRAIL.length) return null;
  const here = SCENE.self?.project?.id || SCENE.self?.project?.name || "";
  const steps = TRAIL.map((t, i) => [el("a", { href: t.url + "#graph", title: `back to ${t.name} — the path shortens to here`, onclick: (ev) => { ev.preventDefault(); moveTo(t, "#graph"); }, onmouseenter: () => spotProject(t.canonical, t.root), onmouseleave: () => spotProject(null) }, `${i + 1} · ${t.name}`), el("span", { class: "sep" }, " › ")]).flat();
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
    failed.length ? navLink({ class: "friends-failed warn", href: { view: "friends" }, title: failed.map((f) => `${repoLabel(f.canonical)} — ${FRIENDS.loaded[fkey(f.canonical)].error}`).join("\n") }, `${shown ? `${failed.length} of ${list.length}` : failed.length === 1 ? "the one friend" : `all ${failed.length}`} not loaded ↗`) : null,
    shown ? allEntriesUi("friends", FRIEND_ENTRIES, setFriendEntries, "every friend") : null,
    shown ? labelsUi(g, "friends", "the friends") : null,
    ...(shown && list.some((f) => (FRIENDS.loaded[fkey(f.canonical)]?.members || []).length > 1) ? [
      el("label", { class: "friend-families", title: FRIEND_FAMILIES ? "a friend's family beside it — unchecked, the cited repository alone" : "show a friend's family beside it" }, el("input", { type: "checkbox", checked: FRIEND_FAMILIES, onchange: (ev) => { setFriendFamilies(ev.target.checked); if (fgraph) fgraph.at = 0; render(); } }), "friends families"),
      ...(FRIEND_FAMILIES ? [allEntriesUi("friendsFamilies", FRIEND_FAM_ENTRIES, setFriendFamEntries, "every member of a friend's family"), labelsUi(g, "friendsFamilies", "the friends' families")] : []),
    ] : []));
}
// what this project and its family are, for "cited by": drawn already, so not again as a citing repository
function citedExclude() {
  const p = SCENE.self?.project || {}; const base = canonicalOf(p); const root = MY_ROOT();
  const declared = [p.parent, ...(p.children || []).map((c) => c.location)].map((l) => resolveLocation(l, base, root)?.canonical);
  return [base, ...declared, ...(TREE || []).map((m) => m.canonical), ...familyMembers().map((m) => m.canonical), ...(PUBLIC_TREE?.groups || []).map((x) => x.member.canonical)];
}
async function loadCited() {
  CITED.loading = true; CITED.error = null; render();
  try {
    const bl = await provider().backlinks(canonicalOf(SCENE.self?.project)); // no file is an answer: nobody cites it
    if (bl.error) throw new Error(bl.error);
    const file = bl.file;
    const r = citingOf(file, (SCENE.self?.entries || []).map((e) => e.uuid).filter(Boolean), [canonicalOf(SCENE.self?.project)]);
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
  const url = backlinksUrl(REGISTRY_URL, canonicalOf(SCENE.self?.project));
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
    failed.length ? navLink({ class: "warn", href: { view: "friends" }, title: failed.map((f) => `${repoLabel(f.canonical)} — ${FRIENDS.loaded[fkey(f.canonical)].error}`).join("\n") }, `${failed.length} not loaded ↗`) : null,
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
let THOUGHT_MIN = Number(prefs.get("thought-min")) || 4; // entries a thought has at least, kept per browser
// the choices go from 2 (one link) up to the longest chain in the graph on the page, and grow with
// it when a friend or a path brings a longer one; a kept choice above the longest here is drawn
// down to it, so a sparse project shows its chains instead of an empty list
const longestChain = (all) => Math.max(2, ...all.map((t) => t.steps.length));
const thoughtMin = (all) => Math.min(THOUGHT_MIN, longestChain(all));
function thoughtMinSeg(all, onpick = render) {
  const top = longestChain(all), cur = thoughtMin(all);
  return el("span", { class: "thought-min", title: "entries a thought has at least — from one link up to the longest chain here" }, "from ",
    ...Array.from({ length: top - 1 }, (_, i) => i + 2).map((m) => el("button", { type: "button", class: m === cur ? "on" : "", onclick: () => { THOUGHT_MIN = m; prefs.set("thought-min", String(m)); onpick(); } }, String(m))));
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
  const own = new Set([fkey(canonicalOf(SCENE.self?.project)), ...((fgraph?.groups || []).map((G) => fkey(G.canonical)))]);
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
// The registry's index, read once per page life for the search ("Find a project in the registry", its results
// page); the globe reads it afresh on each of its loads. { idx, error, loading }.
const REGISTRY = { idx: null, error: null, loading: false };
async function loadRegistryIndex() {
  if (REGISTRY.idx || REGISTRY.loading) return;
  REGISTRY.loading = true; REGISTRY.error = null;
  try { REGISTRY.idx = await HOST.registryIndex(REGISTRY_URL); } catch (err) { REGISTRY.error = err?.message || "network"; }
  REGISTRY.loading = false;
}
// a project of the registry as a search hit: its own link for this project, else its published export in public mode
const registryHit = (p) => {
  const self = !!canonicalOf(SCENE.state?.project) && fkey(p.canonical) === fkey(canonicalOf(SCENE.state.project));
  const meta = [repoLabel(p.canonical), p.entries != null ? plural(p.entries, "entry") : null, p.cors === false ? "served without a CORS header — a browser will likely be refused" : null].filter(Boolean);
  return { self, href: self ? "#overview" : publicHref(p.canonical), name: p.name || repoLabel(p.canonical), meta };
};
const GLOBE = { view: false, hops: 0, extra: new Map(), failed: new Map(), busy: false, registry: false, registryLeft: false, registryTried: new Set(), registryUrl: REGISTRY_URL, done: 0, log: [] }; // failed: canonical key -> { canonical, error, hop }
// the registry switched off: the next switch-on is a new pass, which tries the failed projects again
function registryOff() { GLOBE.registry = false; GLOBE.registryLeft = false; GLOBE.registryTried.clear(); }
// the graph the page shows: the family graph with the family scope, else the project graph
const shownGraph = () => (familyGraphShown() && fgraph ? fgraph : graph);
function loadedCanonicals() {
  // what the page shows beside the project — not everything it ever fetched: a repository dropped from the
  // globe (clear, the registry switched off) is offered again, its state coming from memory
  const out = new Set([fkey(canonicalOf(SCENE.state?.project))]);
  for (const m of familyMembers()) out.add(fkey(m.canonical));
  if (shownGraph() === fgraph) for (const G of fgraph.groups || []) out.add(fkey(G.canonical)); // the family tree, drawn in the family graph
  for (const t of TRAIL) out.add(fkey(t.canonical));
  const unit = (k) => { const r = FRIENDS.loaded[k]; if (r?.state) { out.add(k); for (const m of r.members || []) out.add(fkey(m.canonical)); } };
  if (FRIENDS.on) for (const f of shownGraph()?.friends || []) unit(fkey(f.canonical));
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
  const g = shownGraph();
  scan(SCENE.state?.entries); for (const m of familyMembers()) scan(m.state?.entries);
  if (g === fgraph) for (const G of fgraph.groups || []) scan(G.state?.entries); // the family tree in the family graph
  if (pathShown()) for (const t of TRAIL) scan(t.state?.entries);
  if (g) for (const u of friendUnits(g)) for (const m of u.members) scan(m.state?.entries);
  return [...out.values()].map((c) => ({ ...c, uuids: [...c.uuids] }));
}
// A wave is loaded in portions: one click fetches at most this many repositories, the dialog asks again for
// the next. Chosen in the dialog, kept for the page (nothing is fetched by it, but the globe keeps nothing either).
const GLOBE_PORTIONS = [100, 500, 1000];
let GLOBE_PORTION = GLOBE_PORTIONS[0];
// a small dialog in the page: what would load, how many files, yes or no. A list longer than a portion shows
// the next portion and counts the rest; the answer is how many to load now, or false.
function globeDialog({ title, lines, note }) {
  return new Promise((resolve) => {
    const close = (v) => { box.remove(); resolve(v); };
    const list = el("div", { class: "globe-list" }); const noteEl = el("p", { class: "note" }); const actions = el("div", { class: "globe-actions" });
    const fill = () => {
      const n = Math.min(GLOBE_PORTION, lines.length); const rest = lines.length - n;
      noteEl.textContent = note(n);
      setKids(list, ...lines.slice(0, n).map((l) => el("div", {}, l)), rest ? el("div", { class: "note" }, `… and ${rest} more — offered after these`) : null);
      const size = lines.length > GLOBE_PORTIONS[0] ? el("label", { class: "note portion", title: "how many repositories one click loads" }, "per portion ",
        el("select", { onchange: (ev) => { GLOBE_PORTION = Number(ev.target.value); fill(); } }, ...GLOBE_PORTIONS.map((p) => el("option", { value: String(p), selected: p === GLOBE_PORTION }, String(p))))) : null;
      setKids(actions, size, el("button", { type: "button", class: "link-btn", onclick: () => close(false) }, "no, stop here"), el("button", { type: "button", class: "primary", onclick: () => close(n) }, rest ? `load next ${n}` : "load them"));
    };
    const box = el("div", { class: "globe-dialog" }, el("div", { class: "globe-card" }, el("h3", {}, title), noteEl, list, actions));
    fill();
    document.body.append(box);
  });
}
// Load `items` portion by portion, the graph redrawn after each: `ask(left)` opens the dialog over what is
// left and returns how many to take, `load(part)` fetches and records a portion. Stops on a no; what came
// stays. Returns how many were taken.
async function globePortions(items, ask, load) {
  let at = 0;
  while (at < items.length) {
    const n = await ask(items.slice(at)); if (!n) break;
    await load(items.slice(at, at + n)); at += n;
    globeRefit(); if (fgraph) fgraph.at = 0; render();
  }
  return at;
}
async function globeRun(hops) {
  if (GLOBE.busy) return;
  GLOBE.busy = true; render();
  try {
    for (let hop = GLOBE.done + 1; hop <= hops; hop++) {
      const cands = globeCandidates();
      if (!cands.length) { GLOBE.log.push(`hop ${hop}: nothing left to load — the web ends here`); break; }
      let ok = 0;
      // a hop stopped part-way stays open: the next go offers what of it is left
      const took = await globePortions(cands,
        (left) => globeDialog({ title: `Hop ${hop}: ${plural(left.length, "repository")}${left.length < cands.length ? ` — ${cands.length - left.length} tried` : ""}`, note: (n) => `${plural(n * 2, "file")} — a .keep-the-why and a state.json each${FRIEND_FAMILIES ? ", plus their families, if any (friends families is on)" : ""} — from their hosts, in the browser.`, lines: left.map((c) => `${repoLabel(c.canonical)} — cited by ${plural(c.uuids.length, "entry")}`) }),
        async (part) => { await Promise.all(part.map(loadFriend)); for (const c of part) { const k = fkey(c.canonical); const r = FRIENDS.loaded[k]; if (r?.state) { GLOBE.extra.set(k, { ...c, hop }); GLOBE.failed.delete(k); ok++; } else GLOBE.failed.set(k, { canonical: c.canonical, error: r?.error || "could not be loaded", hop }); } });
      if (took) GLOBE.log.push(`hop ${hop}: ${ok} of ${cands.length} loaded`);
      if (took < cands.length) break;
      GLOBE.done = hop;
    }
  } finally { GLOBE.busy = false; if (fgraph) fgraph.at = 0; render(); }
}
async function globeRegistry() {
  if (GLOBE.busy) return;
  GLOBE.busy = true; render();
  try {
    const idx = await HOST.registryIndex(GLOBE.registryUrl);
    const have = loadedCanonicals();
    // "next" goes on with what this pass has not tried; a new pass (the switch off and on) tries the failed ones again
    const goOn = GLOBE.registry && GLOBE.registryLeft;
    if (!goOn) GLOBE.registryTried.clear();
    // in random order: with many listed, a portion is a sample of the registry, not its first letters
    const list = shuffled((idx.projects || []).filter((p) => p.canonical && !have.has(fkey(p.canonical)) && !GLOBE.registryTried.has(fkey(p.canonical))));
    // a project that failed before is offered again — much of that is temporary; its old error is forgotten for the try
    for (const p of list) { const k = fkey(p.canonical); if (FRIENDS.loaded[k]?.error) { delete FRIENDS.loaded[k]; delete FRIENDS.pending[k]; delete PUBLIC_STATES[`${p.canonical}|`]; } }
    if (!list.length) { GLOBE.log.push(goOn ? "registry: every listed project has been tried" : "registry: everything listed is already here"); GLOBE.registry = true; GLOBE.registryLeft = false; return; }
    let ok = 0;
    const took = await globePortions(list,
      (left) => globeDialog({ title: `The registry: ${plural(left.length, "project")}${left.length < list.length ? ` — ${list.length - left.length} tried` : ""}`, note: (n) => `${plural(n * 2, "file")} — a .keep-the-why and a state.json each${FRIEND_FAMILIES ? ", plus their families, if any" : ""} — from their hosts, in the browser. The registry is ${GLOBE.registryUrl}, checked ${idx.checked || "—"}.`, lines: left.map((p) => `${repoLabel(p.canonical)}${p.id ? ` — ${p.id}` : ""}${p.entries != null ? ` · ${plural(p.entries, "entry")}` : ""}${p.failed_since ? ` · not answering since ${p.failed_since}, tried anyway` : ""}${p.cors === false ? " · served without a CORS header — a browser will likely be refused" : ""}`) }),
      async (part) => { const cands = part.map((p) => ({ canonical: p.canonical, uuids: [] })); await Promise.all(cands.map(loadFriend)); for (const c of cands) { const k = fkey(c.canonical); GLOBE.registryTried.add(k); const r = FRIENDS.loaded[k]; if (r?.state) { GLOBE.extra.set(k, { ...c, hop: 0, registry: true }); GLOBE.failed.delete(k); ok++; } else GLOBE.failed.set(k, { canonical: c.canonical, error: r?.error || "could not be loaded", hop: "registry" }); } });
    if (!took) return;
    // a registry stopped part-way stays on with what came; "next" beside the switch offers the rest
    GLOBE.registry = true; GLOBE.registryLeft = took < list.length; GLOBE.log.push(`registry: ${ok} of ${list.length} loaded`);
    globeRefit();
  } catch (err) { GLOBE.log.push(`registry: could not be read (${err?.message || "network"})`); }
  finally { GLOBE.busy = false; if (fgraph) fgraph.at = 0; render(); }
}
// The way into the globe: what it does, and that nothing loads by itself — the graph starts as the project
// alone and grows only by a choice. "Don't show this again" is kept per browser, a convenience and nothing more.
let GLOBE_INTRO_SHOWN = false;
const globeIntroOff = () => prefs.get("globe-intro") === "off";
function globeIntro() {
  if (GLOBE_INTRO_SHOWN || globeIntroOff() || !GLOBE.view) return;
  GLOBE_INTRO_SHOWN = true;
  const never = el("input", { type: "checkbox" });
  const close = () => { if (never.checked) { prefs.set("globe-intro", "off"); } box.remove(); };
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
function globeClear() { globeRefit(); GLOBE.extra.clear(); GLOBE.failed.clear(); GLOBE.done = 0; registryOff(); GLOBE.log = []; if (fgraph) fgraph.at = 0; render(); }
function globeUi(g) {
  if (!GLOBE.view) return null;
  const sel = el("select", { title: "how many hops out from what is loaded — each wave is asked for with its count", onchange: (ev) => { GLOBE.hops = Number(ev.target.value); if (GLOBE.hops === 0) globeClear(); else render(); } }, ...Array.from({ length: 11 }, (_, i) => el("option", { value: String(i), selected: i === GLOBE.hops }, `${i} hop${i === 1 ? "" : "s"}`)));
  const go = el("button", { type: "button", class: "link-btn", disabled: GLOBE.busy || GLOBE.hops <= GLOBE.done, title: "load the next waves, one asked after the other", onclick: () => globeRun(GLOBE.hops) }, GLOBE.busy ? "loading…" : GLOBE.done ? `go on (${GLOBE.done} done)` : "go");
  const reg = el("label", { title: `every project listed in the registry — ${GLOBE.registryUrl}` }, el("input", { type: "checkbox", checked: GLOBE.registry, disabled: GLOBE.busy, onchange: (ev) => { if (ev.target.checked) globeRegistry(); else { for (const [k, f] of GLOBE.extra) if (f.registry) GLOBE.extra.delete(k); registryOff(); render(); } } }), "registry");
  const regNext = GLOBE.registry && GLOBE.registryLeft ? el("button", { type: "button", class: "link-btn", disabled: GLOBE.busy, title: "the registry was stopped part-way: offer the projects this pass has not tried", onclick: globeRegistry }, "next") : null;
  // an ⓘ beside the switch: what the registry is, and that one line in a pull request puts a project on it
  const info = el("span", { class: "globe-info", tabindex: "0" }, "ⓘ",
    el("span", { class: "globe-info-box" },
      el("b", {}, "The registry"),
      el("p", {}, "A list of repositories with a published Keep the Why dashboard export, kept in the keep-the-why repository and built into an index the globe can load as a wave of its own. Nothing needs it: the globe finds repositories by their citations. The registry is for being found from a project that cites nothing of yours — and for seeing who cites you."),
      el("p", {}, "To be listed, open a pull request that adds one line to ", el("code", {}, "registry/projects.txt"), ": your repository's canonical URL. A workflow follows its ", el("code", {}, ".keep-the-why"), " to the ", el("code", {}, "dashboard-state"), " export and checks that the export names your repository — move the export later and the listing follows. A family is listed by its root project: its members come with it through their parent/children lines (with friends families on)."),
      el("p", {}, el("a", { href: "https://keepthewhy.com/registry/", target: "_blank", rel: "noopener" }, "keepthewhy.com/registry"), " · ", el("a", { href: "https://github.com/oliver-zehentleitner/keep-the-why/blob/main/registry/projects.txt", target: "_blank", rel: "noopener" }, "registry/projects.txt on GitHub"))));
  const clear = GLOBE.extra.size ? el("button", { type: "button", class: "link-btn", title: "drop everything the globe loaded; friends, family and path stay", onclick: globeClear }, "clear") : null;
  return el("span", { class: "ui-group globe-ctl" }, el("a", { class: "globe-mark", href: "https://keepthewhy.com/registry/", target: "_blank", rel: "noopener", title: "the registry — what the globe can load, and how to be listed" }, "🌐"), sel, go, reg, regNext, info, clear);
}
const followAll = () => followChains((g) => { const t = graphThoughts(g); return [...t.thoughts, ...t.open].flatMap((c) => c.ends); });
// one chain, found again after each hop by its newest entry's Id
function followThought(t, then) {
  const anchor = t.anchor || t.steps[t.steps.length - 1].entry.uuid;
  let last = null;
  return followChains((g) => { last = graphChains(g).filter((c) => c.steps.some((n) => n.entry.uuid === anchor)).sort((a, b) => b.steps.length - a.steps.length)[0] || null; return last ? last.ends : []; })
    .then(() => then?.(last));
}
// the thought held is the scene's (SCENE.pin, set by SCENE.setThought); the list beside the graph follows it.
// Until the thoughts view moves into the library, the host redraws its list when the pin changes.
let THOUGHTS_FOR = null; // the graph whose thoughts the list shows
SCENE.on("pin", () => renderThoughts(THOUGHTS_FOR));
// One step pointed at — in a thought's list of steps, in the reader, on the
// Thoughts page — is marked in every graph on the page.
const focusStep = (ref) => SCENE.setFocus(ref); // every graph redraws (runGraph), and the stage
const stepHover = (ref) => ({ onmouseenter: () => focusStep(ref), onmouseleave: () => focusStep(null) });
// the thought being read (#thought/…) is held in every graph shown beside it, however the reader was reached —
// read › without a click first, a link, a reload — the same as a thought clicked and then read
function holdReading(g) {
  if (!g || nav.current().view !== "thought") return;
  const here = ROUTES.format(nav.current());
  const t = graphThoughts(g).all.find((x) => thoughtHref(x) === here);
  if (!t) return;
  SCENE.setThought(t);
  lightThought(g, t);
}
function renderThoughts(g) {
  const box = $("#thoughts");
  THOUGHTS_FOR = g;
  if (!box || !g) return;
  const { all, thoughts: list, open } = graphThoughts(g);
  const short = (n) => { const t = (n?.label || "").replace(/`/g, ""); return t.length > 34 ? t.slice(0, 32) + "…" : t; };
  const held = [...list, ...open].find((t) => t.ids.join("|") === SCENE.pin) || null;
  lightThought(g, held);
  const minSeg = thoughtMinSeg(all, () => { SCENE.setThought(null); renderThoughts(g); }); // a new minimum: the list is another, held or not
  const repos = (ends) => [...new Set(ends.map((e) => repoLabel(e.canonical)))];
  const row = (t) => {
    const key = t.ids.join("|"); const on = key === SCENE.pin;
    return el("div", { class: `thought ${on ? "on" : ""} ${t.ends.length ? "open" : ""}` },
      el("button", { type: "button", class: "thought-head", title: t.steps.map((n) => n.label).join("\n→ ") + (t.ends.length ? `\n… goes on in ${repos(t.ends).join(", ")}` : ""),
        onmouseenter: () => lightThought(g, t), onmouseleave: () => lightThought(g, held), // a held thought gives way while another is pointed at, and comes back
        onclick: () => SCENE.setThought(on ? null : t) },
        el("span", { class: "count" }, String(t.steps.length)), `${short(t.steps[0])} → ${short(t.steps[t.steps.length - 1])}`, t.evolution ? el("span", { class: "pill" }, "evolution") : null, ...insightPills(t)),
      navLink({ class: "thought-read", href: thoughtRoute(t), title: "read the whole thought — every entry in order, in full" }, "read ›"),
      t.ends.length ? el("button", { type: "button", class: "thought-follow link-btn", disabled: CHAIN.busy, title: `load the repositories this chain goes on into — ${repos(t.ends).join(", ")} — hop by hop, until it ends`, onclick: () => followThought(t) }, `continues ↗ ${repos(t.ends).join(", ")}`) : null,
      on ? el("ol", { class: "thought-steps" }, t.steps.map((n) => el("li", stepHover(n.entry?.uuid || n.id), el("a", { href: n.href, onclick: (ev) => { if (n.entry && TIMELINE.stage()?.pick && nav.current().view === "timeline") { ev.preventDefault(); TIMELINE.stage().pick(n.entry); } } }, n.label.replace(/`/g, ""))))) : null);
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
// light a project in every graph on the page — the path bar and the Family view point at projects the way the legend does
// A project pointed at outside the graph (a Family row, a step of the path): its nodes stay, the rest fades.
// The projects of one repository share the canonical and differ by root, so both are compared; a caller
// that knows no root (undefined) matches by the canonical alone.
const spotProject = (canonical, root) => SCENE.spot(canonical, root); // every graph spots it (spotIn, from runGraph)
function projectsLegend(g) {
  const p = SCENE.state?.project || {};
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
const resetGraphView = (g, family, view = g) => { view.scale = family ? 0.7 : 1; view.ox = 0; view.oy = 0; view.userMoved = false; for (const n of g.nodes) n.fixed = false; g.alpha = 1; g.wake?.(); }; // the bar's reset: the view as it opened, every placed node free; `view` the small graph's own beside the side pane
function graphControlGroups(g, family, view = g) {
  const fui = friendsUi(g);
  const famUi = familyUi(g);
  const globe = globeUi(g);
  return [
    globe,
    el("span", { class: "ui-group" }, el("label", {}, el("input", { type: "checkbox", checked: g.showEntries, onchange: (ev) => { g.showEntries = ev.target.checked; setShowEntries(ev.target.checked); g.alpha = 0.5; g.wake?.(); } }), "entries"), labelsUi(g, "project", "this project's topics and entries")),
    famUi ? el("span", { class: "ui-group" }, famUi, FAMILY_NB_ON ? labelsUi(g, "family", "the family's projects") : null) : null,
    fui ? el("span", { class: "ui-group" }, fui) : null,
    citedUi(g),
    el("span", { class: "ui-group" }, el("label", { title: "the projects of one owner around a node for the owner — only an owner with more than one project in the graph; the node opens the owner's page" }, el("input", { type: "checkbox", checked: OWNER_GROUPS, onchange: (ev) => { setOwnerGroups(ev.target.checked); if (fgraph) fgraph.at = 0; render(); } }), "owners")),
    el("span", { class: "ui-group" }, el("label", { title: "the path's projects in the graph — the projects you came through; unchecked they are hidden, not forgotten (the path bar discards)" }, el("input", { type: "checkbox", checked: keepPath() && TRAIL_SHOW, onchange: (ev) => { if (ev.target.checked && !keepPath()) setKeepPath(true); setTrailShow(ev.target.checked); if (fgraph) fgraph.at = 0; render(); } }), "path"),
      ...(pathShown() && TRAIL.some((t) => !sameCentreAsGraph(g, t)) ? [allEntriesUi("path", PATH_ENTRIES, setPathEntries, "every step of the path"), labelsUi(g, "path", "the path's projects")] : [])),
    el("span", { class: "ui-group" }, el("label", { title: "the graph turns very slowly; it stops while you point at it" }, el("input", { type: "checkbox", checked: driftOn(), onchange: (ev) => { setDrift(ev.target.checked); g.wake?.(); } }), "motion")),
    el("span", { class: "ui-group" },
      el("button", { class: "link-btn", title: "every switch in this bar on", onclick: () => selectAll(g, true) }, "select all"),
      el("button", { class: "link-btn", title: "every switch in this bar off — the project's topics alone", onclick: () => selectAll(g, false) }, "unselect all")),
    el("span", { class: "ui-group" }, el("button", { class: "link-btn graph-reset", title: "fit the graph and let go of every node you placed", onclick: () => resetGraphView(g, family, view) }, "reset")),
  ].filter(Boolean);
}
let TREE_ASKED = false;
function viewGraph(main) {
  // live: the whole family tree is known before anything counts as a friend — the server's own API, no other host
  if (LIVE() && !TREE && !TREE_ASKED) { TREE_ASKED = true; fetchTree().then((t) => { if (t && onView("graph", "globe")) render(); }); }
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
    // the corner's reset lets go of the held thought and the pointed-at step: every node alike again; the bar's reset
    // (fit, let go of placed nodes) stays what it is
    const letGo = () => { SCENE.setThought(null); focusStep(null); g.wake?.(); };
    const cornerReset = el("button", { type: "button", class: "graph-corner graph-corner-reset", title: "let go of the held thought — every node alike again (Esc does this and the bar's reset)", onclick: letGo }, "reset");
    // fit: nothing changes but the view — zoomed and centred so that everything is in the box, and stays in it while the graph turns
    const cornerFit = el("button", { type: "button", class: "graph-corner graph-corner-fit", title: "fit the view: everything in the box, centred on the point the graph turns around", onclick: () => { g.userMoved = false; g.needFit = true; g.wake?.(); } }, "fit");
    wrap.replaceChildren(canvas, ui, legend, ...[pathBar()].filter(Boolean), toggle("ui", "Layers", "legend"), toggle("legend", "Legend", "ui"), cornerFit, cornerReset,
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
    // a click on an entry opens a preview beside it — the timeline's card — instead of leaving the graph; open › or the
    // title goes to the entry's page; × on the badge, a click on the background or Esc closes it
    const preview = el("div", { class: "stage-card graph-preview", hidden: true }); wrap.append(preview);
    // the preview can be in the way: its head is a handle, the card goes where it is dragged and stays inside the box
    let grip = null; // { dx, dy }: where in the card the pointer took hold
    preview.onpointerdown = (ev) => { if (!ev.target.closest(".stage-card-head") || ev.target.closest("button, a")) return; grip = { dx: ev.clientX - preview.offsetLeft, dy: ev.clientY - preview.offsetTop }; preview.classList.add("dragging"); preview.setPointerCapture(ev.pointerId); ev.preventDefault(); };
    preview.onpointermove = (ev) => { if (!grip) return; const W = wrap.clientWidth, H = wrap.clientHeight; preview.style.left = `${Math.max(0, Math.min(W - preview.offsetWidth, ev.clientX - grip.dx))}px`; preview.style.top = `${Math.max(0, Math.min(H - preview.offsetHeight, ev.clientY - grip.dy))}px`; };
    preview.onpointerup = preview.onpointercancel = () => { grip = null; preview.classList.remove("dragging"); };
    const closePreview = () => { if (preview.hidden) return; preview.hidden = true; SCENE.selected = null; focusStep(null); g.wake?.(); }; // a row of the topic's list may still be pointed at when the list goes
    let place = null; // set below, before any click can happen
    const showPreview = (n, sx, sy) => {
      const e = n.entry; SCENE.selected = e.id;
      const tnode = g.nodes.find((m) => m.kind === "topic" && m.file === e.file && (m.unit || "") === (n.unit || "")); // the topic's node carries its title, a friend's too
      TIMELINE.fillEntryCard(preview, e, { lane: (n.proj ? `${n.proj} · ` : "") + (tnode?.label || topicOf(e.file)?.title || e.file).replace(/`/g, ""), href: n.href, state: n.state || SCENE.self, day: null,
        badge: el("button", { type: "button", class: "pill stage-card-held", title: "close the preview", onclick: closePreview }, "preview ", el("b", {}, "×")), again: () => { if (SCENE.selected === e.id) showPreview(n, sx, sy); }, onOpen: n.action || null,
        topic: tnode ? { title: "back to the topic's preview", onClick: () => showTopicPreview(tnode, null, null) } : null , renderBody: (md) => renderMarkdown(md), bodies: (st) => ensureBodies(st) }); // from inside the preview: the card stays where it is
      preview.hidden = false; place(sx, sy); g.wake?.();
    };
    // a click on a topic opens its preview: the topic's name linking its page, and its entries — a click on one
    // switches to that entry's preview, so a reader can walk a topic without leaving the graph
    place = (sx, sy) => { const W = wrap.clientWidth, H = wrap.clientHeight, w = preview.offsetWidth, h = preview.offsetHeight;
      if (sx == null) { preview.style.left = `${Math.max(0, Math.min(W - w, preview.offsetLeft))}px`; preview.style.top = `${Math.max(0, Math.min(H - h, preview.offsetTop))}px`; return; } // no node to stand beside: stay, inside the box — the person may have dragged the card out of the way
      preview.style.left = `${Math.max(8, Math.min(W - w - 8, sx + 18 + w > W - 8 ? sx - 18 - w : sx + 18))}px`; preview.style.top = `${Math.max(8, Math.min(H - h - 8, sy - h / 3))}px`; };
    const showTopicPreview = (n, sx, sy) => {
      const members = g.nodes.filter((m) => m.kind === "entry" && m.entry && m.file === n.file && (m.unit || "") === (n.unit || ""));
      const openTopic = n.action || null; const title = (n.label || n.file).replace(/`/g, "");
      const link = (text, extra = {}) => el("a", { href: n.href, ...extra, onclick: openTopic ? (ev) => { ev.preventDefault(); openTopic(); } : null }, text);
      SCENE.selected = null;
      setKids(preview, el("div", { class: "stage-card-head" }, el("span", { class: "note mono" }, `${n.proj ? `${n.proj} · ` : ""}topic · ${plural(members.length, "entry")}`), el("button", { type: "button", class: "pill stage-card-held", title: "close the preview", onclick: closePreview }, "preview ", el("b", {}, "×"))),
        el("h3", {}, link(title, { title: "open the topic's page" })),
        el("div", { class: "stage-card-body topic-entries" }, members.length ? members.map((m) => el("button", { type: "button", class: "topic-entry", title: "preview this entry", onclick: () => showPreview(m, null, null), ...stepHover(m.id) }, el("span", { class: "te-title" }, m.entry.title.replace(/`/g, "")), statusPill(m.entry.status), evPill(m.entry.evidence))) : el("p", { class: "empty" }, "no entries shown — entries may be switched off in the graph")),
        el("div", { class: "stage-card-foot" }, el("span"), link("open ›")));
      preview.hidden = false; place(sx, sy); g.wake?.();
    };
    ESC.page = () => { if (!preview.hidden) return closePreview(); letGo(); resetGraphView(g, family); }; // an open preview goes first; the next Esc resets
    runGraph(canvas, g, { fit: family || GLOBE.view || narrow(), onTouch: () => wrap.classList.remove("ui-open", "legend-open"), onEntry: showPreview, onTopic: showTopicPreview, onBlank: closePreview });
    renderThoughts(g);
  };
  if (!family) return fill(buildGraph());
  if (fgraph && Date.now() - fgraph.at < 30000) return fill(fgraph); // a live update re-renders: no refetch
  wrap.append(el("p", { class: "center" }, "Loading the family…"));
  buildFamilyGraph().then((g) => { if (wrap.isConnected && onView("graph", "globe") && familyGraphShown()) fill(g); });
}

// The timeline page (ktw-timeline.js) is given, besides the scene, nav and prefs, what only this host has: which
// graph its stage stands on — the family's when the family graph is shown and built, else the project's (asked
// for once while it builds, and the page redrawn when it is there) — a row for an entry, the Markdown with this
// page's topic links, an export's bodies, and a redraw.
function timelineGraph() {
  const family = familyGraphShown(); const familyFresh = fgraph && Date.now() - fgraph.at < 30000;
  if (family && !familyFresh && !TIMELINE_FAMILY_ASKED) { TIMELINE_FAMILY_ASKED = true; buildFamilyGraph().then(() => { TIMELINE_FAMILY_ASKED = false; if (nav.current().view === "timeline") render(); }); }
  return family && familyFresh ? fgraph : buildGraph();
}
const TIMELINE_HOST = { graph: timelineGraph, entryRow: (e) => entryRow(e), renderBody: (md) => renderMarkdown(md), bodies: (st) => ensureBodies(st), render: () => render() };
const ESC = { page: null, pane: null }; // what Esc does: the page's reset button, else the side pane's graph's; the view sets it, render() clears it
let TIMELINE_FAMILY_ASKED = false; // the family graph is being built for the timeline
// ---------------------------------------------------------------- search
// What a search runs over: this project, or every member of its tree — the
// whole family from the root down, not only the parent chain. Shared by the
// dropdown under the search field and the results page (#search/<scope>/<q>).
let TREE = null; let TREE_AT = 0; // /api/family?tree=1, live mode
async function fetchTree() {
  const P = provider(); if (!P.family) return null;
  if (TREE && Date.now() - TREE_AT < 30000) return TREE;
  const r = await P.family({ tree: true });
  if (r.error) TREE = null; else { TREE = r.members; TREE_AT = Date.now(); }
  return TREE;
}
const MEMBER_STATES = {}; // project key -> { at, p: Promise<{state}|{error}> }, live mode
function memberState(key) {
  const c = MEMBER_STATES[key];
  if (c && Date.now() - c.at < 30000) return c.p;
  const P = provider();
  const p = P.memberState ? P.memberState(key) : Promise.resolve({ error: "a member's state needs the live server" });
  MEMBER_STATES[key] = { at: Date.now(), p };
  return p;
}
let PUBLIC_TREE = null; // the tree read from published exports, public mode
async function publicTree() {
  if (PUBLIC_TREE) return PUBLIC_TREE;
  PUBLIC_TREE = await publicTreeFrom({ state: SCENE.self, canonical: canonicalOf(SCENE.state.project), root: MY_ROOT(), name: SCENE.state.project.id || SCENE.state.project.name, href: (e) => entryHref(e) });
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
  const self = { member: { role: "self", name: SCENE.state.project.name || SCENE.state.project.id, canonical: canonicalOf(SCENE.state.project) }, state: SCENE.self, href: (e) => entryHref(e) };
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
  others.forEach((m, i) => { const r = results[i]; if (r.state) groups.push({ member: m, state: r.state, href: (e) => nav.href({ ...entryRoute(e), centre: { mode: "live", project: m.key } }) }); else missing.push({ member: m, reason: r.error }); });
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
const searchScopes = () => (LIVE() || MODE === "public" || (MODE === "export" && !!canonicalOf(SCENE.state?.project)) ? ["project", "family"] : ["project"]);
// One setting for every view that can span projects (search, graph): this
// project, or the whole family tree. Kept per browser; a results-page link
// carries its own scope and sets it.
const hasFamily = () => !!(SCENE.state?.project?.parent || (SCENE.state?.project?.children || []).length);
const canFamily = () => searchScopes().includes("family") && hasFamily();
// friends can be searched where the family can be read, and there are any: entries citing outside the family
const canFriends = () => searchScopes().includes("family") && !!SCENE.self && friendCandidates(SCENE.self.entries || []).length > 0;
const canSearch = (s) => s === "project" || (s === "family" ? canFamily() : s === "friends" ? canFriends() : s === "all" ? canFamily() || canFriends() : false);
const scope = () => (canFamily() && SCENE.scope === "family" ? "family" : "project");
function markScope() {
  const box = $("#scope"); if (!box) return;
  box.hidden = !canFamily();
  for (const b of box.querySelectorAll("button")) b.classList.toggle("on", b.dataset.scope === scope());
}
function setScope(v, { rerender: again = true } = {}) {
  if (v !== "project" && v !== "family") return;
  const changed = SCENE.scope !== v; SCENE.setScope(v);
  if (changed) MINI = null; // the side pane's graph follows the new scope
  prefs.set("scope", v);
  markScope();
  if (!changed) return;
  if (!again) { setTimeout(showScope); return; } // the caller renders now; the merge follows
  showScope();
}
function setupScope() { for (const b of $("#scope").querySelectorAll("button")) b.onclick = () => setScope(b.dataset.scope); markScope(); }
const searchHref = (scope, q) => nav.href({ view: "search", scope, q });
const onSearch = (scope, q) => { const r = nav.current(); return r.view === "search" && r.scope === scope && r.q === q; }; // still on these results — not navigated away while they loaded
const memberLabel = (m) => m.role === "self" ? "this project" : m.role === "friend" ? (m.via ? `friend's family, with ${m.via}` : "friend") : m.role === "relative" && m.via ? `relative, via ${m.via}` : m.role;
const topicTitle = (st, file) => st.topics?.find((t) => t.file === file)?.title || file;
// text with every search term in a <mark>, as nodes (highlightParts in ktw-core.js)
const marked = (text, terms) => highlightParts(text, terms).map((p) => (p.mark ? el("mark", {}, p.text) : p.text));
function hitSnippet(hit) {
  const w = hit.where; if (!w) return null;
  const text = snippetAt(w.text.replace(/\*\*|`/g, ""), Math.max(0, w.text.slice(0, w.i).replace(/\*\*|`/g, "").length), w.len);
  return [w.field === "body" || w.field === "title" ? null : [el("b", {}, `${w.field}:`), " "], marked(text, hit.terms)];
}
let RESTORE_SCROLL = 0; // a live update re-renders the results page; its rows arrive after the scroll was restored
async function viewSearch(main, linkScope, q) {
  if (linkScope === "registry") return viewRegistrySearch(main, q);
  const scope = canSearch(linkScope) ? linkScope : "project"; // a shared link may carry a scope this project cannot search: it falls back
  if (scope !== linkScope) { nav.go({ view: "search", scope, q }, { replace: true }); }
  const input = $("#search"); if (document.activeElement !== input) input.value = q;
  const terms = searchTerms(q);
  const sub = el("p", { class: "sub" }, "Searching…");
  main.append(el("div", { class: "search-head" }, el("h1", {}, "Search ", el("span", { class: "q" }, `“${q}”`)), searchScopeBar(scope, q)), sub);
  if (terms.length === 0 || q.trim().length < 2) { sub.textContent = "Type at least two characters in the search field and press Enter."; return; }
  const pool = await searchPool(scope);
  if (!onSearch(scope, q)) return; // navigated away meanwhile
  const rows = searchRows(pool, q);
  const shown = rows.filter(({ e }) => matches(e)).length;
  const projectsHit = new Set(rows.map((r) => r.g)).size;
  sub.textContent = `${plural(rows.length, "entry")} in ${plural(projectsHit, "project")}` +
    (scope !== "project" ? ` · ${plural(pool.groups.length, "project")} searched` : "") +
    (terms.length > 1 ? ` · all of: ${terms.join(", ")}` : "") +
    (pageFiltered() ? ` · ${shown} match the sidebar filters, the rest dimmed` : "") +
    " · searched: title, body, Revisit when, Source, Verification, Superseded by, Id, file, type, status, evidence";
  const box = el("div", { class: "search-page" });
  for (const g of pool.groups) {
    const mine = rows.filter((r) => r.g === g);
    if (!mine.length) continue;
    const m = g.member;
    const head = el("div", { class: "sg-head" },
      m.role === "self" ? el("b", {}, m.name) : el("a", { href: m.open || (PUBLISHED() ? publicHref(m.canonical, m.root || "") : nav.href({ view: "overview", centre: { mode: "live", project: m.key } })) }, m.name),
      pill(memberLabel(m), "role"), el("span", { class: "count" }, plural(mine.length, "hit")));
    box.append(el("section", { class: "sgroup" }, head, m.scope ? el("div", { class: "ms note" }, m.scope) : null,
      el("div", { class: "entry-list" }, mine.map(({ e, hit }) => {
        const gt = e.git;
        const meta = [topicTitle(g.state, e.file), e.file, gt?.created?.author ? `${gt.created.author} · ${gt.created.date}` : null,
          gt?.last_touched?.date && gt.last_touched.date !== gt?.created?.date ? `touched ${gt.last_touched.date}` : null,
          e.uuid ? `Id ${e.uuid.slice(0, 8)}` : null, plural(hit.count, "match").replace("matchs", "matches")].filter(Boolean).join("  ·  ");
        return el("a", { href: g.href(e), class: `row ${matches(e) ? "" : "dim"}` },
          el("div", { class: "rt" }, el("span", {}, marked(e.title.replace(/`/g, ""), hit.terms)), ...entryPills(e)),
          el("div", { class: "rs" }, hitSnippet(hit)),
          el("div", { class: "rm" }, meta));
      }))));
  }
  const wider = scope === "all" ? null : canSearch("all") ? "all" : scope === "project" && canSearch("family") ? "family" : scope === "project" && canSearch("friends") ? "friends" : null;
  if (!rows.length) box.append(el("p", { class: "center" }, `No entry matches “${q}”`, scope === "project" ? " in this project" : scope === "all" ? " in the family or the friends" : ` in the ${SEARCH_SCOPES[scope]}`,
    wider ? [" — ", navLink({ href: { view: "search", scope: wider, q: q } }, `search ${SEARCH_SCOPES[wider]}`)] : "", "."));
  if (pool.missing.length) box.append(el("section", { class: "sgroup missing" }, el("div", { class: "sg-head" }, el("b", {}, "Not searched"), el("span", { class: "count" }, pool.missing.length)),
    pool.missing.map(({ member: m, reason }) => el("div", { class: "sr-missing" }, el("b", {}, m.name), ` (${memberLabel(m)}) — ${reason}`)),
    el("p", { class: "note" }, [pool.missing.some(({ member: m }) => m.role !== "friend") ? "Family shows how to get a member that is not on this machine. " : "",
      pool.missing.some(({ member: m }) => m.role === "friend") ? "Friends lists the repositories the entries cite outside the family, and what could not be loaded." : ""].join("").trim())));
  main.append(box);
  if (RESTORE_SCROLL) main.scrollTop = RESTORE_SCROLL;
}
// the results page's bar: the entry scopes this project can search, and the registry's projects last
const searchScopeBar = (scope, q) => el("span", { class: "search-scope", title: "where to search — the switch next to the project menu sets the graph and the lists, not the search; registry: a project rather than entries" },
  ...Object.entries(SEARCH_SCOPES).filter(([k]) => canSearch(k)).map(([k, label]) => navLink({ href: { view: "search", scope: k, q: q }, class: k === scope ? "on" : "" }, label)),
  navLink({ href: { view: "search", scope: "registry", q: q }, class: scope === "registry" ? "on" : "" }, "registry"));
// #search/registry/<q>: the projects of the registry the words name — name, repository URL, id — from the
// registry's index, each opening in public mode. Entries are not searched here; the bar leads to the scopes that do.
async function viewRegistrySearch(main, q) {
  const input = $("#search"); if (document.activeElement !== input) input.value = q;
  const terms = searchTerms(q);
  const sub = el("p", { class: "sub" }, `Reading ${REGISTRY_URL}…`);
  main.append(el("div", { class: "search-head" }, el("h1", {}, "Search ", el("span", { class: "q" }, `“${q}”`)), searchScopeBar("registry", q)), sub);
  if (terms.length === 0 || q.trim().length < 2) { sub.textContent = "Type at least two characters in the search field and press Enter."; return; }
  await loadRegistryIndex();
  if (!onSearch("registry", q)) return; // navigated away meanwhile
  if (!REGISTRY.idx) { sub.textContent = `registry not reached — ${REGISTRY.error}`; sub.classList.add("warn"); return; }
  const all = REGISTRY.idx.projects || []; const hits = registryMatches(all, q);
  sub.textContent = `${plural(hits.length, "project")} of ${all.length} in the registry` + (terms.length > 1 ? ` · all of: ${terms.join(", ")}` : "") +
    ` · matched: name, repository URL, id — the projects' entries are not searched` + (REGISTRY.idx.checked ? ` · registry checked ${REGISTRY.idx.checked}` : "");
  const box = el("div", { class: "search-page" });
  if (hits.length) box.append(el("section", { class: "sgroup" }, el("div", { class: "sg-head" }, el("b", {}, "Projects in the registry"), el("span", { class: "count" }, plural(hits.length, "hit"))),
    el("div", { class: "entry-list" }, hits.map((p) => { const h = registryHit(p); return el("a", { href: h.href, class: "row" },
      el("div", { class: "rt" }, el("span", {}, marked(h.name, terms)), h.self ? pill("this project", "role") : null),
      el("div", { class: "rs" }, marked(p.canonical || "", terms)),
      el("div", { class: "rm" }, [...h.meta.slice(1), p.schema ? `schema ${p.schema}` : null, p.dashboard ? `dashboard ${p.dashboard}` : null, p.id ? `id ${p.id}` : null].filter(Boolean).join("  ·  "))); }))));
  else box.append(el("p", { class: "center" }, `No project in the registry matches “${q}” — `, navLink({ href: { view: "search", scope: "project", q: q } }, "search the entries of this project"), "."));
  box.append(el("p", { class: "note" }, "The registry lists repositories with a published Keep the Why dashboard export; ", el("a", { href: "https://keepthewhy.com/registry/", target: "_blank", rel: "noopener" }, "keepthewhy.com/registry"), " says how to be listed."));
  main.append(box);
}
function setupSearch() {
  const input = $("#search"); const box = $("#search-results"); let sel = -1; let seq = 0;
  // "Find a project in the registry": a project rather than entries. The registry's index — one file — is read on
  // the click and kept for the page's life; the box's words then filter its projects by name, repository URL and
  // id, as they are typed, and a hit opens the project in public mode, from its published export. The entries of the
  // listed projects are not searched (that is the globe's load, not a search). The row is forgotten with the dropdown.
  const REG = { on: false };
  const close = () => { box.hidden = true; sel = -1; REG.on = false; };
  const registryRows = (q) => {
    if (!REG.on) return [el("a", { class: "sr-all sr-registry", href: "#", title: `the Keep the Why registry's index, ${REGISTRY_URL}, read on the click — projects whose name, repository URL or id carry the words typed`, onclick: (ev) => { ev.preventDefault(); REG.on = true; input.focus(); run(); loadRegistryIndex().then(run); } }, "Find a project in the registry")];
    const head = (t) => el("div", { class: "sr-head" }, t);
    if (!REGISTRY.idx) return [head("Projects in the registry"), el("div", { class: `sr-note${REGISTRY.loading ? "" : " warn"}` }, REGISTRY.loading ? `reading ${REGISTRY_URL}…` : `registry not reached — ${REGISTRY.error}`)];
    const all = REGISTRY.idx.projects || []; const hits = registryMatches(all, q);
    return [head(`Projects in the registry (${hits.length} of ${all.length})`),
      ...(hits.length ? hits.map((p) => { const h = registryHit(p); return el("a", { href: h.href, onclick: close },
        el("div", {}, h.name, h.self ? el("span", { class: "sr-file" }, " · this project") : null),
        el("div", { class: "sr-file" }, h.meta.join(" · "))); })
        : [el("div", { class: "sr-note" }, "no project in the registry matches")])];
  };
  const run = async () => {
    const q = input.value.trim(); if (q.length < 2 || !SCENE.state) return close();
    const mine = ++seq;
    // the dropdown searches this project alone — on hand, nothing to fetch; the wider scopes are its last rows
    const pool = await searchPool("project");
    if (mine !== seq) return; // a newer keystroke won
    const all = searchRows(pool, q);
    const rows = all.slice(0, 12);
    const wider = Object.entries(SEARCH_SCOPES).filter(([k]) => k !== "project" && canSearch(k));
    // the wider scopes first, so they are in view however long the list of hits gets
    box.replaceChildren(...[...wider.map(([k, label]) => navLink({ class: "sr-all sr-scope", href: { view: "search", scope: k, q: q }, onclick: close }, `Search in ${label}`)),
      ...registryRows(q),
      el("div", { class: "sr-head" }, rows.length ? `Results in this project${all.length > rows.length ? ` (${rows.length} of ${all.length})` : ` (${all.length})`}` : "Results in this project"),
      ...(rows.length ? rows.map(({ e, hit, g }) => el("a", { href: g.href(e), onclick: close },
      el("div", {}, marked(e.title.replace(/`/g, ""), hit.terms)),
      el("div", { class: "sr-file" }, topicTitle(g.state, e.file)),
      el("div", { class: "sr-snip" }, hitSnippet(hit)))) : [el("div", { style: "padding:10px 12px;color:var(--fg3)" }, "no matches in this project")]),
      REG.on ? navLink({ class: "sr-all", href: { view: "search", scope: "registry", q: q }, onclick: close }, "↵  projects in the registry, as a page")
        : navLink({ class: "sr-all", href: { view: "search", scope: "project", q: q }, onclick: close }, all.length > rows.length ? `↵  all ${all.length} results in this project` : "↵  results page")].filter(Boolean)); // replaceChildren writes a null as the text "null"
    box.hidden = false; sel = -1;
  };
  input.oninput = run; input.onfocus = () => { if (input.value.trim().length >= 2 && nav.current().view !== "search") run(); };
  input.onkeydown = (ev) => {
    const items = [...box.querySelectorAll("a")];
    if (ev.key === "Escape") { input.blur(); close(); }
    else if (ev.key === "ArrowDown") { sel = Math.min(items.length - 1, sel + 1); items.forEach((a, i) => a.classList.toggle("sel", i === sel)); items[sel]?.scrollIntoView?.({ block: "nearest" }); ev.preventDefault(); }
    else if (ev.key === "ArrowUp") { sel = Math.max(0, sel - 1); items.forEach((a, i) => a.classList.toggle("sel", i === sel)); ev.preventDefault(); }
    else if (ev.key === "Enter") {
      ev.preventDefault();
      if (!box.hidden && items[sel]) { items[sel].click(); input.blur(); return; }
      const q = input.value.trim(); if (q.length < 2) return;
      const reg = REG.on; seq++; close(); input.blur(); // Enter without a selection: the results page — this project, or the registry's projects when that row is open
      nav.go({ view: "search", scope: reg ? "registry" : "project", q });
    }
  };
  // a click outside the top bar closes the dropdown. A row's own handler may have re-rendered the dropdown by the time
  // the event reaches here (the registry row does, after an await): its target is then detached and belongs to no
  // ancestor — a detached target was in the dropdown, not outside it.
  document.addEventListener("click", (ev) => { if (ev.target.isConnected && !ev.target.closest(".topbar-right")) close(); });
  document.addEventListener("keydown", (ev) => {
    if (ev.target.matches("input,select,textarea") || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key === "/") { ev.preventDefault(); input.focus(); input.select(); }
    else if (ev.key === "Escape") (ESC.page || ESC.pane)?.();
    else { const view = { g: "graph", l: "findings", o: "overview", q: "queues", t: "timeline", a: "authors" }[ev.key]; if (view) nav.go({ view }); }
  });
}

// ---------------------------------------------------------------- router + live
function render() {
  if (!SCENE.state) return;
  const main = $("#main"); main.replaceChildren();
  const route = nav.current(); const v = route.view;
  SCENE.selected = null; ESC.page = null; ESC.pane = null;
  if (v !== "timeline") TIMELINE.leave(); // the clock lives in the timeline; everywhere else the page shows today
  GLOBE.view = v === "globe"; $("#app").classList.toggle("globe", GLOBE.view); // the globe: the graph alone, full width
  if (GLOBE.view) setTimeout(globeIntro, 0); else GLOBE_INTRO_SHOWN = false; // explained on the way in, once per visit
  $("#details").dataset.pane = "other";
  if (v !== "graph" && v !== "globe") { const bar = pathBar(); if (bar) main.append(bar); } // the graph and the globe carry it as an overlay
  if (v === "graph" && route.alias === "family") { setScope("family", { rerender: false }); setFamilyNeighbours(true); setFamilyEntries(true); nav.go({ view: "graph" }, { replace: true }); viewGraph(main); renderDetailsDefault(); } // an old link to the family graph: the family whole, in the graph and in the scope
  else if (v === "graph" || v === "globe") { viewGraph(main); renderDetailsDefault(); }
  else if (v === "timeline") { TIMELINE.view(main, route.day || null, TIMELINE_HOST); ESC.page = () => TIMELINE.stage()?.reset?.(); renderDetailsDefault(); }
  else if (v === "authors") { viewAuthors(main); renderDetailsDefault(); }
  else if (v === "queues") { viewQueues(main); renderDetailsDefault(); }
  else if (v === "findings") { viewFindings(main); renderDetailsDefault(); }
  else if (v === "family") { viewFamily(main); renderDetailsDefault(); }
  else if (v === "projects") { viewProjects(main); renderDetailsDefault(); }
  else if (v === "friends") { viewFriends(main); renderDetailsDefault(); }
  else if (v === "thoughts") { viewThoughtsPage(main); renderDetailsDefault(); }
  else if (v === "topic") viewTopic(main, route.file);
  else if (v === "entry") viewEntry(main, route.uuid);
  else if (v === "thought") viewThought(main, route.refs);
  else if (v === "ref") { viewRemoteEntry(main, route.canonical, route.uuid); renderDetailsDefault(); }
  else if (v === "search") { viewSearch(main, route.scope, route.q); renderDetailsDefault(); }
  else { viewOverview(main); renderDetailsDefault(); }
  markActive(); applySide();
  if (v !== "graph") { main.scrollTop = 0; if (narrow()) { const stuck = $("#sidebar").getBoundingClientRect().height; window.scrollTo(0, Math.max(0, main.getBoundingClientRect().top + window.scrollY - stuck - 8)); } }
}
function rerender() { renderSidebar(); renderStrip(); renderCounts(); render(); }
// With the family scope every view shows the family merged; the merge needs
// the members' states, so it runs after them — the last merge is kept, so a
// live update of this project re-merges at once and refreshes behind it.
let LAST_POOL = null; let MERGE_SEQ = 0;
function mergeWith(pool) { SCENE.state = mergeStates([{ ...pool.groups[0], state: SCENE.self }, ...pool.groups.slice(1)]); SCENE.state.missing = pool.missing; }
async function showScope() {
  const mine = ++MERGE_SEQ;
  if (!SCENE.self) return; // no state yet: the first applyState merges when it arrives
  if (scope() !== "family") { SCENE.state = SCENE.self; LAST_POOL = null; return rerender(); }
  if (LAST_POOL) { mergeWith(LAST_POOL); rerender(); }
  const pool = await searchPool("family");
  if (mine !== MERGE_SEQ || scope() !== "family") return;
  LAST_POOL = pool; const keep = $("#main").scrollTop; mergeWith(pool); rerender(); $("#main").scrollTop = keep;
}
// the numbers in the status bar follow what is shown
function renderCounts() { const c = $("#counts"); if (c) c.textContent = `${SCENE.state.entries.length} entries · ${SCENE.state.topics.length} topics · ${SCENE.state.authors.length} authors${SCENE.state.merged ? ` · family of ${SCENE.state.family.length}` : ""}`; }
// A Git author as a link to their profile on the host: the host's API names
// the account behind one of their commits (asked on click, in the browser);
// when it cannot, the commit's page opens, where the host links the author.
const AUTHOR_URLS = {};
function authorCommit(name) {
  // the newest commit of this author among the entries shown, and the project it is in
  let best = null;
  for (const e of SCENE.state.entries) for (const c of [e.git?.created, e.git?.last_touched, ...(e.git?.status_history || [])]) if (c?.author === name && c.commit && (!best || (c.date || "") > (best.c.date || ""))) best = { c, e };
  return best ? [best.c.commit, best.e.origin?.state?.project || SCENE.self.project] : [null, null];
}
function authorLink(name, commit, project) {
  const look = !SCENE.state.anonymized && project ? authorLookup(canonicalOf(project), commit) : null;
  if (!name || !look) return el("span", {}, name || "—");
  const key = `${canonicalOf(project)}|${name}`;
  return el("a", { class: "author", href: AUTHOR_URLS[key] || look.fallback, target: "_blank", rel: "noopener", title: `${name} — open the profile on the host (looked up from commit ${commit})`, onclick: async (ev) => {
    ev.stopPropagation();
    if (AUTHOR_URLS[key] || !look.api) return; // known, or a host whose API names no account: the link goes straight there
    ev.preventDefault();
    const w = window.open("about:blank", "_blank"); if (w) w.opener = null;
    let url = look.fallback;
    url = (await provider().authorProfile(canonicalOf(project), commit)).profile || look.fallback; // offline or rate-limited: the commit page names the author too
    if (url !== look.fallback) AUTHOR_URLS[key] = url;
    ev.target.closest("a").href = url;
    if (w) w.location.href = url; else window.open(url, "_blank", "noopener");
  } }, name);
}
// The badges, ready to paste: the static one, and the two live ones from this project's published export
// (`dashboard-state`), each as Markdown and HTML with a copy button. Pointed at, the ⚙ beside the search shows them.
function renderBadges() {
  const pop = $("#badges-pop"); if (!pop || !SCENE.state) return;
  const st = SCENE.self?.project?.dashboard_state || SCENE.state.project?.dashboard_state || "";
  const base = /^https:\/\//.test(st) ? st.replace(/state\.json$/, "") : "";
  const list = [{ name: "Keep the Why", img: "https://keepthewhy.com/assets/badge.svg", href: "https://keepthewhy.com", alt: "Keep the Why" }];
  if (base) list.push({ name: "live", img: `${base}badge-entries.svg`, href: base, alt: "Keep the Why · live" }, { name: "live, flat", img: `${base}badge-entries-flat.svg`, href: base, alt: "keep the why" });
  // a family root whose members all live in this repository: the family's numbers, from the same export
  const fam = (SCENE.self || SCENE.state).project?.family_badge;
  if (base && fam && !fam.missing?.length) list.push({ name: "family", img: `${base}badge-family.svg`, href: base, alt: "Keep the Why · family" }, { name: "family, flat", img: `${base}badge-family-flat.svg`, href: base, alt: "keep the why · family" });
  const famNote = fam?.missing?.length
    ? el("p", { class: "note" }, `No family badge: ${fam.missing.map((m) => `${m.name} (${m.reason})`).join(", ")} — a member outside this repository has no numbers when this project is exported, and a total without it would be wrong.`)
    : null;
  const field = (label, text) => {
    const b = el("button", { type: "button", class: "link-btn", onclick: async () => { const ok = await copyText(text); b.textContent = ok ? "✓" : "✗"; setTimeout(() => { b.textContent = "copy"; }, 1500); } }, "copy");
    return el("div", { class: "badge-field" }, el("span", { class: "note" }, label), el("input", { type: "text", readonly: true, value: text, onfocus: (ev) => ev.target.select() }), b);
  };
  setKids(pop, el("b", {}, "Badges"),
    ...list.map((x) => el("div", { class: "badge-item" },
      el("a", { href: x.href, target: "_blank", rel: "noopener" }, el("img", { src: x.img, alt: x.alt })),
      field("MD", `[![${x.alt}](${x.img})](${x.href})`),
      field("HTML", `<a href="${x.href}"><img alt="${x.alt}" src="${x.img}"></a>`))),
    base ? null : el("p", { class: "note" }, "The live badges come with a published export — a dashboard-state line in .keep-the-why."), famNote);
}
function applyState(state) {
  SCENE.self = state; SCENE.state = state;
  const p = SCENE.state.project;
  setKids($("#project-title"), $("#project-select").hidden ? el("b", {}, p.id || p.name) : null, schemaPill(p), headPill(p.git), p.git?.remote ? el("span", { class: "pill" }, remoteLink(p.git.remote)) : null, forkPill(p.git));
  document.title = `Keep the Why Dashboard · ${projectLabel(p)}`;
  setKids($("#statusbar"),
    el("span", { id: "pkg-dashboard" }, el("a", { href: "https://pypi.org/project/keep-the-why-dashboard/", target: "_blank", rel: "noopener", title: "keep-the-why-dashboard on PyPI" }, `keep-the-why-dashboard ${SCENE.state.dashboard}`)),
    el("span", { id: "pkg-lint" }, el("a", { href: "https://pypi.org/project/keep-the-why-lint/", target: "_blank", rel: "noopener", title: "keep-the-why-lint on PyPI" }, `keep-the-why-lint ${SCENE.state.linter}`)),
    el("span", {}, MODE === "public" ? `public export · generated ${SCENE.state.generated}` : SCENE.state.exported ? `exported ${SCENE.state.generated}` : `state ${SCENE.state.generated}`),
    el("span", { id: "counts" }, `${SCENE.state.entries.length} entries · ${SCENE.state.topics.length} topics · ${SCENE.state.authors.length} authors`),
    liveUi(), loadedUi(),
    el("span", { class: "grow" }, el("a", { href: "https://keepthewhy.com", target: "_blank", rel: "noopener" }, "keepthewhy.com")));
  renderBadges();
  renderLoaded();
  FAMILY = null;
  if (LIVE()) $("#nav-projects").hidden = false;
  setupMode(); markScope();
  if (STATIC) setupFamilyMenu();
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
  try { UPDATES = await HOST.updates(); markUpdates(); } catch { /* server gone; the live dot says so */ }
}
let LIVE_ES = null; // stops listening
function connectLive() {
  if (LIVE_ES) { LIVE_ES(); LIVE_ES = null; }
  if (window.__KTW_STATE__ && MODE === "export") { setLive("export", "export", "static export — the state when it was exported, no live updates"); return; }
  const P = provider();
  if (!P.subscribe) { setLive("export", "public export", "public export — read from the published state.json, no live updates"); return; }
  LIVE_ES = P.subscribe(
    (r) => { applyState(r.state); setLive("on", "live", `live — last update ${new Date().toLocaleTimeString()}`); },
    (status) => (status === "open" ? setLive("on", "live", "live — the server watches the project and sends every change") : setLive("off", "offline", "connection lost — the server is gone; retrying")));
}
// The side pane's width: 1×, 2× (the default), 3×, or half the page beside
// the text — kept per browser, ignored on a narrow screen. Two widths: one
// where the pane is the graph (the overview, the Friends and Thoughts pages,
// the reader), one where it holds something else (an entry's or a topic's
// details, the graph view's legend).
const SIDE_WIDTHS = ["1", "2", "3", "half"];
const readSide = (key, fallback = "2") => { const v = prefs.get(key); return SIDE_WIDTHS.includes(v) ? v : fallback; };
const SIDE = { graph: readSide("side-graph", readSide("side")), other: readSide("side-other"), timeline: readSide("side-timeline", "1") };
// three kinds of pane, each with its own remembered width: the graph beside a page, the graph beside the timeline (narrower by default — the stage wants the room), anything else
const paneKind = () => ($("#details")?.dataset.pane === "graph" ? (nav.current().view === "timeline" ? "timeline" : "graph") : "other");
const sideLabel = (v) => (v === "half" ? "½" : `${v}×`);
function applySide() {
  const v = SIDE[paneKind()];
  $("#app").dataset.side = v;
  const d = $("#details");
  if (d && !d.querySelector(":scope > .pane-width")) d.prepend(paneWidthBar());
  for (const b of document.querySelectorAll(".mini-width button")) b.classList.toggle("on", b.textContent === sideLabel(v));
  SCENE.wake();
}
function setSide(v) { const k = paneKind(); SIDE[k] = v; prefs.set(`side-${k}`, v); applySide(); }
// the choice sits at the top of the pane, above whatever it holds, on every page
function paneWidthBar() {
  return el("div", { class: "pane-width", title: "the width of this pane: 1×, 2×, 3×, or half the page — one width where the pane is the graph, one where it holds details" },
    el("span", { class: "label" }, "Width"),
    el("span", { class: "mini-width" }, ...SIDE_WIDTHS.map((v) => el("button", { type: "button", class: v === SIDE[paneKind()] ? "on" : "", onclick: () => setSide(v) }, sideLabel(v)))));
}
function setupSideToggle() {
  const btn = $("#side-toggle"); const app = $("#app");
  btn.onclick = () => { const open = app.classList.toggle("side-open"); btn.setAttribute("aria-expanded", String(open)); btn.textContent = open ? "Topics ▴" : "Topics ▾"; };
  nav.onChange(() => { if (narrow() && app.classList.contains("side-open")) btn.click(); });
}
function setupTheme() {
  const saved = prefs.get("theme");
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  if (saved === "light" || (!saved && prefersLight)) document.documentElement.dataset.theme = "light";
  $("#theme").onclick = () => { const light = document.documentElement.dataset.theme === "light"; if (light) delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = "light"; prefs.set("theme", light ? "dark" : "light"); if (graph) { graph.alpha = Math.max(graph.alpha, 0.05); graph.wake?.(); } };
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
  try { data = await HOST.projects(); } catch { return; }
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
  if (SCENE.state) { const t = $("#project-title").querySelector("b"); if (t) t.remove(); }
  sel.onchange = () => { nav.go({ ...nav.current(), centre: { mode: "live", project: sel.value } }); };
  SELECTED_DEFAULT = data.selected;
}
// An export in a family: the project menu lists the tree from the members'
// published exports, the root first and each member under the one that lists
// it, as the live menu lists this machine's projects. A choice walks to the
// member in place, as a click on its hub in the graph does: nothing reloads,
// and the path stays — a move inside the family is not a step of it. A member without a published export is named, not offered.
let FAMILY_MENU = 0; // counts the builds: a move before the tree arrives makes the older build stale
async function setupFamilyMenu() {
  const sel = $("#project-select"); const p = SCENE.state.project;
  const build = ++FAMILY_MENU;
  if (!(p.parent || (p.children || []).length) || !canonicalOf(p)) { sel.hidden = true; return; }
  const t = await publicTree();
  if (build !== FAMILY_MENU) return;
  const loaded = new Map(t.groups.map((g) => [g.member.node, g]));
  const members = [...t.groups.map((g) => g.member), ...t.missing.map((x) => x.member)];
  sel.replaceChildren(...familyOrder(members).map(([m, d]) => {
    const g = loaded.get(m.node);
    return el("option", { value: m.node, selected: m.role === "self", disabled: !g, title: g ? m.canonical + (m.root ? ` · ${m.root}` : "") : "no published export — nothing to walk to" },
      `${"\u00a0\u00a0".repeat(d)}${d ? "└ " : ""}${m.name}${g ? "" : "  (no published export)"}`);
  }));
  sel.hidden = false;
  fitSelect(sel);
  $("#project-title").querySelector("b")?.remove();
  // an entry, a topic or a search belong to the project left; the views carry over
  sel.onchange = () => {
    const g = loaded.get(sel.value); if (!g || g.member.role === "self") return;
    const here = nav.current(); const hash = ["entry", "topic", "search"].includes(here.view) ? "#overview" : ROUTES.format(here);
    moveTo({ centre: memberCentre(g.member), state: g.state }, hash);
  };
}
function setupMode() {
  const box = $("#mode"); const p = SCENE.state.project;
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
      nav.go({ ...nav.current(), centre: b.dataset.mode === "public" ? { mode: "public", canonical, root: p.root || "" } : { mode: "live" } });
    };
  }
  $("#mode-note").textContent = MODE === "public" ? `generated ${SCENE.state.generated}` : "";
}
async function boot() {
  setupTheme(); setupSearch(); setupScope(); setupSideToggle();
  nav.onChange(() => { RESTORE_SCROLL = 0; render(); });
  onWalk(onPopState);
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
          const local = ((await HOST.projects()).projects || []).find((p) => p.canonical === PUBLIC && p.dashboard_state);
          if (local) msg.append(el("p", { class: "note" }, `Your checkout at ${local.path} names ${local.dashboard_state} — on a branch that is not on the default branch yet. Public mode reads what is published: the line counts once it is merged, and the family once the published export carries it.`));
        } catch { /* not served by a live dashboard */ }
      }
      msg.append(el("p", {}, el("a", { href: pagePath() }, "back to local")));
      return;
    }
    r.state.exported = true;
    applyState(r.state);
    return;
  }
  setupProjects();
  const own = await provider().state();
  if (own.state) applyState(own.state);
  else $("#main").append(el("p", { class: "center" }, PROJECT ? `No state for project "${PROJECT}" — unknown id or unknown location.` : "Could not load the state — is the server running?"));
  connectLive();
  pollUpdates(); setTimeout(pollUpdates, 20000); // the server's first check may still be running at boot
  setInterval(pollUpdates, 60 * 60 * 1000);
}
boot();
