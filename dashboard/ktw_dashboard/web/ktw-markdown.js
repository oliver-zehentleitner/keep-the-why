/* Keep the Why dashboard — the Markdown of entry bodies, titles and field
   values, rendered as DOM nodes. No HTML string is ever built: the parser
   turns text into a small tree, the builder turns the tree into elements
   with createElement and text nodes, so a host that forbids HTML sinks can
   load it unchanged. A classic script on globalThis.KeepTheWhy.markdown,
   listed in ktw-views.json, tested with node:test (tests/web/markdown.test.mjs).

   The subset is the one entries use, and nothing more:
   blocks  — paragraphs; ATX headings (shown as a bold paragraph, as inside an
             entry); "-"/"*" lists with indented continuation lines; "1." lists;
             ``` and ~~~ fences; a paragraph opening with **Reason:**,
             **Rejected alternative:**, **Consequence:**, **Considered:** or
             **Why this needs an answer:** as a labelled callout
   inline  — `code`, **bold**, *italic* and _italic_ at word bounds, [text](url)
             for an https URL core.safeUrl passes, [text](topic.md#anchor) and a bare topic.md when
             the host knows that topic. Every other link target is text only;
             raw HTML, images, tables and the rest stay literal text.

   The inline rules run in the order and with the patterns the page used when
   it built HTML strings — code, bold, italics, links, bare topic names — over
   the raw text, with private-use markers in place of tags; the marked text is
   then read into the tree. That keeps what a body looks like unchanged. */
