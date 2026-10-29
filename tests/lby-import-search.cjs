// Run: node tests/lby-import-search.cjs
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

const version = (name) => ({ name, revision: "v1", versionNumber: 1, sampleBarcode: "panel-1", importedAt: "2026-10-29", panelCount: 1, roomCount: 1 });
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

const candidate = { ...version("Kitchen updated"), revision: "v2", versionNumber: 2 };
values[1][0].versions.unshift(candidate);
values[1][0].sourceUrl = "https://www.lbyerp.com/";
render();
const card = nodes(tree).find((node) => node.type === "article" && node.key === "alpha");
const cardNodes = nodes(card);

const preview = cardNodes.find((node) => node.type === "Button" && node.props.children === "Preview 3D");
const update = cardNodes.find((node) => node.type === "Button" && node.props.children === "Update model");
const details = cardNodes.find((node) => node.type === "details");
assert.ok(cardNodes.indexOf(preview) < cardNodes.indexOf(update));
assert.equal(details.props.open, undefined, "model cards stay collapsed by default");
assert.ok(cardNodes.some((node) => node.props?.children === "Salin link LBY"));
assert.ok(!cardNodes.some((node) => node.props?.target === "_blank"), "no popup links in import flow");
update.props.onClick();
render();
assert.equal(nodes(tree).find((node) => node.props?.id === "lby-share-url").props.value, values[1][0].sourceUrl);
console.log("LBY cards passed: compact disclosure, preview, history and update prefill.");
