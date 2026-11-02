// One-off check for inline styles set through the CSSOM (ui.el, style: …): the DOM snapshots may change only in how
// a style attribute is written — the browser's serialisation ("width: 12.5%; color: rgb(214, 111, 214);") where the
// markup had the text as given ("width:12.5%;color:#d66fd6") — never in what it declares.
//
// Reads every snapshot as it is at a Git ref and as it is in the working tree; in both, each style="…" becomes its
// declarations, in order: property and value trimmed, whitespace collapsed, a #hex colour as rgb(). Every line
// must then be identical. Prints how many lines differed only in that way.
//
//   node style-attr-check.mjs REF        e.g. node style-attr-check.mjs upstream/main
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ref = process.argv[2];
if (!ref) { console.error("usage: node style-attr-check.mjs REF"); process.exit(2); }
const top = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: HERE, encoding: "utf8" }).trim();
const git = (...a) => execFileSync("git", a, { cwd: top, encoding: "utf8", maxBuffer: 64 << 20 });
const rel = path.relative(top, path.join(HERE, "snapshots")).split(path.sep).join("/");
const before = git("ls-tree", "--name-only", `${ref}:${rel}`).split("\n").filter((n) => n.endsWith(".txt"));

const hex = (h) => { const x = h.length === 4 ? [...h.slice(1)].map((c) => c + c).join("") : h.slice(1, 7); return `rgb(${parseInt(x.slice(0, 2), 16)}, ${parseInt(x.slice(2, 4), 16)}, ${parseInt(x.slice(4, 6), 16)})`; };
const decls = (css) => {
  const out = []; let depth = 0, cur = "";
  for (const c of css) { if (c === "(") depth++; if (c === ")") depth--; if (c === ";" && !depth) { out.push(cur); cur = ""; } else cur += c; }
  out.push(cur);
  return out.map((d) => d.trim()).filter(Boolean).map((d) => {
    const i = d.indexOf(":");
    const prop = d.slice(0, i).trim().toLowerCase();
    const value = d.slice(i + 1).trim().replace(/\s+/g, " ").replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, hex);
    return `${prop}: ${value}`;
  }).join("; ");
};
const STYLE = /(\sstyle=)("(?:[^"\\]|\\.)*")/g;
const norm = (line) => line.replace(STYLE, (_, k, v) => k + JSON.stringify(decls(JSON.parse(v))));

let bad = 0, styleLines = 0;
const files = new Set();
for (const name of before) {
  const old = git("show", `${ref}:${rel}/${name}`).split("\n");
  const file = path.join(HERE, "snapshots", name);
  if (!fs.existsSync(file)) { console.log(`MISSING  ${name}`); bad++; continue; }
  const now = fs.readFileSync(file, "utf8").split("\n");
  if (now.length !== old.length) { console.log(`DIFFERS  ${name}: ${old.length} lines, now ${now.length}`); bad++; continue; }
  now.forEach((l, i) => {
    if (l === old[i]) return;
    if (norm(l) === norm(old[i])) { styleLines++; files.add(name); return; }
    console.log(`DIFFERS  ${name}:${i + 1}\n  was: ${old[i]}\n  now: ${l}`); bad++;
  });
}
console.log(`\n${before.length} snapshots compared: ${bad} lines differ beyond a style attribute's serialisation; ${styleLines} lines differ in it only (${[...files].map((f) => f.replace(/\.txt$/, "")).join(", ") || "none"})`);
process.exit(bad ? 1 : 0);
