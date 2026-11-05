// Computed styles in Chromium, a page against a base page: every element on every route, at four viewport
// widths and in both themes, must come out of the cascade the same. The browser resolves var() and @media
// itself; this compares what it computed. Run by dashboard-package.yml on every pull request, the base being
// the fixture page built from the branch the pull request targets.
//
//   node computed-styles.mjs BASEPAGE PAGE
//
// Needs Playwright and its Chromium (npm install playwright && npx playwright install --with-deps chromium).
// Elements are paired by tag path, so a class renamed between the two pages does not count; a page whose
// element tree differs on a route is reported as such. Writes a summary to $GITHUB_STEP_SUMMARY when set.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { ADDED, PARENT_BOX } from "./added-elements.mjs";
import { recolourSites } from "./recolour-sites.mjs";

const [basePage, headPage] = process.argv.slice(2);
if (!headPage) { console.error("usage: node computed-styles.mjs BASEPAGE PAGE"); process.exit(2); }
const WIDTHS = [1400, 1000, 800, 500];
const NOW = Date.parse("2026-06-15T12:00:00Z");

// the page's clock and randomness held still, as snapshot.mjs holds them
const init = `(() => {
  const NOW = ${NOW}; const RealDate = Date;
  class FixedDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } }
  window.Date = FixedDate;
  let seed = 0x2f1c5b7e;
  Math.random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
})();`;

