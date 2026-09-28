/* Keep the Why dashboard — the pure part of the page: no DOM, no fetch,
   no state. Imported by app.js, inlined into an export, unit-tested with
   node:test (tests/web/lib.test.mjs). */

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const isUuid = (s) => UUID_RE.test(s || "");

// Raw-file URL of a repository file at HEAD, per host — the second and last
// place host grammar lives (the first is hostFileLink below). Public mode
// reads one file this way: a family member's .keep-the-why, for its
// dashboard-state line.
export function rawFileUrl(canonical, root, path) {
  const base = canonical.replace(/\/$/, "");
  const rel = `${root ? root.replace(/\/$/, "") + "/" : ""}${path}`;
  const gh = base.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);
  if (gh) return `https://raw.githubusercontent.com/${gh[1]}/${gh[2]}/HEAD/${rel}`;
  if (/^https:\/\/gitlab\./.test(base)) return `${base}/-/raw/HEAD/${rel}`;
  if (/^https:\/\/bitbucket\.org/.test(base)) return `${base}/raw/HEAD/${rel}`;
  return `${base}/raw/branch/HEAD/${rel}`; // Codeberg, Gitea, Forgejo
}

export const configLine = (text, key) => { const m = text.match(new RegExp(`^-\\s*${key}\\s*:\\s*(.+?)\\s*$`, "m")); return m ? m[1].replace(/^`|`$/g, "") : ""; };

// A state document from anywhere: whatever this page did not produce may be
// older or newer than it — unknown keys are ignored, missing ones blank.
export function normalizeState(s) {
  s = s && typeof s === "object" ? s : {};
  s.project = s.project && typeof s.project === "object" ? s.project : {};
  s.project.config ||= {}; s.project.children ||= []; s.project.context ||= "context/"; s.project.schema ||= "?";
  s.topics = Array.isArray(s.topics) ? s.topics : []; s.entries = Array.isArray(s.entries) ? s.entries : []; s.authors = Array.isArray(s.authors) ? s.authors : [];
  s.findings = s.findings && typeof s.findings === "object" ? s.findings : {}; s.findings.errors ||= 0; s.findings.warnings ||= 0; s.findings.items ||= [];
  for (const t of s.topics) { t.refs_out ||= []; t.refs_in ||= []; t.status ||= {}; t.evidence ||= {}; t.entries ||= 0; }
  for (const e of s.entries) { e.type ||= []; e.refs ||= []; e.see ||= []; e.findings ||= []; e.body = e.body && typeof e.body === "object" ? e.body : { text: String(e.body || ""), reason: "" }; e.body.text ||= ""; e.id ||= `${e.file || "?"}#${slug(e.title || "")}`; }
  return s;
}

export const slug = (t) => t.toLowerCase().replace(/[^\w\- ]/g, "").replace(/ /g, "-");

