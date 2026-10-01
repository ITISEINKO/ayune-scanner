import assert from "node:assert/strict";
import { hasTaskRelation, optionId, optionName, type ClickUpField } from "./clickup.ts";
import { STAGE_TO_STATUS, TAHAP_FLOW, TAHAP_KOMPLAIN, moveProduction, nextTahap, tahapById, tahapByName } from "./produksi.ts";

const dropdown: ClickUpField = {
	id: "qc",
	name: "QC Result",
	type_config: {
		options: [{ id: "pending-id", name: "Pending", orderindex: 0 }],
	},
};
assert.equal(optionName(dropdown, 0), "Pending");
assert.equal(optionName(dropdown, "pending-id"), "Pending");
assert.equal(optionId(dropdown, 0), "pending-id");
assert.equal(hasTaskRelation([{ id: "produksi-1" }], "produksi-1"), true);
assert.equal(hasTaskRelation([{ id: "produksi-1" }], "produksi-2"), false);
assert.equal(tahapById(TAHAP_FLOW[0].id)?.name, "Handover Produksi");
assert.equal(tahapByName("Persiapan Material")?.id, TAHAP_FLOW[1].id);
assert.equal(nextTahap(TAHAP_FLOW[0].id)?.name, "Persiapan Material");
assert.equal(nextTahap(TAHAP_FLOW.at(-1)?.id), null);
assert.equal(STAGE_TO_STATUS.Packing, "packing");
assert.equal(STAGE_TO_STATUS.Pengiriman, "completed");
assert.equal(moveProduction("QC Material", "qc", "Fail"), null);
assert.deepEqual(moveProduction("QC Material", "qc", "Pass"), {
	to: "Pelapisan Bahan",
	progress: 25,
	qcResult: "Pass",
});
assert.deepEqual(moveProduction("Packing", "advance"), {
	to: "Pengiriman",
	progress: 100,
});
assert.equal(moveProduction("QC Material", "advance"), null);
assert.deepEqual(moveProduction("Komplain", "release_komplain", undefined, "Edging"), {
	to: "Edging",
	progress: 55,
	qcResult: "Pending",
});
assert.equal(tahapById(TAHAP_KOMPLAIN.id)?.name, "Komplain");
