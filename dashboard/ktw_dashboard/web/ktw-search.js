/* Keep the Why dashboard — the search: what a search runs over (this project, its family, its friends, or
   both), its hits best first, the results page (#search/<scope>/<q>) and the dropdown under a search field.
   It reads the scene (the state, this project, the sidebar's filter), leaves the page through nav, and gets
   the family and the friends from the family (ktw-family.js). The registry is the host's: when the host
   offers them, two hooks put it in — host.registryPage(main, q, { scopeBar }) draws #search/registry/<q>, and
   host.registryRows(q, { open, expand, run, close }) gives the dropdown its registry rows; without them the
   search has no registry. A classic script on globalThis.KeepTheWhy.views.search, listed in ktw-views.json,
   tested through the page (snapshot.mjs). */
(function (root) {
"use strict";
const { canonicalOf, searchHit, compareHits, searchTerms, snippetAt, entryMatches, filterActive, topicTitle } = root.KeepTheWhy.core;
const { el, pill, entryPills, marked, navLinks, words: wordsOf, roleWord } = root.KeepTheWhy.ui;

// One search per page: create({ scene, nav, family, host, words }) — the host's scene and navigation, the page's
// family (ktw-family.js), the registry hooks above, and the host's words for the UI text (ktw-ui.js words).
function create({ scene, nav, family, host = {}, words }) {
const navLink = navLinks(nav);
const tw = wordsOf(words);
const entryHref = (e) => nav.href({ view: "entry", uuid: e.uuid || e.id });
const matches = (e) => entryMatches(e, scene.filter);
const pageFiltered = () => filterActive(scene.filter);
const publicHref = (canonical, root = "") => nav.href({ view: "overview", centre: { mode: "public", canonical, root } });

// Four scopes, chosen per search (the dropdown's rows, the results page's bar): this project alone,
// the family tree, the friends, or both. The host's own scope switch governs the graph and the lists,
// not the search — Enter in the search field always searches this project.
const SEARCH_SCOPES = { project: "this project", family: "family", friends: "friends", all: "family & friends" };
const scopeLabel = (k) => ({ project: tw("search.scope.project", "this project"), family: tw("search.scope.family", "family"), friends: tw("search.scope.friends", "friends"), all: tw("search.scope.all", "family & friends") })[k];
async function pool(scope) {
  const self = { member: { role: "self", name: scene.state.project.name || scene.state.project.id, canonical: canonicalOf(scene.state.project) }, state: scene.self, href: (e) => entryHref(e) };
  if (!(scope in SEARCH_SCOPES) || scope === "project") return { groups: [self], missing: [] };
  const fam = scope === "friends" ? { groups: [self], missing: [] } : await family.pool(self);
  if (scope === "family") return fam;
  const fr = await family.friendPool(fam);
  return { groups: [...fam.groups, ...fr.groups], missing: [...fam.missing, ...fr.missing] };
}
// every hit, best first; the dropdown keeps this project's hits on top
function rows(given, q) {
  const out = [];
  for (const g of given.groups) for (const e of g.state.entries || []) { const hit = searchHit(e, q); if (hit) out.push({ e, hit, g }); }
  return out.sort((a, b) => compareHits(a.hit, b.hit));
}
// the family can be read live, from a published export, or from an export that knows its repository
// (outside live mode only through the provider's exportState: without it, family and friends are not offered)
const searchScopes = () => (family.live() || (family.canExports() && (family.mode() === "public" || (family.mode() === "export" && !!canonicalOf(scene.state?.project)))) ? ["project", "family"] : ["project"]);
const hasFamily = () => !!(scene.state?.project?.parent || (scene.state?.project?.children || []).length);
const canFamily = () => searchScopes().includes("family") && hasFamily();
// friends can be searched where the family can be read, and there are any: entries citing outside the family
const canFriends = () => searchScopes().includes("family") && !!scene.self && family.friendCandidates(scene.self.entries || []).length > 0;
const canSearch = (s) => s === "project" || (s === "family" ? canFamily() : s === "friends" ? canFriends() : s === "all" ? canFamily() || canFriends() : false);
const onSearch = (scope, q) => { const r = nav.current(); return r.view === "search" && r.scope === scope && r.q === q; }; // still on these results — not navigated away while they loaded
const memberLabel = (m) => m.role === "self" ? tw("search.member.self", "this project") : m.role === "friend" ? (m.via ? tw("search.member.friendFamily", "friend's family, with {via}", { via: m.via }) : tw("search.member.friend", "friend")) : m.role === "relative" && m.via ? tw("search.member.relativeVia", "relative, via {via}", { via: m.via }) : roleLabel(m.role);
const roleLabel = (role) => roleWord(tw, role);
function hitSnippet(hit) {
  const w = hit.where; if (!w) return null;
  const text = snippetAt(w.text.replace(/\*\*|`/g, ""), Math.max(0, w.text.slice(0, w.i).replace(/\*\*|`/g, "").length), w.len);
  return [w.field === "body" || w.field === "title" ? null : [el("b", {}, `${w.field}:`), " "], marked(text, hit.terms)];
}

let INPUT = null; // the search field the dropdown is attached to
let RESTORE_SCROLL = 0; // a live update re-renders the results page; its rows arrive after the scroll was restored
async function view(main, linkScope, q) {
  if (linkScope === "registry" && host.registryPage) return host.registryPage(main, q, { scopeBar });
  const scope = canSearch(linkScope) ? linkScope : "project"; // a shared link may carry a scope this project cannot search: it falls back
  if (scope !== linkScope) { nav.go({ view: "search", scope, q }, { replace: true }); }
  if (INPUT && root.document.activeElement !== INPUT) INPUT.value = q;
  const terms = searchTerms(q);
  const sub = el("p", { class: "ktw-sub" }, tw("search.searching", "Searching…"));
  main.append(el("div", { class: "ktw-search-head" }, el("h1", {}, tw("search.heading", "Search {q}", { q: el("span", { class: "ktw-q" }, tw("search.quoted", "“{q}”", { q })) })), scopeBar(scope, q)), sub);
  if (terms.length === 0 || q.trim().length < 2) { sub.textContent = tw("search.tooShort", "Type at least two characters in the search field and press Enter."); return; }
  const found = await pool(scope);
  if (!onSearch(scope, q)) return; // navigated away meanwhile
  const hits = rows(found, q);
  const shown = hits.filter(({ e }) => matches(e)).length;
  const projectsHit = new Set(hits.map((r) => r.g)).size;
  sub.textContent = tw("search.found", "{n:entry} in {projects:project}", { n: hits.length, projects: projectsHit }) +
    (scope !== "project" ? tw("search.foundSearched", " · {n:project} searched", { n: found.groups.length }) : "") +
    (terms.length > 1 ? tw("search.allOf", " · all of: {terms}", { terms: terms.join(", ") }) : "") +
    (pageFiltered() ? tw("search.filtered", " · {n} match the sidebar filters, the rest dimmed", { n: shown }) : "") +
    tw("search.fields", " · searched: {fields}", { fields: "title, body, Revisit when, Source, Verification, Superseded by, Id, file, type, status, evidence" });
  const box = el("div", { class: "ktw-search-page" });
  // a project whose entry texts could not be had was searched without them: said once, above the results
  const textless = found.groups.filter((g) => g.state.bodiesError);
  if (textless.length) box.append(el("p", { class: "ktw-note ktw-warn" }, tw("search.textless", "Searched without the entry texts in {names}: {errors}.", { names: textless.map((g) => g.member.name).join(", "), errors: [...new Set(textless.map((g) => g.state.bodiesError))].join("; ") })));
  for (const g of found.groups) {
    const mine = hits.filter((r) => r.g === g);
    if (!mine.length) continue;
    const m = g.member;
    const head = el("div", { class: "ktw-sg-head" },
      m.role === "self" ? el("b", {}, m.name) : el("a", { href: m.open || (family.published() ? publicHref(m.canonical, m.root || "") : nav.href({ view: "overview", centre: { mode: "live", project: m.key } })) }, m.name),
      pill(memberLabel(m), "ktw-role"), el("span", { class: "ktw-count" }, tw("search.hits", "{n:hit}", { n: mine.length })));
    box.append(el("section", { class: "ktw-sgroup" }, head, m.scope ? el("div", { class: "ktw-ms ktw-note" }, m.scope) : null,
      el("div", { class: "ktw-entry-list" }, mine.map(({ e, hit }) => {
        const gt = e.git;
        const meta = [topicTitle(g.state, e.file), e.file, gt?.created?.author ? `${gt.created.author} · ${gt.created.date}` : null,
          gt?.last_touched?.date && gt.last_touched.date !== gt?.created?.date ? tw("search.touched", "touched {date}", { date: gt.last_touched.date }) : null,
          e.uuid ? tw("search.id", "Id {id}", { id: e.uuid.slice(0, 8) }) : null, tw("search.matches", "{n:match|matches}", { n: hit.count })].filter(Boolean).join("  ·  ");
        return el("a", { href: g.href(e), class: `ktw-row ${matches(e) ? "" : "ktw-dim"}` },
          el("div", { class: "ktw-rt" }, el("span", {}, marked(e.title.replace(/`/g, ""), hit.terms)), ...entryPills(e)),
          el("div", { class: "ktw-rs" }, hitSnippet(hit)),
          el("div", { class: "ktw-rm" }, meta));
      }))));
  }
  const wider = scope === "all" ? null : canSearch("all") ? "all" : scope === "project" && canSearch("family") ? "family" : scope === "project" && canSearch("friends") ? "friends" : null;
  if (!hits.length) {
    // the sentence's parts are nodes at their placeholders: a host's words may put them in another order, and
    // without words the paragraph has the text nodes it always had — where, the wider search (or an empty text), "."
    const text = (t) => root.document.createTextNode(t);
    const where = text(scope === "project" ? tw("search.none.inProject", " in this project") : scope === "all" ? tw("search.none.inAll", " in the family or the friends") : tw("search.none.inScope", " in the {scope}", { scope: scopeLabel(scope) }));
    const more = root.document.createDocumentFragment();
    if (wider) more.append(...[tw("search.none.more", " — {link}", { link: navLink({ href: { view: "search", scope: wider, q: q } }, tw("search.wider", "search {scope}", { scope: scopeLabel(wider) })) })].flat().map((x) => (x.nodeType ? x : text(x))));
    else more.append(text(""));
    box.append(el("p", { class: "ktw-center" }, tw("search.none", "No entry matches “{q}”{where}{more}.", { q, where, more })));
  }
  if (found.missing.length) box.append(el("section", { class: "ktw-sgroup ktw-missing" }, el("div", { class: "ktw-sg-head" }, el("b", {}, tw("search.notSearched", "Not searched")), el("span", { class: "ktw-count" }, found.missing.length)),
    found.missing.map(({ member: m, reason }) => el("div", { class: "ktw-sr-missing" }, el("b", {}, m.name), tw("search.missingWhy", " ({role}) — {reason}", { role: memberLabel(m), reason }))),
    el("p", { class: "ktw-note" }, [found.missing.some(({ member: m }) => m.role !== "friend") ? tw("search.missingFamily", "Family shows how to get a member that is not on this machine.") : "",
      found.missing.some(({ member: m }) => m.role === "friend") ? tw("search.missingFriends", "Friends lists the repositories the entries cite outside the family, and what could not be loaded.") : ""].filter(Boolean).join(" "))));
  main.append(box);
  if (RESTORE_SCROLL) main.scrollTop = RESTORE_SCROLL;
}
// the results page's bar: the entry scopes this project can search, and the registry's projects last when the host has them
const scopeBar = (scope, q) => el("span", { class: "ktw-search-scope", title: tw("search.scopeTitle", "where to search — the switch next to the project menu sets the graph and the lists, not the search; registry: a project rather than entries") },
  ...Object.keys(SEARCH_SCOPES).filter((k) => canSearch(k)).map((k) => navLink({ href: { view: "search", scope: k, q: q }, class: k === scope ? "ktw-on" : "" }, scopeLabel(k))),
  host.registryPage ? navLink({ href: { view: "search", scope: "registry", q: q }, class: scope === "registry" ? "ktw-on" : "" }, tw("search.scope.registry", "registry")) : null);

// The dropdown under a search field: this project's hits as they are typed, the wider scopes as its first rows,
// the host's registry rows after them. A click outside `within` (a selector around the field) closes it.
function attach({ input, box, within }) {
  INPUT = input;
  let sel = -1; let seq = 0;
  const REG = { on: false }; // the registry's rows are open (host.registryRows)
  const close = () => { box.hidden = true; sel = -1; REG.on = false; };
  const run = async () => {
    const q = input.value.trim(); if (q.length < 2 || !scene.state) return close();
    const mine = ++seq;
    // the dropdown searches this project alone — on hand, nothing to fetch; the wider scopes are its last rows
    const found = await pool("project");
    if (mine !== seq) return; // a newer keystroke won
    const all = rows(found, q);
    const shown = all.slice(0, 12);
    const wider = Object.keys(SEARCH_SCOPES).filter((k) => k !== "project" && canSearch(k));
    const registry = host.registryRows ? host.registryRows(q, { open: REG.on, expand: () => { REG.on = true; input.focus(); run(); }, run, close }) : [];
    // the wider scopes first, so they are in view however long the list of hits gets
    box.replaceChildren(...[...wider.map((k) => navLink({ class: "ktw-sr-all ktw-sr-scope", href: { view: "search", scope: k, q: q }, onclick: close }, tw("search.dropdown.in", "Search in {scope}", { scope: scopeLabel(k) }))),
      ...registry,
      el("div", { class: "ktw-sr-head" }, !shown.length ? tw("search.dropdown.head", "Results in this project") : all.length > shown.length ? tw("search.dropdown.headSome", "Results in this project ({shown} of {all})", { shown: shown.length, all: all.length }) : tw("search.dropdown.headAll", "Results in this project ({all})", { all: all.length })),
      ...(shown.length ? shown.map(({ e, hit, g }) => el("a", { href: g.href(e), onclick: close },
      el("div", {}, marked(e.title.replace(/`/g, ""), hit.terms)),
      el("div", { class: "ktw-sr-file" }, topicTitle(g.state, e.file)),
      el("div", { class: "ktw-sr-snip" }, hitSnippet(hit)))) : [el("div", { style: "padding:10px 12px;color:var(--ktw-fg3, #9999a2)" }, tw("search.dropdown.none", "no matches in this project"))]),
      REG.on ? navLink({ class: "ktw-sr-all", href: { view: "search", scope: "registry", q: q }, onclick: close }, tw("search.dropdown.registryPage", "↵  projects in the registry, as a page"))
        : navLink({ class: "ktw-sr-all", href: { view: "search", scope: "project", q: q }, onclick: close }, all.length > shown.length ? tw("search.dropdown.allResults", "↵  all {n} results in this project", { n: all.length }) : tw("search.dropdown.resultsPage", "↵  results page"))].filter(Boolean)); // replaceChildren writes a null as the text "null"
    box.hidden = false; sel = -1;
  };
  input.oninput = run; input.onfocus = () => { if (input.value.trim().length >= 2 && nav.current().view !== "search") run(); };
  input.onkeydown = (ev) => {
    const items = [...box.querySelectorAll("a")];
    if (ev.key === "Escape") { input.blur(); close(); }
    else if (ev.key === "ArrowDown") { sel = Math.min(items.length - 1, sel + 1); items.forEach((a, i) => a.classList.toggle("ktw-sel", i === sel)); items[sel]?.scrollIntoView?.({ block: "nearest" }); ev.preventDefault(); }
    else if (ev.key === "ArrowUp") { sel = Math.max(0, sel - 1); items.forEach((a, i) => a.classList.toggle("ktw-sel", i === sel)); ev.preventDefault(); }
    else if (ev.key === "Enter") {
      ev.preventDefault();
      if (!box.hidden && items[sel]) { items[sel].click(); input.blur(); return; }
      const q = input.value.trim(); if (q.length < 2) return;
      const reg = REG.on; seq++; close(); input.blur(); // Enter without a selection: the results page — this project, or the registry's projects when that row is open
      nav.go({ view: "search", scope: reg ? "registry" : "project", q });
    }
  };
  // a click outside closes the dropdown. A row's own handler may have re-rendered the dropdown by the time the
  // event reaches here (the registry row does, after an await): its target is then detached and belongs to no
  // ancestor — a detached target was in the dropdown, not outside it.
  root.document.addEventListener("click", (ev) => { if (ev.target.isConnected && !ev.target.closest(within)) close(); });
}

return Object.freeze({
  SCOPES: SEARCH_SCOPES, pool, rows, canFamily, canFriends, canSearch, hasFamily,
  view, scopeBar, onSearch, attach, keepScroll: (px) => { RESTORE_SCROLL = px; },
});
}

const KTW = (root.KeepTheWhy = root.KeepTheWhy || {});
KTW.views = KTW.views || {};
KTW.views.search = Object.freeze({ create });
})(globalThis);
