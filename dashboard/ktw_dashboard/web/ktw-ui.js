/* Keep the Why dashboard — the small pieces every view builds its DOM from: an element with its attributes,
   handlers and children (`el`), children replaced in place (`setKids`), the pills for a Type, a Status and an
   Evidence, a Type's glyph and a host's mark as SVG, text with the searched words marked, a link to a place
   that moves through the host's nav, a link out of the page, and a checkout's branch, commit and fork as pills. Nodes only — no state, no HTML strings, nothing read from the page.
   A classic script on globalThis.KeepTheWhy.ui, listed in ktw-views.json after the core. */
(function (root) {
"use strict";
const { typeName, hostOf, highlightParts, fillWords, safeUrl, safeHref } = root.KeepTheWhy.core;

// The views' words: `words(hook)` gives `tw(key, english, params)`, the one way a view's UI text reaches the page.
// The host's hook — `(key, params) => string | undefined`, the `words` option of every views.*.create — answers a
// key with its own language; undefined is "not in my catalogue" and the English is used, quietly. A throw or an
// answer that is not a string falls back to the English too, with a console warning once per key, so a broken
// catalogue is seen without a flood. Either text has its placeholders filled from `params`: {name} the value, {n:noun}
// a count with its noun ({n:one|many} where the core's plural rule does not fit; English only: a host's own text says {n} and its own plural), and a param that is a
// node goes in at its placeholder, wherever the host's word order puts it — then tw gives the parts as an array, which
// el() flattens. Every key and its English is listed in ktw-words.json; keys and English are string literals at
// every call, so the catalogue is what the code says (words.test.mjs).
function words(hook = null) {
  const warned = new Set();
  const warn = (key, why) => { if (warned.has(key)) return; warned.add(key); console.warn(`KeepTheWhy words: "${key}" ${why}; the English is used`); };
  return function tw(key, english, params = null) {
    let text = english;
    if (typeof hook === "function") {
      let answer;
      try { answer = hook(key, params || {}); } catch (e) { warn(key, `— the hook threw: ${e?.message || e}`); answer = undefined; }
      if (typeof answer === "string") text = answer;
      else if (answer !== undefined) warn(key, `— the hook answered ${answer === null ? "null" : typeof answer}, not a string`);
    }
    return fillWords(text, params, key);
  };
}
// the English, for a call made without a view's own (a host that passes no words gets this too)
const english = words();
// a family member's role as a word (ktw-family.js gives the roles); a role no row names is shown as it is
const roleWord = (tw, role) => ({ self: tw("role.self", "self"), parent: tw("role.parent", "parent"), grandparent: tw("role.grandparent", "grandparent"), ancestor: tw("role.ancestor", "ancestor"), child: tw("role.child", "child"), sibling: tw("role.sibling", "sibling"), relative: tw("role.relative", "relative"), friend: tw("role.friend", "friend") })[role] ?? role;

// Attributes on an element, HTML or SVG: class; style through the CSSOM — a page under a Content-Security-Policy
// without 'unsafe-inline' (Maity's hub pages, default-src 'self') drops a style attribute set as markup, not the
// element's style object; on<event> handlers; an address (href, xlink:href, src, action, formaction) only as
// core.safeHref passes it — one it rejects is left out, so a link stays its text and is no link; the rest as
// attributes. null or false leaves one out. Every element the views build gets its attributes here (el, svgEl), so
// no style and no unchecked address reaches setAttribute. A name is told by its lowercase — an HTML element folds
// `HREF` to `href` — and set as given, so an SVG name keeps its case (viewBox); an on<event> that is not a function
// is left out, never set as a handler's source text.
const URL_ATTRS = new Set(["href", "xlink:href", "src", "action", "formaction"]);
function setAttrs(n, attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    const name = k.toLowerCase();
    if (name === "class") n.setAttribute("class", v);
    else if (name === "style") n.style.cssText = v;
    else if (name.startsWith("on")) { if (typeof v === "function") n.addEventListener(name.slice(2), v); }
    else { const u = URL_ATTRS.has(name) ? safeHref(String(v)) : v === true ? "" : v; if (u != null) n.setAttribute(k, u); }
  }
  return n;
}
// an element with its attributes (setAttrs) and children (nodes, or text; null and false left out, arrays flattened)
const el = (tag, attrs = {}, ...kids) => {
  const n = setAttrs(document.createElement(tag), attrs);
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
  return n;
};
// an SVG element with its attributes (setAttrs) and, given, its text
const SVG_NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}, text = null) => { const n = setAttrs(document.createElementNS(SVG_NS, tag), attrs); if (text != null) n.textContent = text; return n; };
// the children of a node replaced by these (null and false left out, arrays flattened)
const setKids = (node, ...kids) => node.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));

// the pills: a word on a rounded ground, its class saying what kind
const pill = (text, cls = "") => el("span", { class: `ktw-pill ${cls}` }, text);
const statusPill = (s) => pill(s || "—", `ktw-status-${s}`);
const evPill = (e) => pill(e || "—", `ktw-ev-${e}`);
const typePills = (types) => (types?.length ? types : ["—"]).map((t) => { const p = pill(typeName(t), "ktw-type"); if (t !== typeName(t)) p.title = t; return p; });
const entryPills = (e) => [...typePills(e.type), statusPill(e.status), evPill(e.evidence)];

