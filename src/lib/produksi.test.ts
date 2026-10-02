import assert from "node:assert/strict";
import {
	hasTaskRelation,
	optionId,
	optionName,
	type ClickUpField,
} from "./clickup.ts";
import {
	TAHAP_TO_STATUS,
	TAHAP_FLOW,
	TAHAP_KOMPLAIN,
	moveProduction,
	nextTahap,
	tahapById,
	tahapByName,
} from "./produksi.ts";

const dropdown: ClickUpField = {
	id: "dropdown",
	name: "Dropdown",
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
assert.equal(TAHAP_TO_STATUS["QC Material"], "qc");
assert.equal(TAHAP_TO_STATUS.Edging, "assembly");
assert.equal(TAHAP_TO_STATUS.Packing, "packing");
assert.equal(TAHAP_TO_STATUS.Pengiriman, "done");
assert.deepEqual(moveProduction(undefined, "advance"), {
	to: "Handover Produksi",
	progress: 5,
});
assert.deepEqual(moveProduction("QC Material", "advance"), {
	to: "Pelapisan Bahan",
	progress: 25,
});
assert.deepEqual(moveProduction("Packing", "advance"), {
	to: "Pengiriman",
	progress: 100,
});
assert.deepEqual(moveProduction("Komplain", "release_komplain", "Edging"), {
	to: "Edging",
	progress: 55,
});
assert.equal(tahapById(TAHAP_KOMPLAIN.id)?.name, "Komplain");
