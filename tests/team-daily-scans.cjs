// Run: node --experimental-strip-types tests/team-daily-scans.cjs
const assert = require("node:assert/strict");
const { registerHooks } = require("node:module");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

registerHooks({
	resolve(specifier, context, nextResolve) {
		return nextResolve(specifier.startsWith("@/")
			? pathToFileURL(resolve(__dirname, "../src", `${specifier.slice(2)}.ts`)).href
			: specifier, context);
	},
});
process.env.TURSO_DATABASE_URL = "file::memory:";
process.env.TURSO_AUTH_TOKEN = "local-test-only";
global.fetch = () => { throw new Error("No outbound calls allowed"); };
const { db, getPpicTeamScanOverview, getPpicMemberScanSummary } = require("../src/lib/db.ts");

(async () => {
	await db.execute("CREATE TABLE ppic_scan_history (clickup_user_id TEXT, status TEXT, scanned_at TEXT)");
	const now = Date.parse("2026-10-24T10:00:00+07:00");
	const add = (date, status = "BARANG_DITERIMA", user = "member") => db.execute({
		sql: "INSERT INTO ppic_scan_history VALUES (?, ?, ?)", args: [user, status, date],
	});
	await add("2026-09-24 16:59:59"); // just before the 30-day window
	await add("2026-09-24 17:00:00");
	await add("2026-10-23 16:59:59", "SEDANG_DIPACKING");
	await add("2026-10-23 17:00:00", "DALAM_PROSES_RETUR");
	await add("2026-10-24T09:00:00+07:00", "TERPASANG_DIGUNAKAN");
	await add("2026-10-24 02:00:00", "legacy-status");
	await add("2026-10-24 02:00:00", "legacy-status"); // repeated events count separately
	await add("2026-10-24 02:00:00", "BARANG_DITERIMA", "inactive");
	await add("2026-10-24 02:00:00", "BARANG_DITERIMA", "admin");
	await add("2026-10-24 02:00:00", "BARANG_DITERIMA", "outsider");
	await add("2026-10-24 03:00:01"); // future, one second past now
	const execute = db.execute.bind(db);
	let queryCount = 0;
	db.execute = (...args) => { queryCount++; return execute(...args); };
	const overview = await getPpicTeamScanOverview(["member", "inactive", "empty"], now);
	assert.equal(queryCount, 1, "all member summaries and chart use one database statement");
	db.execute = execute;
	const days = overview.dailyScans;
	assert.equal(days.length, 30);
	assert.equal(days[0].date, "2026-09-25");
	assert.equal(days[0].count, 1);
	assert.equal(days[1].count, 0);
	assert.equal(days.at(-2).count, 1);
	assert.equal(days.at(-1).date, "2026-10-24");
	assert.equal(days.at(-1).count, 5);
	assert.deepEqual(days.at(-1).statuses, {
		BARANG_DITERIMA: 1, SEDANG_DIPACKING: 0, TERPASANG_DIGUNAKAN: 1, DALAM_PROSES_RETUR: 1, OTHER: 2,
	});
	for (const day of days) assert.equal(Object.values(day.statuses).reduce((a, b) => a + b, 0), day.count);
	const summaries = await Promise.all(["member", "inactive"].map((id) => getPpicMemberScanSummary(id, "7", now)));
	for (const [index, id] of ["member", "inactive"].entries()) {
		const { today, total, days } = summaries[index];
		assert.deepEqual(overview.summaries[id], { today, total, days }, "batched member result matches existing date/count semantics");
	}
	assert.equal(overview.summaries.empty.today, 0);
	assert.equal(overview.summaries.empty.days.length, 7);
	assert.equal(days.slice(-7).reduce((sum, day) => sum + day.count, 0), summaries.reduce((sum, member) => sum + member.total, 0), "7-day chart matches the dashboard's team total");
	assert.equal(days.at(-1).count, summaries.reduce((sum, member) => sum + member.today, 0));
	const { dailyScans: empty, summaries: emptySummaries } = await getPpicTeamScanOverview([], now);
	assert.deepEqual(emptySummaries, {});
	assert.equal(empty.length, 30);
	assert.ok(empty.every((day) => day.count === 0));
	const { dailyScans: leap } = await getPpicTeamScanOverview([], Date.parse("2024-03-01T00:00:00+07:00"));
	assert.equal(leap[0].date, "2024-02-01");
	assert.equal(leap.at(-2).date, "2024-02-29");
	await db.execute("DROP TABLE ppic_scan_history");
	await assert.rejects(getPpicTeamScanOverview(["member"], now), /no such table/);
	db.close();
	console.log("Team daily scans passed: WIB boundaries, 7/30-day totals, status stacks, repeated scans, roster scope, future rows, empty/leap days and database errors.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
