// The graph's layout on a large family (ktw-core.js seedLayout, layoutTick, settleLayout): node --test, no
// canvas. The family is built in the shape app.js buildFamilyGraph and addLinkedLayer give it — project hubs,
// topics on spokes, entries on their topics, See lines inside and across members, a friend unit apart — with
// over a thousand entries, and measured: it settles within a bound of steps, no step moves a node further than
// LAYOUT.MAX_STEP, the whole stays in a bounded box with no node far out of the rest, the same input gives the
// same layout; a rebuild that adds a friend and a live update, and the clock stepping day by day, lay out only
// what they bring, and the nodes already shown do not move at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

vm.runInThisContext(fs.readFileSync(new URL("../../ktw_dashboard/web/ktw-core.js", import.meta.url), "utf8"));
const { LAYOUT, seedLayout, reheatSeeded, placeShown, stepLayout } = globalThis.KeepTheWhy.core;

// a deterministic count sequence, so the family has uneven topics without randomness in the test either
const sizes = (n, total, k) => { const w = Array.from({ length: n }, (_, i) => 1 + ((i * k) % 7)); const sum = w.reduce((a, b) => a + b, 0); return w.map((x) => Math.max(1, Math.round((x / sum) * total))); };
// members: [topics, entries] each; the first is this project, at the origin as buildFamilyGraph places it
function family(members, { prev = {}, extra = 0 } = {}) {
  const nodes = [], links = [], index = {};
  const add = (n, at) => { const p = prev[n.id]; if (p) Object.assign(n, { x: p.x, y: p.y }); else { n.x = at?.x; n.y = at?.y; } n.vx = n.vy = 0; index[n.id] = nodes.length; nodes.push(n); return nodes.length - 1; };
  const entriesOf = [];
  members.forEach(([nt, ne], m) => {
    const hub = add({ id: `p:${m}`, kind: "project", r: 15 }, m === 0 ? { x: 0, y: 0 } : null);
    const per = sizes(nt, ne, m + 3); const mine = [];
    if (m === 0) for (let k = 0; k < extra; k++) per[k % per.length]++; // a live update: new entries, appended to topics
    per.forEach((c, t) => {
      const ti = add({ id: `t:${m}:${t}`, kind: "topic", r: 8 + Math.sqrt(c) * 2.8 }); links.push({ s: hub, t: ti, kind: "hub", len: 80 });
      for (let e = 0; e < c; e++) { const ei = add({ id: `e:${m}:${t}:${e}`, kind: "entry", r: 4.2 }); links.push({ s: ei, t: ti, kind: "member", len: 42 }); mine.push(ei); }
      if (t) links.push({ s: ti, t: index[`t:${m}:${t - 1}`], kind: "topic", len: 150 });
    });
    for (let k = 0; k + 7 < mine.length; k += 9) links.push({ s: mine[k], t: mine[(k * 13 + 7) % mine.length], kind: "see", len: 170 });
    entriesOf.push(mine);
  });
  for (let m = 1; m < members.length; m++) links.push({ s: index[`p:${m}`], t: index[`p:${m === 1 ? 0 : 1}`], kind: "family", len: 260 });
  for (let m = 1; m < members.length; m++) for (let k = 0; k < 6; k++) links.push({ s: entriesOf[m][k * 5], t: entriesOf[0][k * 11], kind: "see", len: 170 });
  return { nodes, links, index };
}
// a friend unit, apart (unit, ext), as addLinkedLayer adds it: its hub, topics and entries, cited from this project
function friend(g, key, nt, ne, prev = {}) {
  const { nodes, links, index } = g;
  const add = (n) => { const p = prev[n.id]; if (p) Object.assign(n, { x: p.x, y: p.y }); else n.x = n.y = undefined; n.vx = n.vy = 0; n.unit = key; n.ext = true; index[n.id] = nodes.length; nodes.push(n); return nodes.length - 1; };
  const hub = add({ id: `f:${key}`, kind: "project", r: 15 }); const mine = [];
  sizes(nt, ne, 5).forEach((c, t) => {
    const ti = add({ id: `ft:${key}:${t}`, kind: "topic", r: 7 + Math.sqrt(c) * 2.4 }); links.push({ s: hub, t: ti, kind: "hub", len: 70 });
    for (let e = 0; e < c; e++) { const ei = add({ id: `fe:${key}:${t}:${e}`, kind: "entry", r: 4.2 }); links.push({ s: ei, t: ti, kind: "member", len: 40 }); mine.push(ei); }
  });
  for (let k = 0; k < 4; k++) links.push({ s: index[`e:0:0:${k}`], t: mine[k * 3], kind: "see", len: 170 });
  return g;
}
// a part linked to nothing: a topic with its entries and no project
function lone(g, prev = {}) {
  const { nodes, links, index } = g;
  const add = (n) => { const p = prev[n.id]; if (p) Object.assign(n, { x: p.x, y: p.y }); n.vx = n.vy = 0; index[n.id] = nodes.length; nodes.push(n); return nodes.length - 1; };
  const t = add({ id: "t:lone", kind: "topic", r: 14 });
  for (let e = 0; e < 12; e++) links.push({ s: add({ id: `e:lone:${e}`, kind: "entry", r: 4.2 }), t, kind: "member", len: 42 });
  return g;
}
const MEMBERS = [[40, 620], [22, 240], [12, 150]]; // 1010 entries over three members
const build = (prev, live = 0) => { const g = family(MEMBERS, { prev, extra: live }); friend(g, "f1", 6, 60, prev); friend(g, "f2", 3, 20, prev); if (live) friend(g, "f3", 4, 40, prev); lone(g, prev); seedLayout(g.nodes, g.links); return reheatSeeded(Object.assign(g, { alpha: prev.alpha ?? 1 })); };
// the page's steps (stepLayout) until settled, or `max`: how many, and the largest single move of a node
function run(g, max = 2000, visible = undefined) {
  let steps = 0, biggest = 0;
  while (g.alpha > LAYOUT.MIN_ALPHA && steps < max) {
    const before = g.nodes.map((n) => [n.x, n.y]);
    stepLayout(g, { visible }); steps++;
    g.nodes.forEach((n, i) => { biggest = Math.max(biggest, Math.hypot(n.x - before[i][0], n.y - before[i][1])); });
  }
  return { steps, biggest };
}
// the distances from the centroid: the median and the farthest, and the box
function shape(nodes) {
  const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length, cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
  const d = nodes.map((n) => Math.hypot(n.x - cx, n.y - cy)).sort((a, b) => a - b);
  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  return { median: d[d.length >> 1], far: d.at(-1), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
const own = (g) => g.nodes.filter((n) => !n.ext && !n.id.includes("lone"));

let settled = null; // the first test's layout, which the rebuild starts from
test("a family of a thousand entries settles: at rest within bounds, no step past the cap, nothing far out", { timeout: 120000 }, () => {
  const g = build({});
  assert.ok(g.nodes.length > 1100 && g.nodes.filter((n) => n.kind === "entry").length >= 1000, "the fixture is large");
  assert.ok(g.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)), "every node seeded");
  const seeded = shape(own(g));
  const { steps, biggest } = run(g);
  assert.equal(g.alpha, 0, "at rest, not cut off by the alpha floor or the bound");
  assert.ok(steps <= 450, `settled in ${steps} steps`);
  assert.ok(biggest <= LAYOUT.MAX_STEP + 1e-9, `no step moved a node more than LAYOUT.MAX_STEP (${biggest})`);
  assert.ok(g.nodes.every((n) => !n.seeded), "settled, the seeded nodes count as placed");
  const fam = shape(own(g)), all = shape(g.nodes);
  // it starts at its size, not tiny and not scattered: seeded under twice as wide as it comes to rest
  assert.ok(seeded.median < 2 * fam.median && seeded.median > fam.median, `seeded at ${Math.round(seeded.median)}, at rest ${Math.round(fam.median)}`);
  assert.ok(fam.far <= 2.5 * fam.median, `the family: no node past 2.5 × the median distance (${(fam.far / fam.median).toFixed(2)})`);
  // the friends keep their distance from the family by design (apart); still, nothing is left far out
  assert.ok(all.far <= 4 * all.median, `with the friends and the loose part: no node past 4 × the median (${(all.far / all.median).toFixed(2)})`);
  assert.ok(Math.max(all.w, all.h) <= 8 * all.median, `a bounded box: ${Math.round(all.w)} × ${Math.round(all.h)}`);
  settled = g;
});

