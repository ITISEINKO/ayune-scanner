import assert from "node:assert/strict";
import { optionId, optionName, type ClickUpField } from "./clickup.ts";
import { TAHAP_FLOW, TAHAP_KOMPLAIN, moveProduction, nextTahap, tahapById } from "./produksi.ts";

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
assert.equal(tahapById(TAHAP_FLOW[0].id)?.name, "Handover Produksi");
assert.equal(nextTahap(TAHAP_FLOW[0].id)?.name, "Persiapan Material");
assert.equal(nextTahap(TAHAP_FLOW.at(-1)?.id), null);
assert.deepEqual(moveProduction("QC Material", "qc", "Fail"), {
	to: "Komplain",
	progress: 15,
	qcResult: "Fail",
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
