/* Keep the Why dashboard — the small pieces every view builds its DOM from: an element with its attributes,
   handlers and children (`el`), children replaced in place (`setKids`), the pills for a Type, a Status and an
   Evidence, a Type's glyph and a host's mark as SVG, text with the searched words marked, a link to a place
   that moves through the host's nav, a link out of the page, and a checkout's branch, commit and fork as pills. Nodes only — no state, no HTML strings, nothing read from the page.
   A classic script on globalThis.KeepTheWhy.ui, listed in ktw-views.json after the core. */
(function (root) {
"use strict";
const { typeName, hostOf, highlightParts } = root.KeepTheWhy.core;

// Attributes on an element, HTML or SVG: class; style through the CSSOM — a page under a Content-Security-Policy
// without 'unsafe-inline' (Maity's hub pages, default-src 'self') drops a style attribute set as markup, not the
// element's style object; on<event> handlers; the rest as attributes. null or false leaves one out. Every element
// the views build gets its attributes here (el, svgEl), so no style reaches setAttribute.
function setAttrs(n, attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.setAttribute("class", v);
    else if (k === "style") n.style.cssText = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
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
const pill = (text, cls = "") => el("span", { class: `pill ${cls}` }, text);
const statusPill = (s) => pill(s || "—", `status-${s}`);
const evPill = (e) => pill(e || "—", `ev-${e}`);
const typePills = (types) => (types?.length ? types : ["—"]).map((t) => { const p = pill(typeName(t), "type"); if (t !== typeName(t)) p.title = t; return p; });
const entryPills = (e) => [...typePills(e.type), statusPill(e.status), evPill(e.evidence)];

// a Type's glyph as SVG nodes, the stage's shapes in small: [element, attributes] per part
const GLYPHS = {
  decision: [["path", { d: "M6 1 11 6 6 11 1 6z" }]],
  constraint: [["path", { d: "M1.5 1.5h9v9h-9z", fill: "none", stroke: "currentColor", "stroke-width": "1.4" }], ["path", { d: "M1.5 5h9v2h-9z" }]],
  workaround: [["path", { d: "M1.5 1.5h6l3 3v6h-9z", fill: "none", stroke: "currentColor", "stroke-width": "1.4", "stroke-dasharray": "2 1.5" }], ["path", { d: "M7.5 1.5v3h3", fill: "none", stroke: "currentColor", "stroke-width": "1.4" }]],
  incident: [["path", { d: "M6 1.2 11.2 10.8H.8z", fill: "none", stroke: "currentColor", "stroke-width": "1.4" }], ["path", { d: "M5.3 4.5h1.4v3.2H5.3zM5.3 8.5h1.4v1.3H5.3z" }]],
};
function typeGlyphSvg(kind) {
  const svg = svgEl("svg", { class: "type-glyph", viewBox: "0 0 12 12", width: "11", height: "11", "aria-hidden": "true", fill: "currentColor" });
  for (const [tag, attrs] of GLYPHS[kind] || []) svg.append(svgEl(tag, attrs));
  return svg;
}

// the platform's mark before a repository's name, from its URL (ktw-core.js HOSTS); none for a host no row knows
function hostMark(url) {
  const h = hostOf(url); if (!h) return null;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("class", "host-mark"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", h.name);
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
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("class", "ext-icon"); svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z");
  svg.append(path); return svg;
}
// a link out of the page, with the mark after it
const extLink = (href, text, cls = "") => el("a", { class: `ext ${cls}`.trim(), href, target: "_blank", rel: "noopener" }, text, extIcon());
const remoteLink = (remote) => el("a", { class: "gh", href: `https://${remote}`, target: "_blank", rel: "noopener" }, hostMark(remote), remote);
const onGitHub = (g) => !!g?.remote && /^github\.com\//.test(g.remote);
// a fork checkout: `origin` is the fork, the published repository is elsewhere — read from
// the `upstream` remote, or from `canonical` in .keep-the-why differing from `origin`
const forkTitle = (f) => f.by === "upstream" ? "this checkout has an `upstream` remote: origin is a fork of it" : "origin differs from the project's `canonical` (.keep-the-why): this checkout is a fork or mirror of it";
const forkPill = (g) => g?.fork ? el("span", { class: "pill fork", title: forkTitle(g.fork) }, "fork of ", remoteLink(g.fork.of)) : null;
const headPill = (g) => {
  if (!g?.available) return null;
  const branch = g.branch && g.branch !== "HEAD" ? g.branch : null;
  if (!onGitHub(g)) return el("span", { class: "pill", title: g.remote || "" }, `${branch || "detached"}@${g.head}`);
  const base = `https://${g.remote}`;
  return el("span", { class: "pill", title: "branch and commit on GitHub" },
    branch ? el("a", { class: "gh", href: `${base}/tree/${encodeURIComponent(branch)}`, target: "_blank", rel: "noopener" }, branch) : "detached", "@",
    el("a", { class: "gh", href: `${base}/commit/${g.head_full || g.head}`, target: "_blank", rel: "noopener", title: g.head_full || g.head }, g.head));
};

const KTW = (root.KeepTheWhy = root.KeepTheWhy || {});
KTW.ui = Object.freeze({ el, svgEl, setAttrs, setKids, pill, statusPill, evPill, typePills, entryPills, GLYPHS, typeGlyphSvg, hostMark, marked, navLinks, extLink, remoteLink, forkPill, headPill });
})(globalThis);
