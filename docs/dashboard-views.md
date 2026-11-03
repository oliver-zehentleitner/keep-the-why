# Dashboard views

The dashboard's page is built from library files that another page can load and mount. The views read a project's `state.json` and render it. The host page supplies everything that touches the outside world. This page is for whoever writes such a host: the dashboard itself is one (`dashboard/ktw_dashboard/web/app.js`), Maity is the second, and `dashboard/tests/web/host/` is a third, a small one written as a fixture.

The views render; they never write. Nothing in them stores, posts or deletes anything, and nothing in them reaches the network except through the provider the host hands them.

## The files

All files live in `dashboard/ktw_dashboard/web/` and ship in the `keep-the-why-dashboard` wheel. `ktw-views.json` lists them in load order:

```json
{
  "api": 0,
  "state": 2,
  "scripts": ["ktw-core.js", "ktw-ui.js", "ktw-scene.js", "ktw-markdown.js", "ktw-graph.js",
              "ktw-timeline.js", "ktw-family.js", "ktw-search.js", "ktw-thoughts.js", "ktw-pages.js"],
  "styles": ["ktw-views.css"]
}
```

- **`api`** is the major version of what the files offer a host. It changes when a host would have to change.
- **`state`** is the `state.json` major the files read.
- **`scripts`** are classic scripts, not ES modules, so a page opened from `file://` can load them. Load them in this order, before your own code. Each adds one frozen object to `globalThis.KeepTheWhy`.
- **`styles`** style `.ktw-*` classes only and read `--ktw-*` custom properties only (see [Styles](#styles) and [Tokens](#tokens)).

Beside the manifest, `ktw-words.json` lists every key of the views' UI text with its English (see [words](#words)).

| File | On `KeepTheWhy` | What it is |
|---|---|---|
| `ktw-core.js` | `core` | Pure functions: state normalisation, routes, filters, the graph's layout steps, the timeline's arithmetic, export verdicts, the token defaults. No DOM. |
| `ktw-ui.js` | `ui` | DOM helpers every view uses: `el`, `setKids`, the pills, a Type's glyph, `navLinks(nav)`. |
| `ktw-scene.js` | `scene` | What every view on a page shares (below). |
| `ktw-markdown.js` | `markdown` | Entry bodies, titles and field values as DOM nodes. |
| `ktw-graph.js` | `views.graph` | The graph, the mini graph, legends, the path bar. |
| `ktw-timeline.js` | `views.timeline` | The timeline page: clock, bars, slider, stage, entry card. |
| `ktw-family.js` | `views.family` | The family tree, the members' states, friends, the Family and Friends pages. |
| `ktw-search.js` | `views.search` | The search page and the search box's drop-down. |
| `ktw-thoughts.js` | `views.thoughts` | The chains of linked entries: the list beside a graph, the Thoughts page, the reader. |
| `ktw-pages.js` | `views.pages` | The overview, queues, findings, authors, topic and entry pages, an entry's row, the details pane. |

### Frozen, shallowly, except the scene

Every object a file puts on `KeepTheWhy`, and every instance a view's `create()` returns, is passed through `Object.freeze` once. The freeze is shallow. A host cannot replace `KeepTheWhy.core.routes` or add a method to a view instance. The objects those properties hold, such as a view's caches, are live and change as the page runs. Treat them as read-only.

The scene is the exception: `KeepTheWhy.scene.create()` returns a plain object, not frozen, because the host writes to it.

- **Assigned by the host:** `state` and `self` when a new state arrives (`state` is what the views show, the family merged in or not; `self` is the project's own), `selected` (the entry the details pane shows, by id) and `filter` (the sidebar's `{ status, evidence, author }`). No view listens for these; the host renders after it sets them.
- **Changed through a method only:** `day` (`setDay`), `focus` (`setFocus`), `thought` (`light`), `pin` (`setThought`), `scope` (`setScope`) and the layout (`resetLayout`, `layoutFor`). Views subscribe to these with `scene.on(event, fn)`. Assigning one directly changes the value without telling them.

### Rendering safety

Entry text is written by people and agents, so no file here turns a string into markup. `dashboard/tests/test_views.py` fails the build if a `ktw-*.js` file uses any of these:

- `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `createContextualFragment`, `DOMParser`
- `eval(`, `new Function`, a string timer
- an `html:` attribute, `style=` markup, or `setAttribute("style")`

A host vendoring the files can run the same check over its copy.

## Mounting the views

A page makes one scene, then one instance of each view it shows:

```js
const K = globalThis.KeepTheWhy;
const state = K.core.normalizeState(raw);                        // the project's state.json
const scene = K.scene.create({ state, self: state, scope: "project" });
const family = K.views.family.create({ scene, nav, provider, host: { mode, root } });
const search = K.views.search.create({ scene, nav, family, host: { registryPage, registryRows } });
const thoughts = K.views.thoughts.create({ scene, nav, prefs });
const pages = K.views.pages.create({ scene, nav, prefs, family, search });
const graph = K.views.graph.create({ scene, nav, prefs });
const timeline = K.views.timeline.create({ scene, nav, prefs });
```

Every `create` also takes `words`, the host's hook for the UI text in its own language (see [words](#words)). Without it, the views are in English.

A view renders into the element the host hands it: `pages.overview(main, H)`, `family.view(main)`, `search.view(main, scope, q)`, and so on. The lib has no page layout of its own. The dashboard's three columns (sidebar, main, details) are the dashboard's, and another host puts the views wherever its own layout has room.

**The host's duty:** every container a view renders into carries the class `ktw-root`, and a side pane also carries `ktw-aside`. The dashboard does this on `#main` and on `#details`:

```html
<main class="main ktw-root" id="main"></main>
<aside class="details ktw-root ktw-aside" id="details"></aside>
```

Without `ktw-root`, the views' headings, links and code spans take the host's element styles. Without `ktw-aside`, the side pane's graph, thoughts list and width switch lose their layout.

`dashboard/tests/web/host/` is a complete small host: two of them on one page, with their own containers, path-style navigation, settings and provider, loading the files from the manifest under a strict policy. Host A's provider has `state`, `bodies` and `exportState`, host B's `state()` alone. `host.js` lists every place with what it must show under each host. `host.mjs` drives it in jsdom, and `host-chromium.mjs` in Chromium under the policy.

### A graph the host builds

A graph is one object the host keeps across rebuilds (`{ nodes, links, index, alpha, … }`). The graph view runs it, and every rebuild starts from the graph drawn before. A rebuild goes like this:

1. **Build.** Build the nodes and links, or take them from `graph.assemble(topics, entries, prev)`, where `prev` maps the previous graph's nodes by id.
2. **Carry the old nodes.** Bring each node of the previous graph over with `KeepTheWhy.core.carryNode(n, prev[id])`. It keeps the node's place, whether it was held, and whether it was still to be laid out (`seeded`). `assemble` does this for its own nodes.
3. **Seed the new nodes.** Leave a new node's `x` and `y` unset and call `seedLayout(nodes, links)` once the links are in. `assemble` does this as well.
4. **Merge and reheat.** Merge the result into the kept graph object, then call `reheatAfterBuild(g)`. `assemble` does not do this step: it cannot see the kept object. The dashboard's `buildGraph` in `app.js` does this whole rebuild.

`reheatAfterBuild` applies the same rule to every rebuild. It compares what each node hangs on (`g.tree`) with the previous build:
- **A shape change.** A node already laid out now hangs on another node, or on none. Examples: a project tied to an owner or let go; topics gathered on their project's hub once a neighbour comes in. The whole graph is laid out again (`reheatAll`), and a rebuild that comes while that runs carries it on.
- **Additions only.** A rebuild that only adds nodes lays out those alone (`reheatSeeded`).
- **No change.** A rebuild that adds nothing moves nothing.

`seedLayout` places each new node deterministically:

- around the node it hangs on (an entry on its topic, a topic on its project, a member on its parent, a project on its owner), on a golden-angle spiral;
- without one, around a linked node of its own `unit`;
- linked to nothing placed, packed outside what is placed, so another unit (a friend, the path) sits apart.

While new nodes are placed, only they move (`stepLayout`), and the nodes already shown hold still. A node that comes into view later (the day, a lit thought, the entries switch) is laid out the same way. `placeShown` places it anew where it hangs now, and only it moves. The scene's layout, which the timeline's stage stands its cards on, copies the nodes each step laid out, and their final places once they are at rest.

The constants are `KeepTheWhy.core.LAYOUT`, each with its reason beside it in `ktw-core.js`:
- `MAX_STEP`: the most a node moves in one step.
- `REST`: the largest move under which a layout is at rest.
- `DECAY` and `MIN_ALPHA`: the cooling.
- `SEED_GAP` and `SEED_FILL`: how close seeding places its nodes.

With the graph's *motion* off, a graph not yet drawn settles before its first frame and is drawn once it is settled and framed. The dashboard's *redraw* control is a host's rebuild with no previous graph (`prev` empty), followed by `reheatAll` and a fit. In the side pane's neighbourhood it rebuilds the full graph that way, and the neighbourhood takes its `prev` from it. Seeding is deterministic, so it gives the layout a fresh load of the same data gives.

## Styles

Load three stylesheets, in this order:

1. **The host's element defaults** (`body`, `a`, `h1`…): the dashboard's are in `base.css`.
2. **`ktw-views.css`**.
3. **The host's own rules**: the dashboard's are in `style.css`.

The order is what keeps the cascade the same:

- A view's class rule wins a tie with a host's element default.
- A host's own rule wins a tie with a view's rule, so a host can adjust a view without `!important`.

`ktw-views.css` styles bare elements (headings, links, code, buttons) only inside `:where(.ktw-root)`. That adds no specificity, so these rules weigh what the host's `h1` or `a` would weigh. The root sets the font family and the text colour from the tokens. It leaves the size and the line height to the host.

### Content-Security-Policy

The views run under `default-src 'self'` (Maity's hub pages answer with it).

- **Inline styles:** they set every inline style (a dot's colour, a bar's width) through the element's style object. Such a policy drops a style attribute set as markup, but leaves the style object alone.
- **Markup:** they insert no `<style>` or `<script>` element and use no inline event handler.
- **Network:** they reach nothing outside the provider.

## The host interfaces

Only these cross the boundary between the views and the page around them.

### provider

Every request the views make goes through it. `provider()` returns an object whose methods return a promise of a result. Each result says where it came from: `url`, and for a project `canonical`, `root` and `forkOf` as they apply. A failure is an `error` field beside those, never a throw. `loaded` lists the files read to make the result and `failed` the files read and refused, for a host that shows what the page fetched.

| Method | Result | Required | Without it |
|---|---|---|---|
| `state()` | `{ state, url }`: the project shown | yes | — |
| `subscribe(onState, onStatus)` | calls `onState({ state, url })` on every change; returns the function that stops listening | no | not called by the views: the dashboard's page uses it for live updates |
| `bodies(state)` | `{ state, url }` with the state it was handed filled in place and `state.bodiesLoaded` set, or `{ state, url, error }` saying why not; a state with its bodies inline (no `bodies` field) needs no fetch | no | a lean state (`bodies` names a file) stays without its entry texts: `state.bodiesError` says so, the timeline's cards and the thought reader show no text, and a family or friends search says above its results which projects it searched without texts |
| `family({ project, tree })` | `{ members, url }`: the family a server knows | no | in live mode, the Family page lists no members and the family search scope covers the project alone |
| `memberState(key)` | `{ state, url, key }`: another project a server knows | no | a member's state is not read; it is listed under "Not searched" with the reason |
| `exportState(canonical, root)` | `{ state, url, canonical, root, raw, forkOf? }` or `{ error, … }`: a repository's published export | no | outside live mode the family and friends search scopes are not offered. The Family page lists the declared members with "published exports are not available on this page". A See or Superseded by into another repository shows "not resolved" with that reason, and so does its `ref` place. Friends that need an export are listed under "Not loaded" |
| `resolveEntry(uuid)` | `{ project, entry, url }`: which known project carries an Id | no | a reference into another repository is resolved from its published export only |
| `authorProfile(canonical, sha)` | `{ profile, url }`; `profile: null` where the host's API does not name the account | no | not called by the views: the dashboard's page uses it to link an author to the account |
| `backlinks(canonical)` | `{ file, url }`: who in the registry cites this repository; no file is an answer | no | not called by the views: the dashboard's page reads it for the Friends page's `cited()` hook |

A method left out hides the feature that needs it, or the feature says why it has nothing; it never makes the views throw or leave a promise rejected. `exportState` and `bodies` are wrapped: either one that rejects counts as an answer with an `error`. A `bodies` answer that leaves a lean state without `bodiesLoaded` marks its `bodiesError`, with the answer's `error` or, where it carries none, a generic one, so the views ask for the texts once and not on every render. The other methods are awaited as they are, so a host's `family` and `memberState` answer a failure with `{ error }` and do not reject. The dashboard's export, for example, has no `family`, `memberState` or `resolveEntry`, because those need the live server. The fixture host page (`dashboard/tests/web/host/`) runs one host with `state`, `bodies` and `exportState`, and one with `state()` alone.

### nav

The views name places as routes (`KeepTheWhy.core.routes`: `parse`, `format`, `PAGES`) and never touch the address bar.

| Member | Does |
|---|---|
| `href(route)` | the address for a route, used as a real anchor's `href` |
| `go(route, { replace })` | moves there; with `replace`, only records the route as where the page is, without showing it anew (the timeline keeps its day in the route this way) |
| `current()` | the route the page is on |
| `onChange(fn)` | calls `fn(route)` when that changes |
| `open(href)` | follows an address `href` made (a graph node carries its own) |

A route with a `centre` is a place in another project: a published export, or another project a server knows. The dashboard writes routes as a `#` hash, so its links and bookmarks keep working. The fixture host writes them as paths (`/a/why/topic/api.md`). A host maps routes onto its own addresses and never sees the dashboard's grammar. An anchor made with `ui.navLinks(nav)` is a real link (middle-click and a new tab work), and a plain click goes through `nav.go`.

### prefs

`{ get(key, fallback), set(key, value) }`: the settings a reader makes, as strings. The dashboard keeps them in `localStorage` as `ktw-<key>`, and another host keeps them wherever it likes. Storage that is blocked reads as the fallback.

| Key | Values | Read by |
|---|---|---|
| `labels` | the graph's name labels, on or off | graph |
| `motion` | the graph's drift, on or off | graph |
| `stage-arrange` | where a card stands on the stage | timeline |
| `stage-foreign` | which foreign entries the stage shows | timeline |
| `thought-min` | the shortest chain the thoughts list shows | thoughts |
| `friends`, `friend-families`, `friend-entries`, `friend-family-entries`, `family-entries`, `family-neighbours`, `owner-groups`, `entries` | the graph bar's layers | dashboard host |
| `path`, `path-show`, `path-entries` | the path bar | dashboard host |
| `scope`, `search-scope` | the scope switch, the search's scope | dashboard host |
| `theme`, `globe-intro` | the dashboard's own | dashboard only |

### words

`words: (key, params) => string | undefined`, optional on every `views.*.create`. Every UI text the views draw goes through it: headings, buttons, notes, titles, aria labels, the empty, loading and error lines. Each has a stable dotted key (`pages.queues.heading`, `search.none.project`), and `params` carries the counts and names in it.

- **The answer:** a string is used as it is. `undefined` means "not in my catalogue": the English is used, quietly. A throw or an answer that is not a string falls back to the English as well, with one `console.warn` per key, so a broken catalogue shows without flooding the console.
- **Placeholders**, in the host's text as in the English, are filled from `params`. `{name}` is the value. In the English, `{n:entry}` is a count with its noun ("3 entries") and `{n:match|matches}` gives both forms. A host's own text writes `{n}` and handles its own plural rules with the raw count in `params`.
- **Nodes inside a sentence:** a param that is a node, such as a link or a button, goes in where its placeholder stands (`"open it with {link}"`). Keep the placeholder in the translation, wherever the language puts it.
- **`ktw-words.json`** beside the manifest lists every key with its English. A host can check that its catalogue covers it. A test fails if a key in the code is missing from the file, or a key in the file is no longer in the code.
- **Not translated, on purpose:** the data's own words. That is the entry text (titles, bodies, field values), the spec's vocabulary (the values of Status, Evidence and Type, the field names `Id`, `Source`, `Verification`, `Revisit when`, `Superseded by`, `See`, and the body labels such as `Reason`), and names, files and dates. They read the same in every language because the entries are written with them.

The pieces of `ui` and `core` that make UI text outside a view take the view's words last and fall back to the English: `ui.forkPill(g, tw)`, `ui.headPill(g, tw)`, `ui.roleWord(tw, role)`, `core.kindLabel(kind, tw)`, `core.exportStateUrl(text, raw, tw)`, `core.exportVerdict(state, canonical, url, tw)` and `core.resolveSee(uuid, { known, published, tw })`. `ui.words(hook)` makes such a `tw`, and `ui.english` is the one without a hook.

### scene

`KeepTheWhy.scene.create({ state, self, day, scope })` returns what the views on one page share:

- the state shown, and the project's own (`self`);
- the day the clock stands at;
- the entry or thought in focus, and the held thought (`pin`);
- the sidebar's filter and the scope;
- the layout the graph has found.

A view reads the scene and changes it through its methods: `setDay`, `setFocus`, `light`, `setThought`, `spot`, `setScope`, `wake`, `resetLayout` and `layoutFor`. It hears changes through `on(event, fn)`, which returns an unsubscribe function. The events are `day`, `focus`, `thought`, `pin`, `spot`, `scope`, `wake` and `layout`. A page has one scene, made by the host.

### Host hooks

What only the page around a view can answer, it hands in. The pages, the thoughts and the timeline take their host object **with each call**, as the last argument. A link a page leaves behind therefore answers to the host that drew it, even with two hosts on one page.

- **`family.create({ …, host })`:**
  - `host.mode()` is `"live"`, `"export"` or `"public"`, the way the page was loaded;
  - `host.root()` is the root of the project shown inside its repository.
- **`family.friendsView(main, host)`:**
  - `graph()`: a promise of the graph of the scope;
  - `units(g)`: the friends grouped by family;
  - `color(i)`: a unit's colour;
  - `load(list)`: loads these friends;
  - `cited()` (optional): the registry's citations, `{ checked, ask }`.
- **`search.create({ …, host })`:**
  - `registryPage(main, q, { scopeBar })` renders the registry search into `main`;
  - `registryRows(q, { open, expand, run, close })` gives the drop-down its registry rows.

  Both are optional. Without them the search has no registry scope.
- **`pages.*(…, host)`:**
  - `live()`, `published()`, `project()`, `provider()`;
  - `inline(md, project)` and `renderBody(md, project)`: the Markdown, with the host's topic links;
  - `shareUrl(route, project)`: `{ url, where }`, the address to copy;
  - `details()`: the side pane;
  - `miniGraph(box, opts)`;
  - `entryThoughts(e)` and `thoughts`, the thoughts view;
  - `memberLink(m, href)`, `authorLink(name, commit, project)`, `authorProjects()`;
  - `friendsWaiting()`, `friendsLoading()`, `loadFriends(list)`;
  - `render()` and `rerender()`.
- **`thoughts.*(…, host)`:**
  - `graph()`, `light(g, t)`;
  - `follow: { busy, chain, all }`;
  - `findEntry(ref)`, `bodies(state)`, `needFriends()`, `pick(e)`;
  - `inline` and `renderBody`;
  - `listBox()` and `render()`.
- **`timeline.view(main, day, host)`:** `graph()` (the graph the stage stands on, built with `graph.assemble`), `bodies(state)`, `entryRow(e)`, `renderBody(md)`, `render()`.

Known behaviour a host should plan for:

- `search.attach({ input, box, within })` adds its listeners each time it is called. Call it once per input.
- `family.resetCentre()` resets the tree and the public tree, not the members' states it has fetched. A host that changes which project it shows without a reload keeps those caches.

## Tokens

The views read colours, fonts and the corner radius from `--ktw-*` custom properties. Each read has a fallback, so a host that sets none sees the dashboard's dark theme:

- in `ktw-views.css` as the `var()` fallback;
- for the canvas views, through `KeepTheWhy.core.TOKEN_DEFAULTS`.

To restyle the views, set the tokens on `:root` or on any ancestor of the views.

| Token | Fallback | What |
|---|---|---|
| `--ktw-bg` | `#1e1e22` | page ground |
| `--ktw-surface` | `#26262b` | card ground |
| `--ktw-surface2` | `#2f2f36` | inset ground, a hovered row |
| `--ktw-line` | `#3a3a43` | borders and rules |
| `--ktw-fg` | `#dcdce3` | text |
| `--ktw-fg2` | `#a2a2ad` | secondary text |
| `--ktw-fg3` | `#6f6f7a` | faint text, labels |
| `--ktw-accent` | `#835bec` | the accent |
| `--ktw-accent2` | `#a98cf5` | links |
| `--ktw-ok` | `#4fbf7a` | good |
| `--ktw-warn` | `#e0a83a` | warning |
| `--ktw-bad` | `#e0574f` | error |
| `--ktw-info` | `#4aa3df` | information |
| `--ktw-muted` | `#8b8b98` | an entry with no Evidence colour |
| `--ktw-confirmed` | `#4fbf7a` | Evidence: confirmed |
| `--ktw-inferred` | `#e0a83a` | Evidence: inferred |
| `--ktw-unknown` | `#e0574f` | Evidence: unknown |
| `--ktw-status-active` | `#835bec` | Status: active |
| `--ktw-status-superseded` | `#6f6f7a` | Status: superseded |
| `--ktw-status-open` | `#4aa3df` | Status: open |
| `--ktw-status-needs-review` | `#e0a83a` | Status: needs-review |
| `--ktw-status-pending-confirmation` | `#d66fd6` | Status: pending-confirmation |
| `--ktw-type-decision` | `#835bec` | Type: decision |
| `--ktw-type-constraint` | `#4aa3df` | Type: constraint |
| `--ktw-type-workaround` | `#e0a83a` | Type: workaround |
| `--ktw-type-incident` | `#e0574f` | Type: incident |
| `--ktw-palette-0` … `--ktw-palette-9` | `#835bec`, `#4aa3df`, `#4fbf7a`, `#e0a83a`, `#e0574f`, `#d66fd6`, `#3fbfbf`, `#b0b04a`, `#ff8c5a`, `#8b8b98` | authors, family members, friends, the path |
| `--ktw-radius` | `8px` | corners |
| `--ktw-font` | `-apple-system, "Segoe UI", Inter, Roboto, "Helvetica Neue", sans-serif` | text |
| `--ktw-mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | code, Ids |

The graph and the stage draw on a canvas and read their colours with `getComputedStyle`. Give the tokens literal colours, not `var()` chains, because some renderers (jsdom among them) do not resolve a chain there. The dashboard sets every token as a literal equal to its own variable, in both themes, and `test_views.py` holds them equal.
