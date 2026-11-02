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
const collect = (want) => {
  const SKIP = /^(animation|transition)/;
  const pathOf = (el) => { const p = []; for (let n = el; n && n.localName !== "html"; n = n.parentElement) p.push(`${n.localName}:${n.parentElement ? [...n.parentElement.children].indexOf(n) : 0}`); return p.reverse().join("/"); };
  const text = (cs) => { const v = []; for (let i = 0; i < cs.length; i++) if (!SKIP.test(cs[i])) v.push(`${cs[i]}: ${cs.getPropertyValue(cs[i])}`); return v; };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const out = {}, detail = {};
  for (const el of document.body.querySelectorAll("*")) {
    const p = pathOf(el);
    for (const pseudo of [null, "::before", "::after"]) {
      const cs = getComputedStyle(el, pseudo);
      if (pseudo && cs.content === "none") continue;
      const key = pseudo ? p + pseudo : p, v = text(cs);
      out[key] = fnv(v.join(";"));
      if (want.includes(key)) detail[key] = v;
    }
  }
  return { out, detail };
};

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

let compared = 0; const diffs = []; const errors = [];
const runs = [...WIDTHS.map((w) => [w, "dark"]), [1400, "light"]];
for (const [width, theme] of runs) {
  const A = await open(browser, basePage, width), B = await open(browser, headPage, width);
  for (const P of [A, B]) await P.page.evaluate((t) => { if (t === "light") document.documentElement.dataset.theme = "light"; }, theme);
  for (const hash of routes) {
    for (const P of [A, B]) await P.page.evaluate((h) => { location.hash = h; }, hash);
    await Promise.all([A.page.waitForTimeout(700), B.page.waitForTimeout(700)]);
    const [a, b] = await Promise.all([A.page.evaluate(collect, []), B.page.evaluate(collect, [])]);
    const keys = new Set([...Object.keys(a.out), ...Object.keys(b.out)]);
    const bad = [...keys].filter((k) => a.out[k] !== b.out[k]);
    compared += keys.size;
    if (!bad.length) continue;
    const onlyOne = bad.filter((k) => !(k in a.out) || !(k in b.out));
    if (onlyOne.length) { diffs.push(`${theme} ${width}px ${hash}: the element trees differ (${onlyOne.length} paths in one page only, e.g. ${onlyOne[0]})`); continue; }
    const [da, db] = await Promise.all([A.page.evaluate(collect, bad.slice(0, 20)), B.page.evaluate(collect, bad.slice(0, 20))]);
    for (const k of bad.slice(0, 20)) {
      const x = new Set(da.detail[k] || []), y = new Set(db.detail[k] || []);
      const lost = [...x].filter((v) => !y.has(v)), got = [...y].filter((v) => !x.has(v));
      diffs.push(`${theme} ${width}px ${hash} ${k}\n    base: ${lost.join("; ") || "(same)"}\n    page: ${got.join("; ") || "(same)"}`);
    }
    if (bad.length > 20) diffs.push(`${theme} ${width}px ${hash}: ${bad.length - 20} more elements differ`);
  }
  for (const P of [A, B]) { errors.push(...P.errors.map((e) => `${theme} ${width}px: ${e}`)); await P.ctx.close(); }
}
await browser.close();

const line = `${routes.length} routes × ${runs.length} runs (${WIDTHS.join(", ")} px dark, 1400 px light): ${compared} element styles compared, ${diffs.length} differ`;
for (const d of diffs.slice(0, 80)) console.log(d);
for (const e of errors) console.log("ERROR " + e);
console.log("\n" + line);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Computed styles against the base branch (Chromium)\n\n${line}${errors.length ? `, ${errors.length} page errors` : ""}\n\n` +
    (diffs.length ? "```\n" + diffs.slice(0, 80).join("\n") + "\n```\n" : ""));
}
process.exit(diffs.length || errors.length ? 1 : 0);
