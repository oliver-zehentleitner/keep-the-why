// One-off check for the stylesheet split (ktw-views.css before style.css): no element on any route gets a
// different winning declaration than it did from the one stylesheet before.
//
// Loads two pages built from the frozen fixture — the base (one style.css) and the split — drives the same
// routes in jsdom, and pairs their elements by tag path (the classes are renamed between the two). For every
// element it collects the declarations of every rule that matches, from the page's own stylesheets in load
// order, and decides the cascade itself: !important, then specificity, then order. jsdom's computed styles do
// not do that, and no browser is assumed. It does so at four viewport widths, each @media rule evaluated for
// it; :hover, :focus and the like count as on, so their rules are compared too. Token names are compared as
// the dashboard's variables (var(--ktw-fg2, #a2a2ad) as var(--fg2)); test_views.py holds the values equal.
//
// It compares what each element declares, not what it inherits: a container that now declares a value its
// children used to inherit from further up shows only on the container (EXPECTED names each such case with the
// exact declaration); whether the inherited value was the same at every width is computed-styles.mjs's to show,
// in Chromium.
//
// A shorthand and its longhands are compared as a family (border, border-color, border-left-color …): the
// family's winning declarations in cascade order, so a longhand that now loses to a shorthand shows.
//
//   node cascade-check.mjs BASEPAGE SPLITPAGE
//
// Prints the number of element × family comparisons and every difference; exit 1 on any difference that is
// not an expected one (EXPECTED below, each with its reason).
process.env.TZ = "UTC";
import { JSDOM, VirtualConsole } from "jsdom";
import { moduleAsClassic } from "./classic.mjs";
import fs from "node:fs";
import { ADDED } from "./added-elements.mjs";

const NOW = Date.parse("2026-06-15T12:00:00Z");
const WIDTHS = [1400, 1000, 800, 500];
const [basePage, splitPage] = process.argv.slice(2);
if (!splitPage) { console.error("usage: node cascade-check.mjs BASEPAGE SPLITPAGE"); process.exit(2); }

const TOKEN_OF = { bg: "bg", bg2: "surface", bg3: "surface2", line: "line", fg: "fg", fg2: "fg2", fg3: "fg3", accent: "accent", accent2: "accent2", "accent-fill": "accent-fill", "on-accent": "on-accent", "accent-text": "accent-text", "active-text": "status-active-text",
  ok: "ok", warn: "warn", bad: "bad", info: "info", muted: "muted", confirmed: "confirmed", inferred: "inferred", unknown: "unknown",
  active: "status-active", superseded: "status-superseded", open: "status-open", "needs-review": "status-needs-review",
  "pending-confirmation": "status-pending-confirmation", radius: "radius", font: "font", mono: "mono" };
const VAR_OF = Object.fromEntries(Object.entries(TOKEN_OF).map(([v, t]) => [`ktw-${t}`, v]));
// a var() as the dashboard's variable it reads, its fallback left out (the fallbacks are held equal by test_views.py)
const norm = (v) => v.replace(/var\(--([\w-]+)(?:,[^()]*(?:\([^()]*\)[^()]*)*)?\)/g, (m, t) => `var(--${VAR_OF[t] || t})`).replace(/\s+/g, " ").trim();

// what the split adds on purpose, and why it renders the same
const EXPECTED = [
  // #main and #details carry ktw-root now: the views' font family and text colour on their container, the values
  // the body has at every width (its size, which grows on a phone, is left to the host) and they inherited before
  { path: /^body:\d+\/div:\d+\/(main|aside):\d+$/, family: "font", split: "font-family: var(--font)" },
  { path: /^body:\d+\/div:\d+\/(main|aside):\d+$/, family: "color", split: "color: var(--fg)" },
];
// what the split changes on purpose: one declaration of the base's family replaced by another, the rest the same.
// WCAG AA for text on accent (context/dashboard.md, "Text on accent is a pair of tokens"): accent-coloured text
// reads --ktw-accent-text, text on a solid accent sits as --ktw-on-accent on --ktw-accent-fill
const REPLACED = [
  { family: "color", base: "color: var(--accent2)", split: "color: var(--accent-text)" },
  { family: "color", base: "color: var(--accent)", split: "color: var(--accent-text)" },
  { family: "color", base: "color: #fff", split: "color: var(--on-accent)" },
  { family: "background", base: "background: var(--accent)", split: "background: var(--accent-fill)" },
  { family: "border", base: "border-color: var(--accent)", split: "border-color: var(--accent-fill)" },
  { family: "fill", base: "fill: var(--accent2)", split: "fill: var(--accent-text)" },
  { family: "color", base: "color: var(--active)", split: "color: var(--active-text)" },
  { family: "background", base: "background: linear-gradient(90deg, var(--accent2) 0%, #fff 45%, var(--accent2) 55%, var(--accent2) 100%)", split: "background: linear-gradient(90deg, var(--accent-text) 0%, var(--accent-shine) 45%, var(--accent-text) 55%, var(--accent-text) 100%)" },
];

