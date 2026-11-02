// The views under two foreign hosts (tests/web/host/), in jsdom: served from dashboard/ over HTTP the way a host
// serves them, the library loaded from the manifest by the page itself. Every place each host offers shows what
// that place must show (host.js's KTW_HOST_PLACES), every link a view draws is the host's path (never the
// dashboard's #hash), moving one host leaves the other where it was, a route no place answers to is an error, and
// host B's provider — state() only — gets answers that say what is missing, never a rejection. jsdom does not enforce the page's CSP; computed-styles.mjs --host checks the page in Chromium.
//
//   node host.mjs
import { JSDOM, VirtualConsole } from "jsdom";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
// a static server over dashboard/: the host page, the fixture and the library files, nothing else
export function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/tests/web/host/index.html`;
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push("jsdom: " + (e.message || e)));
  vc.on("error", (...a) => errors.push("console: " + a.join(" ")));
  const dom = await JSDOM.fromURL(url, { runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.ResizeObserver = class { observe() {} disconnect() {} }; w.matchMedia = () => ({ matches: false });
      // jsdom draws nothing: a context that takes every call, as snapshot.mjs gives the page
      w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k === "measureText" ? () => ({ width: 10 }) : () => {}), set: () => true });
      w.fetch = (u, o) => fetch(new URL(String(u), url), o); // jsdom has none; same-origin requests only, as the page makes
    } });
  const w = dom.window, doc = w.document;
  const tick = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 100 && !doc.documentElement.dataset.ready; i++) await tick(100);
  if (doc.documentElement.dataset.ready !== "1") errors.push(`the page did not start: ${(w.KTW_HOST_ERRORS || []).join(" | ")}`);
  else {
    const H = w.KTW_HOSTS;
    const places = w.KTW_HOST_PLACES;
    let rendered = 0;
    for (const place of places) {
      const route = place.route;
      for (const name of ["a", "b"]) {
        const miss = await w.KTW_HOST_SETTLE(name, place);
        const main = H[name].main;
        if (miss) { errors.push(`host ${name} ${route.view}: missing ${miss}`); continue; }
        rendered++;
        for (const a of main.querySelectorAll("a[href]")) {
          const href = a.getAttribute("href");
          if (href.startsWith("#")) errors.push(`host ${name} ${route.view}: a link in the dashboard's hash grammar: ${href}`);
          else if (href.startsWith("/") && !href.startsWith(`/${name}/why/`)) errors.push(`host ${name} ${route.view}: a link into the other host: ${href}`);
        }
      }
    }
    // one host moved, the other stays where it was
    H.a.go({ view: "queues" }); H.b.go({ view: "authors" }); await tick(200);
    H.a.go({ view: "findings" }); await tick(200);
    if (H.b.nav.current().view !== "authors" || !/Authors/.test(H.b.main.querySelector("h1")?.textContent || "")) errors.push("moving host a moved host b");
    // a link a view draws moves its own host through that host's nav, not the page's address
    H.a.go({ view: "overview" }); await tick(200);
    const before = w.location.href;
    const link = [...H.a.main.querySelectorAll("a[href^='/a/why/topic/']")][0];
    if (!link) errors.push("host a: the overview links no topic");
    else { link.click(); await tick(200); if (H.a.nav.current().view !== "topic") errors.push("host a: a topic link did not move host a"); if (w.location.href !== before) errors.push("host a: a link changed the page's address"); }
    // a route no place answers to is reported, not shown as the overview
    const had = w.KTW_HOST_ERRORS.length;
    H.a.go({ view: "nowhere" }); await tick(50);
    if (w.KTW_HOST_ERRORS.length !== had + 1 || !/no place answers/.test(w.KTW_HOST_ERRORS[had] || "")) errors.push("host a: an unknown route was not reported");
    else w.KTW_HOST_ERRORS.pop();
    // host B's provider has state() only: the family's reads through it answer with the reason, never reject
    const reject = (what) => (e) => { errors.push(`host b: ${what} rejected: ${e?.message || e}`); return {}; };
    const pub = await H.b.family.publicState("https://github.com/acme/other", "").catch(reject("publicState"));
    if (pub.state || !/not available/.test(pub.error || "")) errors.push(`host b: publicState without exportState: ${JSON.stringify(pub)}`);
    const lean = { bodies: "bodies.json", entries: [] };
    const got = await H.b.family.bodies(lean).catch(reject("bodies"));
    if (got !== lean || !/not available/.test(lean.bodiesError || "")) errors.push(`host b: bodies without a provider method: ${JSON.stringify(lean)}`);
    if (H.b.family.canExports() || H.b.family.canBodies() || !H.a.family.canExports() || !H.a.family.canBodies()) errors.push("canExports / canBodies do not follow the providers");
    errors.push(...(w.KTW_HOST_ERRORS || []));
    console.log(`${rendered}/${places.length * 2} places rendered under two hosts`);
  }
  if (errors.length) { console.log("ERRORS:", errors.length); for (const e of errors) console.log("  " + e); } else console.log("ERRORS: 0");
  w.close(); server.close();
  process.exit(errors.length ? 1 : 0);
}
