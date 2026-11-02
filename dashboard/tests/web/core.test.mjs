// Unit tests for the page's pure part (ktw-core.js): node --test, no jsdom, no npm.
import { test } from "node:test";
import assert from "node:assert/strict";
import core from "./core.mjs";
const {
  esc, plural, isUuid, rawFileUrl, configLine, normalizeState, slug, hostFileLink, hostTreeLink, canonicalOf, projectLabel,
  parseSupersededBy, kindLabel, typeName, groupByFamily, familyRank, familyOrder, searchTerms, searchHit, registryMatches, shuffled, compareHits, snippetAt, highlightParts,
  resolveLocation, bodyProse, linkFamily, authorLookup, mergeStates, friendsOf, thoughtsOf, thoughtInsights, HOSTS, hostOf, backlinksUrl, citingOf, hostAnchor, ownerOf,
  TYPE_TOKENS, PALETTE_SIZE, paletteToken,
} = core;

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
  assert.equal(hostFileLink("https://github.com/acme/widget", "main", "", ".keep-the-why", null), "https://github.com/acme/widget/blob/main/.keep-the-why"); // "" = the repository root
  assert.equal(hostFileLink("https://github.com/acme/widget", "main", undefined, "sync.md", null), "https://github.com/acme/widget/blob/main/context/sync.md"); // unset = the default directory
  assert.equal(hostFileLink("", "main", "context/", "sync.md", "a"), null);
});

test("hostTreeLink lists a directory in the same four grammars, the root of a mono repository included", () => {
  assert.equal(hostTreeLink("https://github.com/acme/widget", "main", "context/"), "https://github.com/acme/widget/tree/main/context");
  assert.equal(hostTreeLink("https://github.com/acme/mono/", "main", "packages/widget/context/"), "https://github.com/acme/mono/tree/main/packages/widget/context");
  assert.equal(hostTreeLink("https://gitlab.com/group/widget", null, "docs/why"), "https://gitlab.com/group/widget/-/tree/HEAD/docs/why");
  assert.equal(hostTreeLink("https://codeberg.org/acme/widget", "dev", "context"), "https://codeberg.org/acme/widget/src/branch/dev/context");
  assert.equal(hostTreeLink("https://bitbucket.org/acme/widget", "feature/x", "context"), "https://bitbucket.org/acme/widget/src/feature%2Fx/context");
  assert.equal(hostTreeLink("", "main", "context"), null);
});

