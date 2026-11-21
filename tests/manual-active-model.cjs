const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

let active = "revision", matches = [{ modelId: "1", revision: "revision", roomId: "r", panelId: "p", serial: "001", number: "2", name: "Model" }];
const modules = {
	"react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
	"next/navigation": { notFound: () => { throw new Error("not found"); } },
	"@/features/admin/UbahManualPage": { UbahManualPage: "manual" },
	"@/lib/session": { requireSuperAdmin: async () => {} },
	"@/lib/trialPublicModels": {
		searchTrialPanels: async (serial, exact) => { assert.equal(serial, "001"); assert.equal(exact, true); return matches; },
		listTrialModels: async () => [{ id: "1", activeRevision: active }],
		readTrialModel: async () => ({ rooms: [{ id: "r", name: "Room", matches: [{ id: "p", serial: "001" }] }] }),
	},
};
const moduleResult = { exports: {} };
runInNewContext(ts.transpileModule(readFileSync("src/app/admin/ubah-manual/location/page.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { module: moduleResult, exports: moduleResult.exports, require: (id) => modules[id] });
(async () => {
	const page = moduleResult.exports.default;
	const request = () => page({ searchParams: Promise.resolve({ barcode: " 001 " }) });
	let result = await request();
	assert.equal(result.props.initialModels[0].rooms[0].name, "Room");
	assert.equal(result.props.modelError, false);
	active = "another";
	result = await request();
	assert.equal(result.props.modelError, true, "a stale revision must not be shown");
	assert.equal(result.props.initialModels.length, 0);
	active = "revision";
	matches = [];
	result = await request();
	assert.equal(result.props.initialModels.length, 0);
	assert.equal(result.props.modelError, false);
	console.log("Manual active model lookup checks passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
