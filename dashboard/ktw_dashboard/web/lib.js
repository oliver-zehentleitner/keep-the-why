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

// A Type value as a name: `undefined — <reason>` is counted and shown as
// `undefined`; the reason stays on the entry (the pill's tooltip, the details pane).
export const typeName = (t) => String(t ?? "").split(/\s+[—–-]\s+/)[0].trim();

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

// Friends: the repositories that `entries` cite by a cross-project See or
// Superseded by, minus the canonicals in `exclude` (this project, its
// family). One row per repository with the Ids cited there, sorted by
// canonical. Derived from the entries alone — nothing is fetched here.
export function friendsOf(entries, exclude = []) {
  const norm = (c) => String(c || "").replace(/\/+$/, "").toLowerCase();
  const skip = new Set(exclude.filter(Boolean).map(norm));
  const out = new Map();
  const add = (canonical, uuid) => {
    if (!canonical || !uuid || skip.has(norm(canonical))) return;
    const k = norm(canonical);
    if (!out.has(k)) out.set(k, { canonical: String(canonical).replace(/\/+$/, ""), uuids: [] });
    const f = out.get(k); if (!f.uuids.includes(uuid)) f.uuids.push(uuid);
  };
  for (const e of entries || []) {
    for (const r of e.see || []) if (r?.remote) add(r.remote, r.uuid);
    const s = e.superseded_by ? parseSupersededBy(e.superseded_by) : null;
    if (s?.remote) add(s.remote, s.uuid);
  }
  return [...out.values()].sort((a, b) => a.canonical.localeCompare(b.canonical));
}

// Thoughts: lines of reasoning through the graph. `edges` are [from, to]
// pairs of entry ids, one per See or Superseded by: `from` cites `to`, so
// `to` came first. A thought is a
// longest chain of such citations with at least `min` entries, returned in
// reading order (origin first), never a part of a longer one. Enumeration
// stops at `cap` chains, so a dense web cannot hang the page.
export function thoughtsOf(edges, min = 4, cap = 2000) {
  const out = new Map();
  for (const [a, b] of edges) { if (a === b) continue; if (!out.has(a)) out.set(a, new Set()); out.get(a).add(b); }
  const cited = new Set(edges.map(([, b]) => b));
  const found = []; let budget = cap;
  const walk = (n, path, seen) => {
    if (budget <= 0) return;
    let longer = false;
    for (const m of out.get(n) || []) if (!seen.has(m)) { longer = true; seen.add(m); path.push(m); walk(m, path, seen); path.pop(); seen.delete(m); }
    if (!longer && path.length >= min) { found.push([...path].reverse()); budget--; }
  };
  // start where nothing cites the entry (the newest end); a web that is all cycles starts everywhere
  const starts = [...out.keys()].filter((n) => !cited.has(n));
  for (const n of starts.length ? starts : [...out.keys()]) walk(n, [n], new Set([n]));
  const key = (p) => "\u0000" + p.join("\u0000") + "\u0000";
  const keys = found.map(key);
  const kept = found.filter((p, i) => !keys.some((k, j) => j !== i && k.length > keys[i].length && k.includes(keys[i])));
  const uniq = [...new Map(kept.map((p) => [key(p), p])).values()];
  return uniq.sort((a, b) => b.length - a.length || a.join().localeCompare(b.join()));
}

// What a thought rests on and how it grew. `steps` are its entries in reading
// order (origin first), `kinds[i]` the link from step i to step i + 1 ("see":
// the later cites the earlier; "superseded": the later replaced it).
// - weakOrigin: the origin's Evidence when it is `inferred` or `unknown` — the
//   whole line rests on a reason nobody confirmed;
// - shaky: steps a later one builds on although they are in question — open,
//   needs-review, pending-confirmation — or superseded yet still cited (a See
//   to a replaced decision; a Superseded by is how an evolution goes on);
// - affected: every step after the first shaky one, which rests on it;
// - from, to: the first and last day a step was created (Git), when known.
export const SHAKY = ["open", "needs-review", "pending-confirmation"];
export function thoughtInsights(steps, kinds = []) {
  const weakOrigin = ["inferred", "unknown"].includes(steps[0]?.evidence) ? steps[0].evidence : null;
  const shaky = [];
  steps.forEach((e, i) => {
    if (SHAKY.includes(e?.status)) shaky.push({ i, why: e.status });
    else if (e?.status === "superseded" && i < steps.length - 1 && kinds[i] === "see") shaky.push({ i, why: "superseded, still cited" });
  });
  const affected = shaky.length ? steps.map((_, i) => i).filter((i) => i > shaky[0].i) : [];
  const days = steps.map((e) => e?.git?.created?.date || "").filter(Boolean).sort();
  return { weakOrigin, shaky, affected, from: days[0] || "", to: days[days.length - 1] || "" };
}