// in the page: every element's computed style (and its ::before/::after), as a hash per tag path; the full
// text for the paths asked for
// An element the pull request adds on purpose (added-elements.mjs) is left out, and not counted among its siblings.
// On its parent — the paths in `trim`; null: this page's own — the properties that resolve to the parent's box
// (PARENT_BOX) are left out too, the one thing an added child changes there.
const collect = ({ want, added, box, trim, sites }) => {
  const isAdded = (el) => added.some((sel) => el.closest(sel));
  // custom properties are inputs, not results: what they set shows in the properties that use them, and the
  // tokens' values are held equal by test_views.py
  const SKIP = /^(animation|transition|--)/;
  const pathOf = (el) => { const p = []; for (let n = el; n && n.localName !== "html"; n = n.parentElement) p.push(`${n.localName}:${n.parentElement ? [...n.parentElement.children].filter((c) => !isAdded(c)).indexOf(n) : 0}`); return p.reverse().join("/"); };
  const text = (cs) => { const v = []; for (let i = 0; i < cs.length; i++) if (!SKIP.test(cs[i])) v.push(`${cs[i]}: ${cs.getPropertyValue(cs[i])}`); return v; };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const out = {}, detail = {}, roles = {}, parents = [];
  const any = (list, f) => (list || []).some((s) => { try { return f(s); } catch { return false; } });
  const rolesOf = (el) => (sites ? [any(sites.text, (s) => el.closest(s)) && "text", any(sites.fill, (s) => el.matches(s)) && "fill", any(sites.fillBorder, (s) => el.matches(s)) && "fillBorder", any(sites.shimmer, (s) => el.matches(s)) && "shimmer"].filter(Boolean) : []);
  for (const el of document.body.querySelectorAll("*")) if (!isAdded(el) && [...el.children].some((c) => added.some((sel) => c.matches(sel)))) parents.push(pathOf(el));
  const trimmed = new Set(trim || parents);
  for (const el of document.body.querySelectorAll("*")) {
    if (isAdded(el)) continue;
    const p = pathOf(el);
    for (const pseudo of [null, "::before", "::after"]) {
      const cs = getComputedStyle(el, pseudo);
      if (pseudo && cs.content === "none") continue;
      const key = pseudo ? p + pseudo : p, v = text(cs).filter((d) => pseudo || !trimmed.has(p) || !box.includes(d.slice(0, d.indexOf(":"))));
      out[key] = fnv(v.join(";"));
      if (want.includes(key)) { detail[key] = v; roles[key] = rolesOf(el); }
    }
  }
  return { out, detail, roles, parents, counts: added.map((sel) => document.querySelectorAll(sel).length) };
};
const ADDED_SELECTORS = ADDED.map((x) => x.selector);
// colours a pull request changes on purpose, per role and theme (the theme the page shows). The roles are bound to
// the rules that read the new tokens (recolour-sites.mjs): an element changes a colour only in its role's
// properties, and only from a colour to one it may become. WCAG AA for text on accent (context/dashboard.md, "Text
// on accent is a pair of tokens"): text in the accent becomes --ktw-accent-text / --ktw-status-active-text
// (#a98cf5 in dark, #6234d9 in light); a solid accent under text becomes --ktw-accent-fill #7a52e6; the update
// hint's shimmer is built on the accent text with a readable band (#dcd0fb in dark, #3b1d99 in light)
const SITES = recolourSites();
const ACCENT = "rgb(131, 91, 236)", ACCENT2 = "rgb(169, 140, 245)", WHITE = "rgb(255, 255, 255)";
const FILL = "rgb(122, 82, 230)", TEXT = { dark: ACCENT2, light: "rgb(98, 52, 217)" }, SHINE = { dark: "rgb(220, 208, 251)", light: "rgb(59, 29, 153)" };
// the properties that take the text colour: the text itself and what follows it (currentColor), and SVG text
const TEXT_PROPS = /^(color|fill|caret-color|column-rule-color|outline-color|text-decoration-color|text-emphasis-color|-webkit-text-fill-color|-webkit-text-stroke-color)$/;
const BORDER_PROPS = /^border(-(top|right|bottom|left|block-start|block-end|inline-start|inline-end))?-color$/;
const RECOLOURED = {
  text: { props: TEXT_PROPS, dark: { [ACCENT]: [TEXT.dark] }, light: { [ACCENT]: [TEXT.light], [ACCENT2]: [TEXT.light] } },
  fill: { props: /^background-color$/, dark: { [ACCENT]: [FILL] }, light: { [ACCENT]: [FILL] } },
  fillBorder: { props: BORDER_PROPS, dark: { [ACCENT]: [FILL] }, light: { [ACCENT]: [FILL] } },
  shimmer: { props: /^background-image$/, dark: { [WHITE]: [SHINE.dark] }, light: { [ACCENT2]: [TEXT.light], [WHITE]: [SHINE.light] } },
};
const COLOUR = /rgba?\([^()]*\)/g;
const valueOf = (decls, prop) => { const d = decls.find((x) => x.startsWith(prop + ": ")); return d ? d.slice(prop.length + 2) : null; };
// is `got` what `lost` becomes, colour by colour, with only the recolourings `role` allows in `theme`?
function recoloured(role, theme, lost, got) {
  const a = lost.match(COLOUR) || [], b = got.match(COLOUR) || [];
  if (a.length !== b.length || lost.replace(COLOUR, "\0") !== got.replace(COLOUR, "\0")) return false;
  const map = RECOLOURED[role][theme];
  return a.every((c, i) => c === b[i] || (map[c] || []).includes(b[i])) && a.some((c, i) => c !== b[i]);
}
// an element whose every changed declaration is a recolouring its roles allow: a text role's border only where it
// is the text colour (currentColor) before and after
function onlyRecoloured(theme, roles, base, page) {
  const x = new Set(base), y = new Set(page);
  const lost = [...x].filter((v) => !y.has(v)), got = [...y].filter((v) => !x.has(v));
  if (!lost.length || lost.length !== got.length) return false;
  const prop = (d) => d.slice(0, d.indexOf(":"));
  const byProp = new Map(got.map((d) => [prop(d), d]));
  return lost.every((d) => {
    const p = prop(d), g = byProp.get(p);
    if (!g) return false;
    return roles.some((role) => {
      const r = RECOLOURED[role];
      const follows = role === "text" && BORDER_PROPS.test(p) && valueOf(base, p) === valueOf(base, "color") && valueOf(page, p) === valueOf(page, "color");
      return (r.props.test(p) || follows) && recoloured(role, theme, d, g);
    });
  });
}
const seen = ADDED.map(() => ({ base: 0, head: 0 }));

async function open(browser, file, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: "UTC", reducedMotion: "reduce" });
  await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("file://" + path.resolve(file));
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}

const browser = await chromium.launch();
const probe = await open(browser, headPage, 1400);
const routes = await probe.page.evaluate(() => {
  const S = window.__KTW_STATE__; const byTitle = (part) => S.entries.find((e) => e.title.includes(part));
  return ["#overview", "#graph", "#timeline", "#timeline/2026-04-15", "#authors", "#queues", "#findings", "#family", "#projects", "#friends", "#thoughts",
    ...S.topics.map((t) => `#topic/${t.file}`),
    ...["waits for the snapshot", "versioned snapshot", "retry three times", "capped at one megabyte", "stable code", "Temporary files", "Pasted"].map((t) => `#entry/${byTitle(t).uuid}`),
    "#search/self/snapshot"];
});
await probe.ctx.close();

