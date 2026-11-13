const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

const models = [{ id: "1", name: "Active", activeRevision: "rev" }, { id: "2", name: "Inactive", activeRevision: null }];
let lookupFails = false, oldReads = 0;
const modules = {
	"react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
	"@/features/member/SearchPanelLocationPage": { SearchPanelLocationPage: "page" },
	"next/navigation": { notFound: () => { throw new Error("not found"); }, redirect: () => { throw new Error("redirect"); } },
	"@/lib/db": { getPpicAccess: async () => ({ role: "MEMBER", active: 1 }), canImportLby: async () => false },
	"@/lib/session": { ppicSession: async () => ({ user_id: "1" }), requireClickUpToken: async () => {} },
	"@/types/ppic": { hasPpicAdminAccess: () => false },
	"@/lib/panelLocationSnapshot": { getPanelLocation: async () => { oldReads++; return { projectName: "Old", panels: [] }; } },
	"@/lib/trialPublicModels": { listTrialModels: async () => models, searchTrialPanels: async () => { if (lookupFails) throw new Error("unavailable"); return []; }, readTrialModel: async () => ({ rooms: [{ id: "room", name: "Bedroom" }] }) },
};
const moduleResult = { exports: {} };
const source = ts.transpileModule(readFileSync("src/app/(member)/cari-lokasi/page.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
runInNewContext(source, { module: moduleResult, exports: moduleResult.exports, require: (id) => modules[id], console });
(async () => {
	const page = moduleResult.exports.default;
	const list = await page({ searchParams: Promise.resolve({}) });
	assert.equal(list.props.models.length, 1);
	const selected = await page({ searchParams: Promise.resolve({ model: "1" }) });
	assert.equal(selected.props.selectedModel.revision, "rev");
	assert.equal(selected.props.selectedModel.rooms[0].name, "Bedroom");
	await assert.rejects(page({ searchParams: Promise.resolve({ model: "2" }) }), /not found/);
	const absent = await page({ searchParams: Promise.resolve({ barcode: "001" }) });
	assert.match(absent.props.errorMessage, /model 3D aktif/);
	assert.equal(oldReads, 0, "no match must not silently load an old model");
	lookupFails = true;
	const failure = await page({ searchParams: Promise.resolve({ barcode: "001" }) });
	assert.match(failure.props.errorMessage, /belum dapat diperiksa/);
	assert.equal(oldReads, 0, "a lookup error must not silently load an old model");
	const old = await page({ searchParams: Promise.resolve({ barcode: "001", source: "old" }) });
	assert.equal(old.props.oldSource, true);
	assert.equal(oldReads, 1, "old models require an explicit choice");
	console.log("Cari lokasi active model list and selection checks passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
