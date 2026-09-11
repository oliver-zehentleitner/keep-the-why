/* Keep the Why dashboard — one module, no dependencies.
   The page knows only the state (see state.py): live from /api/events, or
   embedded as window.__KTW_STATE__ in an export. It renders; it never writes. */

const $ = (sel, root = document) => root.querySelector(sel);
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
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (d) => d || "—";
const remoteLink = (remote) => el("a", { class: "gh", href: `https://${remote}`, target: "_blank", rel: "noopener" }, remote);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// ---------------------------------------------------------------- state
let S = null; // current state
const PROJECT = new URLSearchParams(location.search).get("project"); // null: the server's selected one
const api = (path) => PROJECT ? `${path}?project=${encodeURIComponent(PROJECT)}` : path;
let filter = { status: "", evidence: "", author: "" };
let selected = null; // entry id shown in the details pane
const byId = () => Object.fromEntries(S.entries.map((e) => [e.id, e]));
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
  unknown: S.entries.filter((e) => e.evidence === "unknown" && e.status === "active"),
  revisit: S.entries.filter((e) => e.revisit_when && e.status !== "superseded"),
});
const queueTotal = () => { const q = queues(); return q.open.length + q["needs-review"].length + q["pending-confirmation"].length + q.unknown.length; };

// ---------------------------------------------------------------- markdown (small, safe)
function inline(md) {
  let s = esc(md);
  s = s.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:]|$)/g, "$1<i>$2</i>");
  s = s.replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s).,;:]|$)/g, "$1<i>$2</i>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
    if (/^[A-Za-z0-9._-]+\.md(#.*)?$/.test(u) && topicOf(u.split("#")[0])) return `<a href="#topic/${u.split("#")[0]}">${t}</a>`;
    if (/^https?:\/\//.test(u)) return `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
    return `<a>${t}</a>`;
  });
  // bare topic references become links
  s = s.replace(/(^|[^\w/">#-])(<code>)?([A-Za-z0-9][A-Za-z0-9._-]*\.md)(<\/code>)?(?![\w"])/g, (m, pre, c1, f, c2) =>
    topicOf(f) ? `${pre}<a href="#topic/${f}">${c1 || ""}${f}${c2 || ""}</a>` : m);
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
const typePills = (types) => (types?.length ? types : ["—"]).map((t) => pill(t, "type"));
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
const typeCounts = (list) => list.reduce((m, e) => { for (const t of e.type?.length ? e.type : ["(none)"]) m[t] = (m[t] || 0) + 1; return m; }, {});
const STATUS_ORDER = ["active", "open", "needs-review", "pending-confirmation", "superseded"];
const EV_ORDER = ["confirmed", "inferred", "unknown"];
const entryLink = (e, extra = "") => el("a", { href: `#entry/${encodeURIComponent(e.id)}`, class: extra }, e.title);
function entryRow(e) {
  const snippet = e.body.reason || e.body.text.split("\n")[0] || "";
  const g = e.git;
  return el("a", { href: `#entry/${encodeURIComponent(e.id)}`, class: `row ${matches(e) ? "" : "dim"}` },
    el("div", { class: "rt" }, el("span", { html: inline(e.title) }), ...entryPills(e)),
    el("div", { class: "rs" }, snippet.replace(/\*\*|`/g, "")),
    el("div", { class: "rm" }, [topicOf(e.file)?.title || e.file, g?.created?.author ? `${g.created.author} · ${g.created.date}` : null, g?.last_touched?.date && g.last_touched.date !== g?.created?.date ? `touched ${g.last_touched.date}` : null].filter(Boolean).join("  ·  ")));
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
  main.append(el("table", { class: "t findings" }, el("thead", {}, el("tr", {}, ["Severity", "Code", "Where", "Message"].map((h) => el("th", {}, h)))),
    el("tbody", {}, f.items.map((x) => {
      const entry = S.entries.find((e) => `${S.project.context}${e.file}` === x.path && e.line <= x.line && x.line <= e.end_line + 1);
      return el("tr", {}, el("td", {}, pill(x.severity, `sev-${x.severity}`)), el("td", { class: "mono" }, x.code),
        el("td", { class: "mono" }, entry ? el("a", { href: `#entry/${encodeURIComponent(entry.id)}` }, `${x.path}:${x.line}`) : `${x.path}${x.line ? ":" + x.line : ""}`), el("td", {}, x.message));
    }))));
}

