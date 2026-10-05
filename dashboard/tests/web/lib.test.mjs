// Unit tests for the page's pure part (lib.js): node --test, no jsdom, no npm.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  esc, plural, isUuid, rawFileUrl, configLine, normalizeState, slug, hostFileLink, canonicalOf,
  parseSupersededBy, kindLabel, typeName, groupByFamily, searchTerms, searchHit, compareHits, snippetAt, highlight,
  resolveLocation, bodyProse, linkFamily, authorLookup, mergeStates, friendsOf, thoughtsOf, thoughtInsights, HOSTS, hostOf, backlinksUrl, citingOf, hostAnchor,
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
