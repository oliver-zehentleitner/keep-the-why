/* Keep the Why dashboard — thoughts: chains of linked entries through a graph, the longest chains of See and
   Superseded by between entries (each one cites the one before), across projects where the graph spans them
   (family, friends). Three views of them: the list beside a graph (pointing at one lights its path, a click
   holds it and lists its steps in reading order, origin first), the Thoughts page (the chains counted and
   grouped), and the reader (#thought/…: every entry of one chain, in full). A chain made only of Superseded by
   is how one decision changed over time: an evolution. The held thought is the scene's pin; the minimum length
   is kept through prefs. What only the host has — the graph to read, loading the repositories a chain goes on
   into, an entry found beyond this state, the Markdown with this page's topic links, a redraw — it hands in
   with each call (`host`). A classic script on globalThis.KeepTheWhy.views.thoughts, listed in ktw-views.json. */
(function (root) {
"use strict";
const { parseSupersededBy, thoughtsOf, thoughtInsights, entryRefs, repoLabel } = root.KeepTheWhy.core;
const ui = root.KeepTheWhy.ui;
const { el, setKids, entryPills } = ui;

// One thoughts view per page: create({ scene, nav, prefs, words }) — `words` the host's hook for the UI text (ktw-ui.js words).
function create({ scene, nav, prefs, words }) {
const navLink = ui.navLinks(nav); // a link to a place, moving through nav
const tw = ui.words(words);
// why a step is in question (core thoughtInsights): its Status, as the data has it, or a superseded entry still cited
const whyWord = (why) => (why === "superseded, still cited" ? tw("thoughts.why.supersededCited", "superseded, still cited") : why);
const topicOf = (file) => scene.state.topics.find((t) => t.file === file);
// #thought/<id>,<id>,…: the Ids are the entries' own, so the address names the thought
const thoughtRoute = (t) => ({ view: "thought", refs: t.steps.map((n) => n.entry.uuid || n.entry.id) });
const thoughtHref = (t) => nav.href(thoughtRoute(t));
// One step pointed at — in a thought's list of steps, in the reader, on the Thoughts page — is marked in every
// graph on the page.
const focusStep = (ref) => scene.setFocus(ref); // every graph redraws (runGraph), and the stage
const stepHover = (ref) => ({ onmouseenter: () => focusStep(ref), onmouseleave: () => focusStep(null) });

let THOUGHT_MIN = Number(prefs.get("thought-min")) || 4; // entries a thought has at least, kept per browser
// the choices go from 2 (one link) up to the longest chain in the graph on the page, and grow with
// it when a friend or a path brings a longer one; a kept choice above the longest here is drawn
// down to it, so a sparse project shows its chains instead of an empty list
const longestChain = (all) => Math.max(2, ...all.map((t) => t.steps.length));
const thoughtMin = (all) => Math.min(THOUGHT_MIN, longestChain(all));
function thoughtMinSeg(all, onpick) {
  const top = longestChain(all), cur = thoughtMin(all);
  return el("span", { class: "ktw-thought-min", title: tw("thoughts.min.title", "entries a thought has at least — from one link up to the longest chain here") }, tw("thoughts.min.from", "from "),
    ...Array.from({ length: top - 1 }, (_, i) => i + 2).map((m) => el("button", { type: "button", class: m === cur ? "ktw-on" : "", onclick: () => { THOUGHT_MIN = m; prefs.set("thought-min", String(m)); onpick(); } }, String(m))));
}
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
  t.ins?.weakOrigin ? el("span", { class: "ktw-pill ktw-warn-pill", title: tw("thoughts.pill.weakTitle", "its first entry's Evidence is {evidence}: where later entries depend on it, they depend on a reason nobody confirmed", { evidence: t.ins.weakOrigin }) }, tw("thoughts.pill.weak", "starts {evidence}", { evidence: t.ins.weakOrigin })) : null,
  t.ins?.shaky.length ? el("span", { class: "ktw-pill ktw-warn-pill", title: t.ins.shaky.map((x) => tw("thoughts.pill.shakyStep", "step {i}: {why}", { i: x.i + 1, why: whyWord(x.why) })).join("\n") + "\n" + (t.ins.affected.length === 1 ? tw("thoughts.pill.shakyLaterOne", "{n} later step is linked after it", { n: 1 }) : tw("thoughts.pill.shakyLater", "{n} later steps are linked after it", { n: t.ins.affected.length })) }, tw("thoughts.pill.shaky", "step in question")) : null,
];
const span = (t) => (t.ins?.from ? (t.ins.from === t.ins.to ? t.ins.from : `${t.ins.from} → ${t.ins.to}`) : "");
const shortLabel = (n) => { const t = (n?.label || "").replace(/`/g, ""); return t.length > 34 ? t.slice(0, 32) + "…" : t; };
// the thoughts an entry is a step of in this graph, with its place in each
function entryThoughts(e, g) {
  const same = (n) => n.entry === e || (e.uuid && n.entry?.uuid === e.uuid);
  const all = graphChains(g), min = thoughtMin(all);
  return all.filter((t) => t.steps.length >= min || t.ends.length).map((t) => ({ t, i: t.steps.findIndex(same) })).filter((x) => x.i >= 0);
}
// the thoughts (at least the chosen number of entries, drawn down to the longest chain here), and
// the shorter chains that go on beyond this page
function graphThoughts(g) {
  const all = graphChains(g), min = thoughtMin(all);
  return { all, thoughts: all.filter((t) => t.steps.length >= min), open: all.filter((t) => t.ends.length && t.steps.length < min) };
}

// ---- the list beside a graph
// The list follows the held thought: when the pin changes, the last list drawn is drawn again, from the box its
// host names (host.listBox) and the graph it was drawn for.
let LIST = null; // { g, host }: the graph whose thoughts the list shows, and its host
scene.on("pin", () => { if (LIST) list(LIST.g, LIST.host); });
// the thought being read (#thought/…) is held in every graph shown beside it, however the reader was reached —
// read › without a click first, a link, a reload — the same as a thought clicked and then read
function holdReading(g, host) {
  if (!g || nav.current().view !== "thought") return;
  // the route's refs, not an address: a host's href need not be the hash grammar
  const here = nav.current().refs || [];
  const t = graphThoughts(g).all.find((x) => { const r = thoughtRoute(x).refs; return r.length === here.length && r.every((id, i) => id === here[i]); });
  if (!t) return;
  scene.setThought(t);
  host.light(g, t);
}
function list(g, host) {
  const box = host.listBox();
  LIST = { g, host };
  if (!box || !g) return;
  const { all, thoughts: shown, open } = graphThoughts(g);
  const held = [...shown, ...open].find((t) => t.ids.join("|") === scene.pin) || null;
  host.light(g, held);
  const minSeg = thoughtMinSeg(all, () => { scene.setThought(null); list(g, host); }); // a new minimum: the list is another, held or not
  const repos = (ends) => [...new Set(ends.map((e) => repoLabel(e.canonical)))];
  const busy = host.follow.busy();
  const row = (t) => {
    const key = t.ids.join("|"); const on = key === scene.pin;
    return el("div", { class: `ktw-thought ${on ? "ktw-on" : ""} ${t.ends.length ? "ktw-open" : ""}` },
      el("button", { type: "button", class: "ktw-thought-head", title: t.steps.map((n) => n.label).join("\n→ ") + (t.ends.length ? tw("thoughts.list.goesOn", "\n… goes on in {repos}", { repos: repos(t.ends).join(", ") }) : ""),
        onmouseenter: () => host.light(g, t), onmouseleave: () => host.light(g, held), // a held thought gives way while another is pointed at, and comes back
        onclick: () => scene.setThought(on ? null : t) },
        el("span", { class: "ktw-count" }, String(t.steps.length)), `${shortLabel(t.steps[0])} → ${shortLabel(t.steps[t.steps.length - 1])}`, t.evolution ? el("span", { class: "ktw-pill" }, tw("thoughts.evolution", "evolution")) : null, ...insightPills(t)),
      navLink({ class: "ktw-thought-read", href: thoughtRoute(t), title: tw("thoughts.list.readTitle", "read the whole thought — every entry in order, in full") }, tw("thoughts.list.read", "read ›")),
      t.ends.length ? el("button", { type: "button", class: "ktw-thought-follow ktw-link-btn", disabled: busy, title: tw("thoughts.list.followTitle", "load the repositories this chain goes on into — {repos} — hop by hop, until it ends", { repos: repos(t.ends).join(", ") }), onclick: () => host.follow.chain(t) }, tw("thoughts.list.follow", "continues ↗ {repos}", { repos: repos(t.ends).join(", ") })) : null,
      on ? el("ol", { class: "ktw-thought-steps" }, t.steps.map((n) => el("li", stepHover(n.entry?.uuid || n.id), el("a", { href: n.href, onclick: (ev) => { if (n.entry && host.pick?.(n.entry)) ev.preventDefault(); } }, n.label.replace(/`/g, ""))))) : null);
  };
  const openEnds = [...shown, ...open].flatMap((t) => t.ends);
  const followBtn = openEnds.length ? el("button", { type: "button", class: "ktw-link-btn ktw-thought-follow-all", disabled: busy, title: tw("thoughts.list.followAllTitle", "load every repository the chains here go on into, hop by hop — nothing else"), onclick: () => host.follow.all() }, busy ? tw("thoughts.loadingChains", "loading the chains…") : tw("thoughts.list.followAll", "load the whole chains ({n:repository})", { n: repos(openEnds).length })) : null;
  const head = shown.length
    ? [el("h3", {}, tw("thoughts.list.heading", "Thoughts ({n}) {min}", { n: shown.length, min: minSeg })), el("p", { class: "ktw-note" }, tw("thoughts.list.note", "Chains of linked entries — See and Superseded by — first entry first. Point at one to light its path, click to hold it."))]
    : [el("h3", {}, tw("thoughts.list.headingNone", "Thoughts {min}", { min: minSeg })), el("p", { class: "ktw-note" }, tw("thoughts.list.none", "No chain of linked entries in this graph yet — a thought is a chain of See or Superseded by, each entry citing the one before."))];
  setKids(box, ...head, followBtn, ...shown.map(row),
    open.length ? el("h3", { class: "ktw-thought-open-head" }, tw("thoughts.list.beyond", "Going on beyond this page ({n})", { n: open.length })) : null,
    open.length ? el("p", { class: "ktw-note" }, tw("thoughts.list.beyondNote", "Shorter chains that continue in a repository this page has not loaded — loading it may make them thoughts.")) : null,
    ...open.map(row));
}

