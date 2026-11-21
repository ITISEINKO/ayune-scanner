const assert = require("node:assert/strict");
const { readFileSync, mkdtempSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { tmpdir } = require("node:os");
const { spawn } = require("node:child_process");
const { createClient } = require("@libsql/client");

(async () => {
	const databaseUrl = `file:${join(mkdtempSync(join(tmpdir(), "better-auth-flow-")), "test.db").replaceAll("\\", "/")}`;
	const db = createClient({ url: databaseUrl });
	const statements = (path) =>
		readFileSync(path, "utf8")
			.split("--> statement-breakpoint")
			.map((sql) => sql.trim())
			.filter(Boolean);
	await db.batch(statements("drizzle/0004_mean_carlie_cooper.sql"), "write");
	await db.batch(
		statements("drizzle/0006_absurd_redwing.sql").slice(0, 6),
		"write",
	);
	const now = Date.now();
	await db.execute({
		sql: 'INSERT INTO "user" (id,name,email,"emailVerified",role,allowed_status,active,can_import_lby,"createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?,?)',
		args: [
			"u",
			"Member",
			"member@example.test",
			0,
			"ADMIN",
			"BARANG_DITERIMA",
			1,
			0,
			now,
			now,
		],
	});
	await db.execute({
		sql: 'INSERT INTO account (id,"accountId","providerId","userId","createdAt","updatedAt") VALUES (?,?,?,?,?,?)',
		args: ["account", "123", "clickup", "u", now, now],
	});
	const base = "http://127.0.0.1:3365";
	const server = spawn(
		process.execPath,
		["node_modules/next/dist/bin/next", "start", "-p", "3365"],
		{
			windowsHide: true,
			stdio: ["ignore", "pipe", "pipe"],
			env: {
				...process.env,
				TURSO_DATABASE_URL: databaseUrl,
				TURSO_AUTH_TOKEN: "local",
				BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters",
				BETTER_AUTH_URL: base,
				CLICKUP_CLIENT_ID: "test-client",
				CLICKUP_CLIENT_SECRET: "test-client-secret",
				CLICKUP_TEAM_ID: "team",
				CLICKUP_CHAT_WORKSPACE_ID: "team",
				CLICKUP_CHAT_CHANNEL_ID: "channel",
				CLICKUP_REDIRECT_URI: `${base}/api/auth/clickup/callback`,
				NODE_OPTIONS: `--require=${resolve("tests/clickup-simulation-preload.cjs")}`,
			},
		},
	);
	let logs = "";
	server.stdout.on("data", (chunk) => {
		logs += chunk;
	});
	server.stderr.on("data", (chunk) => {
		logs += chunk;
	});
	const jar = new Map();
	const request = async (path) => {
		const response = await fetch(`${base}${path}`, {
			redirect: "manual",
			headers: {
				cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; "),
			},
		});
		for (const cookie of response.headers.getSetCookie()) {
			const pair = cookie.split(";", 1)[0],
				index = pair.indexOf("=");
			jar.set(pair.slice(0, index), pair.slice(index + 1));
		}
		return response;
	};
	try {
		for (let i = 0; ; i++) {
			try {
				if ((await fetch(`${base}/login`)).ok) break;
			} catch {}
			if (i > 60 || server.exitCode !== null)
				throw new Error(`Server failed to start: ${logs}`);
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		jar.set("ppic_session", "legacy-cookie");
		assert.equal((await request("/api/auth/refresh")).status, 401, "legacy cookies cannot authenticate");
		jar.delete("ppic_session");
		const invalidState = await fetch(`${base}/api/auth/clickup/callback?code=synthetic&state=invalid`, { redirect: "manual" });
		assert.equal(new URL(invalidState.headers.get("location"), base).pathname, "/api/auth/error", "invalid OAuth state is rejected");
		assert(!invalidState.headers.getSetCookie().some((cookie) => cookie.startsWith("better-auth.session_token=")), "invalid state cannot issue a session");
		const start = await request("/api/auth/clickup");
		assert.equal(start.status, 307);
		const authorization = new URL(start.headers.get("location"));
		assert.equal(authorization.origin, "https://app.clickup.com");
		assert.equal(
			authorization.searchParams.get("redirect_uri"),
			`${base}/api/auth/clickup/callback`,
		);
		const state = authorization.searchParams.get("state");
		assert(state);
		const callback = await request(
			`/api/auth/clickup/callback?code=synthetic&state=${encodeURIComponent(state)}`,
		);
		assert.equal(
			callback.status,
			302,
			`OAuth callback: ${callback.status}, ${callback.headers.get("location")}, ${logs}`,
		);
		assert.equal(
			new URL(callback.headers.get("location"), base).pathname,
			"/",
			`OAuth result: ${callback.headers.get("location")}, ${logs}`,
		);
		assert(
			[...jar.keys()].some((key) => key.includes("session_token")),
			"Better Auth issued session cookie",
		);
		assert.equal((await request("/api/auth/refresh")).status, 200);
		assert.equal((await (await request("/api/profile")).json()).role, "ADMIN");
		assert.equal((await request("/admin/profile")).status, 200);
		assert.equal(
			(await request("/api/find-task?serial_number=1")).status,
			404,
			"linked ClickUp token reaches API",
		);
		await db.execute("UPDATE user SET role='MEMBER', active=1 WHERE id='u'");
		assert.equal(new URL((await request("/admin/profile")).headers.get("location"), base).pathname, "/unauthorized");
		assert.equal(
			(await (await request("/api/auth/refresh")).json()).path,
			"/projects",
		);
		await db.execute("UPDATE user SET active=0 WHERE id='u'");
		assert.equal((await request("/api/find-task?serial_number=1")).status, 401, "revoked app access cannot use ClickUp tokens");
		assert.equal(
			(await (await request("/api/auth/refresh")).json()).path,
			"/profile",
		);
		const logout = await request("/api/auth/logout");
		assert.equal(logout.status, 307);
		assert.equal(
			(await request("/api/auth/refresh")).status,
			401,
			"logout revokes the Better Auth session",
		);
		const nextStart = await request("/api/auth/clickup");
		const nextState = new URL(
			nextStart.headers.get("location"),
		).searchParams.get("state");
		const nextCallback = await request(
			`/api/auth/clickup/callback?code=synthetic&state=${encodeURIComponent(nextState)}`,
		);
		assert.equal(
			new URL(nextCallback.headers.get("location"), base).pathname,
			"/",
			"revoked app access can sign in to profile",
		);
		assert.equal(
			(await (await request("/api/auth/refresh")).json()).path,
			"/profile",
		);
		assert.equal(new URL((await request("/")).headers.get("location"), base).pathname, "/profile");
		await db.execute("DELETE FROM session WHERE userId='u'");
		assert.equal(
			(await request("/api/auth/refresh")).status,
			401,
			"revoked Better Auth session is rejected",
		);
		console.log(
			"Better Auth OAuth, token, role change and revocation passed against ClickUp simulation.",
		);
	} finally {
		server.kill();
		server.stdout.destroy();
		server.stderr.destroy();
		db.close();
	}
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
