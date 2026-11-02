/* Keep the Why dashboard — the family: the tree a project belongs to, read from the live server or from the
   members' published exports, each member's state, the friends (repositories the entries cite outside the
   family, each with its own family), the Family page and the Friends page. The search, the graph's family and friend layers and
   the path read the family through this; the page shows it. It loads only through the provider it is given
   (the dashboard's: /api/* on this machine, the published exports elsewhere), and knows public members only:
   no token, no private member and no host URL reaches it — those stay with the host until the token contract
   with Maity is settled. What it asks of the host (`host`): mode(), "live" | "public" | "export", and root(),
   the page's own root in public and export mode. A classic script on globalThis.KeepTheWhy.views.family,
   listed in ktw-views.json, tested through the page (snapshot.mjs). */
(function (root) {
"use strict";
const { canonicalOf, resolveLocation, familyRank, familyOrder, friendsOf, fkey, repoLabel, kindLabel, plural, entryRefs } = root.KeepTheWhy.core;
const { el, setKids, hostMark } = root.KeepTheWhy.ui;

// One family per page: create({ scene, nav, provider, host }) — provider() returns the methods the current mode
// can answer (the dashboard's provider), host the two questions above.
function create({ scene, nav, provider, host }) {
const LIVE = () => host.mode() === "live";
const PUBLISHED = () => host.mode() === "public" || host.mode() === "export";
const entryRoute = (e) => ({ view: "entry", uuid: e.uuid || e.id });
const entryHref = (e) => nav.href(entryRoute(e));
// a place in another project's published export, or in a project on this machine: the page opened on that centre
const publicHref = (canonical, root = "", route = { view: "overview" }) => nav.href({ ...route, centre: { mode: "public", canonical, root } });
const liveHref = (project, route) => nav.href({ ...route, centre: { mode: "live", project } });

// the page's caches over the provider: one request per project, however many ask at once
const PUBLIC_STATES = {}; // `${canonical}|${root}` -> Promise<{state, url} | {error}>
function publicState(canonical, root = "") {
  const key = `${canonical}|${root}`;
  return (PUBLIC_STATES[key] ||= provider().exportState(canonical, root));
}
const bodies = (state) => provider().bodies(state).then((r) => r.state);

// What a search runs over: this project, or every member of its tree — the
// whole family from the root down, not only the parent chain.
let TREE = null; let TREE_AT = 0; // the provider's family({ tree: true }), live mode
async function tree() {
  const P = provider(); if (!P.family) return null;
  if (TREE && Date.now() - TREE_AT < 30000) return TREE;
  const r = await P.family({ tree: true });
  if (r.error) TREE = null; else { TREE = r.members; TREE_AT = Date.now(); }
  return TREE;
}
const MEMBER_STATES = {}; // project key -> { at, p: Promise<{state}|{error}> }, live mode
function memberState(key) {
  const c = MEMBER_STATES[key];
  if (c && Date.now() - c.at < 30000) return c.p;
  const P = provider();
  const p = P.memberState ? P.memberState(key) : Promise.resolve({ error: "a member's state needs the live server" });
  MEMBER_STATES[key] = { at: Date.now(), p };
  return p;
}
let PUBLIC_TREE = null; // the tree read from published exports, public mode
async function publicTree() {
  if (PUBLIC_TREE) return PUBLIC_TREE;
  PUBLIC_TREE = await publicTreeFrom({ state: scene.self, canonical: canonicalOf(scene.state.project), root: host.root(), name: scene.state.project.id || scene.state.project.name, href: (e) => entryHref(e) });
  await Promise.all(PUBLIC_TREE.groups.map((g) => bodies(g.state))); // merged into search and lists: the bodies are needed
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
  const add = (m, r) => { if (r.state) groups.push({ member: m, state: r.state, href: (e) => publicHref(m.canonical, m.root, entryRoute(e)) }); else missing.push({ member: m, reason: r.error }); return r.state; };
  // up: the parent chain, as far as each level is published
  let cur = { state: start.state, canonical: canon, root: myRoot }; let depth = 1; let parentKey = null; let below = self.member;
  while (cur.state?.project?.parent && depth < 12) {
    const loc = resolveLocation(cur.state.project.parent, cur.canonical, cur.root);
    if (!loc || seen.has(keyOf(loc.canonical, loc.root))) break;
    seen.add(keyOf(loc.canonical, loc.root));
    if (depth === 1) parentKey = keyOf(loc.canonical, loc.root);
    const m = { role: depth === 1 ? "parent" : depth === 2 ? "grandparent" : "ancestor", depth, name: label(loc), ...loc, node: keyOf(loc.canonical, loc.root), up: null };
    below.up = m.node; below = m; // the tree's shape: each level names the one above it
    const st = add(m, await publicState(loc.canonical, loc.root));
    cur = { state: st, canonical: loc.canonical, root: loc.root }; depth++;
  }
  // down: every published children block, level by level from the top
  let level = groups.map((g) => ({ state: g.state, canonical: g.member.canonical, root: g.member.root || "", key: keyOf(g.member.canonical, g.member.root || "") }));
  for (let round = 0; level.length && round < 12; round++) {
    const next = [];
    const kids = level.flatMap((l) => (l.state?.project?.children || []).map((c) => ({ c, from: l, loc: resolveLocation(c.location, l.canonical, l.root) })))
      .filter(({ loc }) => loc && !seen.has(keyOf(loc.canonical, loc.root)));
    for (const k of kids) seen.add(keyOf(k.loc.canonical, k.loc.root));
    const results = await Promise.all(kids.map((k) => publicState(k.loc.canonical, k.loc.root)));
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
async function pool(self) {
  if (PUBLISHED()) return publicTree();
  if (!LIVE()) return { groups: [self], missing: [] };
  const others = [...(await tree() || [])].filter((m) => m.role !== "self").sort((a, b) => familyRank(a) - familyRank(b));
  const results = await Promise.all(others.map((m) => m.key ? memberState(m.key) : { error: m.available === "none" ? "not checked out or cached on this machine" : "location unknown" }));
  const groups = [self]; const missing = [];
  others.forEach((m, i) => { const r = results[i]; if (r.state) groups.push({ member: m, state: r.state, href: (e) => liveHref(m.key, entryRoute(e)) }); else missing.push({ member: m, reason: r.error }); });
  return { groups, missing };
}

// ---------------------------------------------------------------- friends
// Friends: repositories outside the family that the entries in the graph
// cite by a cross-project See or Superseded by. Each is loaded the way a
// reference row resolves it (a project known to the live server, else the
// repository's published export), one level deep — a friend's own friends
// are not followed. A friend is linked into the graph, never merged: search,
// queues, counts and the other views stay with the project or family.
// What the host's graph reads and sets: on, expanded, load, loading; loaded and pending are the cache.
const FRIENDS = { on: false, loaded: {}, pending: {}, expanded: new Set(), load: false, loading: false };
function friendCandidates(entries, family = []) {
  const p = scene.self?.project || {}; const base = canonicalOf(p); const myRoot = host.root();
  const declared = [p.parent, ...(p.children || []).map((c) => c.location)].map((l) => resolveLocation(l, base, myRoot)?.canonical);
  return friendsOf(entries, [base, ...declared, ...(TREE || []).map((m) => m.canonical), ...family]);
}
function loadFriend(f) {
  const k = fkey(f.canonical);
  if (FRIENDS.loaded[k]) return Promise.resolve(FRIENDS.loaded[k]);
  return (FRIENDS.pending[k] ||= (async () => {
    let r = null;
    const P = provider();
    if (P.resolveEntry && P.memberState && f.uuids?.length) {
      try {
        const hit = await P.resolveEntry(f.uuids[0]);
        if (!hit.error) {
          const m = await memberState(hit.project);
          if (m.state) r = { ...liveMember({ key: hit.project, name: m.state.project?.id, role: "self" }, m.state), name: m.state.project?.id || repoLabel(f.canonical) };
        }
      } catch { /* not known here: the published export */ }
    }
    if (!r) {
      const p = await publicState(f.canonical, "");
      r = p.state ? { ...publicMember({ canonical: f.canonical, root: "", name: repoLabel(f.canonical), role: "self" }, p.state), forkOf: p.forkOf || null } : { error: p.error };
    }
    r.canonical = f.canonical;
    // a family is one unit, like a repository: a friend that has one comes with all of it
    if (r.state) r.members = await friendUnit(r);
    return (FRIENDS.loaded[k] = r);
  })());
}
// a friend whose load failed is asked again: its cached answers go
function forgetFriend(canonical) {
  const k = fkey(canonical);
  if (!FRIENDS.loaded[k]?.error) return;
  delete FRIENDS.loaded[k]; delete FRIENDS.pending[k]; delete PUBLIC_STATES[`${canonical}|`];
}
// One member of a friend's unit, however it was found
function liveMember(m, state) {
  return { key: `L:${m.key}`, name: m.name || state.project?.id || m.key, role: m.role, state, canonical: canonicalOf(state.project) || m.canonical || "", root: state.project?.root || "",
    href: (e) => liveHref(m.key, entryRoute(e)), topicHref: (file) => liveHref(m.key, { view: "topic", file: file }), open: liveHref(m.key, { view: "graph" }), centre: { mode: "live", project: m.key } };
}
function publicMember(m, state) {
  return { key: `P:${fkey(m.canonical)}|${m.root || ""}`, name: m.name, role: m.role, state, canonical: m.canonical, root: m.root || "",
    href: (e) => publicHref(m.canonical, m.root || "", entryRoute(e)), topicHref: (file) => publicHref(m.canonical, m.root || "", { view: "topic", file: file }), open: publicHref(m.canonical, m.root || "", { view: "graph" }), centre: { mode: "public", canonical: m.canonical, root: m.root || "" } };
}
// The friend's whole family tree — on the live server what it knows about that
// project, else the members' published exports; members that cannot be read
// are left out of the unit (the friend itself is always in it).
async function friendUnit(r) {
  const p = r.state.project || {};
  const self = { ...r };
  if (!p.parent && !(p.children || []).length) return [self];
  const out = [self];
  const P = provider();
  if (r.centre?.mode === "live" && P.family && P.memberState) {
    try {
      const fam = await P.family({ project: r.centre.project, tree: true });
      if (fam.error) throw new Error(fam.error);
      const members = fam.members.filter((m) => m.role !== "self" && m.key);
      const states = await Promise.all(members.map((m) => memberState(m.key)));
      members.forEach((m, i) => { if (states[i].state) out.push(liveMember(m, states[i].state)); });
      return out;
    } catch { /* fall back to the published exports */ }
  }
  const t = await publicTreeFrom({ state: r.state, canonical: r.canonical, root: p.root || "", name: r.name, href: r.href });
  for (const g of t.groups) if (g.member.role !== "self") out.push(publicMember(g.member, g.state));
  return out;
}
// The friends of the projects in a pool — the repositories their entries cite outside the family —
// read the way the graph reads them (loadFriend: a local checkout the live server knows, else the
// published export), bodies included, since the search reads them. A friend that has a family comes
// with it, as in the graph. What does not load is listed under "Not searched", never dropped.
async function friendPool(given) {
  if (LIVE()) await tree(); // the whole family is known before anything counts as a friend
  const known = [...given.groups.map((g) => g.member.canonical), ...given.missing.map(({ member: m }) => m.canonical)].filter(Boolean);
  const list = friendCandidates(given.groups.flatMap((g) => g.state.entries || []), known);
  const results = await Promise.all(list.map(loadFriend));
  const groups = []; const missing = []; const seen = new Set(known.map(fkey));
  results.forEach((r, i) => {
    const f = list[i];
    if (!r.state) { missing.push({ member: { role: "friend", name: repoLabel(f.canonical), canonical: f.canonical }, reason: r.error || "could not load the export" }); return; }
    for (const u of r.members || [r]) {
      const k = fkey(u.canonical); if (!k || seen.has(k)) continue; seen.add(k);
      groups.push({ member: { role: "friend", name: u.name, canonical: u.canonical, root: u.root || "", key: u.key, open: u.open, via: k === fkey(r.canonical) ? "" : r.name }, state: u.state, href: u.href });
    }
  });
  await Promise.all(groups.map((g) => bodies(g.state)));
  return { groups, missing };
}

// ---------------------------------------------------------------- the Family page
function publicMemberRow(m, r) {
  const st = r?.state;
  const title = st ? el("a", { href: publicHref(m.canonical, m.root || "") }, m.name) : el("b", {}, m.name);
  return el("div", { class: `member ${m.role} ${st ? "public" : "none"}`, onmouseenter: () => scene.spot(m.canonical, m.root || ""), onmouseleave: () => scene.spot(null) },
    el("div", { class: "mr" }, el("span", { class: "role" }, m.role), title, el("span", { class: `pill kind-${st ? "public" : "none"}` }, st ? "published export" : "no public export"),
      st ? el("span", { class: "pill" }, `generated ${st.generated || "?"}`) : null),
    m.scope ? el("div", { class: "ms" }, m.scope) : (m.role === "parent" ? el("div", { class: "ms note" }, "holds what is family-wide") : null),
    el("div", { class: "mm mono" }, m.canonical || m.location, st ? ` · ${st.entries.length} entries · ${st.topics.length} topics · ${r.url}` : r?.error ? ` · ${r.error}` : ""));
}
function memberRow(m) {
  const here = m.role === "self";
  const title = m.key && !here ? el("a", { href: liveHref(m.key, { view: "overview" }) }, m.name) : el("b", {}, m.name);
  return el("div", { class: `member ${m.role} ${m.available}`, onmouseenter: () => scene.spot(m.canonical, m.root || ""), onmouseleave: () => scene.spot(null) },
    el("div", { class: "mr" }, el("span", { class: "role" }, m.role), title, el("span", { class: `pill kind-${m.available}` }, here ? "this project" : kindLabel(m.available))),
    m.scope ? el("div", { class: "ms" }, m.scope) : (m.role === "parent" ? el("div", { class: "ms note" }, "holds what is family-wide") : null),
    el("div", { class: "mm mono" }, hostMark(m.canonical), m.canonical || m.location || "", m.path && !here ? ` · ${m.path}` : ""),
    m.fetch ? el("details", { class: "fetch" }, el("summary", {}, "not checked out here — how to get it"),
      el("p", { class: "note" }, "A working tree, writable (the mapping learns it on next start):"), el("pre", {}, el("code", {}, m.fetch.clone)),
      el("p", { class: "note" }, "Or the read-only context cache, shared by every project on this machine:"), el("pre", {}, el("code", {}, m.fetch.cache))) : null);
}
// the tree as nested rows: every member under the one whose children block lists it
function treeRows(members, rowOf) {
  return familyOrder(members).map(([m, d]) => el("div", { class: "tree-row", style: `padding-left:${Math.min(d, 6) * 26}px` }, d ? el("span", { class: "tree-mark" }, "└") : null, rowOf(m)));
}
async function view(main) {
  const p = scene.state.project;
  main.append(el("h1", {}, "Family"), el("p", { class: "sub" }, "The whole tree this project belongs to, from the root down: each project under the one whose children block lists it. That block is the routing — where an entry about something belongs; what is wider than a level goes one level up, to the root at most. Every member can be read; a member checked out here can be written to. Not a dependency graph."));
  if (!p.parent && !(p.children || []).length) return main.append(el("p", { class: "center" }, "This project is not part of a family: no parent line, no children block in .keep-the-why."));
  const box = el("div", { class: "family" }); main.append(box);
  if (PUBLISHED() && canonicalOf(p)) {
    box.append(el("p", { class: "center" }, "Reading the family's published exports…"));
    const t = await publicTree();
    const members = [...t.groups.map((g) => g.member), ...t.missing.map((x) => x.member)];
    const results = await Promise.all(members.map((m) => (m.role === "self" || !m.canonical ? null : publicState(m.canonical, m.root || ""))));
    const byNode = new Map(members.map((m, i) => [m.node, results[i]]));
    if (!box.isConnected) return;
    box.replaceChildren(...treeRows(members, (m) => m.role === "self"
      ? memberRow({ role: "self", name: p.id || p.name, location: "", scope: m.scope || "", canonical: canonicalOf(p), root: p.root || "", available: "public" })
      : publicMemberRow(m, byNode.get(m.node))));
    return;
  }
  if (!LIVE()) {
    // an export knows only its own config: parent and children as declared
    if (p.parent) box.append(memberRow({ role: "parent", name: p.parent.replace(/^https:\/\//, ""), location: p.parent, scope: "", canonical: p.parent.startsWith("https://") ? p.parent : "", available: "none", fetch: null }));
    box.append(memberRow({ role: "self", name: p.id || p.name, location: "", scope: "", canonical: canonicalOf(p), root: p.root || "", available: "repository" }));
    for (const c of p.children || []) box.append(memberRow({ role: "child", name: c.name, location: c.location, scope: c.scope, canonical: c.location.startsWith("https://") ? c.location : "", available: "none", fetch: null }));
    return;
  }
  const members = await tree() || [];
  if (!box.isConnected) return;
  box.replaceChildren(...treeRows(members, memberRow));
}

// a new centre (a walk along the path, to a friend): its tree is read anew
function resetCentre() { TREE = null; TREE_AT = 0; PUBLIC_TREE = null; }

// ---- the Friends page
// The repositories this project's entries cite outside the family, as cards: what here cites into each, what of
// theirs cites back. It reads the graph of the scope (this project, or the family) with the friends, the path and
// the followed chains it has: what the Graph view shows, laid out as lists. What only the host has it hands in with
// the call (`host`): graph(), a promise of that graph; units(g), the friends grouped by family, each with how it
// was reached (via "friend" | "chain" | "cited" | "globe"); color(i), a unit's colour; load(list), load these
// friends and keep loading them; cited(), the registry's citations of this project as they stand once the graph
// is there — { checked, ask }, ask present while they can still be asked for; left out where the host has no
// registry.
async function friendsView(main, host) {
  const graphHref = nav.href({ view: "graph" });
  main.append(el("h1", {}, "Friends"), el("p", { class: "sub" }, "Repositories the entries here cite outside the family — linked into the graph, never merged into search, queues or counts. A friend in a family comes as the whole family. One hop: a friend's own friends are not loaded; walk there to see them."));
  const box = el("div", { class: "friends-page" }, el("p", { class: "center" }, "Loading…")); main.append(box);
  const g = await host.graph();
  if (!box.isConnected) return;
  const list = g.friends || [];
  const units = host.units(g);
  const failed = list.map((f) => FRIENDS.loaded[fkey(f.canonical)]).filter((r) => r && !r.state);
  const waiting = list.filter((f) => !FRIENDS.loaded[fkey(f.canonical)]);
  const cited = host.cited?.() || {};
  const kids = [];
  if (!list.length && !units.length) kids.push(el("p", { class: "empty" }, "No entry here cites a repository outside the family yet. A See line into another project — its canonical and an entry's Id — makes it a friend."));
  if (cited.ask) kids.push(el("p", {}, el("button", { type: "button", class: "link-btn", title: "who in the Keep the Why registry cites this project — one file from the registry, loaded on this click", onclick: () => cited.ask() }, "who in the registry cites this project?")));
  if (list.length && (!FRIENDS.on || waiting.length)) kids.push(el("p", {}, FRIENDS.loading ? "Loading friends…" : el("button", { type: "button", class: "link-btn", onclick: () => host.load(FRIENDS.on ? waiting : list) }, `load the ${plural(FRIENDS.on ? waiting.length : list.length, "friend")}`)));
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
      el("h2", {}, el("i", { class: "dot", style: `background:transparent;border:2px dashed ${host.color(i)};width:11px;height:11px;margin-right:8px` }), el("a", { href: u.r.open || graphHref }, hostMark(u.r.canonical), u.r.name),
        u.via === "chain" ? el("span", { class: "pill" }, "via a thought") : null),
      el("p", { class: "note" }, `${u.members.length > 1 ? `A family of ${u.members.length}: ${u.members.map((m) => m.name).join(", ")}. ` : ""}Read from ${src}. ${u.r.canonical}${u.r.forkOf ? ` — a fork of ${u.r.forkOf}, by its own export` : ""}`),
      el("h3", {}, `Cited from here (${out.length})`),
      ...(out.length ? out.map((x) => rel(el("a", { href: x.from.href }, x.from.label), el("a", { href: x.to.m.href ? x.to.m.href(x.to.e) : graphHref }, x.to.e.title, u.members.length > 1 ? el("span", { class: "note" }, ` · ${x.to.m.name}`) : null), x.kind)) : [el("p", { class: "empty" }, u.via === "chain" ? "Nothing here cites it directly — it was reached by following a thought." : "—")]),
      el("h3", {}, `Citing this project (${back.length})`),
      ...(back.length ? back.map((x) => rel(el("a", { href: x.from.m.href ? x.from.m.href(x.from.e) : graphHref }, x.from.e.title), el("a", { href: x.to.href }, x.to.label), x.kind)) : [el("p", { class: "empty" }, "None of its entries cites an entry here.")]));
  };
  const friends = units.filter((u) => u.via !== "chain" && u.via !== "cited"), chained = units.filter((u) => u.via === "chain"), citing = units.filter((u) => u.via === "cited");
  kids.push(...friends.map((u) => card(u, units.indexOf(u))));
  if (citing.length) kids.push(el("h2", { class: "section" }, "Citing this project — from the registry"), el("p", { class: "note" }, `Repositories in the Keep the Why registry whose entries cite this project, from its backlink file${cited.checked ? `, built ${cited.checked}` : ""}. Citations from outside the registry are not in it.`), ...citing.map((u) => card(u, units.indexOf(u))));
  if (chained.length) kids.push(el("h2", { class: "section" }, "Reached by following a thought"), ...chained.map((u) => card(u, units.indexOf(u))));
  if (failed.length) kids.push(el("h2", { class: "section" }, "Not loaded"), ...failed.map((r) => el("div", { class: "ref" }, el("a", { href: r.canonical, target: "_blank", rel: "noopener" }, hostMark(r.canonical), repoLabel(r.canonical)), el("span", { class: "note warn" }, ` · ${r.error}`))));
  setKids(box, ...kids);
}

return Object.freeze({
  mode: () => host.mode(), live: LIVE, published: PUBLISHED,
  publicState, bodies, tree, memberState, publicTree, publicTreeFrom, pool, friendPool,
  treeNow: () => TREE, publicTreeNow: () => PUBLIC_TREE, resetCentre,
  friends: FRIENDS, friendCandidates, loadFriend, forgetFriend, liveMember, publicMember,
  view, friendsView,
});
}

const KTW = (root.KeepTheWhy = root.KeepTheWhy || {});
KTW.views = KTW.views || {};
KTW.views.family = Object.freeze({ create });
})(globalThis);
