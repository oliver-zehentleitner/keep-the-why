// The page's app.js is an ES module in a browser: its top-level names belong to it alone, and it runs strict.
// jsdom runs no module scripts, so the tests run it as a classic script — wrapped in a strict function, so its
// names stay its own here too. A library file (ktw-*.js) that reached for one of them would work in a test
// with them global, and break in a browser; wrapped, it breaks in the test.
export function moduleAsClassic(html) {
  const open = '<script type="module">';
  const at = html.indexOf(open);
  if (at < 0) return html;
  const end = html.indexOf("</script>", at);
  const body = html.slice(at + open.length, end);
  return `${html.slice(0, at)}<script>(function () {\n"use strict";\n${body}\n})();${html.slice(end)}`;
}
