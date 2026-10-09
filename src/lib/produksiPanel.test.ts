import assert from "node:assert/strict";
import {
	clickUpAuthUrl,
	clickUpHeaders,
	optionId,
	optionName,
	type ClickUpField,
} from "./clickup.ts";
import { ppicStatusPath, statusBarangScanOptions } from "./produksiPanel.ts";

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