// The family graph's structure. `groups` are the projects in it, each
// { key, canonical, root, role, state }. Returns
//   parentOf: key -> the key of the project its parent line names (when that
//             project is in the graph), from canonical and root; the roles
//             self/parent/child are the fallback when a canonical is missing
//   xrefs:    every See and Superseded by between two entries in the graph,
//             across projects or within one, found by Id
export function linkFamily(groups) {
  const norm = (c) => String(c || "").replace(/\.git$/, "").replace(/\/+$/, "");
  const at = new Map(groups.filter((g) => g.canonical).map((g) => [`${norm(g.canonical)}|${g.root || ""}`, g.key]));
  const parentOf = {};
  for (const g of groups) {
    const p = g.state?.project?.parent;
    if (!p) continue;
    const loc = resolveLocation(p, norm(g.canonical), g.root || "");
    const hit = loc ? at.get(`${norm(loc.canonical)}|${loc.root}`) : undefined;
    if (hit && hit !== g.key) parentOf[g.key] = hit;
  }
  const self = groups.find((g) => g.role === "self");
  const parent = groups.find((g) => g.role === "parent");
  if (self && parent && !parentOf[self.key]) parentOf[self.key] = parent.key;
  if (self) for (const g of groups) if (g.role === "child" && !parentOf[g.key]) parentOf[g.key] = self.key;
  const byUuid = new Map();
  for (const g of groups) for (const e of g.state?.entries || []) if (e.uuid) byUuid.set(e.uuid, { key: g.key, id: e.id });
  const xrefs = []; const seen = new Set();
  const push = (from, uuid, kind) => {
    const to = uuid && byUuid.get(uuid);
    if (!to || (to.key === from.key && to.id === from.id)) return;
    const k = `${from.key}|${from.id}|${to.key}|${to.id}|${kind}`;
    if (seen.has(k)) return; seen.add(k);
    xrefs.push({ from, to, kind });
  };
  for (const g of groups) for (const e of g.state?.entries || []) {
    const from = { key: g.key, id: e.id };
    for (const r of e.see || []) push(from, r?.uuid, "see");
    if (e.superseded_by) push(from, parseSupersededBy(e.superseded_by)?.uuid, "superseded");
  }
  return { parentOf, xrefs };
}

// A Git author's profile on the host, looked up from one of their commits:
// the host's API names the account behind a commit, which the name and email
// in Git do not. Returns { api, pick(json) -> profile URL | null, fallback }
// — the fallback is the commit's own page, where the host links the author.
// null when the canonical names no host this knows or there is no commit.
export function authorLookup(canonical, sha) {
  const m = String(canonical || "").replace(/\.git$/, "").replace(/\/+$/, "").match(/^https:\/\/([^/]+)\/(.+?)\/([^/]+)$/);
  if (!m || !sha || !/^[0-9a-f]{4,40}$/.test(sha)) return null;
  const [, host, owner, repo] = m;
  const base = `https://${host}/${owner}/${repo}`;
  if (host === "github.com") return { api: `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`, pick: (j) => j?.author?.html_url || null, fallback: `${base}/commit/${sha}` };
  if (host === "bitbucket.org") return { api: `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/commit/${sha}`, pick: (j) => j?.author?.user?.links?.html?.href || null, fallback: `${base}/commits/${sha}` };
  if (/^gitlab\./.test(host)) return { api: null, pick: () => null, fallback: `${base}/-/commit/${sha}` }; // GitLab's commit API names no account
  return { api: `https://${host}/api/v1/repos/${owner}/${repo}/git/commits/${sha}`, pick: (j) => (j?.author?.login ? `https://${host}/${j.author.login}` : null), fallback: `${base}/commit/${sha}` }; // Codeberg, Gitea, Forgejo
}

// The family as one state: every member's topics and entries, authors and
// linter findings in one document the page renders like a single project.
// `groups` are [{ member, state }], this project first; its files and ids
// keep their names, a member's are prefixed with the member's name, so the
// same `history.md` in two projects stays two topics. Every topic and entry
// carries `project` (null for this project) and `origin` (its group).
export function mergeStates(groups) {
  const self = groups[0]?.state || {};
  const pre = (P, f) => (P ? `${P}/${f}` : f);
  const out = { ...self, merged: true, family: groups.map((G) => ({ name: G.member.name, role: G.member.role, project: G.member.role === "self" ? null : G.member.name })), topics: [], entries: [], authors: [], findings: { errors: 0, warnings: 0, items: [] } };
  const authors = new Map();
  for (const G of groups) {
    const st = G.state || {}; const P = G.member.role === "self" ? null : G.member.name;
    for (const t of st.topics || []) out.topics.push({ ...t, file: pre(P, t.file), refs_out: (t.refs_out || []).map((f) => pre(P, f)), refs_in: (t.refs_in || []).map((f) => pre(P, f)), project: P, origin: G, localFile: t.file });
    for (const e of st.entries || []) out.entries.push({ ...e, id: pre(P, e.id), file: pre(P, e.file), refs: (e.refs || []).map((f) => pre(P, f)), project: P, origin: G, localId: e.id, localFile: e.file });
    for (const a of st.authors || []) {
      const cur = authors.get(a.name);
      if (!cur) { authors.set(a.name, { ...a, evidence: { ...(a.evidence || {}) }, projects: [P] }); continue; }
      for (const k of ["created", "touched", "superseded"]) cur[k] = (cur[k] || 0) + (a[k] || 0);
      for (const [k, v] of Object.entries(a.evidence || {})) cur.evidence[k] = (cur.evidence[k] || 0) + v;
      if (a.first && (!cur.first || a.first < cur.first)) cur.first = a.first;
      if (a.last && (!cur.last || a.last > cur.last)) cur.last = a.last;
      cur.projects.push(P);
    }
    const f = st.findings || {};
    out.findings.errors += f.errors || 0; out.findings.warnings += f.warnings || 0;
    for (const x of f.items || []) out.findings.items.push({ ...x, path: pre(P, x.path), project: P, localPath: x.path });
  }
  out.authors = [...authors.values()].sort((a, b) => (b.created || 0) - (a.created || 0) || String(a.name).localeCompare(String(b.name)));
  out.anonymized = groups.some((G) => G.state?.anonymized);
  return out;
}