test("the same input gives the same layout", { timeout: 120000 }, () => {
  const a = build({}), b = build({});
  assert.deepEqual(a.nodes.map((n) => [n.x, n.y]), b.nodes.map((n) => [n.x, n.y]), "seeded alike");
  run(a); run(b);
  assert.deepEqual(a.nodes.map((n) => [n.x, n.y]), b.nodes.map((n) => [n.x, n.y]), "settled alike");
});

test("a rebuild that brings a friend and a live update leaves the placed nodes where they are", { timeout: 120000 }, () => {
  const g = settled || (() => { const x = build({}); run(x); return x; })();
  const prev = Object.fromEntries(g.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  // nothing new: no node is laid out again, so nothing moves
  const same = build({ ...prev, alpha: 0 });
  assert.equal(same.alpha, 0, "a build that placed nothing leaves the layout at rest");
  // 25 new entries on this project's topics, and a third friend
  const h = build({ ...prev, alpha: 0 }, 25);
  const fresh = h.nodes.filter((n) => n.seeded);
  assert.deepEqual(fresh.map((n) => n.id), h.nodes.filter((n) => !prev[n.id]).map((n) => n.id), "the new nodes are seeded, and only they");
  assert.ok(fresh.length >= 25 + 1 + 4 + 30, `the live update and the friend: ${fresh.length} new nodes`);
  assert.equal(h.alpha, 1, "the new nodes are laid out at full strength");
  const { steps, biggest } = run(h);
  let jump = 0; for (const n of h.nodes) if (prev[n.id]) jump = Math.max(jump, Math.hypot(n.x - prev[n.id].x, n.y - prev[n.id].y));
  assert.equal(jump, 0, "the nodes already placed hold still");
  assert.ok(h.alpha === 0 && steps <= 450, `the new ones at rest in ${steps} steps`);
  assert.ok(biggest <= LAYOUT.MAX_STEP + 1e-9, "no step past the cap");
  const all = shape(h.nodes);
  for (const n of fresh) assert.ok(Math.hypot(n.x - (h.nodes.reduce((s, m) => s + m.x, 0) / h.nodes.length), n.y - (h.nodes.reduce((s, m) => s + m.y, 0) / h.nodes.length)) <= 4 * all.median, `${n.id} is not left far out`);
  // a new entry lands near its topic, not anywhere
  for (const n of fresh.filter((m) => m.id.startsWith("e:0:"))) {
    const t = h.nodes[h.index[`t:0:${n.id.split(":")[2]}`]];
    assert.ok(Math.hypot(n.x - t.x, n.y - t.y) < 400, `${n.id} near its topic (${Math.round(Math.hypot(n.x - t.x, n.y - t.y))})`);
  }
});

test("the clock stepping day by day lays out what each day brings, and the nodes already shown hold still", { timeout: 180000 }, () => {
  // each entry is shown from its own day on, as the clock shows it; the projects and topics are there from the start
  const g = build({});
  g.nodes.forEach((n, i) => { if (n.kind === "entry") n.day = i % 30; });
  let day = 10; const visible = (n) => n.kind !== "entry" || n.day <= day;
  run(g, 2000, visible);
  assert.ok(g.nodes.some((n) => n.seeded && !visible(n)), "the entries of later days wait, still to be laid out");
  for (day = 11; day <= 15; day++) {
    const before = new Map(g.nodes.filter(visible).filter((n) => !n.seeded).map((n) => [n, [n.x, n.y]]));
    const brought = g.nodes.filter((n) => n.seeded && visible(n));
    assert.ok(brought.length > 20 && placeShown(g, { visible }), `day ${day} brings entries into view`);
    const { steps, biggest } = run(g, 2000, visible);
    let jump = 0; for (const [n, [x, y]] of before) jump = Math.max(jump, Math.hypot(n.x - x, n.y - y));
    assert.equal(jump, 0, `day ${day}: the nodes already shown hold still`);
    assert.ok(g.alpha === 0 && steps <= 450 && biggest <= LAYOUT.MAX_STEP + 1e-9, `day ${day}: the new ones at rest in ${steps} steps, none past the cap`);
    for (const n of brought) { const t = g.nodes[g.links.find((l) => l.kind === "member" && g.nodes[l.s] === n)?.t]; if (t) assert.ok(Math.hypot(n.x - t.x, n.y - t.y) < 400, `${n.id} near its topic`); }
    assert.ok(brought.every((n) => !n.seeded), `day ${day}: what it brought counts as laid out`);
  }
  day = 15;
  assert.equal(placeShown(g, { visible }), false, "a day already laid out brings nothing to lay out");
});
