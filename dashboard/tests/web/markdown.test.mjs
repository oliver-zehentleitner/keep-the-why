// Unit tests for ktw-markdown.js's parser: node --test, no jsdom. Parity with the HTML-string
// renderer it replaced is parity.mjs's job; here: the subset, the link rules, and that nothing
// written in a body becomes markup.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const file = new URL("../../ktw_dashboard/web/ktw-markdown.js", import.meta.url);
vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file.pathname });
const { parse, parseInline } = globalThis.KeepTheWhy.markdown;
const topics = new Set(["auth.md", "sync.md"]);
const opts = { topicHref: (f) => (topics.has(f) ? `#topic/${f}` : null) };
const T = (v) => ({ t: "text", v });

test("blocks: paragraph, heading, both lists with continuation, fence, labelled callout", () => {
  const md = "One\nline.\n\n## Head\n\n- a\n  more\n- b\n\n1. x\n2. y\n\n```\n<b>raw</b>\n```\n\n**Reason:** because";
  assert.deepEqual(parse(md, opts), [
    { k: "p", c: [T("One line.")] },
    { k: "h", c: [T("Head")] },
    { k: "ul", items: [[T("a more")], [T("b")]] },
    { k: "ol", items: [[T("x")], [T("y")]] },
    { k: "pre", v: "<b>raw</b>" },
    { k: "label", kind: "reason", label: "Reason", c: [T("because")] },
  ]);
});

test("inline: code, bold, both italics at word bounds, and code keeps its text", () => {
  assert.deepEqual(parseInline("a `x*y` **b** *c* _d_ snake_case_name", opts), [
    T("a "), { t: "code", c: [T("x*y")] }, T(" "), { t: "b", c: [T("b")] }, T(" "), { t: "i", c: [T("c")] }, T(" "), { t: "i", c: [T("d")] }, T(" snake_case_name"),
  ]);
});

test("links: https opens elsewhere, a known topic links here, everything else is text only", () => {
  assert.deepEqual(parseInline("[x](https://e.org/a?b=1&c)", opts), [{ t: "a", href: "https://e.org/a?b=1&c", external: true, c: [T("x")] }]);
  assert.deepEqual(parseInline("[x](auth.md#a-b)", opts), [{ t: "a", href: "#topic/auth.md", external: false, c: [T("x")] }]);
  for (const target of ["http://e.org", "javascript:void0", "data:text/html,x", "other.md", "/etc/passwd", "//e.org"])
    assert.deepEqual(parseInline(`[x](${target})`, opts), [{ t: "a", href: null, external: false, c: [T("x")] }], target);
});

test("a bare topic name links when the page knows it, also as code and in quotes; not inside bold", () => {
  assert.deepEqual(parseInline("see auth.md, `sync.md` and nope.md", opts), [
    T("see "), { t: "a", href: "#topic/auth.md", external: false, c: [T("auth.md")] }, T(", "),
    { t: "a", href: "#topic/sync.md", external: false, c: [{ t: "code", c: [T("sync.md")] }] }, T(" and nope.md"),
  ]);
  assert.deepEqual(parseInline('"auth.md"', opts)[1], { t: "a", href: "#topic/auth.md", external: false, c: [T("auth.md")] });
  assert.deepEqual(parseInline("**auth.md**", opts), [{ t: "b", c: [T("auth.md")] }]);
});

test("nothing written becomes markup: tags, entities and the renderer's own markers stay text", () => {
  const evil = '<img src=x onerror=alert(1)><script>alert(2)</script> &lt; \uE002x\uE003 [a](javascript:alert(3))';
  const flat = (nodes) => nodes.map((n) => (n.t === "text" ? n.v : `{${n.t}${n.href ? " " + n.href : ""}:${flat(n.c)}}`)).join("");
  const out = flat(parseInline(evil, opts));
  assert.equal(out, '<img src=x onerror=alert(1)><script>alert(2)</script> &lt; x {a:a})'); // the target ends at the first ")", as before
  for (const b of parse(`${evil}\n\n- ${evil}`, opts)) assert.ok(["p", "ul"].includes(b.k));
});
