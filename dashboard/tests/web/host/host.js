/* Two hosts on one page, neither of them the dashboard's: the views mounted without app.js, the way another host
   (Maity) mounts them. Each host has its own containers (with ktw-root, the aside with ktw-aside), its own
   navigation — paths under /<name>/why/, not the dashboard's hash — its own settings, and a provider that knows
   only the fixture's state. The library files are loaded from the manifest, in its order, as a vendoring host
   loads them. Served from dashboard/ (any static server), the page runs under the CSP in index.html.

   Host A's provider has every method a page without a server has (state, bodies, exportState), and one other
   repository's published export, so a reference into it resolves. Host B's has state() only: what needs the
   rest must hide or say so, and nothing may reject.

   Each host renders one route at a time; window.KTW_HOSTS[name].go(route) moves it, and a route no place
   answers to is an error, never the overview. window.KTW_HOST_PLACES lists every place with what it must show
   under each host; window.KTW_HOST_SETTLE(name, place) goes there and waits for that. host.mjs (jsdom) and
   host-chromium.mjs (Chromium, under the CSP) drive it. */
(async function () {
  "use strict";
  const WEB = new URL("../../../ktw_dashboard/web/", document.baseURI);
  const log = (line) => { const pre = document.getElementById("host-log"); pre.textContent += line + "\n"; };
  window.KTW_HOST_ERRORS = [];
  document.addEventListener("securitypolicyviolation", (e) => window.KTW_HOST_ERRORS.push(`CSP: ${e.violatedDirective} ${e.blockedURI || ""} ${e.sample || ""}`.trim()));
  window.addEventListener("error", (e) => window.KTW_HOST_ERRORS.push(`error: ${e.message}`));
  window.addEventListener("unhandledrejection", (e) => window.KTW_HOST_ERRORS.push(`rejection: ${e.reason?.message || e.reason}`));

  // the library, in the manifest's order
  const manifest = await (await fetch(new URL("ktw-views.json", WEB))).json();
  for (const name of manifest.scripts) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = new URL(name, WEB).href;
      s.onload = resolve; s.onerror = () => reject(new Error(`${name} did not load`));
      document.head.append(s);
    });
  }
  const K = globalThis.KeepTheWhy;
  const raw = await (await fetch("../fixture/state.json")).json();
  // the fixture as these hosts show it: a parent (so the family is asked of the provider), and one See into
  // another repository, whose published export only host A's provider can read
  const PARENT = "https://github.com/acme/platform", REMOTE = "https://github.com/acme/remote";
  const REMOTE_UUID = "0b6c1f0e-5a7d-4c39-9d2e-7f1a3b2c4d5e", REMOTE_TITLE = "Remote ids are stable across exports";
  raw.project.parent = PARENT;
  const citing = raw.entries.find((e) => e.uuid?.startsWith("65568f64"));
  citing.see = [...(citing.see || []), { anchor: "", date: "2026-06-01", file: "", locator: "", remote: REMOTE, uuid: REMOTE_UUID }];
  const remoteState = () => {
    const st = K.core.normalizeState(JSON.parse(JSON.stringify({ ...raw, project: { ...raw.project, id: "remote", name: "remote", canonical: REMOTE, parent: null, children: [] },
      entries: [{ ...raw.entries[1], uuid: REMOTE_UUID, title: REMOTE_TITLE, see: [] }] })));
    return st;
  };
  const CHAIN = ["3c80c624-2274-497a-a1f0-d8ff65b0e0c3", "756f14cb-61c6-4ff2-8dea-29f28c030ca5", "c63efee2"]; // superseded, then cited

  function makeHost(name, box, full) {
    const ROUTES = K.core.routes;
    const state = K.core.normalizeState(JSON.parse(JSON.stringify(raw)));
    const chain = CHAIN.map((p) => state.entries.find((e) => e.uuid?.startsWith(p)).uuid);
    const main = box.querySelector(".host-main"), aside = box.querySelector(".host-aside"), bar = box.querySelector(".host-nav");
    // navigation: a path per place, kept in this host; nothing reads or writes the page's address
    const base = `/${name}/why/`;
    let current = { view: "overview" };
    const listeners = new Set();
    const nav = {
      href: (route) => base + ROUTES.format(route).replace(/^#/, ""),
      // a move renders the place; a replace only rewrites where the host is (the timeline keeps its day in the
      // route that way), as the dashboard's history.replaceState fires no hashchange
      go(route, { replace = false } = {}) { current = route; if (replace) return; for (const fn of listeners) fn(current); render(); },
      current: () => current,
      onChange: (fn) => listeners.add(fn),
      open(href) { if (href.startsWith(base)) nav.go(ROUTES.parse("#" + href.slice(base.length))); },
    };
    // settings in memory, per host
    const kept = new Map();
    const prefs = { get: (k, fallback) => (kept.has(k) ? kept.get(k) : fallback), set: (k, v) => kept.set(k, String(v)) };
    // host A: this state, its bodies (inline already) and one other repository's export; host B: this state only
    const provider = full ? () => ({
      state: async () => ({ state, url: "fixture/state.json" }),
      bodies: async (st) => ({ state: st, url: "fixture/state.json" }),
      exportState: async (canonical, root = "") => (canonical === REMOTE && !root ? { state: remoteState(), url: "remote/state.json", canonical, root, raw: null }
        : { error: `no published export at ${canonical}`, canonical, root }),
    }) : () => ({ state: async () => ({ state, url: "fixture/state.json" }) });
    const scene = K.scene.create({ state, self: state, scope: "project" });
    const family = K.views.family.create({ scene, nav, provider, host: { mode: () => "export", root: () => "" } });
    const search = K.views.search.create({ scene, nav, family });
    const thoughts = K.views.thoughts.create({ scene, nav, prefs });
    const pages = K.views.pages.create({ scene, nav, prefs, family, search });
    const graphView = K.views.graph.create({ scene, nav, prefs });
    const timeline = K.views.timeline.create({ scene, nav, prefs });
    // the graph of the project, built by the library (graph.assemble) and kept, so positions survive a move
    let G = null;
    const graphOf = () => (G ||= Object.assign({ scale: 1, ox: 0, oy: 0, showEntries: true, showLabels: true, alpha: 1 }, graphView.assemble(state.topics, state.entries)));
    const topicHref = (file) => nav.href({ view: "topic", file });
    const H = {
      live: () => false, published: () => true, project: () => null, provider,
      inline: (md) => K.markdown.renderInline(document, md, { topicHref }),
      renderBody: (md) => K.markdown.render(document, md, { topicHref }),
      shareUrl: (route) => ({ url: new URL(nav.href(route), location.origin).href, where: `host ${name}` }),
      details: () => aside, miniGraph: () => {},
      entryThoughts: () => [], thoughts, memberLink: (m, href) => href,
      authorLink: (n) => document.createTextNode(n || "—"),
      authorProjects: () => [{ name: state.project.id || "fixture", canonical: "", state, open: nav.href({ view: "authors" }), role: "self", anonymized: false }],
      friendsWaiting: () => [], friendsLoading: () => false, loadFriends: () => {},
      render: () => render(), rerender: () => render(),
    };
    // what the thoughts view asks of a host: the graph, lighting a chain in it, and the rest this host has not
    const T = {
      graph: async () => graphOf(), light: (g, t) => graphView.lightThought(g, t),
      follow: { busy: () => false, chain: () => {}, all: () => {} },
      findEntry: (uuid) => { const e = state.entries.find((x) => x.uuid === uuid); return e ? { e, own: true, href: nav.href({ view: "entry", uuid }), origin: { state } } : null; },
      bodies: (st) => family.bodies(st), needFriends: () => {}, pick: () => false,
      inline: H.inline, renderBody: H.renderBody, listBox: () => aside, render: () => render(),
    };
    const PLACES = ["overview", "graph", "timeline", "thoughts", "queues", "findings", "authors", "family", "friends"];
    bar.replaceChildren(...PLACES.map((v) => {
      const a = document.createElement("a"); a.href = nav.href({ view: v }); a.textContent = v;
      a.addEventListener("click", (ev) => { ev.preventDefault(); nav.go({ view: v }); });
      return a;
    }));
    function render() {
      main.replaceChildren(); aside.replaceChildren();
      const r = current;
      try {
        if (r.view === "graph") {
          const h = document.createElement("h1"); h.textContent = "Graph";
          const wrap = document.createElement("div"); wrap.className = "ktw-graph-wrap host-graph";
          const canvas = document.createElement("canvas"); wrap.append(canvas); main.append(h, wrap);
          graphView.run(canvas, graphOf(), { fit: true, onEntry: (n) => nav.go({ view: "entry", uuid: n.entry.uuid || n.entry.id }), onTopic: (n) => nav.go({ view: "topic", file: n.file }) });
        }
        else if (r.centre) elsewhere(r);
        else if (r.view === "timeline") timeline.view(main, r.day || null, { graph: () => graphOf(), bodies: (st) => family.bodies(st), entryRow: (e) => pages.entryRow(e, H), renderBody: H.renderBody, render: () => render() });
        else if (r.view === "thoughts") thoughts.page(main, T);
        else if (r.view === "queues") pages.queuesPage(main, H);
        else if (r.view === "findings") pages.findings(main);
        else if (r.view === "authors") pages.authors(main, H);
        else if (r.view === "topic") pages.topic(main, r.file, H);
        else if (r.view === "entry") pages.entry(main, r.uuid, H);
        else if (r.view === "search") search.view(main, r.scope || "self", r.q || "");
        else if (r.view === "family") family.view(main);
        else if (r.view === "friends") family.friendsView(main, { graph: async () => ({ friends: [], nodes: [] }), units: () => [], color: () => "", load: () => {} });
        else if (r.view === "thought") thoughts.reader(main, r.refs, T);
        else if (r.view === "ref") pages.remoteEntry(main, r.canonical, r.uuid, H);
        else if (r.view === "overview") pages.overview(main, H);
        else window.KTW_HOST_ERRORS.push(`${name}: no place answers to the route ${JSON.stringify(r)}`);
      } catch (e) { window.KTW_HOST_ERRORS.push(`${name} ${r.view}: ${e.message}`); }
    }
    // a place in another repository: this host shows no other project, only where the views sent it and
    // what that repository's export says the entry is
    function elsewhere(r) {
      const h = document.createElement("h1"); h.textContent = "Elsewhere";
      const p = document.createElement("p"); p.className = "host-elsewhere"; p.textContent = `${r.centre.canonical} · ${r.view} ${r.uuid || ""}`;
      main.append(h, p);
      family.publicState(r.centre.canonical, r.centre.root || "").then((x) => {
        const e = x.state?.entries.find((y) => y.uuid === r.uuid);
        const b = document.createElement("b"); b.className = "host-elsewhere-title"; b.textContent = e ? e.title : `not found: ${x.error || "no such entry"}`;
        if (nav.current() === r) main.append(b);
      });
    }
    render();
    return { nav, go: (route) => nav.go(route), main, aside, state, family, chain };
  }

  window.KTW_HOSTS = {
    a: makeHost("a", document.getElementById("host-a"), true),
    b: makeHost("b", document.getElementById("host-b"), false),
  };

  // Every place, and what it must show under each host — its own content, not merely a heading. A check returns
  // null when the place shows it, else what is missing.
  const S = window.KTW_HOSTS.a.state, CH = window.KTW_HOSTS.a.chain;
  const topic = S.topics[0], entry = S.entries.find((e) => e.uuid?.startsWith("65568f64"));
  const text = (n) => window.KTW_HOSTS[n].main.textContent.replace(/\s+/g, " ");
  const q = (n, sel) => window.KTW_HOSTS[n].main.querySelectorAll(sel);
  const h1 = (n) => q(n, "h1")[0]?.textContent.replace(/\s+/g, " ").trim() || "";
  const need = (ok, what) => (ok ? null : what);
  const NO_EXPORTS = "published exports are not available on this page";
  window.KTW_HOST_PLACES = [
    { route: { view: "overview" }, check: (n) => need(text(n).includes(topic.title) && q(n, ".ktw-pill").length > 0, "the overview's topics and pills") },
    { route: { view: "graph" }, check: (n) => need(h1(n) === "Graph" && q(n, ".ktw-graph-wrap canvas").length === 1, "the graph's canvas"), canvas: true },
    { route: { view: "timeline" }, check: (n) => need(/Timeline/.test(h1(n)) && q(n, "canvas").length > 0, "the timeline's canvas"), canvas: true },
    { route: { view: "thoughts" }, check: (n) => need(/^Thoughts/.test(h1(n)) && q(n, ".ktw-thought-row").length > 0, "the chains of linked entries") },
    { route: { view: "queues" }, check: (n) => need(/Queue/i.test(h1(n)) && q(n, ".ktw-row, .ktw-entry-row, .ktw-q-group, section").length > 0, "the queues") },
    { route: { view: "findings" }, check: (n) => need(/Finding/i.test(h1(n)), "the findings page") },
    { route: { view: "authors" }, check: (n) => need(/Author/.test(h1(n)) && q(n, "table tbody tr, .ktw-author").length > 0, "the authors") },
    { route: { view: "family" }, check: (n) => need(h1(n) === "Family" && text(n).includes("acme/platform") && (n === "a" ? text(n).includes("no published export at") : text(n).includes(NO_EXPORTS)),
      n === "a" ? "the parent, and why its export did not load" : "the parent, and that this page reads no exports") },
    { route: { view: "friends" }, check: (n) => need(/Friends/.test(h1(n)), "the friends page") },
    { route: { view: "topic", file: topic.file }, check: (n) => need(h1(n).includes(topic.title) && S.entries.filter((e) => e.file === topic.file).every((e) => text(n).includes(e.title)), `topic ${topic.file} with its entries`) },
    { route: { view: "entry", uuid: entry.uuid }, check: (n) => need(h1(n).includes(entry.title) && (n === "a" ? text(n).includes(REMOTE_TITLE) : text(n).includes(`not resolved: ${NO_EXPORTS}`)),
      n === "a" ? "the entry, and its See into another repository resolved from that repository's export" : "the entry, and its See into another repository not resolved, with the reason") },
    { route: { view: "search", scope: "project", q: "snapshot" }, check: (n) => need(/snapshot/.test(h1(n)) && q(n, ".ktw-sr, .ktw-sgroup").length > 0
      && (n === "a") === [...q(n, "a[href]")].some((a) => a.getAttribute("href").includes("/search/family/")), n === "a" ? "hits, and the family scope offered" : "hits, and no family scope: it needs exportState") },
    { route: { view: "thought", refs: CH }, check: (n) => need(/in 3 entries/.test(h1(n)) && q(n, ".ktw-thought-step").length === 3 && CH.every((u) => text(n).includes(S.entries.find((e) => e.uuid === u).title)) && !q(n, ".ktw-thought-step.ktw-missing").length,
      "the thought's three entries in order") },
    { route: { view: "ref", canonical: REMOTE, uuid: REMOTE_UUID }, check: (n) => n === "a"
      ? need(window.KTW_HOSTS.a.nav.current().centre?.canonical === REMOTE && text(n).includes(REMOTE_TITLE), "the reference resolved: the host sent to the remote entry, its title read from the export")
      : need(text(n).includes(`Cannot open ${REMOTE_UUID}`) && text(n).includes(NO_EXPORTS), "the reference not resolved, with the reason") },
  ];
  // go to a place and wait (up to 4 s) for what it must show; null, or what is still missing
  window.KTW_HOST_SETTLE = async (n, place) => {
    window.KTW_HOSTS[n].go(place.route);
    let miss = null;
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 100)); miss = place.check(n); if (!miss) return null; }
    return miss;
  };
  document.documentElement.dataset.ready = "1";
  log("ready");
})().catch((e) => { (window.KTW_HOST_ERRORS ||= []).push(`setup: ${e.message}`); document.documentElement.dataset.ready = "failed"; });
