// Run: node --experimental-strip-types tests/member-scan-summary.cjs
const assert = require("node:assert/strict");
const { registerHooks } = require("node:module");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === "next/server") return nextResolve("next/server.js", context);
		if (specifier === "@/lib/session") return {
			url: "data:text/javascript," + encodeURIComponent(`
				export const clickUpUserId = async () => globalThis.summaryActor;
				export const panelChannelMembers = async () => ({ ok: true, members: [{ id: 'member', name: 'Member' }] });
			`), shortCircuit: true,
		};
		return nextResolve(specifier.startsWith("@/")
			? pathToFileURL(resolve(__dirname, "../src", `${specifier.slice(2)}.ts`)).href
			: specifier, context);
	},
});
process.env.TURSO_DATABASE_URL = "file::memory:";
process.env.TURSO_AUTH_TOKEN = "local-test-only";
const { db, getPpicMemberScanSummary } = require("../src/lib/db.ts");
const { GET } = require("../src/app/api/panel/members/summary/route.ts");
const request = (query = "user_id=member") => new Request(`http://localhost/api/panel/members/summary?${query}`);

(async () => {
	await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT, role TEXT)");
	await db.execute("INSERT INTO ppic_permissions VALUES ('admin', 'SUPER_ADMIN'), ('member', 'MEMBER')");
	await db.execute("CREATE TABLE ppic_scan_history (clickup_user_id TEXT, status TEXT, scanned_at TEXT)");
	const add = (date, status = "BARANG_DITERIMA", user = "member") => db.execute({
		sql: "INSERT INTO ppic_scan_history VALUES (?, ?, ?)", args: [user, status, date],
	});
	const now = Date.parse("2026-10-23T10:00:00+07:00");
	await add("2026-10-16 16:59:59"); // previous period, one second before Jakarta midnight
	await add("2026-10-16 17:00:00");
	await add("2026-10-22 16:59:59", "SEDANG_DIPACKING");
	await add("2026-10-22 17:00:00", "DALAM_PROSES_RETUR");
	await add("2026-10-23T09:00:00+07:00", "TERPASANG_DIGUNAKAN");
	await add("2026-10-23 02:00:00", "legacy-status");
	await add("2026-10-24 00:00:00"); // future rows must not affect totals or last scan
	await add("2026-10-23 02:30:00", "BARANG_DITERIMA", "another-member");
	const seven = await getPpicMemberScanSummary("member", "7", now);
	assert.equal(seven.total, 5);
	assert.equal(seven.today, 3);
	assert.equal(seven.previousTotal, 1);
	assert.equal(seven.days.length, 7);
	assert.deepEqual(seven.days[0], { date: "2026-10-17", count: 1 });
	assert.deepEqual(seven.days[1], { date: "2026-10-18", count: 0 });
	assert.deepEqual(seven.statuses.map(({ count }) => count), [1, 1, 1, 1, 1]);
	assert.equal(seven.lastScannedAt, "2026-10-23T02:00:00.000Z");
	assert.equal(seven.days.reduce((sum, day) => sum + day.count, 0), seven.total);
	assert.equal(seven.statuses.reduce((sum, bucket) => sum + bucket.count, 0), seven.total);
	const month = await getPpicMemberScanSummary("member", "month", now);
	assert.equal(month.days[0].date, "2026-10-01");
	assert.equal(month.days.length, 23);
	assert.equal(month.total, 6);
	const thirty = await getPpicMemberScanSummary("member", "30", Date.parse("2026-01-02T01:00:00+07:00"));
	assert.equal(thirty.days[0].date, "2025-12-04");
	assert.equal(thirty.days.at(-1).date, "2026-01-02");
	const leap = await getPpicMemberScanSummary("member", "month", Date.parse("2024-02-29T23:00:00+07:00"));
	assert.equal(leap.days.length, 29);
	const empty = await getPpicMemberScanSummary("empty", "7", now);
	assert.equal(empty.total, 0);
	assert.equal(empty.today, 0);
	assert.equal(empty.lastScannedAt, null);
	assert.ok(empty.statuses.every(({ count }) => count === 0));
	await add("2026-01-01 00:00:00", "BARANG_DITERIMA", "old-member");
	const old = await getPpicMemberScanSummary("old-member", "7", now);
	assert.equal(old.total, 0);
	assert.equal(old.lastScannedAt, "2026-01-01T00:00:00.000Z");

	global.summaryActor = null;
	assert.equal((await GET(request())).status, 401);
	global.summaryActor = "member";
	assert.equal((await GET(request())).status, 403);
	global.summaryActor = "admin";
	for (const query of ["", "user_id=", "user_id=member&period=all", "user_id=member&period=7%20"])
		assert.equal((await GET(request(query))).status, 400);
	assert.equal((await GET(request("user_id=outsider"))).status, 404);
	for (const period of ["7", "30", "month"]) {
		const response = await GET(request(`user_id=member&period=${period}`));
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("cache-control"), "private, no-store");
		assert.ok(Array.isArray((await response.json()).days));
	}
	await db.execute("UPDATE ppic_permissions SET role = 'MEMBER' WHERE clickup_user_id = 'admin'");
	assert.equal((await GET(request())).status, 403, "revoked admin loses access immediately");
	await db.execute("UPDATE ppic_permissions SET role = 'SUPER_ADMIN' WHERE clickup_user_id = 'admin'");
	await db.execute("DROP TABLE ppic_scan_history");
	assert.equal((await GET(request())).status, 502);
	db.close();
	console.log("Member scan summary: calendar boundaries, status totals, isolation, empty history and API authorization passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
