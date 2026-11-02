/* Two hosts on one page, neither of them the dashboard's: the views mounted without app.js, the way another host
   (Maity) mounts them. Each host has its own containers (with ktw-root, the aside with ktw-aside), its own
   navigation — paths under /<name>/why/, not the dashboard's hash — its own settings, and a provider that knows
   only the fixture's state. The library files are loaded from the manifest, in its order, as a vendoring host
   loads them. Served from dashboard/ (any static server), the page runs under the CSP in index.html.

   Each host renders one route at a time; window.KTW_HOSTS[name].go(route) moves it. host.mjs (jsdom) and
   computed-styles.mjs's host check (Chromium) drive it. */
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

  function makeHost(name, box) {
    const ROUTES = K.core.routes;
    const state = K.core.normalizeState(JSON.parse(JSON.stringify(raw)));
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
    // a provider that knows this one state and nothing beyond it
    const provider = () => ({
      state: async () => ({ state, url: "fixture/state.json" }),
      exportState: async (canonical, root = "") => ({ error: "this host loads no other repository", canonical, root }),
    });
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
      findEntry: () => null, bodies: async (st) => ({ state: st }), needFriends: () => {}, pick: () => false,
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
        else if (r.view === "timeline") timeline.view(main, r.day || null, { graph: () => graphOf(), bodies: async (st) => ({ state: st }), entryRow: (e) => pages.entryRow(e, H), renderBody: H.renderBody, render: () => render() });
        else if (r.view === "thoughts") thoughts.page(main, T);
        else if (r.view === "queues") pages.queuesPage(main, H);
        else if (r.view === "findings") pages.findings(main);
        else if (r.view === "authors") pages.authors(main, H);
        else if (r.view === "topic") pages.topic(main, r.file, H);
        else if (r.view === "entry") pages.entry(main, r.uuid, H);
        else if (r.view === "search") search.view(main, r.scope || "self", r.q || "");
        else if (r.view === "family") family.view(main);
        else if (r.view === "friends") family.friendsView(main, { graph: async () => ({ friends: [], nodes: [] }), units: () => [], color: () => "", load: () => {} });
        else pages.overview(main, H);
      } catch (e) { window.KTW_HOST_ERRORS.push(`${name} ${r.view}: ${e.message}`); }
    }
    render();
    return { nav, go: (route) => nav.go(route), main, aside, state };
  }

  window.KTW_HOSTS = {
    a: makeHost("a", document.getElementById("host-a")),
    b: makeHost("b", document.getElementById("host-b")),
  };
  document.documentElement.dataset.ready = "1";
  log("ready");
})().catch((e) => { (window.KTW_HOST_ERRORS ||= []).push(`setup: ${e.message}`); document.documentElement.dataset.ready = "failed"; });
