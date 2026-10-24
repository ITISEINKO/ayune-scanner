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
				export const ppicSession = async () => globalThis.summarySession ?? null;
				export const clickUpUserId = async () => {
					globalThis.summaryClickUpCalls++;
					throw new Error('ClickUp identity lookup must not run');
				};
				export const panelChannelMembers = async () => {
					globalThis.summaryClickUpCalls++;
					throw new Error('ClickUp member lookup must not run');
				};
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
	await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT, role TEXT, allowed_status TEXT, active INTEGER)");
	await db.execute("INSERT INTO ppic_permissions VALUES ('admin', 'SUPER_ADMIN', NULL, 1), ('member', 'MEMBER', 'BARANG_DITERIMA', 1), ('inactive', 'MEMBER', NULL, 0)");
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
	assert.equal(seven.lifetimeTotal, 6);
	assert.deepEqual(seven.lifetimeStatuses.map(({ count }) => count), [2, 1, 1, 1, 1]);
	assert.equal(seven.lifetimeStatuses.reduce((sum, bucket) => sum + bucket.count, 0), seven.lifetimeTotal);
	const thirty = await getPpicMemberScanSummary("member", "30", now);
	assert.equal(thirty.days[0].date, "2026-09-24");
	assert.equal(thirty.days.length, 30);
	assert.equal(thirty.total, 6);
	assert.equal(thirty.previousTotal, 0);
	const month = await getPpicMemberScanSummary("member", "month", now);
	assert.equal(month.days[0].date, "2026-10-01");
	assert.equal(month.days.length, 23);
	assert.equal(month.total, 6);
	const newYear = await getPpicMemberScanSummary("member", "7", Date.parse("2026-01-02T01:00:00+07:00"));
	assert.equal(newYear.days[0].date, "2025-12-27");
	assert.equal(newYear.days.at(-1).date, "2026-01-02");
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
	assert.equal(old.lifetimeStatuses.find(({ status }) => status === "BARANG_DITERIMA").count, 1);
	await add("2026-01-01 00:00:00", "legacy-a", "legacy-member");
	await add("2026-02-01 00:00:00", "legacy-b", "legacy-member");
	const legacy = await getPpicMemberScanSummary("legacy-member", "7", now);
	assert.equal(legacy.total, 0);
	assert.equal(legacy.lifetimeTotal, 2);
	assert.equal(legacy.lifetimeStatuses.find(({ status }) => status === "OTHER").count, 2);
	assert.equal(legacy.lastScannedAt, "2026-02-01T00:00:00.000Z");

	global.summaryClickUpCalls = 0;
	let outboundCalls = 0;
	global.fetch = async () => { outboundCalls++; throw new Error("Summary must not make outbound HTTP requests"); };
	global.summarySession = null;
	assert.equal((await GET(request())).status, 401, "missing or invalid signed session is rejected without token fallback");
	global.summarySession = { user_id: "admin", role: "SUPER_ADMIN" };
	assert.equal((await GET(request())).status, 200, "signed identity and current database admin role allow access");
	await db.execute("UPDATE ppic_permissions SET role = 'MEMBER' WHERE clickup_user_id = 'admin'");
	assert.equal((await GET(request())).status, 403, "cached admin session cannot bypass fresh database role checks");
	await db.execute("UPDATE ppic_permissions SET role = 'SUPER_ADMIN' WHERE clickup_user_id = 'admin'");
	global.summarySession = { user_id: "admin", role: "MEMBER" };
	assert.equal((await GET(request())).status, 200, "current database role overrides a stale member role");
	global.summarySession = { user_id: "member", role: "SUPER_ADMIN" };
	assert.equal((await GET(request())).status, 403, "session role alone cannot grant admin access");
	global.summarySession = { user_id: "outsider", role: "SUPER_ADMIN" };
	assert.equal((await GET(request())).status, 403, "deleted or unknown local actor is denied");
	global.summarySession = { user_id: "admin", role: "SUPER_ADMIN" };
	for (const query of ["", "user_id=", "user_id=member&period=all", "user_id=member&period=7%20"])
		assert.equal((await GET(request(query))).status, 400);
	assert.equal((await GET(request("user_id=outsider"))).status, 404);
	await db.execute("DELETE FROM ppic_permissions WHERE clickup_user_id = 'member'");
	assert.equal((await GET(request())).status, 404, "history alone does not authorize an unknown local target");
	await db.execute("INSERT INTO ppic_permissions VALUES ('member', 'MEMBER', 'BARANG_DITERIMA', 1)");
	const inactiveResponse = await GET(request("user_id=inactive"));
	assert.equal(inactiveResponse.status, 200, "inactive local members remain viewable");
	assert.equal((await inactiveResponse.json()).total, 0);
	assert.equal((await GET(request("user_id=admin"))).status, 200, "local admins remain viewable");
	for (const period of ["7", "30", "month"]) {
		const response = await GET(request(`user_id=member&period=${period}`));
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("cache-control"), "private, no-store");
		const summary = await response.json();
		assert.ok(Array.isArray(summary.days));
		if (period !== "month") assert.equal(summary.days.length, Number(period));
	}
	await db.execute("UPDATE ppic_permissions SET role = 'MEMBER' WHERE clickup_user_id = 'admin'");
	assert.equal((await GET(request())).status, 403, "revoked admin loses access immediately");
	await db.execute("UPDATE ppic_permissions SET role = 'SUPER_ADMIN' WHERE clickup_user_id = 'admin'");
	await db.execute("DROP TABLE ppic_scan_history");
	assert.equal((await GET(request())).status, 502);
	assert.equal(global.summaryClickUpCalls, 0, "no identity or member lookup reaches ClickUp");
	assert.equal(outboundCalls, 0, "no outbound HTTP requests across success and error paths");
	db.close();
	console.log("Member scan summary: all periods, calendar boundaries, status totals, signed-session identity, fresh database authorization, local targets and zero ClickUp/outbound calls passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
