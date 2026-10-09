import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { expect, test, type Page } from "@playwright/test";
import { clickUpHeaders } from "../src/lib/clickup";
import type { PanelMember } from "../src/types/clickup";
import type { PpicPermission, PpicRole, PpicStatus } from "../src/types/ppic";

test.describe("PPIC role/status mutations", () => {
	test.describe.configure({ mode: "serial" });
	test.skip(
		({ browserName }) => browserName !== "chromium",
		"PPIC mutations use one Chromium worker to protect shared records",
	);

	const envFile = existsSync(".env")
		? Object.fromEntries(
				readFileSync(".env", "utf8")
					.split(/\r?\n/)
					.filter((line) => line && !line.startsWith("#"))
					.map((line) => {
						const separator = line.indexOf("=");
						return [line.slice(0, separator), line.slice(separator + 1)];
					}),
			)
		: {};
	const env = (name: string) => envFile[name] ?? process.env[name] ?? "";
	const adminToken = env("CLICKUP_TOKEN");
	const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
	const users = {
		barangMember: "113605965",
		packingMember: "-83666467",
		admin: "107559156",
		inactiveMember: "107559155",
	} as const;
	const userIds = Object.values(users);
	const permissionRows = new Map<
		string,
		Omit<PpicPermission, "allowed_status"> & {
			allowed_status: PpicStatus | null;
		}
	>();
	let db: ReturnType<typeof createClient> | undefined;

	test.skip(
		!adminToken,
		"PPIC mutation suite skipped: CLICKUP_TOKEN is unavailable in .env",
	);

	const readRows = async () => {
		const result = await db!.execute({
			sql: `
				SELECT clickup_user_id, role, allowed_status, active, updated_by, updated_at
				FROM ppic_permissions
				WHERE clickup_user_id IN (?, ?, ?, ?)
			`,
			args: userIds,
		});
		return new Map(
			result.rows.map((row) => {
				const value = row as Record<string, unknown>;
				return [
					String(value.clickup_user_id),
					{
						clickup_user_id: String(value.clickup_user_id),
						role: value.role as PpicRole,
						allowed_status:
							value.allowed_status === null
								? null
								: (value.allowed_status as PpicStatus),
						active: Number(value.active) as 0 | 1,
						updated_by: String(value.updated_by),
						updated_at: String(value.updated_at),
					},
				] as const;
			}),
		);
	};

	const authenticate = async (page: Page, role: PpicRole, status: PpicStatus | null) => {
		const payload = Buffer.from(
			JSON.stringify({
				user_id: users.admin,
				role,
				allowed_status: status,
				refreshed_at: Date.now(),
			}),
		).toString("base64url");
		const signature = createHmac("sha256", env("CLICKUP_CLIENT_SECRET"))
			.update(payload)
			.digest("base64url");
		await page.context().addCookies([
			{ name: "clickup_access_token", value: adminToken, url: baseURL },
			{ name: "ppic_session", value: `${payload}.${signature}`, url: baseURL },
		]);
	};

	const update = async (
		page: Page,
		body: { user_id: string; role?: PpicRole; allowed_status?: PpicStatus | null },
	) => {
		const response = await page.request.post("/api/panel/members", { data: body });
		expect(response.status()).toBe(200);
	};

	const panelState = async (page: Page) => {
		const response = await page.request.get("/api/panel/members");
		expect(response.status()).toBe(200);
		return (await response.json()) as {
			members: PanelMember[];
			permissions: Record<string, PpicStatus | null>;
		};
	};

	test.beforeAll(async () => {
		db = createClient({
			url: env("TURSO_DATABASE_URL"),
			authToken: env("TURSO_AUTH_TOKEN"),
		});
		const userResponse = await fetch("https://api.clickup.com/api/v2/user", {
			headers: clickUpHeaders(adminToken),
		});
		expect(userResponse.ok).toBeTruthy();
		const user = (await userResponse.json()) as { user?: { id?: string | number } };
		expect(String(user.user?.id)).toBe(users.admin);

		const rows = await readRows();
		expect(rows.size).toBe(userIds.length);
		for (const id of userIds) expect(rows.has(id)).toBeTruthy();
		expect(rows.get(users.barangMember)).toMatchObject({
			role: "MEMBER",
			allowed_status: "BARANG_DITERIMA",
			active: 1,
		});
		expect(rows.get(users.packingMember)).toMatchObject({
			role: "MEMBER",
			allowed_status: "SEDANG_DIPACKING",
			active: 1,
		});
		expect(rows.get(users.admin)).toMatchObject({ role: "SUPER_ADMIN", active: 1 });
		expect(rows.get(users.inactiveMember)).toMatchObject({
			role: "MEMBER",
			allowed_status: "BARANG_DITERIMA",
			active: 0,
		});
		for (const [id, row] of rows) permissionRows.set(id, row);
	});

	test.afterAll(async () => {
		if (!db || permissionRows.size !== userIds.length) return;
		const errors: unknown[] = [];
		for (const row of permissionRows.values()) {
			try {
				await db.execute({
					sql: `
						UPDATE ppic_permissions
						SET role = ?, allowed_status = ?, active = ?, updated_by = ?, updated_at = ?
						WHERE clickup_user_id = ?
					`,
					args: [
						row.role,
						row.allowed_status,
						row.active,
						row.updated_by,
						row.updated_at,
						row.clickup_user_id,
					],
				});
			} catch (error) {
				errors.push(error);
			}
		}
		if (errors.length) throw errors[0];
	});

		test("T01 Member becomes Super Admin and can access all panel pages", async ({ page }) => {
			await authenticate(page, "SUPER_ADMIN", null);
			await update(page, { user_id: users.barangMember, role: "SUPER_ADMIN" });
			const state = (await readRows()).get(users.barangMember);
			expect(state).toMatchObject({ role: "SUPER_ADMIN", active: 1 });
			expect((await panelState(page)).permissions[users.barangMember]).toBeNull();

		for (const path of ["/settings", "/barang-diterima", "/sedang-dipacking"]) {
			const response = await page.goto(path);
			expect(response?.status()).toBe(200);
		}
	});

	test("T02 Super Admin becomes inactive Member and next login goes to scan", async ({ page }) => {
		await authenticate(page, "SUPER_ADMIN", null);
		await update(page, { user_id: users.barangMember, role: "MEMBER" });
		const state = (await readRows()).get(users.barangMember);
		expect(state).toMatchObject({ role: "MEMBER", active: 0 });

		await authenticate(page, "MEMBER", null);
		await page.goto("/");
		await expect(page).toHaveURL(/\/scan-to-find$/);
	});

	test("T03 assigns Barang Diterima and routes the member correctly", async ({ page }) => {
		await authenticate(page, "SUPER_ADMIN", null);
		await update(page, {
			user_id: users.barangMember,
			allowed_status: "BARANG_DITERIMA",
		});
		const state = (await readRows()).get(users.barangMember);
		expect(state).toMatchObject({
			role: "MEMBER",
			allowed_status: "BARANG_DITERIMA",
			active: 1,
		});

		await authenticate(page, "MEMBER", "BARANG_DITERIMA");
		await page.goto("/");
		await expect(page).toHaveURL(/\/barang-diterima$/);
		await page.goto("/sedang-dipacking");
		await expect(page).toHaveURL(/\/unauthorized$/);
	});

	test("T04 assigns Sedang Dipacking and routes the member correctly", async ({ page }) => {
		await authenticate(page, "SUPER_ADMIN", null);
		await update(page, {
			user_id: users.barangMember,
			allowed_status: "SEDANG_DIPACKING",
		});
		const state = (await readRows()).get(users.barangMember);
		expect(state).toMatchObject({
			role: "MEMBER",
			allowed_status: "SEDANG_DIPACKING",
			active: 1,
		});

		await authenticate(page, "MEMBER", "SEDANG_DIPACKING");
		await page.goto("/");
		await expect(page).toHaveURL(/\/sedang-dipacking$/);
		await page.goto("/barang-diterima");
		await expect(page).toHaveURL(/\/unauthorized$/);
	});

	test("T05 deactivates and reactivates the currently-rendered member", async ({ page }) => {
		await authenticate(page, "SUPER_ADMIN", null);
		await update(page, {
			user_id: users.barangMember,
			allowed_status: "BARANG_DITERIMA",
		});
		await authenticate(page, "MEMBER", "BARANG_DITERIMA");
		await update(page, { user_id: users.barangMember, allowed_status: null });

		const state = (await readRows()).get(users.barangMember);
		expect(state).toMatchObject({ role: "MEMBER", active: 0 });
		await page.goto("/barang-diterima");
		expect(page.url()).toMatch(/\/barang-diterima$/);

		await authenticate(page, "SUPER_ADMIN", null);
		await update(page, {
			user_id: users.barangMember,
			allowed_status: "BARANG_DITERIMA",
		});
		expect((await readRows()).get(users.barangMember)).toMatchObject({
			role: "MEMBER",
			allowed_status: "BARANG_DITERIMA",
			active: 1,
		});
	});
});
