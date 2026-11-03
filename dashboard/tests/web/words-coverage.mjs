// Every UI text the views draw goes through the host's words (ktw-ui.js words): the foreign host page
// (tests/web/host/) with ?words=keys gives every view a hook that answers each key with ⟦key⟧, and every place of
// both hosts is drawn. Left in the views' DOM there may then be ⟦key⟧, the data — the fixture's own text (titles,
// bodies, files, names, dates, the spec's field names and values, which are the data's words) — and punctuation and
// numbers. A text node or a title, aria-label, placeholder or alt with anything else is English the views drew
// without the hook, and fails.
//
//   node words-coverage.mjs
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import { serve } from "./host.mjs";

// the data: every string in the fixture, and what the host page itself adds to it (host.js)
// (an object's keys too: the Config's keys are the project's own names)
const strings = (v, out = []) => { if (typeof v === "string") out.push(v); else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (!Array.isArray(v)) out.push(k); strings(x, out); } return out; };
const fixture = JSON.parse(fs.readFileSync(new URL("./fixture/state.json", import.meta.url), "utf8"));
const HOST_WORDS = ["Graph", "Elsewhere", "Remote ids are stable across exports", "https://github.com/acme/platform", "https://github.com/acme/remote", "acme/platform", "acme/remote",
  "fixture/state.json", "no published export at", "no published export at https://github.com/acme/platform", "not found", "0b6c1f0e-5a7d-4c39-9d2e-7f1a3b2c4d5e"];
// as the views show it: Markdown's marks dropped and runs of space one space (a search snippet, a rendered body)
const norm = (t) => t.replace(/\*\*|`|\*|_/g, "").replace(/\s+/g, " ");
const corpus = norm([...strings(fixture), ...HOST_WORDS].join("\u0000"));
// the spec's vocabulary: field names and the values of Status, Evidence and Type, shown as the data has them
// (in a field list as the field names, lowercase), and the hosts' names (ktw-core.js HOSTS, a mark's label)
const FIELDS = ["Id", "Type", "Status", "Evidence", "Source", "Verification", "Revisit when", "Superseded by", "See", "Date"];
const SPEC = new Set([...FIELDS, ...FIELDS.map((f) => f.toLowerCase()), "GitHub", "GitLab", "Codeberg", "Bitbucket", "Gitea",
  "active", "superseded", "open", "needs-review", "pending-confirmation", "confirmed", "inferred", "unknown", "corroborated", "uncorroborated", "contradicted",
  "decision", "constraint", "workaround", "incident"]);

const PLAIN = /^[\s\d\p{P}\p{S}]*$/u; // punctuation, symbols, digits, space: no words
// what is left of a text once the keys are out, in the pieces the views join data with (· and ,)
const trimmed = (t) => norm(t).replace(/⟦[^⟧]*⟧/g, "\u0000").split(/\u0000| · |, |: | → | — |\n/).map((x) => x.replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, "")).filter((x) => x && !PLAIN.test(x));
const isData = (x) => SPEC.has(x) || corpus.includes(x);

const server = await serve();
const url = `http://127.0.0.1:${server.address().port}/tests/web/host/index.html?words=keys`;
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("jsdom: " + (e.message || e)));
const dom = await JSDOM.fromURL(url, { runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    w.ResizeObserver = class { observe() {} disconnect() {} }; w.matchMedia = () => ({ matches: false });
    w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k === "measureText" ? () => ({ width: 10 }) : () => {}), set: () => true });
    w.fetch = (u, o) => fetch(new URL(String(u), url), o);
  } });
const w = dom.window, doc = w.document;
const tick = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 100 && !doc.documentElement.dataset.ready; i++) await tick(100);
const found = new Map(); // English → the places it was seen
let keys = 0;
if (doc.documentElement.dataset.ready !== "1") errors.push(`the page did not start: ${(w.KTW_HOST_ERRORS || []).join(" | ")}`);
else {
  for (const place of w.KTW_HOST_PLACES) for (const name of ["a", "b"]) {
    w.KTW_HOSTS[name].go(place.route); await tick(900);
    const where = `${name} ${place.route.view}`;
    for (const box of [w.KTW_HOSTS[name].main, w.KTW_HOSTS[name].aside]) {
      const texts = [];
      const walk = doc.createTreeWalker(box, w.NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) if (!n.parentElement.closest("style, script, .host-elsewhere, .host-elsewhere-title")) texts.push(n.textContent);
      for (const e of box.querySelectorAll("[title], [aria-label], [placeholder], [alt]")) for (const a of ["title", "aria-label", "placeholder", "alt"]) if (e.hasAttribute(a)) texts.push(e.getAttribute(a));
      for (const t of texts) {
        keys += (t.match(/⟦/g) || []).length;
        for (const x of trimmed(t)) if (!isData(x)) { if (!found.has(x)) found.set(x, new Set()); found.get(x).add(where); }
      }
    }
  }
  if (!keys) errors.push("no ⟦key⟧ in any place: the hook did not reach the views");
}
for (const [x, at] of found) errors.push(`English without the words hook: "${x.length > 120 ? x.slice(0, 120) + "…" : x}" (${[...at].join(", ")})`);
console.log(JSON.stringify({ keysDrawn: keys, english: found.size }));
console.log("ERRORS:", errors.length); for (const e of errors) console.log("  " + e);
server.close(); w.close();
process.exit(errors.length ? 1 : 0);
