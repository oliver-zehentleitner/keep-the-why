// Text on accent meets WCAG AA (4.5:1) in both themes, read from the stylesheets as they ship, not from numbers
// written here: ktw-views.css (its fallbacks are what a host without the tokens gets), and style.css's two
// themes (the dashboard's values). Text on a solid accent area is --ktw-on-accent over --ktw-accent-fill;
// accent-coloured text is --ktw-accent-text, against the page, the surface and the type pill's tint. And no
// rule draws text in the raw accent or in white on it, where the pairs would not reach.
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

test("the dashboard's own chrome sets the same pairs as the views, in both themes", () => {
  for (const [vals, theme] of [[DARK, "dark"], [LIGHT, "light"]]) {
    for (const k of ["accent-fill", "on-accent", "accent-text"]) assert.equal(vals[k], vals[`ktw-${k}`], `${theme}: --${k} is --ktw-${k}`);
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
