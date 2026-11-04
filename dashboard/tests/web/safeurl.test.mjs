// The one rule for an address the views link to (ktw-core.js safeUrl, safeHref): safeUrl for an address from the
// data — absolute https with a host, no user or password, no space, control or bidi character and no backslash;
// safeHref for every URL attribute the views set (ktw-ui.js setAttrs) — a relative reference, or what safeUrl
// passes. A rejected address is shown as text, never followed, with one warning per address. Then the places that
// read an address from the data: a hostile state's canonical, remote, profile and Markdown link reach no href.
// Runs in jsdom, with the library files in the manifest's order.
//
//   node --test safeurl.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const { window } = dom;
const realm = dom.getInternalVMContext();
for (const name of ["ktw-core.js", "ktw-ui.js", "ktw-scene.js", "ktw-markdown.js", "ktw-pages.js"]) {
  const file = new URL(`../../ktw_dashboard/web/${name}`, import.meta.url);
  vm.runInContext(fs.readFileSync(file, "utf8"), realm, { filename: file.pathname });
}
const { core, ui, markdown, scene: sceneLib, views } = window.KeepTheWhy;
const doc = window.document;
const { safeUrl, safeHref } = core;

// the warnings a call leaves, the console put back after it
function warnings(fn) {
  const out = []; const warn = window.console.warn; window.console.warn = (m) => out.push(String(m));
  try { fn(); } finally { window.console.warn = warn; }
  return out;
}

const HOSTILE = [
  "javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "\u0001javascript:alert(1)", "data:text/html,<b>x</b>", "vbscript:x",
  "http://example.org/", "ftp://example.org/", "https://user@example.org/", "https://:pw@example.org/", "https://user:pw@example.org/",
  "//evil.example/", "\\\\evil.example", "/\\evil.example", "https://example.org\\@evil.example/", "https:\\\\evil.example",
  "https://exa mple.org/", "https://example.org/a b", "https://example.org/\ta", "https://example.org/\n", "https://example.org/\u0000",
  "https://example.org/‮gnp.exe", "https://example.org/⁦x", "https://example.org/‏", "https://example.org/ ",
  "https://", "https:", "not a url", "",
];

test("safeUrl: an absolute https address with a host passes as it was given", () => {
  for (const u of ["https://example.org", "https://example.org/", "https://github.com/acme/platform", "https://example.org/a?b=1&c=%20#x", "HTTPS://Example.org/A", "https://例え.jp/パス"])
    assert.equal(safeUrl(u), u, u);
});

test("safeUrl: https:evil.example parses as https with a host, and passes on purpose", () => {
  // the URL parser reads the special scheme's missing slashes as there; the address goes where it says
  assert.equal(new window.URL("https:evil.example").hostname, "evil.example");
  assert.equal(safeUrl("https:evil.example"), "https:evil.example");
});

test("safeUrl rejects every other scheme, a user or password, a backslash, and space, control and bidi characters", () => {
  warnings(() => { for (const u of HOSTILE) assert.equal(safeUrl(u), null, JSON.stringify(u)); });
  for (const u of [null, undefined, 42, {}, ["https://example.org"]]) assert.equal(safeUrl(u), null, String(u));
});

test("safeHref: a host's own places pass, as relative references; a scheme is held to safeUrl", () => {
  for (const u of ["#overview", "#entry/2f1c5b7e-8a3d-4c6e-9b0f-1d2e3f4a5b6c", "?public=https%3A%2F%2Fexample.org#graph", "/maity/p/why#topic/a.md", "index.html#x", "state.json", "https://example.org/x"])
    assert.equal(safeHref(u), u, u);
  warnings(() => { for (const u of HOSTILE.filter((x) => x !== "")) assert.equal(safeHref(u), null, JSON.stringify(u)); });
  assert.equal(safeHref(""), "", "an empty href is the page itself, as it was");
});