// a Type's glyph as SVG nodes, the stage's shapes in small: [element, attributes] per part
const GLYPHS = {
  decision: [["path", { d: "M6 1 11 6 6 11 1 6z" }]],
  constraint: [["path", { d: "M1.5 1.5h9v9h-9z", fill: "none", stroke: "currentColor", "stroke-width": "1.4" }], ["path", { d: "M1.5 5h9v2h-9z" }]],
  workaround: [["path", { d: "M1.5 1.5h6l3 3v6h-9z", fill: "none", stroke: "currentColor", "stroke-width": "1.4", "stroke-dasharray": "2 1.5" }], ["path", { d: "M7.5 1.5v3h3", fill: "none", stroke: "currentColor", "stroke-width": "1.4" }]],
  incident: [["path", { d: "M6 1.2 11.2 10.8H.8z", fill: "none", stroke: "currentColor", "stroke-width": "1.4" }], ["path", { d: "M5.3 4.5h1.4v3.2H5.3zM5.3 8.5h1.4v1.3H5.3z" }]],
};
function typeGlyphSvg(kind) {
  const svg = svgEl("svg", { class: "ktw-type-glyph", viewBox: "0 0 12 12", width: "11", height: "11", "aria-hidden": "true", fill: "currentColor" });
  for (const [tag, attrs] of GLYPHS[kind] || []) svg.append(svgEl(tag, attrs));
  return svg;
}

// the platform's mark before a repository's name, from its URL (ktw-core.js HOSTS); none for a host no row knows
function hostMark(url) {
  const h = hostOf(url); if (!h) return null;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("class", "ktw-host-mark"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", h.name);
  // the name as aria-label, not as an SVG title element: that would join the link's text
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); path.setAttribute("d", h.path);
  svg.append(path); return svg;
}
// text with every search term in a <mark>, as nodes (highlightParts in ktw-core.js)
const marked = (text, terms) => highlightParts(text, terms).map((p) => (p.mark ? el("mark", {}, p.text) : p.text));
// navLink(nav) — links to places for a host's nav: a real anchor (middle-click, a new tab and a screen reader
// work) whose plain click moves through nav. `href` in attrs is the route; it keeps its place among the
// attributes, so the markup is as before.
const navLinks = (nav) => function navLink(attrs, ...kids) {
  const route = attrs.href; const own = attrs.onclick;
  return el("a", { ...attrs, href: nav.href(route), onclick: (ev) => {
    own?.(ev);
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || attrs.target) return;
    ev.preventDefault(); nav.go(route);
  } }, ...kids);
};

// the "opens elsewhere" mark after a link that leaves the page: a box with an arrow out of it
function extIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("class", "ktw-ext-icon"); svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z");
  svg.append(path); return svg;
}
// a link out of the page to an address from the data (attrs.href): an <a> as given when core.safeUrl passes the
// address; otherwise a <span> with the same children and the rest of the attributes — shown, not followed
const outLink = (attrs, ...kids) => {
  if (safeUrl(attrs.href)) return el("a", attrs, ...kids);
  const { href, target, rel, ...rest } = attrs; return el("span", rest, ...kids);
};
// a link out of the page, with the mark after it; an address core.safeUrl rejects is its text, without the mark
const extLink = (href, text, cls = "") => (safeUrl(href) ? el("a", { class: `ktw-ext ${cls}`.trim(), href, target: "_blank", rel: "noopener" }, text, extIcon()) : el("span", { class: cls || null }, text));
const remoteLink = (remote) => outLink({ class: "ktw-gh", href: `https://${remote}`, target: "_blank", rel: "noopener" }, hostMark(remote), remote);
const onGitHub = (g) => !!g?.remote && /^github\.com\//.test(g.remote);
// a fork checkout: `origin` is the fork, the published repository is elsewhere — read from
// the `upstream` remote, or from `canonical` in .keep-the-why differing from `origin`
// (these two take the view's words, `tw`, last; without them the English)
const forkTitle = (f, tw) => f.by === "upstream" ? tw("ui.fork.byUpstream", "this checkout has an `upstream` remote: origin is a fork of it") : tw("ui.fork.byCanonical", "origin differs from the project's `canonical` (.keep-the-why): this checkout is a fork or mirror of it");
const forkPill = (g, tw = english) => g?.fork ? el("span", { class: "ktw-pill ktw-fork", title: forkTitle(g.fork, tw) }, tw("ui.fork.of", "fork of {remote}", { remote: remoteLink(g.fork.of) })) : null;
const headPill = (g, tw = english) => {
  if (!g?.available) return null;
  const branch = g.branch && g.branch !== "HEAD" ? g.branch : null;
  if (!onGitHub(g)) return el("span", { class: "ktw-pill", title: g.remote || "" }, `${branch || tw("ui.head.detached", "detached")}@${g.head}`);
  const base = `https://${g.remote}`;
  return el("span", { class: "ktw-pill", title: tw("ui.head.onGitHub", "branch and commit on GitHub") },
    branch ? outLink({ class: "ktw-gh", href: `${base}/tree/${encodeURIComponent(branch)}`, target: "_blank", rel: "noopener" }, branch) : tw("ui.head.detached", "detached"), "@",
    outLink({ class: "ktw-gh", href: `${base}/commit/${g.head_full || g.head}`, target: "_blank", rel: "noopener", title: g.head_full || g.head }, g.head));
};

const KTW = (root.KeepTheWhy = root.KeepTheWhy || {});
KTW.ui = Object.freeze({ words, english, roleWord, el, svgEl, setAttrs, setKids, pill, statusPill, evPill, typePills, entryPills, GLYPHS, typeGlyphSvg, hostMark, marked, navLinks, outLink, extLink, remoteLink, forkPill, headPill });
})(globalThis);