// ---- specificity and matching for the selectors this stylesheet uses
const STATE = /:(hover|focus|focus-visible|focus-within|active|visited)(?![\w-])/g;
function specificity(sel) {
  let a = 0, b = 0, c = 0;
  let s = sel.replace(/:(not|is|has)\(([^()]*)\)/g, (_, k, inner) => { const [x, y, z] = specificity(inner.split(",")[0]); a += x; b += y; c += z; return ""; });
  s = s.replace(/:where\([^()]*\)/g, "");
  s = s.replace(/::?(before|after|placeholder|-webkit-[\w-]+|first-line|first-letter|marker|selection)/g, () => { c++; return ""; });
  s = s.replace(/#[\w-]+/g, () => { a++; return ""; });
  s = s.replace(/\.[\w-]+|\[[^\]]*\]|:[\w-]+(\([^()]*\))?/g, () => { b++; return ""; });
  s.replace(/(^|[\s>+~])([a-zA-Z][\w-]*)/g, () => { c++; return ""; });
  return [a, b, c];
}
const pseudoOf = (sel) => (sel.match(/::?(before|after|placeholder|-webkit-[\w-]+|first-line|first-letter|marker|selection)$/) || [""])[0].replace(/^:+/, "::");
const matchable = (sel) => sel.replace(/::?(before|after|placeholder|-webkit-[\w-]+|first-line|first-letter|marker|selection)$/, "").replace(STATE, "").replace(/:where\(\s*\)/g, "") || "*";
const splitSelectors = (text) => text.split(/,(?![^()]*\))/).map((s) => s.trim());

function mediaOn(text, width) {
  return text.split(",").some((q) => q.trim().split(/\s+and\s+/).every((f) => {
    let m;
    if ((m = f.match(/\(max-width:\s*(\d+)px\)/))) return width <= +m[1];
    if ((m = f.match(/\(min-width:\s*(\d+)px\)/))) return width >= +m[1];
    if (/prefers-reduced-motion/.test(f)) return false;
    if (/^(screen|all)$/.test(f.trim())) return true;
    throw new Error(`media query not understood: ${text}`);
  }));
}

// every style rule of the page, flattened with its media condition and its place in the cascade
function rulesOf(doc) {
  const out = []; let order = 0;
  const walk = (list, media) => {
    for (const r of list) {
      if (r.type === 4) walk(r.cssRules, [...media, r.media.mediaText]);
      else if (r.type === 1) {
        const decls = [];
        for (let i = 0; i < r.style.length; i++) { const p = r.style[i]; decls.push({ p, v: norm(r.style.getPropertyValue(p)), imp: r.style.getPropertyPriority(p) === "important" }); }
        for (const sel of splitSelectors(r.selectorText)) out.push({ sel, test: matchable(sel), pseudo: pseudoOf(sel), spec: specificity(sel), order: order, media, decls });
        order++;
      }
    }
  };
  for (const sheet of doc.styleSheets) walk(sheet.cssRules, []);
  return out;
}

// for one element at one width: family -> the winning declarations, in cascade order, as text
function cascade(el, rules, width) {
  const byProp = new Map();
  for (const r of rules) {
    if (!r.media.every((m) => mediaOn(m, width))) continue;
    let hit = false; try { hit = el.matches(r.test); } catch { continue; }
    if (!hit) continue;
    for (const d of r.decls) {
      const key = r.pseudo + d.p;
      const rank = [d.imp ? 1 : 0, ...r.spec, r.order];
      const cur = byProp.get(key);
      if (!cur || cmp(rank, cur.rank) >= 0) byProp.set(key, { rank, v: d.v, p: key });
    }
  }
  const fam = new Map();
  for (const w of byProp.values()) { const f = w.p.replace(/^::[\w-]+/, (m) => m + " ").split("-")[0]; (fam.get(f) || fam.set(f, []).get(f)).push(w); }
  // per family: the winners, and — where a shorthand and one of its longhands both win — which comes later
  const out = new Map();
  for (const [f, ws] of fam) {
    const vals = ws.map((w) => `${w.p}: ${w.v}`).sort();
    const order = [];
    for (const x of ws) for (const y of ws) if (y.p.startsWith(x.p + "-") && cmp(x.rank, y.rank) > 0) order.push(`${x.p} over ${y.p}`);
    out.set(f, vals.join("; ") + (order.length ? ` | ${order.sort().join(", ")}` : ""));
  }
  return out;
}
function cmp(a, b) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; }

