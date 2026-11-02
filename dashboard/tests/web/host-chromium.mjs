// The views under two foreign hosts (tests/web/host/) in Chromium, under the page's Content-Security-Policy
// (default-src 'self', the policy Maity's hub pages answer with): served over HTTP from dashboard/, every place of
// both hosts opened. Fails on a policy violation, a page error, a place that renders nothing, or a view that
// ignores the host's tokens — host A sets its own colours, host B none and must get the views' fallbacks.
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

const places = await page.evaluate(() => {
  const S = window.KTW_HOSTS.a.state; const entry = S.entries.find((e) => e.uuid);
  return [{ view: "overview" }, { view: "graph" }, { view: "timeline" }, { view: "thoughts" }, { view: "queues" }, { view: "findings" }, { view: "authors" },
      { view: "family" }, { view: "friends" },
    { view: "topic", file: S.topics[0].file }, { view: "entry", uuid: entry.uuid }, { view: "search", scope: "self", q: "snapshot" }];
});
let rendered = 0;
for (const route of places) {
  for (const name of ["a", "b"]) {
    const ok = await page.evaluate(async ([n, r]) => { window.KTW_HOSTS[n].go(r); await new Promise((res) => setTimeout(res, 300)); return !!window.KTW_HOSTS[n].main.querySelector("h1"); }, [name, route]);
    if (ok) rendered++; else errors.push(`host ${name} ${route.view}: nothing rendered`);
  }
}
// the tokens: a Status pill on the overview, in host A's colour and in the views' fallback under host B
await page.evaluate(async () => { for (const n of ["a", "b"]) window.KTW_HOSTS[n].go({ view: "overview" }); await new Promise((r) => setTimeout(r, 300)); });
const colours = await page.evaluate(() => ["a", "b"].map((n) => {
  const pill = window.KTW_HOSTS[n].main.querySelector(".ktw-pill.ktw-status-active, .ktw-pill.ktw-status-open");
  const dot = window.KTW_HOSTS[n].main.querySelector(".ktw-stack i, .ktw-bar i");
  return { pill: pill && [pill.className, getComputedStyle(pill).color], dot: dot && getComputedStyle(dot).backgroundColor };
}));
const want = { a: { active: "rgb(181, 73, 43)", open: "rgb(44, 110, 155)" }, b: { active: "rgb(131, 91, 236)", open: "rgb(74, 163, 223)" } };
["a", "b"].forEach((n, i) => {
  const c = colours[i];
  if (!c.pill) { errors.push(`host ${n}: no Status pill on the overview`); return; }
  const kind = /status-active/.test(c.pill[0]) ? "active" : "open";
  if (c.pill[1] !== want[n][kind]) errors.push(`host ${n}: a ${kind} pill is ${c.pill[1]}, the host's token says ${want[n][kind]}`);
  if (!c.dot || c.dot === "rgba(0, 0, 0, 0)") errors.push(`host ${n}: a bar or a stack has no colour (${c.dot}) — an inline style the policy dropped?`);
});
errors.push(...(await page.evaluate(() => window.KTW_HOST_ERRORS || [])));
await browser.close(); server.close();

const line = `${rendered}/${places.length * 2} places rendered under two hosts in Chromium, under default-src 'self'; ${errors.length} problems`;
for (const e of errors) console.log("  " + e);
console.log(line);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### The views under two foreign hosts (Chromium, CSP)\n\n${line}\n\n${errors.length ? "```\n" + errors.join("\n") + "\n```\n" : ""}`);
process.exit(errors.length ? 1 : 0);
