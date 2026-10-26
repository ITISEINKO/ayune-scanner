const assert = require("node:assert/strict");
const { registerHooks } = require("node:module");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");
registerHooks({ resolve(specifier, context, next) {
	return next(specifier.startsWith("@/") ? pathToFileURL(resolve(__dirname, "../src", `${specifier.slice(2)}.ts`)).href : specifier, context);
} });
const { completedProjectReview } = require("../src/lib/completedProjectReview.ts");
const event = (id, scannedAt, userId = "kris") => ({ componentTaskId: id, projectTaskId: "project", scannedAt, userId, serialNumber: id, status: "BARANG_DITERIMA", taskName: id });
const dashboard = {
	project: { task_id: "project", name: "Project", custom_id: "AY-19880", startDate: "2026-10-10T00:00:00Z", dueDate: null, status: "complete" },
	completion: { completedAt: "2026-10-22T10:00:00Z", capturedAt: "2026-10-22T10:00:00Z", source: "completion", completedBy: { userId: "admin", name: "Admin Contoh" } },
	items: [{ id: "group", name: "Panels", components: [
		{ id: "one", serialNumber: "ONE", status: "BARANG_DITERIMA", history: [event("one", "2026-10-12 02:00:00"), event("one", "2026-10-13 02:00:00"), event("one", "invalid"), event("one", "2026-10-23 02:00:00", "future")] },
		{ id: "two", serialNumber: "TWO", status: "TERPASANG_DIGUNAKAN", history: [event("two", "2026-10-17 02:00:00", "other")] },
		{ id: "three", serialNumber: "THREE", status: "TERPASANG_DIGUNAKAN", history: [event("three", "2026-10-22 02:00:00")] },
		{ id: "four", serialNumber: "FOUR", status: "DALAM_PROSES_RETUR", history: [event("four", "2026-10-22 03:00:00")] },
		{ id: "document", serialNumber: null, status: null, history: [] },
		{ id: "removed", serialNumber: "REMOVED", status: "DIHAPUSKAN", history: [event("removed", "2026-10-11 02:00:00")] },
	] }, { id: "support", name: " HARDWARE  LIST ", components: [{ id: "support-item", serialNumber: "SUPPORT", status: "BARANG_DITERIMA", history: [event("support-item", "2026-10-11 02:00:00")] }] }],
	memberNames: { kris: "Krisdianto", other: "Member lain" },
};
const report = completedProjectReview(dashboard);
assert.equal(report.total, 4);
assert.equal(report.scanned, 4);
assert.equal(report.durationDays, 10);
assert.equal(report.startSource, "Scan pertama");
assert.deepEqual(report.timeline.map(({ label, at }) => [label, at]), [
	["Scan pertama", "2026-10-12 02:00:00"], ["50% terscan", "2026-10-17 02:00:00"],
	["100% terscan", "2026-10-22 03:00:00"], ["Project selesai", "2026-10-22T10:00:00.000Z"],
]);
assert.deepEqual(report.members, [{ userId: "kris", name: "Krisdianto", scans: 4 }, { userId: "other", name: "Member lain", scans: 1 }]);
assert.equal(report.counts.get("SEDANG_DIPACKING"), 0);
assert.equal(report.counts.get("TERPASANG_DIGUNAKAN"), 2);
const noHistory = structuredClone(dashboard);
for (const item of noHistory.items) for (const component of item.components) component.history = [];
const withoutHistory = completedProjectReview(noHistory);
assert.deepEqual(withoutHistory.timeline.map(({ label }) => label), ["Project selesai"], "do not invent progress milestones from final statuses");
assert.equal(withoutHistory.startSource, "Start date ClickUp");
assert.deepEqual(withoutHistory.members, []);
noHistory.project.startDate = null;
noHistory.completion.completedAt = null;
assert.equal(completedProjectReview(noHistory).durationDays, null);
noHistory.items = [];
assert.equal(completedProjectReview(noHistory).total, 0);
const jakarta = structuredClone(dashboard);
jakarta.items[0].components[0].history = [event("one", "2026-10-21T18:00:00Z")];
for (const component of jakarta.items[0].components.slice(1)) component.history = [];
assert.equal(completedProjectReview(jakarta).durationDays, 0, "calendar days use Jakarta, not UTC");
console.log("Completed review: unique-item milestones, repeat scans, final statuses, supporting/removed items, missing history/dates and Jakarta duration passed.");
