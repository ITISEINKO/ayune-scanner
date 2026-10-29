// Run: node tests/lby-import-search.cjs
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

const version = (name) => ({ name, revision: "v1", importedAt: "2026-10-29", panelCount: 1, roomCount: 1 });
const values = ["", [
	{ projectKey: "alpha", versions: [version("Kitchen")], activeRevision: "v1" },
	{ projectKey: "beta", versions: [version("Bedroom"), version("Old study")], activeRevision: "v1" },
	{ projectKey: "empty", versions: [] },
], "", "", null];
let cursor, tree, debounce, cleanup, scheduled, delay;
const jsx = (type, props, key) => ({ type, props, key });
const component = { exports: {} };
runInNewContext(ts.transpileModule(readFileSync("src/features/panel-location/LbyImportPage.tsx", "utf8"), {
	compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, {
	module: component, exports: component.exports, URLSearchParams,
	window: {
		setTimeout: (callback, ms) => { scheduled = callback; delay = ms; return callback; },
		clearTimeout: (callback) => { if (scheduled === callback) scheduled = null; },
	},
	require: (id) => {
		if (id === "react") return {
			useState: (initial) => {
				const index = cursor++;
				if (!(index in values)) values[index] = initial;
				return [values[index], (value) => { values[index] = value; }];
			},
			useRef: () => ({ current: null }),
			useEffect: (callback, dependencies) => { if (dependencies[0] === values[2]) debounce = callback; },
		};
		if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
		if (id === "@/components/ui/button") return { Button: "Button", buttonVariants: () => "" };
		return new Proxy({}, { get: (_, name) => name });
	},
});
function render() { cursor = 0; tree = component.exports.LbyImportPage({}); }
function nodes(node) {
	if (!node || typeof node !== "object") return [];
	return [node, ...[node.props?.children].flat(Infinity).flatMap((child) => nodes(child))];
}
function keys() { return nodes(tree).filter((node) => node.type === "article").map((node) => node.key); }
function type(query) {
	nodes(tree).find((node) => node.props?.["aria-label"] === "Cari model tersimpan").props.onChange({ target: { value: query } });
	render();
	cleanup?.();
	cleanup = debounce();
}
function flush() { const callback = scheduled; scheduled = null; callback(); render(); }

render();
assert.deepEqual(keys(), ["alpha", "beta"]);
type("kitchen");
assert.equal(delay, 250);
assert.deepEqual(keys(), ["alpha", "beta"], "results wait for debounce");
const stale = scheduled;
type("  BETA  ");
assert.notEqual(scheduled, stale, "new typing replaces the pending timer");
flush();
assert.deepEqual(keys(), ["beta"], "project key search ignores case and surrounding whitespace");
type("KITCHEN"); flush();
assert.deepEqual(keys(), ["alpha"], "model name search");
type("study"); flush();
assert.deepEqual(keys(), ["beta"], "previous version names remain searchable");
type("missing"); flush();
assert.deepEqual(keys(), []);
assert.ok(nodes(tree).some((node) => node.props?.children === "Tidak ada model yang cocok dengan pencarian."));
type(" "); flush();
assert.deepEqual(keys(), ["alpha", "beta"], "clearing search restores saved models");
type("pending"); cleanup();
assert.equal(scheduled, null, "cleanup cancels pending updates");
console.log("LBY search passed: debounce, cleanup, names, project keys, empty results and reset.");
