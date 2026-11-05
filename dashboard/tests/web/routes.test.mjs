// The routes grammar (ktw-core.js routes): every place the views name round-trips through format and parse —
// with a centre in another project or without, and with values that carry the characters an address reserves.
// A hash written before the centre prefix and the encoding still reads as it did.
//
//   node --test routes.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import core from "./core.mjs";

const { routes, plainText } = core;
const UUID = "0c360e6c-d9c5-4d2b-b9d9-8a132e74c53d";
const NASTY = ["api.md", "a b.md", "a#b.md", "what?.md", "100%.md", "50%20off.md", "sub/dir/x y.md", "a&b=c.md", "ümlaut-日本.md"];
const CANONICALS = ["https://github.com/acme/widget", "https://git.example.org:8443/a/b?x=1&y=2#frag", "https://gitlab.com/g/sub/repo"];
const CENTRES = [
  { mode: "public", canonical: CANONICALS[0], root: "" },
  { mode: "public", canonical: CANONICALS[1], root: "hub/web" },
  { mode: "public", canonical: CANONICALS[2], root: "a b" },
  { mode: "live", project: "/home/me/my project" },
  { mode: "live", project: "C:\\work\\repo #2" },
];
const PLACES = [
  { view: "overview" },
  ...routes.PAGES.filter((p) => p !== "overview").map((view) => ({ view })),
  { view: "graph", alias: "family" },
  { view: "timeline", day: "2026-11-05" },
  ...NASTY.map((file) => ({ view: "topic", file })),
  { view: "entry", uuid: UUID },
  { view: "thought", refs: [UUID, "dashboard.md#a-b", "x,y"] },
  ...CANONICALS.map((canonical) => ({ view: "ref", canonical, uuid: UUID })),
  { view: "search", scope: "family", q: "a/b c?#%" },
  { view: "search", scope: "this", q: "" },
];

test("every place round-trips: parse(format(route)) is the route", () => {
  for (const r of PLACES) assert.deepEqual(routes.parse(routes.format(r)), r, routes.format(r));
});

test("every place round-trips with a centre in another project, in both modes", () => {
  for (const centre of CENTRES) {
    for (const r of PLACES) {
      const route = { ...r, centre };
      const hash = routes.format(route);
      assert.ok(hash.startsWith(`#centre/${centre.mode}/`), hash);
      assert.deepEqual(routes.parse(hash), route, hash);
    }
  }
});

test("format(parse(hash)) is the hash for what format writes", () => {
  for (const centre of [undefined, ...CENTRES]) {
    for (const r of PLACES) {
      const hash = routes.format(centre ? { ...r, centre } : r);
      assert.equal(routes.format(routes.parse(hash)), hash);
    }
  }
});

test("a value is one segment: its reserved characters are encoded, a topic's path keeps its slashes", () => {
  assert.equal(routes.format({ view: "topic", file: "sub/a #b?.md" }), "#topic/sub/a%20%23b%3F.md");
  assert.equal(routes.format({ view: "topic", file: "100%.md" }), "#topic/100%25.md");
  assert.equal(routes.format({ view: "ref", canonical: "https://h/a/b", uuid: UUID }), `#ref/https%3A%2F%2Fh%2Fa%2Fb/${UUID}`);
  assert.equal(routes.format({ view: "entry", uuid: UUID, centre: CENTRES[0] }), `#centre/public/https%3A%2F%2Fgithub.com%2Facme%2Fwidget//entry/${UUID}`);
  assert.equal(routes.format({ view: "overview", centre: CENTRES[3] }), "#centre/live/%2Fhome%2Fme%2Fmy%20project");
});

test("the export centre, the page's own state, writes no prefix", () => {
  assert.equal(routes.format({ view: "graph", centre: { mode: "export" } }), "#graph");
});

test("a hash written before the encoding reads as it did", () => {
  assert.deepEqual(routes.parse("#topic/api.md"), { view: "topic", file: "api.md" });
  assert.deepEqual(routes.parse("#topic/a%20b.md"), { view: "topic", file: "a b.md" }); // a browser's own escape of a space
  assert.deepEqual(routes.parse("#timeline/2026-11-05"), { view: "timeline", day: "2026-11-05" });
  assert.deepEqual(routes.parse(`#ref/${encodeURIComponent(CANONICALS[0])}/${UUID}`), { view: "ref", canonical: CANONICALS[0], uuid: UUID });
  assert.deepEqual(routes.parse("#search/this/hello%20world"), { view: "search", scope: "this", q: "hello world" });
  for (const v of ["graph", "overview", "timeline", "graph/family"]) assert.equal(routes.format(routes.parse(`#${v}`)), `#${v}`);
});

test("a malformed escape stays as written", () => {
  assert.deepEqual(routes.parse("#topic/50%E0%A4%A.md"), { view: "topic", file: "50%E0%A4%A.md" });
  assert.deepEqual(routes.parse("#entry/%E0%A4%A"), { view: "entry", uuid: "%E0%A4%A" });
});

test("a centre prefix that is short, empty or of an unknown mode is no place: the overview, as any unknown hash", () => {
  for (const h of ["#centre", "#centre/", "#centre/public", "#centre/public/x", "#centre/public//", "#centre/live", "#centre/live/", "#centre/mirror/x/entry/1", "#centre/live/p/nowhere"]) {
    assert.deepEqual(routes.parse(h), { view: "overview", unknown: h.slice(1) }, h);
  }
});

test("the grammar does not check a centre's values: a hostile canonical reads back as written, for the host to check", () => {
  const r = routes.parse(routes.format({ view: "entry", uuid: UUID, centre: { mode: "public", canonical: "javascript:alert(1)", root: "" } }));
  assert.equal(r.centre.canonical, "javascript:alert(1)");
  assert.equal(core.safeUrl(r.centre.canonical), null, "core.safeUrl refuses it, as the dashboard's redirect does");
});

test("plainText: no control, zero-width or bidi character; a space and a backslash pass", () => {
  for (const s of ["/home/me/my project", "C:\\work\\repo", "ümlaut"]) assert.equal(plainText(s), true, s);
  for (const s of ["a\u0000b", "a\nb", "a\u202eb", "a\u200bb", "a\ufeffb", "a\u0085b"]) assert.equal(plainText(s), false, JSON.stringify(s));
  assert.equal(plainText(null), false);
});
