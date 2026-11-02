// ktw-ui.js in jsdom: el() writes a style through the CSSOM, never as an attribute. A page under a
// Content-Security-Policy without 'unsafe-inline' — Maity's hub pages answer with default-src 'self' (Maity's
// docs/api.md, §1.1) — drops a style attribute set as markup; the element's style object it leaves alone.
// test_views.py forbids style= and setAttribute("style") in the library's text; this holds the one place that
// sets a style to the CSSOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const realm = dom.getInternalVMContext();
for (const name of ["ktw-core.js", "ktw-ui.js"]) {
  const file = new URL(`../../ktw_dashboard/web/${name}`, import.meta.url);
  vm.runInContext(fs.readFileSync(file, "utf8"), realm, { filename: file.pathname });
}
const { ui } = dom.window.KeepTheWhy;

test("el() sets a style through the element's style object, not setAttribute", () => {
  const calls = [];
  const real = dom.window.Element.prototype.setAttribute;
  dom.window.Element.prototype.setAttribute = function (name, value) { calls.push(name); return real.call(this, name, value); };
  try {
    const n = ui.el("i", { class: "ktw-dot", style: "width:12px;background:var(--ktw-accent, #835bec)", title: "t" });
    assert.ok(!calls.includes("style"), `setAttribute was called for: ${calls.join(", ")}`);
    assert.equal(n.style.width, "12px");
    assert.match(n.style.background || n.style.getPropertyValue("background"), /--ktw-accent/);
    assert.ok(calls.includes("title"), "other attributes still go through setAttribute");
  } finally {
    dom.window.Element.prototype.setAttribute = real;
  }
});

test("svgEl() and the Type glyphs set a style through the CSSOM too", () => {
  const calls = [];
  const real = dom.window.Element.prototype.setAttribute;
  dom.window.Element.prototype.setAttribute = function (name, value) { calls.push(name); return real.call(this, name, value); };
  try {
    const n = ui.svgEl("rect", { class: "b", x: 1, style: "opacity:0.5" }, "t");
    assert.ok(!calls.includes("style"), `setAttribute was called for: ${calls.join(", ")}`);
    assert.equal(n.style.opacity, "0.5");
    assert.equal(n.getAttribute("class"), "b");
    assert.equal(n.namespaceURI, "http://www.w3.org/2000/svg");
    const glyph = ui.typeGlyphSvg("decision");
    assert.ok(glyph.querySelector("*"), "the glyph has its shapes");
    assert.ok(!calls.includes("style"));
  } finally {
    dom.window.Element.prototype.setAttribute = real;
  }
});
