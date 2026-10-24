// Run: node --experimental-strip-types tests/admin-overview.cjs
const assert = require("node:assert/strict");
const { summarizeAdminOverview } = require("../src/lib/adminOverview.ts");
const component = (status) => ({ id: String(status), status });
const project = { items: [
	{ name: "Panels", components: [null, "BARANG_DITERIMA", "DALAM_PROSES_RETUR", "DRY_FIT", "DIHAPUSKAN"].map(component) },
	{ name: " hardware   list ", components: [component(null)] },
	{ name: "Material Requisition Form", components: [component("BARANG_DITERIMA")] },
] };
const member = (hasAccess, today, yesterday, total) => ({ hasAccess, summary: { today, total, days: [{ count: yesterday }, { count: today }] } });
const totals = summarizeAdminOverview([project], [member(true, 4, 2, 10), member(true, 0, 3, 5), member(false, 0, 0, 1)]);
assert.equal(totals.total, 4, "supporting groups and deleted components are excluded");
assert.equal(totals.recorded, 3, "other existing statuses count as recorded");
assert.equal(totals.percentage, 75);
assert.equal(totals.returns, 1);
assert.equal(totals.today, 4);
assert.equal(totals.change, -1, "compare with yesterday, not the previous seven-day period");
assert.equal(totals.week, 16, "inactive members retain historical scans");
assert.equal(totals.active, 1);
assert.equal(totals.enabled, 2);
assert.equal(totals.idle, 1);
assert.equal(totals.noAccess, 1);
const empty = summarizeAdminOverview([], []);
assert.equal(empty.percentage, 0);
assert.equal(empty.total, 0);
const unavailable = summarizeAdminOverview([], [{ hasAccess: true, summary: null }]);
assert.equal(unavailable.idle, 0, "failed summaries must not mark a member as idle");
console.log("Admin overview counts passed: current status, supporting/deleted exclusions, yesterday, inactive history and empty data.");
