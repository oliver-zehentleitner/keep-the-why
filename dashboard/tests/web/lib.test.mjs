// Unit tests for the page's pure part (lib.js): node --test, no jsdom, no npm.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  esc, plural, isUuid, rawFileUrl, configLine, normalizeState, slug, hostFileLink, canonicalOf,
  parseSupersededBy, kindLabel, groupByFamily, searchTerms, searchHit, compareHits, snippetAt, highlight,
  resolveLocation, bodyProse, linkFamily,
} from "../../ktw_dashboard/web/lib.js";

test("esc escapes the five HTML characters and nothing else", () => {
  assert.equal(esc(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  assert.equal(esc(null), "");
});

test("plural", () => {
  assert.equal(plural(1, "entry"), "1 entry");
  assert.equal(plural(3, "topic"), "3 topics");
});

test("isUuid accepts lowercase 8-4-4-4-12 only", () => {
  assert.ok(isUuid("550e8400-e29b-41d4-a716-446655440000"));
  assert.ok(!isUuid("550E8400-E29B-41D4-A716-446655440000"));
  assert.ok(!isUuid("a1b2c3d4"));
  assert.ok(!isUuid(undefined));
});

test("slug follows the host's heading-anchor rule", () => {
  assert.equal(slug("`id` is validated as a file-name alphabet, not a shape"), "id-is-validated-as-a-file-name-alphabet-not-a-shape");
  assert.equal(slug("Retry cap on a specific error code"), "retry-cap-on-a-specific-error-code");
});

test("hostFileLink knows the four host grammars and defaults to GitHub's", () => {
  assert.equal(hostFileLink("https://github.com/acme/widget", "main", "context/", "sync.md", "snapshot"), "https://github.com/acme/widget/blob/main/context/sync.md#snapshot");
  assert.equal(hostFileLink("https://github.com/acme/widget/", "HEAD", "context/", "sync.md", null), "https://github.com/acme/widget/blob/HEAD/context/sync.md");
  assert.equal(hostFileLink("https://gitlab.com/group/widget", "main", "docs/why/", "sync.md", "a"), "https://gitlab.com/group/widget/-/blob/main/docs/why/sync.md#a");
  assert.equal(hostFileLink("https://codeberg.org/acme/widget", null, "context/", "sync.md", "a"), "https://codeberg.org/acme/widget/src/branch/HEAD/context/sync.md#a");
  assert.equal(hostFileLink("https://bitbucket.org/acme/widget", "dev", "context/", "sync.md", ""), "https://bitbucket.org/acme/widget/src/dev/context/sync.md");
  assert.equal(hostFileLink("https://git.example.org/acme/widget", "feature/x", "context/", "sync.md", ""), "https://git.example.org/acme/widget/blob/feature%2Fx/context/sync.md");
  assert.equal(hostFileLink("", "main", "context/", "sync.md", "a"), null);
});

test("rawFileUrl fetches at HEAD on every host, root prefixed", () => {
  assert.equal(rawFileUrl("https://github.com/acme/widget", "", ".keep-the-why"), "https://raw.githubusercontent.com/acme/widget/HEAD/.keep-the-why");
  assert.equal(rawFileUrl("https://github.com/acme/mono/", "packages/widget", ".keep-the-why"), "https://raw.githubusercontent.com/acme/mono/HEAD/packages/widget/.keep-the-why");
  assert.equal(rawFileUrl("https://gitlab.com/group/widget", "", ".keep-the-why"), "https://gitlab.com/group/widget/-/raw/HEAD/.keep-the-why");
  assert.equal(rawFileUrl("https://bitbucket.org/acme/widget", "", ".keep-the-why"), "https://bitbucket.org/acme/widget/raw/HEAD/.keep-the-why");
  assert.equal(rawFileUrl("https://codeberg.org/acme/widget", "", ".keep-the-why"), "https://codeberg.org/acme/widget/raw/branch/HEAD/.keep-the-why");
});

test("configLine reads one block line, backticks stripped, nothing else", () => {
  const cfg = "<!-- keep-the-why:config -->\n- id: acme---x\n- context: `context/`\n- dashboard-state: https://x.org/dashboard/live/state.json\n<!-- /keep-the-why:config -->\n";
  assert.equal(configLine(cfg, "dashboard-state"), "https://x.org/dashboard/live/state.json");
  assert.equal(configLine(cfg, "context"), "context/");
  assert.equal(configLine(cfg, "parent"), "");
});

test("normalizeState tolerates an older, newer or broken document", () => {
  const s = normalizeState({ project: { id: "x", future_key: 1 }, entries: [{ title: "A thing", file: "a.md", body: "plain text" }], generated: "now" });
  assert.equal(s.project.context, "context/");
  assert.equal(s.project.future_key, 1);
  assert.deepEqual(s.topics, []);
  assert.deepEqual(s.findings.items, []);
  assert.equal(s.entries[0].id, "a.md#a-thing");
  assert.equal(s.entries[0].body.text, "plain text");
  assert.deepEqual(s.entries[0].see, []);
  const empty = normalizeState(null);
  assert.deepEqual(empty.entries, []);
  assert.equal(empty.project.schema, "?");
  assert.deepEqual(normalizeState({ topics: "nope", entries: 5 }).topics, []);
});

test("canonicalOf prefers the stored locator over the git remote", () => {
  assert.equal(canonicalOf({ canonical: "https://github.com/a/b", git: { remote: "github.com/c/d" } }), "https://github.com/a/b");
  assert.equal(canonicalOf({ git: { remote: "github.com/c/d" } }), "https://github.com/c/d");
  assert.equal(canonicalOf({}), "");
});

test("parseSupersededBy: id, cross-project reference, none with reason, free text", () => {
  assert.deepEqual(parseSupersededBy("550e8400-e29b-41d4-a716-446655440000"), { uuid: "550e8400-e29b-41d4-a716-446655440000" });
  const r = parseSupersededBy("https://github.com/a/b — 550e8400-e29b-41d4-a716-446655440000 — as of 2026-09-27");
  assert.equal(r.remote, "https://github.com/a/b");
  assert.equal(r.file, null);
  assert.equal(r.date, "2026-09-27");
  const l = parseSupersededBy("sync.md#x — 550e8400-e29b-41d4-a716-446655440000 — as of 2026-09-27");
  assert.equal(l.file, "sync.md");
  assert.equal(l.remote, null);
  assert.deepEqual(parseSupersededBy("none — the upstream fix removed the reason"), { none: "the upstream fix removed the reason" });
  assert.deepEqual(parseSupersededBy("  the entry below  "), { text: "the entry below" });
  assert.equal(parseSupersededBy(""), null);
});

test("kindLabel", () => {
  assert.equal(kindLabel("repository"), "repository, read and write");
  assert.equal(kindLabel("cache"), "cache, read only");
  assert.equal(kindLabel("public"), "published export");
  assert.equal(kindLabel(null), "not available here");
});

test("groupByFamily: children under their parent by canonical or path, cache after working tree, no row lost", () => {
  const suite = { key: "/w/suite", path: "/w/suite", id: "s", kind: "repository", canonical: "https://github.com/acme/suite", parent: "" };
  const suiteCache = { key: "/h/cache/s", path: "/h/cache/s", id: "s", kind: "cache", canonical: "https://github.com/acme/suite", parent: "" };
  const rest = { key: "/w/rest", path: "/w/rest", id: "r", kind: "repository", canonical: "https://github.com/acme/rest", parent: "https://github.com/acme/suite" };
  const widget = { key: "/w/mono/packages/widget", path: "/w/mono/packages/widget", id: "w", kind: "repository", canonical: "https://github.com/acme/mono", parent: "../.." };
  const mono = { key: "/w/mono", path: "/w/mono", id: "m", kind: "repository", canonical: "https://github.com/acme/mono", parent: "" };
  const orphan = { key: "/w/o", path: "/w/o", id: "o", kind: "repository", canonical: "", parent: "https://github.com/acme/nowhere" };
  const unresolved = { key: "unresolved:u", path: null, id: "u", kind: "repository", canonical: "", parent: "" };
  const flat = groupByFamily([rest, suiteCache, suite, widget, orphan, mono, unresolved]);
  const at = (k) => flat.find(([p]) => p.key === k);
  assert.equal(flat.length, 7);
  assert.equal(at("/w/rest")[1], 1);
  assert.equal(at("/w/mono/packages/widget")[1], 1);
  assert.equal(at("/w/o")[1], 0);
  assert.equal(at("unresolved:u")[1], 0);
  // rest sits directly after the suite's working tree, not after its cache
  const idx = (k) => flat.findIndex(([p]) => p.key === k);
  assert.equal(idx("/w/rest"), idx("/w/suite") + 1);
  assert.equal(idx("/w/mono/packages/widget"), idx("/w/mono") + 1);
});

test("searchHit: every term somewhere, strength and snippet source", () => {
  const e = { title: "picows stays opt-in", body: { text: "**Id:** 11111111-1111-4111-8111-111111111111\n**Status:** active\n**Source:** picows soak report\n\nThe soak ran 24 h with picows.\n\n**Reason:** a buffer bug upstream." }, source: "picows soak report", uuid: "11111111-1111-4111-8111-111111111111", file: "websocket-library.md", type: ["decision"], status: "active", evidence: "confirmed" };
  assert.equal(searchHit(e, ""), null);
  assert.equal(searchHit(e, "picows nosuchword"), null);
  const h = searchHit(e, "PicoWS buffer");
  assert.deepEqual(h.terms, ["picows", "buffer"]);
  assert.equal(h.inTitle, 1);
  assert.equal(h.where.field, "body");
  assert.equal(h.where.text.slice(h.where.i, h.where.i + h.where.len), "picows");
  // the field lines are not counted twice: title 1 + body 1 + source 1 + buffer 1
  assert.equal(h.count, 4);
  assert.equal(searchHit(e, "report").where.field, "source");
  assert.equal(searchHit(e, "soak report").where.field, "body"); // the first field after the title that carries a term
  assert.equal(searchHit(e, "11111111").where.field, "id");
  assert.equal(searchHit(e, "opt-in").where.field, "title");
  assert.ok(compareHits({ inTitle: 1, count: 1 }, { inTitle: 0, count: 9 }) < 0);
  assert.ok(compareHits({ inTitle: 0, count: 2 }, { inTitle: 0, count: 5 }) > 0);
  assert.deepEqual(searchTerms("  a  B "), ["a", "b"]);
});

test("bodyProse drops the field lines and keeps the prose, labels included", () => {
  assert.equal(bodyProse("**Id:** x\n**Type:** decision\n\nText.\n\n**Reason:** why."), "Text.\n\n**Reason:** why.");
  assert.equal(bodyProse(undefined), "");
});

test("snippetAt cuts around the hit and marks the cuts", () => {
  const t = "a".repeat(100) + "HIT" + "b".repeat(300);
  const s = snippetAt(t, 100, 3, 10, 10);
  assert.equal(s, "…" + "a".repeat(10) + "HIT" + "b".repeat(10) + "…");
  assert.equal(snippetAt("short  text", 0, 5), "short text");
});

test("highlight escapes first and marks every term, longest first", () => {
  assert.equal(highlight("a <b> PicoWS and picows", ["picows"]), "a &lt;b&gt; <mark>PicoWS</mark> and <mark>picows</mark>");
  assert.equal(highlight("proxy_type", ["proxy", "proxy_type"]), "<mark>proxy_type</mark>");
  assert.equal(highlight("a.b", ["."]), "a<mark>.</mark>b");
  assert.equal(highlight("<x>", []), "&lt;x&gt;");
});

test("resolveLocation: https is another repository, a path stays in this one", () => {
  assert.deepEqual(resolveLocation("https://github.com/acme/web/", "https://github.com/acme/mono", "x"), { canonical: "https://github.com/acme/web", root: "" });
  assert.deepEqual(resolveLocation("packages/cluster", "https://github.com/acme/mono", ""), { canonical: "https://github.com/acme/mono", root: "packages/cluster" });
  assert.deepEqual(resolveLocation("../..", "https://github.com/acme/mono", "packages/cluster/web"), { canonical: "https://github.com/acme/mono", root: "packages" });
  assert.deepEqual(resolveLocation("..", "https://github.com/acme/mono", "packages"), { canonical: "https://github.com/acme/mono", root: "" });
  assert.equal(resolveLocation("..", "https://github.com/acme/mono", ""), null); // above the repository
  assert.equal(resolveLocation("web", "", ""), null); // no canonical to resolve against
  assert.equal(resolveLocation("", "https://github.com/acme/mono", ""), null);
});

test("linkFamily: parent lines by canonical and root, roles as fallback, See and Superseded by by Id", () => {
  const U = (n) => `${String(n).repeat(8)}-1111-4111-8111-111111111111`;
  const groups = [
    { key: "self", role: "self", canonical: "https://github.com/acme/web", root: "", state: { project: { parent: "https://github.com/acme/suite" }, entries: [{ id: "w1", uuid: U(1), see: [{ uuid: U(2) }, { uuid: U(9) }] }] } },
    { key: "suite", role: "parent", canonical: "https://github.com/acme/suite.git", root: "", state: { project: {}, entries: [{ id: "s1", uuid: U(2) }] } },
    { key: "docs", role: "sibling", canonical: "https://github.com/acme/suite", root: "docs", state: { project: { parent: ".." }, entries: [{ id: "d1", uuid: U(3), superseded_by: `https://github.com/acme/suite — ${U(2)} — as of 2026-09-28` }] } },
    { key: "plugin", role: "child", canonical: "", root: "", state: { project: {}, entries: [{ id: "p1", uuid: U(4), see: [{ uuid: U(4) }] }] } },
  ];
  const { parentOf, xrefs } = linkFamily(groups);
  assert.deepEqual(parentOf, { self: "suite", docs: "suite", plugin: "self" });
  assert.deepEqual(xrefs, [
    { from: { key: "self", id: "w1" }, to: { key: "suite", id: "s1" }, kind: "see" },
    { from: { key: "docs", id: "d1" }, to: { key: "suite", id: "s1" }, kind: "superseded" },
  ]); // an Id outside the graph and a reference to itself are left out
});