test("rawFileUrl fetches at HEAD on every host, root prefixed", () => {
  assert.equal(rawFileUrl("https://github.com/acme/widget", "", ".keep-the-why"), "https://raw.githubusercontent.com/acme/widget/HEAD/.keep-the-why");
  assert.equal(rawFileUrl("https://github.com/acme/mono/", "packages/widget", ".keep-the-why"), "https://raw.githubusercontent.com/acme/mono/HEAD/packages/widget/.keep-the-why");
  // GitLab through the files API (it sends CORS headers), project path and file path URL-encoded
  assert.equal(rawFileUrl("https://gitlab.com/group/widget", "", ".keep-the-why"), "https://gitlab.com/api/v4/projects/group%2Fwidget/repository/files/.keep-the-why/raw?ref=HEAD");
  assert.equal(rawFileUrl("https://gitlab.com/group/sub/mono/", "packages/widget", ".keep-the-why"), "https://gitlab.com/api/v4/projects/group%2Fsub%2Fmono/repository/files/packages%2Fwidget%2F.keep-the-why/raw?ref=HEAD");
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

test("projectLabel names owner/repo, the id only without a repository", () => {
  assert.equal(projectLabel({ id: "a---b", canonical: "https://github.com/a/b", git: { remote: "github.com/c/d" } }), "a/b");
  assert.equal(projectLabel({ id: "a---b", canonical: "git@github.com:acme/widget.git" }), "acme/widget");
  assert.equal(projectLabel({ id: "x", git: { remote: "gitlab.com/acme/sub/widget" } }), "acme/sub/widget");
  assert.equal(projectLabel({ id: "acme---widget", name: "widget", git: { remote: "" } }), "acme---widget");
  assert.equal(projectLabel({ name: "widget" }), "widget");
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

test("typeName", () => {
  assert.equal(typeName("decision"), "decision");
  assert.equal(typeName("undefined — open question awaiting maintainer input, not yet classifiable"), "undefined");
  assert.equal(typeName("undefined - a plain hyphen"), "undefined");
  assert.equal(typeName(undefined), "");
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

test("registryMatches: every term in name, canonical or id; name hits first", () => {
  const reg = [
    { name: "zyvop-cli", canonical: "https://github.com/zyvop/zyvop-cli", id: "zyvop---zyvop-cli" },
    { name: "unicorn-fy", canonical: "https://github.com/oliver-zehentleitner/unicorn-fy", id: "oliver-zehentleitner---unicorn-fy" },
    { name: "keep-the-why", canonical: "https://github.com/oliver-zehentleitner/keep-the-why", id: "oliver-zehentleitner---keep-the-why" },
  ];
  assert.deepEqual(registryMatches(reg, "").map((p) => p.name), []);
  assert.deepEqual(registryMatches(reg, "nosuch").map((p) => p.name), []);
  assert.deepEqual(registryMatches(reg, "UNICORN").map((p) => p.name), ["unicorn-fy"]);
  assert.deepEqual(registryMatches(reg, "oliver").map((p) => p.name), ["keep-the-why", "unicorn-fy"]); // url hits, by name
  assert.deepEqual(registryMatches(reg, "zyvop cli").map((p) => p.name), ["zyvop-cli"]); // two terms, both somewhere
  assert.deepEqual(registryMatches(reg, "oliver why").map((p) => p.name), ["keep-the-why"]);
  assert.deepEqual(registryMatches([{ canonical: "https://x.org/a" }], "x.org").length, 1); // a listing without name or id
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

test("highlightParts cuts the text where terms match, longest first, and builds no markup", () => {
  const m = (text) => ({ text, mark: true }), t = (text) => ({ text, mark: false });
  assert.deepEqual(highlightParts("a <b> PicoWS and picows", ["picows"]), [t("a <b> "), m("PicoWS"), t(" and "), m("picows")]);
  assert.deepEqual(highlightParts("proxy_type", ["proxy", "proxy_type"]), [m("proxy_type")]);
  assert.deepEqual(highlightParts("a.b", ["."]), [t("a"), m("."), t("b")]);
  assert.deepEqual(highlightParts("<x>", []), [t("<x>")]);
  assert.deepEqual(highlightParts("", ["x"]), []);
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

test("authorLookup: the host API that names a commit's account, and the commit page as fallback", () => {
  const gh = authorLookup("https://github.com/acme/widget", "abc1234");
  assert.equal(gh.api, "https://api.github.com/repos/acme/widget/commits/abc1234");
  assert.equal(gh.pick({ author: { html_url: "https://github.com/someone" } }), "https://github.com/someone");
  assert.equal(gh.pick({ author: null }), null); // an email GitHub knows no account for
  assert.equal(gh.fallback, "https://github.com/acme/widget/commit/abc1234");
  const cb = authorLookup("https://codeberg.org/acme/widget.git", "abc1234");
  assert.equal(cb.api, "https://codeberg.org/api/v1/repos/acme/widget/git/commits/abc1234");
  assert.equal(cb.pick({ author: { login: "someone" } }), "https://codeberg.org/someone");
  const bb = authorLookup("https://bitbucket.org/acme/widget", "abc1234");
  assert.equal(bb.pick({ author: { user: { links: { html: { href: "https://bitbucket.org/someone/" } } } } }), "https://bitbucket.org/someone/");
  const gl = authorLookup("https://gitlab.com/group/sub/widget", "abc1234");
  assert.equal(gl.api, null); // GitLab's commit API names no account: straight to the commit page
  assert.equal(gl.fallback, "https://gitlab.com/group/sub/widget/-/commit/abc1234");
  assert.equal(authorLookup("", "abc1234"), null);
  assert.equal(authorLookup("https://github.com/acme/widget", ""), null);
  assert.equal(authorLookup("https://github.com/acme/widget", "not a sha"), null);
});

test("mergeStates: one state for the family, a member's files and ids prefixed, authors and findings summed", () => {
  const st = (name, files, authors, errors) => ({ project: { id: name }, topics: files.map((f) => ({ file: f, title: f, refs_out: [], refs_in: [] })), entries: files.map((f) => ({ id: `${f}#x`, file: f, refs: [f] })), authors, findings: { errors, warnings: 0, items: errors ? [{ path: `context/${files[0]}`, line: 1 }] : [] } });
  const groups = [
    { member: { role: "self", name: "suite" }, state: st("suite", ["history.md"], [{ name: "A", created: 1, touched: 1, superseded: 0, evidence: { confirmed: 1 }, first: "2026-01-02", last: "2026-01-03" }], 0) },
    { member: { role: "child", name: "fy" }, state: { ...st("fy", ["history.md", "adapters.md"], [{ name: "A", created: 2, touched: 3, superseded: 1, evidence: { confirmed: 1, unknown: 1 }, first: "2025-12-01", last: "2026-02-01" }, { name: "B", created: 1, touched: 1, superseded: 0, evidence: {} }], 1), anonymized: true } },
  ];
  const m = mergeStates(groups);
  assert.equal(m.merged, true);
  assert.deepEqual(m.topics.map((t) => t.file), ["history.md", "fy/history.md", "fy/adapters.md"]); // the same file name stays two topics
  assert.deepEqual(m.entries.map((e) => [e.id, e.project, e.localFile]), [["history.md#x", null, "history.md"], ["fy/history.md#x", "fy", "history.md"], ["fy/adapters.md#x", "fy", "adapters.md"]]);
  assert.deepEqual(m.entries[1].refs, ["fy/history.md"]);
  const a = m.authors.find((x) => x.name === "A");
  assert.deepEqual([a.created, a.touched, a.superseded, a.evidence, a.first, a.last], [3, 4, 1, { confirmed: 2, unknown: 1 }, "2025-12-01", "2026-02-01"]);
  assert.equal(m.authors[0].name, "A"); // most entries created first
  assert.deepEqual([m.findings.errors, m.findings.items[0].path, m.findings.items[0].project], [1, "fy/context/history.md", "fy"]);
  assert.equal(m.anonymized, true); // one anonymized member keeps profile lookups off for the whole family
  assert.equal(m.project.id, "suite");
  assert.equal(groups[1].state.entries[0].id, "history.md#x"); // the members' own states are left as they are
});

test("friendsOf: repositories cited by See or Superseded by, the family left out, one row per repository", () => {
  const A = "https://github.com/acme/thesis", B = "https://gitlab.com/acme/ops", SELF = "https://github.com/acme/app", PARENT = "https://github.com/acme/suite";
  const U1 = "11111111-1111-4111-8111-111111111111", U2 = "22222222-2222-4222-8222-222222222222", U3 = "33333333-3333-4333-8333-333333333333";
  const entries = [
    { see: [{ remote: A, uuid: U1 }, { remote: null, file: "x.md", uuid: U2 }, { remote: PARENT, uuid: U2 }] },
    { see: [{ remote: A + "/", uuid: U1 }, { remote: "https://GitHub.com/acme/thesis", uuid: U3 }], superseded_by: `${B} — ${U2} — as of 2026-09-29` },
    { see: [{ remote: SELF, uuid: U3 }] },
    { superseded_by: U1 },
  ];
  assert.deepEqual(friendsOf(entries, [SELF, PARENT]), [
    { canonical: A, uuids: [U1, U3] },
    { canonical: B, uuids: [U2] },
  ]);
  assert.deepEqual(friendsOf([], [SELF]), []);
  assert.deepEqual(friendsOf(entries.slice(2), [SELF]), []);
});

test("thoughtsOf: longest citation chains of at least four entries, origin first, no part of a longer one", () => {
  // e cites d cites c cites b cites a; f cites c too; g-h is short; x-y-z-x is a cycle of three
  const edges = [["e", "d"], ["d", "c"], ["c", "b"], ["b", "a"], ["f", "c"], ["g", "h"], ["x", "y"], ["y", "z"], ["z", "x"]];
  assert.deepEqual(thoughtsOf(edges), [["a", "b", "c", "d", "e"], ["a", "b", "c", "f"]]);
  assert.deepEqual(thoughtsOf(edges, 6), []);
  assert.deepEqual(thoughtsOf([["a", "b"], ["b", "c"], ["c", "a"]], 3), [["a", "c", "b"], ["b", "a", "c"], ["c", "b", "a"]]);
  // a fan of many long chains stops at the cap instead of enumerating them all
  const fan = []; for (let i = 0; i < 50; i++) fan.push([`s${i}`, "m"]); fan.push(["m", "n"], ["n", "o"], ["o", "p"]);
  assert.equal(thoughtsOf(fan, 4, 10).length, 10);
});

test("thoughtInsights: an unconfirmed origin, steps in question and what rests on them, the days it grew", () => {
  const e = (evidence, status, date) => ({ evidence, status, git: date ? { created: { date } } : undefined });
  const a = thoughtInsights([e("inferred", "active", "2026-08-01"), e("confirmed", "needs-review", "2026-08-10"), e("confirmed", "active"), e("confirmed", "active", "2026-09-02")], ["see", "see", "see"]);
  assert.equal(a.weakOrigin, "inferred");
  assert.deepEqual(a.shaky, [{ i: 1, why: "needs-review" }]);
  assert.deepEqual(a.affected, [2, 3]);
  assert.equal(a.from, "2026-08-01"); assert.equal(a.to, "2026-09-02");
  // an evolution: superseded steps followed by their successors are not in question; a See to a replaced one is
  const evo = thoughtInsights([e("confirmed", "superseded"), e("confirmed", "superseded"), e("confirmed", "active")], ["superseded", "superseded"]);
  assert.deepEqual([evo.weakOrigin, evo.shaky, evo.affected], [null, [], []]);
  const stale = thoughtInsights([e("confirmed", "superseded"), e("confirmed", "active"), e("unknown", "active")], ["see", "see"]);
  assert.deepEqual(stale.shaky, [{ i: 0, why: "superseded, still cited" }]);
  assert.deepEqual(stale.affected, [1, 2]);
  assert.equal(stale.from, "");
});

test("hostOf reads the platform from the URL alone; an unknown host gets none", () => {
  const name = (u) => hostOf(u)?.name ?? null;
  assert.equal(name("https://github.com/acme/widget"), "GitHub");
  assert.equal(name("github.com/acme/widget"), "GitHub"); // git.remote's form
  assert.equal(name("git@gitlab.com:acme/widget.git"), "GitLab");
  assert.equal(name("https://gitlab.acme.at/team/widget"), "GitLab");
  assert.equal(name("https://codeberg.org/acme/widget"), "Codeberg");
  assert.equal(name("https://user:token@bitbucket.org/acme/widget"), "Bitbucket");
  assert.equal(name("https://gitea.acme.at/acme/widget"), "Gitea");
  assert.equal(name("https://forgejo.acme.at/acme/widget"), "Forgejo");
  assert.equal(name("https://GitHub.com/acme/widget"), "GitHub");
  assert.equal(name("https://git.acme.at/acme/widget"), null); // self-hosted under its own name: no guess
  assert.equal(name("https://notgithub.com/acme/widget"), null);
  assert.equal(name(""), null);
  assert.equal(name(undefined), null);
  for (const h of HOSTS) assert.match(h.path, /^[Mm][\d.\s,\-a-zA-Z]+$/, h.name);
});

test("backlinksUrl: the registry's path for a repository, or none", () => {
  const idx = "https://keepthewhy.com/registry/index.json";
  assert.equal(backlinksUrl(idx, "https://github.com/Acme/Widget/"), "https://keepthewhy.com/registry/backlinks/github.com/acme/widget.json");
  assert.equal(backlinksUrl(idx, "https://github.com/acme/widget.git"), "https://keepthewhy.com/registry/backlinks/github.com/acme/widget.json");
  for (const c of ["", null, "http://github.com/a/b", "https://gitlab.com/group/sub/app", "https://github.com/acme", "https://github.com/../x", "https://github.com/a/b%2Fc"]) assert.equal(backlinksUrl(idx, c), null, String(c));
});

test("citingOf: one item per citing repository, only citations of Ids held here", () => {
  const U = (n) => `${n}${n}${n}${n}${n}${n}${n}${n}-0000-4000-8000-000000000000`;
  const file = { cited_by: [
    { from: "https://github.com/b/two", entry: U(3), to: U(1), kind: "see" },
    { from: "https://github.com/a/one", entry: U(4), to: U(1), kind: "see" },
    { from: "https://github.com/a/one", entry: U(5), to: U(2), kind: "superseded_by" },
    { from: "https://github.com/a/one", entry: U(4), to: U(2), kind: "see" },
    { from: "https://github.com/a/one", entry: U(6), to: U(9), kind: "see" }, // an Id not held here
    { from: "https://github.com/fam/member", entry: U(7), to: U(1), kind: "see" }, // family: drawn already
    { from: "javascript:alert(1)", entry: U(8), to: U(1) },
    null,
  ] };
  const r = citingOf(file, [U(1), U(2)], ["https://github.com/fam/member/"]);
  assert.deepEqual(r.citing, [
    { canonical: "https://github.com/a/one", uuids: [U(4), U(5)] },
    { canonical: "https://github.com/b/two", uuids: [U(3)] },
  ]);
  assert.equal(r.elsewhere, 1);
  assert.deepEqual(citingOf(null, [U(1)]), { citing: [], elsewhere: 0 });
  assert.deepEqual(citingOf({ cited_by: "x" }, [U(1)]), { citing: [], elsewhere: 0 });
});

test("hostAnchor: a heading's anchor as GitHub renders it, not the entry id", () => {
  // each checked against the heading's id on github.com
  assert.equal(hostAnchor("The wizard now asks about activation reliability, and delegates setup to the current agent's own platform"), "the-wizard-now-asks-about-activation-reliability-and-delegates-setup-to-the-current-agents-own-platform");
  assert.equal(hostAnchor("Setup/init state is tracked opportunistically"), "setupinit-state-is-tracked-opportunistically");
  assert.equal(hostAnchor("`context/` gets `AGENTS.md`/`CLAUDE.md` guard files"), "context-gets-agentsmdclaudemd-guard-files");
  assert.equal(hostAnchor("Snake_case and hy-phens stay"), "snake_case-and-hy-phens-stay");
  assert.equal(hostAnchor("Größe über alles"), "größe-über-alles");
  assert.equal(hostAnchor(null), "");
});

// the clock (timeline stage)
const { todayISO, addDays, dayDiff, existsAt, statusAt, seeDay, supersededDay, linkExistsAt, daySpan } = core;

test("addDays and dayDiff count calendar days across month and year ends", () => {
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(addDays("2025-12-31", 1), "2026-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(dayDiff("2026-01-01", "2026-02-01"), 31);
  assert.equal(dayDiff("2026-02-01", "2026-01-01"), -31);
});

test("existsAt: from the day the heading first appeared; uncommitted only today; no clock means always", () => {
  const e = { git: { created: { date: "2026-03-10" } } };
  assert.ok(existsAt(e, "2026-03-10"));
  assert.ok(!existsAt(e, "2026-03-09"));
  assert.ok(existsAt(e, null));
  const fresh = { git: { created: { date: "", author: "(uncommitted)" } } };
  assert.ok(!existsAt(fresh, "2020-01-01"));
  assert.ok(existsAt(fresh, todayISO()));
  assert.ok(!existsAt({ status: "active" }, "2020-01-01"), "no Git on the entry in a project with a repository: not committed yet, today only");
  assert.ok(existsAt({ status: "active" }, todayISO()));
  assert.ok(existsAt({ status: "active" }, "2020-01-01", false), "a project without a repository: it simply is");
});

test("statusAt follows the status history up to the day", () => {
  const e = { status: "superseded", git: { created: { date: "2026-01-05" }, status_history: [
    { status: "active", date: "2026-01-05" }, { status: "needs-review", date: "2026-02-01" }, { status: "superseded", date: "2026-03-01" }] } };
  assert.equal(statusAt(e, "2026-01-04"), null, "not yet");
  assert.equal(statusAt(e, "2026-01-05"), "active");
  assert.equal(statusAt(e, "2026-02-15"), "needs-review");
  assert.equal(statusAt(e, "2026-03-01"), "superseded");
  assert.equal(statusAt(e, null), "superseded");
  assert.equal(statusAt({ status: "open", git: { created: { date: "2026-01-05" } } }, "2026-06-01"), "open", "no history: the status as it is");
});

test("a See exists from its as-of day, never before the citing entry; a Superseded by from the status change", () => {
  const from = { git: { created: { date: "2026-02-10" }, last_touched: { date: "2026-04-01" }, status_history: [{ status: "active", date: "2026-02-10" }, { status: "superseded", date: "2026-03-20" }] } };
  assert.equal(seeDay(from, { date: "2026-03-01" }), "2026-03-01");
  assert.equal(seeDay(from, { date: "2026-01-01" }), "2026-02-10", "an as-of before the entry: the entry's own day");
  assert.equal(seeDay(from, {}), "2026-02-10");
  assert.equal(supersededDay(from), "2026-03-20");
  assert.equal(supersededDay({ git: { created: { date: "2026-02-10" }, last_touched: { date: "2026-04-01" } } }), "2026-04-01", "no superseded in the history: when it was last touched");
  assert.ok(linkExistsAt("2026-03-01", "2026-03-01"));
  assert.ok(!linkExistsAt("2026-02-28", "2026-03-01"));
  assert.ok(linkExistsAt(null, "2026-03-01"));
  assert.ok(linkExistsAt("2026-02-28", ""), "a link without a day is always there");
});

test("daySpan runs from the earliest creation to today", () => {
  const s = daySpan([{ git: { created: { date: "2026-02-01" } } }, { git: { created: { date: "2025-11-15" } } }, { status: "active" }]);
  assert.deepEqual(s, { from: "2025-11-15", to: todayISO(), timed: false });
  assert.equal(daySpan([{ status: "active" }]), null);
});

// Git's moments beside the days (`time`), for a timeline finer than a day
const { isMoment, nowISO, timeGrid, stampLabel } = core;
test("moments: an entry exists from its moment, a bare day from the day's start; addDays and dayDiff keep the kind", () => {
  const e = { git: { created: { date: "2026-10-12", time: "2026-10-12T14:03:11Z" }, status_history: [{ status: "active", date: "2026-10-12", time: "2026-10-12T14:03:11Z" }, { status: "superseded", date: "2026-10-12", time: "2026-10-12T18:00:00Z" }] }, status: "superseded" };
  assert.ok(!existsAt(e, "2026-10-12T14:00:00Z"));
  assert.ok(existsAt(e, "2026-10-12T14:59:59Z"));
  assert.equal(statusAt(e, "2026-10-12T17:59:59Z"), "active");
  assert.equal(statusAt(e, "2026-10-12T18:00:00Z"), "superseded");
  assert.equal(supersededDay(e), "2026-10-12T18:00:00Z");
  assert.ok(existsAt({ git: { created: { date: "2026-10-12" } } }, "2026-10-12T00:59:59Z"), "an older export's day: from its start");
  assert.equal(addDays("2026-10-12T14:00:00Z", 1), "2026-10-13T14:00:00Z");
  assert.equal(addDays("2026-10-12", 1), "2026-10-13");
  assert.equal(dayDiff("2026-10-12T00:00:00Z", "2026-10-12T06:00:00Z"), 0.25);
  assert.equal(dayDiff("2026-10-12", "2026-10-14"), 2);
  assert.ok(isMoment(nowISO()) && nowISO().endsWith("Z"));
  const s = daySpan([{ git: { created: { date: "2026-10-12", time: "2026-10-12T14:03:11Z" } } }, { git: { created: { date: "2026-10-13" } } }]);
  assert.equal(s.from, "2026-10-12T14:03:11Z"); assert.ok(s.timed && isMoment(s.to));
});

test("timeGrid: hours over a span of two weeks or less, days beyond, the old days without moments", () => {
  const g = timeGrid({ from: "2026-10-12T14:03:11Z", to: "2026-10-14T09:30:00Z", timed: true });
  assert.ok(g.hours); assert.equal(g.unit, 1 / 24);
  assert.equal(g.at(0), "2026-10-12T14:59:59Z", "a step shows everything by its last second");
  assert.equal(g.stepOf(g.at(5)), 5);
  assert.equal(g.at(g.steps), "2026-10-14T09:30:00Z", "never past the end");
  assert.equal(g.toClock("2026-10-13"), "2026-10-13T23:59:59Z");
  assert.equal(g.toClock("2026-10-13T08"), "2026-10-13T08:59:59Z");
  assert.equal(g.url(g.at(3)), "2026-10-12T17");
  assert.equal(g.label(g.at(3)), stampLabel("2026-10-12T17:00:00Z"), "an hour's step labelled by its start");
  const d = timeGrid({ from: "2026-01-01T10:00:00Z", to: "2026-03-01T00:00:00Z", timed: true });
  assert.ok(!d.hours); assert.equal(d.at(0), "2026-01-01T23:59:59Z"); assert.equal(d.label(d.at(1)), "2026-01-02");
  const old = timeGrid({ from: "2026-01-01", to: "2026-01-10", timed: false });
  assert.equal(old.at(3), "2026-01-04"); assert.equal(old.steps, 9); assert.equal(old.toClock("2026-01-05"), "2026-01-05");
});

// the stage's scene and layout (timeline)
const { TYPE_KINDS, typeKind, weekStart, SHELF, stageCards, stageLinks, markLinked, stageLanes, logDepth, percentileBox, pushApart, stageHeight } = core;

const node = (id, entry, extra = {}) => ({ id, kind: "entry", entry, href: `#entry/${id}`, ...extra });
const entry = (id, uuid, day, extra = {}) => ({ id, uuid, title: id, file: extra.file || "a.md", type: extra.type || ["decision"], status: "active", evidence: "confirmed", see: extra.see || [], superseded_by: extra.superseded_by || null, git: day ? { created: { date: day, author: "x" }, status_history: [{ status: "active", date: day }] } : undefined });
const SCENE = () => {
  const a = entry("a.md#one", "aaaaaaaa-0000-4000-8000-000000000001", "2026-01-12"); // a Monday
  const b = entry("a.md#two", "aaaaaaaa-0000-4000-8000-000000000002", "2026-01-14", { see: [{ uuid: a.uuid, date: "2026-01-14" }] }); // the same week
  const f1 = entry("h.md#f1", "ffffffff-0000-4000-8000-000000000001", "2025-12-01", { file: "h.md" });
  const f2 = entry("h.md#f2", "ffffffff-0000-4000-8000-000000000002", "2025-12-20", { file: "h.md", see: [{ uuid: f1.uuid, date: "2025-12-20" }] });
  const f3 = entry("h.md#f3", "ffffffff-0000-4000-8000-000000000003", "2025-12-25", { file: "h.md" }); // joined to nothing of ours
  b.superseded_by = f2.uuid; b.git.status_history.push({ status: "superseded", date: "2026-02-01" });
  const nodes = [node("e:a.md#one", a), node("e:a.md#two", b), node("fe:x:f1", f1, { ext: true, proj: "friend", state: { bodies: "state.body.json" } }), node("fe:x:f2", f2, { ext: true, proj: "friend" }), node("fe:x:f3", f3, { ext: true, proj: "friend" })];
  const { cards, byId } = stageCards(nodes, { today: "2026-03-01", selfState: { me: true } });
  const links = stageLinks(cards, byId); markLinked(cards, links);
  return { cards, byId, links };
};

test("typeKind: the first of the four kinds an entry's Type names", () => {
  assert.equal(typeKind({ type: ["decision"] }), "decision");
  assert.equal(typeKind({ type: ["incident", "decision"] }), "incident");
  assert.equal(typeKind({ type: ["undefined — none fit"] }), null);
  assert.equal(typeKind({}), null);
  assert.deepEqual(TYPE_KINDS, ["decision", "constraint", "workaround", "incident"]);
});

test("weekStart is the Monday of the week", () => {
  assert.equal(weekStart("2026-10-08"), "2026-10-05"); // a Thursday
  assert.equal(weekStart("2026-10-05"), "2026-10-05");
  assert.equal(weekStart("2026-10-04"), "2026-09-28"); // a Sunday
});

test("stageCards: a card per node, foreign ones knowing their repository and state, ours the self state", () => {
  const { cards, byId } = SCENE();
  assert.equal(cards.length, 5);
  const ours = cards.find((c) => c.nid === "e:a.md#one"), theirs = cards.find((c) => c.nid === "fe:x:f1");
  assert.equal(ours.ext, false); assert.deepEqual(ours.state, { me: true }); assert.equal(ours.laneKey, "|a.md"); assert.equal(ours.day, "2026-01-12");
  assert.equal(theirs.ext, true); assert.equal(theirs.proj, "friend"); assert.equal(theirs.laneKey, "friend|h.md"); assert.equal(theirs.state.bodies, "state.body.json");
  assert.equal(byId[ours.e.uuid], ours, "by Id"); assert.equal(byId["a.md#one"], ours, "ours by entry id too"); assert.equal(byId["h.md#f1"], undefined, "a foreign entry id is not an address");
  const noDate = stageCards([node("e:n", { id: "n", title: "n", file: "a.md" })], { today: "2026-03-01" }).cards[0];
  assert.equal(noDate.day, "2026-03-01", "no Git date: today");
});

test("stageLinks: a See from its as-of day, a Superseded by from the status change; markLinked follows the chain", () => {
  const { cards, links } = SCENE();
  assert.equal(links.length, 3);
  const see = links.find((l) => l.kind === "see" && l.a.nid === "e:a.md#two"); assert.equal(see.day, "2026-01-14"); assert.equal(see.b.nid, "e:a.md#one");
  const sup = links.find((l) => l.kind === "superseded"); assert.equal(sup.a.nid, "e:a.md#two"); assert.equal(sup.b.nid, "fe:x:f2"); assert.equal(sup.day, "2026-02-01");
  const linked = Object.fromEntries(cards.map((c) => [c.nid, c.linked]));
  assert.deepEqual(linked, { "e:a.md#one": true, "e:a.md#two": true, "fe:x:f2": true, "fe:x:f1": true, "fe:x:f3": false }, "f1 is reached through f2, f3 is joined to nothing of ours");
});

test("stageLanes: one per topic per repository among the cards shown, oldest left, rows for a busy week", () => {
  const { cards } = SCENE();
  const all = stageLanes(cards, { topicTitle: (f) => (f === "a.md" ? "Alpha" : null) });
  assert.deepEqual(all.lanes.map((L) => L.title), ["friend · h.md", "Alpha"]);
  assert.equal(all.cols, 1);
  const linkedOnly = stageLanes(cards, { show: (c) => !c.ext || c.linked });
  assert.equal(linkedOnly.lanes.find((L) => L.key === "friend|h.md").items.length, 2, "f3 is not in the lane");
  const ours = stageLanes(cards, { show: (c) => !c.ext });
  assert.deepEqual(ours.lanes.map((L) => L.key), ["|a.md"]);
  const [one, two] = ours.lanes[0].items;
  assert.equal(one.lane, ours.lanes[0]); assert.equal(one.y, SHELF[0] - 0.44, "the first of the week on the lower row"); assert.equal(two.y, SHELF[0], "the second on the middle row");
  assert.equal(one.x, ours.lanes[0].x - 0.17); assert.equal(one.dz, 0);
});

test("logDepth: zero today, growing with the days, the span's end at the far depth whatever the span", () => {
  assert.equal(logDepth(0, 100, 6), 0);
  assert.ok(logDepth(1, 100, 6) < logDepth(7, 100, 6) && logDepth(7, 100, 6) < logDepth(30, 100, 6));
  assert.ok(Math.abs(logDepth(100, 100, 6) - 6) < 1e-9);
  assert.ok(Math.abs(logDepth(1000, 1000, 6) - 6) < 1e-9);
  assert.equal(logDepth(-5, 100, 6), 0, "the future is at the front");
});

test("percentileBox leaves the outliers out", () => {
  const xs = [-1000, ...Array.from({ length: 50 }, (_, i) => 10 + i), 1000], ys = xs.map((x) => -x); // two outliers around fifty points
  const b = percentileBox(xs, ys);
  assert.ok(b.x0 >= 10 && b.x1 <= 59, `the box is the bulk, got ${b.x0}..${b.x1}`);
  assert.ok(b.y0 >= -59 && b.y1 <= -10);
  assert.equal(percentileBox([1], [1]), null);
});

test("pushApart separates two overlapping cards at one depth and respects a bound", () => {
  const box = (cx, cy) => ({ x0: cx - 20, y0: cy - 10, x1: cx + 20, y1: cy + 10, cx, cy, s: 1 });
  const c1 = { ox: 0, oy: 0 }, c2 = { ox: 0, oy: 0 };
  const items = [{ c: c1, z: 1, box: box(100, 100) }, { c: c2, z: 1, box: box(110, 102) }]; // overlap 30 across, 18 up
  const opts = { px: () => 100, py: () => 100, room: () => ({ xlo: -1, xhi: 1, ylo: -1, yhi: 1 }) };
  assert.ok(pushApart(items, opts));
  assert.ok(c1.oy > 0 && c2.oy < 0, "the smaller overlap is up: the first card goes up (oy grows), the second down");
  assert.ok(Math.abs(items[0].box.cy - items[1].box.cy) >= 20 - 1e-9, "they touch now");
  assert.ok(!pushApart(items, opts), "nothing left to push");
  const far = [{ c: { ox: 0, oy: 0 }, z: 5, box: box(100, 100) }, { c: { ox: 0, oy: 0 }, z: 1, box: box(100, 100) }];
  assert.ok(!pushApart(far, opts), "cards far apart in depth may cover each other");
  const bound = { c: { ox: 0, oy: 0.95 }, z: 1, box: box(100, 100) }, other = { c: { ox: 0, oy: 0 }, z: 1, box: box(100, 102) };
  pushApart([bound, other], { ...opts, room: () => ({ xlo: -1, xhi: 1, ylo: -1, yhi: 1 }) });
  assert.ok(bound.c.oy <= 1 + 1e-9, "a card at its bound gives its half to the other");
});

test("stageHeight: the base at least, twice it at most, what the window leaves in between", () => {
  assert.equal(stageHeight(500, 300), 500);
  assert.equal(stageHeight(500, 800), 800);
  assert.equal(stageHeight(500, 2000), 1000);
  assert.equal(stageHeight(100, 50), 220);
});

// authors across the loaded projects
const { mergeAuthors, sortAuthors } = core;

test("mergeAuthors: one row per name across projects with the sums, each project with its own numbers", () => {
  const groups = [
    { name: "alpha", canonical: "https://github.com/x/alpha", authors: [{ name: "Ann", created: 3, touched: 4, superseded: 1, first: "2026-02-01", last: "2026-03-01", evidence: { confirmed: 2, inferred: 1 } }, { name: "Bo", created: 1, touched: 1, superseded: 0, first: "2026-02-10", last: "2026-02-10", evidence: { confirmed: 1 } }] },
    { name: "beta", canonical: "https://github.com/x/beta", authors: [{ name: "Ann", created: 2, touched: 2, superseded: 0, first: "2026-01-15", last: "2026-04-01", evidence: { unknown: 2 } }] },
  ];
  const rows = mergeAuthors(groups);
  assert.deepEqual(rows.map((r) => r.label), ["Ann", "Bo"], "A–Z by name");
  const ann = rows[0];
  assert.equal(ann.created, 5); assert.equal(ann.touched, 6); assert.equal(ann.superseded, 1);
  assert.equal(ann.first, "2026-01-15"); assert.equal(ann.last, "2026-04-01");
  assert.deepEqual(ann.evidence, { confirmed: 2, inferred: 1, unknown: 2 });
  assert.deepEqual(ann.per.map((p) => [p.project, p.created]), [["alpha", 3], ["beta", 2]]);
  assert.equal(rows[1].per.length, 1);
});

test("mergeAuthors: an anonymized name stays one row per project, labelled with it", () => {
  const groups = [
    { name: "alpha", anonymized: true, authors: [{ name: "author-1", created: 2, evidence: {} }] },
    { name: "beta", anonymized: true, authors: [{ name: "author-1", created: 1, evidence: {} }] },
    { name: "gamma", authors: [{ name: "author-1", created: 1, evidence: {} }] }, // a real name that happens to read like one: its own row
  ];
  const rows = mergeAuthors(groups);
  assert.deepEqual(rows.map((r) => r.label), ["author-1", "author-1 (alpha)", "author-1 (beta)"]);
  assert.ok(!rows[0].anonymized && rows[1].anonymized);
  assert.deepEqual(mergeAuthors([]), []);
});

test("sortAuthors: by any column, ties A–Z by name, a missing date last either way", () => {
  const row = (label, created, last, projects = 1) => ({ label, created, touched: created, superseded: 0, first: last, last, per: Array(projects).fill({}) });
  const rows = [row("bea", 1, "2026-10-01"), row("Ann", 5, "2026-09-01", 2), row("Cy", 1, ""), row("al", 1, "2026-09-01")];
  const by = (key, dir) => sortAuthors(rows, key, dir).map((r) => r.label).join();
  assert.equal(by("author", "asc"), "al,Ann,bea,Cy", "A–Z, case aside");
  assert.equal(by("author", "desc"), "Cy,bea,Ann,al");
  assert.equal(by("created", "desc"), "Ann,al,bea,Cy", "ties by name");
  assert.equal(by("created", "asc"), "al,bea,Cy,Ann");
  assert.equal(by("projects", "desc"), "Ann,al,bea,Cy");
  assert.equal(by("last", "desc"), "bea,al,Ann,Cy", "no date last");
  assert.equal(by("last", "asc"), "al,Ann,bea,Cy", "no date last the other way round too");
  assert.deepEqual(rows.map((r) => r.label), ["bea", "Ann", "Cy", "al"], "the input is left as it was");
});

test("familyOrder: the root first, each member under the one that lists it, siblings by rank then name", () => {
  const m = (node, role, name, up = null) => ({ node, role, name, up });
  const members = [
    m("web", "self", "acme---web", "suite"), m("suite", "parent", "suite"), m("plugin", "child", "plugin", "web"),
    m("docs", "sibling", "docs", "suite"), m("cli", "sibling", "cli", "suite"),
  ];
  assert.deepEqual(familyOrder(members).map(([x, d]) => `${d}:${x.name}`), ["0:suite", "1:acme---web", "2:plugin", "1:cli", "1:docs"]);
  // a cycle drops no row
  const loop = [m("a", "parent", "a", "b"), m("b", "child", "b", "a")];
  assert.equal(familyOrder(loop).length, 2);
  assert.ok(familyRank({ role: "self" }) < familyRank({ role: "ancestor", depth: 3 }));
  assert.ok(familyRank({ role: "sibling" }) < familyRank({ role: "child" }));
});

test("shuffled: a permutation in a new array, the input untouched", () => {
  const list = [1, 2, 3, 4, 5, 6];
  let s = 1; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out = shuffled(list, rnd);
  assert.deepEqual(list, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...out].sort((a, b) => a - b), list);
  assert.notDeepEqual(out, list);
  assert.deepEqual(shuffled([], rnd), []);
});

test("ownerOf: the owner of a repository, subgroups included", () => {
  assert.deepEqual(ownerOf("https://github.com/acme/widget"), { key: "github.com/acme", label: "acme", url: "https://github.com/acme" });
  assert.deepEqual(ownerOf("https://gitlab.com/Acme/tools/cli/"), { key: "gitlab.com/acme/tools", label: "Acme/tools", url: "https://gitlab.com/Acme/tools" });
  assert.equal(ownerOf("git@github.com:acme/widget.git").key, "github.com/acme");
  assert.equal(ownerOf("github.com/acme/widget").label, "acme");
  assert.equal(ownerOf("https://github.com/acme"), null);
  assert.equal(ownerOf(""), null);
});

test("colours are named, not given: a Type's token, and the palette's slot wrapped around its size", () => {
  assert.deepEqual(Object.keys(TYPE_TOKENS), ["decision", "constraint", "workaround", "incident"]);
  for (const t of Object.values(TYPE_TOKENS)) assert.match(t, /^--ktw-type-[a-z]+$/);
  assert.equal(PALETTE_SIZE, 10);
  assert.equal(paletteToken(0), "--ktw-palette-0");
  assert.equal(paletteToken(9), "--ktw-palette-9");
  assert.equal(paletteToken(10), "--ktw-palette-0");
  assert.equal(paletteToken(23), "--ktw-palette-3");
  assert.equal(paletteToken(-1), "--ktw-palette-9");
});

test("every colour token the pure part names is defined in the stylesheet's :root", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("../../ktw_dashboard/web/style.css", import.meta.url), "utf8");
  const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
  const names = [...Object.values(TYPE_TOKENS), ...Array.from({ length: PALETTE_SIZE }, (_, i) => paletteToken(i))];
  for (const n of names) assert.match(root, new RegExp(`${n}:\\s*#[0-9a-f]{6};`), `${n} missing or not a literal colour in :root`);
});

test("routes: today's hash grammar, parsed and written back unchanged", () => {
  const { parse, format, PAGES } = core.routes;
  const uuid = "550e8400-e29b-41d4-a716-446655440000";
  const cases = [
    ["#overview", { view: "overview" }],
    ["#graph", { view: "graph" }],
    ["#timeline", { view: "timeline" }],
    ["#timeline/2026-10-08", { view: "timeline", day: "2026-10-08" }],
    ["#timeline/2026-10-08T14", { view: "timeline", day: "2026-10-08T14" }],
    ["#topic/sync.md", { view: "topic", file: "sync.md" }],
    [`#entry/${uuid}`, { view: "entry", uuid }],
    ["#entry/sync.md%23snapshot-before-buffer", { view: "entry", uuid: "sync.md#snapshot-before-buffer" }],
    [`#thought/${uuid},${uuid}`, { view: "thought", refs: [uuid, uuid] }],
    [`#ref/https%3A%2F%2Fgithub.com%2Facme%2Fwidget/${uuid}`, { view: "ref", canonical: "https://github.com/acme/widget", uuid }],
    ["#search/project/snapshot%20buffer", { view: "search", scope: "project", q: "snapshot buffer" }],
    ["#search/registry/a%2Fb", { view: "search", scope: "registry", q: "a/b" }],
    ["#graph/family", { view: "graph", alias: "family" }],
  ];
  for (const [hash, route] of cases) {
    assert.deepEqual(parse(hash), route, hash);
    assert.equal(format(route), hash, hash);
  }
  for (const p of PAGES) assert.equal(format(parse(`#${p}`)), `#${p}`);
});

test("routes: no hash, an unknown one, a malformed escape", () => {
  const { parse, format } = core.routes;
  assert.deepEqual(parse(""), { view: "overview" });
  assert.deepEqual(parse("#"), { view: "overview" });
  assert.deepEqual(parse("#nowhere"), { view: "overview", unknown: "nowhere" });
  assert.equal(format(parse("#nowhere")), "#overview");
  assert.equal(parse("#entry/%E0%A4%A").uuid, "%E0%A4%A"); // kept as written instead of throwing
  assert.equal(parse("#search/project/a/b").q, "a/b"); // a slash in the query, typed into the address bar
  assert.equal(format({ view: "nowhere" }), "#overview");
});

test("every name app.js takes from the core is there", async () => {
  const { readFileSync } = await import("node:fs");
  const app = readFileSync(new URL("../../ktw_dashboard/web/app.js", import.meta.url), "utf8");
  const m = app.match(/^const \{([^}]*)\} = globalThis\.KeepTheWhy\.core;/m);
  assert.ok(m, "app.js reads the core namespace in one destructuring line");
  const missing = m[1].split(",").map((s) => s.trim()).filter(Boolean).filter((n) => !(n in core));
  assert.deepEqual(missing, []);
});

test("an export's address comes from the published .keep-the-why, https only", () => {
  const { exportStateUrl } = core;
  assert.deepEqual(exportStateUrl("- dashboard-state: https://e.org/s.json\n", "RAW"), { url: "https://e.org/s.json" });
  assert.deepEqual(exportStateUrl("- id: x\n", "RAW"), { error: "no dashboard-state line in the published .keep-the-why (RAW) — this project has no published export yet", missingLine: true });
  assert.match(exportStateUrl("- dashboard-state: http://e.org/s.json", "RAW").error, /not an https URL/);
  assert.equal(exportStateUrl(null, "RAW").missingLine, true);
});

test("an export is shown as the repository asked for, as a fork, or refused", () => {
  const { exportVerdict, sameCanonical } = core;
  const st = (canonical, remote) => ({ project: { canonical, git: remote ? { remote } : {} } });
  assert.ok(sameCanonical("https://github.com/Acme/W/", "https://github.com/acme/w"));
  assert.deepEqual(exportVerdict(st("https://github.com/acme/w"), "https://github.com/ACME/w/", "U"), {});
  assert.deepEqual(exportVerdict(st(undefined), "https://github.com/acme/w", "U"), {});
  assert.deepEqual(exportVerdict(st("https://github.com/up/w", "github.com/acme/w"), "https://github.com/acme/w", "U"), { forkOf: "https://github.com/up/w" });
  assert.deepEqual(exportVerdict(st("https://github.com/other/x"), "https://github.com/acme/w", "U"), { error: "the export at U belongs to https://github.com/other/x, not to https://github.com/acme/w" });
});

test("a See into another repository: the live server's project first, the published export after it", () => {
  const { resolveSee } = core;
  const U = "11111111-1111-4111-8111-111111111111";
  const e = { uuid: U, title: "x" };
  assert.deepEqual(resolveSee(U, { known: { project: "p", entry: e, url: "u" } }), { entry: e, via: "live", project: "p" });
  assert.deepEqual(resolveSee(U, { known: { error: "not known", url: "u" }, published: { state: { entries: [e] } } }), { entry: e, via: "export" });
  assert.deepEqual(resolveSee(U, { published: { error: "could not fetch the export: x" } }), { error: "could not fetch the export: x" });
  assert.match(resolveSee(U, { published: { state: { generated: "2026-10-01", entries: [] } } }).error, /generated 2026-10-01\) has no entry with this Id/);
  assert.match(resolveSee(U, {}).error, /no published export/);
  assert.equal(resolveSee(U, { published: {} }).error, "its published export could not be read"); // neither state nor error: still a failure
});

test("hostAnchor: the linter's anchor rule, over the shared vectors read from rendered files", async () => {
  const { readFileSync } = await import("node:fs");
  const { vectors } = JSON.parse(readFileSync(new URL("../../../lint/tests/anchors.json", import.meta.url), "utf8"));
  for (const v of vectors) assert.equal(core.hostAnchor(v.title), v.anchor, v.title);
  assert.equal(core.slug, core.hostAnchor); // an entry's fallback id is its anchor too
});

test("the layout steps without a canvas: it moves what is shown, leaves what is fixed or hidden, and settles", () => {
  const { layoutTick, settleLayout } = core;
  const mk = () => ({
    nodes: [
      { id: "a", kind: "topic", x: 0, y: 0, vx: 0, vy: 0 },
      { id: "b", kind: "entry", x: 5, y: 0, vx: 0, vy: 0 },
      { id: "c", kind: "entry", x: 0, y: 5, vx: 0, vy: 0, fixed: true },
      { id: "d", kind: "entry", x: 50, y: 50, vx: 0, vy: 0, hidden: true },
    ],
    links: [{ s: 0, t: 1, len: 60, kind: "member" }],
  });
  const opts = { visible: (n) => !n.hidden };
  const g = mk();
  assert.equal(layoutTick(g.nodes, g.links, 1, opts), 0.985);
  assert.ok(g.nodes[0].x !== 0 || g.nodes[0].y !== 0, "a shown node moves");
  assert.deepEqual([g.nodes[2].x, g.nodes[2].y], [0, 5], "a fixed node stays");
  assert.deepEqual([g.nodes[3].x, g.nodes[3].y], [50, 50], "a hidden node stays");
  // the same start gives the same layout: no randomness inside the step
  const h = mk(); layoutTick(h.nodes, h.links, 1, opts);
  assert.deepEqual(h.nodes.map((n) => [n.x, n.y]), g.nodes.map((n) => [n.x, n.y]));
  // settled: the alpha left is at the threshold, and the spring has pulled a and b toward its length
  const s = mk(); const left = settleLayout(s.nodes, s.links, opts);
  assert.ok(left <= 0.003 && left > 0.003 * 0.985, `settles at the threshold, got ${left}`);
  assert.ok(Math.hypot(s.nodes[1].x - s.nodes[0].x, s.nodes[1].y - s.nodes[0].y) > 20, "the spring has opened the pair up");
  assert.equal(settleLayout(mk().nodes, [], { maxTicks: 3 }), 1 * 0.985 * 0.985 * 0.985, "maxTicks bounds the run");
});

test("layoutTick, pinned on the branches the fixture's graph has none of: a family line, foreign nodes, hubs of two units, an owner", () => {
  // The values come from the force step as it ran inline in app.js before it moved to the core (dashboard
  // 0.11.22), on this graph, 25 steps from these positions: a change to any force shows here.
  const { layoutTick } = core;
  const n = (id, kind, x, y, extra = {}) => ({ id, kind, x, y, vx: 0, vy: 0, ...extra });
  const nodes = [
    n("hubA", "project", 0, 0),
    n("hubB", "project", 120, 40, { unit: "f1", ext: true, owner: "o" }), // a foreign unit: apart from hubA ...
    n("hubC", "project", -100, 90, { unit: "f2", ext: true, owner: "o" }), // ... but hubB and hubC share an owner: not apart
    n("t1", "topic", 30, -20),
    n("e1", "entry", 50, -40),
    n("e2", "entry", 150, 60, { unit: "f1", ext: true }), // a foreign entry: the weaker pull to the centre
  ];
  const links = [
    { s: 0, t: 1, len: 260, kind: "family" }, { s: 0, t: 3, len: 120, kind: "hub" }, { s: 3, t: 4, len: 40, kind: "member" },
    { s: 4, t: 5, len: 150, kind: "see" }, { s: 1, t: 2, len: 200, kind: "owner" }, { s: 1, t: 5, len: 60, kind: "member" },
  ];
  let a = 1; for (let i = 0; i < 25; i++) a = layoutTick(nodes, links, a);
  assert.deepEqual(nodes.map((m) => [m.id, +m.x.toFixed(6), +m.y.toFixed(6)]), [
    ["hubA", -87.467947, -125.185213], ["hubB", 116.907401, 83.256341], ["hubC", -51.263573, 204.208524],
    ["t1", 10.851549, -56.570991], ["e1", 58.523222, -38.460981], ["e2", 169.890672, 76.979504],
  ]);
  assert.equal(+a.toFixed(12), +(0.985 ** 25).toFixed(12)); // the alpha: 25 decays
});

test("the sidebar's filter: each field empty for any, an entry's author its creator or its last toucher", () => {
  const { NO_FILTER, filterActive, entryMatches, fkey } = core;
  const e = { status: "active", evidence: "inferred", git: { created: { author: "Alice" }, last_touched: { author: "Bob" } } };
  assert.equal(filterActive(NO_FILTER), false); assert.equal(filterActive(null), false);
  assert.equal(filterActive({ ...NO_FILTER, author: "Bob" }), true);
  assert.equal(entryMatches(e, NO_FILTER), true); assert.equal(entryMatches(e, null), true);
  assert.equal(entryMatches(e, { ...NO_FILTER, status: "open" }), false);
  assert.equal(entryMatches(e, { ...NO_FILTER, evidence: "inferred", author: "Alice" }), true);
  assert.equal(entryMatches(e, { ...NO_FILTER, author: "Bob" }), true, "the last toucher matches too");
  assert.equal(entryMatches({ status: "active", git: { last_touched: { author: "Bob" } } }, { ...NO_FILTER, author: "Bob" }), true);
  assert.equal(fkey("https://GitHub.com/Acme/W//"), "https://github.com/acme/w");
});
