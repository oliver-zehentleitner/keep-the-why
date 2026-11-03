// The views' words (ktw-ui.js `words`): every tw() call in the library's files names its key and its English as
// string literals, and ktw-words.json lists exactly those, key for key and word for word — a key in the code and not
// in the file fails, and one in the file the code no longer has. The hook itself: the host's answer, the English for
// undefined, a warning once per key for a throw or a non-string, placeholders filled in either text, a node put in
// where the host's word order puts it.
//
//   node --test words.test.mjs           check
//   node words.test.mjs --update         write ktw-words.json from the code
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { JSDOM } from "jsdom";

const WEB = new URL("../../ktw_dashboard/web/", import.meta.url);
const CATALOGUE = new URL("ktw-words.json", WEB);
const manifest = JSON.parse(fs.readFileSync(new URL("ktw-views.json", WEB), "utf8"));
const LITERAL = String.raw`"((?:[^"\\]|\\.)*)"`;

// every tw( call of every library file: [file, line, key, English], or the call that is not two literals
export function extract() {
  const found = [], bad = [];
  for (const name of manifest.scripts) {
    const src = fs.readFileSync(new URL(name, WEB), "utf8");
    for (const m of src.matchAll(/\btw\(/g)) {
      const line = src.slice(0, m.index).split("\n").length;
      // not a call: the function itself, or a mention in a comment (after // on its line, or inside /* */)
      const before = src.slice(src.lastIndexOf("\n", m.index) + 1, m.index);
      if (/function\s+$/.test(before) || before.includes("//") || src.lastIndexOf("/*", m.index) > src.lastIndexOf("*/", m.index)) continue;
      const call = new RegExp(String.raw`^tw\(\s*${LITERAL}\s*,\s*${LITERAL}\s*[,)]`).exec(src.slice(m.index));
      if (!call) { bad.push(`${name}:${line}: ${src.slice(m.index, m.index + 80).split("\n")[0]}`); continue; }
      found.push([name, line, JSON.parse(`"${call[1]}"`), JSON.parse(`"${call[2]}"`)]);
    }
  }
  return { found, bad };
}
// key → English, and the keys the code gives two different English texts
function catalogue(found) {
  const words = {}, clash = [];
  for (const [name, line, key, en] of found) {
    if (key in words && words[key] !== en) clash.push(`${name}:${line}: "${key}" is "${words[key]}" elsewhere, here "${en}"`);
    else words[key] = en;
  }
  return { words: Object.fromEntries(Object.entries(words).sort(([a], [b]) => (a < b ? -1 : 1))), clash };
}

if (process.argv.includes("--update")) {
  const { found, bad } = extract(); const { words, clash } = catalogue(found);
  if (bad.length || clash.length) { console.error([...bad, ...clash].join("\n")); process.exit(1); }
  fs.writeFileSync(CATALOGUE, JSON.stringify(words, null, 2) + "\n");
  console.log(`ktw-words.json: ${Object.keys(words).length} keys`);
  process.exit(0);
}

test("every tw() call names its key and its English as string literals", () => {
  assert.deepEqual(extract().bad, []);
});

test("a key has one English text wherever it is used", () => {
  assert.deepEqual(catalogue(extract().found).clash, []);
});

test("ktw-words.json lists exactly the keys the code has, with their English", () => {
  const { words } = catalogue(extract().found);
  const file = JSON.parse(fs.readFileSync(CATALOGUE, "utf8"));
  assert.deepEqual(Object.keys(words).filter((k) => !(k in file)), [], "keys in the code, not in ktw-words.json (node words.test.mjs --update)");
  assert.deepEqual(Object.keys(file).filter((k) => !(k in words)), [], "keys in ktw-words.json the code no longer has");
  for (const k of Object.keys(words)) assert.equal(file[k], words[k], `the English of "${k}"`);
});

test("keys are dotted names", () => {
  for (const [name, line, key] of extract().found) assert.match(key, /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/, `${name}:${line}`);
});

// the hook itself, in a window with the core and the ui helpers
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const realm = dom.getInternalVMContext();
for (const name of ["ktw-core.js", "ktw-ui.js"]) vm.runInContext(fs.readFileSync(new URL(name, WEB), "utf8"), realm, { filename: name });
const { ui } = dom.window.KeepTheWhy;
const doc = dom.window.document;

test("the host's answer is used, the English where it answers undefined, and no hook means the English", () => {
  const tw = ui.words((key) => (key === "a.b" ? "Ja" : undefined));
  assert.equal(tw("a.b", "Yes"), "Ja");
  assert.equal(tw("a.c", "No"), "No");
  assert.equal(ui.words()("a.b", "Yes"), "Yes");
  assert.equal(ui.english("a.b", "Yes"), "Yes");
});

test("placeholders are filled in either text: a value, a count with its English noun", () => {
  const tw = ui.words((key, p) => (key === "x.de" ? `${p.n} Einträge in {name}` : undefined));
  assert.equal(tw("x.en", "{n:entry} in {name}", { n: 3, name: "web" }), "3 entries in web");
  assert.equal(tw("x.en", "{n:entry} in {name}", { n: 1, name: "web" }), "1 entry in web");
  assert.equal(tw("x.de", "{n:entry} in {name}", { n: 3, name: "web" }), "3 Einträge in web");
});

test("a node goes in at its placeholder, where the host's word order puts it", () => {
  const link = doc.createElement("a");
  const tw = ui.words((key) => (key === "x.de" ? "{link} öffnet es" : undefined));
  const parts = (x) => Array.from(x); // an array of the window's realm
  const en = parts(tw("x.en", "open it with {link}", { link })), de = parts(tw("x.de", "open it with {link}", { link }));
  assert.equal(en.length, 2); assert.equal(en[0], "open it with "); assert.equal(en[1], link);
  assert.equal(de.length, 2); assert.equal(de[0], link); assert.equal(de[1], " öffnet es");
  // the values beside a node stay in one text with the words around them
  const mixed = parts(tw("x.mixed", "Thoughts ({n}) {min}", { n: 3, min: link }));
  assert.equal(mixed.length, 2); assert.equal(mixed[0], "Thoughts (3) "); assert.equal(mixed[1], link);
});

test("a throw or a non-string falls back to the English, with one warning per key", () => {
  const warnings = []; const warn = dom.window.console.warn; dom.window.console.warn = (m) => warnings.push(m);
  try {
    const tw = ui.words((key) => { if (key === "x.throws") throw new Error("broken"); return key === "x.number" ? 42 : undefined; });
    assert.equal(tw("x.throws", "A"), "A"); assert.equal(tw("x.throws", "A"), "A");
    assert.equal(tw("x.number", "B"), "B"); assert.equal(tw("x.number", "B"), "B");
    assert.equal(tw("x.quiet", "C"), "C");
  } finally { dom.window.console.warn = warn; }
  assert.equal(warnings.length, 2, warnings.join("\n"));
  assert.match(warnings[0], /"x\.throws".*threw: broken/);
  assert.match(warnings[1], /"x\.number".*number, not a string/);
});

test("the core's UI text takes a view's words: a member's availability, the reasons a reference or an export did not load", () => {
  const { core } = dom.window.KeepTheWhy;
  const tw = ui.words((key, p) => ({ "family.kind.cache": "Cache", "core.see.notAsked": "nicht gefragt", "core.export.notHttps": `kein https: ${p.url}` })[key]);
  assert.equal(core.kindLabel("cache", tw), "Cache");
  assert.equal(core.kindLabel("cache"), "cache, read only");
  assert.equal(core.resolveSee("x", { tw }).error, "nicht gefragt");
  assert.equal(core.resolveSee("x").error, "not known here, and no published export was asked for");
  assert.equal(core.exportStateUrl("- dashboard-state: http://a", "raw", tw).error, "kein https: http://a");
  assert.equal(core.exportStateUrl("- dashboard-state: http://a", "raw").error, "dashboard-state is not an https URL: http://a");
});

test("a placeholder without its value stays as written, with one warning per key and name", () => {
  const warnings = []; const warn = dom.window.console.warn; dom.window.console.warn = (m) => warnings.push(m);
  try {
    assert.equal(ui.english("x.miss", "by {author} on {date}", { author: undefined, date: "2026-11-03" }), "by {author} on 2026-11-03");
    assert.equal(ui.english("x.miss", "by {author} on {date}", { author: null, date: "2026-11-03" }), "by {author} on 2026-11-03");
    const link = doc.createElement("a");
    const parts = Array.from(ui.english("x.missNode", "{who} — {link}", { who: undefined, link }));
    assert.equal(parts[0], "{who} — "); assert.equal(parts[1], link);
  } finally { dom.window.console.warn = warn; }
  assert.equal(warnings.length, 2, warnings.join("\n"));
  assert.match(warnings[0], /"x\.miss" has no value for \{author\}/);
  assert.match(warnings[1], /"x\.missNode" has no value for \{who\}/);
});
