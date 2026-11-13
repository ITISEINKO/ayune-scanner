const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

let tasks = [];
let updated = null;
const modules = {
	"@/types/ppic": { hasPpicAdminAccess: () => false },
	"next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
	"@/lib/clickup": { clickUpHeaders: () => ({}) },
	"@/lib/db": { savePpicScanHistory: async () => {}, updatePpicComponentStatus: async () => {} },
	"@/lib/projectSerialCache": { projectSerialCache: async () => ({ complete: true, entries: {} }), rememberSerial: async () => {}, scanStatusOf: () => null, serialNumberOf: (task) => task.serial, updateCachedSerialStatus: async () => {} },
	"@/lib/produksiPanel": { CF_PANEL: { SERIAL_NUMBER: "serial", STATUS_BARANG_SCAN: "status" }, PANEL_LIST_ID: "list", STATUS_BARANG_SCAN: { BARANG_DITERIMA: "received" } },
	"@/lib/projectScope": { taskProjectScope: (task, parent) => task.parent === parent ? "MATCH" : task.parent ? "OTHER" : "INVALID" },
	"@/lib/projects": { getPanelProject: async () => ({ status: { status: "in progress" } }) },
	"@/lib/session": { clickUpToken: async () => "token", ppicSession: async () => ({ role: "MEMBER" }), requireFreshPpicStatusAccess: async () => "user", selectedProjectTaskId: async () => "selected" },
};
const result = { exports: {} };
const source = ts.transpileModule(readFileSync("src/app/api/panel/scan/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
runInNewContext(source, { module: result, exports: result.exports, require: (id) => modules[id], URLSearchParams, process, fetch: async (url, options) => {
	if (options.method === "POST") { updated = url; return { ok: true }; }
	return { ok: true, json: async () => ({ tasks, last_page: true }) };
} });
const scan = () => result.exports.POST({ json: async () => ({ serial_number: "15370040278", status: "BARANG_DITERIMA" }) });
(async () => {
	tasks = [{ id: "chosen", parent: "selected", serial: "15370040278" }, { id: "other", parent: "other", serial: "15370040278" }];
	assert.equal((await scan()).status, 200);
	assert.match(updated, /task\/chosen\/field/);
	updated = null;
	tasks[1].parent = "selected";
	assert.equal((await scan()).body.error, "DUPLICATE_SERIAL_NUMBER");
	assert.equal(updated, null);
	tasks[1].parent = null;
	assert.equal((await scan()).body.error, "INVALID_TASK_HIERARCHY");
	assert.equal(updated, null);
	console.log("Member duplicate serial scope checks passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