(function (root) {
"use strict";
const { safeUrl, safeHref } = root.KeepTheWhy.core; // ktw-core.js, loaded before this module

// markers: opening and closing code, bold, italic; a link opens with LINK, its
// index into the link list, LINK_END, and closes with LINK_CLOSE
const CODE = "\uE000", CODE_C = "\uE001", B = "\uE002", B_C = "\uE003", I = "\uE004", I_C = "\uE005";
const LINK = "\uE006", LINK_END = "\uE007", LINK_C = "\uE008";
const MARKERS = /[\uE000-\uE008]/g;
const OPENERS = new Set([CODE, B, I, LINK]);
const CLOSER_OF = { [CODE_C]: "code", [B_C]: "b", [I_C]: "i", [LINK_C]: "a" };

const TOPIC_LINK = /^[A-Za-z0-9._-]+\.md(#.*)?$/;
const LABELS = { Reason: "reason", "Rejected alternative": "rejected", Consequence: "consequence", Considered: "considered", "Why this needs an answer": "why-open" };
const LABEL = /^\*\*(Reason|Rejected alternative|Consequence|Considered|Why this needs an answer):\*\*\s*(.*)$/;

// Inline Markdown to a list of nodes:
//   { t: "text", v } | { t: "code"|"b"|"i", c: [...] } | { t: "a", href, external, c: [...] }
// `topicHref(file)` returns the href of a topic this page knows, or null; `file`
// is the name as written (`auth.md`), the host resolves it in the right project.
function parseInline(md, { topicHref = () => null } = {}) {
  const links = [];
  const link = (href, external) => { links.push({ href, external }); return `${LINK}${links.length - 1}${LINK_END}`; };
  let s = String(md ?? "").replace(MARKERS, "");
  s = s.replace(/`([^`]+)`/g, (m, c) => `${CODE}${c}${CODE_C}`);
  s = s.replace(/\*\*([^*]+)\*\*/g, `${B}$1${B_C}`);
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:]|$)/g, `$1${I}$2${I_C}`);
  s = s.replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s).,;:]|$)/g, `$1${I}$2${I_C}`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
    const url = u.replace(MARKERS, "");
    if (TOPIC_LINK.test(url)) { const href = topicHref(url.split("#")[0]); if (href) return `${link(href, false)}${t}${LINK_C}`; }
    if (/^https:/i.test(url) && safeUrl(url)) return `${link(url, true)}${t}${LINK_C}`; // an https address with a user, a hidden character or a backslash warns and stays text
    return `${link(null, false)}${t}${LINK_C}`; // the text stays, no target
  });
  // a bare topic name, alone or as code, becomes a link — not right after a
  // marker (a name already bold or inside a link stays as it is). The HTML
  // version excluded `"` and `>` here to keep out of attributes and tags; in
  // its escaped text a written quote or angle bracket was an entity ending in
  // `;`, which did not exclude — so here they do not either.
  s = s.replace(/(^|[^\w/#\-\uE000-\uE008])(\uE000)?([A-Za-z0-9][A-Za-z0-9._-]*\.md)(\uE001)?(?!\w)/g, (m, pre, c1, f, c2) => {
    const href = topicHref(f);
    return href ? `${pre}${link(href, false)}${c1 || ""}${f}${c2 || ""}${LINK_C}` : m;
  });
  return readMarked(s, links);
}

// The marked string to the tree, the way an HTML parser builds the tree from
// the string the page used to make. All four elements are what HTML calls
// formatting elements, and the parser's rules for them are what kept bodies
// looking as they did, so they are followed here:
// - a closer pops every element above its own and closes it; those above stay
//   "active" and are reopened, as fresh copies, before the next text or element
//   (`**x `y** z`` is <b>x <code>y</code></b><code> z</code>);
// - a closer whose element is not open is dropped, or only cancels a reopening
//   still waiting;
// - a link opened inside a link first closes the outer one, which is not
//   reopened after it: the two are siblings, never nested;
// - an opener left open is closed at the end.
function readMarked(s, links) {
  const top = { c: [] }; const stack = [top];
  let pending = []; // elements to reopen before the next content, outermost first
  let text = "";
  const copy = (n) => ({ ...n, c: [] });
  const reopen = () => { for (const d of pending) { const n = copy(d); stack[stack.length - 1].c.push(n); stack.push(n); } pending = []; };
  const flush = () => { if (text) { reopen(); stack[stack.length - 1].c.push({ t: "text", v: text }); text = ""; } };
  const close = (want) => {
    const at = stack.map((n) => n.t).lastIndexOf(want);
    if (at > 0) { const above = stack.slice(at + 1); stack.length = at; pending = [...pending, ...above]; return; }
    const p = pending.map((n) => n.t).lastIndexOf(want);
    if (p >= 0) pending.splice(p, 1);
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (OPENERS.has(ch)) {
      flush();
      let node;
      if (ch === LINK) {
        const end = s.indexOf(LINK_END, i); const l = links[Number(s.slice(i + 1, end))]; i = end;
        close("a"); // an open link is closed first, and not reopened
        pending = pending.filter((n) => n.t !== "a");
        node = { t: "a", href: l.href, external: l.external, c: [] };
      } else node = { t: ch === CODE ? "code" : ch === B ? "b" : "i", c: [] };
      reopen();
      stack[stack.length - 1].c.push(node); stack.push(node);
    } else if (CLOSER_OF[ch]) {
      flush();
      close(CLOSER_OF[ch]);
    } else text += ch;
  }
  flush();
  return top.c;
}

// Block Markdown to a list of blocks:
//   { k: "p"|"h", c } | { k: "ul"|"ol", items: [c, ...] } | { k: "pre", v } | { k: "label", kind, label, c }
function parse(md, opts = {}) {
  const inl = (t) => parseInline(t, opts);
  const out = [];
  const lines = String(md ?? "").split("\n");
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];
    if (!ln.trim()) { i++; continue; }
    if (/^\s*(```|~~~)/.test(ln)) {
      const fence = ln.trim().slice(0, 3); const buf = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) buf.push(lines[i++]);
      i++; out.push({ k: "pre", v: buf.join("\n") }); continue;
    }
    if (/^#{1,6}\s/.test(ln)) { out.push({ k: "h", c: inl(ln.replace(/^#+\s*/, "")) }); i++; continue; }
    if (/^\s*[-*]\s+/.test(ln)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*[-*]\s+/, ""); i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) item += " " + lines[i++].trim();
        items.push(inl(item));
      }
      out.push({ k: "ul", items }); continue;
    }
    if (/^\s*\d+\.\s+/.test(ln)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(inl(lines[i++].replace(/^\s*\d+\.\s+/, "")));
      out.push({ k: "ol", items }); continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^\s*(```|~~~|[-*]\s|\d+\.\s|#{1,6}\s)/.test(lines[i])) buf.push(lines[i++]);
    const para = buf.join(" ");
    const m = para.match(LABEL);
    if (m) out.push({ k: "label", kind: LABELS[m[1]], label: m[1], c: inl(m[2]) });
    else out.push({ k: "p", c: inl(para) });
  }
  return out;
}

// ---- the builder: nodes only, created in `doc`
function buildInline(doc, nodes, into) {
  for (const n of nodes) {
    if (n.t === "text") { into.appendChild(doc.createTextNode(n.v)); continue; }
    const node = doc.createElement(n.t);
    if (n.t === "a" && n.href && safeHref(n.href) != null) { // a topic's address is the host's; the backstop all the same
      node.setAttribute("href", n.href);
      if (n.external) { node.setAttribute("target", "_blank"); node.setAttribute("rel", "noopener noreferrer"); }
    }
    buildInline(doc, n.c, node);
    into.appendChild(node);
  }
  return into;
}
const element = (doc, tag, cls) => { const n = doc.createElement(tag); if (cls) n.setAttribute("class", cls); return n; };

function buildBlocks(doc, blocks, into) {
  blocks.forEach((b, n) => {
    if (n) into.appendChild(doc.createTextNode("\n")); // between blocks, as the HTML version joined them
    if (b.k === "pre") { const pre = element(doc, "pre"); const code = element(doc, "code"); code.appendChild(doc.createTextNode(b.v)); pre.appendChild(code); into.appendChild(pre); }
    else if (b.k === "h") { const p = element(doc, "p"); p.appendChild(buildInline(doc, b.c, element(doc, "b"))); into.appendChild(p); }
    else if (b.k === "ul" || b.k === "ol") { const list = element(doc, b.k); for (const it of b.items) list.appendChild(buildInline(doc, it, element(doc, "li"))); into.appendChild(list); }
    else if (b.k === "label") {
      const div = element(doc, "div", `ktw-label ktw-${b.kind}`);
      const head = element(doc, "b"); head.appendChild(doc.createTextNode(b.label));
      div.appendChild(head); div.appendChild(buildInline(doc, b.c, element(doc, "p"))); into.appendChild(div);
    } else into.appendChild(buildInline(doc, b.c, element(doc, "p")));
  });
  return into;
}

// what a host calls: a fragment of nodes for a body, or for one line of text
const render = (doc, md, opts) => buildBlocks(doc, parse(md, opts), doc.createDocumentFragment());
const renderInline = (doc, md, opts) => buildInline(doc, parseInline(md, opts), doc.createDocumentFragment());

const KTW = (root.KeepTheWhy = root.KeepTheWhy || {});
KTW.markdown = Object.freeze({ parse, parseInline, render, renderInline });
})(globalThis);