// ---- the page, driven as snapshot.mjs drives it
async function load(file) {
  const vc = new VirtualConsole();
  const dom = new JSDOM(moduleAsClassic(fs.readFileSync(file, "utf8")), {
    runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/", virtualConsole: vc,
    beforeParse(window) {
      const RealDate = window.Date;
      class FixedDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } }
      window.Date = FixedDate;
      let seed = 0x2f1c5b7e;
      window.Math.random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      window.ResizeObserver = class { observe() {} disconnect() {} };
      window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k === "measureText" ? () => ({ width: 10 }) : () => {}), set: () => true });
      window.requestAnimationFrame = (fn) => window.setTimeout(() => fn(0), 16);
      window.cancelAnimationFrame = (id) => window.clearTimeout(id);
      window.matchMedia = () => ({ matches: false });
      window.CSS = { escape: (s) => s.replace(/([^\w-])/g, "\\$1") };
    },
  });
  const tick = (ms) => new Promise((r) => setTimeout(r, ms));
  await tick(300);
  return { dom, go: async (hash) => { dom.window.location.hash = hash; dom.window.dispatchEvent(new dom.window.Event("hashchange")); await tick(150); } };
}
// an element the pull request adds on purpose (added-elements.mjs): left out, with its subtree, and not counted
// among its siblings
const added = (el) => ADDED.some((x) => el.closest(x.selector));
const pathOf = (el) => { const p = []; for (let n = el; n && n.localName !== "html"; n = n.parentElement) p.push(`${n.localName}:${n.parentElement ? [...n.parentElement.children].filter((c) => !added(c)).indexOf(n) : 0}`); return p.reverse().join("/"); };
const seen = new Map(ADDED.map((x) => [x.selector, { base: 0, split: 0 }]));
const tally = (doc, side) => { for (const x of ADDED) seen.get(x.selector)[side] += doc.querySelectorAll(x.selector).length; };

const base = await load(basePage), split = await load(splitPage);
const S = base.dom.window.__KTW_STATE__;
const byTitle = (part) => S.entries.find((e) => e.title.includes(part));
const routes = [
  "#overview", "#graph", "#timeline", "#timeline/2026-04-15", "#authors", "#queues", "#findings", "#family", "#projects", "#friends", "#thoughts",
  ...S.topics.map((t) => `#topic/${t.file}`),
  ...["waits for the snapshot", "versioned snapshot", "retry three times", "capped at one megabyte", "stable code", "Temporary files", "Pasted"].map((t) => `#entry/${byTitle(t).uuid}`),
  "#search/self/snapshot",
];
const baseRules = rulesOf(base.dom.window.document), splitRules = rulesOf(split.dom.window.document);

let compared = 0, expected = 0; const diffs = [];
for (const hash of routes) {
  await base.go(hash); await split.go(hash);
  tally(base.dom.window.document, "base"); tally(split.dom.window.document, "split");
  const A = [...base.dom.window.document.body.querySelectorAll("*")].filter((e) => !added(e)), B = [...split.dom.window.document.body.querySelectorAll("*")].filter((e) => !added(e));
  if (A.length !== B.length) { diffs.push(`${hash}: ${A.length} elements in the base, ${B.length} in the split`); continue; }
  for (let i = 0; i < A.length; i++) {
    const path = pathOf(A[i]);
    if (path !== pathOf(B[i])) { diffs.push(`${hash}: element ${i} is ${path} in the base, ${pathOf(B[i])} in the split`); break; }
    for (const w of WIDTHS) {
      const a = cascade(A[i], baseRules, w), b = cascade(B[i], splitRules, w);
      for (const f of new Set([...a.keys(), ...b.keys()])) {
        compared++;
        if (a.get(f) === b.get(f)) continue;
        // expected: the split's family is the base's plus exactly the one declaration named
        const plus = (x) => { const parts = (b.get(f) || "").split("; ").filter((d) => d !== x.split); return parts.join("; ") === (a.get(f) || "") && parts.length < (b.get(f) || "").split("; ").length; };
        if (EXPECTED.some((x) => x.path.test(path) && x.family === f && plus(x))) { expected++; continue; }
        const swapped = (s) => REPLACED.filter((x) => x.family === f).reduce((acc, x) => acc.split("; ").map((d) => (d === x.base ? x.split : d)).join("; "), s);
        if (a.has(f) && b.has(f) && swapped(a.get(f)) === b.get(f)) { expected++; continue; }
        diffs.push(`${hash} @${w}px ${path} [${f}]\n    base:  ${a.get(f) ?? "(none)"}\n    split: ${b.get(f) ?? "(none)"}`);
      }
    }
  }
}
for (const [sel, n] of seen) {
  if (!n.split) diffs.push(`added-elements.mjs: "${sel}" matches nothing in the split — a stale entry`);
  if (n.base) diffs.push(`added-elements.mjs: "${sel}" matches ${n.base} elements in the base — not an addition`);
}
const uniq = [...new Set(diffs)];
for (const d of uniq.slice(0, 60)) console.log(d);
console.log(`\n${routes.length} routes × ${WIDTHS.length} widths: ${compared} element × property-family comparisons, ${uniq.length} differ, ${expected} expected (EXPECTED); added on purpose (added-elements.mjs): ${[...seen].map(([s, n]) => `${s} ×${n.split}`).join(", ") || "none"}`);
base.dom.window.close(); split.dom.window.close();
process.exit(uniq.length ? 1 : 0);
