const assert = require("node:assert/strict");
const { registerHooks } = require("node:module");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");
registerHooks({ resolve(specifier, context, next) {
	return next(specifier.startsWith("@/") ? pathToFileURL(resolve(__dirname, "../src", `${specifier.slice(2)}.ts`)).href : specifier, context);
} });
const { completedProjectReview } = require("../src/lib/completedProjectReview.ts");
const { withCompletedProjectInsights } = require("../src/lib/completedProjectInsights.ts");
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

const received = "BARANG_DITERIMA", packed = "SEDANG_DIPACKING", installed = "TERPASANG_DIGUNAKAN", returned = "DALAM_PROSES_RETUR";
const component = (id, status, scans) => ({ id, name: id, serialNumber: id, status,
	history: scans.map(([at, status]) => ({ ...event(id, at), status })).reverse(),
});
const input = structuredClone(dashboard);
input.items = [
	{ id: "plywood", name: "Plywood", components: [
		component("a", installed, [
			["2026-10-12 00:00:00", received], ["2026-10-13 00:00:00", received],
			["2026-10-14 00:00:00", packed], ["2026-10-15 00:00:00", packed], ["2026-10-18 00:00:00", installed],
		]),
		component("b", installed, [
			["2026-10-12 00:00:00", received], ["2026-10-13 00:00:00", returned],
			["2026-10-14 00:00:00", packed], ["2026-10-15 00:00:00", returned],
			["2026-10-16 00:00:00", received], ["2026-10-17 00:00:00", packed], ["2026-10-19 00:00:00", installed],
		]),
		component("c", returned, []),
		component("d", received, [["2026-10-13 00:00:00", returned], ["2026-10-14 00:00:00", received]]),
		component("unknown", "OTHER", [["2026-10-13 00:00:00", returned]]),
		component("future", installed, [["invalid", returned], ["2026-10-23 00:00:00", returned]]),
		component("removed", "DIHAPUSKAN", [["2026-10-13 00:00:00", returned]]),
		{ ...component("no-serial", returned, []), serialNumber: " " },
	] },
	{ id: "hpl", name: "HPL", components: [component("e", packed, [["2026-10-13 00:00:00", returned], ["2026-10-14 00:00:00", received], ["2026-10-15 00:00:00", packed]])] },
	{ id: "duplicate", name: "Duplicate", components: [component("a", installed, []), component("c", returned, [])] },
	{ id: "support", name: " HARDWARE LIST ", components: [component("support", returned, [])] },
];
const before = structuredClone(input);
const enriched = withCompletedProjectInsights(input);
const insights = enriched.completion.insights;
assert.deepEqual(input, before, "analytics must not mutate the frozen input");
assert.equal(insights.returns.totalItems, 7);
assert.equal(insights.returns.returnedItems, 5, "repeat returns count as one item, including final returns without history");
assert.equal(insights.returns.percentage, 5 / 7 * 100);
assert.deepEqual([insights.returns.inProgress, insights.returns.resolved, insights.returns.unknown], [3, 1, 1]);
assert.deepEqual(insights.returns.groups.map(g => [g.id, g.returnedItems, g.totalItems]), [["plywood", 4, 6], ["hpl", 1, 1]], "rank by number of returned items, not just percentage");
assert.deepEqual(insights.transitions, [
	{ from: received, to: packed, averageHours: 32, sampleItems: 3, waitingItems: 1 },
	{ from: packed, to: installed, averageHours: 72, sampleItems: 2, waitingItems: 1 },
]);
assert.equal(insights.bottleneck, packed);
assert.equal(withCompletedProjectInsights(enriched), enriched, "stored backend results are reused");
assert.deepEqual(JSON.parse(JSON.stringify(enriched)).completion.insights, insights, "the API contract is JSON serializable");
const partial = structuredClone(input);
partial.items = [{ id: "only", name: "Panels", components: [component("backwards", installed, [
	["2026-10-12 00:00:00", packed], ["2026-10-13 00:00:00", received], ["2026-10-14 00:00:00", installed],
])] }];
assert.deepEqual(withCompletedProjectInsights(partial).completion.insights.transitions.map(t => t.averageHours), [null, null], "missing stages and backwards steps must not invent durations");
partial.items[0].components = [component("same-second", installed, [
	["2026-10-12 00:00:00", received], ["2026-10-12 00:00:00", packed], ["2026-10-12 00:00:00", installed],
])];
assert.deepEqual(withCompletedProjectInsights(partial).completion.insights.transitions.map(t => [t.averageHours, t.sampleItems]), [[0, 1], [0, 1]], "preserve chronological database order for same-second scans");
assert.equal(withCompletedProjectInsights(partial).completion.insights.bottleneck, null, "equal durations have no slower stage");
partial.completion.capturedAt = "2026-10-11T00:00:00Z";
assert.deepEqual(withCompletedProjectInsights(partial).completion.insights.transitions.map(t => t.sampleItems), [0, 0], "capture date also limits scan history");
partial.items = [];
const empty = withCompletedProjectInsights(partial).completion.insights;
assert.equal(empty.returns.percentage, null, "empty denominator is unknown, not zero percent");
assert.equal(empty.bottleneck, null);
delete partial.completion;
assert.equal(withCompletedProjectInsights(partial), partial, "ongoing projects do not get completion analytics");
console.log("Backend insights: unique returns, material ranking/status, missing/future history, ordered durations, repeat scans, return/backward resets, zero-duration ties, snapshot cutoff and stored result reuse passed.");
