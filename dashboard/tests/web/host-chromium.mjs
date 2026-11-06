// The views under two foreign hosts (tests/web/host/) in Chromium, under the page's Content-Security-Policy
// (default-src 'self', the policy Maity's hub pages answer with): served over HTTP from dashboard/, every place of
// both hosts opened. Fails on a policy violation, a page error, a place that does not show what it must
// (host.js's KTW_HOST_PLACES: its own content, the remote reference's async answer included), a graph or a
// timeline whose canvas stays blank, or a view that ignores the host's tokens — host A sets its own colours,
// host B none and must get the views' fallbacks.
//
//   node host-chromium.mjs          (needs Playwright's Chromium, as computed-styles.mjs does)
import { chromium } from "playwright";
import fs from "node:fs";
import { serve } from "./host.mjs";

const server = await serve();
const url = `http://127.0.0.1:${server.address().port}/tests/web/host/index.html`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
await page.goto(url);
await page.waitForFunction(() => document.documentElement.dataset.ready, null, { timeout: 30000 });
if ((await page.evaluate(() => document.documentElement.dataset.ready)) !== "1") errors.push("the host page did not start");

const places = await page.evaluate(() => window.KTW_HOST_PLACES.length);
let rendered = 0; const inked = [];
for (let i = 0; i < places; i++) {
  for (const name of ["a", "b"]) {
    const r = await page.evaluate(async ([n, i]) => {
      const place = window.KTW_HOST_PLACES[i];
      const miss = await window.KTW_HOST_SETTLE(n, place);
      if (miss || !place.canvas) return { view: place.route.view, miss };
      // a canvas with ink: the most non-blank pixels any canvas of the place has, once it has drawn (up to 3 s)
      let ink = 0;
      for (let t = 0; t < 30 && !ink; t++) {
        await new Promise((res) => setTimeout(res, 100));
        for (const c of window.KTW_HOSTS[n].main.querySelectorAll("canvas")) {
          if (!c.width || !c.height) continue;
          const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let k = 0;
          for (let p = 3; p < d.length; p += 4) if (d[p]) k++;
          ink = Math.max(ink, k);
        }
      }
      return { view: place.route.view, miss: ink ? null : "ink on its canvas", ink };
    }, [name, i]);
    if (r.miss) errors.push(`host ${name} ${r.view}: missing ${r.miss}`); else rendered++;
    if (r.ink) inked.push(`${name} ${r.view} ${r.ink}px`);
  }
}
// the tokens: a Status pill on the overview, in host A's colours and in the views' fallbacks under host B — the
// text in the status's text token, the border in the status colour
await page.evaluate(async () => { for (const n of ["a", "b"]) window.KTW_HOSTS[n].go({ view: "overview" }); await new Promise((r) => setTimeout(r, 300)); });
const colours = await page.evaluate(() => ["a", "b"].map((n) => {
  const pill = window.KTW_HOSTS[n].main.querySelector(".ktw-pill.ktw-status-active, .ktw-pill.ktw-status-open");
  const dot = window.KTW_HOSTS[n].main.querySelector(".ktw-stack i, .ktw-bar i");
  return { pill: pill && [pill.className, getComputedStyle(pill).color, getComputedStyle(pill).borderTopColor], dot: dot && getComputedStyle(dot).backgroundColor };
}));
const want = { a: { active: "rgb(156, 61, 34)", open: "rgb(42, 105, 148)" }, b: { active: "rgb(169, 140, 245)", open: "rgb(74, 163, 223)" } };
const wantBorder = { a: { active: "rgb(181, 73, 43)", open: "rgb(44, 110, 155)" }, b: { active: "rgb(131, 91, 236)", open: "rgb(74, 163, 223)" } };
["a", "b"].forEach((n, i) => {
  const c = colours[i];
  if (!c.pill) { errors.push(`host ${n}: no Status pill on the overview`); return; }
  const kind = /status-active/.test(c.pill[0]) ? "active" : "open";
  if (c.pill[1] !== want[n][kind]) errors.push(`host ${n}: a ${kind} pill's text is ${c.pill[1]}, the host's token says ${want[n][kind]}`);
  if (c.pill[2] !== wantBorder[n][kind]) errors.push(`host ${n}: a ${kind} pill's border is ${c.pill[2]}, the host's status colour is ${wantBorder[n][kind]}`);
  if (!c.dot || c.dot === "rgba(0, 0, 0, 0)") errors.push(`host ${n}: a bar or a stack has no colour (${c.dot}) — an inline style the policy dropped?`);
});
errors.push(...(await page.evaluate(() => window.KTW_HOST_ERRORS || [])));
await browser.close(); server.close();

const line = `${rendered}/${places * 2} places show what they must under two hosts in Chromium, under default-src 'self' (canvases with ink: ${inked.join(", ")}); ${errors.length} problems`;
for (const e of errors) console.log("  " + e);
console.log(line);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### The views under two foreign hosts (Chromium, CSP)\n\n${line}\n\n${errors.length ? "```\n" + errors.join("\n") + "\n```\n" : ""}`);
process.exit(errors.length ? 1 : 0);
