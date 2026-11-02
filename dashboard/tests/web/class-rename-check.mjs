// One-off check for the ktw-* class rename: the DOM snapshots may change only in their class attributes and,
// where a view sets a colour inline, in the token its style attribute names (var(--fg2) is now
// var(--ktw-fg2, #a2a2ad)); the canvas traces only in the class names their section headings quote.
//
// Reads every snapshot in snapshots/ (and every trace in canvas-snapshots/) as it is at a Git ref (the base the rename started from) and as it is
// in the working tree, takes the "ktw-" prefix off every class token in the new one, and compares them
// byte for byte. Then lists, per snapshot, any class token under #main or #details that still has no
// "ktw-" prefix — names the rename missed, or host classes that are meant to stay (listed in the PR).
//
//   node class-rename-check.mjs REF        e.g. node class-rename-check.mjs upstream/main
//
// For the canvas traces it also reports, without normalising, in how many the draw calls themselves are
// byte-identical and in how many only the section headings changed.
//
// Exit 0 when every snapshot is identical after normalising; 1 otherwise. Unprefixed classes are
// reported, not counted as a failure.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIRS = ["snapshots", "canvas-snapshots"];
const ref = process.argv[2];
if (!ref) { console.error("usage: node class-rename-check.mjs REF"); process.exit(2); }

const top = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: HERE, encoding: "utf8" }).trim();
const git = (...a) => execFileSync("git", a, { cwd: top, encoding: "utf8", maxBuffer: 64 << 20 });
const rel = (d) => path.relative(top, path.join(HERE, d)).split(path.sep).join("/");
// names are "dir/file.txt"
const atRef = (name) => git("show", `${ref}:${path.posix.join(rel(path.dirname(name)), path.basename(name))}`);
const before = DIRS.flatMap((d) => git("ls-tree", "--name-only", `${ref}:${rel(d)}`).split("\n").filter((n) => n.endsWith(".txt")).map((n) => `${d}/${n}`));
const after = DIRS.flatMap((d) => fs.readdirSync(path.join(HERE, d)).filter((n) => n.endsWith(".txt")).sort().map((n) => `${d}/${n}`));

// a snapshot line is `<tag attr="..." ...>`, attribute values JSON-quoted; only class="..." is touched
const CLASS = /(\sclass=)("(?:[^"\\]|\\.)*")/g;
// the views' token for each dashboard variable (ktw-views.css, docs/dashboard-views.md), read backwards
const TOKEN_OF = { bg: "bg", bg2: "surface", bg3: "surface2", line: "line", fg: "fg", fg2: "fg2", fg3: "fg3", accent: "accent", accent2: "accent2",
  ok: "ok", warn: "warn", bad: "bad", info: "info", muted: "muted", confirmed: "confirmed", inferred: "inferred", unknown: "unknown",
  active: "status-active", superseded: "status-superseded", open: "status-open", "needs-review": "status-needs-review",
  "pending-confirmation": "status-pending-confirmation", radius: "radius", font: "font", mono: "mono" };
const VAR_OF = Object.fromEntries(Object.entries(TOKEN_OF).map(([v, t]) => [`ktw-${t}`, v]));
const STYLE = /(\sstyle=)("(?:[^"\\]|\\.)*")/g;
const untoken = (css) => css.replace(/var\(--(ktw-[\w-]+), [^()]*\)/g, (m, t) => (VAR_OF[t] ? `var(--${VAR_OF[t]})` : m));
const unprefix = (list) => list.split(" ").map((c) => c.replace(/^ktw-/, "")).join(" ");
// a trace's section heading names the canvas's parent by its classes: "## canvas 2 — mini ktw-tall"
const HEADING = /^(## canvas \d+ — )(.*)$/;
const stripClass = (line) => line.replace(CLASS, (_, k, v) => k + JSON.stringify(unprefix(JSON.parse(v)))).replace(HEADING, (_, h, c) => h + unprefix(c));
const strip = (line) => stripClass(line).replace(STYLE, (_, k, v) => k + JSON.stringify(untoken(JSON.parse(v))));

let bad = 0, same = 0, drawSame = 0, headingsOnly = 0;
let classLines = 0, styleLines = 0, styleFiles = new Set(); // lines that differ in class only, in a style token (with or without a class)
const missing = before.filter((n) => !after.includes(n)), added = after.filter((n) => !before.includes(n));
for (const n of missing) { console.log(`MISSING  ${n}`); bad++; }
for (const n of added) { console.log(`ADDED    ${n}`); bad++; }

const leftovers = new Map();
for (const name of after.filter((n) => before.includes(n))) {
  const old = atRef(name).split("\n");
  const now = fs.readFileSync(path.join(HERE, name), "utf8").split("\n");
  const first = now.findIndex((l, i) => strip(l) !== old[i]);
  if (first !== -1 || now.length !== old.length) {
    const i = first === -1 ? Math.min(now.length, old.length) : first;
    console.log(`DIFFERS  ${name}:${i + 1}\n  was: ${old[i] ?? "(end)"}\n  now: ${now[i] ?? "(end)"}`);
    bad++;
  } else {
    console.log(`same     ${name}`); same++;
    now.forEach((l, i) => { if (l === old[i]) return; if (stripClass(l) === old[i]) classLines++; else { styleLines++; styleFiles.add(name); } });
  }
  if (name.startsWith("canvas-snapshots/")) {
    // the draw calls on their own, compared raw: every line that is not a section heading
    const calls = (lines) => lines.filter((l) => !HEADING.test(l)).join("\n");
    if (calls(now) === calls(old)) drawSame++;
    if (now.some((l, i) => l !== old[i] && HEADING.test(l))) headingsOnly += calls(now) === calls(old) ? 1 : 0;
  }
  let inView = false;
  for (const l of now) {
    if (l.startsWith("## ")) { inView = l === "## #main" || l === "## #details"; continue; }
    if (!inView) continue;
    for (const [, , v] of l.matchAll(CLASS)) for (const c of JSON.parse(v).split(" ")) if (c && !c.startsWith("ktw-")) leftovers.set(c, (leftovers.get(c) || new Set()).add(name));
  }
}

const count = (d, list) => list.filter((n) => n.startsWith(d + "/")).length;
console.log(`\n${same}/${before.length} identical after taking "ktw-" off class tokens (${count("snapshots", before)} DOM snapshots, ${count("canvas-snapshots", before)} canvas traces)`);
console.log(`changed lines: ${classLines} in class attributes only; ${styleLines} also in a style attribute's token (${[...styleFiles].map((f) => path.basename(f, ".txt")).join(", ") || "none"})`);
const traces = count("canvas-snapshots", before);
console.log(`canvas traces: draw calls byte-identical in ${drawSame}/${traces}; ${headingsOnly}/${traces} differ, in their section headings only`);
if (leftovers.size) {
  console.log(`\nclasses under #main/#details without the prefix (${leftovers.size}):`);
  for (const [c, where] of [...leftovers].sort()) console.log(`  ${c.padEnd(24)} ${[...where].sort().join(" ")}`);
}
process.exit(bad ? 1 : 0);