// The one place host URL grammar lives: a file (and heading anchor) of a
// repository as its host renders it. Everything else in Keep the Why keeps
// canonical + file + anchor apart and never bakes a host into a field.
export function hostFileLink(canonical, branch, contextDir, file, anchor) {
  if (!canonical) return null;
  const base = canonical.replace(/\/$/, "");
  const ref = encodeURIComponent(branch && branch !== "HEAD" ? branch : "HEAD");
  const path = `${contextDir || "context/"}${file}`;
  let seg;
  if (/^https:\/\/gitlab\./.test(base) || /\/-\//.test(base)) seg = `/-/blob/${ref}/`;
  else if (/^https:\/\/(codeberg\.org|gitea\.|forgejo\.)/.test(base)) seg = `/src/branch/${ref}/`;
  else if (/^https:\/\/bitbucket\.org/.test(base)) seg = `/src/${ref}/`;
  else seg = `/blob/${ref}/`; // GitHub and most GitHub-shaped forges
  return `${base}${seg}${path}${anchor ? "#" + anchor : ""}`;
}

export const canonicalOf = (p) => p?.canonical || (p?.git?.remote ? `https://${p.git.remote}` : "");

export function parseSupersededBy(value) {
  if (!value) return null;
  const v = value.trim();
  if (isUuid(v)) return { uuid: v };
  const m = v.match(/^(\S+)\s+[—–-]\s+([0-9a-f-]{36})\s+[—–-]\s+as of\s+(\d{4}-\d{2}-\d{2})$/);
  if (m) return { remote: m[1].startsWith("https://") ? m[1] : null, file: m[1].startsWith("https://") ? null : m[1].split("#")[0], locator: m[1], uuid: m[2], date: m[3] };
  const n = v.match(/^none\s*[—–-]\s*(.*)$/);
  if (n) return { none: n[1] };
  return { text: v };
}

export const kindLabel = (k) => k === "cache" ? "cache, read only" : k === "repository" ? "repository, read and write" : k === "public" ? "published export" : "not available here";

// Families in a project list: every row with its depth, a parent first and
// its children under it. A child names its parent by canonical (the parent's
// working tree wins over its cache) or by a path relative to its own
// directory; a row whose parent is not in the list is a root.
export function groupByFamily(list) {
  const parentOf = (p) => {
    if (!p.parent || !p.path) return null;
    if (p.parent.startsWith("https://")) return list.find((x) => x.path && x.canonical === p.parent && x.kind === "repository") || list.find((x) => x.path && x.canonical === p.parent) || null;
    const abs = new URL(p.parent + "/", "file://" + p.path.replace(/\/?$/, "/")).pathname.replace(/\/$/, "");
    return list.find((x) => x.path === abs) || null;
  };
  const kids = new Map(); const tops = [];
  for (const p of list) { const par = parentOf(p); if (par && par.key !== p.key) { if (!kids.has(par.key)) kids.set(par.key, []); kids.get(par.key).push(p); } else tops.push(p); }
  const flat = []; const seen = new Set();
  const walk = (p, d) => { if (seen.has(p.key)) return; seen.add(p.key); flat.push([p, d]); for (const c of kids.get(p.key) || []) walk(c, d + 1); };
  for (const p of tops) walk(p, 0);
  for (const p of list) walk(p, 0); // a cycle would otherwise drop rows
  return flat;
}

// Search. A query is a set of terms, all of which must occur somewhere in the
// entry: its title, body, Revisit when, Source, Id, file, type, status or
// evidence. The hit says how strong it is (terms in the title, occurrences in
// total) and where the snippet comes from: the first field after the title
// that carries a term, or the title when no other field does.
export const searchTerms = (query) => String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
// the body without its field lines: those are searched as their own fields
const FIELD_LINE = /^\*\*(Id|Type|Status|Evidence|Source|Verification|Revisit when|See|Superseded by):\*\*/;
export const bodyProse = (text) => String(text || "").split("\n").filter((l) => !FIELD_LINE.test(l.trim())).join("\n").trim();
export function searchHit(e, query) {
  const terms = searchTerms(query);
  if (!terms.length) return null;
  const fields = [["title", e.title || ""], ["body", bodyProse(e.body?.text)], ["revisit when", e.revisit_when || ""], ["source", e.source || ""],
    ["verification", e.verification || ""], ["superseded by", e.superseded_by || ""],
    ["id", e.uuid || ""], ["file", e.file || ""], ["type", (e.type || []).join(" ")], ["status", e.status || ""], ["evidence", e.evidence || ""]]
    .map(([name, text]) => ({ name, text, low: text.toLowerCase() }));
  if (!terms.every((t) => fields.some((f) => f.low.includes(t)))) return null;
  let count = 0;
  for (const t of terms) for (const f of fields) for (let i = f.low.indexOf(t); i >= 0; i = f.low.indexOf(t, i + t.length)) count++;
  const inTitle = terms.filter((t) => fields[0].low.includes(t)).length;
  let where = null;
  for (const f of [...fields.slice(1), fields[0]]) {
    const at = terms.map((t) => [f.low.indexOf(t), t]).filter(([i]) => i >= 0).sort((a, b) => a[0] - b[0])[0];
    if (at) { where = { field: f.name, text: f.text, i: at[0], len: at[1].length }; break; }
  }
  return { terms, count, inTitle, where };
}
// best first: more terms in the title, then more occurrences
export const compareHits = (a, b) => (b.inTitle - a.inTitle) || (b.count - a.count);
// the text around a hit, whitespace collapsed, cut marks where it was cut
export function snippetAt(text, i, len, before = 60, after = 160) {
  const from = Math.max(0, i - before); const to = Math.min(text.length, i + len + after);
  return (from > 0 ? "…" : "") + text.slice(from, to).replace(/\s+/g, " ").trim() + (to < text.length ? "…" : "");
}
// HTML-escaped text with every term marked, case-insensitively
export function highlight(text, terms) {
  const ts = (terms || []).filter(Boolean);
  const s = String(text ?? "");
  if (!ts.length) return esc(s);
  const re = new RegExp([...ts].sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi");
  let out = ""; let at = 0;
  for (const m of s.matchAll(re)) { out += esc(s.slice(at, m.index)) + `<mark>${esc(m[0])}</mark>`; at = m.index + m[0].length; }
  return out + esc(s.slice(at));
}

// A family location as the published side reads it: an https URL is another
// repository (its own root), a relative path is a directory in the same
// repository, resolved against the root the location was read from.
export function resolveLocation(location, canonical, root = "") {
  if (!location) return null;
  if (/^https:\/\//.test(location)) return { canonical: location.replace(/\/+$/, ""), root: "" };
  if (!canonical) return null;
  const parts = [];
  for (const seg of `${root}/${location}`.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") { if (!parts.length) return null; parts.pop(); } else parts.push(seg);
  }
  return { canonical, root: parts.join("/") };
}
