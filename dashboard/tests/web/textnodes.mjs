// The page's node structure against the branch a pull request targets. Two fixture pages — the base's and this
// head's (fixture/make_fixture.py --page) — are driven through the same places in jsdom, without words: every route
// snapshot.mjs takes, a thought, and the search's drop-down with hits and without. #main, #details and the shell
// are compared node for node: each element by its tag and the names of its attributes, each text node as a text
// node, an empty one marked. The snapshots hold what the page says, and collapse and trim text and leave the empty
// out; this holds where one text ends and the next begins, so a view that draws the same words in fewer or more
// text nodes than before fails here, while a reworded text (a snapshot's change) does not. An element a pull
// request adds on purpose is left out with its subtree (added-elements.mjs ADDED), as in the style checks.
//
//   node textnodes.mjs BASE HEAD
import { openPage, routesOf } from "./fixture-page.mjs";
import { ADDED } from "./added-elements.mjs";

const [basePage, headPage] = process.argv.slice(2);
if (!basePage || !headPage) { console.error("usage: node textnodes.mjs BASE HEAD"); process.exit(2); }

// a subtree as lines: an element as its tag and sorted attribute names, a text node as #text (#text "" when empty)
const added = (n) => ADDED.some((x) => n.matches(x.selector));
function nodes(node, depth = 0, out = []) {
  const pad = "  ".repeat(depth);
  for (const n of node.childNodes) {
    if (n.nodeType === 3) { out.push(pad + (n.data === "" ? '#text ""' : "#text")); continue; }
    if (n.nodeType !== 1 || added(n)) continue;
    const attrs = [...n.attributes].map((a) => a.name).sort();
    out.push(`${pad}<${n.localName}${attrs.length ? " " + attrs.join(" ") : ""}>`);
    nodes(n, depth + 1, out);
  }
  return out;
}
const AREAS = ["#main", "#details", "#sidebar", "#strip", "#project-title", "#search-results"];

// every place of one page: name -> lines
async function places(file) {
  const p = await openPage(file);
  const { doc, go, tick, state: S } = p;
  const out = new Map();
  const take = (name) => { for (const sel of AREAS) { const n = doc.querySelector(sel); out.set(`${name} ${sel}`, n ? nodes(n) : ["(missing)"]); } };
  for (const [name, hash] of routesOf(S)) { await go(hash); take(name); }
  // a thought reader: the first chain the thoughts page links to
  await go("#thoughts");
  const thought = doc.querySelector('#main a[href^="#thought/"]')?.getAttribute("href");
  if (thought) { await go(thought); take("thought"); }
  // the search's drop-down, with hits and without
  const input = doc.getElementById("search");
  for (const [name, q] of [["dropdown-hits", "snapshot"], ["dropdown-none", "zzzznotfoundzzzz"]]) {
    if (!input) break;
    await go("#overview");
    input.value = q; input.dispatchEvent(new p.window.Event("input")); await tick(300);
    take(name);
  }
  p.window.close();
  return { out, errors: p.errors, thought: !!thought };
}

const base = await places(basePage), head = await places(headPage);
const errors = [...base.errors.map((e) => "base: " + e), ...head.errors.map((e) => "head: " + e)];
if (!head.thought) errors.push("the thoughts page links no chain: the reader is not compared");
let same = 0;
for (const [key, want] of base.out) {
  const got = head.out.get(key);
  if (!got) { errors.push(`${key}: not on the head's page`); continue; }
  let i = 0; while (i < want.length && i < got.length && want[i] === got[i]) i++;
  if (i === want.length && i === got.length) { same++; continue; }
  errors.push(`${key}: differs at node ${i + 1}\n      base: ${want[i] ?? "(end)"}\n      head: ${got[i] ?? "(end)"}`);
}
console.log(`${base.out.size} areas compared node for node, ${same} the same`);
console.log("ERRORS:", errors.length); for (const e of errors) console.log("  " + e);
process.exit(errors.length ? 1 : 0);