// ---- the Thoughts page
// It reads the graph of the scope (this project, or the family), with the friends, the path and the followed
// chains it has — the same data the Graph view shows, laid out as lists.
const projOf = (n) => n.proj || n.entry?.project || scene.self?.project?.id || scene.self?.project?.name || "";
const lightAll = (t) => scene.light(t); // every graph lights it (runGraph)
async function page(main, host) {
  const minSeg = el("span", { class: "ktw-thought-min" });
  main.append(el("h1", {}, tw("thoughts.page.heading", "Thoughts {min}", { min: minSeg })), el("p", { class: "ktw-sub" }, tw("thoughts.page.sub", "Chains of linked entries: each cites the one before (See) or replaced it (Superseded by) — in this graph, with its family, friends and path. A link says two entries are related; often one follows from the other, not always. Point at a chain to light it in the graph beside.")));
  const box = el("div", { class: "ktw-thoughts-page" }, el("p", { class: "ktw-center" }, tw("thoughts.page.loading", "Loading…"))); main.append(box);
  const g = await host.graph();
  if (!box.isConnected) return;
  const all = graphChains(g);
  minSeg.replaceWith(thoughtMinSeg(all, () => host.render()));
  const min = thoughtMin(all);
  const thoughts = all.filter((t) => t.steps.length >= min);
  const open = all.filter((t) => t.ends.length);
  if (!thoughts.length && !open.length) return setKids(box, el("p", { class: "ktw-empty" }, tw("thoughts.page.none", "No chain of linked entries here yet — a thought is a chain of See or Superseded by, each entry citing the one before.")));
  const across = (t) => new Set(t.steps.map(projOf)).size > 1;
  const tags = (t) => [t.evolution ? el("span", { class: "ktw-pill" }, tw("thoughts.evolution", "evolution")) : null, across(t) ? el("span", { class: "ktw-pill" }, tw("thoughts.page.across", "across projects")) : null, t.ends.length ? el("span", { class: "ktw-pill" }, tw("thoughts.page.continues", "continues ↗")) : null, ...insightPills(t), span(t) ? el("span", { class: "ktw-note" }, span(t)) : null];
  const row = (t) => el("div", { class: "ktw-thought-row", onmouseenter: () => lightAll(t), onmouseleave: () => lightAll(null) },
    el("span", { class: "ktw-count" }, String(t.steps.length)),
    navLink({ href: thoughtRoute(t), title: t.steps.map((n) => n.label).join("\n→ ") }, `${shortLabel(t.steps[0])} → ${shortLabel(t.steps[t.steps.length - 1])}`), ...tags(t));
  const entryLink = (n, extra) => el("a", { class: "ktw-backlink", href: n.href, ...stepHover(n.entry?.uuid || n.id) }, n.label.replace(/`/g, ""), el("div", { class: "ktw-note" }, [projOf(n), extra].filter(Boolean).join(" · ")));
  // counts
  const count = (pick) => { const m = new Map(); for (const t of thoughts) for (const n of pick(t)) m.set(n, (m.get(n) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const starts = count((t) => [t.steps[0]]), ends = count((t) => [t.steps[t.steps.length - 1]]);
  const bridges = count((t) => t.steps.slice(1, -1)).filter(([, c]) => c > 1);
  const fansTo = ends.filter(([, c]) => c > 1), fansFrom = starts.filter(([, c]) => c > 1);
  const projects = new Map(); const bump = (p, k) => { if (!projects.has(p)) projects.set(p, { starts: 0, ends: 0, through: 0 }); projects.get(p)[k]++; };
  for (const t of thoughts) { bump(projOf(t.steps[0]), "starts"); bump(projOf(t.steps[t.steps.length - 1]), "ends"); for (const p of new Set(t.steps.slice(1, -1).map(projOf))) bump(p, "through"); }
  const stat = (n, label) => el("div", { class: "ktw-stat" }, el("b", {}, String(n)), el("span", {}, label));
  const kids = [
    el("div", { class: "ktw-stats" }, stat(thoughts.length, tw("thoughts.stat.thoughts", "thoughts")), stat(thoughts.filter((t) => t.evolution).length, tw("thoughts.stat.evolutions", "evolutions")), stat(thoughts.filter(across).length, tw("thoughts.stat.across", "across projects")), stat(open.length, tw("thoughts.stat.beyond", "going on beyond")), stat(thoughts[0]?.steps.length || 0, tw("thoughts.stat.longest", "longest")),
      stat(thoughts.filter((t) => t.ins.weakOrigin).length, tw("thoughts.stat.weak", "start unconfirmed")), stat(thoughts.filter((t) => t.ins.shaky.length).length, tw("thoughts.stat.shaky", "pass a step in question"))),
  ];
  // chains whose first entry nobody confirmed, grouped by that entry
  const weak = thoughts.filter((t) => t.ins.weakOrigin);
  if (weak.length) {
    const byOrigin = new Map(); for (const t of weak) { if (!byOrigin.has(t.steps[0])) byOrigin.set(t.steps[0], []); byOrigin.get(t.steps[0]).push(t); }
    kids.push(el("h2", {}, tw("thoughts.page.weakHeading", "Starting from an unconfirmed entry")), el("p", { class: "ktw-note" }, tw("thoughts.page.weakNote", "Chains whose first entry has Evidence inferred or unknown. Where later entries depend on it, they depend on a reason nobody confirmed — the first entry is the place to ask.")),
      ...[...byOrigin.entries()].map(([n, ts]) => el("div", { class: "ktw-fan" }, entryLink(n, tw("thoughts.page.weakRow", "Evidence {evidence} · {n:thought} start here", { evidence: n.entry.evidence, n: ts.length })), el("div", { class: "ktw-fan-rows" }, ...ts.map(row)))));
  }
  // entries in question and the later entries linked after them — what to check if they change
  const impact = new Map();
  for (const t of thoughts.concat(open.filter((t) => t.steps.length < min))) for (const x of t.ins.shaky) {
    const n = t.steps[x.i];
    if (!impact.has(n)) impact.set(n, { why: x.why, later: new Set(), thoughts: new Set(), projects: new Set() });
    const m = impact.get(n); m.thoughts.add(t);
    for (const j of t.steps.slice(x.i + 1)) { m.later.add(j); m.projects.add(projOf(j)); }
  }
  if (impact.size) kids.push(el("h2", {}, tw("thoughts.page.shakyHeading", "Chains through a step in question")), el("p", { class: "ktw-note" }, tw("thoughts.page.shakyNote", "Entries in question — open, needing review, waiting for confirmation, or replaced yet still cited — and the later entries linked after them. If one of these changes, these are the entries to check: whether they depend on it is for a person to say.")),
    ...[...impact.entries()].sort((a, b) => b[1].later.size - a[1].later.size).map(([n, m]) => el("div", { class: "ktw-fan" },
      entryLink(n, m.projects.size > 1 ? tw("thoughts.page.shakyRowProjects", "{why} · {n:later entry|later entries} linked after it, in {projects} projects", { why: whyWord(m.why), n: m.later.size, projects: m.projects.size }) : tw("thoughts.page.shakyRow", "{why} · {n:later entry|later entries} linked after it", { why: whyWord(m.why), n: m.later.size })),
      el("div", { class: "ktw-fan-rows" }, ...[...m.later].map((j) => entryLink(j, j.entry.status))))));
  if (fansTo.length) kids.push(el("h2", {}, tw("thoughts.page.fansToHeading", "Where many lines lead")), el("p", { class: "ktw-note" }, tw("thoughts.page.fansToNote", "Entries at the end of several chains — where chains from different starts arrive.")),
    ...fansTo.map(([n, c]) => el("div", { class: "ktw-fan" }, entryLink(n, tw("thoughts.page.fansToRow", "{n} starts", { n: c })), el("div", { class: "ktw-fan-rows" }, ...thoughts.filter((t) => t.steps[t.steps.length - 1] === n).map(row)))));
  if (fansFrom.length) kids.push(el("h2", {}, tw("thoughts.page.fansFromHeading", "Where many lines start")), el("p", { class: "ktw-note" }, tw("thoughts.page.fansFromNote", "Entries several chains start from — often a decision much else refers to.")),
    ...fansFrom.map(([n, c]) => el("div", { class: "ktw-fan" }, entryLink(n, tw("thoughts.page.fansFromRow", "{n} thoughts", { n: c })), el("div", { class: "ktw-fan-rows" }, ...thoughts.filter((t) => t.steps[0] === n).map(row)))));
  if (bridges.length) kids.push(el("h2", {}, tw("thoughts.page.bridgesHeading", "Bridges")), el("p", { class: "ktw-note" }, tw("thoughts.page.bridgesNote", "Entries in the middle of several chains — where many links pass through.")), ...bridges.slice(0, 12).map(([n, c]) => entryLink(n, tw("thoughts.page.bridgesRow", "in {n} thoughts", { n: c }))));
  if (projects.size > 1) kids.push(el("h2", {}, tw("thoughts.page.byProject", "By project")), el("div", { class: "ktw-table-wrap" }, el("table", { class: "ktw-t" }, el("thead", {}, el("tr", {}, [tw("thoughts.page.colProject", "Project"), tw("thoughts.page.colStarts", "Starts"), tw("thoughts.page.colThrough", "Passes through"), tw("thoughts.page.colEnds", "Ends")].map((h) => el("th", {}, h)))),
    el("tbody", {}, [...projects.entries()].sort((a, b) => (b[1].starts + b[1].ends + b[1].through) - (a[1].starts + a[1].ends + a[1].through)).map(([p, c]) => el("tr", {}, el("td", {}, p), el("td", {}, String(c.starts)), el("td", {}, String(c.through)), el("td", {}, String(c.ends))))))));
  // time: when lines grew last, from the day each step was created
  const dated = thoughts.filter((t) => t.ins.to);
  if (dated.length > 1) {
    const recent = [...dated].sort((a, b) => b.ins.to.localeCompare(a.ins.to)).slice(0, 5);
    const resting = [...dated].sort((a, b) => a.ins.to.localeCompare(b.ins.to)).slice(0, 5);
    kids.push(el("h2", {}, tw("thoughts.page.recentHeading", "Recently grown")), el("p", { class: "ktw-note" }, tw("thoughts.page.recentNote", "Lines whose newest step is the newest — where reasoning is moving now.")), ...recent.map(row),
      el("h2", {}, tw("thoughts.page.restingHeading", "Resting longest")), el("p", { class: "ktw-note" }, tw("thoughts.page.restingNote", "Lines that have not grown for the longest time — settled, or forgotten.")), ...resting.map(row));
  }
  kids.push(el("h2", {}, tw("thoughts.page.all", "All thoughts ({n})", { n: thoughts.length })), ...thoughts.map(row));
  const evo = thoughts.filter((t) => t.evolution);
  if (evo.length) kids.push(el("h2", {}, tw("thoughts.page.evolutions", "Evolutions ({n})", { n: evo.length })), el("p", { class: "ktw-note" }, tw("thoughts.page.evolutionsNote", "One decision, replaced step by step.")), ...evo.map(row));
  if (open.length) kids.push(el("h2", {}, tw("thoughts.page.beyond", "Going on beyond this page ({n})", { n: open.length })), el("p", { class: "ktw-note" }, tw("thoughts.page.beyondNote", "Chains that continue in a repository this page has not loaded.")),
    el("button", { type: "button", class: "ktw-link-btn", disabled: host.follow.busy(), onclick: () => host.follow.all() }, host.follow.busy() ? tw("thoughts.loadingChains", "loading the chains…") : tw("thoughts.page.followAll", "load the whole chains")), ...open.map(row));
  setKids(box, ...kids);
}

// ---- the reader: #thought/<id>,<id>,… — a whole thought in one view, every entry of the chain in reading order,
// origin first, each in full, joined by how the next one follows from it. Entries of friends or of the path's
// projects are found by the host in what the page has loaded (host.findEntry), and a missing one says so.
function thoughtLink(a, b) {
  if (!a || !b) return "then";
  if (a.e.uuid && (b.e.see || []).some((x) => x?.uuid === a.e.uuid)) return "cited by";
  const sb = a.e.superseded_by ? parseSupersededBy(a.e.superseded_by) : null;
  if (sb?.uuid && sb.uuid === b.e.uuid) return "superseded by";
  return "then";
}
// the days a thought's steps were created, as ticks on one line
function thoughtTimeline(steps, ins) {
  if (!ins.from || ins.from === ins.to) return ins.from ? el("p", { class: "ktw-note" }, tw("thoughts.reader.oneDay", "All its steps were written on {date}.", { date: ins.from })) : null;
  const t0 = Date.parse(ins.from), t1 = Date.parse(ins.to), days = Math.round((t1 - t0) / 86400000);
  const bar = el("div", { class: "ktw-timeline-bar" });
  steps.forEach((f, i) => { const d = f?.e?.git?.created?.date; if (!d) return; const x = ((Date.parse(d) - t0) / (t1 - t0)) * 100; bar.append(el("span", { class: "ktw-tick", style: `left:${x}%`, title: `${i + 1}: ${d} — ${f.e.title}`, ...stepHover(f.e.uuid || `e:${f.e.id}`) }, String(i + 1))); });
  return el("div", { class: "ktw-thought-timeline" }, el("div", { class: "ktw-note" }, tw("thoughts.reader.span", "{from} → {to} · grew over {n:day}", { from: ins.from, to: ins.to, n: days })), bar);
}
function reader(main, refs, host) {
  const steps = refs.map(host.findEntry);
  // a step from another project may come from a lean export: its body is fetched, and the view renders again
  const lean = steps.filter((f) => f?.origin?.state && typeof f.origin.state.bodies === "string" && !f.origin.state.bodiesLoaded && !f.origin.state.bodiesError);
  if (lean.length) Promise.all(lean.map((f) => host.bodies(f.origin.state))).then(() => { if (nav.current().view === "thought") host.render(); });
  // an entry of a friend is found once the friends are in: they load with a graph, and the view renders again
  if (steps.some((f) => !f)) host.needFriends();
  const links = steps.map((f, i) => (i ? thoughtLink(steps[i - 1], f) : null));
  const ins = thoughtInsights(steps.map((f) => f?.e || {}), links.slice(1).map((l) => (l === "superseded by" ? "superseded" : "see")));
  // where the chain goes on beyond what the page has loaded: before its origin, after its newest entry
  const beyond = (f, kind) => (f ? entryRefs(f.e).filter((x) => x.kind === kind && x.remote && !host.findEntry(x.uuid)) : []);
  const before = beyond(steps[0], "see"), after = beyond(steps[steps.length - 1], "superseded");
  // `before`: the chain goes on before its origin, else after its newest entry
  const goOn = (ends, before) => {
    const repos = [...new Set(ends.map((x) => repoLabel(x.remote)))].join(", ");
    const button = el("button", { type: "button", class: "ktw-link-btn", disabled: host.follow.busy(), onclick: () => host.follow.chain({ anchor: steps.filter(Boolean).pop()?.e.uuid }, (c) => { if (c) nav.go(thoughtRoute(c)); else host.render(); }) }, host.follow.busy() ? tw("thoughts.reader.loading", "loading…") : tw("thoughts.reader.followChain", "load the whole chain"));
    return el("div", { class: "ktw-thought-beyond" }, before ? tw("thoughts.reader.goesOnBefore", "↑ Before its origin, it goes on in {repos} — not loaded on this page. {button}", { repos, button }) : tw("thoughts.reader.goesOnAfter", "↓ After its newest entry, it goes on in {repos} — not loaded on this page. {button}", { repos, button }));
  };
  const evolution = steps.length > 1 && links.slice(1).every((l) => l === "superseded by");
  const r = el("div", { class: "ktw-reader ktw-thought-reader" },
    el("div", { class: "ktw-crumbs" }, navLink({ href: { view: "graph" } }, tw("thoughts.reader.graph", "Graph")), tw("thoughts.reader.crumb", " / thought")),
    el("h1", {}, evolution ? tw("thoughts.reader.evolutionHeading", "An evolution in {n} entries", { n: refs.length }) : tw("thoughts.reader.heading", "A thought in {n} entries", { n: refs.length })),
    el("p", { class: "ktw-sub" }, evolution ? tw("thoughts.reader.evolutionSub", "One decision, replaced step by step — from the first version to the one in force.") : tw("thoughts.reader.sub", "A chain of linked entries, each citing the one before — read from the first to the last. A link says two entries are related: often that one follows from the other, not always.")),
    before.length ? goOn(before.map((x) => ({ ...x })), true) : null,
    thoughtTimeline(steps, ins),
    ins.weakOrigin ? el("div", { class: "ktw-thought-warn" }, tw("thoughts.reader.weak", "Its first entry's Evidence is {evidence}. Where a later step depends on it, it depends on a reason nobody confirmed.", { evidence: ins.weakOrigin })) : null);
  const linkWord = (l) => ({ "cited by": tw("thoughts.reader.citedBy", "cited by"), "superseded by": tw("thoughts.reader.supersededBy", "superseded by"), then: tw("thoughts.reader.then", "then") })[l];
  steps.forEach((f, i) => {
    if (i) r.append(el("div", { class: "ktw-thought-link" }, `↓ ${linkWord(links[i])}`));
    if (!f) { r.append(el("section", { class: "ktw-thought-step ktw-missing" }, el("div", { class: "ktw-crumbs" }, `${i + 1} / ${refs.length}`), el("p", { class: "ktw-note" }, tw("thoughts.reader.missing", "Entry {id} is not loaded on this page — it lives in a project outside it (a friend, or a step of a path); load the friends in the graph, or walk there.", { id: refs[i] })))); return; }
    const e = f.e;
    const project = f.own ? e.project || null : "\u0000"; // a foreign entry's file names are not this page's topics
    r.append(el("section", { class: `ktw-thought-step ktw-${e.status}`, ...stepHover(e.uuid || `e:${e.id}`) },
      el("div", { class: "ktw-crumbs" }, `${i + 1} / ${refs.length}`, f.where ? ` · ${f.where}` : "", f.own && topicOf(e.file) ? [" · ", navLink({ href: { view: "topic", file: e.file } }, topicOf(e.file).title)] : null, e.git?.created?.date ? ` · ${e.git.created.date}` : ""),
      ins.shaky.some((x) => x.i === i) ? el("div", { class: "ktw-thought-warn" }, steps.length - 1 - i === 1 ? tw("thoughts.reader.shakyOne", "In question — {why}. {n:later step} is linked after it — worth checking whether they depend on it.", { why: whyWord(ins.shaky.find((x) => x.i === i).why), n: 1 }) : tw("thoughts.reader.shaky", "In question — {why}. {n:later step} are linked after it — worth checking whether they depend on it.", { why: whyWord(ins.shaky.find((x) => x.i === i).why), n: steps.length - 1 - i })) : null,
      ins.affected.includes(i) && !ins.shaky.some((x) => x.i === i) ? el("div", { class: "ktw-thought-affected" }, tw("thoughts.reader.affected", "Linked after step {i}, which is in question.", { i: ins.shaky[0].i + 1 })) : null,
      el("h2", {}, el("a", { href: f.href }, host.inline(e.title, project))),
      el("div", { class: "ktw-fields" }, ...entryPills(e)),
      el("div", { class: "ktw-body" }, host.renderBody(e.body?.text || tw("thoughts.reader.noBody", "_(no body)_"), project)),
      e.revisit_when ? el("div", { class: "ktw-body" }, el("div", { class: "ktw-label" }, el("b", {}, "Revisit when"), el("p", {}, host.inline(e.revisit_when, project)))) : null));
  });
  if (after.length) r.append(goOn(after, false));
  main.append(r);
}

return Object.freeze({
  chains: graphChains, of: graphThoughts, forEntry: entryThoughts, list, page, reader, holdReading,
  thoughtRoute, thoughtHref, shortLabel, projOf, focusStep, stepHover,
});
}

const KTW = (root.KeepTheWhy = root.KeepTheWhy || {});
KTW.views = KTW.views || {};
KTW.views.thoughts = Object.freeze({ create });
})(globalThis);
