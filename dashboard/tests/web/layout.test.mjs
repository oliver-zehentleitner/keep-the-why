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
const { LAYOUT, seedLayout, carryNode, reheatSeeded, reheatAfterBuild, placeShown, stepLayout } = globalThis.KeepTheWhy.core;

// a deterministic count sequence, so the family has uneven topics without randomness in the test either
const sizes = (n, total, k) => { const w = Array.from({ length: n }, (_, i) => 1 + ((i * k) % 7)); const sum = w.reduce((a, b) => a + b, 0); return w.map((x) => Math.max(1, Math.round((x / sum) * total))); };
// members: [topics, entries] each; the first is this project, at the origin as buildFamilyGraph places it
function family(members, { prev = {}, extra = 0 } = {}) {
  const nodes = [], links = [], index = {};
  const add = (n, at) => { const p = prev[n.id]; if (p) carryNode(n, p); else { n.x = at?.x; n.y = at?.y; n.vx = n.vy = 0; } index[n.id] = nodes.length; nodes.push(n); return nodes.length - 1; };
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
  const add = (n) => { const p = prev[n.id]; if (p) carryNode(n, p); else { n.x = n.y = undefined; n.vx = n.vy = 0; } n.unit = key; n.ext = true; index[n.id] = nodes.length; nodes.push(n); return nodes.length - 1; };
  const hub = add({ id: `f:${key}`, kind: "project", r: 15 }); const mine = [];
  sizes(nt, ne, 5).forEach((c, t) => {
    const ti = add({ id: `ft:${key}:${t}`, kind: "topic", r: 7 + Math.sqrt(c) * 2.4 }); links.push({ s: hub, t: ti, kind: "hub", len: 70 });
    for (let e = 0; e < c; e++) { const ei = add({ id: `fe:${key}:${t}:${e}`, kind: "entry", r: 4.2 }); links.push({ s: ei, t: ti, kind: "member", len: 40 }); mine.push(ei); }
  });
  for (let k = 0; k < 4; k++) { const from = index[`e:0:0:${k}`] ?? index[`e:0:${k}`]; if (from != null) links.push({ s: from, t: mine[k * 3], kind: "see", len: 170 }); } // cited from this project's first topic
  return g;
}
// a part linked to nothing: a topic with its entries and no project
function lone(g, prev = {}) {
  const { nodes, links, index } = g;
  const add = (n) => { const p = prev[n.id]; if (p) carryNode(n, p); else n.vx = n.vy = 0; index[n.id] = nodes.length; nodes.push(n); return nodes.length - 1; };
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
  const prev = Object.fromEntries(g.nodes.map((n) => [n.id, { x: n.x, y: n.y, seeded: n.seeded }]));
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

// the graph drawn before, as a rebuild reads it: each node by its id
const prevOf = (g, alpha) => ({ ...Object.fromEntries(g.nodes.map((n) => [n.id, n])), alpha });
const dayed = (g) => { g.nodes.forEach((n, i) => { if (n.kind === "entry") n.day = i % 30; }); return g; };

test("a node seeded while hidden keeps its turn through a rebuild, and is laid out when it is shown", { timeout: 180000 }, () => {
  let day = 10; const visible = (n) => n.kind !== "entry" || n.day <= day;
  const g = dayed(build({})); run(g, 2000, visible);
  const waiting = g.nodes.filter((n) => n.seeded && !visible(n)).map((n) => n.id);
  assert.ok(waiting.length > 200, "later days' entries wait");
  // a rebuild (a live update of the same states) while the day is in the past
  const h = dayed(build(prevOf(g, 0)));
  assert.deepEqual(h.nodes.filter((n) => n.seeded).map((n) => n.id), waiting, "the rebuild keeps who is still to be laid out");
  run(h, 2000, visible);
  const shown = new Map(h.nodes.filter(visible).map((n) => [n.id, [n.x, n.y]]));
  day = 11; const brought = h.nodes.filter((n) => n.seeded && visible(n));
  assert.ok(brought.length > 20 && placeShown(h, { visible }), "the next day brings them into view, to be laid out");
  run(h, 2000, visible);
  let jump = 0; for (const n of h.nodes) { const p = shown.get(n.id); if (p) jump = Math.max(jump, Math.hypot(n.x - p[0], n.y - p[1])); }
  assert.equal(jump, 0, "what was shown holds still");
  for (const n of brought) {
    assert.ok(!n.seeded, `${n.id} laid out`);
    const t = h.nodes[h.links.find((l) => l.kind === "member" && h.nodes[l.s] === n).t];
    assert.ok(Math.hypot(n.x - t.x, n.y - t.y) < 400, `${n.id} near its topic, not on a stale seed`);
  }
});

test("a rebuild while a placement is still running carries it on, and the nodes placed before still hold", { timeout: 180000 }, () => {
  const g = build({}); run(g);
  const placed = new Map(g.nodes.map((n) => [n.id, [n.x, n.y]]));
  // a friend comes in, and while it is being laid out, a live update arrives
  const h = build(prevOf(g, 0), 25); for (let i = 0; i < 30; i++) stepLayout(h);
  assert.ok(h.placing && h.nodes.some((n) => n.seeded), "the placement is under way");
  const k = build(prevOf(h, h.alpha), 25); // the same states again: nothing new, the pending nodes carried over
  assert.ok(k.placing && k.nodes.filter((n) => n.seeded).length === h.nodes.filter((n) => n.seeded).length, "the rebuild carries the pending placement");
  const { steps } = run(k);
  assert.ok(k.alpha === 0 && steps <= 450, `the pending nodes at rest in ${steps} steps`);
  assert.ok(k.nodes.every((n) => !n.seeded), "all laid out");
  let jump = 0; for (const n of k.nodes) { const p = placed.get(n.id); if (p) jump = Math.max(jump, Math.hypot(n.x - p[0], n.y - p[1])); }
  assert.equal(jump, 0, "the nodes placed before the friend came hold still through both rebuilds");
  const all = shape(k.nodes);
  assert.ok(all.far <= 4 * all.median, "nothing left far out");
});

// A project graph as assemble and addLinkedLayer give it: topics and entries with no hub of their own; once a neighbour
// comes in (`withSelf`), the project gets a hub at the centre (p:self) and its topics hang on it, beside a friend.
function projectGraph(prev = {}, { withSelf = false, owners = false } = {}) {
  const nodes = [], links = [], index = {};
  const add = (n, at) => { const p = prev[n.id]; if (p) carryNode(n, p); else { n.x = at?.x; n.y = at?.y; n.vx = n.vy = 0; if (at) n.seeded = true; } index[n.id] = nodes.length; nodes.push(n); return nodes.length - 1; };
  const per = sizes(30, 420, 4);
  per.forEach((c, t) => {
    const ti = add({ id: `t:${t}`, kind: "topic", r: 8 + Math.sqrt(c) * 3.2 });
    for (let e = 0; e < c; e++) links.push({ s: add({ id: `e:${t}:${e}`, kind: "entry", r: 4.2 }), t: ti, kind: "member", len: 46 });
    if (t) links.push({ s: ti, t: index[`t:${t - 1}`], kind: "topic", len: 170 });
  });
  const g = { nodes, links, index };
  if (withSelf) {
    const self = add({ id: "p:self", kind: "project", r: 15 }, { x: 0, y: 0 });
    per.forEach((c, t) => links.push({ s: self, t: index[`t:${t}`], kind: "hub", len: 90 }));
    friend(g, "f1", 5, 50, prev);
    if (owners) { // the self hub and the friend's share an owner
      const o = add({ id: "o:acme", kind: "owner", ext: true, unit: "o:acme", r: 17 }, { x: 0, y: 0 });
      nodes[self].owner = nodes[index["f:f1"]].owner = "o:acme";
      links.push({ s: o, t: self, kind: "owner", len: 190 }, { s: o, t: index["f:f1"], kind: "owner", len: 190 });
    }
  }
  seedLayout(nodes, links);
  return g;
}
const rebuildOf = (prevG, opts) => { const g = projectGraph(prevOf(prevG, prevG.alpha), opts); g.alpha = prevG.alpha; g.tree = prevG.tree; g.relayout = prevG.relayout; g.placing = prevG.placing; return reheatAfterBuild(g); };

test("a neighbour coming in on a settled project graph gives it its hub, and the graph is laid out anew around it", { timeout: 180000 }, () => {
  const g = reheatAfterBuild(Object.assign(projectGraph(), { alpha: 1 })); run(g);
  const h = rebuildOf(g, { withSelf: true });
  assert.ok(h.relayout && h.alpha === 1 && !h.placing, "the topics hang on a hub now: the shape changed, and the whole graph is laid out");
  run(h);
  const self = h.nodes[h.index["p:self"]], topics = h.nodes.filter((n) => n.kind === "topic" && !n.ext);
  const d = topics.map((t) => Math.hypot(t.x - self.x, t.y - self.y)).sort((a, b) => a - b);
  assert.ok(!self.seeded && h.alpha === 0, "laid out and at rest");
  assert.ok(d[d.length >> 1] < 400, `the hub's lines act: its topics around it (median ${Math.round(d[d.length >> 1])})`);
  const cx = topics.reduce((a, t) => a + t.x, 0) / topics.length, cy = topics.reduce((a, t) => a + t.y, 0) / topics.length;
  assert.ok(Math.hypot(self.x - cx, self.y - cy) < 150, "the hub stands among its topics, not frozen on one of them");
  // nothing new after that: the next rebuild moves nothing
  const k = rebuildOf(h, { withSelf: true });
  assert.ok(k.alpha === 0 && !k.relayout, "the same shape again: nothing to lay out");
});

test("owners switched on at rest regroup the projects; switched off, they let go", { timeout: 180000 }, () => {
  const g = reheatAfterBuild(Object.assign(projectGraph({}, { withSelf: true }), { alpha: 1 })); run(g);
  const on = rebuildOf(g, { withSelf: true, owners: true });
  assert.ok(on.relayout, "the projects hang on an owner now: laid out anew");
  run(on);
  const o = on.nodes[on.index["o:acme"]], self = on.nodes[on.index["p:self"]], fr = on.nodes[on.index["f:f1"]];
  const tie = (a) => Math.hypot(a.x - o.x, a.y - o.y);
  assert.ok(tie(self) < 400 && tie(fr) < 400, `both projects drawn to their owner (${Math.round(tie(self))}, ${Math.round(tie(fr))})`);
  const before = Math.hypot(g.nodes[g.index["f:f1"]].x - g.nodes[g.index["p:self"]].x, g.nodes[g.index["f:f1"]].y - g.nodes[g.index["p:self"]].y);
  assert.ok(Math.hypot(fr.x - self.x, fr.y - self.y) < before, "the two projects of one owner closer than as strangers");
  const off = rebuildOf(on, { withSelf: true });
  assert.ok(off.relayout, "let go of their owner: laid out anew");
});

test("a rebuild that only adds nodes does not reshape: the placed nodes hold", { timeout: 180000 }, () => {
  const g = reheatAfterBuild(Object.assign(projectGraph({}, { withSelf: true }), { alpha: 1 })); run(g);
  const placed = new Map(g.nodes.map((n) => [n.id, [n.x, n.y]]));
  const h = projectGraph(prevOf(g, 0), { withSelf: true }); friend(h, "f2", 3, 20, prevOf(g, 0)); seedLayout(h.nodes, h.links);
  Object.assign(h, { alpha: 0, tree: g.tree }); reheatAfterBuild(h);
  assert.ok(h.placing && !h.relayout, "only the new friend is laid out");
  run(h);
  let jump = 0; for (const n of h.nodes) { const p = placed.get(n.id); if (p) jump = Math.max(jump, Math.hypot(n.x - p[0], n.y - p[1])); }
  assert.equal(jump, 0);
});

test("a node shown during a relayout is laid out with the whole graph, not on its own", { timeout: 180000 }, () => {
  const g = reheatAfterBuild(Object.assign(projectGraph(), { alpha: 1 })); run(g);
  // the shape changes while an entry, seeded while hidden, comes into view
  const shownLate = g.nodes.find((n) => n.kind === "entry"); shownLate.seeded = true;
  const h = rebuildOf(g, { withSelf: true });
  assert.ok(h.relayout, "a relayout runs");
  assert.equal(placeShown(h), false, "placeShown leaves a running relayout alone");
  assert.ok(h.relayout && !h.placing, "the relayout goes on, every node free");
  const before = h.nodes.map((n) => [n.x, n.y]); stepLayout(h);
  const movedOld = h.nodes.filter((n, i) => !n.seeded && Math.hypot(n.x - before[i][0], n.y - before[i][1]) > 1e-9).length;
  assert.ok(movedOld > 100, `the nodes already laid out move with it (${movedOld})`);
  run(h);
  assert.ok(h.nodes.every((n) => !n.seeded) && h.alpha === 0, "and the late one is laid out with the rest");
});
