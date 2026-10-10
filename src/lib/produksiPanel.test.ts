import assert from "node:assert/strict";
import {
	clickUpAuthUrl,
	clickUpHeaders,
	optionId,
	optionName,
	type ClickUpField,
} from "./clickup.ts";
import { ppicStatusPath, statusBarangScanOptions } from "./produksiPanel.ts";
import { ppicStatuses } from "@/types/ppic";
import { taskProjectScope } from "./projectScope.ts";

const dropdown: ClickUpField = {
	id: "dropdown",
	name: "Dropdown",
	type_config: {
		options: [{ id: "pending-id", name: "Pending", orderindex: 0 }],
	},
};

assert.equal(optionName(dropdown, 0), "Pending");
assert.equal(optionId(dropdown, 0), "pending-id");
assert.deepEqual(clickUpHeaders("user-token"), { Authorization: "user-token" });

const authUrl = clickUpAuthUrl(
	"client-id",
	"http://localhost:3000/api/auth/clickup/callback",
	"state",
);
assert.equal(authUrl.searchParams.get("client_id"), "client-id");
assert.equal(statusBarangScanOptions.length, 9);
assert.equal(ppicStatusPath("BARANG_DITERIMA"), "/barang-diterima");
assert.equal(ppicStatusPath("SEDANG_DIPACKING"), "/sedang-dipacking");
assert.equal(ppicStatusPath("TERPASANG_DIGUNAKAN"), "/terpasang-digunakan");
assert.equal(ppicStatusPath("inactive"), "/scan-to-find");
assert.deepEqual(ppicStatuses("BARANG_DITERIMA"), ["BARANG_DITERIMA"]);
assert.deepEqual(
	ppicStatuses('["BARANG_DITERIMA","TERPASANG_DIGUNAKAN"]'),
	["BARANG_DITERIMA", "TERPASANG_DIGUNAKAN"],
);
assert.equal(
	taskProjectScope({ id: "serial", top_level_parent: "main", parent: "group" }, "main"),
	"MATCH",
);
assert.equal(taskProjectScope({ id: "serial", parent: "other" }, "main"), "INVALID");
assert.equal(
	taskProjectScope({ id: "serial", top_level_parent: "other", parent: "group" }, "main"),
	"OTHER",
);