// ---------------------------------------------------------------- sidebar
function renderSidebar() {
  const tree = $("#tree");
  tree.replaceChildren();
  const openState = JSON.parse(sessionStorage.getItem("ktw-tree") || "{}");
  for (const t of S.topics) {
    const list = entriesOf(t.file);
    const d = el("details", { open: openState[t.file] ?? (S.topics.length <= 6) });
    d.addEventListener("toggle", () => { openState[t.file] = d.open; sessionStorage.setItem("ktw-tree", JSON.stringify(openState)); });
    d.append(el("summary", { "data-file": t.file, onclick: (ev) => { if (ev.target.closest(".tw")) return; ev.preventDefault(); location.hash = `#topic/${t.file}`; d.open = true; } },
      el("span", { class: "tw" }, "▶"), el("span", { class: "tt" }, t.title), el("span", { class: "count" }, list.length)));
    for (const e of list) d.append(el("a", { href: `#entry/${encodeURIComponent(e.id)}`, class: `leaf ${matches(e) ? "" : "dim"}`, "data-id": e.id, title: e.title },
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
  const file = route.startsWith("topic/") ? route.slice(6) : route.startsWith("entry/") ? decodeURIComponent(route.slice(6)).split("#")[0] : null;
  for (const s of document.querySelectorAll(".tree summary")) s.classList.toggle("active", s.dataset.file === file && route.startsWith("topic/"));
  for (const a of document.querySelectorAll(".tree .leaf")) a.classList.toggle("active", route.startsWith("entry/") && a.dataset.id === decodeURIComponent(route.slice(6)));
  if (file) { const d = document.querySelector(`.tree summary[data-file="${CSS.escape(file)}"]`)?.parentElement; if (d) d.open = true; }
  document.querySelector(".tree .leaf.active")?.scrollIntoView?.({ block: "nearest" });
}

// ---------------------------------------------------------------- views
function viewOverview(main) {
  const list = S.entries;
  const p = S.project; const g = p.git;
  main.append(
    el("h1", {}, p.id || p.name),
    el("p", { class: "sub" }, `${p.context} · schema ${p.schema} · ${p.config["capture-confirmation"] || "?"} · source-reference ${p.config["source-reference"] || "?"}`,
      g?.available ? [` · ${g.branch}@${g.head}`, g.remote ? [" · ", remoteLink(g.remote)] : null] : " · no Git"),
    el("div", { class: "grid2" },
      el("div", { class: "card" }, el("h3", {}, "Type"), bars(typeCounts(list), ["decision", "constraint", "workaround", "incident"])),
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
function viewEntry(main, id) {
  const e = byId()[id];
  if (!e) return main.append(el("p", { class: "center" }, "No such entry"));
  const list = entriesOf(e.file); const idx = list.indexOf(e);
  const t = topicOf(e.file);
  const r = el("div", { class: `reader ${e.status}` },
    el("div", { class: "crumbs" }, el("a", { href: "#overview" }, "Overview"), " / ", el("a", { href: `#topic/${e.file}` }, t?.title || e.file), ` / line ${e.line}`),
    el("h1", { html: inline(e.title) }),
    el("div", { class: "fields" }, ...entryPills(e), e.source ? pill(`Source: ${e.source}`, "") : null, e.verification ? pill(`Verification: ${e.verification.split(/\s[—-]\s/)[0]}`, "") : null),
    el("div", { class: "body", html: renderMarkdown(e.body.text || "_(no body)_") }),
    e.revisit_when ? el("div", { class: "body" }, el("div", { class: "label", html: `<b>Revisit when</b><p>${inline(e.revisit_when)}</p>` })) : null,
    el("div", { class: "pager" },
      idx > 0 ? el("a", { href: `#entry/${encodeURIComponent(list[idx - 1].id)}` }, `← ${list[idx - 1].title}`) : el("span"),
      idx < list.length - 1 ? el("a", { href: `#entry/${encodeURIComponent(list[idx + 1].id)}` }, `${list[idx + 1].title} →`) : el("span")),
  );
  main.append(r);
  selected = e.id;
  renderDetailsEntry(e);
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
    section("Unknown evidence on active entries", "The claim stands, its origin could not be traced. A maintainer can often settle these in a minute.", q.unknown),
    section("Revisit-when triggers", "The conditions on record. Whether one has fired is a human judgement; the dashboard cannot tell.", q.revisit),
  );
}
function viewAuthors(main) {
  const rows = S.authors;
  main.append(el("h1", {}, "Authors"), el("p", { class: "sub" }, "Git authors of the entries — who created, touched, or superseded what. Git knows names, not who was driving."));
  if (!S.project.git?.available) return main.append(el("p", { class: "center" }, "No Git repository — nothing to attribute."));
  const tbl = el("table", { class: "t" }, el("thead", {}, el("tr", {}, ["Author", "Created", "Touched", "Superseded", "Evidence of created entries", "First", "Last"].map((h) => el("th", {}, h)))),
    el("tbody", {}, rows.map((a) => el("tr", { class: `clickable ${filter.author === a.name ? "sel" : ""}`, onclick: () => { filter.author = filter.author === a.name ? "" : a.name; rerender(); } },
      el("td", {}, el("b", {}, a.name)), el("td", {}, a.created), el("td", {}, a.touched), el("td", {}, a.superseded),
      el("td", {}, el("div", { style: "min-width:160px" }, stack(a.evidence, EV_ORDER))), el("td", { class: "mono" }, fmtDate(a.first)), el("td", { class: "mono" }, fmtDate(a.last))))));
  main.append(tbl, el("p", { class: "note", style: "margin-top:10px" }, "Click a row to filter every view to that author; click again to clear."));
  if (filter.author) main.append(el("h2", {}, `Entries created by ${filter.author}`), el("div", { class: "entry-list" }, S.entries.filter((e) => authorOf(e) === filter.author).map(entryRow)));
}

// ---------------------------------------------------------------- details pane
function renderDetailsTopic(t) {
  const d = $("#details"); d.replaceChildren();
  d.append(el("h3", {}, "Topic"), el("div", { class: "kv" }, el("span", { class: "k" }, "file"), el("span", { class: "v mono" }, t.file), el("span", { class: "k" }, "entries"), el("span", { class: "v" }, t.entries)));
  d.append(el("h3", {}, `References out (${t.refs_out.length})`), ...(t.refs_out.length ? t.refs_out.map((f) => el("a", { class: "backlink", href: `#topic/${f}` }, topicOf(f)?.title || f)) : [el("p", { class: "empty" }, "none")]));
  d.append(el("h3", {}, `Referenced by (${t.refs_in.length})`), ...(t.refs_in.length ? t.refs_in.map((f) => el("a", { class: "backlink", href: `#topic/${f}` }, topicOf(f)?.title || f)) : [el("p", { class: "empty" }, "none")]));
  const box = el("div", { class: "mini tall" }, el("span", { class: "mini-title" }, "neighbourhood"), el("span", { class: "mini-hint" }, "click to open"));
  const canvas = el("canvas"); box.prepend(canvas);
  d.append(el("h3", {}, "Graph"), box);
  requestAnimationFrame(() => runGraph(canvas, buildTopicSubgraph(t), { mini: true, focusId: `t:${t.file}` }));
}
function renderDetailsEntry(e) {
  const d = $("#details"); d.replaceChildren();
  const g = e.git;
  d.append(el("h3", {}, "Entry"), el("div", { class: "kv" },
    el("span", { class: "k" }, "id"), el("span", { class: "v mono" }, e.id),
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
    const who = (c) => c ? [`${c.author}${c.date ? " · " + c.date : ""}${c.commit ? " · " : ""}`, c.commit ? el("code", {}, c.commit) : null] : ["—"];
    d.append(el("div", { class: "kv" },
      el("span", { class: "k" }, "created"), el("span", { class: "v" }, ...who(g.created)),
      el("span", { class: "k" }, "last touched"), el("span", { class: "v" }, ...who(g.last_touched))));
    if (g.status_history?.length) d.append(el("h3", {}, "Status history"), el("ul", { class: "hist" }, g.status_history.map((h) => el("li", { class: h.status }, `${h.status}`, el("div", { class: "d" }, `${h.author} · ${h.date} · ${h.commit}`)))));
  }
  const back = S.entries.filter((x) => x.id !== e.id && x.refs.includes(e.file));
  d.append(el("h3", {}, `Backlinks (${back.length})`), ...(back.length ? back.map((x) => el("a", { class: "backlink", href: `#entry/${encodeURIComponent(x.id)}` }, x.title, el("div", { class: "note" }, topicOf(x.file)?.title || x.file))) : [el("p", { class: "empty" }, `nothing references ${e.file}`)]));
  if (e.refs.length) d.append(el("h3", {}, "References"), ...e.refs.map((f) => el("a", { class: "backlink", href: `#topic/${f}` }, topicOf(f)?.title || f)));
  if (e.findings.length) d.append(el("h3", {}, "Linter"), ...e.findings.map((f) => el("div", { class: "finding" }, pill(f.code, `sev-${f.severity}`), ` line ${f.line}: ${f.message}`)));
  renderDetailsNeighbourhood(e);
}
function renderDetailsDefault() {
  const d = $("#details"); d.replaceChildren();
  const route = location.hash.slice(1) || "overview";
  if (route === "graph") {
    d.append(el("h3", {}, "Legend"), el("div", { class: "legend-list" },
      el("span", {}, el("i", { class: "dot", style: "background:var(--accent);width:12px;height:12px" }), "topic — size follows its entry count"),
      el("span", {}, el("i", { class: "dot confirmed" }), "entry, Evidence confirmed"), el("span", {}, el("i", { class: "dot inferred" }), "entry, Evidence inferred"), el("span", {}, el("i", { class: "dot unknown" }), "entry, Evidence unknown"),
      el("span", {}, el("i", { class: "dot", style: "background:transparent;border:1.5px solid var(--fg3)" }), "superseded — hollow"),
      el("span", {}, el("i", { class: "dot", style: "background:var(--bg);border:1.5px solid var(--open)" }), "ring — open, needs review, pending"),
      el("span", {}, "solid line — a reference between topics; dotted — membership")),
      el("h3", {}, "Keys"), el("p", { class: "note" }, el("kbd", {}, "/"), " search · ", el("kbd", {}, "g"), " graph · ", el("kbd", {}, "o"), " overview · ", el("kbd", {}, "q"), " queues · ", el("kbd", {}, "t"), " timeline · ", el("kbd", {}, "a"), " authors"));
    return;
  }
  const box = el("div", { class: "mini fill" }, el("span", { class: "mini-title" }, "graph"), el("span", { class: "mini-hint" }, "hover · click · g for the full view"));
  const canvas = el("canvas"); box.prepend(canvas);
  d.append(box);
  requestAnimationFrame(() => runGraph(canvas, buildGraph(), { mini: true }));
}
function renderDetailsNeighbourhood(e) {
  const d = $("#details");
  const box = el("div", { class: "mini tall" }, el("span", { class: "mini-title" }, "neighbourhood"), el("span", { class: "mini-hint" }, "click to open"));
  const canvas = el("canvas"); box.prepend(canvas);
  d.append(el("h3", {}, "Graph"), box);
  requestAnimationFrame(() => runGraph(canvas, buildSubgraph(e), { mini: true, focusId: `e:${e.id}` }));
}
// ---------------------------------------------------------------- graph (canvas force layout, no library)
let graph = null; // the full graph persists across re-renders so positions survive live updates
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
  for (const e of entries) add({ id: `e:${e.id}`, kind: "entry", label: e.title, file: e.file, entry: e, r: 4.2, href: `#entry/${encodeURIComponent(e.id)}` });
  for (const e of entries) {
    if (index[`t:${e.file}`] != null) links.push({ s: index[`e:${e.id}`], t: index[`t:${e.file}`], kind: "member", len: 46 });
    for (const f of e.refs) if (index[`t:${f}`] != null) links.push({ s: index[`e:${e.id}`], t: index[`t:${f}`], kind: "ref", len: 120 });
  }
  const seen = new Set();
  for (const t of topics) for (const f of t.refs_out) { if (index[`t:${f}`] == null) continue; const k = [t.file, f].sort().join("|"); if (seen.has(k)) continue; seen.add(k); links.push({ s: index[`t:${t.file}`], t: index[`t:${f}`], kind: "topic", len: 170 }); }
  return { nodes, links, index };
}
function buildGraph() {
  const prev = graph ? Object.fromEntries(graph.nodes.map((n) => [n.id, n])) : {};
  graph = Object.assign(graph || { scale: 1, ox: 0, oy: 0, showEntries: true, showLabels: true, alpha: 1 }, assemble(S.topics, S.entries, prev));
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
  for (const b of back) files.add(b.file);
  const topics = S.topics.filter((t) => files.has(t.file));
  const entries = S.entries.filter((x) => x.file === e.file || x.id === e.id || back.includes(x));
  const prev = graph ? Object.fromEntries(graph.nodes.map((n) => [n.id, n])) : {};
  return Object.assign({ scale: 1, ox: 0, oy: 0, showEntries: true, showLabels: true, alpha: 1 }, assemble(topics, entries, prev));
}
function viewGraph(main) {
  const g = buildGraph();
  const wrap = el("div", { class: "graph-wrap" });
  const canvas = el("canvas");
  const ui = el("div", { class: "graph-ui" },
    el("label", {}, el("input", { type: "checkbox", checked: g.showEntries, onchange: (ev) => { g.showEntries = ev.target.checked; g.alpha = 0.5; } }), "entries"),
    el("label", {}, el("input", { type: "checkbox", checked: g.showLabels, onchange: (ev) => { g.showLabels = ev.target.checked; } }), "labels"),
    el("button", { class: "link-btn", onclick: () => { g.scale = 1; g.ox = 0; g.oy = 0; for (const n of g.nodes) { n.fixed = false; } g.alpha = 1; } }, "reset"),
  );
  const legend = el("div", { class: "graph-legend" },
    el("span", {}, el("i", { class: "dot", style: "background:var(--accent);width:12px;height:12px" }), "topic (size = entries)"),
    el("span", {}, el("i", { class: "dot confirmed" }), "confirmed"), el("span", {}, el("i", { class: "dot inferred" }), "inferred"), el("span", {}, el("i", { class: "dot unknown" }), "unknown"),
    el("span", {}, el("i", { class: "dot", style: "background:transparent;border:1.5px solid var(--fg3)" }), "superseded"),
    el("span", {}, "— reference · ··· membership"));
  wrap.append(canvas, ui, legend, el("div", { class: "graph-hint" }, "drag nodes · wheel zoom · drag background to pan · click to open"));
  main.append(wrap);
  runGraph(canvas, g, {});
}
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
  const visible = (n) => n.kind === "topic" || g.showEntries;
  const dim = (n) => n.kind === "entry" && filterActive() && !matches(n.entry);
  const pick = (px, py) => { const [x, y] = toWorld(px, py); let best = null, bd = 1e9; for (const n of g.nodes) { if (!visible(n)) continue; const d = Math.hypot(n.x - x, n.y - y); if (d < Math.max(n.r + 4, 8) / Math.min(g.scale, 1) && d < bd) { best = n; bd = d; } } return best; };
  canvas.onmousemove = (ev) => {
    const r = canvas.getBoundingClientRect(); const px = ev.clientX - r.left, py = ev.clientY - r.top;
    if (drag) { const [x, y] = toWorld(px, py); drag.x = x; drag.y = y; drag.vx = drag.vy = 0; drag.fixed = true; g.alpha = Math.max(g.alpha, 0.3); moved = true; return; }
    if (pan) { g.ox = pan.ox + (px - pan.px); g.oy = pan.oy + (py - pan.py); moved = true; return; }
    hover = pick(px, py); canvas.style.cursor = hover ? "pointer" : "grab";
  };
  canvas.onmousedown = (ev) => { const r = canvas.getBoundingClientRect(); const px = ev.clientX - r.left, py = ev.clientY - r.top; moved = false; const n = pick(px, py); if (n) drag = n; else pan = { px, py, ox: g.ox, oy: g.oy }; canvas.classList.add("grabbing"); };
  window.addEventListener("mouseup", () => { if (drag && !moved) { location.hash = drag.href; } drag = null; pan = null; canvas.classList.remove("grabbing"); });
  canvas.onmouseleave = () => { hover = null; };
  canvas.onwheel = (ev) => { ev.preventDefault(); const r = canvas.getBoundingClientRect(); const px = ev.clientX - r.left - W / 2, py = ev.clientY - r.top - H / 2; const f = Math.exp(-ev.deltaY * 0.0012); const ns = Math.min(6, Math.max(0.15, g.scale * f)); const k = ns / g.scale; g.ox = px - (px - g.ox) * k; g.oy = py - (py - g.oy) * k; g.scale = ns; };
  canvas.ondblclick = (ev) => { const r = canvas.getBoundingClientRect(); const n = pick(ev.clientX - r.left, ev.clientY - r.top); if (n) { n.fixed = false; g.alpha = 0.4; } };
  const ev = (n) => n.entry.evidence;
  const evColor = { confirmed: color("--confirmed"), inferred: color("--inferred"), unknown: color("--unknown") };
  function step() {
    const ns = g.nodes.filter(visible);
    if (g.alpha > 0.003) {
      const k = g.alpha;
      // repulsion
      for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i], b = ns[j]; let dx = b.x - a.x, dy = b.y - a.y; let d2 = dx * dx + dy * dy + 0.01; if (d2 > 250000) continue;
        const rep = (a.kind === "topic" && b.kind === "topic" ? 2600 : a.kind === "entry" && b.kind === "entry" ? 260 : 900) / d2; const d = Math.sqrt(d2);
        const fx = (dx / d) * rep * k, fy = (dy / d) * rep * k;
        if (!a.fixed) { a.vx -= fx; a.vy -= fy; } if (!b.fixed) { b.vx += fx; b.vy += fy; }
      }
      // springs
      for (const l of g.links) { const a = g.nodes[l.s], b = g.nodes[l.t]; if (!visible(a) || !visible(b)) continue; const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 0.01; const f = (d - l.len) * (l.kind === "member" ? 0.05 : 0.02) * k; const fx = (dx / d) * f, fy = (dy / d) * f; if (!a.fixed) { a.vx += fx; a.vy += fy; } if (!b.fixed) { b.vx -= fx; b.vy -= fy; } }
      // gravity + integrate
      for (const n of ns) { if (n.fixed) continue; n.vx -= n.x * 0.004 * k; n.vy -= n.y * 0.004 * k; n.vx *= 0.82; n.vy *= 0.82; n.x += n.vx; n.y += n.vy; }
      g.alpha *= 0.985;
    }
    if (mini && g.alpha > 0.01) { // keep the small canvas framed on the nodes while they settle
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (const n of ns) { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); }
      if (ns.length) { const sw = Math.max(80, maxX - minX + 60), sh = Math.max(80, maxY - minY + 60); g.scale = Math.min(2.2, Math.min(W / sw, H / sh)); g.ox = -((minX + maxX) / 2) * g.scale; g.oy = -((minY + maxY) / 2) * g.scale; }
    }
    // draw
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2 + g.ox, H / 2 + g.oy); ctx.scale(g.scale, g.scale);
    const focus = hover || (opts.focusId && g.index[opts.focusId] != null ? g.nodes[g.index[opts.focusId]] : null) || (!mini && selected ? g.nodes[g.index[`e:${selected}`]] : null);
    const neigh = new Set(); if (focus) { neigh.add(focus); for (const l of g.links) { if (g.nodes[l.s] === focus) neigh.add(g.nodes[l.t]); if (g.nodes[l.t] === focus) neigh.add(g.nodes[l.s]); } }
    for (const l of g.links) { const a = g.nodes[l.s], b = g.nodes[l.t]; if (!visible(a) || !visible(b)) continue; const hi = focus && (a === focus || b === focus); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineWidth = (l.kind === "topic" ? 1.6 : l.kind === "ref" ? 1 : 0.6) / g.scale; ctx.setLineDash(l.kind === "member" ? [2 / g.scale, 3 / g.scale] : []); ctx.strokeStyle = hi ? color("--accent2") : color("--line"); ctx.globalAlpha = focus && !hi ? 0.25 : 1; ctx.stroke(); }
    ctx.setLineDash([]);
    for (const n of ns) {
      const faded = (focus && !neigh.has(n)) || dim(n);
      ctx.globalAlpha = faded ? 0.18 : 1;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      if (n.kind === "topic") { ctx.fillStyle = color("--accent"); ctx.fill(); }
      else { const sup = n.entry.status === "superseded"; ctx.fillStyle = sup ? color("--bg") : evColor[ev(n)] || color("--muted"); ctx.fill(); if (sup) { ctx.lineWidth = 1.2 / g.scale; ctx.strokeStyle = evColor[ev(n)] || color("--fg3"); ctx.stroke(); } if (n.entry.status === "open" || n.entry.status === "needs-review" || n.entry.status === "pending-confirmation") { ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 2.5 / g.scale, 0, Math.PI * 2); ctx.lineWidth = 1.2 / g.scale; ctx.strokeStyle = color(`--${n.entry.status}`); ctx.stroke(); } }
      if (n === focus) { ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 4 / g.scale, 0, Math.PI * 2); ctx.lineWidth = 1.5 / g.scale; ctx.strokeStyle = color("--fg"); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    if (g.showLabels || focus) {
      ctx.font = `${(mini ? 11 : 12) / g.scale}px ${color("--font") || "sans-serif"}`; ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (const n of ns) {
        const show = n.kind === "topic" ? (mini ? neigh.has(n) || n === focus || g.nodes.filter((x) => x.kind === "topic").length <= 12 : g.showLabels || neigh.has(n)) : (focus && (neigh.has(n) || n === focus)) || (!mini && g.showLabels && g.scale > 1.6);
        if (!show) continue;
        const faded = focus && !neigh.has(n) && n !== focus; if (faded) continue;
        const lbl = n.label.replace(/`/g, ""); const txt = lbl.length > 48 ? lbl.slice(0, 46) + "…" : lbl;
        const tw = ctx.measureText(txt).width; const y = n.y + n.r + 3 / g.scale;
        ctx.fillStyle = color("--bg"); ctx.globalAlpha = 0.75; ctx.fillRect(n.x - tw / 2 - 3 / g.scale, y - 1 / g.scale, tw + 6 / g.scale, 15 / g.scale); ctx.globalAlpha = 1;
        ctx.fillStyle = n.kind === "topic" ? color("--fg") : color("--fg2"); ctx.fillText(txt, n.x, y);
      }
    }
    ctx.restore();
    if (canvas.isConnected) g.raf = requestAnimationFrame(step); else ro.disconnect();
  }
  if (g.raf) cancelAnimationFrame(g.raf);
  g.raf = requestAnimationFrame(step);
}

// ---------------------------------------------------------------- timeline (SVG)
const PALETTE = ["#835bec", "#4aa3df", "#4fbf7a", "#e0a83a", "#e0574f", "#d66fd6", "#3fbfbf", "#b0b04a", "#ff8c5a", "#8b8b98"];
const authorColor = (name) => PALETTE[Math.max(0, S.authors.findIndex((a) => a.name === name)) % PALETTE.length];
function viewTimeline(main) {
  main.append(el("h1", {}, "Timeline"), el("p", { class: "sub" }, "Entries by the month their heading first appeared in Git, stacked by author. Grey ticks below: entries superseded in that month."));
  if (!S.project.git?.available) return main.append(el("p", { class: "center" }, "No Git repository — no dates to draw."));
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
function setupSearch() {
  const input = $("#search"); const box = $("#search-results"); let sel = -1; let rows = [];
  const close = () => { box.hidden = true; sel = -1; };
  const run = () => {
    const q = input.value.trim().toLowerCase(); if (q.length < 2) return close();
    rows = S.entries.map((e) => { const hay = `${e.title}\n${e.body.text}`.toLowerCase(); const i = hay.indexOf(q); return i < 0 ? null : { e, i, title: e.title.toLowerCase().includes(q) }; }).filter(Boolean).sort((a, b) => (b.title - a.title) || a.i - b.i).slice(0, 30);
    box.replaceChildren(...(rows.length ? rows.map(({ e, i }) => { const txt = `${e.title}\n${e.body.text}`; const from = Math.max(0, i - 40); const snip = txt.slice(from, i + 80).replace(/\s+/g, " "); const hl = esc(snip).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), (m) => `<mark>${m}</mark>`); return el("a", { href: `#entry/${encodeURIComponent(e.id)}`, onclick: close }, el("div", {}, e.title), el("div", { class: "sr-file" }, topicOf(e.file)?.title || e.file), el("div", { class: "sr-snip", html: hl })); }) : [el("div", { style: "padding:10px 12px;color:var(--fg3)" }, "no matches")]));
    box.hidden = false; sel = -1;
  };
  input.oninput = run; input.onfocus = () => { if (input.value.trim().length >= 2) run(); };
  input.onkeydown = (ev) => { const items = [...box.querySelectorAll("a")]; if (ev.key === "Escape") { input.blur(); close(); } else if (ev.key === "ArrowDown") { sel = Math.min(items.length - 1, sel + 1); items.forEach((a, i) => a.classList.toggle("sel", i === sel)); items[sel]?.scrollIntoView?.({ block: "nearest" }); ev.preventDefault(); } else if (ev.key === "ArrowUp") { sel = Math.max(0, sel - 1); items.forEach((a, i) => a.classList.toggle("sel", i === sel)); ev.preventDefault(); } else if (ev.key === "Enter" && items[sel]) { items[sel].click(); input.blur(); } };
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
  if (route === "overview") { viewOverview(main); renderDetailsDefault(); }
  else if (route === "graph") { viewGraph(main); renderDetailsDefault(); }
  else if (route === "timeline") { viewTimeline(main); renderDetailsDefault(); }
  else if (route === "authors") { viewAuthors(main); renderDetailsDefault(); }
  else if (route === "queues") { viewQueues(main); renderDetailsDefault(); }
  else if (route === "findings") { viewFindings(main); renderDetailsDefault(); }
  else if (route.startsWith("topic/")) viewTopic(main, route.slice(6));
  else if (route.startsWith("entry/")) viewEntry(main, decodeURIComponent(route.slice(6)));
  else { viewOverview(main); renderDetailsDefault(); }
  markActive();
  if (!route.startsWith("graph")) main.scrollTop = 0;
}
function rerender() { renderSidebar(); renderStrip(); render(); }
function applyState(state) {
  S = state;
  const p = S.project;
  setKids($("#project-title"), $("#project-select").hidden ? el("b", {}, p.id || p.name) : null, el("span", { class: "pill" }, `schema ${p.schema}`), p.git?.available ? el("span", { class: "pill", title: p.git.remote }, `${p.git.branch}@${p.git.head}`) : null, p.git?.remote ? el("span", { class: "pill" }, remoteLink(p.git.remote)) : null);
  document.title = `${p.id || p.name} — Keep the Why`;
  setKids($("#statusbar"),
    el("span", {}, `keep-the-why-dashboard ${S.dashboard}`), el("span", {}, `keep-the-why-lint ${S.linter}`),
    el("span", {}, S.exported ? `exported ${S.generated}` : `state ${S.generated}`),
    el("span", {}, `${S.entries.length} entries · ${S.topics.length} topics · ${S.authors.length} authors`),
    el("span", { style: "margin-left:auto" }, el("a", { href: "https://keepthewhy.com", target: "_blank", rel: "noopener" }, "keepthewhy.com")));
  const main = $("#main"); const scroll = main.scrollTop;
  rerender();
  main.scrollTop = scroll;
}
function connectLive() {
  const dot = $("#live");
  if (window.__KTW_STATE__) { dot.className = "live export"; dot.title = "static export — no live updates"; return; }
  let es;
  const open = () => {
    es = new EventSource(api("/api/events"));
    es.addEventListener("state", (ev) => { try { applyState(JSON.parse(ev.data)); dot.className = "live on"; dot.title = `live — last update ${new Date().toLocaleTimeString()}`; } catch (err) { console.error(err); } });
    es.onopen = () => { dot.className = "live on"; dot.title = "live — watching the project for changes"; };
    es.onerror = () => { dot.className = "live off"; dot.title = "connection lost — the server is gone; retrying"; };
  };
  open();
}
function setupTheme() {
  const saved = localStorage.getItem("ktw-theme");
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  if (saved === "light" || (!saved && prefersLight)) document.documentElement.dataset.theme = "light";
  $("#theme").onclick = () => { const light = document.documentElement.dataset.theme === "light"; if (light) delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = "light"; localStorage.setItem("ktw-theme", light ? "dark" : "light"); if (graph) graph.alpha = Math.max(graph.alpha, 0.05); };
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
  const opt = (p) => el("option", { value: p.key, selected: p.key === current, disabled: !p.path, title: p.path || "location unknown — start the dashboard in that project once, or pass --scan" },
    p.path ? `${p.name}  ·  ${p.id}${p.source === "cwd" ? "  (here)" : ""}` : `${p.id}  (location unknown)`);
  const groups = [["Recent", list.filter((p) => p.source === "cwd" || p.source === "history")], ["Found nearby", list.filter((p) => p.source === "scan")], ["Known, location unknown", list.filter((p) => !p.path)]];
  sel.replaceChildren(...groups.filter(([, items]) => items.length).map(([label, items]) => el("optgroup", { label }, items.map(opt))));
  sel.hidden = false;
  fitSelect(sel);
  if (S) { const t = $("#project-title").querySelector("b"); if (t) t.remove(); }
  sel.onchange = () => { location.href = `${location.pathname}?project=${encodeURIComponent(sel.value)}${location.hash || "#overview"}`; };
}
async function boot() {
  setupTheme(); setupSearch(); setupProjects();
  window.addEventListener("hashchange", render);
  if (window.__KTW_STATE__) applyState(window.__KTW_STATE__);
  else {
    try { applyState(await (await fetch(api("/api/state.json"), { cache: "no-store" })).json()); }
    catch (err) { $("#main").append(el("p", { class: "center" }, PROJECT ? `No state for project "${PROJECT}" — unknown id or unknown location.` : "Could not load the state — is the server running?")); }
  }
  connectLive();
}
boot();