test("one warning per rejected address, and a bounded number of them however many a state holds", () => {
  const once = warnings(() => { for (let i = 0; i < 3; i++) safeUrl("javascript:once()"); });
  assert.equal(once.length, 1, once.join("\n"));
  assert.match(once[0], /not linked \(not https\): "javascript:once\(\)"/);
  const many = warnings(() => { for (let i = 0; i < 500; i++) safeUrl(`javascript:many(${i})`); });
  assert.ok(many.length <= 100, `${many.length} warnings`);
  assert.equal(safeUrl("javascript:many(499)"), null, "still rejected once no longer warned");
});

test("el and svgEl set an address only as safeHref passes it: a rejected one is left out, the element keeps its text", () => warnings(() => {
  for (const attr of ["href", "src", "action", "formaction"]) {
    const n = ui.el("a", { class: "x", [attr]: "javascript:alert(1)" }, "text");
    assert.equal(n.hasAttribute(attr), false, attr);
    assert.equal(n.textContent, "text"); assert.equal(n.getAttribute("class"), "x");
  }
  assert.equal(ui.el("a", { href: "#overview" }).getAttribute("href"), "#overview");
  assert.equal(ui.el("a", { href: "https://example.org" }).getAttribute("href"), "https://example.org");
  assert.equal(ui.el("img", { src: "data:image/svg+xml,<svg/>" }).hasAttribute("src"), false);
  assert.equal(ui.svgEl("a", { "xlink:href": "javascript:alert(1)" }).hasAttribute("xlink:href"), false);
  assert.equal(ui.svgEl("a", { href: "javascript:alert(1)" }).hasAttribute("href"), false);
  assert.equal(ui.svgEl("a", { href: "#graph" }).getAttribute("href"), "#graph");
}));

test("a link out to an address from the data: an anchor when safeUrl passes it, else its text", () => warnings(() => {
  const ok = ui.outLink({ class: "ktw-gh", href: "https://example.org", target: "_blank", rel: "noopener", title: "t" }, "x");
  assert.equal(ok.localName, "a"); assert.equal(ok.getAttribute("href"), "https://example.org");
  const bad = ui.outLink({ class: "ktw-gh", href: "javascript:alert(1)", target: "_blank", rel: "noopener", title: "t" }, "x");
  assert.equal(bad.localName, "span"); assert.equal(bad.textContent, "x"); assert.equal(bad.getAttribute("class"), "ktw-gh"); assert.equal(bad.getAttribute("title"), "t");
  assert.deepEqual([...bad.attributes].map((a) => a.name).sort(), ["class", "title"]);
  const ext = ui.extLink("http://example.org", "http://example.org", "ktw-v");
  assert.equal(ext.localName, "span"); assert.equal(ext.textContent, "http://example.org"); assert.equal(ext.querySelector("svg"), null, "no opens-elsewhere mark");
  assert.equal(ui.extLink("https://example.org", "x").localName, "a");
  assert.equal(ui.remoteLink("user@example.org/a").localName, "span");
  assert.equal(ui.remoteLink("github.com/acme/platform").getAttribute("href"), "https://github.com/acme/platform");
}));

test("the host's addresses of a file, a directory and an author's commit need an https canonical", () => warnings(() => {
  for (const c of ["javascript:alert(1)", "http://github.com/acme/x", "https://user@github.com/acme/x", "github.com/acme/x"]) {
    assert.equal(core.hostFileLink(c, "main", "context/", "a.md", null), null, c);
    assert.equal(core.hostTreeLink(c, "main", "context"), null, c);
    assert.equal(core.authorLookup(c, "abc1234"), null, c);
  }
  assert.equal(core.hostFileLink("https://github.com/acme/x", "main", "context/", "a.md", "b"), "https://github.com/acme/x/blob/main/context/a.md#b");
  assert.equal(core.hostFileLink(null, "main", "context/", "a.md", null), null);
}));

