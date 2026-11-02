/* Keep the Why dashboard — the small pieces every view builds its DOM from: an element with its attributes,
   handlers and children (`el`), children replaced in place (`setKids`), the pills for a Type, a Status and an
   Evidence, and a Type's glyph as SVG. Nodes only — no state, no HTML strings, nothing read from the page.
   A classic script on globalThis.KeepTheWhy.ui, listed in ktw-views.json after the core. */
(function (root) {
"use strict";
const { typeName } = root.KeepTheWhy.core;

// an element: attributes (class, on<event> handlers, the rest as attributes; null or false leaves one out) and
// children (nodes, or text; null and false left out, arrays flattened)
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
  return n;
};
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
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ class: "type-glyph", viewBox: "0 0 12 12", width: "11", height: "11", "aria-hidden": "true", fill: "currentColor" })) svg.setAttribute(k, v);
  for (const [tag, attrs] of GLYPHS[kind] || []) { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); svg.append(n); }
  return svg;
}

const KTW = (root.KeepTheWhy = root.KeepTheWhy || {});
KTW.ui = Object.freeze({ el, setKids, pill, statusPill, evPill, typePills, entryPills, GLYPHS, typeGlyphSvg });
})(globalThis);
