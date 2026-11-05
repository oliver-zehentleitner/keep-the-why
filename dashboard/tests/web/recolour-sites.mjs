// Where the text-on-accent change recolours on purpose, read from the stylesheets as they ship (ktw-views.css and
// the dashboard's style.css), so the allowance is bound to the rules that read the new tokens and to nothing else.
// cascade-check.mjs and computed-styles.mjs accept a colour change only on these sites, in these roles; every
// other border, bar, outline and shadow stays under full comparison (context/dashboard.md, "Text on accent is a
// pair of tokens").
//
//   text:    a rule whose `color` or `fill` reads --ktw-accent-text / --ktw-status-active-text (or the dashboard's
//            --accent-text / --active-text): the element and what inherits its colour from it. Its own borders
//            only where they follow the text colour (currentColor).
//   fill:    a rule whose `background` reads --ktw-accent-fill (--accent-fill): its background, and its border
//            where the same rule sets `border-color` to the fill.
//   shimmer: a rule that draws its text with a gradient (`-webkit-text-fill-color: transparent`) built on
//            --accent-text: its background image.
import fs from "node:fs";

const W = new URL("../../ktw_dashboard/web/", import.meta.url).pathname;
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const RULE = /([^{}@]+)\{([^{}]*)\}/g;

function sitesOf(css) {
  const text = [], fill = [], fillBorder = [], shimmer = [];
  for (const m of strip(css).matchAll(RULE)) {
    const sels = m[1].split(/,(?![^()]*\))/).map((s) => s.trim()).filter((s) => s && !s.startsWith(":root") && !s.includes("::"));
    const body = m[2];
    const reads = (prop, tokens) => new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*var\\(--(?:${tokens})[,)]`).test(body);
    if (/-webkit-text-fill-color:\s*transparent/.test(body) && /var\(--(?:ktw-)?accent-text[,)]/.test(body)) shimmer.push(...sels);
    else if (reads("(?:color|fill)", "ktw-accent-text|ktw-status-active-text|accent-text|active-text|ktw-on-accent|on-accent")) text.push(...sels);
    if (reads("background(?:-color)?", "ktw-accent-fill|accent-fill")) { fill.push(...sels); if (reads("border-color", "ktw-accent-fill|accent-fill")) fillBorder.push(...sels); }
  }
  return { text, fill, fillBorder, shimmer };
}

// `states: false` leaves out the state pseudo-classes (:hover, :focus …), for a check that, like cascade-check,
// takes a state rule as matching
export function recolourSites({ states = true } = {}) {
  const a = sitesOf(fs.readFileSync(W + "ktw-views.css", "utf8")), b = sitesOf(fs.readFileSync(W + "style.css", "utf8"));
  const fix = (list) => (states ? list : list.map((s) => s.replace(/:(hover|focus|focus-visible|focus-within|active|visited)(?![\w-])/g, "")));
  return { text: fix([...a.text, ...b.text]), fill: fix([...a.fill, ...b.fill]), fillBorder: fix([...a.fillBorder, ...b.fillBorder]), shimmer: fix([...a.shimmer, ...b.shimmer]) };
}

// the roles an element has: text by inheritance (closest), fill and shimmer on the element itself
export function rolesOf(el, sites) {
  const any = (list, f) => list.some((s) => { try { return f(s); } catch { return false; } });
  const roles = [];
  if (any(sites.text, (s) => el.closest(s))) roles.push("text");
  if (any(sites.fill, (s) => el.matches(s))) roles.push("fill");
  if (any(sites.fillBorder, (s) => el.matches(s))) roles.push("fillBorder");
  if (any(sites.shimmer, (s) => el.matches(s))) roles.push("shimmer");
  return roles;
}
