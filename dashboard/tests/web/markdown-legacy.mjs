// The page's Markdown renderer as it was until dashboard 0.11.18, when it built HTML strings
// (app.js, `inline` and `renderMarkdown`). Kept here, frozen, as the oracle the DOM renderer
// (ktw-markdown.js) is compared against in parity.mjs; it is not part of the package.
// `topicOf(file)` stands in for the page's lookup of a topic it knows.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let topicOf = () => null;
export function setTopics(fn) { topicOf = fn; }
export function inline(md) {
  let s = esc(md);
  s = s.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:]|$)/g, "$1<i>$2</i>");
  s = s.replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s).,;:]|$)/g, "$1<i>$2</i>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
    if (/^[A-Za-z0-9._-]+\.md(#.*)?$/.test(u) && topicOf((u.split("#")[0]))) return `<a href="#topic/${(u.split("#")[0])}">${t}</a>`;
    if (/^https?:\/\//.test(u)) return `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
    return `<a>${t}</a>`;
  });
  // bare topic references become links
  s = s.replace(/(^|[^\w/">#-])(<code>)?([A-Za-z0-9][A-Za-z0-9._-]*\.md)(<\/code>)?(?![\w"])/g, (m, pre, c1, f, c2) =>
    topicOf((f)) ? `${pre}<a href="#topic/${(f)}">${c1 || ""}${f}${c2 || ""}</a>` : m);
  return s;
}
export function renderMarkdown(md) {
  const out = [];
  const lines = md.split("\n");
  let i = 0;
  const LABEL = /^\*\*(Reason|Rejected alternative|Consequence|Considered|Why this needs an answer):\*\*\s*(.*)$/;
  const cls = { Reason: "reason", "Rejected alternative": "rejected", Consequence: "consequence", Considered: "considered", "Why this needs an answer": "why-open" };
  while (i < lines.length) {
    const ln = lines[i];
    if (!ln.trim()) { i++; continue; }
    if (/^\s*(```|~~~)/.test(ln)) {
      const fence = ln.trim().slice(0, 3); const buf = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) buf.push(lines[i++]);
      i++; out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`); continue;
    }
    if (/^#{1,6}\s/.test(ln)) { out.push(`<p><b>${inline(ln.replace(/^#+\s*/, ""))}</b></p>`); i++; continue; }
    if (/^\s*[-*]\s+/.test(ln)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*[-*]\s+/, ""); i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) item += " " + lines[i++].trim();
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push(`<ul>${items.join("")}</ul>`); continue;
    }
    if (/^\s*\d+\.\s+/.test(ln)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(`<li>${inline(lines[i++].replace(/^\s*\d+\.\s+/, ""))}</li>`);
      out.push(`<ol>${items.join("")}</ol>`); continue;
    }
    // paragraph (until blank line); labelled paragraphs get a callout
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^\s*(```|~~~|[-*]\s|\d+\.\s|#{1,6}\s)/.test(lines[i])) buf.push(lines[i++]);
    const para = buf.join(" ");
    const m = para.match(LABEL);
    if (m) out.push(`<div class="label ${cls[m[1]]}"><b>${m[1]}</b><p>${inline(m[2])}</p></div>`);
    else out.push(`<p>${inline(para)}</p>`);
  }
  return out.join("\n");
}

