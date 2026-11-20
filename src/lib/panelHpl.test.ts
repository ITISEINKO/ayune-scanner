import assert from "node:assert/strict";
import { panelHpl } from "./panelHpl.ts";
import { CF_PANEL } from "./produksiPanel.ts";
import type { ClickUpTask } from "../types/clickup.ts";

const tasks: ClickUpTask[] = [
	{ id: "root", parent: null },
	{ id: "group", parent: "root", custom_fields: [{ id: CF_PANEL.KODE_HPL_SISI_1, value: " HPL-1 " }, { id: CF_PANEL.KODE_HPL_SISI_2, value: "HPL-2" }] },
	{ id: "leaf", parent: "group", custom_fields: [{ id: CF_PANEL.SERIAL_NUMBER, value: "001" }] },
];
assert.deepEqual(panelHpl(tasks, "001"), { serial: "001", side1: "HPL-1", side2: "HPL-2", status: "matched", source: "https://app.clickup.com/t/group" });
assert.equal(panelHpl([...tasks, { ...tasks[2], id: "duplicate" }], "001").status, "ambiguous");
assert.equal(panelHpl([...tasks, { id: "child", parent: "leaf" }], "001").status, "ambiguous");
assert.equal(panelHpl([tasks[2]], "001").status, "missing_parent");
assert.equal(panelHpl([tasks[2], { id: "group", custom_fields: [{ id: CF_PANEL.KODE_HPL_SISI_1, value: "only" }] }], "001").status, "partial");
assert.equal(panelHpl([tasks[2], { id: "group" }], "001").status, "missing_hpl");
assert.equal(panelHpl([tasks[0], tasks[1], { ...tasks[2], custom_fields: [...tasks[2].custom_fields!, { id: CF_PANEL.KODE_HPL_SISI_1, value: "other" }] }], "001").status, "conflict");
assert.equal(panelHpl(tasks, "002").status, "panel_not_found");
