// The page's pure part for node tests: ktw-core.js is a classic script that puts its functions on
// globalThis.KeepTheWhy.core. It is run in this realm (not a fresh vm context: its arrays and objects
// would carry that context's prototypes, and deepStrictEqual compares those too) and the namespace
// handed out.
import fs from "node:fs";
import vm from "node:vm";

const file = new URL("../../ktw_dashboard/web/ktw-core.js", import.meta.url);
vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file.pathname });
export default globalThis.KeepTheWhy.core;
