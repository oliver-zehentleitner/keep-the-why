/* Keep the Why dashboard — the pages that read one project's state as a whole: the overview, the queues, the
   linter's findings and the authors; the pieces the pages share — the bars, an entry's row, a topic's card, the
   Config values and the copy-link button; and the lookups on the scene's state (an entry by
   its Id, a topic, a topic's entries, the queues, the filter's match). The scene holds the state; what only the
   host has — the Markdown with its topic links, an author's profile link, the projects and friends the page has
   loaded, a redraw — it hands in with each call, as its last argument (`host`). A classic script on globalThis.KeepTheWhy.views.pages, listed in ktw-views.json. */
(function (root) {
"use strict";
const { plural, typeName, isUuid, canonicalOf, hostFileLink, hostTreeLink, mergeAuthors, sortAuthors, AUTHOR_SORTS, filterActive, entryMatches } = root.KeepTheWhy.core;
const ui = root.KeepTheWhy.ui;
const { el, pill, entryPills, extLink, remoteLink, forkPill, headPill } = ui;
const fmtDate = (d) => d || "—";

// One pages view per page: create({ scene, nav, prefs }).
function create({ scene, nav, prefs }) {
const navLink = ui.navLinks(nav); // a link to a place, moving through nav

const byId = () => Object.fromEntries(scene.state.entries.map((e) => [e.id, e]));
const byUuid = () => Object.fromEntries(scene.state.entries.filter((e) => e.uuid).map((e) => [e.uuid, e]));
// an entry's address is its Id, so a copied link survives a renamed heading or a moved entry; file#anchor only without one
const entryRoute = (e) => ({ view: "entry", uuid: e.uuid || e.id });
const entryHref = (e) => nav.href(entryRoute(e));
const entryOf = (ref) => byId()[ref] || (isUuid(ref) ? byUuid()[ref] : null);
const topicOf = (file) => scene.state.topics.find((t) => t.file === file);
const entriesOf = (file) => scene.state.entries.filter((e) => e.file === file);
const authorOf = (e) => e.git?.created?.author || e.git?.last_touched?.author || "";
// the sidebar's filter and the entry in the details are the scene's (scene.filter, scene.selected): the graph reads them too
const matches = (e) => entryMatches(e, scene.filter);
const pageFiltered = () => filterActive(scene.filter);

const queues = () => ({
  open: scene.state.entries.filter((e) => e.status === "open"),
  "needs-review": scene.state.entries.filter((e) => e.status === "needs-review"),
  "pending-confirmation": scene.state.entries.filter((e) => e.status === "pending-confirmation"),
  // Evidence is its own axis (Core rule 5): an open question with an untraced origin counts here and under open
  unknown: scene.state.entries.filter((e) => e.evidence === "unknown" && e.status !== "superseded"),
  revisit: scene.state.entries.filter((e) => e.revisit_when && e.status !== "superseded"),
});
// every entry that needs a person, once — an entry can wait in two queues
const queueTotal = () => { const q = queues(); return new Set([...q.open, ...q["needs-review"], ...q["pending-confirmation"], ...q.unknown]).size; };

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
const projectOf = (x) => (x?.project ? x.project : null); // a merged family member's name, null for this project


function viewFindings(main) {
  const f = scene.state.findings;
  main.append(el("h1", {}, "Linter findings"), el("p", { class: "sub" }, `keep-the-why-lint ${scene.state.linter} · ${f.errors} error(s), ${f.warnings} warning(s) · structure only, never content`));
  if (!f.items.length) return main.append(el("p", { class: "center" }, "Clean — nothing to show."));
  main.append(el("div", { class: "table-wrap" }, el("table", { class: "t findings" }, el("thead", {}, el("tr", {}, ["Severity", "Code", "Where", "Message"].map((h) => el("th", {}, h)))),
    el("tbody", {}, f.items.map((x) => {
      const entry = scene.state.entries.find((e) => (e.project || null) === (x.project || null) && `${(e.origin?.state?.project || scene.state.project).context}${e.localFile || e.file}` === (x.localPath || x.path) && e.line <= x.line && x.line <= e.end_line + 1);
      return el("tr", {}, el("td", {}, pill(x.severity, `sev-${x.severity}`)), el("td", { class: "mono" }, x.code),
        el("td", { class: "mono" }, entry ? navLink({ href: entryRoute(entry) }, `${x.path}:${x.line}`) : `${x.path}${x.line ? ":" + x.line : ""}`), el("td", {}, x.message));
    })))));
}

// the .keep-the-why file itself on the host, beside the card's heading — under the root in a mono repository
function configFileLink(p) {
  const href = hostFileLink(canonicalOf(p), p.git?.branch, p.root ? `${p.root.replace(/\/$/, "")}/` : "", p.config_file || ".keep-the-why", null);
  return href ? [" ", extLink(href, p.config_file || ".keep-the-why", "mono note config-file")] : null;
}
// a Config value: the three that are addresses open where they point — canonical and dashboard-state as
// written, context as the directory on the host (under the root in a mono repository); the rest is text
function configValue(p, key, v) {
  const href = key === "canonical" || key === "dashboard-state" ? (/^https?:\/\//.test(v) ? v : null)
    : key === "context" ? hostTreeLink(canonicalOf(p), p.git?.branch, [p.root, p.context || String(v).replace(/^`|`$/g, "")].filter(Boolean).join("/")) : null;
  return href ? extLink(href, v, "v mono") : el("span", { class: "v mono" }, v);
}

function topicCard(t) {
  return navLink({ class: "topic-card", href: { view: "topic", file: t.file } },
    el("div", { class: "tt" }, t.title, el("span", { class: "count" }, plural(t.entries, "entry"))),
    t.project ? el("div", { class: "note" }, t.project) : null,
    el("div", { class: "td" }, t.index_line || el("span", { class: "note" }, "not described in index.md")),
    stack(t.evidence, EV_ORDER),
    el("div", { class: "refs" }, `${t.file} · → ${t.refs_out.length} · ← ${t.refs_in.length}`));
}


async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* no clipboard API: the old way */ }
  const ta = el("textarea", { style: "position:fixed;opacity:0" }); ta.value = text; document.body.append(ta); ta.select();
  let ok = false; try { ok = document.execCommand("copy"); } catch {} ta.remove(); return ok;
}

function copyLinkButton(s, what) {
  const b = el("button", { type: "button", class: "share-btn", title: `copy a link to this ${what} — ${s.where}:\n${s.url}`,
    onclick: async () => { const ok = await copyText(s.url); b.textContent = ok ? "✓ copied" : "copy failed"; b.classList.toggle("done", ok); setTimeout(() => { b.textContent = "⧉ copy link"; b.classList.remove("done"); }, 1800); } }, "⧉ copy link");
  return b;
}


// the newest commit of an author among a state's entries, for the profile link on that project's host
function authorCommitIn(name, state) {
  let best = null;
  for (const e of state?.entries || []) for (const c of [e.git?.created, e.git?.last_touched, ...(e.git?.status_history || [])]) if (c?.author === name && c.commit && (!best || (c.date || "") > (best.date || ""))) best = c;
  return best?.commit || null;
}
// The Authors view: every Git author of every project the page holds — this one, the family, the friends, the
// path — in one table with the sums and a pill per project, and a table per project under it. Names are Git
// authors as the projects' .mailmap files map them; one name across projects is one row, an anonymized name
// (author-1) a row per project. A click on a row filters every view to that author. Rows go A–Z by name; a click on
// a column's name sorts every table by it, from the most for counts and dates, again to turn the order round.
const AUTHOR_SORT = { key: "author", dir: "asc" };

// What uses the host is made once per host, so every closure it leaves behind — a button clicked later, a list
// drawn again — keeps the host of the call that made it, whichever host draws next.
const BOUND = new WeakMap();
function forHost(H) {
  if (BOUND.has(H)) return BOUND.get(H);
  const inline = (md) => H.inline(md, null); // one line of Markdown (a title) as nodes, with this page's topic links
  function entryRow(e) {
    const snippet = e.body.reason || e.body.text.split("\n")[0] || "";
    const g = e.git;
    return navLink({ href: entryRoute(e), class: `row ${matches(e) ? "" : "dim"}` },
      el("div", { class: "rt" }, el("span", {}, inline(e.title)), ...entryPills(e)),
      el("div", { class: "rs" }, snippet.replace(/\*\*|`/g, "")),
      el("div", { class: "rm" }, [projectOf(e), topicOf(e.file)?.title || e.file, g?.created?.author ? `${g.created.author} · ${g.created.date}` : null, g?.last_touched?.date && g.last_touched.date !== g?.created?.date ? `touched ${g.last_touched.date}` : null].filter(Boolean).join("  ·  ")));
  }
  function viewOverview(main) {
    const list = scene.state.entries;
    const p = scene.state.project; const g = p.git;
    if (scene.state.merged) main.append(el("div", { class: "family-banner" }, el("b", {}, `Family · ${plural(scene.state.family.length, "project")}`), " — ",
      scene.state.family.map((m, i) => [i ? " · " : "", m.project ? el("span", {}, m.project, el("span", { class: "note" }, ` ${scene.state.entries.filter((e) => e.project === m.project).length}`)) : el("span", {}, m.name, el("span", { class: "note" }, ` ${scene.state.entries.filter((e) => !e.project).length}`))]),
      scene.state.missing?.length ? el("span", { class: "warn" }, ` · ${plural(scene.state.missing.length, "member")} not available here`) : null));
    main.append(
      el("h1", {}, p.id || p.name),
      el("p", { class: "sub" }, `${p.context} · schema ${p.schema} · ${p.config["capture-confirmation"] || "?"} · source-reference ${p.config["source-reference"] || "?"}`,
        g?.available ? [" · ", headPill(g), g.remote ? [" · ", remoteLink(g.remote)] : null, g.fork ? [" · ", forkPill(g)] : null, g.shallow ? " · shallow clone (dates are the clone's edge)" : null] : " · no Git"),
      // Type, Status and Evidence stacked in one column, the Config beside them
      el("div", { class: "grid2" },
        el("div", { class: "overview-stats" },
          el("div", { class: "card" }, el("h3", {}, "Type"), bars(typeCounts(list), ["decision", "constraint", "workaround", "incident", "undefined"])),
          el("div", { class: "card" }, el("h3", {}, "Status"), bars(count(list, "status"), STATUS_ORDER)),
          el("div", { class: "card" }, el("h3", {}, "Evidence"), bars(count(list, "evidence"), EV_ORDER))),
        el("div", { class: "card" }, el("h3", {}, "Config", configFileLink(p)), el("div", { class: "kv" }, Object.entries(p.config).map(([k, v]) => [el("span", { class: "k" }, k), configValue(p, k, v)])),
          Object.keys(p.personal_defaults || {}).length ? [el("h3", {}, "Personal defaults offered"), el("div", { class: "kv" }, Object.entries(p.personal_defaults).map(([k, v]) => [el("span", { class: "k" }, k), el("span", { class: "v mono" }, v)]))] : null),
      ),
      el("h2", {}, "Topics"),
      el("div", { class: "topic-cards" }, scene.state.topics.map(topicCard)),
      el("h2", {}, "Recently touched"),
      el("div", { class: "entry-list" }, [...list].filter((e) => e.git?.last_touched?.date !== undefined).sort((a, b) => ((b.git?.last_touched?.date || "") > (a.git?.last_touched?.date || "") ? 1 : -1)).slice(0, 8).map(entryRow)),
    );
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
    main.append(el("h1", {}, "Authors"), el("p", { class: "sub" }, "Git authors of the entries — who created, touched, or superseded what, in every project this page holds: this one, its family, the friends in the graph, the path. Git knows names, not who was driving."));
    if (!scene.state.project.git?.available) return main.append(el("p", { class: "center" }, "No Git repository — nothing to attribute."));
    const projects = H.authorProjects();
    const sorted = (list) => sortAuthors(list, AUTHOR_SORT.key, AUTHOR_SORT.dir);
    const rows = sorted(mergeAuthors(projects.map((P) => ({ name: P.name, canonical: P.canonical, anonymized: P.anonymized, authors: P.state.authors || [] }))));
    const byName = Object.fromEntries(projects.map((P) => [P.name, P]));
    const projPill = (per) => { const P = byName[per.project]; const t = `${per.project}: ${per.created} created · ${per.touched} touched · ${per.superseded} superseded${per.first ? ` · ${per.first} → ${per.last}` : ""}`; return P?.open ? el("a", { class: "pill proj-pill", href: P.open, title: t, onclick: (ev) => ev.stopPropagation() }, per.project) : el("span", { class: "pill proj-pill", title: t }, per.project); };
    const sortBy = (key) => { AUTHOR_SORT.dir = AUTHOR_SORT.key === key ? (AUTHOR_SORT.dir === "asc" ? "desc" : "asc") : AUTHOR_SORTS[key]; AUTHOR_SORT.key = key; H.render(); };
    const th = (h) => {
      const key = h.toLowerCase();
      if (!(key in AUTHOR_SORTS)) return el("th", {}, h);
      const on = AUTHOR_SORT.key === key;
      return el("th", { class: "sortable", "aria-sort": on ? (AUTHOR_SORT.dir === "asc" ? "ascending" : "descending") : "none" },
        el("button", { type: "button", class: "sort-btn", title: `Sort by ${key}`, onclick: () => sortBy(key) }, h, el("span", { class: "sort-mark" }, on ? (AUTHOR_SORT.dir === "asc" ? " ▲" : " ▼") : "")));
    };
    const head = (cols) => el("thead", {}, el("tr", {}, cols.map(th)));
    const numCells = (a) => [el("td", {}, a.created), el("td", {}, a.touched), el("td", {}, a.superseded), el("td", {}, el("div", { style: "min-width:160px" }, stack(a.evidence, EV_ORDER))), el("td", { class: "mono" }, fmtDate(a.first)), el("td", { class: "mono" }, fmtDate(a.last))];
    const rowOf = (a, nameCell) => el("tr", { class: `clickable ${scene.filter.author === a.name ? "sel" : ""}`, onclick: () => { scene.filter.author = scene.filter.author === a.name ? "" : a.name; H.rerender(); } }, nameCell, ...numCells(a));
    // what was counted, and the friends not loaded yet
    const waiting = H.friendsWaiting();
    const byRole = (role) => projects.filter((P) => P.role === role).map((P) => P.name);
    main.append(el("p", { class: "note" }, `Counted: this project`, byRole("family").length ? ` · family: ${byRole("family").join(", ")}` : "", byRole("friend").length ? ` · friends: ${byRole("friend").join(", ")}` : "", byRole("path").length ? ` · path: ${byRole("path").join(", ")}` : "",
      waiting.length ? [" · ", el("button", { type: "button", class: "link-btn", disabled: H.friendsLoading(), onclick: () => H.loadFriends(waiting) }, H.friendsLoading() ? "loading the friends…" : `load the ${plural(waiting.length, "friend")} not here yet`)] : null));
    const many = projects.length > 1;
    const all = el("table", { class: "t" }, head(["Author", ...(many ? ["Projects"] : []), "Created", "Touched", "Superseded", "Evidence of created entries", "First", "Last"]),
      el("tbody", {}, rows.map((a) => { const P = byName[a.per[0].project]; const link = a.anonymized ? el("span", {}, a.label) : H.authorLink(a.name, authorCommitIn(a.name, P?.state), P?.state?.project); return rowOf(a, [el("td", {}, link), ...(many ? [el("td", {}, el("div", { class: "proj-pills" }, a.per.map(projPill)))] : [])]); })));
    main.append(el("div", { class: "table-wrap" }, all), el("p", { class: "note", style: "margin-top:10px" }, "Click a name to open the author's profile on the host; click elsewhere in the row to filter every view to that author, again to clear. Click a column's name to sort by it, again to turn the order round.", many ? " A name that recurs across projects is one row with the sums; a name an export anonymized (author-1) says nothing across projects and stays a row per project." : ""));
    if (many) {
      main.append(el("h2", {}, "By project"));
      for (const P of projects) {
        const prow = sorted(mergeAuthors([{ name: P.name, canonical: P.canonical, anonymized: P.anonymized, authors: P.state.authors || [] }]));
        const d = el("details", { class: "authors-project", open: P.role === "self" });
        d.append(el("summary", {}, el("span", { class: "tt" }, P.name), el("span", { class: "pill" }, P.role === "self" ? "this project" : P.role), el("span", { class: "count" }, plural(prow.length, "author")), P.open && P.role !== "self" ? el("a", { class: "backlink", href: P.open, onclick: (ev) => ev.stopPropagation() }, "open ›") : null));
        d.append(el("div", { class: "table-wrap" }, el("table", { class: "t" }, head(["Author", "Created", "Touched", "Superseded", "Evidence of created entries", "First", "Last"]),
          el("tbody", {}, prow.map((a) => rowOf(a, el("td", {}, P.anonymized ? el("span", {}, a.name) : H.authorLink(a.name, authorCommitIn(a.name, P.state), P.state.project))))))));
        main.append(d);
      }
    }
    if (scene.filter.author) main.append(el("h2", {}, `Entries created by ${scene.filter.author}`), el("div", { class: "entry-list" }, scene.state.entries.filter((e) => authorOf(e) === scene.filter.author).map(entryRow)));
  }
  const pages = { entryRow, viewOverview, viewQueues, viewAuthors };
  BOUND.set(H, pages);
  return pages;
}

return Object.freeze({
  byUuid, entryRoute, entryHref, entryOf, topicOf, entriesOf, authorOf, matches, pageFiltered, queues, queueTotal,
  STATUS_ORDER, EV_ORDER, bars, copyText, copyLinkButton, findings: viewFindings,
  // the pages and an entry's row take the host as their last argument
  entryRow: (e, host) => forHost(host).entryRow(e), overview: (main, host) => forHost(host).viewOverview(main),
  queuesPage: (main, host) => forHost(host).viewQueues(main), authors: (main, host) => forHost(host).viewAuthors(main),
});
}

const KTW = (root.KeepTheWhy = root.KeepTheWhy || {});
KTW.views = KTW.views || {};
KTW.views.pages = Object.freeze({ create });
})(globalThis);
