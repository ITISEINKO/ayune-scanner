// Run: node --experimental-strip-types tests/profile-scan-summary.cjs
const assert = require("node:assert/strict");
const { registerHooks } = require("node:module");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === "next/server") return nextResolve("next/server.js", context);
		if (specifier === "@/lib/session") return {
			url: "data:text/javascript," + encodeURIComponent(`
				export const ppicSession = async () => globalThis.profileSession ?? null;
				export const clickUpUserId = async () => {
					globalThis.identityCalls++;
					return globalThis.profileActor ?? null;
				};
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
const { GET } = require("../src/app/api/profile/scan-summary/route.ts");
const { GET: adminSummary } = require("../src/app/api/panel/members/summary/route.ts");

(async () => {
	try {
		await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT, role TEXT, allowed_status TEXT, active INTEGER)");
		await db.execute("INSERT INTO ppic_permissions VALUES ('member', 'MEMBER', '[\"BARANG_DITERIMA\"]', 1), ('admin', 'SUPER_ADMIN', NULL, 1)");
		await db.execute("CREATE TABLE ppic_scan_history (clickup_user_id TEXT, status TEXT, scanned_at TEXT)");
		await db.execute(`INSERT INTO ppic_scan_history VALUES
			('member', 'BARANG_DITERIMA', datetime('now', '-100 days')),
			('member', 'DALAM_PROSES_RETUR', datetime('now', '-1 hour')),
			('member', 'BARANG_DITERIMA', datetime('now', '+2 days')),
			('other', 'TERPASANG_DIGUNAKAN', datetime('now', '-1 hour'))`);
		global.identityCalls = 0;
		assert.equal((await GET()).status, 401);
		global.profileSession = { user_id: "member", role: "MEMBER" };
		const callsBefore = global.identityCalls;
		const response = await GET(new Request("http://localhost/api/profile/scan-summary?user_id=other&period=month"));
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("cache-control"), "private, no-store");
		assert.equal(global.identityCalls, callsBefore, "signed identity avoids ClickUp and cannot be overridden by query input");
		const summary = await response.json();
		assert.equal(summary.lifetimeTotal, 2, "lifetime excludes future scans and other members");
		assert.equal(summary.total, 1);
		assert.equal(summary.days.length, 7);
		assert.equal(summary.days.reduce((sum, day) => sum + day.count, 0), 1);
		assert.equal(summary.statuses.find((bucket) => bucket.status === "DALAM_PROSES_RETUR").count, 1);
		assert.equal(summary.statuses.reduce((sum, bucket) => sum + bucket.count, 0), 1);
		assert.equal(summary.lifetimeStatuses.find((bucket) => bucket.status === "BARANG_DITERIMA").count, 1, "status chart includes scans older than seven days");
		assert.equal(summary.lifetimeStatuses.find((bucket) => bucket.status === "DALAM_PROSES_RETUR").count, 1);
		assert.equal(summary.lifetimeStatuses.reduce((sum, bucket) => sum + bucket.count, 0), summary.lifetimeTotal);
		const empty = await getPpicMemberScanSummary("empty", "7");
		assert.equal(empty.lifetimeTotal, 0);
		assert.equal(empty.total, 0);
		assert.equal(empty.lastScannedAt, null);
		assert.ok(empty.lifetimeStatuses.every(({ count }) => count === 0));
		global.profileSession = { user_id: "admin", role: "MEMBER" };
		assert.equal((await GET()).status, 403, "database role overrides stale session role");
		global.profileSession = { user_id: "unknown", role: "MEMBER" };
		assert.equal((await GET()).status, 403);
		global.profileSession = null;
		global.profileActor = "member";
		assert.equal((await GET()).status, 200, "token identity fallback remains available");
		const adminRequest = new Request("http://localhost/api/panel/members/summary?user_id=member&period=7");
		assert.equal((await adminSummary(adminRequest)).status, 401, "admin summary requires a signed session without token fallback");
		global.profileSession = { user_id: "member", role: "SUPER_ADMIN" };
		assert.equal((await adminSummary(adminRequest)).status, 403, "admin summary checks the current database role");
		global.profileSession = { user_id: "admin", role: "SUPER_ADMIN" };
		const adminCallsBefore = global.identityCalls;
		const adminResponse = await adminSummary(adminRequest);
		assert.equal(adminResponse.status, 200);
		assert.equal(global.identityCalls, adminCallsBefore, "admin summary does not look up ClickUp identity");
		assert.equal((await adminResponse.json()).lifetimeTotal, 2, "shared summary remains compatible with the admin caller");
		global.profileSession = { user_id: "member", role: "MEMBER" };
		await db.execute("DROP TABLE ppic_scan_history");
		assert.equal((await GET()).status, 502);
		console.log("Profile scan summary passed: self isolation, fresh member role, token fallback, lifetime/weekly totals, empty history and database errors.");
	} finally {
		db.close();
	}
})().catch((error) => { console.error(error); process.exitCode = 1; });
