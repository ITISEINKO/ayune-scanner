import assert from "node:assert/strict";
import {
	clickUpAuthUrl,
	clickUpHeaders,
	optionId,
	optionName,
	type ClickUpField,
} from "./clickup.ts";
import { ppicStatusPath, statusBarangScanOptions } from "./produksiPanel.ts";
import { ppicStatuses } from "../types/ppic.ts";
import { taskProjectScope } from "./projectScope.ts";
import { calendarDaysBetween, elapsedLabel, scanWindow } from "./projectTimeline.ts";

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
assert.equal(calendarDaysBetween("2026-10-02", "2026-10-05"), 3);
assert.equal(calendarDaysBetween(null, "2026-10-05"), null);
assert.equal(elapsedLabel("2026-10-03 08:00:00", "2026-10-03 12:00:00"), "4 jam");
const scans = [
	{
		userId: "member-2",
		serialNumber: "B",
		status: "SEDANG_DIPACKING" as const,
		taskName: "Panel Kiri",
		scannedAt: "2026-10-05 10:00:00",
		projectTaskId: "project",
		componentTaskId: "component",
	},
	{
		userId: "member-1",
		serialNumber: "B",
		status: "BARANG_DITERIMA" as const,
		taskName: "Panel Kiri",
		scannedAt: "2026-10-03 08:00:00",
		projectTaskId: "project",
		componentTaskId: "component",
	},
];
assert.equal(scanWindow(scans).first?.userId, "member-1");
assert.equal(scanWindow(scans).last?.userId, "member-2");