test("Markdown: a link is a link only to an https address safeUrl passes; the rest is its text", () => warnings(() => {
  const link = (url) => markdown.parseInline(`[t](${url})`, { topicHref: () => null })[0];
  assert.deepEqual(JSON.parse(JSON.stringify(link("https://example.org/a"))), { t: "a", href: "https://example.org/a", external: true, c: [{ t: "text", v: "t" }] });
  for (const url of ["javascript:alert(1)", "https://user@example.org/", "https://example.org/‮x", "https://example.org\\@evil.example", "/\\evil.example"]) {
    const n = link(url);
    assert.equal(n.href, null, url);
  }
}));

// ---- a hostile state through the pages: no address in it reaches an href or a src
const evil = "javascript:alert(document.domain)";
const UUID = "2f1c5b7e-8a3d-4c6e-9b0f-1d2e3f4a5b6c", REMOTE = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const entry = { id: "why.md#a", uuid: UUID, file: "why.md", line: 3, title: "A", type: ["decision"], status: "active", evidence: "confirmed",
  body: { text: "Because.", reason: "" }, see: [{ remote: evil, uuid: REMOTE }, { remote: "https://user@example.org/x", uuid: REMOTE }], refs: [], findings: [] };
const state = {
  project: { id: "p", name: "p", context: "context/", canonical: evil, config: { canonical: evil, "dashboard-state": "http://example.org/state.json", context: "context/" },
    git: { available: true, remote: "user@example.org/acme/x", branch: "main", head: "abc1234", fork: { of: "user@evil.example/x" } } },
  entries: [entry], topics: [{ file: "why.md", title: "Why", entries: 1, refs_out: [], refs_in: [], status: {}, evidence: {} }],
  authors: [], findings: { errors: 0, warnings: 0, items: [] },
};
const nav = { href: (r) => "/maity/p/why" + core.routes.format(r), go: () => {}, current: () => ({ view: "entry", uuid: UUID }) };
const libs = { family: { publicTree: () => { throw new Error("not asked"); }, publicState: async () => null }, search: { canFamily: () => false, pool: async () => ({ groups: [], missing: [] }) } };
const host = {
  live: () => true, published: () => false, project: () => null,
  provider: () => ({ resolveEntry: async () => ({ error: "not found" }) }),
  inline: (md) => doc.createTextNode(String(md)), renderBody: (md) => doc.createTextNode(String(md)),
  shareUrl: (route) => ({ url: `https://example.org/maity/p/why${core.routes.format(route)}`, where: "this page" }),
  details: () => doc.createElement("aside"), miniGraph: () => {}, entryThoughts: () => [], thoughts: {},
  authorLink: (n) => doc.createTextNode(n || "—"), memberLink: (m, h) => h, render: () => {}, rerender: () => {},
  authorProjects: () => [], friendsWaiting: () => [], friendsLoading: () => false, loadFriends: () => {},
};
const unsafe = (root) => [...root.querySelectorAll("[href], [src], [action], [formaction]")].flatMap((n) =>
  ["href", "src", "action", "formaction"].filter((a) => n.hasAttribute(a)).map((a) => n.getAttribute(a)).filter((u) => safeHref(u) === null || /^[a-z][a-z0-9+.-]*:/i.test(u) && !/^https:\/\//i.test(u) || /evil|user@/.test(u)));

test("a hostile state's addresses reach no href: the overview's config and the entry page's references", { timeout: 5000 }, async () => {
  const P = views.pages.create({ scene: sceneLib.create({ state }), nav, prefs: { get: () => null, set: () => {} }, ...libs });
  const over = doc.createElement("main"), page = doc.createElement("main");
  warnings(() => { P.overview(over, host); P.entry(page, UUID, host); });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(unsafe(over), [], "overview"); assert.deepEqual(unsafe(page), [], "entry");
  assert.match(over.textContent, /javascript:alert\(document\.domain\)/, "the canonical is shown as text");
  assert.match(over.textContent, /http:\/\/example\.org\/state\.json/, "an http dashboard-state is shown as text");
  assert.ok(over.querySelectorAll("a").length > 0 && page.querySelectorAll("a").length > 0, "the pages' own links are still there");
});
