// Parity of the DOM Markdown renderer (ktw-markdown.js) with the HTML-string renderer it
// replaced (markdown-legacy.mjs, frozen): every body, title and field value of the given
// states rendered both ways in jsdom and compared node by node.
//
//   node parity.mjs STATE.json [STATE.json ...]
//
// A state's bodies are read inline or from the state.body.json it names. Two differences are
// intended and normalised away before comparing: an external link now carries
// rel="noopener noreferrer" (was "noopener"), and a plain http:// link keeps its text but no
// longer links (only https:// does). Anything else that differs fails, with both trees shown.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { renderMarkdown, inline, setTopics } from "./markdown-legacy.mjs";

const file = new URL("../../ktw_dashboard/web/ktw-markdown.js", import.meta.url);
vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file.pathname });
const md = globalThis.KeepTheWhy.markdown;
const { window } = new JSDOM("<!doctype html><body></body>");
const doc = window.document;

function tree(node, depth = 0, out = []) {
  const pad = "  ".repeat(depth);
  for (const n of node.childNodes) {
    if (n.nodeType === 3) { if (n.textContent) out.push(pad + JSON.stringify(n.textContent)); continue; }
    if (n.nodeType !== 1) continue;
    const attrs = [...n.attributes].map((a) => `${a.name}=${JSON.stringify(a.value)}`).sort();
    out.push(`${pad}<${n.localName}${attrs.length ? " " + attrs.join(" ") : ""}>`);
    tree(n, depth + 1, out);
  }
  return out;
}
// the two intended differences, applied to the old output
function normalizeLegacy(box) {
  for (const a of box.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (/^http:\/\//.test(href)) { a.removeAttribute("href"); a.removeAttribute("target"); a.removeAttribute("rel"); }
    else if (a.getAttribute("rel") === "noopener") a.setAttribute("rel", "noopener noreferrer");
  }
  return box;
}
function oldTree(html) { const box = doc.createElement("div"); box.innerHTML = html; return tree(normalizeLegacy(box)).join("\n"); }
function newTree(frag) { const box = doc.createElement("div"); box.appendChild(frag); return tree(box).join("\n"); }

const files = process.argv.slice(2);
if (!files.length) { console.error("usage: node parity.mjs STATE.json [STATE.json ...]"); process.exit(2); }
let checked = 0; const failures = [];
for (const f of files) {
  const state = JSON.parse(fs.readFileSync(f, "utf8"));
  let bodies = null;
  if (typeof state.bodies === "string") {
    const bf = path.join(path.dirname(f), state.bodies);
    if (fs.existsSync(bf)) bodies = JSON.parse(fs.readFileSync(bf, "utf8")).bodies || {};
  }
  const topics = new Set((state.topics || []).map((t) => t.file));
  setTopics((name) => topics.has(name));
  const opts = { topicHref: (name) => (topics.has(name) ? `#topic/${name}` : null) };
  for (const e of state.entries || []) {
    const body = e.body?.text ?? (bodies ? (typeof bodies[e.id] === "object" ? bodies[e.id]?.text : bodies[e.id]) : null);
    const cases = [["body", body, true], ["title", e.title, false], ["source", e.source, false], ["verification", e.verification, false], ["revisit_when", e.revisit_when, false]];
    for (const [field, text, block] of cases) {
      if (text == null || text === "") continue;
      checked++;
      const want = oldTree(block ? renderMarkdown(text) : inline(text));
      const got = newTree(block ? md.render(doc, text, opts) : md.renderInline(doc, text, opts));
      if (want !== got) failures.push({ where: `${path.basename(path.dirname(f))}/${path.basename(f)} ${e.id} ${field}`, want, got });
    }
  }
}
for (const x of failures.slice(0, 10)) {
  const a = x.want.split("\n"), b = x.got.split("\n");
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  console.log(`DIFFERS  ${x.where} — first difference at node line ${i + 1}`);
  for (let k = Math.max(0, i - 2); k < Math.min(a.length, i + 4); k++) console.log(`  - ${a[k]}`);
  for (let k = Math.max(0, i - 2); k < Math.min(b.length, i + 4); k++) console.log(`  + ${b[k]}`);
}
console.log(`${checked} texts compared, ${failures.length} differ`);
process.exit(failures.length || !checked ? 1 : 0);
