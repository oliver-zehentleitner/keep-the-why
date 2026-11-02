/* Keep the Why dashboard — the pages that read one project's state: the overview, the queues, the linter's findings
   and the authors; a topic, an entry (its references both ways, and an Id this state does not carry looked for
   in the family's published exports or on the live server), an entry in another repository (#ref/…), and the
   details pane beside a topic or an entry; the pieces the pages share — the bars, an entry's row, a topic's card,
   the Config values and the copy-link button; and the lookups on the scene's state (an entry by its Id, a topic,
   a topic's entries, the queues, the filter's match). The scene holds the state; what only the host has — the
   mode and the provider, the Markdown with its topic links, the address to share, the side pane's graph, an
   entry's thoughts, an author's profile link, the projects and friends the page has loaded, a redraw — it hands
   in with each call, as its last argument (`host`). A classic script on globalThis.KeepTheWhy.views.pages,
   listed in ktw-views.json. */
(function (root) {
"use strict";
const { plural, typeName, isUuid, canonicalOf, hostFileLink, hostTreeLink, hostAnchor, parseSupersededBy, resolveSee, repoLabel, topicTitle, mergeAuthors, sortAuthors, AUTHOR_SORTS, filterActive, entryMatches } = root.KeepTheWhy.core;
const ui = root.KeepTheWhy.ui;
const { el, setKids, pill, statusPill, evPill, entryPills, hostMark, extLink, remoteLink, forkPill, headPill } = ui;
const fmtDate = (d) => d || "—";

// One pages view per page: create({ scene, nav, prefs, family, search }) — the family (ktw-family.js) loads the
// published exports an Id or a reference is looked for in, through its provider; the search (ktw-search.js) knows
// whether there is a family and gathers it.
function create({ scene, nav, prefs, family, search }) {
// prefs: no page keeps a setting yet; taken all the same, so every view is made the same way
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
  // a merged member's entry names its own project's topic files: its title and body go to the host's Markdown
  // with that project
  let PROJ = null;
  const inline = (md) => H.inline(md, PROJ); // one line of Markdown (a title, a field's value) as nodes
  const renderMarkdown = (md) => H.renderBody(md, PROJ); // a whole body
  // a label before a line of Markdown, joined to its first text the way the HTML string joined them
  const labelled = (label, md) => { const f = inline(md); if (f.firstChild?.nodeType === 3) f.firstChild.data = label + f.firstChild.data; else f.prepend(label); return f; };
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
  // the topic and entry pages, an entry in another repository (#ref/…), the references, the details pane
  function viewTopic(main, file) {
    const t = topicOf(file);
    if (!t) return main.append(el("p", { class: "center" }, `No topic ${file}`));
    const list = entriesOf(file);
    main.append(
      el("div", { class: "crumbs" }, navLink({ href: { view: "overview" } }, "Overview"), " / ", t.file, copyLinkButton(H.shareUrl({ view: "topic", file: t.file }, t.project), "topic"), sourceLink(topicHostHref(t))),
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
    if (H.published()) {
      // an Id this export does not carry: look through the family's published exports
      main.append(el("p", { class: "center" }, `Looking for ${uuid} in the family's published exports…`));
      const t = await family.publicTree();
      for (const g of t.groups) {
        if (g.member.role === "self") continue;
        if (g.state.entries?.some((e) => e.uuid === uuid)) { nav.go({ view: "entry", uuid, centre: { mode: "public", canonical: g.member.canonical, root: g.member.root || "" } }); return; }
      }
      return setKids(main, el("p", { class: "center" }, `No entry with Id ${uuid} in this export, nor in the family's published exports.`));
    }
    // an Id this project does not carry: ask the server which known project does
    main.append(el("p", { class: "center" }, `Looking for ${uuid} in the other projects known here…`));
    try {
      const P = H.provider(); if (!P.resolveEntry) throw new Error();
      const hit = await P.resolveEntry(uuid);
      if (hit.error) throw new Error(hit.error);
      if (hit.project === (H.project() || null)) return;
      nav.go({ view: "entry", uuid, centre: { mode: "live", project: hit.project } });
    } catch { setKids(main, el("p", { class: "center" }, `No entry with Id ${uuid} in this project, nor in any other project known here. A family member that is not checked out can be cloned or cached — see Family.`)); }
  }
  // #ref/<canonical>/<uuid>: an entry in another repository, family or not — a
  // reference row's link before it resolved, or a link someone shared. Resolved
  // as the row resolves it (resolveRemoteRef), then the page goes there; the
  // canonical and the Id stay on the page when nothing loads.
  async function viewRemoteEntry(main, canonical, uuid) {
    const here = byUuid()[uuid];
    if (here) { nav.go(entryRoute(here), { replace: true }); return H.render(); }
    main.append(el("p", { class: "center" }, `Looking for ${uuid} in ${repoLabel(canonical)}…`));
    const r = await resolveRemoteRef(canonical, uuid);
    if (r.entry) { nav.go(r.route); return; }
    setKids(main, el("div", { class: "center" }, el("p", {}, `Cannot open ${uuid} in ${repoLabel(canonical)}: ${r.error}.`),
      el("p", { class: "note" }, el("a", { href: canonical, target: "_blank", rel: "noopener" }, canonical.replace(/^https:\/\//, "")))));
  }
  // A reference into another repository, resolved when it is shown: the entry
  // from a project known to the live server, else from the repository's
  // published export (its .keep-the-why at HEAD names the dashboard-state).
  // One lookup per canonical and Id per page; what comes back is shown as text
  // in the reference's row, never merged into this project's counts or queues.
  const REMOTE_REFS = {}; // `${canonical}|${uuid}` -> Promise<{entry, route} | {error}>, one per host
  function resolveRemoteRef(canonical, uuid) {
    const key = `${canonical}|${uuid}`;
    if (!REMOTE_REFS[key]) REMOTE_REFS[key] = (async () => {
      const P = H.provider();
      const known = P.resolveEntry ? await P.resolveEntry(uuid) : null; // the rules are resolveSee's (ktw-core.js)
      const r = resolveSee(uuid, { known, published: known && !known.error ? null : await family.publicState(canonical, "") });
      if (r.error) return { error: r.error };
      return { entry: r.entry, route: { view: "entry", uuid, centre: r.via === "live" ? { mode: "live", project: r.project } : { mode: "public", canonical, root: "" } } };
    })();
    return REMOTE_REFS[key];
  }
  function remoteRefLine(ref, label) {
    const lead = () => (label ? el("b", {}, label) : null);
    const date = ref.date ? el("span", { class: "note" }, ` · as of ${ref.date}`) : null;
    const repo = () => el("a", { class: "note", href: ref.remote, target: "_blank", rel: "noopener", title: "the repository on its host" }, " · repository");
    const row = el("div", { class: "ref remote" }, lead(), navLink({ href: { view: "ref", canonical: ref.remote, uuid: ref.uuid } }, hostMark(ref.remote), repoLabel(ref.remote)),
      el("span", { class: "note mono" }, ` · ${ref.uuid}`), el("span", { class: "note" }, " · resolving…"), date, repo());
    resolveRemoteRef(ref.remote, ref.uuid).then((r) => {
      if (r.entry) {
        const e = r.entry; const state = [e.status, e.evidence].filter(Boolean).join(" · ");
        setKids(row, lead(), navLink({ href: r.route }, e.title || ref.uuid), el("span", { class: "note" }, " · ", hostMark(ref.remote), `${repoLabel(ref.remote)}${state ? " · " + state : ""}`), date, repo());
      } else {
        setKids(row, lead(), el("a", { href: ref.remote, target: "_blank", rel: "noopener" }, hostMark(ref.remote), repoLabel(ref.remote)), el("span", { class: "note mono" }, ` · ${ref.uuid}`), el("span", { class: "note warn" }, ` · not resolved: ${r.error}`), date);
      }
    });
    return row;
  }
  function refLine(ref, label) {
    // one See / Superseded by reference as a row: local -> the entry here; remote -> the canonical, and the Id to find it there
    const target = ref.uuid ? byUuid()[ref.uuid] : null;
    const date = ref.date ? el("span", { class: "note" }, ` · as of ${ref.date}`) : null;
    if (target) return el("div", { class: "ref" }, label ? el("b", {}, label) : null, navLink({ href: entryRoute(target) }, target.title), el("span", { class: "note" }, ` · ${topicOf(target.file)?.title || target.file}`), date);
    if (ref.remote && ref.uuid) return remoteRefLine(ref, label);
    if (ref.remote) return el("div", { class: "ref" }, label ? el("b", {}, label) : null, el("a", { href: ref.remote, target: "_blank", rel: "noopener" }, ref.remote.replace(/^https:\/\//, "")), date);
    if (ref.file) return el("div", { class: "ref" }, label ? el("b", {}, label) : null, topicOf(ref.file) ? navLink({ href: { view: "topic", file: ref.file } }, ref.locator) : ref.locator, el("span", { class: "note mono" }, ` · ${ref.uuid || ""}`), el("span", { class: "note warn" }, " · Id not found here — the locator may be stale"), date);
    return el("div", { class: "ref" }, label ? el("b", {}, label) : null, ref.text || "");
  }
  const shareUrlOf = (e) => H.shareUrl(entryRoute(e), e.project); // the host knows its own absolute address
  // the entry's or topic's file on the host, in the repository it lives in (a merged member's in its own)
  const hostProjectOf = (x) => x.origin?.state?.project || scene.state.project;
  // the context directory as a path in the repository: under the root in a mono repository (core/context/)
  const hostContextDir = (P) => `${P.root ? P.root.replace(/\/$/, "") + "/" : ""}${P.context || "context/"}`;
  const entryHostHref = (e) => { const P = hostProjectOf(e); return hostFileLink(canonicalOf(P), P.git?.branch, hostContextDir(P), e.localFile || e.file, hostAnchor(e.title)); }; // GitHub's anchor, not the entry id
  const topicHostHref = (t) => { const P = hostProjectOf(t); return hostFileLink(canonicalOf(P), P.git?.branch, hostContextDir(P), t.localFile || t.file, null); };
  // "open source": the Markdown file on the host, beside the copy-link button; nothing without a canonical
  const sourceLink = (href) => href ? extLink(href, "open source", "share-btn source-link") : null;
  function shareButton(e) { return copyLinkButton(shareUrlOf(e), "entry"); }
  function viewEntry(main, id) {
    const e = entryOf(id);
    if (!e && isUuid(id) && (H.live() || (H.published() && canonicalOf(scene.state.project)))) return viewEntryElsewhere(main, id);
    if (!e) return main.append(el("p", { class: "center" }, "No such entry"));
    if (nav.current().uuid !== entryRoute(e).uuid) nav.go(entryRoute(e), { replace: true }); // an old file#anchor link shows the Id address from here on
    const list = entriesOf(e.file); const idx = list.indexOf(e);
    const t = topicOf(e.file);
    PROJ = e.project || null;
    const r = el("div", { class: `reader ${e.status}` },
      el("div", { class: "crumbs" }, navLink({ href: { view: "overview" } }, "Overview"), " / ", navLink({ href: { view: "topic", file: e.file } }, t?.title || e.file), ` / line ${e.line}`, shareButton(e), sourceLink(entryHostHref(e))),
      el("h1", {}, inline(e.title)),
      el("div", { class: "fields" }, ...entryPills(e), e.source ? el("span", { class: "pill" }, labelled("Source: ", e.source)) : null, e.verification ? el("span", { class: "pill" }, labelled("Verification: ", e.verification.split(/\s[—-]\s/)[0])) : null),
      el("div", { class: "body" }, renderMarkdown(e.body.text || "_(no body)_")),
      e.revisit_when ? el("div", { class: "body" }, el("div", { class: "label" }, el("b", {}, "Revisit when"), el("p", {}, inline(e.revisit_when)))) : null,
      refsBox(e),
      el("div", { class: "pager" },
        idx > 0 ? navLink({ href: entryRoute(list[idx - 1]) }, `← ${list[idx - 1].title}`) : el("span"),
        idx < list.length - 1 ? navLink({ href: entryRoute(list[idx + 1]) }, `${list[idx + 1].title} →`) : el("span")),
    );
    PROJ = null;
    main.append(r);
    scene.selected = e.id;
    renderDetailsEntry(e);
  }
  const supersedersOf = (e) => e.uuid ? scene.state.entries.filter((x) => x.superseded_by && parseSupersededBy(x.superseded_by)?.uuid === e.uuid) : [];
  const seenFrom = (e, list) => e.uuid ? list.filter((x) => (x.see || []).some((r) => r?.uuid === e.uuid)) : [];
  // See and Superseded by of an entry, and the other way round: what supersedes
  // or points at it — here, and with the family scope anywhere in the tree
  function refsBox(e) {
    const back = (label, rows) => rows.length ? [el("h3", {}, label), ...rows] : null;
    const localRow = (x) => el("div", { class: "ref" }, navLink({ href: entryRoute(x) }, x.title), el("span", { class: "note" }, ` · ${x.project ? x.project + " · " : ""}${topicOf(x.file)?.title || x.file}`));
    const sup = supersedersOf(e), seen = seenFrom(e, scene.state.entries);
    const box = el("div", { class: "body refs-box" },
      e.see?.length ? [el("h3", {}, "See"), ...e.see.map((r) => refLine(r))] : null,
      e.superseded_by ? [el("h3", {}, "Superseded by"), (() => { const sb = parseSupersededBy(e.superseded_by); return sb.none != null ? el("div", { class: "ref" }, el("i", {}, "none"), el("span", { class: "note" }, ` — ${sb.none}`)) : refLine(sb); })()] : null,
      back("Supersedes", sup.map(localRow)), back("Referenced by (See)", seen.map(localRow)));
    if (scene.state.merged) return box.childNodes.length ? box : null; // the merged family holds every reference
    const family = e.uuid && search.canFamily();
    if (family && scene.scope === "family" && !scene.state.merged) {
      const more = el("div", {}, el("p", { class: "note" }, "Looking for references from the rest of the family…")); box.append(more);
      search.pool("family").then((pool) => {
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

  function renderDetailsTopic(t) {
    const d = H.details(); d.replaceChildren();
    d.append(el("h3", {}, "Topic"), el("div", { class: "kv" }, el("span", { class: "k" }, "file"), el("span", { class: "v mono" }, t.file), el("span", { class: "k" }, "entries"), el("span", { class: "v" }, t.entries)));
    d.append(el("h3", {}, `References out (${t.refs_out.length})`), ...(t.refs_out.length ? t.refs_out.map((f) => navLink({ class: "backlink", href: { view: "topic", file: f } }, topicOf(f)?.title || f)) : [el("p", { class: "empty" }, "none")]));
    d.append(el("h3", {}, `Referenced by (${t.refs_in.length})`), ...(t.refs_in.length ? t.refs_in.map((f) => navLink({ class: "backlink", href: { view: "topic", file: f } }, topicOf(f)?.title || f)) : [el("p", { class: "empty" }, "none")]));
    H.miniGraph(d, { topic: t });
  }
  function renderDetailsEntry(e) {
    const d = H.details(); d.replaceChildren();
    const g = e.git;
    const P = hostProjectOf(e); // a merged member's entry lives in its own repository
    const hostHref = entryHostHref(e);
    d.append(el("h3", {}, "Entry"), el("div", { class: "kv" },
      e.uuid ? [el("span", { class: "k" }, "Id"), el("span", { class: "v mono", title: "the entry's address — what See and Superseded by lines resolve to" }, e.uuid)] : null,
      e.project ? [el("span", { class: "k" }, "project"), el("span", { class: "v" }, e.origin?.href ? el("a", { href: H.memberLink(e.origin.member, "#overview") }, e.project) : e.project)] : null,
      el("span", { class: "k" }, "at"), el("span", { class: "v mono" }, hostHref ? el("a", { class: "gh", href: hostHref, target: "_blank", rel: "noopener", title: "open on the host" }, e.id) : e.id),
      el("span", { class: "k" }, "type"), el("span", { class: "v" }, (e.type || []).join(", ") || "—"),
      el("span", { class: "k" }, "status"), el("span", { class: "v" }, statusPill(e.status)),
      el("span", { class: "k" }, "evidence"), el("span", { class: "v" }, evPill(e.evidence)),
      e.source ? [el("span", { class: "k" }, "source"), el("span", { class: "v" }, inline(e.source))] : null,
      e.verification ? [el("span", { class: "k" }, "verification"), el("span", { class: "v" }, inline(e.verification))] : null,
      e.revisit_when ? [el("span", { class: "k" }, "revisit when"), el("span", { class: "v" }, inline(e.revisit_when))] : null,
    ));
    d.append(el("h3", {}, "Git"));
    if (!g) d.append(el("p", { class: "empty" }, scene.state.project.git?.available ? "not in Git yet" : "no repository"));
    else {
      const who = (c) => c ? [H.authorLink(c.author, c.commit, P), `${c.date ? " · " + c.date : ""}${c.commit ? " · " : ""}`, c.commit ? el("code", {}, c.commit) : null] : ["—"];
      d.append(el("div", { class: "kv" },
        el("span", { class: "k" }, "created"), el("span", { class: "v" }, ...who(g.created)),
        el("span", { class: "k" }, "last touched"), el("span", { class: "v" }, ...who(g.last_touched))));
      if (g.status_history?.length) d.append(el("h3", {}, "Status history"), el("ul", { class: "hist" }, g.status_history.map((h) => el("li", { class: h.status }, `${h.status}`, el("div", { class: "d" }, H.authorLink(h.author, h.commit, P), ` · ${h.date} · ${h.commit}`)))));
    }
    const back = scene.state.entries.filter((x) => x.id !== e.id && x.refs.includes(e.file));
    d.append(el("h3", {}, `Backlinks (${back.length})`), ...(back.length ? back.map((x) => navLink({ class: "backlink", href: entryRoute(x) }, x.title, el("div", { class: "note" }, topicOf(x.file)?.title || x.file))) : [el("p", { class: "empty" }, `nothing references ${e.file}`)]));
    // the thoughts this entry is a step of — in the graph of the scope, friends and path included
    const mine = H.entryThoughts(e);
    const resting = new Set(); for (const { t, i } of mine) if (t.ins.shaky.some((x) => x.i === i)) for (const j of t.steps.slice(i + 1)) resting.add(j);
    if (resting.size) d.append(el("h3", {}, `Linked after this (${resting.size})`), el("p", { class: "note" }, `This entry is in question (${e.status}); these later entries are linked after it — check whether they depend on it.`), ...[...resting].map((n) => el("a", { class: "backlink", href: n.href }, n.label, el("div", { class: "note" }, H.thoughts.projOf(n)))));
    if (mine.length) d.append(el("h3", {}, `In thoughts (${mine.length})`), ...mine.map(({ t, i }) => navLink({ class: "backlink", href: H.thoughts.thoughtRoute(t), title: t.steps.map((n) => n.label).join("\n→ ") },
      `${H.thoughts.shortLabel(t.steps[0])} → ${H.thoughts.shortLabel(t.steps[t.steps.length - 1])}`,
      el("div", { class: "note" }, `step ${i + 1} of ${t.steps.length}${t.evolution ? " · evolution" : ""}${t.ends.length ? " · continues ↗" : ""}${t.ins.weakOrigin ? ` · starts ${t.ins.weakOrigin}` : ""}${t.ins.affected.includes(i) ? " · after a step in question" : ""}`))));
    if (e.refs.length) d.append(el("h3", {}, "References"), ...e.refs.map((f) => navLink({ class: "backlink", href: { view: "topic", file: f } }, topicOf(f)?.title || f)));
    if (e.findings.length) d.append(el("h3", {}, "Linter"), ...e.findings.map((f) => el("div", { class: "finding" }, pill(f.code, `sev-${f.severity}`), ` line ${f.line}: ${f.message}`)));
    H.miniGraph(H.details(), { entry: e });
  }
  const pages = { entryRow, viewOverview, viewQueues, viewAuthors, viewTopic, viewEntry, viewRemoteEntry };
  BOUND.set(H, pages);
  return pages;
}

return Object.freeze({
  byUuid, entryRoute, entryHref, entryOf, topicOf, entriesOf, authorOf, matches, pageFiltered, queues, queueTotal,
  STATUS_ORDER, EV_ORDER, bars, copyText, copyLinkButton, findings: viewFindings,
  // the pages and an entry's row take the host as their last argument
  entryRow: (e, host) => forHost(host).entryRow(e), overview: (main, host) => forHost(host).viewOverview(main),
  queuesPage: (main, host) => forHost(host).viewQueues(main), authors: (main, host) => forHost(host).viewAuthors(main),
  topic: (main, file, host) => forHost(host).viewTopic(main, file), entry: (main, id, host) => forHost(host).viewEntry(main, id),
  remoteEntry: (main, canonical, uuid, host) => forHost(host).viewRemoteEntry(main, canonical, uuid),
});
}

const KTW = (root.KeepTheWhy = root.KeepTheWhy || {});
KTW.views = KTW.views || {};
KTW.views.pages = Object.freeze({ create });
})(globalThis);
