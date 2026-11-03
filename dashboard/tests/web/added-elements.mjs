// The elements a pull request adds to the page on purpose, for the two style checks that compare it with the
// branch it targets (cascade-check.mjs in jsdom, computed-styles.mjs in Chromium). Both pair elements by tag path.
// An element added shifts every path after it, so the trees would differ on every route. Each element named here
// is left out of the pairing, with its subtree, and the paths count its siblings as if it were not there. Its
// parent's box grows with it: in Chromium, only the properties that resolve to that box's size and position may
// differ on the parent (PARENT_BOX), nothing else.
//
// An entry names exactly the element added, by a selector no other element matches, with its reason. A check
// fails when an entry matches nothing in the page under test, or anything in the base: the list cannot go stale
// or hide more than it says. Entries go once the change is on the target branch.
export const ADDED = [
  { selector: "button.ktw-graph-corner-redraw", why: "redraw (#758): the graph's corner control, beside fit and reset" },
  { selector: '.ktw-mini-corner > button.ktw-mini-corner-btn[aria-label^="redraw the graph"]', why: "redraw (#758): the side pane graph's corner control, before fit and reset" },
];
export const PARENT_BOX = ["width", "inline-size", "left", "inset-inline-start"];
