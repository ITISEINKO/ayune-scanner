const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
const meta = { content: "#f7f6f2" };
let cleanup;
const document = {
	querySelector: () => meta,
	createElement: () => ({ style: {}, remove() {} }),
	body: { append() {} },
};
const moduleResult = { exports: {} };
runInNewContext(ts.transpileModule(readFileSync("src/components/themeColor.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
	module: moduleResult, exports: moduleResult.exports, document,
	getComputedStyle: (element) => ({ backgroundColor: element.style.backgroundColor }),
	require: (id) => id === "react" ? { useEffect: (effect) => { cleanup = effect(); } } : require(id),
});
moduleResult.exports.ThemeColor({ color: "rgb(30, 40, 20)" });
assert.equal(meta.content, "rgb(30, 40, 20)");
cleanup();
assert.equal(meta.content, "#f7f6f2");
moduleResult.exports.ThemeColor({ color: "rgb(240, 235, 225)" });
assert.equal(meta.content, "rgb(240, 235, 225)");
console.log("Page theme color and navigation cleanup checks passed");