let compared = 0, recolouredCount = 0; const diffs = []; const errors = [];
const runs = [...WIDTHS.map((w) => [w, "dark"]), [1400, "light"]];
for (const [width, theme] of runs) {
  const A = await open(browser, basePage, width), B = await open(browser, headPage, width);
  for (const P of [A, B]) await P.page.evaluate((t) => { if (t === "light") document.documentElement.dataset.theme = "light"; }, theme);
  for (const hash of routes) {
    for (const P of [A, B]) await P.page.evaluate((h) => { location.hash = h; }, hash);
    await Promise.all([A.page.waitForTimeout(700), B.page.waitForTimeout(700)]);
    const b = await B.page.evaluate(collect, { want: [], added: ADDED_SELECTORS, box: PARENT_BOX, trim: null });
    const a = await A.page.evaluate(collect, { want: [], added: ADDED_SELECTORS, box: PARENT_BOX, trim: b.parents });
    a.counts.forEach((n, i) => (seen[i].base += n)); b.counts.forEach((n, i) => (seen[i].head += n));
    const keys = new Set([...Object.keys(a.out), ...Object.keys(b.out)]);
    const bad = [...keys].filter((k) => a.out[k] !== b.out[k]);
    compared += keys.size;
    if (!bad.length) continue;
    const onlyOne = bad.filter((k) => !(k in a.out) || !(k in b.out));
    if (onlyOne.length) { diffs.push(`${theme} ${width}px ${hash}: the element trees differ (${onlyOne.length} paths in one page only, e.g. ${onlyOne[0]})`); continue; }
    const [da, db] = await Promise.all([A.page.evaluate(collect, { want: bad, added: ADDED_SELECTORS, box: PARENT_BOX, trim: b.parents, sites: SITES }), B.page.evaluate(collect, { want: bad, added: ADDED_SELECTORS, box: PARENT_BOX, trim: b.parents, sites: SITES })]);
    // the theme the page shows, not the run's name: with no stored choice the dashboard follows the browser's
    // colour scheme, which is light in a default context
    const shown = await B.page.evaluate(() => (document.documentElement.dataset.theme === "light" ? "light" : "dark"));
    const unexplained = bad.filter((k) => !onlyRecoloured(shown, db.roles[k] || [], da.detail[k] || [], db.detail[k] || []));
    recolouredCount += bad.length - unexplained.length;
    for (const k of unexplained.slice(0, 20)) {
      const x = new Set(da.detail[k] || []), y = new Set(db.detail[k] || []);
      const lost = [...x].filter((v) => !y.has(v)), got = [...y].filter((v) => !x.has(v));
      diffs.push(`${theme} ${width}px ${hash} ${k}\n    base: ${lost.join("; ") || "(same)"}\n    page: ${got.join("; ") || "(same)"}`);
    }
    if (unexplained.length > 20) diffs.push(`${theme} ${width}px ${hash}: ${unexplained.length - 20} more elements differ`);
  }
  for (const P of [A, B]) { errors.push(...P.errors.map((e) => `${theme} ${width}px: ${e}`)); await P.ctx.close(); }
}
await browser.close();
ADDED.forEach((x, i) => {
  if (!seen[i].head) diffs.push(`added-elements.mjs: "${x.selector}" matches nothing in the page — a stale entry`);
  if (seen[i].base) diffs.push(`added-elements.mjs: "${x.selector}" matches ${seen[i].base} elements in the base — not an addition`);
});

const line = `${routes.length} routes × ${runs.length} runs (${WIDTHS.join(", ")} px dark, 1400 px light): ${compared} element styles compared, ${diffs.length} differ, ${recolouredCount} recoloured on purpose (RECOLOURED); added on purpose (added-elements.mjs): ${ADDED.map((x, i) => `${x.selector} ×${seen[i].head}`).join(", ") || "none"}`;
for (const d of diffs.slice(0, 80)) console.log(d);
for (const e of errors) console.log("ERROR " + e);
console.log("\n" + line);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Computed styles against the base branch (Chromium)\n\n${line}${errors.length ? `, ${errors.length} page errors` : ""}\n\n` +
    (diffs.length ? "```\n" + diffs.slice(0, 80).join("\n") + "\n```\n" : ""));
}
process.exit(diffs.length || errors.length ? 1 : 0);
