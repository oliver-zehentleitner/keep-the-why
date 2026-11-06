// Text on accent meets WCAG AA (4.5:1) in both themes, read from the stylesheets as they ship, not from numbers
// written here: ktw-views.css (its fallbacks are what a host without the tokens gets), and style.css's two
// themes (the dashboard's values). Text on a solid accent area is --ktw-on-accent over --ktw-accent-fill;
// accent-coloured text is --ktw-accent-text, against the page, the surface and the type pill's tint; the active
// status pill's text is --ktw-status-active-text on the pill's ground. And no rule draws text that resolves to the
// raw accent, whatever token it comes through, nor a gradient text whose colours do not reach.
//
//   node --test contrast.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const W = new URL("../../ktw_dashboard/web/", import.meta.url).pathname;
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const VIEWS = strip(fs.readFileSync(W + "ktw-views.css", "utf8"));
const STYLE = strip(fs.readFileSync(W + "style.css", "utf8"));

// the custom properties a block sets
function block(css, head) {
  const at = css.indexOf(`${head} {`);
  assert.ok(at >= 0, `no ${head} block`);
  const body = css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
  return Object.fromEntries([...body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
const DARK = block(STYLE, ":root");
const LIGHT = { ...DARK, ...block(STYLE, ':root[data-theme="light"]') };
// every rule: its selector and declarations
const rules = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
// a token's fallback in ktw-views.css (they are all the same value: test_views.py holds them to TOKEN_DEFAULTS)
function fallback(name) {
  const m = VIEWS.match(new RegExp(`var\\(${name},\\s*(#[0-9a-fA-F]{3,8})\\)`));
  assert.ok(m, `ktw-views.css reads ${name} nowhere with a fallback`);
  return m[1];
}

function rgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const [r, g, b] = rgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// color-mix(in srgb, a p%, b): what the type pill's tint is over its background
const mix = (a, p, b) => "#" + rgb(a).map((v, i) => Math.round(v * p + rgb(b)[i] * (1 - p)).toString(16).padStart(2, "0")).join("");

const AA = 4.5;
const THEMES = {
  "the views' fallbacks": { fill: fallback("--ktw-accent-fill"), on: fallback("--ktw-on-accent"), text: fallback("--ktw-accent-text"), accent: fallback("--ktw-accent"), bg: fallback("--ktw-bg"), surface: fallback("--ktw-surface") },
  "the dashboard, dark": { fill: DARK["ktw-accent-fill"], on: DARK["ktw-on-accent"], text: DARK["ktw-accent-text"], accent: DARK["ktw-accent"], bg: DARK["ktw-bg"], surface: DARK["ktw-surface"] },
  "the dashboard, light": { fill: LIGHT["ktw-accent-fill"], on: LIGHT["ktw-on-accent"], text: LIGHT["ktw-accent-text"], accent: LIGHT["ktw-accent"], bg: LIGHT["ktw-bg"], surface: LIGHT["ktw-surface"] },
};
for (const [t, vals] of [[THEMES["the views' fallbacks"], null], [THEMES["the dashboard, dark"], DARK], [THEMES["the dashboard, light"], LIGHT]]) {
  t.active = vals ? vals["ktw-status-active-text"] : fallback("--ktw-status-active-text");
  t.surface2 = vals ? vals["ktw-surface2"] : fallback("--ktw-surface2");
}
// a value as the colour it is in a theme: each var() as the theme sets it, else as its fallback
function resolve(value, vals) {
  let v = value;
  for (let i = 0; i < 5 && /var\(/.test(v); i++) {
    v = v.replace(/var\(--([\w-]+)(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (m, name, fb) => (vals && vals[name]) || (fb || "").trim() || m);
  }
  return v.trim().toLowerCase();
}
const RESOLVE_IN = { "the views' fallbacks": null, "the dashboard, dark": DARK, "the dashboard, light": LIGHT };
// the raw colours as text, per theme, wherever a text token takes their place: the accent #835bec everywhere and
// #a98cf5 in light; the old faint text (#6f6f7a, light #8a8a96), now --ktw-fg3-line; and the status, evidence and
// severity colours where they miss AA as text (bad and pending in dark, all of them and superseded in light)
const DARK_RAW = ["#835bec", "#6f6f7a", "#e0574f", "#d66fd6"];
const RAW = { "the views' fallbacks": DARK_RAW, "the dashboard, dark": DARK_RAW,
  "the dashboard, light": ["#835bec", "#a98cf5", "#8a8a96", "#9a9aa6", "#4fbf7a", "#e0a83a", "#e0574f", "#4aa3df", "#d66fd6"] };
// an SVG `fill` is text colour only on text: these selectors fill a shape, a mark that keeps the colour itself
const DECORATIVE_FILLS = new Set([".ktw-timeline .ktw-sup"]); // the per-week superseded marks under the timeline's bars
// the text tokens of the status, evidence and severity colours, and the faint text
const TEXT_TOKENS = ["ok-text", "confirmed-text", "warn-text", "inferred-text", "status-needs-review-text", "bad-text", "unknown-text",
  "info-text", "status-open-text", "status-pending-confirmation-text", "status-superseded-text", "fg3"];

test("text on a solid accent area: --ktw-on-accent over --ktw-accent-fill, 4.5:1 in every theme", () => {
  for (const [name, t] of Object.entries(THEMES)) {
    const r = ratio(t.on, t.fill);
    assert.ok(r >= AA, `${name}: ${t.on} on ${t.fill} is ${r.toFixed(2)}:1`);
  }
});

test("accent-coloured text: --ktw-accent-text on the page, the surface and the type pill's tint, 4.5:1 in every theme", () => {
  const pill = rules(VIEWS).find((r) => r.sel === ".ktw-pill.ktw-type");
  assert.match(pill.body, /color-mix\(in srgb, var\(--ktw-accent, #835bec\) 18%, transparent\)/, "the pill's tint is the one measured here");
  for (const [name, t] of Object.entries(THEMES)) {
    for (const [where, under] of [["page", t.bg], ["surface", t.surface], ["pill on the page", mix(t.accent, 0.18, t.bg)], ["pill on the surface", mix(t.accent, 0.18, t.surface)]]) {
      const r = ratio(t.text, under);
      assert.ok(r >= AA, `${name}: ${t.text} on the ${where} (${under}) is ${r.toFixed(2)}:1`);
    }
  }
});

test("the active status pill's text: --ktw-status-active-text on the pill's ground, the surface and the page, 4.5:1 in every theme", () => {
  for (const [name, t] of Object.entries(THEMES)) {
    for (const [where, under] of [["pill", t.surface2], ["surface", t.surface], ["page", t.bg]]) {
      const r = ratio(t.active, under);
      assert.ok(r >= AA, `${name}: ${t.active} on the ${where} (${under}) is ${r.toFixed(2)}:1`);
    }
  }
});

test("status, evidence and severity text, and the faint text: each text token on a pill's ground, the surface and the page, 4.5:1 in every theme", () => {
  for (const [name, vals] of Object.entries(RESOLVE_IN)) {
    const ground = (k) => (vals ? vals[`ktw-${k}`] : fallback(`--ktw-${k}`));
    for (const tok of TEXT_TOKENS) {
      const c = vals ? vals[`ktw-${tok}`] : fallback(`--ktw-${tok}`);
      for (const where of ["surface2", "surface", "bg"]) {
        const r = ratio(c, ground(where));
        assert.ok(r >= AA, `${name}: --ktw-${tok} ${c} on ${where} (${ground(where)}) is ${r.toFixed(2)}:1`);
      }
    }
  }
});

test("the dashboard's chrome sets the same text tokens as the views, in both themes", () => {
  const SHELL = { ok: "ok", confirmed: "confirmed", warn: "warn", inferred: "inferred", "status-needs-review": "needs-review", bad: "bad", unknown: "unknown", info: "info", "status-open": "open", "status-pending-confirmation": "pending-confirmation", "status-superseded": "superseded" };
  for (const [vals, theme] of [[DARK, "dark"], [LIGHT, "light"]]) {
    for (const [tok, v] of Object.entries(SHELL)) assert.equal(vals[`${v}-text`], vals[`ktw-${tok}-text`], `${theme}: --${v}-text is --ktw-${tok}-text`);
    assert.equal(vals.fg3, vals["ktw-fg3"], `${theme}: --fg3 is --ktw-fg3`);
    assert.equal(vals["fg3-line"], vals["ktw-fg3-line"], `${theme}: --fg3-line is --ktw-fg3-line`);
  }
});

test("no text resolves to the raw accent, through whatever token: color, fill and a text fill", () => {
  for (const [file, css] of [["ktw-views.css", VIEWS], ["style.css", STYLE]]) {
    for (const r of rules(css)) {
      if (r.sel.startsWith(":root")) continue;
      const decl = Object.fromEntries([...r.body.matchAll(/(?:^|;)\s*([\w-]+)\s*:\s*([^;]+)/g)].map((m) => [m[1], m[2].trim()]));
      for (const prop of ["color", "fill", "-webkit-text-fill-color"]) {
        if (!decl[prop] || (prop === "fill" && DECORATIVE_FILLS.has(r.sel))) continue;
        for (const [theme, vals] of Object.entries(RESOLVE_IN)) {
          const c = resolve(decl[prop], vals);
          assert.ok(!RAW[theme].includes(c), `${file} ${r.sel}: ${prop} resolves to ${c} in ${theme}, a raw colour a text token takes the place of`);
        }
      }
    }
  }
});

// The stops are enough here: between two stops each channel is interpolated linearly in sRGB, and in the update
// hint's gradient every channel moves the same way between neighbouring stops (all up in dark, #a98cf5 to #dcd0fb;
// all down in light, #6234d9 to #3b1d99), so the luminance, and the ratio against a plain ground, lies between
// the stops' and is lowest at one of them.
test("every decorative fill named above is still a rule of the stylesheet", () => {
  const sels = new Set(rules(VIEWS).map((r) => r.sel));
  for (const s of DECORATIVE_FILLS) assert.ok(sels.has(s), `${s} is gone from ktw-views.css — drop it from DECORATIVE_FILLS`);
});

test("text drawn by a gradient (a transparent text fill) reaches 4.5:1 at every colour of the gradient, in both themes", () => {
  let seen = 0;
  for (const r of rules(STYLE).concat(rules(VIEWS))) {
    if (!/-webkit-text-fill-color:\s*transparent/.test(r.body)) continue;
    seen++;
    const bgDecl = r.body.match(/background(?:-image)?:\s*([^;]+)/)[1];
    for (const [theme, vals] of [["dark", DARK], ["light", LIGHT]]) {
      const stops = resolve(bgDecl, vals).match(/#[0-9a-f]{3,8}/g) || [];
      assert.ok(stops.length >= 2, `${r.sel}: no colours in its gradient`);
      for (const s of stops) for (const under of [vals.bg, vals.bg2]) {
        const q = ratio(s, under);
        assert.ok(q >= AA, `${r.sel} (${theme}): the gradient's ${s} on ${under} is ${q.toFixed(2)}:1`);
      }
    }
  }
  assert.ok(seen >= 1, "the update hint's shimmer is the gradient text this test is for");
});

test("the dashboard's own chrome sets the same pairs as the views, in both themes", () => {
  for (const [vals, theme] of [[DARK, "dark"], [LIGHT, "light"]]) {
    for (const k of ["accent-fill", "on-accent", "accent-text"]) assert.equal(vals[k], vals[`ktw-${k}`], `${theme}: --${k} is --ktw-${k}`);
    assert.equal(vals["active-text"], vals["ktw-status-active-text"], `${theme}: --active-text is --ktw-status-active-text`);
  }
});

test("every rule that puts text on a solid accent takes the pair, and no rule draws text in the raw accent", () => {
  for (const [file, css, tok] of [["ktw-views.css", VIEWS, "--ktw-"], ["style.css", STYLE, "--"]]) {
    for (const r of rules(css)) {
      if (r.sel.startsWith(":root")) continue;
      const decl = Object.fromEntries([...r.body.matchAll(/(?:^|;)\s*([\w-]+)\s*:\s*([^;]+)/g)].map((m) => [m[1], m[2].trim()]));
      const solid = /^var\(--(ktw-)?accent(-fill)?[,)]/.test(decl.background || decl["background-color"] || "");
      if (solid && decl.color) {
        assert.match(decl.background || decl["background-color"], new RegExp(`^var\\(${tok}accent-fill[,)]`), `${file} ${r.sel}: text on accent sits on ${tok}accent-fill`);
        assert.match(decl.color, new RegExp(`^var\\(${tok}on-accent[,)]`), `${file} ${r.sel}: its text is ${tok}on-accent`);
      }
      for (const prop of ["color", "fill"]) {
        if (!decl[prop]) continue;
        assert.doesNotMatch(decl[prop], /^var\(--(ktw-)?accent2?[,)]/, `${file} ${r.sel}: ${prop} in the raw accent; text in accent is ${tok}accent-text`);
      }
    }
  }
});
