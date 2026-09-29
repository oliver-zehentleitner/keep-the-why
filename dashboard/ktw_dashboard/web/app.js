/* Keep the Why dashboard — plain modules (this and lib.js), no dependencies.
   The page knows only the state (see state.py): live from /api/events, or
   embedded as window.__KTW_STATE__ in an export. It renders; it never writes. */

import { esc, plural, typeName, UUID_RE, isUuid, rawFileUrl, configLine, normalizeState, slug, hostFileLink, canonicalOf, parseSupersededBy, kindLabel, groupByFamily, searchTerms, searchHit, compareHits, snippetAt, highlight, resolveLocation, linkFamily, authorLookup, mergeStates, friendsOf, thoughtsOf, thoughtInsights } from "./lib.js";

const $ = (sel, root = document) => root.querySelector(sel);
const narrow = () => !!window.matchMedia?.("(max-width: 900px)").matches;
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
  return n;
};
const setKids = (node, ...kids) => node.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
const fmtDate = (d) => d || "—";
const remoteLink = (remote) => el("a", { class: "gh", href: `https://${remote}`, target: "_blank", rel: "noopener" }, remote);
const onGitHub = (g) => !!g?.remote && /^github\.com\//.test(g.remote);
const schemaPill = (p) => el("span", { class: "pill" }, el("a", { class: "gh", href: `https://github.com/oliver-zehentleitner/keep-the-why/releases/tag/v${p.schema}`, target: "_blank", rel: "noopener", title: `context-schema ${p.schema} — the Keep the Why release this context/ was last checked against` }, `schema ${p.schema}`));
const headPill = (g) => {
  if (!g?.available) return null;
  const branch = g.branch && g.branch !== "HEAD" ? g.branch : null;
  if (!onGitHub(g)) return el("span", { class: "pill", title: g.remote || "" }, `${branch || "detached"}@${g.head}`);
  const base = `https://${g.remote}`;
  return el("span", { class: "pill", title: "branch and commit on GitHub" },
    branch ? el("a", { class: "gh", href: `${base}/tree/${encodeURIComponent(branch)}`, target: "_blank", rel: "noopener" }, branch) : "detached", "@",
    el("a", { class: "gh", href: `${base}/commit/${g.head_full || g.head}`, target: "_blank", rel: "noopener", title: g.head_full || g.head }, g.head));
};
// The centre: the project the page shows. Read from the URL when the page
// loads; a walk to a friend or back along the path changes it in place
// (setCentre), without a reload — see "path" below.
let PUBLIC = new URLSearchParams(location.search).get("public"); // a canonical: browse that project's published export
let PUBLIC_ROOT = new URLSearchParams(location.search).get("root") || "";
let MODE = PUBLIC ? "public" : window.__KTW_STATE__ ? "export" : "live";
const LIVE = () => MODE === "live";
// A static page (an export on a docs site, on a phone) is public by nature: it
// has no machine to read, so it has no local/public switch, and its family —
// like public mode's — comes from the members' published exports, fetched
// when someone asks for the family, never before.
const STATIC = !!window.__KTW_STATE__;
const PUBLISHED = () => MODE === "public" || MODE === "export";
const MY_ROOT = () => (MODE === "export" ? SELF?.project?.root || "" : PUBLIC_ROOT);
const PUBLIC_STATES = {}; // `${canonical}|${root}` -> Promise<{state, url} | {error}>, one fetch per project however many ask at once
// A published file of another project: whoever owns that repository chose the
// URL, so no referrer and no credentials go with the request, a slow host
// times out, and an oversized answer is refused before it is parsed.
const FOREIGN_TIMEOUT_MS = 10000, FOREIGN_MAX_BYTES = 20 * 1024 * 1024;
async function fetchForeign(url) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), FOREIGN_TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    if (Number(res.headers?.get?.("content-length") || 0) > FOREIGN_MAX_BYTES) throw new Error(`${url} is larger than ${FOREIGN_MAX_BYTES / 1024 / 1024} MB`);
    const text = await res.text();
    if (text.length > FOREIGN_MAX_BYTES) throw new Error(`${url} is larger than ${FOREIGN_MAX_BYTES / 1024 / 1024} MB`);
    return text;
  } catch (err) { throw err?.name === "AbortError" ? new Error(`${url} did not answer within ${FOREIGN_TIMEOUT_MS / 1000} s`) : err; }
  finally { clearTimeout(timer); }
}
const sameCanonical = (a, b) => String(a || "").replace(/\/+$/, "").toLowerCase() === String(b || "").replace(/\/+$/, "").toLowerCase();
function fetchPublicState(canonical, root = "") {
  const key = `${canonical}|${root}`;
  return (PUBLIC_STATES[key] ||= loadPublicState(canonical, root));
}
async function loadPublicState(canonical, root) {
  let result;
  const raw = rawFileUrl(canonical, root, ".keep-the-why");
  try {
    const url = configLine(await fetchForeign(raw), "dashboard-state");
    if (!url) result = { error: `no dashboard-state line in the published .keep-the-why (${raw}) — this project has no published export yet`, raw, missingLine: true };
    else if (!/^https:\/\//.test(url)) result = { error: `dashboard-state is not an https URL: ${url}`, raw };
    else {
      const state = normalizeState(JSON.parse(await fetchForeign(url)));
      // an export names the project it was made from; one that claims another repository is not shown as this one
      const claimed = state.project?.canonical;
      if (claimed && !sameCanonical(claimed, canonical)) result = { error: `the export at ${url} belongs to ${claimed}, not to ${canonical}`, raw };
      else result = { state, url, canonical, root, raw };
    }
  } catch (err) { result = { error: `could not fetch the export (${err?.message || "network or CORS refused"})`, raw }; }
  return result;
}
const publicHref = (canonical, root = "", hash = "#overview") => `${location.pathname}?public=${encodeURIComponent(canonical)}${root ? `&root=${encodeURIComponent(root)}` : ""}${hash}`;

// ---------------------------------------------------------------- state
let S = null; // what the page shows: this project, or with the family scope the whole family merged (lib.js, mergeStates)
let SELF = null; // this project's own state, always
let PROJECT = new URLSearchParams(location.search).get("project"); // null: the server's selected one
const api = (path) => PROJECT ? `${path}?project=${encodeURIComponent(PROJECT)}` : path;
let filter = { status: "", evidence: "", author: "" };
let selected = null; // entry id shown in the details pane
const byId = () => Object.fromEntries(S.entries.map((e) => [e.id, e]));
const byUuid = () => Object.fromEntries(S.entries.filter((e) => e.uuid).map((e) => [e.uuid, e]));
// an entry's address is its Id, so a copied link survives a renamed heading or a moved entry; file#anchor only without one
const entryHref = (e) => `#entry/${encodeURIComponent(e.uuid || e.id)}`;
const entryOf = (ref) => byId()[ref] || (isUuid(ref) ? byUuid()[ref] : null);
const topicOf = (file) => S.topics.find((t) => t.file === file);
const entriesOf = (file) => S.entries.filter((e) => e.file === file);
const authorOf = (e) => e.git?.created?.author || e.git?.last_touched?.author || "";
const matches = (e) =>
  (!filter.status || e.status === filter.status) &&
  (!filter.evidence || e.evidence === filter.evidence) &&
  (!filter.author || authorOf(e) === filter.author || e.git?.last_touched?.author === filter.author);
const filterActive = () => !!(filter.status || filter.evidence || filter.author);
const queues = () => ({
  open: S.entries.filter((e) => e.status === "open"),
  "needs-review": S.entries.filter((e) => e.status === "needs-review"),
  "pending-confirmation": S.entries.filter((e) => e.status === "pending-confirmation"),
  // Evidence is its own axis (Core rule 5): an open question with an untraced origin counts here and under open
  unknown: S.entries.filter((e) => e.evidence === "unknown" && e.status !== "superseded"),
  revisit: S.entries.filter((e) => e.revisit_when && e.status !== "superseded"),
});
// every entry that needs a person, once — an entry can wait in two queues
const queueTotal = () => { const q = queues(); return new Set([...q.open, ...q["needs-review"], ...q["pending-confirmation"], ...q.unknown]).size; };

// ---------------------------------------------------------------- markdown (small, safe)
// a merged member's entry names its own project's topic files: resolve them there
let INLINE_PROJECT = null;
const inProject = (f) => (INLINE_PROJECT ? `${INLINE_PROJECT}/${f}` : f);
function inline(md) {
  let s = esc(md);
  s = s.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:]|$)/g, "$1<i>$2</i>");
  s = s.replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s).,;:]|$)/g, "$1<i>$2</i>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
    if (/^[A-Za-z0-9._-]+\.md(#.*)?$/.test(u) && topicOf(inProject(u.split("#")[0]))) return `<a href="#topic/${inProject(u.split("#")[0])}">${t}</a>`;
    if (/^https?:\/\//.test(u)) return `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
    return `<a>${t}</a>`;
  });
  // bare topic references become links
  s = s.replace(/(^|[^\w/">#-])(<code>)?([A-Za-z0-9][A-Za-z0-9._-]*\.md)(<\/code>)?(?![\w"])/g, (m, pre, c1, f, c2) =>
    topicOf(inProject(f)) ? `${pre}<a href="#topic/${inProject(f)}">${c1 || ""}${f}${c2 || ""}</a>` : m);
  return s;
}
function renderMarkdown(md) {
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

// ---------------------------------------------------------------- shared bits
const pill = (text, cls = "") => el("span", { class: `pill ${cls}` }, text);
const statusPill = (s) => pill(s || "—", `status-${s}`);
const evPill = (e) => pill(e || "—", `ev-${e}`);
const typePills = (types) => (types?.length ? types : ["—"]).map((t) => { const p = pill(typeName(t), "type"); if (t !== typeName(t)) p.title = t; return p; });
const entryPills = (e) => [...typePills(e.type), statusPill(e.status), evPill(e.evidence)];
function bars(counts, order, clsPrefix = "") {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const keys = [...order.filter((k) => k in counts), ...Object.keys(counts).filter((k) => !order.includes(k))];
  return el("div", { class: "bars" }, keys.map((k) => [
    el("span", { class: "k" }, k || "(none)"),
    el("div", { class: "bar" }, el("i", { class: `${clsPrefix}${k}`, style: `width:${(100 * counts[k]) / total}%` })),
    el("span", { class: "v" }, counts[k]),
  ]));
}
function stack(counts, order) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return el("div", { class: "stack" }, order.filter((k) => counts[k]).map((k) => el("i", { style: `width:${(100 * counts[k]) / total}%;background:var(--${k})`, title: `${k}: ${counts[k]}` })));
}
const count = (list, key) => list.reduce((m, e) => ((m[e[key] || ""] = (m[e[key] || ""] || 0) + 1), m), {});
const typeCounts = (list) => list.reduce((m, e) => { for (const t of e.type?.length ? e.type.map(typeName) : ["(none)"]) m[t] = (m[t] || 0) + 1; return m; }, {});
const STATUS_ORDER = ["active", "open", "needs-review", "pending-confirmation", "superseded"];
const EV_ORDER = ["confirmed", "inferred", "unknown"];
const entryLink = (e, extra = "") => el("a", { href: entryHref(e), class: extra }, e.title);
const projectOf = (x) => (x?.project ? x.project : null); // a merged family member's name, null for this project
function entryRow(e) {
  const snippet = e.body.reason || e.body.text.split("\n")[0] || "";
  const g = e.git;
  return el("a", { href: entryHref(e), class: `row ${matches(e) ? "" : "dim"}` },
    el("div", { class: "rt" }, el("span", { html: inline(e.title) }), ...entryPills(e)),
    el("div", { class: "rs" }, snippet.replace(/\*\*|`/g, "")),
    el("div", { class: "rm" }, [projectOf(e), topicOf(e.file)?.title || e.file, g?.created?.author ? `${g.created.author} · ${g.created.date}` : null, g?.last_touched?.date && g.last_touched.date !== g?.created?.date ? `touched ${g.last_touched.date}` : null].filter(Boolean).join("  ·  ")));
}


// ---------------------------------------------------------------- global strip (numbers on every view)
function renderStrip() {
  const q = queues(); const s = $("#strip"); s.replaceChildren();
  const stat = (label, n, href, cls = "", title = "") => el("a", { class: `stat ${cls} ${n ? "" : "zero"}`, href, title }, el("b", {}, n), label);
  const f = S.findings;
  s.append(
    stat("entries", S.entries.length, "#overview"), stat("topics", S.topics.length, "#overview"), stat("authors", S.authors.length, "#authors"),
    el("span", { class: "sep" }), el("span", { class: "lbl" }, "needs a person"),
    stat("open", q.open.length, "#queues", "q-open"), stat("needs review", q["needs-review"].length, "#queues", "q-needs-review"),
    stat("pending", q["pending-confirmation"].length, "#queues", "q-pending-confirmation"), stat("unknown evidence", q.unknown.length, "#queues", "q-unknown"),
    stat("revisit-when", q.revisit.length, "#queues", "", "Revisit-when triggers on record"),
    el("span", { class: "sep" }), el("span", { class: "lbl" }, "lint"),
    stat("errors", f.errors, "#findings", f.errors ? "lint-bad hot" : "lint-ok", `keep-the-why-lint ${S.linter}`),
    stat("warnings", f.warnings, "#findings", f.warnings ? "lint-warn" : "lint-ok", `keep-the-why-lint ${S.linter}`),
  );
}
function viewFindings(main) {
  const f = S.findings;
  main.append(el("h1", {}, "Linter findings"), el("p", { class: "sub" }, `keep-the-why-lint ${S.linter} · ${f.errors} error(s), ${f.warnings} warning(s) · structure only, never content`));
  if (!f.items.length) return main.append(el("p", { class: "center" }, "Clean — nothing to show."));
  main.append(el("div", { class: "table-wrap" }, el("table", { class: "t findings" }, el("thead", {}, el("tr", {}, ["Severity", "Code", "Where", "Message"].map((h) => el("th", {}, h)))),
    el("tbody", {}, f.items.map((x) => {
      const entry = S.entries.find((e) => (e.project || null) === (x.project || null) && `${(e.origin?.state?.project || S.project).context}${e.localFile || e.file}` === (x.localPath || x.path) && e.line <= x.line && x.line <= e.end_line + 1);
      return el("tr", {}, el("td", {}, pill(x.severity, `sev-${x.severity}`)), el("td", { class: "mono" }, x.code),
        el("td", { class: "mono" }, entry ? el("a", { href: entryHref(entry) }, `${x.path}:${x.line}`) : `${x.path}${x.line ? ":" + x.line : ""}`), el("td", {}, x.message));
    })))));
}

// ---------------------------------------------------------------- sidebar
function renderSidebar() {
  const tree = $("#tree");
  tree.replaceChildren();
  const openState = JSON.parse(sessionStorage.getItem("ktw-tree") || "{}");
  let lastProject;
  for (const t of S.topics) {
    if (S.merged && t.project !== lastProject) { lastProject = t.project; tree.append(el("div", { class: "tree-project" }, t.project || (SELF.project.name || SELF.project.id))); }
    const list = entriesOf(t.file);
    const d = el("details", { open: openState[t.file] ?? (S.topics.length <= 6) });
    d.addEventListener("toggle", () => { openState[t.file] = d.open; sessionStorage.setItem("ktw-tree", JSON.stringify(openState)); });
    d.append(el("summary", { "data-file": t.file, onclick: (ev) => { if (ev.target.closest(".tw")) return; ev.preventDefault(); location.hash = `#topic/${t.file}`; d.open = true; } },
      el("span", { class: "tw" }, "▶"), el("span", { class: "tt" }, t.title), el("span", { class: "count" }, list.length)));
    for (const e of list) d.append(el("a", { href: entryHref(e), class: `leaf ${matches(e) ? "" : "dim"}`, "data-id": e.id, title: e.title },
      el("i", { class: `dot ${e.evidence} ${e.status}` }), el("span", {}, e.title.replace(/`/g, ""))));
    tree.append(d);
  }
  $("#tree-count").textContent = `${S.topics.length} · ${plural(S.entries.length, "entry").replace("entrys", "entries")}`;
  $("#queue-count").textContent = queueTotal() || "";
  // filters
  const fill = (id, key, values, label) => {
    const sel = $(id); const cur = filter[key];
    sel.replaceChildren(el("option", { value: "" }, `${label}: all`), ...values.map((v) => el("option", { value: v, selected: v === cur }, v)));
    sel.classList.toggle("set", !!cur);
    sel.onchange = () => { filter[key] = sel.value; rerender(); };
  };
  fill("#f-status", "status", STATUS_ORDER.filter((s) => S.entries.some((e) => e.status === s)), "status");
  fill("#f-evidence", "evidence", EV_ORDER.filter((s) => S.entries.some((e) => e.evidence === s)), "evidence");
  fill("#f-author", "author", S.authors.map((a) => a.name), "author");
  $("#f-clear").hidden = !filterActive();
  $("#f-clear").onclick = () => { filter = { status: "", evidence: "", author: "" }; rerender(); };
  markActive();
}
function markActive() {
  const route = location.hash.slice(1) || "overview";
  for (const a of document.querySelectorAll(".nav a")) a.classList.toggle("active", route.startsWith(a.dataset.route));
  const entry = route.startsWith("entry/") ? entryOf(decodeURIComponent(route.slice(6))) : null;
  const file = route.startsWith("topic/") ? route.slice(6) : entry?.file || null;
  for (const s of document.querySelectorAll(".tree summary")) s.classList.toggle("active", s.dataset.file === file && route.startsWith("topic/"));
  for (const a of document.querySelectorAll(".tree .leaf")) a.classList.toggle("active", !!entry && a.dataset.id === entry.id);
  if (file) { const d = document.querySelector(`.tree summary[data-file="${CSS.escape(file)}"]`)?.parentElement; if (d) d.open = true; }
  document.querySelector(".tree .leaf.active")?.scrollIntoView?.({ block: "nearest" });
}

// ---------------------------------------------------------------- views
function viewOverview(main) {
  const list = S.entries;
  const p = S.project; const g = p.git;
  if (S.merged) main.append(el("div", { class: "family-banner" }, el("b", {}, `Family · ${plural(S.family.length, "project")}`), " — ",
    S.family.map((m, i) => [i ? " · " : "", m.project ? el("span", {}, m.project, el("span", { class: "note" }, ` ${S.entries.filter((e) => e.project === m.project).length}`)) : el("span", {}, m.name, el("span", { class: "note" }, ` ${S.entries.filter((e) => !e.project).length}`))]),
    S.missing?.length ? el("span", { class: "warn" }, ` · ${plural(S.missing.length, "member")} not available here`) : null));
  main.append(
    el("h1", {}, p.id || p.name),
    el("p", { class: "sub" }, `${p.context} · schema ${p.schema} · ${p.config["capture-confirmation"] || "?"} · source-reference ${p.config["source-reference"] || "?"}`,
      g?.available ? [" · ", headPill(g), g.remote ? [" · ", remoteLink(g.remote)] : null, g.shallow ? " · shallow clone (dates are the clone's edge)" : null] : " · no Git"),
    el("div", { class: "grid2" },
      el("div", { class: "card" }, el("h3", {}, "Type"), bars(typeCounts(list), ["decision", "constraint", "workaround", "incident", "undefined"])),
      el("div", { class: "card" }, el("h3", {}, "Status"), bars(count(list, "status"), STATUS_ORDER)),
      el("div", { class: "card" }, el("h3", {}, "Evidence"), bars(count(list, "evidence"), EV_ORDER)),
      el("div", { class: "card" }, el("h3", {}, "Config"), el("div", { class: "kv" }, Object.entries(p.config).map(([k, v]) => [el("span", { class: "k" }, k), el("span", { class: "v mono" }, v)])),
        Object.keys(p.personal_defaults || {}).length ? [el("h3", {}, "Personal defaults offered"), el("div", { class: "kv" }, Object.entries(p.personal_defaults).map(([k, v]) => [el("span", { class: "k" }, k), el("span", { class: "v mono" }, v)]))] : null),
    ),
    el("h2", {}, "Topics"),
    el("div", { class: "topic-cards" }, S.topics.map(topicCard)),
    el("h2", {}, "Recently touched"),
    el("div", { class: "entry-list" }, [...list].filter((e) => e.git?.last_touched?.date !== undefined).sort((a, b) => ((b.git?.last_touched?.date || "") > (a.git?.last_touched?.date || "") ? 1 : -1)).slice(0, 8).map(entryRow)),
  );
}
function topicCard(t) {
  return el("a", { class: "topic-card", href: `#topic/${t.file}` },
    el("div", { class: "tt" }, t.title, el("span", { class: "count" }, plural(t.entries, "entry").replace("entrys", "entries"))),
    t.project ? el("div", { class: "note" }, t.project) : null,
    el("div", { class: "td" }, t.index_line || el("span", { class: "note" }, "not described in index.md")),
    stack(t.evidence, EV_ORDER),
    el("div", { class: "refs" }, `${t.file} · → ${t.refs_out.length} · ← ${t.refs_in.length}`));
}
function viewTopic(main, file) {
  const t = topicOf(file);
  if (!t) return main.append(el("p", { class: "center" }, `No topic ${file}`));
  const list = entriesOf(file);
  main.append(
    el("div", { class: "crumbs" }, el("a", { href: "#overview" }, "Overview"), " / ", t.file),
    el("h1", {}, t.title),
    el("p", { class: "sub" }, t.index_line || "—"),
    el("div", { class: "grid2" },
      el("div", { class: "card" }, el("h3", {}, "Status"), bars(t.status, STATUS_ORDER)),
      el("div", { class: "card" }, el("h3", {}, "Evidence"), bars(t.evidence, EV_ORDER)),
    ),
    el("h2", {}, "Entries"),
    el("div", { class: "entry-list" }, list.map(entryRow)),
  );
  renderDetailsTopic(t);
}
async function viewEntryElsewhere(main, uuid) {
  if (PUBLISHED()) {
    // an Id this export does not carry: look through the family's published exports
    main.append(el("p", { class: "center" }, `Looking for ${uuid} in the family's published exports…`));
    const t = await publicTree();
    for (const g of t.groups) {
      if (g.member.role === "self") continue;
      if (g.state.entries?.some((e) => e.uuid === uuid)) { location.href = publicHref(g.member.canonical, g.member.root || "", `#entry/${uuid}`); return; }
    }
    return setKids(main, el("p", { class: "center" }, `No entry with Id ${uuid} in this export, nor in the family's published exports.`));
  }
  // an Id this project does not carry: ask the server which known project does
  main.append(el("p", { class: "center" }, `Looking for ${uuid} in the other projects known here…`));
  try {
    const r = await fetch(`/api/entry?uuid=${encodeURIComponent(uuid)}${PROJECT ? `&project=${encodeURIComponent(PROJECT)}` : ""}`, { cache: "no-store" });
    if (!r.ok) throw new Error();
    const hit = await r.json();
    if (hit.project === (PROJECT || null)) return;
    location.href = `${location.pathname}?project=${encodeURIComponent(hit.project)}#entry/${uuid}`;
  } catch { setKids(main, el("p", { class: "center" }, `No entry with Id ${uuid} in this project, nor in any other project known here. A family member that is not checked out can be cloned or cached — see Family.`)); }
}
// #ref/<canonical>/<uuid>: an entry in another repository, family or not — a
// reference row's link before it resolved, or a link someone shared. Resolved
// as the row resolves it (resolveRemoteRef), then the page goes there; the
// canonical and the Id stay on the page when nothing loads.
async function viewRemoteEntry(main, canonical, uuid) {
  const here = byUuid()[uuid];
  if (here) { history.replaceState(null, "", entryHref(here)); return render(); }
  main.append(el("p", { class: "center" }, `Looking for ${uuid} in ${repoLabel(canonical)}…`));
  const r = await resolveRemoteRef(canonical, uuid);
  if (r.entry) { location.href = r.href; return; }
  setKids(main, el("div", { class: "center" }, el("p", {}, `Cannot open ${uuid} in ${repoLabel(canonical)}: ${r.error}.`),
    el("p", { class: "note" }, el("a", { href: canonical, target: "_blank", rel: "noopener" }, canonical.replace(/^https:\/\//, "")))));
}
// A reference into another repository, resolved when it is shown: the entry
// from a project known to the live server, else from the repository's
// published export (its .keep-the-why at HEAD names the dashboard-state).
// One lookup per canonical and Id per page; what comes back is shown as text
// in the reference's row, never merged into this project's counts or queues.
const REMOTE_REFS = {}; // `${canonical}|${uuid}` -> Promise<{entry, href} | {error}>
function resolveRemoteRef(canonical, uuid) {
  const key = `${canonical}|${uuid}`;
  if (!REMOTE_REFS[key]) REMOTE_REFS[key] = (async () => {
    if (LIVE()) {
      try {
        const r = await fetch(`/api/entry?uuid=${encodeURIComponent(uuid)}${PROJECT ? `&project=${encodeURIComponent(PROJECT)}` : ""}`, { cache: "no-store" });
        if (r.ok) { const hit = await r.json(); return { entry: hit.entry || {}, href: `${location.pathname}?project=${encodeURIComponent(hit.project)}#entry/${uuid}` }; }
      } catch { /* not known here: the published export */ }
    }
    const r = await fetchPublicState(canonical, "");
    if (!r.state) return { error: r.error };
    const entry = r.state.entries?.find((e) => e.uuid === uuid);
    if (!entry) return { error: `its published export (generated ${r.state.generated || "?"}) has no entry with this Id — the reference may be newer than the export, or the entry lives below the repository's top level` };
    return { entry, href: publicHref(canonical, "", `#entry/${uuid}`) };
  })();
  return REMOTE_REFS[key];
}
const repoLabel = (canonical) => canonical.replace(/^https:\/\/(github\.com|gitlab\.com|codeberg\.org|bitbucket\.org)\//, "").replace(/^https:\/\//, "");
function remoteRefLine(ref, label) {
  const lead = () => (label ? el("b", {}, label) : null);
  const date = ref.date ? el("span", { class: "note" }, ` · as of ${ref.date}`) : null;
  const repo = () => el("a", { class: "note", href: ref.remote, target: "_blank", rel: "noopener", title: "the repository on its host" }, " · repository");
  const row = el("div", { class: "ref remote" }, lead(), el("a", { href: `#ref/${encodeURIComponent(ref.remote)}/${ref.uuid}` }, repoLabel(ref.remote)),
    el("span", { class: "note mono" }, ` · ${ref.uuid}`), el("span", { class: "note" }, " · resolving…"), date, repo());
  resolveRemoteRef(ref.remote, ref.uuid).then((r) => {
    if (r.entry) {
      const e = r.entry; const state = [e.status, e.evidence].filter(Boolean).join(" · ");
      setKids(row, lead(), el("a", { href: r.href }, e.title || ref.uuid), el("span", { class: "note" }, ` · ${repoLabel(ref.remote)}${state ? " · " + state : ""}`), date, repo());
    } else {
      setKids(row, lead(), el("a", { href: ref.remote, target: "_blank", rel: "noopener" }, repoLabel(ref.remote)), el("span", { class: "note mono" }, ` · ${ref.uuid}`), el("span", { class: "note warn" }, ` · not resolved: ${r.error}`), date);
    }
  });
  return row;
}
function refLine(ref, label) {
  // one See / Superseded by reference as a row: local -> the entry here; remote -> the canonical, and the Id to find it there
  const target = ref.uuid ? byUuid()[ref.uuid] : null;
  const date = ref.date ? el("span", { class: "note" }, ` · as of ${ref.date}`) : null;
  if (target) return el("div", { class: "ref" }, label ? el("b", {}, label) : null, el("a", { href: entryHref(target) }, target.title), el("span", { class: "note" }, ` · ${topicOf(target.file)?.title || target.file}`), date);
  if (ref.remote && ref.uuid) return remoteRefLine(ref, label);
  if (ref.remote) return el("div", { class: "ref" }, label ? el("b", {}, label) : null, el("a", { href: ref.remote, target: "_blank", rel: "noopener" }, ref.remote.replace(/^https:\/\//, "")), date);
  if (ref.file) return el("div", { class: "ref" }, label ? el("b", {}, label) : null, topicOf(ref.file) ? el("a", { href: `#topic/${ref.file}` }, ref.locator) : ref.locator, el("span", { class: "note mono" }, ` · ${ref.uuid || ""}`), el("span", { class: "note warn" }, " · Id not found here — the locator may be stale"), date);
  return el("div", { class: "ref" }, label ? el("b", {}, label) : null, ref.text || "");
}
function viewEntry(main, id) {
  const e = entryOf(id);
  if (!e && isUuid(id) && (LIVE() || (PUBLISHED() && canonicalOf(S.project)))) return viewEntryElsewhere(main, id);
  if (!e) return main.append(el("p", { class: "center" }, "No such entry"));
  if (location.hash !== entryHref(e)) history.replaceState(null, "", entryHref(e)); // an old file#anchor link shows the Id address from here on
  const list = entriesOf(e.file); const idx = list.indexOf(e);
  const t = topicOf(e.file);
  INLINE_PROJECT = e.project || null;
  const r = el("div", { class: `reader ${e.status}` },
    el("div", { class: "crumbs" }, el("a", { href: "#overview" }, "Overview"), " / ", el("a", { href: `#topic/${e.file}` }, t?.title || e.file), ` / line ${e.line}`),
    el("h1", { html: inline(e.title) }),
    el("div", { class: "fields" }, ...entryPills(e), e.source ? pill(`Source: ${e.source}`, "") : null, e.verification ? pill(`Verification: ${e.verification.split(/\s[—-]\s/)[0]}`, "") : null),
    el("div", { class: "body", html: renderMarkdown(e.body.text || "_(no body)_") }),
    e.revisit_when ? el("div", { class: "body" }, el("div", { class: "label", html: `<b>Revisit when</b><p>${inline(e.revisit_when)}</p>` })) : null,
    refsBox(e),
    el("div", { class: "pager" },
      idx > 0 ? el("a", { href: entryHref(list[idx - 1]) }, `← ${list[idx - 1].title}`) : el("span"),
      idx < list.length - 1 ? el("a", { href: entryHref(list[idx + 1]) }, `${list[idx + 1].title} →`) : el("span")),
  );
  INLINE_PROJECT = null;
  main.append(r);
  selected = e.id;
  renderDetailsEntry(e);
}
// #thought/<id>,<id>,…: a whole thought in one view — every entry of the chain
// in reading order, origin first, each in full, joined by how the next one
// follows from it. The Ids are the entries' own, so the address names the
// thought; entries of friends or of the path's projects are found in what the
// page has loaded, and a missing one says so.
const thoughtHref = (t) => `#thought/${t.steps.map((n) => encodeURIComponent(n.entry.uuid || n.entry.id)).join(",")}`;
function findEntry(ref) {
  const here = entryOf(ref);
  if (here) return { e: here, href: entryHref(here), where: here.project || null, own: true };
  const pools = [
    ...Object.values(FRIENDS.loaded).filter((r) => r?.state).flatMap((r) => (r.members || [r]).map((m) => ({ state: m.state, name: m.name, href: m.href }))),
    ...TRAIL.map((t) => ({ state: t.state, name: t.name, href: (e) => t.url + entryHref(e) })),
  ];
  for (const p of pools) { const e = (p.state.entries || []).find((x) => x.uuid === ref || x.id === ref); if (e) return { e, href: p.href ? p.href(e) : "#graph", where: p.name, own: false }; }
  return null;
}
function thoughtLink(a, b) {
  if (!a || !b) return "then";
  if (a.e.uuid && (b.e.see || []).some((x) => x?.uuid === a.e.uuid)) return "cited by";
  const sb = a.e.superseded_by ? parseSupersededBy(a.e.superseded_by) : null;
  if (sb?.uuid && sb.uuid === b.e.uuid) return "superseded by";
  return "then";
}
// the days a thought's steps were created, as ticks on one line
function thoughtTimeline(steps, ins) {
  if (!ins.from || ins.from === ins.to) return ins.from ? el("p", { class: "note" }, `All its steps were written on ${ins.from}.`) : null;
  const t0 = Date.parse(ins.from), t1 = Date.parse(ins.to), days = Math.round((t1 - t0) / 86400000);
  const bar = el("div", { class: "timeline-bar" });
  steps.forEach((f, i) => { const d = f?.e?.git?.created?.date; if (!d) return; const x = ((Date.parse(d) - t0) / (t1 - t0)) * 100; bar.append(el("span", { class: "tick", style: `left:${x}%`, title: `${i + 1}: ${d} — ${f.e.title}`, ...stepHover(f.e.uuid || `e:${f.e.id}`) }, String(i + 1))); });
  return el("div", { class: "thought-timeline" }, el("div", { class: "note" }, `${ins.from} → ${ins.to} · grew over ${plural(days, "day")}`), bar);
}
function viewThought(main, refs) {
  const steps = refs.map(findEntry);
  // an entry of a friend is found once the friends are in: they load with a graph, and the view renders again
  if (steps.some((f) => !f) && FRIENDS_AUTO && !FRIENDS.on && !FRIENDS.loading) buildGraph();
  const links = steps.map((f, i) => (i ? thoughtLink(steps[i - 1], f) : null));
  const ins = thoughtInsights(steps.map((f) => f?.e || {}), links.slice(1).map((l) => (l === "superseded by" ? "superseded" : "see")));
  // where the chain goes on beyond what the page has loaded: before its origin, after its newest entry
  const beyond = (f, kind) => (f ? entryRefs(f.e).filter((x) => x.kind === kind && x.remote && !findEntry(x.uuid)) : []);
  const before = beyond(steps[0], "see"), after = beyond(steps[steps.length - 1], "superseded");
  const goOn = (ends, where) => el("div", { class: "thought-beyond" }, `${where} goes on in ${[...new Set(ends.map((x) => repoLabel(x.remote)))].join(", ")} — not loaded on this page. `,
    el("button", { type: "button", class: "link-btn", disabled: CHAIN.busy, onclick: () => followThought({ anchor: steps.filter(Boolean).pop()?.e.uuid }, (c) => { if (c) location.hash = thoughtHref(c); else render(); }) }, CHAIN.busy ? "loading…" : "load the whole chain"));
  const evolution = steps.length > 1 && links.slice(1).every((l) => l === "superseded by");
  const r = el("div", { class: "reader thought-reader" },
    el("div", { class: "crumbs" }, el("a", { href: "#graph" }, "Graph"), " / thought"),
    el("h1", {}, evolution ? `An evolution in ${refs.length} entries` : `A thought in ${refs.length} entries`),
    el("p", { class: "sub" }, evolution ? "One decision, replaced step by step — from the first version to the one in force." : "A chain of linked entries, each citing the one before — read from the first to the last. A link says two entries are related: often that one follows from the other, not always."),
    before.length ? goOn(before.map((x) => ({ ...x })), "↑ Before its origin, it") : null,
    thoughtTimeline(steps, ins),
    ins.weakOrigin ? el("div", { class: "thought-warn" }, `Its first entry's Evidence is ${ins.weakOrigin}. Where a later step depends on it, it depends on a reason nobody confirmed.`) : null);
  steps.forEach((f, i) => {
    if (i) r.append(el("div", { class: "thought-link" }, `↓ ${links[i]}`));
    if (!f) { r.append(el("section", { class: "thought-step missing" }, el("div", { class: "crumbs" }, `${i + 1} / ${refs.length}`), el("p", { class: "note" }, `Entry ${refs[i]} is not loaded on this page — it lives in a project outside it (a friend, or a step of a path); load the friends in the graph, or walk there.`))); return; }
    const e = f.e;
    INLINE_PROJECT = f.own ? e.project || null : "\u0000"; // a foreign entry's file names are not this page's topics
    r.append(el("section", { class: `thought-step ${e.status}`, ...stepHover(e.uuid || `e:${e.id}`) },
      el("div", { class: "crumbs" }, `${i + 1} / ${refs.length}`, f.where ? ` · ${f.where}` : "", f.own && topicOf(e.file) ? [" · ", el("a", { href: `#topic/${e.file}` }, topicOf(e.file).title)] : null, e.git?.created?.date ? ` · ${e.git.created.date}` : ""),
      ins.shaky.some((x) => x.i === i) ? el("div", { class: "thought-warn" }, `In question — ${ins.shaky.find((x) => x.i === i).why}. ${plural(steps.length - 1 - i, "later step")} ${steps.length - 1 - i === 1 ? "is" : "are"} linked after it — worth checking whether they depend on it.`) : null,
      ins.affected.includes(i) && !ins.shaky.some((x) => x.i === i) ? el("div", { class: "thought-affected" }, `Linked after step ${ins.shaky[0].i + 1}, which is in question.`) : null,
      el("h2", {}, el("a", { href: f.href, html: inline(e.title) })),
      el("div", { class: "fields" }, ...entryPills(e)),
      el("div", { class: "body", html: renderMarkdown(e.body?.text || "_(no body)_") }),
      e.revisit_when ? el("div", { class: "body" }, el("div", { class: "label", html: `<b>Revisit when</b><p>${inline(e.revisit_when)}</p>` })) : null));
    INLINE_PROJECT = null;
  });
  if (after.length) r.append(goOn(after, "↓ After its newest entry, it"));
  main.append(r);
  renderDetailsDefault();
}
// ---------------------------------------------------------------- friends and thoughts pages
// Both read the graph of the scope (this project, or the family), with the
// friends, the path and the followed chains it has — the same data the Graph
// view shows, laid out as lists.
const graphForScope = async () => (scope() === "family" ? buildFamilyGraph() : buildGraph());
const projOf = (n) => n.proj || n.entry?.project || SELF?.project?.id || SELF?.project?.name || "";
const lightAll = (t) => { for (const G of ACTIVE_GRAPHS) lightThought(G, t); };
async function viewFriends(main) {
  main.append(el("h1", {}, "Friends"), el("p", { class: "sub" }, "Repositories the entries here cite outside the family — linked into the graph, never merged into search, queues or counts. A friend in a family comes as the whole family. One hop: a friend's own friends are not loaded; walk there to see them."));
  const box = el("div", { class: "friends-page" }, el("p", { class: "center" }, "Loading…")); main.append(box);
  const g = await graphForScope();
  if (!box.isConnected) return;
  const list = g.friends || [];
  const units = friendUnits(g);
  const failed = list.map((f) => FRIENDS.loaded[fkey(f.canonical)]).filter((r) => r && !r.state);
  const waiting = list.filter((f) => !FRIENDS.loaded[fkey(f.canonical)]);
  const kids = [];
  if (!list.length && !units.length) kids.push(el("p", { class: "empty" }, "No entry here cites a repository outside the family yet. A See line into another project — its canonical and an entry's Id — makes it a friend."));
  if (list.length && (!FRIENDS.on || waiting.length)) kids.push(el("p", {}, FRIENDS.loading ? "Loading friends…" : el("button", { type: "button", class: "link-btn", onclick: () => { setFriendsAuto(true); loadFriends(FRIENDS.on ? waiting : list); } }, `load the ${plural(FRIENDS.on ? waiting.length : list.length, "friend")}`)));
  const ours = g.nodes.filter((n) => n.kind === "entry" && !n.ext);
  const ourByUuid = Object.fromEntries(ours.filter((n) => n.entry.uuid).map((n) => [n.entry.uuid, n]));
  const card = (u, i) => {
    const canons = new Set(u.members.map((m) => fkey(m.canonical)));
    const theirs = new Map(); for (const m of u.members) for (const e of m.state.entries || []) if (e.uuid) theirs.set(e.uuid, { e, m });
    const out = []; // our entries citing into the unit
    for (const n of ours) for (const x of entryRefs(n.entry)) if (x.remote && canons.has(fkey(x.remote)) && theirs.has(x.uuid)) out.push({ from: n, to: theirs.get(x.uuid), kind: x.kind });
    const back = []; // the unit's entries citing ours
    for (const [, t] of theirs) for (const x of entryRefs(t.e)) if (x.remote && ourByUuid[x.uuid]) back.push({ from: t, to: ourByUuid[x.uuid], kind: x.kind });
    const src = u.r.centre?.mode === "live" ? "a checkout on this machine" : `the published export${u.r.state.generated ? `, generated ${u.r.state.generated}` : ""}`;
    const rel = (a, b, kind) => el("div", { class: "ref" }, a, el("span", { class: "note" }, kind === "superseded" ? " — superseded by — " : " — cites — "), b);
    return el("section", { class: "friend-card" },
      el("h2", {}, el("i", { class: "dot", style: `background:transparent;border:2px dashed ${friendColor(i)};width:11px;height:11px;margin-right:8px` }), el("a", { href: u.r.open || "#graph" }, u.r.name),
        u.via === "chain" ? el("span", { class: "pill" }, "via a thought") : null),
      el("p", { class: "note" }, `${u.members.length > 1 ? `A family of ${u.members.length}: ${u.members.map((m) => m.name).join(", ")}. ` : ""}Read from ${src}. ${u.r.canonical}`),
      el("h3", {}, `Cited from here (${out.length})`),
      ...(out.length ? out.map((x) => rel(el("a", { href: x.from.href }, x.from.label), el("a", { href: x.to.m.href ? x.to.m.href(x.to.e) : "#graph" }, x.to.e.title, u.members.length > 1 ? el("span", { class: "note" }, ` · ${x.to.m.name}`) : null), x.kind)) : [el("p", { class: "empty" }, u.via === "chain" ? "Nothing here cites it directly — it was reached by following a thought." : "—")]),
      el("h3", {}, `Citing this project (${back.length})`),
      ...(back.length ? back.map((x) => rel(el("a", { href: x.from.m.href ? x.from.m.href(x.from.e) : "#graph" }, x.from.e.title), el("a", { href: x.to.href }, x.to.label), x.kind)) : [el("p", { class: "empty" }, "None of its entries cites an entry here.")]));
  };
  const friends = units.filter((u) => u.via !== "chain"), chained = units.filter((u) => u.via === "chain");
  kids.push(...friends.map((u) => card(u, units.indexOf(u))));
  if (chained.length) kids.push(el("h2", { class: "section" }, "Reached by following a thought"), ...chained.map((u) => card(u, units.indexOf(u))));
  if (failed.length) kids.push(el("h2", { class: "section" }, "Not loaded"), ...failed.map((r) => el("div", { class: "ref" }, el("a", { href: r.canonical, target: "_blank", rel: "noopener" }, repoLabel(r.canonical)), el("span", { class: "note warn" }, ` · ${r.error}`))));
  setKids(box, ...kids);
}
async function viewThoughtsPage(main) {
  const minSeg = el("span", { class: "thought-min", title: "entries a thought has at least" }, "from ", ...[3, 4, 5].map((m) => el("button", { type: "button", class: m === THOUGHT_MIN ? "on" : "", onclick: () => { THOUGHT_MIN = m; try { localStorage.setItem("ktw-thought-min", String(m)); } catch {} render(); } }, String(m))));
  main.append(el("h1", {}, "Thoughts ", minSeg), el("p", { class: "sub" }, "Chains of linked entries: each cites the one before (See) or replaced it (Superseded by) — in this graph, with its family, friends and path. A link says two entries are related; often one follows from the other, not always. Point at a chain to light it in the graph beside."));
  const box = el("div", { class: "thoughts-page" }, el("p", { class: "center" }, "Loading…")); main.append(box);
  const g = await graphForScope();
  if (!box.isConnected) return;
  const all = graphChains(g);
  const thoughts = all.filter((t) => t.steps.length >= THOUGHT_MIN);
  const open = all.filter((t) => t.ends.length);
  if (!thoughts.length && !open.length) return setKids(box, el("p", { class: "empty" }, `No chain of linked entries here is ${THOUGHT_MIN} or more entries long yet.`));
  const across = (t) => new Set(t.steps.map(projOf)).size > 1;
  const tags = (t) => [t.evolution ? el("span", { class: "pill" }, "evolution") : null, across(t) ? el("span", { class: "pill" }, "across projects") : null, t.ends.length ? el("span", { class: "pill" }, "continues ↗") : null, ...insightPills(t), span(t) ? el("span", { class: "note" }, span(t)) : null];
  const row = (t) => el("div", { class: "thought-row", onmouseenter: () => lightAll(t), onmouseleave: () => lightAll(null) },
    el("span", { class: "count" }, String(t.steps.length)),
    el("a", { href: thoughtHref(t), title: t.steps.map((n) => n.label).join("\n→ ") }, `${shortLabel(t.steps[0])} → ${shortLabel(t.steps[t.steps.length - 1])}`), ...tags(t));
  const entryLink = (n, extra) => el("a", { class: "backlink", href: n.href, ...stepHover(n.entry?.uuid || n.id) }, n.label.replace(/`/g, ""), el("div", { class: "note" }, [projOf(n), extra].filter(Boolean).join(" · ")));
  // counts
  const count = (pick) => { const m = new Map(); for (const t of thoughts) for (const n of pick(t)) m.set(n, (m.get(n) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const starts = count((t) => [t.steps[0]]), ends = count((t) => [t.steps[t.steps.length - 1]]);
  const bridges = count((t) => t.steps.slice(1, -1)).filter(([, c]) => c > 1);
  const fansTo = ends.filter(([, c]) => c > 1), fansFrom = starts.filter(([, c]) => c > 1);
  const projects = new Map(); const bump = (p, k) => { if (!projects.has(p)) projects.set(p, { starts: 0, ends: 0, through: 0 }); projects.get(p)[k]++; };
  for (const t of thoughts) { bump(projOf(t.steps[0]), "starts"); bump(projOf(t.steps[t.steps.length - 1]), "ends"); for (const p of new Set(t.steps.slice(1, -1).map(projOf))) bump(p, "through"); }
  const stat = (n, label) => el("div", { class: "stat" }, el("b", {}, String(n)), el("span", {}, label));
  const kids = [
    el("div", { class: "stats" }, stat(thoughts.length, "thoughts"), stat(thoughts.filter((t) => t.evolution).length, "evolutions"), stat(thoughts.filter(across).length, "across projects"), stat(open.length, "going on beyond"), stat(thoughts[0]?.steps.length || 0, "longest"),
      stat(thoughts.filter((t) => t.ins.weakOrigin).length, "start unconfirmed"), stat(thoughts.filter((t) => t.ins.shaky.length).length, "pass a step in question")),
  ];
  // chains whose first entry nobody confirmed, grouped by that entry
  const weak = thoughts.filter((t) => t.ins.weakOrigin);
  if (weak.length) {
    const byOrigin = new Map(); for (const t of weak) { if (!byOrigin.has(t.steps[0])) byOrigin.set(t.steps[0], []); byOrigin.get(t.steps[0]).push(t); }
    kids.push(el("h2", {}, "Starting from an unconfirmed entry"), el("p", { class: "note" }, "Chains whose first entry has Evidence inferred or unknown. Where later entries depend on it, they depend on a reason nobody confirmed — the first entry is the place to ask."),
      ...[...byOrigin.entries()].map(([n, ts]) => el("div", { class: "fan" }, entryLink(n, `Evidence ${n.entry.evidence} · ${plural(ts.length, "thought")} start here`), el("div", { class: "fan-rows" }, ...ts.map(row)))));
  }
  // entries in question and the later entries linked after them — what to check if they change
  const impact = new Map();
  for (const t of thoughts.concat(open.filter((t) => t.steps.length < THOUGHT_MIN))) for (const x of t.ins.shaky) {
    const n = t.steps[x.i];
    if (!impact.has(n)) impact.set(n, { why: x.why, later: new Set(), thoughts: new Set(), projects: new Set() });
    const m = impact.get(n); m.thoughts.add(t);
    for (const j of t.steps.slice(x.i + 1)) { m.later.add(j); m.projects.add(projOf(j)); }
  }
  if (impact.size) kids.push(el("h2", {}, "Chains through a step in question"), el("p", { class: "note" }, "Entries in question — open, needing review, waiting for confirmation, or replaced yet still cited — and the later entries linked after them. If one of these changes, these are the entries to check: whether they depend on it is for a person to say."),
    ...[...impact.entries()].sort((a, b) => b[1].later.size - a[1].later.size).map(([n, m]) => el("div", { class: "fan" },
      entryLink(n, `${m.why} · ${m.later.size} later ${m.later.size === 1 ? "entry" : "entries"} linked after it${m.projects.size > 1 ? `, in ${m.projects.size} projects` : ""}`),
      el("div", { class: "fan-rows" }, ...[...m.later].map((j) => entryLink(j, j.entry.status))))));
  if (fansTo.length) kids.push(el("h2", {}, "Where many lines lead"), el("p", { class: "note" }, "Entries at the end of several chains — where chains from different starts arrive."),
    ...fansTo.map(([n, c]) => el("div", { class: "fan" }, entryLink(n, `${c} starts`), el("div", { class: "fan-rows" }, ...thoughts.filter((t) => t.steps[t.steps.length - 1] === n).map(row)))));
  if (fansFrom.length) kids.push(el("h2", {}, "Where many lines start"), el("p", { class: "note" }, "Entries several chains start from — often a decision much else refers to."),
    ...fansFrom.map(([n, c]) => el("div", { class: "fan" }, entryLink(n, `${c} thoughts`), el("div", { class: "fan-rows" }, ...thoughts.filter((t) => t.steps[0] === n).map(row)))));
  if (bridges.length) kids.push(el("h2", {}, "Bridges"), el("p", { class: "note" }, "Entries in the middle of several chains — where many links pass through."), ...bridges.slice(0, 12).map(([n, c]) => entryLink(n, `in ${c} thoughts`)));
  if (projects.size > 1) kids.push(el("h2", {}, "By project"), el("div", { class: "table-wrap" }, el("table", { class: "t" }, el("thead", {}, el("tr", {}, ["Project", "Starts", "Passes through", "Ends"].map((h) => el("th", {}, h)))),
    el("tbody", {}, [...projects.entries()].sort((a, b) => (b[1].starts + b[1].ends + b[1].through) - (a[1].starts + a[1].ends + a[1].through)).map(([p, c]) => el("tr", {}, el("td", {}, p), el("td", {}, String(c.starts)), el("td", {}, String(c.through)), el("td", {}, String(c.ends))))))));
  // time: when lines grew last, from the day each step was created
  const dated = thoughts.filter((t) => t.ins.to);
  if (dated.length > 1) {
    const recent = [...dated].sort((a, b) => b.ins.to.localeCompare(a.ins.to)).slice(0, 5);
    const resting = [...dated].sort((a, b) => a.ins.to.localeCompare(b.ins.to)).slice(0, 5);
    kids.push(el("h2", {}, "Recently grown"), el("p", { class: "note" }, "Lines whose newest step is the newest — where reasoning is moving now."), ...recent.map(row),
      el("h2", {}, "Resting longest"), el("p", { class: "note" }, "Lines that have not grown for the longest time — settled, or forgotten."), ...resting.map(row));
  }
  kids.push(el("h2", {}, `All thoughts (${thoughts.length})`), ...thoughts.map(row));
  const evo = thoughts.filter((t) => t.evolution);
  if (evo.length) kids.push(el("h2", {}, `Evolutions (${evo.length})`), el("p", { class: "note" }, "One decision, replaced step by step."), ...evo.map(row));
  if (open.length) kids.push(el("h2", {}, `Going on beyond this page (${open.length})`), el("p", { class: "note" }, "Chains that continue in a repository this page has not loaded."),
    el("button", { type: "button", class: "link-btn", disabled: CHAIN.busy, onclick: followAll }, CHAIN.busy ? "loading the chains…" : "load the whole chains"), ...open.map(row));
  setKids(box, ...kids);
}
function viewQueues(main) {
  const q = queues();
  const section = (title, why, list) => el("section", { class: "queue" },
    el("h2", {}, title, el("span", { class: "count" }, list.length)), el("p", { class: "why" }, why),
    list.length ? el("div", { class: "entry-list" }, list.map(entryRow)) : el("p", { class: "note" }, "nothing here"));
  main.append(
    el("h1", {}, "Queues"), el("p", { class: "sub" }, "What needs a person. The dashboard lists; it does not decide."),
    section("Open questions", "Status: open — the entry's central question has no answer yet.", q.open),
    section("Needs review", "Status: needs-review — a Revisit-when trigger fired and nobody re-checked yet.", q["needs-review"]),
    section("Pending confirmation", "Written in an unattended session where a question would have been asked; never confirmed by anyone.", q["pending-confirmation"]),
    section("Unknown evidence", "Where the claim came from could not be traced — on any entry still in force, an open question included: Evidence and Status are separate axes. A maintainer can often settle these in a minute.", q.unknown),
    section("Revisit-when triggers", "The conditions on record. Whether one has fired is a human judgement; the dashboard cannot tell.", q.revisit),
  );
}
function viewAuthors(main) {
  const rows = S.authors;
  main.append(el("h1", {}, "Authors"), el("p", { class: "sub" }, "Git authors of the entries — who created, touched, or superseded what. Git knows names, not who was driving."));
  if (!S.project.git?.available) return main.append(el("p", { class: "center" }, "No Git repository — nothing to attribute."));
  const tbl = el("table", { class: "t" }, el("thead", {}, el("tr", {}, ["Author", "Created", "Touched", "Superseded", "Evidence of created entries", "First", "Last"].map((h) => el("th", {}, h)))),
    el("tbody", {}, rows.map((a) => el("tr", { class: `clickable ${filter.author === a.name ? "sel" : ""}`, onclick: () => { filter.author = filter.author === a.name ? "" : a.name; rerender(); } },
      el("td", {}, authorLink(a.name, ...authorCommit(a.name))), el("td", {}, a.created), el("td", {}, a.touched), el("td", {}, a.superseded),
      el("td", {}, el("div", { style: "min-width:160px" }, stack(a.evidence, EV_ORDER))), el("td", { class: "mono" }, fmtDate(a.first)), el("td", { class: "mono" }, fmtDate(a.last))))));
  main.append(el("div", { class: "table-wrap" }, tbl), el("p", { class: "note", style: "margin-top:10px" }, "Click a name to open the author's profile on the host; click elsewhere in the row to filter every view to that author, again to clear."));
  if (filter.author) main.append(el("h2", {}, `Entries created by ${filter.author}`), el("div", { class: "entry-list" }, S.entries.filter((e) => authorOf(e) === filter.author).map(entryRow)));
}

const supersedersOf = (e) => e.uuid ? S.entries.filter((x) => x.superseded_by && parseSupersededBy(x.superseded_by)?.uuid === e.uuid) : [];
const seenFrom = (e, list) => e.uuid ? list.filter((x) => (x.see || []).some((r) => r?.uuid === e.uuid)) : [];
// See and Superseded by of an entry, and the other way round: what supersedes
// or points at it — here, and with the family scope anywhere in the tree
function refsBox(e) {
  const back = (label, rows) => rows.length ? [el("h3", {}, label), ...rows] : null;
  const localRow = (x) => el("div", { class: "ref" }, el("a", { href: entryHref(x) }, x.title), el("span", { class: "note" }, ` · ${x.project ? x.project + " · " : ""}${topicOf(x.file)?.title || x.file}`));
  const sup = supersedersOf(e), seen = seenFrom(e, S.entries);
  const box = el("div", { class: "body refs-box" },
    e.see?.length ? [el("h3", {}, "See"), ...e.see.map((r) => refLine(r))] : null,
    e.superseded_by ? [el("h3", {}, "Superseded by"), (() => { const sb = parseSupersededBy(e.superseded_by); return sb.none != null ? el("div", { class: "ref" }, el("i", {}, "none"), el("span", { class: "note" }, ` — ${sb.none}`)) : refLine(sb); })()] : null,
    back("Supersedes", sup.map(localRow)), back("Referenced by (See)", seen.map(localRow)));
  if (S.merged) return box.childNodes.length ? box : null; // the merged family holds every reference
  const family = e.uuid && canFamily();
  if (family && scope() === "family" && !S.merged) {
    const more = el("div", {}, el("p", { class: "note" }, "Looking for references from the rest of the family…")); box.append(more);
    searchPool("family").then((pool) => {
      const sups = [], sees = [];
      for (const g of pool.groups) {
        if (g.member.role === "self") continue;
        const row = (x) => el("div", { class: "ref" }, el("a", { href: g.href(x) }, x.title), el("span", { class: "note" }, ` · ${g.member.name} · ${topicTitle(g.state, x.file)}`));
        for (const x of g.state.entries || []) { if (x.superseded_by && parseSupersededBy(x.superseded_by)?.uuid === e.uuid) sups.push(row(x)); if ((x.see || []).some((r) => r?.uuid === e.uuid)) sees.push(row(x)); }
      }
      setKids(more, back("Supersedes, elsewhere in the family", sups), back("Referenced by (See), elsewhere in the family", sees),
        pool.missing.length ? el("p", { class: "note" }, `${plural(pool.missing.length, "family member")} not available here — not looked through.`) : null);
      if (!sups.length && !sees.length && !pool.missing.length) more.replaceChildren(el("p", { class: "note" }, "No references to this entry from the rest of the family."));
    });
  } else if (family) box.append(el("p", { class: "note" }, "References from the rest of the family show with the family scope — the switch next to the project menu."));
  return box.childNodes.length ? box : null;
}

// ---------------------------------------------------------------- family and projects
let FAMILY = null; // /api/family result for the current project (live mode only)
async function fetchFamily() {
  if (!LIVE()) return null;
  try { FAMILY = (await (await fetch(api("/api/family"), { cache: "no-store" })).json()).members || []; } catch { FAMILY = null; }
  return FAMILY;
}
// the family as .keep-the-why declares it — what an export or a public dump knows
function familyDeclared() {
  const p = S.project; const out = [];
  if (p.parent) out.push({ role: "parent", name: p.parent.replace(/^https:\/\//, ""), location: p.parent, scope: "", canonical: p.parent.startsWith("https://") ? p.parent : "", root: "" });
  for (const c of p.children || []) out.push({ role: "child", name: c.name, location: c.location, scope: c.scope, canonical: c.location.startsWith("https://") ? c.location : "", root: "" });
  return out;
}
function publicMemberRow(m, r) {
  const st = r?.state;
  const title = st ? el("a", { href: publicHref(m.canonical, m.root || "") }, m.name) : el("b", {}, m.name);
  return el("div", { class: `member ${m.role} ${st ? "public" : "none"}` },
    el("div", { class: "mr" }, el("span", { class: "role" }, m.role), title, el("span", { class: `pill kind-${st ? "public" : "none"}` }, st ? "published export" : "no public export"),
      st ? el("span", { class: "pill" }, `generated ${st.generated || "?"}`) : null),
    m.scope ? el("div", { class: "ms" }, m.scope) : (m.role === "parent" ? el("div", { class: "ms note" }, "holds what is family-wide") : null),
    el("div", { class: "mm mono" }, m.canonical || m.location, st ? ` · ${st.entries.length} entries · ${st.topics.length} topics · ${r.url}` : r?.error ? ` · ${r.error}` : ""));
}
function memberRow(m) {
  const here = m.role === "self";
  const title = m.key && !here ? el("a", { href: `${location.pathname}?project=${encodeURIComponent(m.key)}#overview` }, m.name) : el("b", {}, m.name);
  return el("div", { class: `member ${m.role} ${m.available}` },
    el("div", { class: "mr" }, el("span", { class: "role" }, m.role), title, el("span", { class: `pill kind-${m.available}` }, here ? "this project" : kindLabel(m.available))),
    m.scope ? el("div", { class: "ms" }, m.scope) : (m.role === "parent" ? el("div", { class: "ms note" }, "holds what is family-wide") : null),
    el("div", { class: "mm mono" }, m.canonical || m.location || "", m.path && !here ? ` · ${m.path}` : ""),
    m.fetch ? el("details", { class: "fetch" }, el("summary", {}, "not checked out here — how to get it"),
      el("p", { class: "note" }, "A working tree, writable (the mapping learns it on next start):"), el("pre", {}, el("code", {}, m.fetch.clone)),
      el("p", { class: "note" }, "Or the read-only context cache, shared by every project on this machine:"), el("pre", {}, el("code", {}, m.fetch.cache))) : null);
}
// the tree as nested rows: every member under the one whose children block lists it
function treeRows(members, rowOf) {
  const ids = new Set(members.map((m) => m.node));
  const kids = new Map(); const roots = [];
  for (const m of members) {
    if (m.up && ids.has(m.up) && m.up !== m.node) { if (!kids.has(m.up)) kids.set(m.up, []); kids.get(m.up).push(m); }
    else roots.push(m);
  }
  const out = []; const seen = new Set();
  const walk = (m, d) => {
    if (seen.has(m.node)) return; seen.add(m.node);
    out.push(el("div", { class: "tree-row", style: `padding-left:${Math.min(d, 6) * 26}px` }, d ? el("span", { class: "tree-mark" }, "└") : null, rowOf(m)));
    for (const c of (kids.get(m.node) || []).sort((a, b) => familyRank(a) - familyRank(b) || String(a.name).localeCompare(String(b.name)))) walk(c, d + 1);
  };
  for (const r of roots) walk(r, 0);
  for (const m of members) walk(m, 0); // a cycle would otherwise drop rows
  return out;
}
async function viewFamily(main) {
  const p = S.project;
  main.append(el("h1", {}, "Family"), el("p", { class: "sub" }, "The whole tree this project belongs to, from the root down: each project under the one whose children block lists it. That block is the routing — where an entry about something belongs; what is wider than a level goes one level up, to the root at most. Every member can be read; a member checked out here can be written to. Not a dependency graph."));
  if (!p.parent && !(p.children || []).length) return main.append(el("p", { class: "center" }, "This project is not part of a family: no parent line, no children block in .keep-the-why."));
  const box = el("div", { class: "family" }); main.append(box);
  if (PUBLISHED() && canonicalOf(p)) {
    box.append(el("p", { class: "center" }, "Reading the family's published exports…"));
    const t = await publicTree();
    const members = [...t.groups.map((g) => g.member), ...t.missing.map((x) => x.member)];
    const results = await Promise.all(members.map((m) => (m.role === "self" || !m.canonical ? null : fetchPublicState(m.canonical, m.root || ""))));
    const byNode = new Map(members.map((m, i) => [m.node, results[i]]));
    if (!box.isConnected) return;
    box.replaceChildren(...treeRows(members, (m) => m.role === "self"
      ? memberRow({ role: "self", name: p.id || p.name, location: "", scope: m.scope || "", canonical: canonicalOf(p), available: "public" })
      : publicMemberRow(m, byNode.get(m.node))));
    return;
  }
  if (!LIVE()) {
    // an export knows only its own config: parent and children as declared
    if (p.parent) box.append(memberRow({ role: "parent", name: p.parent.replace(/^https:\/\//, ""), location: p.parent, scope: "", canonical: p.parent.startsWith("https://") ? p.parent : "", available: "none", fetch: null }));
    box.append(memberRow({ role: "self", name: p.id || p.name, location: "", scope: "", canonical: canonicalOf(p), available: "repository" }));
    for (const c of p.children || []) box.append(memberRow({ role: "child", name: c.name, location: c.location, scope: c.scope, canonical: c.location.startsWith("https://") ? c.location : "", available: "none", fetch: null }));
    return;
  }
  const members = await fetchTree() || [];
  if (!box.isConnected) return;
  box.replaceChildren(...treeRows(members, memberRow));
}
let PROJECTS = null; // /api/projects result
let SELECTED_DEFAULT = null; // the server's own project, for the menu when the URL names none
async function viewProjects(main) {
  main.append(el("h1", {}, "Projects"), el("p", { class: "sub" }, "Every project this machine knows — from ~/.keep-the-why/projects.json, the folder next to this one, and the personal files. Families grouped, parent first. Forgetting a row removes it from the mapping; a cache directory goes with it, a working tree is never touched."));
  if (!LIVE()) return main.append(el("p", { class: "center" }, "Static export — the project list is a live-server view."));
  let data; try { data = await (await fetch("/api/projects", { cache: "no-store" })).json(); } catch { return main.append(el("p", { class: "center" }, "Could not load the project list.")); }
  PROJECTS = data.projects || [];
  const current = PROJECT || data.selected;
  const list = PROJECTS;
  const row = (p, depth) => {
    const here = p.key === current;
    const label = p.path ? el("a", { href: `${location.pathname}?project=${encodeURIComponent(p.key)}#overview` }, p.name) : el("span", {}, p.id);
    const forget = p.source === "unresolved" ? null : el("button", { class: "link-btn danger", title: p.kind === "cache" ? "forget this cache and delete its directory (a cache is never the only copy of anything)" : "forget this path — the working tree itself is not touched", onclick: async () => {
      if (!confirm(p.kind === "cache" ? `Forget the cache of ${p.id} and delete ${p.path}?` : `Forget ${p.path}? The directory stays; only the mapping row goes.`)) return;
      try { await fetch("/api/projects/forget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: p.key }) }); } catch {}
      if (here) location.href = location.pathname; else render();
    } }, "forget");
    return el("div", { class: `prow depth-${Math.min(depth, 3)} ${here ? "here" : ""}` },
      el("div", { class: "pr" }, depth ? el("span", { class: "tree-mark" }, "└") : null, label, el("span", { class: `pill kind-${p.path ? p.kind : "none"}` }, p.path ? kindLabel(p.kind) : "location unknown"), here ? el("span", { class: "pill" }, "here") : null, p.root ? el("span", { class: "pill mono", title: "root: below the git toplevel" }, p.root) : null),
      el("div", { class: "pm mono" }, p.id, p.canonical ? ` · ${p.canonical}` : "", p.path ? ` · ${p.path}` : "", p.last_opened ? ` · seen ${p.last_opened}` : ""),
      forget);
  };
  main.append(el("div", { class: "projects" }, groupByFamily(list).map(([p, depth]) => row(p, depth))));
}

// ---------------------------------------------------------------- details pane
function renderDetailsTopic(t) {
  const d = $("#details"); d.replaceChildren();
  d.append(el("h3", {}, "Topic"), el("div", { class: "kv" }, el("span", { class: "k" }, "file"), el("span", { class: "v mono" }, t.file), el("span", { class: "k" }, "entries"), el("span", { class: "v" }, t.entries)));
  d.append(el("h3", {}, `References out (${t.refs_out.length})`), ...(t.refs_out.length ? t.refs_out.map((f) => el("a", { class: "backlink", href: `#topic/${f}` }, topicOf(f)?.title || f)) : [el("p", { class: "empty" }, "none")]));
  d.append(el("h3", {}, `Referenced by (${t.refs_in.length})`), ...(t.refs_in.length ? t.refs_in.map((f) => el("a", { class: "backlink", href: `#topic/${f}` }, topicOf(f)?.title || f)) : [el("p", { class: "empty" }, "none")]));
  miniGraph(d, { topic: t });
}
function renderDetailsEntry(e) {
  const d = $("#details"); d.replaceChildren();
  const g = e.git;
  const P = e.origin?.state?.project || S.project; // a merged member's entry lives in its own repository
  const hostHref = hostFileLink(canonicalOf(P), P.git?.branch, P.context, e.localFile || e.file, (e.localId || e.id).split("#")[1]);
  d.append(el("h3", {}, "Entry"), el("div", { class: "kv" },
    e.uuid ? [el("span", { class: "k" }, "Id"), el("span", { class: "v mono", title: "the entry's address — what See and Superseded by lines resolve to" }, e.uuid)] : null,
    e.project ? [el("span", { class: "k" }, "project"), el("span", { class: "v" }, e.origin?.href ? el("a", { href: memberLink(e.origin.member, "#overview") }, e.project) : e.project)] : null,
    el("span", { class: "k" }, "at"), el("span", { class: "v mono" }, hostHref ? el("a", { class: "gh", href: hostHref, target: "_blank", rel: "noopener", title: "open on the host" }, e.id) : e.id),
    el("span", { class: "k" }, "type"), el("span", { class: "v" }, (e.type || []).join(", ") || "—"),
    el("span", { class: "k" }, "status"), el("span", { class: "v" }, statusPill(e.status)),
    el("span", { class: "k" }, "evidence"), el("span", { class: "v" }, evPill(e.evidence)),
    e.source ? [el("span", { class: "k" }, "source"), el("span", { class: "v" }, e.source)] : null,
    e.verification ? [el("span", { class: "k" }, "verification"), el("span", { class: "v" }, e.verification)] : null,
    e.revisit_when ? [el("span", { class: "k" }, "revisit when"), el("span", { class: "v" }, e.revisit_when)] : null,
  ));
  d.append(el("h3", {}, "Git"));
  if (!g) d.append(el("p", { class: "empty" }, S.project.git?.available ? "not in Git yet" : "no repository"));
  else {
    const who = (c) => c ? [authorLink(c.author, c.commit, P), `${c.date ? " · " + c.date : ""}${c.commit ? " · " : ""}`, c.commit ? el("code", {}, c.commit) : null] : ["—"];
    d.append(el("div", { class: "kv" },
      el("span", { class: "k" }, "created"), el("span", { class: "v" }, ...who(g.created)),
      el("span", { class: "k" }, "last touched"), el("span", { class: "v" }, ...who(g.last_touched))));
    if (g.status_history?.length) d.append(el("h3", {}, "Status history"), el("ul", { class: "hist" }, g.status_history.map((h) => el("li", { class: h.status }, `${h.status}`, el("div", { class: "d" }, authorLink(h.author, h.commit, P), ` · ${h.date} · ${h.commit}`)))));
  }
  const back = S.entries.filter((x) => x.id !== e.id && x.refs.includes(e.file));
  d.append(el("h3", {}, `Backlinks (${back.length})`), ...(back.length ? back.map((x) => el("a", { class: "backlink", href: entryHref(x) }, x.title, el("div", { class: "note" }, topicOf(x.file)?.title || x.file))) : [el("p", { class: "empty" }, `nothing references ${e.file}`)]));
  // the thoughts this entry is a step of — in the graph of the scope, friends and path included
  const mine = entryThoughts(e);
  const resting = new Set(); for (const { t, i } of mine) if (t.ins.shaky.some((x) => x.i === i)) for (const j of t.steps.slice(i + 1)) resting.add(j);
  if (resting.size) d.append(el("h3", {}, `Linked after this (${resting.size})`), el("p", { class: "note" }, `This entry is in question (${e.status}); these later entries are linked after it — check whether they depend on it.`), ...[...resting].map((n) => el("a", { class: "backlink", href: n.href }, n.label, el("div", { class: "note" }, projOf(n)))));
  if (mine.length) d.append(el("h3", {}, `In thoughts (${mine.length})`), ...mine.map(({ t, i }) => el("a", { class: "backlink", href: thoughtHref(t), title: t.steps.map((n) => n.label).join("\n→ ") },
    `${shortLabel(t.steps[0])} → ${shortLabel(t.steps[t.steps.length - 1])}`,
    el("div", { class: "note" }, `step ${i + 1} of ${t.steps.length}${t.evolution ? " · evolution" : ""}${t.ends.length ? " · continues ↗" : ""}${t.ins.weakOrigin ? ` · starts ${t.ins.weakOrigin}` : ""}${t.ins.affected.includes(i) ? " · after a step in question" : ""}`))));
  if (e.refs.length) d.append(el("h3", {}, "References"), ...e.refs.map((f) => el("a", { class: "backlink", href: `#topic/${f}` }, topicOf(f)?.title || f)));
  if (e.findings.length) d.append(el("h3", {}, "Linter"), ...e.findings.map((f) => el("div", { class: "finding" }, pill(f.code, `sev-${f.severity}`), ` line ${f.line}: ${f.message}`)));
  renderDetailsNeighbourhood(e);
}
function renderDetailsDefault() {
  const d = $("#details"); d.replaceChildren();
  const route = location.hash.slice(1) || "overview";
  if (route === "graph" || route === "graph/family") {
    d.append(el("div", { id: "thoughts" }));
    renderThoughts(scope() === "family" ? (fgraph && Date.now() - fgraph.at < 30000 ? fgraph : null) : graph);
    d.append(el("h3", {}, "Legend"), el("div", { class: "legend-list" },
      scope() === "family" ? [
        el("span", {}, el("i", { class: "dot", style: "background:var(--bg);border:3px solid var(--accent);width:12px;height:12px" }), "project — a ring in its colour; its topics take the same colour"),
        el("span", {}, "thick dashed line — parent and child project"),
        el("span", {}, "coloured line — a See between two entries, within a project or across"),
        el("span", {}, "grey dashed line — Superseded by"),
        el("span", {}, "with entries hidden, references between projects are drawn between their topics")] : null,
      el("span", {}, el("i", { class: "dot", style: "background:var(--accent);width:12px;height:12px" }), "topic — size follows its entry count"),
      el("span", {}, el("i", { class: "dot confirmed" }), "entry, Evidence confirmed"), el("span", {}, el("i", { class: "dot inferred" }), "entry, Evidence inferred"), el("span", {}, el("i", { class: "dot unknown" }), "entry, Evidence unknown"),
      el("span", {}, el("i", { class: "dot", style: "background:transparent;border:1.5px solid var(--fg3)" }), "superseded — hollow"),
      el("span", {}, el("i", { class: "dot", style: "background:var(--bg);border:1.5px solid var(--open)" }), "ring — open, needs review, pending"),
      el("span", {}, "solid line — a reference between topics; dotted — membership"),
      el("span", {}, el("i", { class: "dot", style: "background:transparent;border:2px dashed var(--fg3);width:10px;height:10px" }), "friend — a repository cited outside the family, loaded with friends (N) in the graph; a click on its hub shows all of it"),
      el("span", {}, el("i", { class: "dot", style: "background:transparent;border:2px dotted var(--fg3);width:10px;height:10px" }), "path — a project you walked through to get here, numbered in order; a click goes back there")),
      el("h3", {}, "Keys"), el("p", { class: "note" }, el("kbd", {}, "/"), " search · ", el("kbd", {}, "g"), " graph · ", el("kbd", {}, "o"), " overview · ", el("kbd", {}, "q"), " queues · ", el("kbd", {}, "t"), " timeline · ", el("kbd", {}, "a"), " authors · ", el("kbd", {}, "l"), " findings"));
    return;
  }
  d.dataset.pane = "graph";
  miniGraph(d, {});
}
function renderDetailsNeighbourhood(e) { miniGraph($("#details"), { entry: e }); }
// The side-pane graph: the neighbourhood of an entry or topic, the whole
// project, or the whole family — a switch in its corner, remembered per
// browser. Family is offered where the family scope is (live, public).
// An explicit choice in the corner of the side pane's graph; until then — and
// again after every scope change — it follows the page: the neighbourhood of
// the entry or topic shown, else the scope (the project, or the whole family).
let MINI = null;
function miniGraph(d, ctx) {
  const focusId = ctx.entry ? `e:${ctx.entry.id}` : ctx.topic ? `t:${ctx.topic.file}` : null;
  if (narrow()) { d.append(el("h3", {}, "Graph"), el("a", { class: "backlink", href: "#graph" }, "Open the project graph →")); return; }
  const modes = [...(focusId ? ["near"] : []), "project", ...(canFamily() ? ["family"] : [])];
  const mode = MINI && modes.includes(MINI) ? MINI : focusId ? "near" : scope() === "family" && modes.includes("family") ? "family" : "project";
  const box = el("div", { class: `mini ${focusId ? "tall" : "fill"}` });
  const seg = el("span", { class: "mini-seg" }, modes.length > 1 ? modes.map((m) => el("button", { type: "button", class: m === mode ? "on" : "", title: { near: "this entry's or topic's neighbourhood", project: "the whole project", family: "the whole family tree" }[m], onclick: () => { MINI = m; const keep = d.querySelector(".mini"); const h = keep?.previousElementSibling?.tagName === "H3" ? keep.previousElementSibling : null; h?.remove(); keep?.remove(); miniGraph(d, ctx); } }, m)) : el("span", { class: "mini-title" }, "graph"));
  const canvas = el("canvas");
  // one click to the full graph: the same level, centred on the entry or topic shown
  const full = el("button", { type: "button", class: "mini-open", title: "open the full graph — the same level, centred on what is shown here",
    onclick: () => {
      if (mode === "family") setScope("family", { rerender: false });
      GRAPH_CENTER = ctx.entry ? { entry: ctx.entry } : ctx.topic ? { topic: ctx.topic } : null;
      if (ctx.entry?.uuid) { focusStep(ctx.entry.uuid); setTimeout(() => { if (STEP_FOCUS === ctx.entry.uuid) focusStep(null); }, 4000); }
      location.hash = "#graph";
    } }, "⤢ full graph");
  box.append(canvas, seg, el("span", { class: "mini-hint" }, mode === "near" ? "click to open" : "hover · click"), full);
  if (focusId) d.append(el("h3", {}, "Graph"));
  d.append(box);
  const opts = { mini: true, focusId };
  if (mode === "near") {
    // friends live at the project level: the control switches there (the family level with the family scope) and loads them
    const n = friendCandidates(S.entries.filter((e) => (e.project || null) === (ctx.entry?.project || ctx.topic?.project || null))).length;
    const up = modes.includes("family") && scope() === "family" ? "family" : "project";
    if (n || hasFamily()) box.append(el("span", { class: "mini-seg mini-friends" }, el("button", { type: "button", title: `show the friends — switches to the ${up} level`,
      onclick: () => { MINI = up; FRIENDS.load = true; setFriendsAuto(true); render(); } }, n ? `friends (${n})` : "friends")));
    return requestAnimationFrame(() => runGraph(canvas, ctx.entry ? buildSubgraph(ctx.entry) : buildTopicSubgraph(ctx.topic), opts));
  }
  if (mode === "project") { const g = buildGraph(ctx.entry?.project || ctx.topic?.project || null); const f = miniFriends(g); if (f) box.append(f); return requestAnimationFrame(() => runGraph(canvas, g, opts)); }
  // family: the family graph's nodes, in a view of its own (its own zoom, entries shown)
  const note = el("span", { class: "mini-hint", style: "top:28px;bottom:auto" }, "loading the family…"); box.append(note);
  const show = (fg) => { note.remove(); if (!canvas.isConnected) return; const f = miniFriends(fg); if (f) box.append(f); runGraph(canvas, { ...fg, scale: 1, ox: 0, oy: 0, showEntries: true, showLabels: true, raf: null, wake: null, alpha: Math.max(fg.alpha, 0.3) }, opts); };
  if (fgraph && Date.now() - fgraph.at < 30000) requestAnimationFrame(() => show(fgraph));
  else buildFamilyGraph().then(show);
}
// ---------------------------------------------------------------- graph (canvas force layout, no library)
let graph = null; // the full graph persists across re-renders so positions survive live updates
let GRAPH_CENTER = null; // { entry } or { topic }: centre the full graph there once, coming from the side pane
function seedNode(n, prev) {
  const p = prev[n.id];
  if (p) Object.assign(n, { x: p.x, y: p.y, vx: 0, vy: 0, fixed: p.fixed });
  else { n.x = (Math.random() - 0.5) * 600; n.y = (Math.random() - 0.5) * 400; n.vx = n.vy = 0; }
  return n;
}
function assemble(topics, entries, prev = {}) {
  const nodes = []; const links = []; const index = {};
  const add = (n) => { index[n.id] = nodes.length; nodes.push(seedNode(n, prev)); };
  for (const t of topics) add({ id: `t:${t.file}`, kind: "topic", label: t.title, file: t.file, r: 10 + Math.sqrt(t.entries) * 3.2, href: `#topic/${t.file}` });
  for (const e of entries) add({ id: `e:${e.id}`, kind: "entry", label: e.title, file: e.file, entry: e, r: 4.2, href: entryHref(e) });
  for (const e of entries) {
    if (index[`t:${e.file}`] != null) links.push({ s: index[`e:${e.id}`], t: index[`t:${e.file}`], kind: "member", len: 46 });
    for (const f of e.refs) if (index[`t:${f}`] != null) links.push({ s: index[`e:${e.id}`], t: index[`t:${f}`], kind: "ref", len: 120 });
  }
  const seen = new Set();
  for (const t of topics) for (const f of t.refs_out) { if (index[`t:${f}`] == null) continue; const k = [t.file, f].sort().join("|"); if (seen.has(k)) continue; seen.add(k); links.push({ s: index[`t:${t.file}`], t: index[`t:${f}`], kind: "topic", len: 170 }); }
  // See and Superseded by between entries, by Id; between their topics while entries are hidden
  const tpairs = new Set();
  for (const x of linkFamily([{ key: "self", role: "self", state: { entries } }]).xrefs) {
    const a = entries.find((e) => e.id === x.from.id), b = entries.find((e) => e.id === x.to.id);
    const s = index[`e:${x.from.id}`], t = index[`e:${x.to.id}`];
    if (s == null || t == null) continue;
    links.push({ s, t, kind: x.kind, len: 150 });
    const ts = index[`t:${a.file}`], tt = index[`t:${b.file}`]; const k = `${ts}|${tt}`;
    if (a.file !== b.file && ts != null && tt != null && !tpairs.has(k)) { tpairs.add(k); links.push({ s: ts, t: tt, kind: "xtopic", len: 200 }); }
  }
  return { nodes, links, index };
}
// the Ids an entry points at, and the entries of `list` that point at it
const pointsAt = (e) => [...(e.see || []).map((r) => r?.uuid), e.superseded_by ? parseSupersededBy(e.superseded_by)?.uuid : null].filter(Boolean);
const linkedTo = (e, list) => list.filter((x) => x !== e && ((e.uuid && pointsAt(x).includes(e.uuid)) || (x.uuid && pointsAt(e).includes(x.uuid))));
function buildGraph(project = null) {
  const prev = graph ? Object.fromEntries(graph.nodes.map((n) => [n.id, n])) : {};
  const entries = S.entries.filter((e) => (e.project || null) === project);
  graph = Object.assign(graph || { scale: 1, ox: 0, oy: 0, showEntries: true, showLabels: true, alpha: 1 }, assemble(S.topics.filter((t) => (t.project || null) === project), entries, prev));
  graph.friends = project ? [] : friendCandidates(entries);
  autoFriends(graph);
  addFriendLayer(graph, prev);
  graph.alpha = Math.max(graph.alpha, 0.6);
  return graph;
}
function buildTopicSubgraph(t) {
  // the topic with its entries, plus the topics it references and the ones referencing it (with the entries that do)
  const files = new Set([t.file, ...t.refs_out, ...t.refs_in]);
  const topics = S.topics.filter((x) => files.has(x.file));
  const entries = S.entries.filter((x) => x.file === t.file || x.refs.includes(t.file));
  const prev = graph ? Object.fromEntries(graph.nodes.map((n) => [n.id, n])) : {};
  return Object.assign({ scale: 1, ox: 0, oy: 0, showEntries: true, showLabels: true, alpha: 1 }, assemble(topics, entries, prev));
}
function buildSubgraph(e) {
  // the entry, its topic and siblings, the topics it references, and the entries elsewhere that reference its topic
  const files = new Set([e.file, ...e.refs]);
  const back = S.entries.filter((x) => x.refs.includes(e.file));
  const linked = linkedTo(e, S.entries); // See / Superseded by, either direction
  for (const b of [...back, ...linked]) files.add(b.file);
  const topics = S.topics.filter((t) => files.has(t.file));
  const entries = S.entries.filter((x) => x.file === e.file || x.id === e.id || back.includes(x) || linked.includes(x));
  const prev = graph ? Object.fromEntries(graph.nodes.map((n) => [n.id, n])) : {};
  return Object.assign({ scale: 1, ox: 0, oy: 0, showEntries: true, showLabels: true, alpha: 1 }, assemble(topics, entries, prev));
}
// The family graph: every project of the tree as a hub in its own colour,
// its topics and entries around it, parent and child projects joined, and
// the See and Superseded by lines between entries drawn across projects.
let fgraph = null; // kept across re-renders so positions survive live updates
const memberLink = (m, hash) => m.role === "self" ? hash : PUBLISHED() ? publicHref(m.canonical, m.root || "", hash) : `${location.pathname}?project=${encodeURIComponent(m.key)}${hash}`;
async function buildFamilyGraph() {
  const pool = await searchPool("family");
  const groups = pool.groups.map((g, i) => ({
    g, key: g.member.role === "self" ? "self" : g.member.key || `${g.member.canonical}|${g.member.root || ""}`,
    canonical: g.state.project?.canonical || g.member.canonical || (g.member.role === "self" ? canonicalOf(S.project) : ""),
    root: g.state.project?.root || g.member.root || (g.member.role === "self" ? MY_ROOT() : ""),
    role: g.member.role, state: g.state, color: i === 0 ? color0() : PALETTE[i % PALETTE.length],
  }));
  const { parentOf, xrefs } = linkFamily(groups);
  const prev = fgraph ? Object.fromEntries(fgraph.nodes.map((n) => [n.id, n])) : {};
  const nodes = []; const links = []; const index = {};
  const add = (n, near) => {
    const p = prev[n.id];
    if (p) Object.assign(n, { x: p.x, y: p.y, vx: 0, vy: 0, fixed: p.fixed });
    else { n.x = (near?.x || 0) + (Math.random() - 0.5) * 140; n.y = (near?.y || 0) + (Math.random() - 0.5) * 140; n.vx = n.vy = 0; }
    index[n.id] = nodes.length; nodes.push(n); return n;
  };
  // this project keeps the local graph's ids, so the selected entry and the positions carry over
  const tid = (G, file) => (G.key === "self" ? `t:${file}` : `t:${G.key}:${file}`);
  const eid = (G, id) => (G.key === "self" ? `e:${id}` : `e:${G.key}:${id}`);
  const R = groups.length > 1 ? 220 + 45 * groups.length : 0;
  groups.forEach((G, i) => {
    const ang = (2 * Math.PI * i) / groups.length;
    const hub = add({ id: `p:${G.key}`, kind: "project", label: G.g.member.name, r: 15, color: G.color, href: memberLink(G.g.member, "#overview"), walk: () => go(memberLink(G.g.member, G.key === "self" ? "#overview" : "#graph")) }, { x: R * Math.cos(ang), y: R * Math.sin(ang) });
    for (const t of G.state.topics || []) {
      const n = add({ id: tid(G, t.file), kind: "topic", label: t.title, file: t.file, color: G.color, r: 8 + Math.sqrt(t.entries || 0) * 2.8, href: memberLink(G.g.member, `#topic/${t.file}`) }, hub);
      links.push({ s: index[hub.id], t: index[n.id], kind: "hub", len: 80 });
    }
    for (const e of G.state.entries || []) {
      const t = nodes[index[tid(G, e.file)]];
      add({ id: eid(G, e.id), kind: "entry", proj: G.g.member.name, label: e.title, file: e.file, entry: e, r: 4.2, href: G.key === "self" ? entryHref(e) : G.g.href(e) }, t || hub);
    }
    for (const e of G.state.entries || []) {
      const me = index[eid(G, e.id)];
      if (index[tid(G, e.file)] != null) links.push({ s: me, t: index[tid(G, e.file)], kind: "member", len: 42 });
      for (const f of e.refs || []) if (index[tid(G, f)] != null) links.push({ s: me, t: index[tid(G, f)], kind: "ref", len: 110 });
    }
    const seen = new Set();
    for (const t of G.state.topics || []) for (const f of t.refs_out || []) { if (index[tid(G, f)] == null) continue; const k = [t.file, f].sort().join("|"); if (seen.has(k)) continue; seen.add(k); links.push({ s: index[tid(G, t.file)], t: index[tid(G, f)], kind: "topic", len: 150 }); }
  });
  for (const [child, parent] of Object.entries(parentOf)) if (index[`p:${child}`] != null && index[`p:${parent}`] != null) links.push({ s: index[`p:${child}`], t: index[`p:${parent}`], kind: "family", len: 260 });
  const byKey = Object.fromEntries(groups.map((G) => [G.key, G]));
  const entryOf = (G, id) => (G.state.entries || []).find((e) => e.id === id);
  const topicPairs = new Set(); let across = 0;
  for (const x of xrefs) {
    const A = byKey[x.from.key], B = byKey[x.to.key];
    const s = index[eid(A, x.from.id)], t = index[eid(B, x.to.id)];
    if (s == null || t == null) continue;
    links.push({ s, t, kind: x.kind, len: 170, color: A.color });
    if (x.from.key === x.to.key) continue;
    across++;
    // the same reference between the two topics, for the view with entries hidden
    const ts = index[tid(A, entryOf(A, x.from.id)?.file)], tt = index[tid(B, entryOf(B, x.to.id)?.file)];
    const k = `${ts}|${tt}`;
    if (ts != null && tt != null && !topicPairs.has(k)) { topicPairs.add(k); links.push({ s: ts, t: tt, kind: "xtopic", len: 220, color: A.color }); }
  }
  fgraph = Object.assign(fgraph || { scale: 0.7, ox: 0, oy: 0, showEntries: true, showLabels: true, alpha: 1 }, { nodes, links, index, groups, missing: pool.missing, across, at: Date.now() });
  fgraph.friends = friendCandidates(groups.flatMap((G) => G.state.entries || []), [...groups.map((G) => G.canonical), ...pool.missing.map(({ member: m }) => m.canonical)]);
  autoFriends(fgraph);
  addFriendLayer(fgraph, prev);
  fgraph.alpha = Math.max(fgraph.alpha, 0.6);
  return fgraph;
}
const color0 = () => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#835bec";
// ---------------------------------------------------------------- friends
// Friends: repositories outside the family that the entries in the graph
// cite by a cross-project See or Superseded by. Nothing is loaded until a
// person clicks *friends* in the graph, in every mode; then each is loaded
// the way a reference row resolves it (a project known to the live server,
// else the repository's published export), one level deep — a friend's own
// friends are not followed. A friend is linked into the graph, never merged:
// search, queues, counts and the other views stay with the project or family.
// Its hub shows the entries cited there; a click on the hub shows all of it.
const FRIENDS = { on: false, loaded: {}, pending: {}, expanded: new Set(), load: false, loading: false };
// Loaded as soon as a graph shows them, by default (few projects have many
// friends yet); *friends* unchecked turns that off, kept per browser — then a
// click on *friends (N)* loads them.
let FRIENDS_AUTO = (() => { try { return localStorage.getItem("ktw-friends") !== "off"; } catch { return true; } })();
// every entry of every friend, not only what links to this graph — off by default, kept per browser
let FRIEND_ENTRIES = (() => { try { return localStorage.getItem("ktw-friend-entries") === "all"; } catch { return false; } })();
function setFriendEntries(on) { FRIEND_ENTRIES = on; try { localStorage.setItem("ktw-friend-entries", on ? "all" : "linked"); } catch {} }
function setFriendsAuto(on) { FRIENDS_AUTO = on; try { localStorage.setItem("ktw-friends", on ? "on" : "off"); } catch {} }
function autoFriends(g) {
  if (!FRIENDS_AUTO || FRIENDS.loading) return;
  const list = g.friends || []; if (!list.length) return;
  const waiting = list.filter((f) => !FRIENDS.loaded[fkey(f.canonical)]);
  if (FRIENDS.on && !waiting.length) return;
  FRIENDS.loading = true;
  setTimeout(() => loadFriends(FRIENDS.on ? waiting : list).finally(() => { FRIENDS.loading = false; }), 0); // after the graph that asked is drawn
} // loaded: key -> {state, name, href(e), topicHref(file), open} | {error}
const fkey = (c) => String(c || "").replace(/\/+$/, "").toLowerCase();
const friendColor = (i) => PALETTE[(i + 5) % PALETTE.length];
function friendCandidates(entries, family = []) {
  const p = SELF?.project || {}; const base = canonicalOf(p); const root = MY_ROOT();
  const declared = [p.parent, ...(p.children || []).map((c) => c.location)].map((l) => resolveLocation(l, base, root)?.canonical);
  return friendsOf(entries, [base, ...declared, ...(TREE || []).map((m) => m.canonical), ...family]);
}
function loadFriend(f) {
  const k = fkey(f.canonical);
  if (FRIENDS.loaded[k]) return Promise.resolve(FRIENDS.loaded[k]);
  return (FRIENDS.pending[k] ||= (async () => {
    let r = null;
    if (LIVE()) {
      try {
        const res = await fetch(`/api/entry?uuid=${encodeURIComponent(f.uuids[0])}${PROJECT ? `&project=${encodeURIComponent(PROJECT)}` : ""}`, { cache: "no-store" });
        if (res.ok) {
          const hit = await res.json(); const m = await memberState(hit.project);
          if (m.state) r = { ...liveMember({ key: hit.project, name: m.state.project?.id, role: "self" }, m.state), name: m.state.project?.id || repoLabel(f.canonical) };
        }
      } catch { /* not known here: the published export */ }
    }
    if (!r) {
      const p = await fetchPublicState(f.canonical, "");
      r = p.state ? { ...publicMember({ canonical: f.canonical, root: "", name: repoLabel(f.canonical), role: "self" }, p.state) } : { error: p.error };
    }
    r.canonical = f.canonical;
    // a family is one unit, like a repository: a friend that has one comes with all of it
    if (r.state) r.members = await friendUnit(r);
    return (FRIENDS.loaded[k] = r);
  })());
}
// One member of a friend's unit, however it was found
function liveMember(m, state) {
  const at = (hash) => `${location.pathname}?project=${encodeURIComponent(m.key)}${hash}`;
  return { key: `L:${m.key}`, name: m.name || state.project?.id || m.key, role: m.role, state, canonical: canonicalOf(state.project) || m.canonical || "", root: state.project?.root || "",
    href: (e) => at(entryHref(e)), topicHref: (file) => at(`#topic/${file}`), open: at("#graph"), centre: { mode: "live", project: m.key } };
}
function publicMember(m, state) {
  return { key: `P:${fkey(m.canonical)}|${m.root || ""}`, name: m.name, role: m.role, state, canonical: m.canonical, root: m.root || "",
    href: (e) => publicHref(m.canonical, m.root || "", entryHref(e)), topicHref: (file) => publicHref(m.canonical, m.root || "", `#topic/${file}`), open: publicHref(m.canonical, m.root || "", "#graph"), centre: { mode: "public", canonical: m.canonical, root: m.root || "" } };
}
// The friend's whole family tree — on the live server what it knows about that
// project, else the members' published exports; members that cannot be read
// are left out of the unit (the friend itself is always in it).
async function friendUnit(r) {
  const p = r.state.project || {};
  const self = { ...r };
  if (!p.parent && !(p.children || []).length) return [self];
  const out = [self];
  if (r.centre?.mode === "live") {
    try {
      const members = ((await (await fetch(`/api/family?project=${encodeURIComponent(r.centre.project)}&tree=1`, { cache: "no-store" })).json()).members || []).filter((m) => m.role !== "self" && m.key);
      const states = await Promise.all(members.map((m) => memberState(m.key)));
      members.forEach((m, i) => { if (states[i].state) out.push(liveMember(m, states[i].state)); });
      return out;
    } catch { /* fall back to the published exports */ }
  }
  const t = await publicTreeFrom({ state: r.state, canonical: r.canonical, root: p.root || "", name: r.name, href: r.href });
  for (const g of t.groups) if (g.member.role !== "self") out.push(publicMember(g.member, g.state));
  return out;
}

async function loadFriends(list) {
  if (LIVE()) await fetchTree(); // the whole family is known before anything counts as a friend
  FRIENDS.on = true; FRIENDS.loading = true;
  await Promise.all(list.map(loadFriend));
  FRIENDS.loading = false; // before the render, so the controls show the result
  if (fgraph) fgraph.at = 0;
  render();
}
function toggleFriend(k) {
  if (FRIENDS.expanded.has(k)) FRIENDS.expanded.delete(k); else FRIENDS.expanded.add(k);
  if (fgraph) fgraph.at = 0;
  render();
}
// Linked projects in the graph: friends and the path. Each item is a unit —
// one repository, or a whole family, which is one unit like a repository —
// drawn as a hub per project (joined by their parent lines) with some of its
// entries: the ones that link to what the graph shows, or all of them once a
// friend's hub is expanded. See and Superseded by join them to the graph and
// to each other, both ways, a reference counting only when it names one of
// the unit's repositories and an Id there. Called by buildGraph and
// buildFamilyGraph after their own nodes.
const unitKey = (members) => members.map((m) => m.key).sort().join(" ");
// an entry's See and Superseded by, each { uuid, remote, kind }
const entryRefs = (e) => [...(e.see || []).map((x) => x && { uuid: x.uuid, remote: x.remote, kind: "see" }), e.superseded_by ? { ...parseSupersededBy(e.superseded_by), kind: "superseded" } : null].filter((x) => x?.uuid);
function friendUnits(g) {
  // friends of one family are one unit: the Ids cited in any of its repositories together
  const units = new Map();
  const add = (f, via) => {
    const r = FRIENDS.loaded[fkey(f.canonical)];
    if (!r?.state || onPath(f.canonical)) return;
    const members = r.members || [r];
    const k = unitKey(members);
    if (!units.has(k)) units.set(k, { k, r, members, uuids: new Set(), via });
    const u = units.get(k); if (via === "friend") u.via = "friend";
    for (const x of f.uuids) u.uuids.add(x);
  };
  if (FRIENDS.on) (g.friends || []).forEach((f) => add(f, "friend"));
  for (const f of CHAIN.extra.values()) add(f, "chain"); // reached by following a thought
  return [...units.values()];
}
function addFriendLayer(g, prev) {
  const items = [];
  const trail = pathShown() ? TRAIL.filter((t) => !sameCentreAsGraph(g, t)) : [];
  trail.forEach((t, i) => items.push({
    k: `trail:${t.key}`, kind: "trail", color: PALETTE[(i + 2) % PALETTE.length], cited: "linked",
    members: [{ key: t.key, name: `${i + 1} · ${t.name}`, state: t.state, canonical: t.canonical, root: t.state.project?.root || "", href: (e) => t.url + entryHref(e), topicHref: (file) => `${t.url}#topic/${file}`, open: `${t.url}#graph` }],
    hub: () => moveTo(t, "#graph"), entry: () => (e) => moveTo(t, entryHref(e)), topic: () => (file) => moveTo(t, `#topic/${file}`),
    next: i + 1 < trail.length ? `trail:${trail[i + 1].key}` : null,
  }));
  friendUnits(g).forEach((u, i) => items.push({
    k: u.k, kind: "friend", chain: u.via === "chain", color: friendColor(i), cited: FRIEND_ENTRIES || FRIENDS.expanded.has(u.k) ? null : u.uuids, members: u.members,
    hub: () => toggleFriend(u.k),
    entry: (m) => (m.centre ? (e) => moveTo({ centre: m.centre, state: m.state }, entryHref(e)) : null),
    topic: (m) => (m.centre ? (file) => moveTo({ centre: m.centre, state: m.state }, `#topic/${file}`) : null),
  }));
  if (items.length) addLinkedLayer(g, prev, items);
}
function addLinkedLayer(g, prev, items) {
  const { nodes, links, index } = g;
  let unit = null; // the item being placed: its nodes keep together, and apart from the graph's own and the other items'
  const add = (n, near) => {
    const p = prev[n.id];
    if (p) Object.assign(n, { x: p.x, y: p.y, vx: 0, vy: 0, fixed: p.fixed });
    else { n.x = (near?.x || 0) + (Math.random() - 0.5) * 120; n.y = (near?.y || 0) + (Math.random() - 0.5) * 120; n.vx = n.vy = 0; }
    n.unit = unit; n.ext = true;
    index[n.id] = nodes.length; nodes.push(n); return n;
  };
  const refsOf = entryRefs;
  const ours = nodes.filter((n) => n.kind === "entry");
  const ourUuids = new Set(ours.map((n) => n.entry.uuid).filter(Boolean));
  const pool = new Set(ours.map((n) => n.entry.uuid).filter(Boolean));
  for (const it of items) for (const m of it.members) for (const e of m.state.entries || []) if (e.uuid) pool.add(e.uuid);
  const R = 680 + 40 * items.length;
  const placed = [];
  items.forEach((it, i) => {
    const col = it.color;
    const canons = new Set(it.members.map((m) => fkey(m.canonical)).filter(Boolean));
    const unitUuids = new Set(it.members.flatMap((m) => (m.state.entries || []).map((e) => e.uuid).filter(Boolean)));
    let cited = it.cited; // null: all of the unit (an expanded friend)
    if (cited !== null) {
      const seeds = new Set(cited === "linked" ? [] : cited);
      if (cited === "linked") { // a path's step: what links to the rest — the graph's entries, the friends', the other steps'
        for (const m of it.members) for (const e of m.state.entries || []) if (e.uuid && refsOf(e).some((x) => pool.has(x.uuid) && !unitUuids.has(x.uuid))) seeds.add(e.uuid);
        for (const n of ours) for (const x of refsOf(n.entry)) if (unitUuids.has(x.uuid) && (!x.remote || canons.has(fkey(x.remote)))) seeds.add(x.uuid);
        for (const o of items) if (o !== it) for (const m of o.members) for (const e of m.state.entries || []) for (const x of refsOf(e)) if (unitUuids.has(x.uuid) && x.remote && canons.has(fkey(x.remote))) seeds.add(x.uuid);
      }
      // the unit's entries that cite the graph belong to it too
      for (const m of it.members) for (const e of m.state.entries || []) if (e.uuid && refsOf(e).some((x) => x.remote && ourUuids.has(x.uuid))) seeds.add(e.uuid);
      // and everything a See or Superseded by chain inside the unit connects to them, so a thought runs through the unit whole
      const adj = new Map(); const tie = (a, b) => { if (!adj.has(a)) adj.set(a, new Set()); if (!adj.has(b)) adj.set(b, new Set()); adj.get(a).add(b); adj.get(b).add(a); };
      for (const m of it.members) for (const e of m.state.entries || []) if (e.uuid) for (const x of refsOf(e)) if (unitUuids.has(x.uuid) && (!x.remote || canons.has(fkey(x.remote)))) tie(e.uuid, x.uuid);
      const stack = [...seeds];
      while (stack.length) { const u = stack.pop(); for (const v of adj.get(u) || []) if (!seeds.has(v)) { seeds.add(v); stack.push(v); } }
      cited = seeds;
    }
    const ang = (2 * Math.PI * i) / items.length + Math.PI / 5;
    const centre = { x: R * Math.cos(ang), y: R * Math.sin(ang) };
    unit = it.k;
    const idx = {}; // uuid -> node index, across the unit
    const hubs = {};
    const entriesShown = [];
    it.members.forEach((m, j) => {
      const off = it.members.length > 1 ? { x: centre.x + 110 * Math.cos((2 * Math.PI * j) / it.members.length), y: centre.y + 110 * Math.sin((2 * Math.PI * j) / it.members.length) } : centre;
      // the hub expands a friend (or goes back along the path); its name goes to that project
      const walk = it.kind === "trail" ? it.hub : m.centre ? () => moveTo({ centre: m.centre, state: m.state }, "#graph") : m.open ? () => go(m.open) : null;
      const hub = add({ id: `f:${it.k}:${m.key}`, kind: "project", friend: it.kind === "friend", chain: !!it.chain, trail: it.kind === "trail", label: m.name, r: j === 0 ? 13 : 10, color: col, href: m.open || "#graph", action: it.hub, walk }, off);
      hubs[m.key] = index[hub.id];
      const own = (m.state.entries || []).filter((e) => !cited || (e.uuid && cited.has(e.uuid)));
      const files = new Set(own.map((e) => e.file));
      const tIdx = {};
      for (const t of m.state.topics || []) {
        if (cited && !files.has(t.file)) continue;
        const act = it.topic(m);
        const n = add({ id: `ft:${it.k}:${m.key}:${t.file}`, kind: "topic", label: t.title, file: t.file, color: col, r: 7 + Math.sqrt(t.entries || 0) * 2.4, href: m.topicHref ? m.topicHref(t.file) : "#graph", action: act ? () => act(t.file) : null }, hub);
        tIdx[t.file] = index[n.id];
        links.push({ s: index[hub.id], t: tIdx[t.file], kind: "hub", len: 70 });
      }
      for (const e of own) {
        const act = it.entry(m);
        const n = add({ id: `fe:${it.k}:${m.key}:${e.id}`, kind: "entry", proj: m.name, label: e.title, file: e.file, entry: e, r: 4.2, href: m.href ? m.href(e) : "#graph", action: act ? () => act(e) : null }, nodes[tIdx[e.file]] || hub);
        if (e.uuid) idx[e.uuid] = index[n.id];
        if (tIdx[e.file] != null) links.push({ s: index[n.id], t: tIdx[e.file], kind: "member", len: 40 });
        entriesShown.push(e);
      }
    });
    // the unit's own shape: each project joined to its parent, as in the family graph
    if (it.members.length > 1) {
      const { parentOf } = linkFamily(it.members.map((m) => ({ key: m.key, role: m.role === "self" ? "self" : m.role || "relative", canonical: m.canonical, root: m.root, state: m.state })));
      for (const [child, parent] of Object.entries(parentOf)) if (hubs[child] != null && hubs[parent] != null) links.push({ s: hubs[child], t: hubs[parent], kind: "family", len: 170 });
    }
    placed.push({ it, canons, idx, col, entries: entriesShown, firstHub: hubs[it.members[0].key] });
  });
  // See and Superseded by between any two placed units and the graph, both ways; between their topics while entries are hidden
  const topicOfNode = {}; for (const l of links) if (l.kind === "member") topicOfNode[l.s] = l.t;
  const joined = new Set(); const pairs = new Set();
  const join = (s, t, kind, col) => {
    if (s == null || t == null || s === t) return;
    const key = `${s}|${t}|${kind}`; if (joined.has(key)) return; joined.add(key);
    links.push({ s, t, kind, len: 240, color: col });
    const ts = topicOfNode[s], tt = topicOfNode[t];
    if (ts != null && tt != null && ts !== tt && !pairs.has(`${ts}|${tt}`)) { pairs.add(`${ts}|${tt}`); links.push({ s: ts, t: tt, kind: "xtopic", len: 240, color: col }); }
  };
  const byUuid = {}; for (const n of ours) if (n.entry.uuid) byUuid[n.entry.uuid] = index[n.id];
  for (const P of placed) {
    for (const n of ours) for (const x of refsOf(n.entry)) if (x.remote && P.canons.has(fkey(x.remote)) && P.idx[x.uuid] != null) join(index[n.id], P.idx[x.uuid], x.kind, P.col);
    for (const e of P.entries) {
      const s = P.idx[e.uuid]; if (s == null) continue;
      for (const x of refsOf(e)) {
        if (!x.remote) { if (P.idx[x.uuid] != null) join(s, P.idx[x.uuid], x.kind, P.col); continue; } // within the unit's repository
        if (P.canons.has(fkey(x.remote)) && P.idx[x.uuid] != null) { join(s, P.idx[x.uuid], x.kind, P.col); continue; } // across the unit
        if (byUuid[x.uuid] != null) join(s, byUuid[x.uuid], x.kind, P.col); // citing the graph
        for (const Q of placed) if (Q !== P && Q.canons.has(fkey(x.remote)) && Q.idx[x.uuid] != null) join(s, Q.idx[x.uuid], x.kind, P.col); // citing another unit
      }
    }
    // the walk's order: one step's hub to the next
    if (P.it.next) { const Q = placed.find((q) => q.it.k === P.it.next); if (Q) links.push({ s: P.firstHub, t: Q.firstHub, kind: "trail", len: 360 }); }
  }
}

// ---------------------------------------------------------------- path
// The path: the projects walked through to get here — A to a friend B, from
// B to its friend D, on to Y. A walk changes the centre in place, without a
// reload, so what was loaded stays in memory: the path is those states, kept
// for this tab and this page only. A reload, or a link opened anew, starts
// without one — a link leads to an entry, not to a path. Back and forward
// walk it; a step back shortens it; *discard* clears it; *path* in the graph
// turns keeping it off (kept per browser). The path's projects are hubs in
// the graph, joined in the order walked, with the entries that link them.
let TRAIL = []; // [{ key, centre, state, name, canonical, url }], oldest first; the centre shown is not in it
const VISITED = new Map(); // key -> the same, every centre of this page, for back and forward
let TRAIL_SHOW = true;
let KEEP_PATH = (() => { try { return localStorage.getItem("ktw-path") !== "off"; } catch { return true; } })();
const keepPath = () => KEEP_PATH;
function setKeepPath(on) { KEEP_PATH = on; if (!on) TRAIL = []; try { localStorage.setItem("ktw-path", on ? "on" : "off"); } catch {} }
const pathShown = () => KEEP_PATH && TRAIL_SHOW && TRAIL.length > 0;
const onPath = (canonical) => pathShown() && TRAIL.some((t) => fkey(t.canonical) === fkey(canonical));
// a step of the path that the graph already shows — a member of the family graph — is not drawn twice
const sameCentreAsGraph = (g, t) => (g.groups || []).some((G) => fkey(G.canonical) === fkey(t.canonical) && (G.root || "") === (t.state.project?.root || ""));
const currentCentre = () => (MODE === "public" ? { mode: "public", canonical: PUBLIC, root: PUBLIC_ROOT } : MODE === "export" ? { mode: "export" } : { mode: "live", project: PROJECT });
function centreKey(c) { return c.mode === "public" ? `P:${fkey(c.canonical)}|${c.root || ""}` : c.mode === "export" ? "E" : `L:${c.project || ""}`; }
function centreFromUrl(loc) {
  const q = new URLSearchParams(loc.search);
  if (q.get("public")) return { mode: "public", canonical: q.get("public"), root: q.get("root") || "" };
  return window.__KTW_STATE__ ? { mode: "export" } : { mode: "live", project: q.get("project") };
}
function centreUrl(c) {
  if (c.mode === "public") return `${location.pathname}?public=${encodeURIComponent(c.canonical)}${c.root ? `&root=${encodeURIComponent(c.root)}` : ""}`;
  if (c.mode === "live" && c.project) return `${location.pathname}?project=${encodeURIComponent(c.project)}`;
  return location.pathname;
}
function remember(c, state) {
  const e = { key: centreKey(c), centre: c, state, name: state.project?.id || state.project?.name || repoLabel(canonicalOf(state.project) || ""), canonical: canonicalOf(state.project), url: centreUrl(c) };
  VISITED.set(e.key, e); return e;
}
// Everything that belongs to one centre starts over when the centre moves; the
// fetched states (friends, members, published exports) stay cached.
function setCentre(c, state) {
  MODE = c.mode; PUBLIC = c.mode === "public" ? c.canonical : null; PUBLIC_ROOT = c.mode === "public" ? c.root || "" : ""; PROJECT = c.mode === "live" ? c.project || null : null;
  graph = null; fgraph = null; TREE = null; TREE_AT = 0; TREE_ASKED = false; PUBLIC_TREE = null; LAST_POOL = null;
  FRIENDS.on = false; FRIENDS.expanded.clear(); THOUGHT_PIN = null; MINI = null; CHAIN.extra.clear(); CHAIN.tried.clear();
  if (MODE === "public") state.exported = true;
  connectLive();
  const sel = $("#project-select");
  if (sel && !sel.hidden && MODE === "live") sel.value = PROJECT || SELECTED_DEFAULT || sel.value;
  applyState(state);
}
// Go to another centre whose state is loaded: the path grows by the centre
// left, or — when the target is already on it — goes back to it.
function moveTo(t, hash = "#graph", { push = true } = {}) {
  const target = t.key ? t : remember(t.centre, t.state);
  const here = remember(currentCentre(), SELF);
  if (target.key === here.key) { if (location.hash !== hash) location.hash = hash; return; }
  const i = TRAIL.findIndex((x) => x.key === target.key);
  if (i >= 0) TRAIL = TRAIL.slice(0, i);
  else if (KEEP_PATH) { TRAIL = TRAIL.filter((x) => x.key !== here.key); TRAIL.push(here); }
  else TRAIL = [];
  if (push) history.pushState({ ktw: target.key }, "", target.url + hash);
  setCentre(target.centre, target.state);
}
// Back and forward: a step inside this centre is a hash change (rendered
// there); a step to another centre goes there in place when its state is in
// memory, else the page loads it.
function onPopState() {
  const c = centreFromUrl(location); const key = centreKey(c);
  if (key === centreKey(currentCentre())) return;
  const known = VISITED.get(key);
  if (!known) { location.reload(); return; }
  moveTo(known, location.hash || "#overview", { push: false });
}
// A link to another centre whose state is loaded (a friend, a step of the
// path) goes there in place, so the path grows; anything else loads as a link does.
function stateForUrl(url) {
  const key = centreKey(centreFromUrl(url));
  if (VISITED.has(key)) return VISITED.get(key);
  for (const r of Object.values(FRIENDS.loaded)) for (const m of (r?.state ? r.members || [r] : [])) if (m.centre && centreKey(m.centre) === key) return { centre: m.centre, state: m.state };
  return null;
}
function onLinkClick(ev) {
  if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
  const a = ev.target.closest?.("a[href]"); if (!a || a.target === "_blank") return;
  let url; try { url = new URL(a.getAttribute("href"), location.href); } catch { return; }
  if (url.origin !== location.origin || url.pathname !== location.pathname || url.search === location.search) return;
  const t = stateForUrl(url); if (!t) return;
  ev.preventDefault();
  moveTo(t, url.hash || "#overview");
}
function pathBar() {
  if (!KEEP_PATH || !TRAIL.length) return null;
  const here = SELF?.project?.id || SELF?.project?.name || "";
  const steps = TRAIL.map((t, i) => [el("a", { href: t.url + "#graph", title: `back to ${t.name} — the path shortens to here`, onclick: (ev) => { ev.preventDefault(); moveTo(t, "#graph"); } }, `${i + 1} · ${t.name}`), el("span", { class: "sep" }, " › ")]).flat();
  return el("div", { class: "path-bar" }, el("span", { class: "label" }, "Path "), ...steps, el("b", {}, here),
    el("span", { class: "grow" }),
    el("label", { title: "show the path's projects in the graph" }, el("input", { type: "checkbox", checked: TRAIL_SHOW, onchange: (ev) => { TRAIL_SHOW = ev.target.checked; if (fgraph) fgraph.at = 0; render(); } }), "in graph"),
    el("button", { type: "button", class: "link-btn", title: "forget the path; this project becomes the start", onclick: () => { TRAIL = []; if (fgraph) fgraph.at = 0; render(); } }, "discard"));
}
function friendsUi(g) {
  const list = g.friends || [];
  if (!list.length) return null;
  const waiting = list.filter((f) => !FRIENDS.loaded[fkey(f.canonical)]);
  if (FRIENDS.loading) return el("span", { class: "friends-load note" }, "loading friends…");
  if (!FRIENDS.on || waiting.length) {
    const b = el("button", { class: "link-btn friends-load", title: "load the repositories these entries cite outside the family, now and from here on", onclick: () => { b.disabled = true; b.textContent = "loading friends…"; setFriendsAuto(true); loadFriends(FRIENDS.on ? waiting : list); } }, `friends (${FRIENDS.on ? waiting.length : list.length})`);
    return b;
  }
  return el("span", { class: "friends-ctl" },
    el("label", { class: "friends-toggle", title: "the repositories these entries cite outside the family — unchecked, they are no longer loaded on their own" }, el("input", { type: "checkbox", checked: true, onchange: () => { FRIENDS.on = false; setFriendsAuto(false); if (fgraph) fgraph.at = 0; render(); } }), "friends"),
    el("label", { class: "friend-entries", title: "every entry of every friend, not only the ones that link to this graph" }, el("input", { type: "checkbox", checked: FRIEND_ENTRIES, onchange: (ev) => { setFriendEntries(ev.target.checked); if (fgraph) fgraph.at = 0; render(); } }), "all their entries"));
}
// the same control, small, in the corner of the side pane's graph
function miniFriends(g) {
  const want = FRIENDS.load; FRIENDS.load = false; // asked for from the neighbourhood view: that click is the request
  const list = g.friends || [];
  if (!list.length) return null;
  const waiting = list.filter((f) => !FRIENDS.loaded[fkey(f.canonical)]);
  if (want) { if (!FRIENDS.on || waiting.length) { loadFriends(FRIENDS.on ? waiting : list); return el("span", { class: "mini-seg mini-friends" }, el("button", { type: "button", disabled: true }, "loading…")); } }
  const on = FRIENDS.on && !waiting.length;
  if (FRIENDS.loading && !want) return el("span", { class: "mini-seg mini-friends" }, el("button", { type: "button", disabled: true }, "loading…"));
  const b = el("button", { type: "button", class: on ? "on" : "", title: on ? "hide the friends — they are no longer loaded on their own" : "load the repositories these entries cite outside the family, now and from here on",
    onclick: () => { if (on) { FRIENDS.on = false; setFriendsAuto(false); if (fgraph) fgraph.at = 0; render(); } else { b.disabled = true; b.textContent = "loading…"; setFriendsAuto(true); loadFriends(FRIENDS.on ? waiting : list); } } },
    on ? "friends" : `friends (${FRIENDS.on ? waiting.length : list.length})`);
  return el("span", { class: "mini-seg mini-friends" }, b);
}
// ---------------------------------------------------------------- thoughts
// Thoughts: chains of linked entries through the graph — the longest chains of See
// and Superseded by between entries (each one cites the one before), at least
// four entries long, across projects where the graph spans them (family,
// friends). Listed beside the graph; pointing at one lights its path, a click
// holds it and lists its steps in reading order, origin first. A chain made
// only of Superseded by is how one decision changed over time: an evolution.
let THOUGHT_MIN = (() => { try { return Number(localStorage.getItem("ktw-thought-min")) || 4; } catch { return 4; } })(); // entries a thought has at least, kept per browser
// Every chain in the graph, at least two entries long: the entry-to-entry
// edges in reading order (later → earlier), plus an edge to a placeholder for
// every reference into an entry the page has not loaded — a chain that ends
// in a placeholder goes on beyond this page, before its origin (a See into
// an unloaded repository) or after its newest entry (a Superseded by naming a
// successor there). What cites a chain's newest entry from a repository that
// is not loaded cannot be known; there is no index of the web, by design.
function graphChains(g) {
  const kind = {};
  const edges = [];
  for (const l of g.links) {
    if (l.kind !== "see" && l.kind !== "superseded") continue;
    const a = g.nodes[l.s], b = g.nodes[l.t];
    if (a?.kind !== "entry" || b?.kind !== "entry") continue;
    // later first: a See runs from the entry that cites to the one cited, a Superseded by from the old entry to its successor
    const [later, earlier] = l.kind === "see" ? [a, b] : [b, a];
    edges.push([later.id, earlier.id]); kind[`${later.id}|${earlier.id}`] = l.kind;
  }
  const present = new Set(g.nodes.filter((n) => n.kind === "entry" && n.entry.uuid).map((n) => n.entry.uuid));
  for (const n of g.nodes) {
    if (n.kind !== "entry") continue;
    for (const x of entryRefs(n.entry)) {
      if (!x.remote || present.has(x.uuid)) continue;
      const v = `?${x.remote}|${x.uuid}`;
      edges.push(x.kind === "see" ? [n.id, v] : [v, n.id]);
    }
  }
  const byId = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
  const merged = new Map(); // one chain per run of real entries, its open ends together
  for (const ids of thoughtsOf(edges, 2)) {
    const real = ids.filter((id) => !id.startsWith("?"));
    if (real.length < 2) continue;
    const ends = ids.filter((id) => id.startsWith("?")).map((v) => { const cut = v.lastIndexOf("|"); return { canonical: v.slice(1, cut), uuid: v.slice(cut + 1) }; });
    const key = real.join("|");
    if (!merged.has(key)) {
      const steps = real.map((id) => byId[id]);
      const kinds = real.slice(1).map((id, i) => kind[`${id}|${real[i]}`]);
      merged.set(key, { ids: real, steps, kinds, evolution: kinds.every((k) => k === "superseded"), ends: [], ins: thoughtInsights(steps.map((n) => n.entry), kinds) });
    }
    const t = merged.get(key);
    for (const e of ends) if (!t.ends.some((x) => x.uuid === e.uuid && x.canonical === e.canonical)) t.ends.push(e);
  }
  return [...merged.values()].sort((a, b) => b.steps.length - a.steps.length || a.ids.join().localeCompare(b.ids.join()));
}
// a chain's first entry and steps in question, as marks for a list row
const insightPills = (t) => [
  t.ins?.weakOrigin ? el("span", { class: "pill warn-pill", title: `its first entry's Evidence is ${t.ins.weakOrigin}: where later entries depend on it, they depend on a reason nobody confirmed` }, `starts ${t.ins.weakOrigin}`) : null,
  t.ins?.shaky.length ? el("span", { class: "pill warn-pill", title: t.ins.shaky.map((x) => `step ${x.i + 1}: ${x.why}`).join("\n") + `\n${t.ins.affected.length} later ${t.ins.affected.length === 1 ? "step is" : "steps are"} linked after it` }, "step in question") : null,
];
const span = (t) => (t.ins?.from ? (t.ins.from === t.ins.to ? t.ins.from : `${t.ins.from} → ${t.ins.to}`) : "");
const shortLabel = (n) => { const t = (n?.label || "").replace(/`/g, ""); return t.length > 34 ? t.slice(0, 32) + "…" : t; };
// the thoughts an entry is a step of, with its place in each
function entryThoughts(e) {
  const g = scope() === "family" && fgraph && Date.now() - fgraph.at < 30000 ? fgraph : graph && !e.project ? graph : buildGraph(e.project || null);
  const same = (n) => n.entry === e || (e.uuid && n.entry?.uuid === e.uuid);
  return graphChains(g).filter((t) => t.steps.length >= THOUGHT_MIN || t.ends.length).map((t) => ({ t, i: t.steps.findIndex(same) })).filter((x) => x.i >= 0);
}
// the thoughts (at least THOUGHT_MIN entries), and the shorter chains that go on beyond this page
function graphThoughts(g) {
  const all = graphChains(g);
  return { thoughts: all.filter((t) => t.steps.length >= THOUGHT_MIN), open: all.filter((t) => t.ends.length && t.steps.length < THOUGHT_MIN) };
}
// Following a chain: a click loads exactly the repositories a chain goes on
// into, each as a unit, and again from there, until the chain ends, reaches a
// repository without a published export, or eight hops. Only what lies on the
// chain is loaded, not its friends; it is drawn like a friend, marked as
// reached through a thought.
const CHAIN = { extra: new Map(), tried: new Set(), busy: false }; // canonical key -> { canonical, uuids }
const graphNow = async () => (scope() === "family" ? buildFamilyGraph() : buildGraph());
async function loadEnds(ends) {
  const own = new Set([fkey(canonicalOf(SELF?.project)), ...((fgraph?.groups || []).map((G) => fkey(G.canonical)))]);
  const fresh = [];
  for (const x of ends) {
    const k = fkey(x.canonical);
    if (own.has(k) || CHAIN.tried.has(`${k}|${x.uuid}`)) continue;
    CHAIN.tried.add(`${k}|${x.uuid}`);
    if (!CHAIN.extra.has(k)) CHAIN.extra.set(k, { canonical: x.canonical, uuids: [] });
    const f = CHAIN.extra.get(k); if (!f.uuids.includes(x.uuid)) f.uuids.push(x.uuid);
    if (!fresh.includes(f)) fresh.push(f);
  }
  await Promise.all(fresh.map(loadFriend));
  return fresh.length;
}
async function followChains(pick) {
  if (CHAIN.busy) return;
  CHAIN.busy = true; render();
  try {
    for (let hop = 0; hop < 8; hop++) {
      if (fgraph) fgraph.at = 0;
      const ends = pick(await graphNow());
      if (!ends.length || !(await loadEnds(ends))) break;
    }
  } finally { CHAIN.busy = false; if (fgraph) fgraph.at = 0; render(); }
}
const followAll = () => followChains((g) => { const t = graphThoughts(g); return [...t.thoughts, ...t.open].flatMap((c) => c.ends); });
// one chain, found again after each hop by its newest entry's Id
function followThought(t, then) {
  const anchor = t.anchor || t.steps[t.steps.length - 1].entry.uuid;
  let last = null;
  return followChains((g) => { last = graphChains(g).filter((c) => c.steps.some((n) => n.entry.uuid === anchor)).sort((a, b) => b.steps.length - a.steps.length)[0] || null; return last ? last.ends : []; })
    .then(() => then?.(last));
}
let THOUGHT_PIN = null; // the ids of the held thought, joined
// One step pointed at — in a thought's list of steps, in the reader, on the
// Thoughts page — is marked in every graph on the page.
let STEP_FOCUS = null; // an entry's Id (or node id)
const ACTIVE_GRAPHS = new Set();
function focusStep(ref) { STEP_FOCUS = ref || null; for (const g of ACTIVE_GRAPHS) g.wake?.(); }
const stepHover = (ref) => ({ onmouseenter: () => focusStep(ref), onmouseleave: () => focusStep(null) });
function lightThought(g, t) {
  g.thought = t ? { nodes: new Set(t.steps), pairs: new Set(t.ids.slice(1).map((id, i) => `${id}|${t.ids[i]}`)) } : null;
  g.alpha = Math.max(g.alpha, 0.02); g.wake?.();
}
function renderThoughts(g) {
  const box = $("#thoughts");
  if (!box || !g) return;
  const { thoughts: list, open } = graphThoughts(g);
  const short = (n) => { const t = (n?.label || "").replace(/`/g, ""); return t.length > 34 ? t.slice(0, 32) + "…" : t; };
  const held = [...list, ...open].find((t) => t.ids.join("|") === THOUGHT_PIN) || null;
  lightThought(g, held);
  const minSeg = el("span", { class: "thought-min", title: "entries a thought has at least" }, "from ", ...[3, 4, 5].map((m) => el("button", { type: "button", class: m === THOUGHT_MIN ? "on" : "", onclick: () => { THOUGHT_MIN = m; try { localStorage.setItem("ktw-thought-min", String(m)); } catch {} THOUGHT_PIN = null; renderThoughts(g); } }, String(m))));
  const repos = (ends) => [...new Set(ends.map((e) => repoLabel(e.canonical)))];
  const row = (t) => {
    const key = t.ids.join("|"); const on = key === THOUGHT_PIN;
    return el("div", { class: `thought ${on ? "on" : ""} ${t.ends.length ? "open" : ""}` },
      el("button", { type: "button", class: "thought-head", title: t.steps.map((n) => n.label).join("\n→ ") + (t.ends.length ? `\n… goes on in ${repos(t.ends).join(", ")}` : ""),
        onmouseenter: () => { if (!THOUGHT_PIN) lightThought(g, t); }, onmouseleave: () => { if (!THOUGHT_PIN) lightThought(g, null); },
        onclick: () => { THOUGHT_PIN = on ? null : key; renderThoughts(g); } },
        el("span", { class: "count" }, String(t.steps.length)), `${short(t.steps[0])} → ${short(t.steps[t.steps.length - 1])}`, t.evolution ? el("span", { class: "pill" }, "evolution") : null, ...insightPills(t)),
      el("a", { class: "thought-read", href: thoughtHref(t), title: "read the whole thought — every entry in order, in full" }, "read ›"),
      t.ends.length ? el("button", { type: "button", class: "thought-follow link-btn", disabled: CHAIN.busy, title: `load the repositories this chain goes on into — ${repos(t.ends).join(", ")} — hop by hop, until it ends`, onclick: () => followThought(t) }, `continues ↗ ${repos(t.ends).join(", ")}`) : null,
      on ? el("ol", { class: "thought-steps" }, t.steps.map((n) => el("li", stepHover(n.entry?.uuid || n.id), el("a", { href: n.href }, n.label.replace(/`/g, ""))))) : null);
  };
  const openEnds = [...list, ...open].flatMap((t) => t.ends);
  const followBtn = openEnds.length ? el("button", { type: "button", class: "link-btn thought-follow-all", disabled: CHAIN.busy, title: "load every repository the chains here go on into, hop by hop — nothing else", onclick: followAll }, CHAIN.busy ? "loading the chains…" : `load the whole chains (${repos(openEnds).length} ${repos(openEnds).length === 1 ? "repository" : "repositories"})`) : null;
  const head = list.length
    ? [el("h3", {}, `Thoughts (${list.length}) `, minSeg), el("p", { class: "note" }, "Chains of linked entries — See and Superseded by — first entry first. Point at one to light its path, click to hold it.")]
    : [el("h3", {}, "Thoughts ", minSeg), el("p", { class: "note" }, `No chain of linked entries in this graph is ${THOUGHT_MIN} or more entries long yet — a thought is a chain of See or Superseded by, each entry citing the one before.`)];
  setKids(box, ...head, followBtn, ...list.map(row),
    open.length ? el("h3", { class: "thought-open-head" }, `Going on beyond this page (${open.length})`) : null,
    open.length ? el("p", { class: "note" }, "Shorter chains that continue in a repository this page has not loaded — loading it may make them thoughts.") : null,
    ...open.map(row));
}
function friendsLegend(g) {
  if (!FRIENDS.on && !CHAIN.extra.size) return [];
  const out = friendUnits(g).map((u, i) => el("span", { class: "friend", title: `friend: ${u.r.canonical}${u.members.length > 1 ? ` — a family of ${u.members.length}, shown whole` : ""} — its hub shows the entries cited there; a click on a hub shows all of it, a click on the name goes there` },
    el("i", { class: "dot", style: `background:transparent;border:2px dashed ${friendColor(i)};width:10px;height:10px` }),
    el("a", { href: u.r.open, onclick: (ev) => { if (!u.r.centre) return; ev.preventDefault(); moveTo({ centre: u.r.centre, state: u.r.state }, "#graph"); } }, u.r.name),
    u.members.length > 1 ? el("span", { class: "note" }, ` · family of ${u.members.length}`) : null,
    u.via === "chain" ? el("span", { class: "note" }, " · via a thought") : null));
  for (const f of g.friends || []) { const r = FRIENDS.loaded[fkey(f.canonical)]; if (r && !r.state) out.push(el("span", { class: "warn", title: r.error }, `${repoLabel(r.canonical)} not loaded`)); }
  return out;
}
let TREE_ASKED = false;
function viewGraph(main) {
  // live: the whole family tree is known before anything counts as a friend — the server's own API, no other host
  if (LIVE() && !TREE && !TREE_ASKED) { TREE_ASKED = true; fetchTree().then((t) => { if (t && location.hash === "#graph") render(); }); }
  const family = scope() === "family";
  const wrap = el("div", { class: "graph-wrap" });
  main.append(wrap);
  const fill = (g) => {
    const canvas = el("canvas");
    const fui = friendsUi(g);
    // the controls in groups: what is drawn · friends · walking and motion · reset
    const ui = el("div", { class: "graph-ui" },
      el("span", { class: "ui-group" }, el("label", {}, el("input", { type: "checkbox", checked: g.showEntries, onchange: (ev) => { g.showEntries = ev.target.checked; g.alpha = 0.5; g.wake?.(); } }), "entries"), el("label", {}, el("input", { type: "checkbox", checked: g.showLabels, onchange: (ev) => { g.showLabels = ev.target.checked; g.wake?.(); } }), "labels")),
      fui ? el("span", { class: "ui-group" }, fui) : null,
      el("span", { class: "ui-group" }, el("label", { title: "keep the path while you walk from project to project — the projects you came through stay in the graph" }, el("input", { type: "checkbox", checked: keepPath(), onchange: (ev) => { setKeepPath(ev.target.checked); render(); } }), "path"), el("label", { title: "the graph turns very slowly; it stops while you point at it" }, el("input", { type: "checkbox", checked: driftOn(), onchange: (ev) => { setDrift(ev.target.checked); g.wake?.(); } }), "motion")),
      el("span", { class: "ui-group" }, el("button", { class: "link-btn graph-reset", title: "fit the graph and let go of every node you placed", onclick: () => { g.scale = family ? 0.7 : 1; g.ox = 0; g.oy = 0; g.userMoved = false; for (const n of g.nodes) { n.fixed = false; } g.alpha = 1; g.wake?.(); } }, "reset")),
    );
    const legend = family
      ? el("div", { class: "graph-legend" },
        g.groups.map((G) => el("span", {}, el("i", { class: "dot", style: `background:${G.color};width:10px;height:10px` }), G.g.member.name)),
        el("span", {}, `${plural(g.across, "reference")} across projects`),
        g.missing.length ? el("span", { class: "warn", title: g.missing.map(({ member: m, reason }) => `${m.name}: ${reason}`).join("\n") }, `${plural(g.missing.length, "member")} not available here`) : null, ...friendsLegend(g))
      : el("div", { class: "graph-legend" },
        el("span", {}, el("i", { class: "dot", style: "background:var(--accent);width:12px;height:12px" }), "topic (size = entries)"),
        el("span", {}, el("i", { class: "dot confirmed" }), "confirmed"), el("span", {}, el("i", { class: "dot inferred" }), "inferred"), el("span", {}, el("i", { class: "dot unknown" }), "unknown"),
        el("span", {}, el("i", { class: "dot", style: "background:transparent;border:1.5px solid var(--fg3)" }), "superseded"),
        el("span", {}, "— reference · ··· membership"), ...friendsLegend(g));
    wrap.replaceChildren(canvas, ui, legend, ...[pathBar()].filter(Boolean), el("div", { class: "graph-hint" }, family ? "family — a project opens its overview · drag nodes · wheel zoom · drag background to pan" : "drag nodes · wheel zoom · drag background to pan · click to open"));
    // arriving from the side pane's graph: centred on the entry or topic it showed
    if (GRAPH_CENTER) {
      const c = GRAPH_CENTER; GRAPH_CENTER = null;
      const n = g.nodes.find((x) => (c.entry && x.entry && (x.entry === c.entry || (c.entry.uuid && x.entry.uuid === c.entry.uuid))) || (c.topic && x.kind === "topic" && x.file === c.topic.file));
      if (n) { g.ox = -n.x * g.scale; g.oy = -n.y * g.scale; g.userMoved = true; }
    }
    runGraph(canvas, g, { fit: family });
    renderThoughts(g);
  };
  if (!family) return fill(buildGraph());
  if (fgraph && Date.now() - fgraph.at < 30000) return fill(fgraph); // a live update re-renders: no refetch
  wrap.append(el("p", { class: "center" }, "Loading the family…"));
  buildFamilyGraph().then((g) => { if (wrap.isConnected && location.hash === "#graph" && scope() === "family") fill(g); });
}
const go = (href) => { if (href.startsWith("#")) location.hash = href; else location.href = href; };
// The graph turns very slowly in its plane — one turn in about six minutes —
// and stops while it is pointed at, dragged or panned. Off with the system's
// reduced-motion setting, or with *motion* in the graph (kept per browser).
const DRIFT_RATE = (2 * Math.PI) / 360000; // radians per millisecond
let DRIFT = (() => { try { return localStorage.getItem("ktw-motion") !== "off"; } catch { return true; } })();
const reducedMotion = () => { try { return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches; } catch { return false; } };
const driftOn = () => DRIFT && !reducedMotion();
function setDrift(on) { DRIFT = on; try { localStorage.setItem("ktw-motion", on ? "on" : "off"); } catch {} }
function runGraph(canvas, g, opts = {}) {
  const mini = !!opts.mini;
  const ctx = canvas.getContext("2d");
  const css = getComputedStyle(document.documentElement);
  const color = (v) => css.getPropertyValue(v).trim();
  let W = 0, H = 0, dpr = window.devicePixelRatio || 1;
  let hover = null, drag = null, pan = null, moved = false;
  const resize = () => { const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  const toWorld = (px, py) => [(px - W / 2 - g.ox) / g.scale, (py - H / 2 - g.oy) / g.scale];
  const visible = (n) => n.kind !== "entry" || g.showEntries || !!g.thought?.nodes.has(n);
  // a topic-level reference stands in for entry references only while entries are hidden
  const linkOn = (l) => visible(g.nodes[l.s]) && visible(g.nodes[l.t]) && (l.kind !== "xtopic" || !g.showEntries);
  const dim = (n) => n.kind === "entry" && filterActive() && !matches(n.entry);
  const pick = (px, py) => { const [x, y] = toWorld(px, py); let best = null, bd = 1e9; for (const n of g.nodes) { if (!visible(n)) continue; const d = Math.hypot(n.x - x, n.y - y); if (d < Math.max(n.r + 4, 8) / Math.min(g.scale, 1) && d < bd) { best = n; bd = d; } } return best; };
  // a project's name under its hub is a link: pointed at, underlined; clicked, it goes there
  let hoverName = null, nameDown = null;
  const pickName = (px, py) => { const [x, y] = toWorld(px, py); for (const b of g.nameBoxes || []) if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return b.n; return null; };
  canvas.onmousemove = (ev) => {
    const r = canvas.getBoundingClientRect(); const px = ev.clientX - r.left, py = ev.clientY - r.top;
    if (!drag && !pan) { hoverName = pickName(px, py); if (hoverName) { hover = hoverName; canvas.style.cursor = "pointer"; return; } }
    if (drag) { const [x, y] = toWorld(px, py); drag.x = x; drag.y = y; drag.vx = drag.vy = 0; drag.fixed = true; g.alpha = Math.max(g.alpha, 0.3); moved = true; return; }
    if (pan) { g.ox = pan.ox + (px - pan.px); g.oy = pan.oy + (py - pan.py); moved = true; return; }
    hover = pick(px, py); canvas.style.cursor = hover ? "pointer" : "grab";
  };
  canvas.onmousedown = (ev) => { const r = canvas.getBoundingClientRect(); const px = ev.clientX - r.left, py = ev.clientY - r.top; moved = false; g.userMoved = true; nameDown = pickName(px, py); if (nameDown) return; const n = pick(px, py); if (n) drag = n; else pan = { px, py, ox: g.ox, oy: g.oy }; canvas.classList.add("grabbing"); };
  const open = (n) => (n.action ? n.action() : go(n.href));
  const walkTo = (n) => (n.walk ? n.walk() : go(n.href));
  window.addEventListener("mouseup", () => { if (nameDown) { const n = nameDown; nameDown = null; walkTo(n); return; } if (drag && !moved) open(drag); drag = null; pan = null; canvas.classList.remove("grabbing"); });
  canvas.onmouseleave = () => { hover = null; hoverName = null; };
  canvas.onwheel = (ev) => { ev.preventDefault(); g.userMoved = true; const r = canvas.getBoundingClientRect(); const px = ev.clientX - r.left - W / 2, py = ev.clientY - r.top - H / 2; const f = Math.exp(-ev.deltaY * 0.0012); const ns = Math.min(6, Math.max(0.15, g.scale * f)); const k = ns / g.scale; g.ox = px - (px - g.ox) * k; g.oy = py - (py - g.oy) * k; g.scale = ns; };
  canvas.ondblclick = (ev) => { const r = canvas.getBoundingClientRect(); const n = pick(ev.clientX - r.left, ev.clientY - r.top); if (n) { n.fixed = false; g.alpha = 0.4; } };
  // touch: one finger drags a node or pans (full view only), two fingers pinch-zoom, a tap opens
  let pinch = null;
  const tpos = (t) => { const r = canvas.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; };
  const tdist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
  canvas.addEventListener("touchstart", (ev) => {
    g.userMoved = true;
    if (ev.touches.length === 2) { pinch = { d: tdist(ev.touches), scale: g.scale, ox: g.ox, oy: g.oy }; drag = null; pan = null; return; }
    const [px, py] = tpos(ev.touches[0]); moved = false; nameDown = pickName(px, py); if (nameDown) return; const n = pick(px, py);
    if (n) drag = n; else if (!mini) pan = { px, py, ox: g.ox, oy: g.oy };
  }, { passive: true });
  canvas.addEventListener("touchmove", (ev) => {
    if (pinch && ev.touches.length === 2) { const k = tdist(ev.touches) / pinch.d; g.scale = Math.min(6, Math.max(0.15, pinch.scale * k)); ev.preventDefault(); return; }
    if (!ev.touches.length) return;
    const [px, py] = tpos(ev.touches[0]);
    if (drag) { const [x, y] = toWorld(px, py); drag.x = x; drag.y = y; drag.vx = drag.vy = 0; drag.fixed = true; g.alpha = Math.max(g.alpha, 0.3); moved = true; ev.preventDefault(); }
    else if (pan) { g.ox = pan.ox + (px - pan.px); g.oy = pan.oy + (py - pan.py); moved = true; ev.preventDefault(); }
  }, { passive: false });
  canvas.addEventListener("touchend", (ev) => {
    if (pinch) { if (!ev.touches.length) pinch = null; return; }
    if (nameDown) { const n = nameDown; nameDown = null; if (!moved) walkTo(n); return; }
    if (drag && !moved) open(drag);
    drag = null; pan = null;
  });
  const ev = (n) => n.entry.evidence;
  const evColor = { confirmed: color("--confirmed"), inferred: color("--inferred"), unknown: color("--unknown") };
  let lastT = 0, frame = 0;
  function step(now) {
    const dt = lastT && now ? Math.min(100, now - lastT) : 16; lastT = now || 0;
    const drifting = driftOn() && !hover && !drag && !pan && !pinch;
    if (drifting) { const a = DRIFT_RATE * dt, c = Math.cos(a), sn = Math.sin(a); for (const n of g.nodes) { const x = n.x, y = n.y; n.x = x * c - y * sn; n.y = x * sn + y * c; } }
    // settled and only turning: every other frame is enough
    if (drifting && g.alpha <= 0.003 && (frame++ & 1)) { g.raf = canvas.isConnected ? requestAnimationFrame(step) : null; return; }
    const ns = g.nodes.filter(visible);
    if (g.alpha > 0.003) {
      const k = g.alpha;
      // repulsion
      for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i], b = ns[j]; let dx = b.x - a.x, dy = b.y - a.y; let d2 = dx * dx + dy * dy + 0.01;
        const hubs = a.kind === "project" && b.kind === "project";
        const apart = (a.unit || "") !== (b.unit || ""); // this graph and a friend, or two friends: a family keeps together, strangers keep their distance
        if (d2 > (hubs ? (apart ? 9000000 : 4000000) : apart ? 640000 : 250000)) continue;
        const base = hubs ? (apart ? 70000 : 22000) : a.kind === "entry" && b.kind === "entry" ? 260 : a.kind === "entry" || b.kind === "entry" ? 900 : 2600;
        const rep = (apart && !hubs ? base * 2.5 : base) / d2; const d = Math.sqrt(d2);
        const fx = (dx / d) * rep * k, fy = (dy / d) * rep * k;
        if (!a.fixed) { a.vx -= fx; a.vy -= fy; } if (!b.fixed) { b.vx += fx; b.vy += fy; }
      }
      // springs
      for (const l of g.links) { if (!linkOn(l)) continue; const a = g.nodes[l.s], b = g.nodes[l.t]; const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 0.01; const f = (d - l.len) * (l.kind === "member" || l.kind === "hub" ? 0.05 : l.kind === "family" ? 0.03 : 0.02) * k; const fx = (dx / d) * f, fy = (dy / d) * f; if (!a.fixed) { a.vx += fx; a.vy += fy; } if (!b.fixed) { b.vx -= fx; b.vy -= fy; } }
      // gravity + integrate
      for (const n of ns) { if (n.fixed) continue; const gr = n.ext ? 0.0015 : 0.004; n.vx -= n.x * gr * k; n.vy -= n.y * gr * k; n.vx *= 0.82; n.vy *= 0.82; n.x += n.vx; n.y += n.vy; }
      g.alpha *= 0.985;
    }
    // keep the canvas framed on the nodes while they settle: the small one always, the family graph until the person moves it
    if ((mini || (opts.fit && !g.userMoved)) && g.alpha > 0.01 && W && H) {
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (const n of ns) { minX = Math.min(minX, n.x - n.r); maxX = Math.max(maxX, n.x + n.r); minY = Math.min(minY, n.y - n.r); maxY = Math.max(maxY, n.y + n.r + 18); }
      const pad = mini ? 60 : 140;
      if (ns.length) { const sw = Math.max(80, maxX - minX + pad), sh = Math.max(80, maxY - minY + pad); g.scale = Math.min(mini ? 2.2 : 1.2, Math.min(W / sw, H / sh)); g.ox = -((minX + maxX) / 2) * g.scale; g.oy = -((minY + maxY) / 2) * g.scale; }
    }
    // draw
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2 + g.ox, H / 2 + g.oy); ctx.scale(g.scale, g.scale);
    const th = g.thought;
    const focus = th ? null : hover || (opts.focusId && g.index[opts.focusId] != null ? g.nodes[g.index[opts.focusId]] : null) || (!mini && selected ? g.nodes[g.index[`e:${selected}`]] : null);
    const neigh = new Set(); if (focus) { neigh.add(focus); for (const l of g.links) { if (!linkOn(l)) continue; if (g.nodes[l.s] === focus) neigh.add(g.nodes[l.t]); if (g.nodes[l.t] === focus) neigh.add(g.nodes[l.s]); } }
    if (th) for (const n of th.nodes) neigh.add(n);
    const stepNode = STEP_FOCUS ? ns.find((n) => n.kind === "entry" && (n.entry?.uuid === STEP_FOCUS || n.id === STEP_FOCUS)) : null;
    if (stepNode) neigh.add(stepNode);
    const onThought = (l) => !!th && (l.kind === "see" || l.kind === "superseded") && (th.pairs.has(`${g.nodes[l.s].id}|${g.nodes[l.t].id}`) || th.pairs.has(`${g.nodes[l.t].id}|${g.nodes[l.s].id}`));
    const LW = { topic: 1.6, ref: 1, family: 2.6, see: 1.5, xtopic: 1.5, superseded: 1.3, trail: 2.2 };
    const DASH = { member: [2, 3], hub: [2, 3], family: [9, 6], superseded: [5, 4], trail: [2, 6] };
    for (const l of g.links) {
      if (!linkOn(l)) continue;
      const a = g.nodes[l.s], b = g.nodes[l.t]; const hi = (focus && (a === focus || b === focus)) || onThought(l);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.lineWidth = (LW[l.kind] || 0.6) / g.scale; ctx.setLineDash((DASH[l.kind] || []).map((v) => v / g.scale));
      const base = l.kind === "see" || l.kind === "xtopic" ? (l.color || color("--accent2")) : l.kind === "superseded" || l.kind === "family" || l.kind === "trail" ? color("--fg3") : color("--line");
      ctx.strokeStyle = hi ? (l.kind === "see" || l.kind === "xtopic" ? color("--fg") : color("--accent2")) : base; ctx.globalAlpha = (focus || th) && !hi ? (th ? 0.12 : 0.25) : l.kind === "see" || l.kind === "xtopic" ? 0.85 : 1; if (onThought(l)) ctx.lineWidth = 3 / g.scale; ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const n of ns) {
      const faded = ((focus || th) && !neigh.has(n)) || dim(n);
      ctx.globalAlpha = faded ? 0.18 : 1;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      if (n.kind === "project") { ctx.fillStyle = color("--bg"); ctx.fill(); ctx.lineWidth = 3.5 / g.scale; ctx.strokeStyle = n.color; if (n.chain) ctx.setLineDash([8 / g.scale, 3 / g.scale, 2 / g.scale, 3 / g.scale]); else if (n.friend) ctx.setLineDash([5 / g.scale, 3 / g.scale]); else if (n.trail) ctx.setLineDash([1.5 / g.scale, 3 / g.scale]); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 0.38, 0, Math.PI * 2); ctx.fillStyle = n.color; ctx.fill(); }
      else if (n.kind === "topic") { ctx.fillStyle = n.color || color("--accent"); ctx.fill(); }
      else { const sup = n.entry.status === "superseded"; ctx.fillStyle = sup ? color("--bg") : evColor[ev(n)] || color("--muted"); ctx.fill(); if (sup) { ctx.lineWidth = 1.2 / g.scale; ctx.strokeStyle = evColor[ev(n)] || color("--fg3"); ctx.stroke(); } if (n.entry.status === "open" || n.entry.status === "needs-review" || n.entry.status === "pending-confirmation") { ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 2.5 / g.scale, 0, Math.PI * 2); ctx.lineWidth = 1.2 / g.scale; ctx.strokeStyle = color(`--${n.entry.status}`); ctx.stroke(); } }
      if (n === focus) { ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 4 / g.scale, 0, Math.PI * 2); ctx.lineWidth = 1.5 / g.scale; ctx.strokeStyle = color("--fg"); ctx.stroke(); }
      if (n === stepNode) { ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 7 / g.scale, 0, Math.PI * 2); ctx.lineWidth = 3 / g.scale; ctx.strokeStyle = color("--accent2"); ctx.stroke(); ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 12 / g.scale, 0, Math.PI * 2); ctx.lineWidth = 1 / g.scale; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    const anyLabels = g.showLabels || focus || th || stepNode;
    g.nameBoxes = [];
    {
      ctx.font = `${(mini ? 11 : 12) / g.scale}px ${color("--font") || "sans-serif"}`; ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (const n of ns) {
        const hubName = n.kind === "project";
        if (!hubName && !anyLabels) continue;
        const show = n === stepNode || (th && th.nodes.has(n)) ? true : hubName ? true : n.kind === "topic" ? (mini ? neigh.has(n) || n === focus || g.nodes.filter((x) => x.kind === "topic").length <= 12 : g.showLabels || neigh.has(n)) : (focus && (neigh.has(n) || n === focus)) || (!mini && g.showLabels && g.scale > 1.6);
        if (!show) continue;
        const faded = (focus || th) && !neigh.has(n) && n !== focus; if (faded && !hubName) continue;
        const lbl = n.label.replace(/`/g, ""); const txt = lbl.length > 48 ? lbl.slice(0, 46) + "…" : lbl;
        if (hubName) ctx.font = `600 ${(mini ? 12 : 13) / g.scale}px ${color("--font") || "sans-serif"}`;
        const tw = ctx.measureText(txt).width; const y = n.y + n.r + 3 / g.scale;
        ctx.fillStyle = color("--bg"); ctx.globalAlpha = faded ? 0.4 : 0.75; ctx.fillRect(n.x - tw / 2 - 3 / g.scale, y - 1 / g.scale, tw + 6 / g.scale, 15 / g.scale); ctx.globalAlpha = faded ? 0.5 : 1;
        ctx.fillStyle = n.kind === "entry" ? color("--fg2") : hubName && n === hoverName ? color("--accent2") : color("--fg"); ctx.fillText(txt, n.x, y);
        if (hubName) {
          g.nameBoxes.push({ n, x0: n.x - tw / 2 - 3 / g.scale, y0: y - 1 / g.scale, x1: n.x + tw / 2 + 3 / g.scale, y1: y + 15 / g.scale });
          if (n === hoverName) { ctx.fillRect(n.x - tw / 2, y + 14 / g.scale, tw, 1 / g.scale); }
          ctx.font = `${(mini ? 11 : 12) / g.scale}px ${color("--font") || "sans-serif"}`;
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    if (!canvas.isConnected) { ro.disconnect(); g.raf = null; ACTIVE_GRAPHS.delete(g); return; }
    const busy = g.alpha > 0.003 || drag || pan || pinch || hover || driftOn();
    g.raf = busy ? requestAnimationFrame(step) : null; // idle: no frames until something happens
  }
  const wake = () => { if (!g.raf && canvas.isConnected) g.raf = requestAnimationFrame(step); };
  ACTIVE_GRAPHS.add(g);
  for (const evn of ["mousemove", "mousedown", "wheel", "dblclick", "touchstart", "touchmove", "mouseleave"]) canvas.addEventListener(evn, wake, { passive: true });
  window.addEventListener("mouseup", wake);
  g.wake = wake;
  ro.observe(canvas); // re-observe after the resize handler above; a resize wakes the loop
  const ro2 = new ResizeObserver(() => { resize(); if (g.alpha < 0.05) g.alpha = 0.05; wake(); }); ro2.observe(canvas);
  if (g.raf) cancelAnimationFrame(g.raf);
  g.raf = requestAnimationFrame(step);
}

// ---------------------------------------------------------------- timeline (SVG)
const PALETTE = ["#835bec", "#4aa3df", "#4fbf7a", "#e0a83a", "#e0574f", "#d66fd6", "#3fbfbf", "#b0b04a", "#ff8c5a", "#8b8b98"];
const authorColor = (name) => PALETTE[Math.max(0, S.authors.findIndex((a) => a.name === name)) % PALETTE.length];
function viewTimeline(main) {
  main.append(el("h1", {}, "Timeline"), el("p", { class: "sub" }, "Entries by the month their heading first appeared in Git, stacked by author. Grey ticks below: entries superseded in that month."));
  if (!S.project.git?.available) return main.append(el("p", { class: "center" }, "No Git repository — no dates to draw."));
  if (S.project.git.shallow) main.append(el("p", { class: "sub warn" }, "Shallow clone: the history stops at the clone's edge, so every entry older than that appears to start there. Fetch the full history (git fetch --unshallow) for real dates."));
  const created = S.entries.filter((e) => e.git?.created?.date && matches(e));
  const months = {}; const sup = {};
  for (const e of created) { const m = e.git.created.date.slice(0, 7); (months[m] ||= {})[e.git.created.author] = ((months[m] || {})[e.git.created.author] || 0) + 1; }
  for (const e of S.entries) for (const h of e.git?.status_history || []) if (h.status === "superseded" && h.date) sup[h.date.slice(0, 7)] = (sup[h.date.slice(0, 7)] || 0) + 1;
  const keys = Object.keys({ ...months, ...sup }).sort();
  if (!keys.length) return main.append(el("p", { class: "center" }, "Nothing dated yet."));
  // fill gaps
  const all = []; let [y, m] = keys[0].split("-").map(Number); const [ey, em] = keys[keys.length - 1].split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) { all.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
  const max = Math.max(1, ...all.map((k) => Object.values(months[k] || {}).reduce((a, b) => a + b, 0)));
  const Wd = 900, Hd = 260, padL = 34, padB = 40, padT = 10; const bw = Math.min(48, (Wd - padL) / all.length - 4);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", `0 0 ${Wd} ${Hd}`);
  const ns = (tag, attrs, text) => { const n = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text != null) n.textContent = text; return n; };
  const axis = ns("g", { class: "axis" }); svg.append(axis);
  const scaleY = (v) => padT + (Hd - padB - padT) * (1 - v / max);
  for (const tick of [0, Math.ceil(max / 2), max]) { axis.append(ns("line", { x1: padL, x2: Wd, y1: scaleY(tick), y2: scaleY(tick) })); axis.append(ns("text", { x: padL - 6, y: scaleY(tick) + 3, "text-anchor": "end" }, tick)); }
  const listBox = el("div", { class: "entry-list", style: "margin-top:16px" });
  all.forEach((k, i) => {
    const x = padL + i * ((Wd - padL) / all.length) + 2; let yTop = scaleY(0);
    for (const a of S.authors.map((a) => a.name)) { const v = months[k]?.[a]; if (!v) continue; const h = scaleY(0) - scaleY(v); yTop -= h; const rect = ns("rect", { class: "b", x, y: yTop, width: bw, height: h, fill: authorColor(a), rx: 2 }); rect.append(ns("title", {}, `${k} · ${a}: ${v}`)); rect.addEventListener("click", () => { listBox.replaceChildren(el("h2", {}, `${k}`), ...created.filter((e) => e.git.created.date.startsWith(k)).map(entryRow)); listBox.scrollIntoView?.({ behavior: "smooth", block: "nearest" }); }); svg.append(rect); }
    if (sup[k]) for (let s = 0; s < sup[k]; s++) svg.append(ns("rect", { class: "sup", x: x + s * 5, y: Hd - padB + 6, width: 3, height: 6 }));
    if (all.length <= 18 || i % Math.ceil(all.length / 18) === 0) axis.append(ns("text", { x: x + bw / 2, y: Hd - padB + 24, "text-anchor": "middle" }, k));
  });
  main.append(el("div", { class: "timeline" }, svg), el("div", { class: "legend" }, S.authors.map((a) => el("span", {}, el("i", { class: "sw", style: `background:${authorColor(a.name)}` }), a.name)), el("span", {}, el("i", { class: "sw", style: "background:var(--superseded)" }), "superseded")), el("p", { class: "note" }, "Click a bar to list that month's entries."), listBox);
}

// ---------------------------------------------------------------- search
// What a search runs over: this project, or every member of its tree — the
// whole family from the root down, not only the parent chain. Shared by the
// dropdown under the search field and the results page (#search/<scope>/<q>).
const familyRank = (m) => (m.role === "self" ? -100 : m.role === "ancestor" || m.role === "grandparent" ? -(m.depth || 2) : { parent: 0, sibling: 2, child: 3, relative: 4 }[m.role] ?? 5);
let TREE = null; let TREE_AT = 0; // /api/family?tree=1, live mode
async function fetchTree() {
  if (!LIVE()) return null;
  if (TREE && Date.now() - TREE_AT < 30000) return TREE;
  try { TREE = (await (await fetch(`${api("/api/family")}${PROJECT ? "&" : "?"}tree=1`, { cache: "no-store" })).json()).members || []; TREE_AT = Date.now(); } catch { TREE = null; }
  return TREE;
}
const MEMBER_STATES = {}; // project key -> { at, p: Promise<{state}|{error}> }, live mode
function memberState(key) {
  const c = MEMBER_STATES[key];
  if (c && Date.now() - c.at < 30000) return c.p;
  const p = fetch(`/api/state.json?project=${encodeURIComponent(key)}`, { cache: "no-store" })
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((st) => ({ state: normalizeState(st) }), (err) => ({ error: `could not load its state (${err?.message || "server gone"})` }));
  MEMBER_STATES[key] = { at: Date.now(), p };
  return p;
}
let PUBLIC_TREE = null; // the tree read from published exports, public mode
async function publicTree() {
  if (PUBLIC_TREE) return PUBLIC_TREE;
  PUBLIC_TREE = await publicTreeFrom({ state: SELF, canonical: canonicalOf(S.project), root: MY_ROOT(), name: S.project.id || S.project.name, href: (e) => entryHref(e) });
  return PUBLIC_TREE;
}
// The family tree around one published project, read from the members'
// published exports: this page's own (publicTree), or a friend's.
async function publicTreeFrom(start) {
  const canon = start.canonical; const myRoot = start.root || "";
  const keyOf = (c, r) => `${c}|${r}`;
  const self = { member: { role: "self", name: start.name, canonical: canon, root: myRoot, node: keyOf(canon, myRoot), up: null }, state: start.state, href: start.href };
  const groups = [self]; const missing = []; const seen = new Set([keyOf(canon, myRoot)]);
  const label = (loc) => loc.root ? `${loc.canonical.replace(/^https:\/\//, "")}/${loc.root}` : loc.canonical.replace(/^https:\/\//, "");
  const add = (m, r) => { if (r.state) groups.push({ member: m, state: r.state, href: (e) => publicHref(m.canonical, m.root, entryHref(e)) }); else missing.push({ member: m, reason: r.error }); return r.state; };
  // up: the parent chain, as far as each level is published
  let cur = { state: start.state, canonical: canon, root: myRoot }; let depth = 1; let parentKey = null; let below = self.member;
  while (cur.state?.project?.parent && depth < 12) {
    const loc = resolveLocation(cur.state.project.parent, cur.canonical, cur.root);
    if (!loc || seen.has(keyOf(loc.canonical, loc.root))) break;
    seen.add(keyOf(loc.canonical, loc.root));
    if (depth === 1) parentKey = keyOf(loc.canonical, loc.root);
    const m = { role: depth === 1 ? "parent" : depth === 2 ? "grandparent" : "ancestor", depth, name: label(loc), ...loc, node: keyOf(loc.canonical, loc.root), up: null };
    below.up = m.node; below = m; // the tree's shape: each level names the one above it
    const st = add(m, await fetchPublicState(loc.canonical, loc.root));
    cur = { state: st, canonical: loc.canonical, root: loc.root }; depth++;
  }
  // down: every published children block, level by level from the top
  let level = groups.map((g) => ({ state: g.state, canonical: g.member.canonical, root: g.member.root || "", key: keyOf(g.member.canonical, g.member.root || "") }));
  for (let round = 0; level.length && round < 12; round++) {
    const next = [];
    const kids = level.flatMap((l) => (l.state?.project?.children || []).map((c) => ({ c, from: l, loc: resolveLocation(c.location, l.canonical, l.root) })))
      .filter(({ loc }) => loc && !seen.has(keyOf(loc.canonical, loc.root)));
    for (const k of kids) seen.add(keyOf(k.loc.canonical, k.loc.root));
    const results = await Promise.all(kids.map((k) => fetchPublicState(k.loc.canonical, k.loc.root)));
    kids.forEach((k, i) => {
      const role = k.from.key === keyOf(canon, myRoot) ? "child" : k.from.key === parentKey ? "sibling" : "relative";
      const st = add({ role, name: k.c.name, scope: k.c.scope, via: k.from.state?.project?.id || "", ...k.loc, node: keyOf(k.loc.canonical, k.loc.root), up: k.from.key }, results[i]);
      if (st) next.push({ state: st, canonical: k.loc.canonical, root: k.loc.root, key: keyOf(k.loc.canonical, k.loc.root) });
    });
    level = next;
  }
  groups.sort((a, b) => familyRank(a.member) - familyRank(b.member));
  return { groups, missing };
}
// { groups: [{ member, state, href(e) }], missing: [{ member, reason }] } — this project first
async function searchPool(scope) {
  const self = { member: { role: "self", name: S.project.name || S.project.id }, state: SELF, href: (e) => entryHref(e) };
  if (scope !== "family") return { groups: [self], missing: [] };
  if (PUBLISHED()) return publicTree();
  if (!LIVE()) return { groups: [self], missing: [] };
  const others = [...(await fetchTree() || [])].filter((m) => m.role !== "self").sort((a, b) => familyRank(a) - familyRank(b));
  const results = await Promise.all(others.map((m) => m.key ? memberState(m.key) : { error: m.available === "none" ? "not checked out or cached on this machine" : "location unknown" }));
  const groups = [self]; const missing = [];
  others.forEach((m, i) => { const r = results[i]; if (r.state) groups.push({ member: m, state: r.state, href: (e) => `${location.pathname}?project=${encodeURIComponent(m.key)}${entryHref(e)}` }); else missing.push({ member: m, reason: r.error }); });
  return { groups, missing };
}
// every hit, best first; the dropdown keeps this project's hits on top
function searchRows(pool, q) {
  const rows = [];
  for (const g of pool.groups) for (const e of g.state.entries || []) { const hit = searchHit(e, q); if (hit) rows.push({ e, hit, g }); }
  return rows.sort((a, b) => compareHits(a.hit, b.hit));
}
const searchScopes = () => (LIVE() || MODE === "public" || (MODE === "export" && !!canonicalOf(S?.project)) ? ["project", "family"] : ["project"]);
// One setting for every view that can span projects (search, graph): this
// project, or the whole family tree. Kept per browser; a results-page link
// carries its own scope and sets it.
const hasFamily = () => !!(S?.project?.parent || (S?.project?.children || []).length);
const canFamily = () => searchScopes().includes("family") && hasFamily();
let SCOPE = (() => { try { return localStorage.getItem("ktw-scope") || localStorage.getItem("ktw-search-scope") || "project"; } catch { return "project"; } })();
const scope = () => (canFamily() && SCOPE === "family" ? "family" : "project");
function markScope() {
  const box = $("#scope"); if (!box) return;
  box.hidden = !canFamily();
  for (const b of box.querySelectorAll("button")) b.classList.toggle("on", b.dataset.scope === scope());
}
function setScope(v, { rerender: again = true } = {}) {
  if (v !== "project" && v !== "family") return;
  const changed = SCOPE !== v; SCOPE = v;
  if (changed) MINI = null; // the side pane's graph follows the new scope
  try { localStorage.setItem("ktw-scope", v); } catch {}
  markScope();
  if (!changed) return;
  if (!again) { setTimeout(showScope); return; } // the caller renders now; the merge follows
  const route = location.hash.slice(1);
  if (route.startsWith("search/")) { const q = decodeURIComponent(route.split("/").slice(2).join("/")); location.hash = searchHref(scope(), q); }
  showScope();
  window.__ktwScopeChanged?.();
}
function setupScope() { for (const b of $("#scope").querySelectorAll("button")) b.onclick = () => setScope(b.dataset.scope); markScope(); }
const searchHref = (scope, q) => `#search/${scope}/${encodeURIComponent(q)}`;
const memberLabel = (m) => m.role === "self" ? "this project" : m.role === "relative" && m.via ? `relative, via ${m.via}` : m.role;
const topicTitle = (st, file) => st.topics?.find((t) => t.file === file)?.title || file;
function hitSnippet(hit) {
  const w = hit.where; if (!w) return "";
  const text = snippetAt(w.text.replace(/\*\*|`/g, ""), Math.max(0, w.text.slice(0, w.i).replace(/\*\*|`/g, "").length), w.len);
  return (w.field === "body" || w.field === "title" ? "" : `<b>${esc(w.field)}:</b> `) + highlight(text, hit.terms);
}
let RESTORE_SCROLL = 0; // a live update re-renders the results page; its rows arrive after the scroll was restored
async function viewSearch(main, linkScope, q) {
  if (linkScope === "family" || linkScope === "project") setScope(linkScope, { rerender: false }); // a shared link brings its scope
  const scope = SCOPE === "family" && canFamily() ? "family" : "project";
  if (scope !== linkScope) { history.replaceState(null, "", searchHref(scope, q)); } // this project has no family: the link falls back
  const input = $("#search"); if (document.activeElement !== input) input.value = q;
  const terms = searchTerms(q);
  const sub = el("p", { class: "sub" }, "Searching…");
  main.append(el("div", { class: "search-head" }, el("h1", {}, "Search ", el("span", { class: "q" }, `“${q}”`)), el("span", { class: "note" }, scope === "family" ? "whole family — switch next to the project menu" : canFamily() ? "this project — switch next to the project menu" : "")), sub);
  if (terms.length === 0 || q.trim().length < 2) { sub.textContent = "Type at least two characters in the search field and press Enter."; return; }
  const pool = await searchPool(scope);
  if (location.hash !== searchHref(scope, q) && decodeURIComponent(location.hash) !== decodeURIComponent(searchHref(scope, q))) return; // navigated away meanwhile
  const rows = searchRows(pool, q);
  const shown = rows.filter(({ e }) => matches(e)).length;
  const projectsHit = new Set(rows.map((r) => r.g)).size;
  sub.textContent = `${plural(rows.length, "entry").replace("entrys", "entries")} in ${plural(projectsHit, "project")}` +
    (scope === "family" ? ` · ${plural(pool.groups.length, "project")} searched` : "") +
    (terms.length > 1 ? ` · all of: ${terms.join(", ")}` : "") +
    (filterActive() ? ` · ${shown} match the sidebar filters, the rest dimmed` : "") +
    " · searched: title, body, Revisit when, Source, Verification, Superseded by, Id, file, type, status, evidence";
  const box = el("div", { class: "search-page" });
  for (const g of pool.groups) {
    const mine = rows.filter((r) => r.g === g);
    if (!mine.length) continue;
    const m = g.member;
    const head = el("div", { class: "sg-head" },
      m.role === "self" ? el("b", {}, m.name) : el("a", { href: PUBLISHED() ? publicHref(m.canonical, m.root || "") : `${location.pathname}?project=${encodeURIComponent(m.key)}#overview` }, m.name),
      pill(memberLabel(m), "role"), el("span", { class: "count" }, plural(mine.length, "hit")));
    box.append(el("section", { class: "sgroup" }, head, m.scope ? el("div", { class: "ms note" }, m.scope) : null,
      el("div", { class: "entry-list" }, mine.map(({ e, hit }) => {
        const gt = e.git;
        const meta = [topicTitle(g.state, e.file), e.file, gt?.created?.author ? `${gt.created.author} · ${gt.created.date}` : null,
          gt?.last_touched?.date && gt.last_touched.date !== gt?.created?.date ? `touched ${gt.last_touched.date}` : null,
          e.uuid ? `Id ${e.uuid.slice(0, 8)}` : null, plural(hit.count, "match").replace("matchs", "matches")].filter(Boolean).join("  ·  ");
        return el("a", { href: g.href(e), class: `row ${matches(e) ? "" : "dim"}` },
          el("div", { class: "rt" }, el("span", { html: highlight(e.title.replace(/`/g, ""), hit.terms) }), ...entryPills(e)),
          el("div", { class: "rs", html: hitSnippet(hit) }),
          el("div", { class: "rm" }, meta));
      }))));
  }
  if (!rows.length) box.append(el("p", { class: "center" }, `No entry matches “${q}”`, scope === "project" && canFamily() ? [" in this project — ", el("a", { href: searchHref("family", q) }, "search the whole family")] : "", "."));
  if (pool.missing.length) box.append(el("section", { class: "sgroup missing" }, el("div", { class: "sg-head" }, el("b", {}, "Not searched"), el("span", { class: "count" }, pool.missing.length)),
    pool.missing.map(({ member: m, reason }) => el("div", { class: "sr-missing" }, el("b", {}, m.name), ` (${memberLabel(m)}) — ${reason}`)),
    el("p", { class: "note" }, "Family shows how to get a member that is not on this machine.")));
  main.append(box);
  if (RESTORE_SCROLL) main.scrollTop = RESTORE_SCROLL;
}
function setupSearch() {
  const input = $("#search"); const box = $("#search-results"); let sel = -1; let seq = 0;
  const close = () => { box.hidden = true; sel = -1; };
  const run = async () => {
    const q = input.value.trim(); if (q.length < 2 || !S) return close();
    const mine = ++seq;
    const pool = await searchPool(scope());
    if (mine !== seq) return; // a newer keystroke won
    const all = searchRows(pool, q);
    // this project's hits first, then the rest; the page shows everything
    const rows = [...all.filter((r) => r.g.member.role === "self"), ...all.filter((r) => r.g.member.role !== "self")].slice(0, 12);
    const projects = new Set(all.map((r) => r.g)).size;
    box.replaceChildren(...(rows.length ? rows.map(({ e, hit, g }) => el("a", { href: g.href(e), onclick: close },
      el("div", { html: highlight(e.title.replace(/`/g, ""), hit.terms) }),
      el("div", { class: "sr-file" }, g.member.role === "self" ? "" : `${g.member.name} (${memberLabel(g.member)}) · `, topicTitle(g.state, e.file)),
      el("div", { class: "sr-snip", html: hitSnippet(hit) }))) : [el("div", { style: "padding:10px 12px;color:var(--fg3)" }, "no matches")]),
      pool.missing.length ? el("div", { class: "sr-missing" }, `${plural(pool.missing.length, "family member")} not available here — not searched.`) : null,
      el("a", { class: "sr-all", href: searchHref(scope(), q), onclick: close }, all.length > rows.length ? `↵  all ${all.length} results in ${plural(projects, "project")}` : "↵  results page"));
    box.hidden = false; sel = -1;
  };
  window.__ktwScopeChanged = () => { if (!box.hidden && input.value.trim().length >= 2) run(); };
  input.oninput = run; input.onfocus = () => { if (input.value.trim().length >= 2 && !location.hash.startsWith("#search/")) run(); };
  input.onkeydown = (ev) => {
    const items = [...box.querySelectorAll("a")];
    if (ev.key === "Escape") { input.blur(); close(); }
    else if (ev.key === "ArrowDown") { sel = Math.min(items.length - 1, sel + 1); items.forEach((a, i) => a.classList.toggle("sel", i === sel)); items[sel]?.scrollIntoView?.({ block: "nearest" }); ev.preventDefault(); }
    else if (ev.key === "ArrowUp") { sel = Math.max(0, sel - 1); items.forEach((a, i) => a.classList.toggle("sel", i === sel)); ev.preventDefault(); }
    else if (ev.key === "Enter") {
      ev.preventDefault();
      if (!box.hidden && items[sel]) { items[sel].click(); input.blur(); return; }
      const q = input.value.trim(); if (q.length < 2) return;
      seq++; close(); input.blur(); // Enter without a selection: the results page
      location.hash = searchHref(scope(), q);
    }
  };
  document.addEventListener("click", (ev) => { if (!ev.target.closest(".topbar-right")) close(); });
  document.addEventListener("keydown", (ev) => {
    if (ev.target.matches("input,select,textarea") || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key === "/") { ev.preventDefault(); input.focus(); input.select(); }
    else if (ev.key === "g") location.hash = "#graph"; else if (ev.key === "l") location.hash = "#findings"; else if (ev.key === "o") location.hash = "#overview"; else if (ev.key === "q") location.hash = "#queues"; else if (ev.key === "t") location.hash = "#timeline"; else if (ev.key === "a") location.hash = "#authors";
  });
}

// ---------------------------------------------------------------- router + live
function render() {
  if (!S) return;
  const main = $("#main"); main.replaceChildren();
  const route = location.hash.slice(1) || "overview";
  selected = null;
  $("#details").dataset.pane = "other";
  if (!route.startsWith("graph")) { const bar = pathBar(); if (bar) main.append(bar); } // the graph carries it as an overlay
  if (route === "overview") { viewOverview(main); renderDetailsDefault(); }
  else if (route === "graph/family") { setScope("family", { rerender: false }); history.replaceState(null, "", "#graph"); viewGraph(main); renderDetailsDefault(); }
  else if (route === "graph") { viewGraph(main); renderDetailsDefault(); }
  else if (route === "timeline") { viewTimeline(main); renderDetailsDefault(); }
  else if (route === "authors") { viewAuthors(main); renderDetailsDefault(); }
  else if (route === "queues") { viewQueues(main); renderDetailsDefault(); }
  else if (route === "findings") { viewFindings(main); renderDetailsDefault(); }
  else if (route === "family") { viewFamily(main); renderDetailsDefault(); }
  else if (route === "projects") { viewProjects(main); renderDetailsDefault(); }
  else if (route === "friends") { viewFriends(main); renderDetailsDefault(); }
  else if (route === "thoughts") { viewThoughtsPage(main); renderDetailsDefault(); }
  else if (route.startsWith("topic/")) viewTopic(main, route.slice(6));
  else if (route.startsWith("entry/")) viewEntry(main, decodeURIComponent(route.slice(6)));
  else if (route.startsWith("thought/")) viewThought(main, route.slice(8).split(",").filter(Boolean).map(decodeURIComponent));
  else if (route.startsWith("ref/")) { const cut = route.lastIndexOf("/"); viewRemoteEntry(main, decodeURIComponent(route.slice(4, cut)), route.slice(cut + 1)); renderDetailsDefault(); }
  else if (route.startsWith("search/")) { const [, scope, ...q] = route.split("/"); viewSearch(main, scope, decodeURIComponent(q.join("/"))); renderDetailsDefault(); }
  else { viewOverview(main); renderDetailsDefault(); }
  markActive(); applySide();
  if (!route.startsWith("graph")) { main.scrollTop = 0; if (narrow()) { const stuck = $("#sidebar").getBoundingClientRect().height; window.scrollTo(0, Math.max(0, main.getBoundingClientRect().top + window.scrollY - stuck - 8)); } }
}
function rerender() { renderSidebar(); renderStrip(); renderCounts(); render(); }
// With the family scope every view shows the family merged; the merge needs
// the members' states, so it runs after them — the last merge is kept, so a
// live update of this project re-merges at once and refreshes behind it.
let LAST_POOL = null; let MERGE_SEQ = 0;
function mergeWith(pool) { S = mergeStates([{ ...pool.groups[0], state: SELF }, ...pool.groups.slice(1)]); S.missing = pool.missing; }
async function showScope() {
  const mine = ++MERGE_SEQ;
  if (!SELF) return; // no state yet: the first applyState merges when it arrives
  if (scope() !== "family") { S = SELF; LAST_POOL = null; return rerender(); }
  if (LAST_POOL) { mergeWith(LAST_POOL); rerender(); }
  const pool = await searchPool("family");
  if (mine !== MERGE_SEQ || scope() !== "family") return;
  LAST_POOL = pool; const keep = $("#main").scrollTop; mergeWith(pool); rerender(); $("#main").scrollTop = keep;
}
// the numbers in the status bar follow what is shown
function renderCounts() { const c = $("#counts"); if (c) c.textContent = `${S.entries.length} entries · ${S.topics.length} topics · ${S.authors.length} authors${S.merged ? ` · family of ${S.family.length}` : ""}`; }
// A Git author as a link to their profile on the host: the host's API names
// the account behind one of their commits (asked on click, in the browser);
// when it cannot, the commit's page opens, where the host links the author.
const AUTHOR_URLS = {};
function authorCommit(name) {
  // the newest commit of this author among the entries shown, and the project it is in
  let best = null;
  for (const e of S.entries) for (const c of [e.git?.created, e.git?.last_touched, ...(e.git?.status_history || [])]) if (c?.author === name && c.commit && (!best || (c.date || "") > (best.c.date || ""))) best = { c, e };
  return best ? [best.c.commit, best.e.origin?.state?.project || SELF.project] : [null, null];
}
function authorLink(name, commit, project) {
  const look = !S.anonymized && project ? authorLookup(canonicalOf(project), commit) : null;
  if (!name || !look) return el("span", {}, name || "—");
  const key = `${canonicalOf(project)}|${name}`;
  return el("a", { class: "author", href: AUTHOR_URLS[key] || look.fallback, target: "_blank", rel: "noopener", title: `${name} — open the profile on the host (looked up from commit ${commit})`, onclick: async (ev) => {
    ev.stopPropagation();
    if (AUTHOR_URLS[key] || !look.api) return; // known, or a host whose API names no account: the link goes straight there
    ev.preventDefault();
    const w = window.open("about:blank", "_blank"); if (w) w.opener = null;
    let url = look.fallback;
    try { const r = await fetch(look.api, { headers: { Accept: "application/json" } }); if (r.ok) url = look.pick(await r.json()) || look.fallback; } catch { /* offline or rate-limited: the commit page names the author too */ }
    if (url !== look.fallback) AUTHOR_URLS[key] = url;
    ev.target.closest("a").href = url;
    if (w) w.location.href = url; else window.open(url, "_blank", "noopener");
  } }, name);
}
function applyState(state) {
  SELF = state; S = state;
  const p = S.project;
  setKids($("#project-title"), $("#project-select").hidden ? el("b", {}, p.id || p.name) : null, schemaPill(p), headPill(p.git), p.git?.remote ? el("span", { class: "pill" }, remoteLink(p.git.remote)) : null);
  document.title = `${p.id || p.name} — Keep the Why`;
  setKids($("#statusbar"),
    el("span", { id: "pkg-dashboard" }, el("a", { href: "https://pypi.org/project/keep-the-why-dashboard/", target: "_blank", rel: "noopener", title: "keep-the-why-dashboard on PyPI" }, `keep-the-why-dashboard ${S.dashboard}`)),
    el("span", { id: "pkg-lint" }, el("a", { href: "https://pypi.org/project/keep-the-why-lint/", target: "_blank", rel: "noopener", title: "keep-the-why-lint on PyPI" }, `keep-the-why-lint ${S.linter}`)),
    el("span", {}, MODE === "public" ? `public export · generated ${S.generated}` : S.exported ? `exported ${S.generated}` : `state ${S.generated}`),
    el("span", { id: "counts" }, `${S.entries.length} entries · ${S.topics.length} topics · ${S.authors.length} authors`),
    el("span", { class: "grow" }, el("a", { href: "https://keepthewhy.com", target: "_blank", rel: "noopener" }, "keepthewhy.com")));
  FAMILY = null;
  if (LIVE()) $("#nav-projects").hidden = false;
  setupMode(); markScope();
  const main = $("#main"); const scroll = main.scrollTop;
  RESTORE_SCROLL = scroll;
  if (scope() === "family") { if (LAST_POOL) mergeWith(LAST_POOL); showScope(); }
  rerender();
  main.scrollTop = scroll;
  markUpdates();
}
let UPDATES = null; // /api/updates result; null until fetched, never in export mode
function markUpdates() {
  if (!UPDATES?.packages) return;
  for (const [name, id] of [["keep-the-why-dashboard", "pkg-dashboard"], ["keep-the-why-lint", "pkg-lint"]]) {
    const info = UPDATES.packages[name]; const span = $(`#${id}`); if (!info || !span) continue;
    const a = span.querySelector("a");
    span.classList.toggle("outdated", !!info.outdated);
    if (info.outdated) { a.title = `${name} ${info.latest} is on PyPI — installed ${info.installed}. Update: pip install -U ${name}`; a.textContent = `${name} ${info.installed} → ${info.latest}`; }
    else if (a) a.title = `${name} on PyPI${info.latest ? ` — ${info.latest} is the newest, you are current` : ""}`;
  }
}
window.__ktwApplyUpdates = (u) => { UPDATES = u; markUpdates(); }; // test hook (jsdom smoke), not used by the page
async function pollUpdates() {
  if (window.__KTW_STATE__) return;
  try { UPDATES = await (await fetch("/api/updates", { cache: "no-store" })).json(); markUpdates(); } catch { /* server gone; the live dot says so */ }
}
let LIVE_ES = null;
function connectLive() {
  const dot = $("#live");
  if (LIVE_ES) { LIVE_ES.close(); LIVE_ES = null; }
  if (window.__KTW_STATE__ && MODE === "export") { dot.className = "live export"; dot.title = "static export — no live updates"; return; }
  if (!LIVE()) { dot.className = "live export"; dot.title = "public export — no live updates"; return; }
  let es;
  const open = () => {
    es = LIVE_ES = new EventSource(api("/api/events"));
    es.addEventListener("state", (ev) => { try { applyState(normalizeState(JSON.parse(ev.data))); dot.className = "live on"; dot.title = `live — last update ${new Date().toLocaleTimeString()}`; } catch (err) { console.error(err); } });
    es.onopen = () => { dot.className = "live on"; dot.title = "live — watching the project for changes"; };
    es.onerror = () => { dot.className = "live off"; dot.title = "connection lost — the server is gone; retrying"; };
  };
  open();
}
// The side pane's width: 1×, 2× (the default), 3×, or half the page beside
// the text — kept per browser, ignored on a narrow screen. Two widths: one
// where the pane is the graph (the overview, the Friends and Thoughts pages,
// the reader), one where it holds something else (an entry's or a topic's
// details, the graph view's legend).
const SIDE_WIDTHS = ["1", "2", "3", "half"];
const readSide = (key, fallback = "2") => { try { const v = localStorage.getItem(key); return SIDE_WIDTHS.includes(v) ? v : fallback; } catch { return fallback; } };
const SIDE = { graph: readSide("ktw-side-graph", readSide("ktw-side")), other: readSide("ktw-side-other") };
const paneKind = () => ($("#details")?.dataset.pane === "graph" ? "graph" : "other");
const sideLabel = (v) => (v === "half" ? "½" : `${v}×`);
function applySide() {
  const v = SIDE[paneKind()];
  $("#app").dataset.side = v;
  const d = $("#details");
  if (d && !d.querySelector(":scope > .pane-width")) d.prepend(paneWidthBar());
  for (const b of document.querySelectorAll(".mini-width button")) b.classList.toggle("on", b.textContent === sideLabel(v));
  for (const G of ACTIVE_GRAPHS) G.wake?.();
}
function setSide(v) { const k = paneKind(); SIDE[k] = v; try { localStorage.setItem(`ktw-side-${k}`, v); } catch {} applySide(); }
// the choice sits at the top of the pane, above whatever it holds, on every page
function paneWidthBar() {
  return el("div", { class: "pane-width", title: "the width of this pane: 1×, 2×, 3×, or half the page — one width where the pane is the graph, one where it holds details" },
    el("span", { class: "label" }, "Width"),
    el("span", { class: "mini-width" }, ...SIDE_WIDTHS.map((v) => el("button", { type: "button", class: v === SIDE[paneKind()] ? "on" : "", onclick: () => setSide(v) }, sideLabel(v)))));
}
function setupSideToggle() {
  const btn = $("#side-toggle"); const app = $("#app");
  btn.onclick = () => { const open = app.classList.toggle("side-open"); btn.setAttribute("aria-expanded", String(open)); btn.textContent = open ? "Topics ▴" : "Topics ▾"; };
  window.addEventListener("hashchange", () => { if (narrow() && app.classList.contains("side-open")) btn.click(); });
}
function setupTheme() {
  const saved = localStorage.getItem("ktw-theme");
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  if (saved === "light" || (!saved && prefersLight)) document.documentElement.dataset.theme = "light";
  $("#theme").onclick = () => { const light = document.documentElement.dataset.theme === "light"; if (light) delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = "light"; localStorage.setItem("ktw-theme", light ? "dark" : "light"); if (graph) { graph.alpha = Math.max(graph.alpha, 0.05); graph.wake?.(); } };
}
function fitSelect(sel) {
  // size the select to its current option's text, not the browser's default width
  const opt = sel.selectedOptions[0]; if (!opt) return;
  const probe = el("span", { style: "position:absolute;visibility:hidden;white-space:nowrap;font:inherit" }, opt.textContent);
  sel.parentElement.append(probe); const w = probe.getBoundingClientRect().width; probe.remove();
  if (w) sel.style.width = `${Math.ceil(w) + 44}px`;
}
async function setupProjects() {
  if (window.__KTW_STATE__) return;
  let data;
  try { data = await (await fetch("/api/projects", { cache: "no-store" })).json(); } catch { return; }
  const sel = $("#project-select");
  const list = data.projects || [];
  if (list.filter((p) => p.path).length < 2 && !list.some((p) => !p.path)) return;
  const current = PROJECT || data.selected;
  PROJECTS = list;
  const opt = (p, indent = "") => el("option", { value: p.key, selected: p.key === current, disabled: !p.path, title: p.path || "location unknown — start the dashboard in that project once, or pass --scan" },
    p.path ? `${indent}${p.name}  (${p.kind === "cache" ? "cache, read only" : "repository"})${p.source === "cwd" ? "  · here" : ""}` : `${p.id}  (location unknown)`);
  // families grouped: a parent, its children indented below it (children found by canonical or path)
  const flat = groupByFamily(list);
  const groups = [["Projects", flat.filter(([p]) => p.path)], ["Known, location unknown", flat.filter(([p]) => !p.path)]];
  sel.replaceChildren(...groups.filter(([, items]) => items.length).map(([label, items]) => el("optgroup", { label }, items.map(([p, d]) => opt(p, "\u00a0\u00a0".repeat(d) + (d ? "└ " : ""))))));
  sel.hidden = false;
  fitSelect(sel);
  if (S) { const t = $("#project-title").querySelector("b"); if (t) t.remove(); }
  sel.onchange = () => { location.href = `${location.pathname}?project=${encodeURIComponent(sel.value)}${location.hash || "#overview"}`; };
  SELECTED_DEFAULT = data.selected;
}
function setupMode() {
  const box = $("#mode"); const p = S.project;
  const canonical = canonicalOf(p);
  // two sources exist only on the live server: this machine's clones, or the
  // published exports. A static page has one — it is published — so no switch
  const hasFamily = !!(p.parent || (p.children || []).length || p.dashboard_state);
  if (STATIC || (!hasFamily && MODE !== "public")) { box.hidden = true; return; }
  box.hidden = false;
  for (const b of box.querySelectorAll("button")) {
    const on = b.dataset.mode === (MODE === "public" ? "public" : "local");
    b.classList.toggle("on", on);
    b.disabled = b.dataset.mode === "public" && !canonical;
    b.title = b.dataset.mode === "public" ? (canonical ? "read this project's family from its published exports" : "no canonical — cannot be looked up publicly") : "read clones and caches on this machine";
    b.onclick = () => {
      if (on) return;
      if (b.dataset.mode === "public") location.href = publicHref(canonical, p.root || "", location.hash || "#overview");
      else location.href = `${location.pathname}${location.hash || "#overview"}`;
    };
  }
  $("#mode-note").textContent = MODE === "public" ? `generated ${S.generated}` : "";
}
async function boot() {
  setupTheme(); setupSearch(); setupScope(); setupSideToggle();
  window.addEventListener("hashchange", () => { RESTORE_SCROLL = 0; render(); });
  window.addEventListener("popstate", onPopState);
  document.addEventListener("click", onLinkClick);
  if (MODE === "public") {
    const r = await fetchPublicState(PUBLIC, PUBLIC_ROOT);
    const dot = $("#live"); dot.className = "live export"; dot.title = "public export — no live updates";
    if (!r.state) {
      const msg = el("div", { class: "center" }, el("p", {}, `Cannot browse ${PUBLIC} publicly: ${r.error}.`));
      $("#main").append(msg);
      if (r.missingLine) {
        // the live server may know a local checkout that already carries the line, on a branch the default branch has not merged
        try {
          const local = ((await (await fetch("/api/projects", { cache: "no-store" })).json()).projects || []).find((p) => p.canonical === PUBLIC && p.dashboard_state);
          if (local) msg.append(el("p", { class: "note" }, `Your checkout at ${local.path} names ${local.dashboard_state} — on a branch that is not on the default branch yet. Public mode reads what is published: the line counts once it is merged, and the family once the published export carries it.`));
        } catch { /* not served by a live dashboard */ }
      }
      msg.append(el("p", {}, el("a", { href: location.pathname }, "back to local")));
      return;
    }
    r.state.exported = true;
    applyState(r.state);
    return;
  }
  setupProjects();
  if (window.__KTW_STATE__) applyState(normalizeState(window.__KTW_STATE__));
  else {
    try { applyState(normalizeState(await (await fetch(api("/api/state.json"), { cache: "no-store" })).json())); }
    catch (err) { $("#main").append(el("p", { class: "center" }, PROJECT ? `No state for project "${PROJECT}" — unknown id or unknown location.` : "Could not load the state — is the server running?")); }
  }
  connectLive();
  pollUpdates(); setTimeout(pollUpdates, 20000); // the server's first check may still be running at boot
  setInterval(pollUpdates, 60 * 60 * 1000);
}
boot();
