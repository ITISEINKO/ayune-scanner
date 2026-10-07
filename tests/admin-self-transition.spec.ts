import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { expect, test, type Page } from "@playwright/test";
import { clickUpHeaders } from "../src/lib/clickup";
import type { PpicPermission, PpicRole, PpicStatus } from "../src/types/ppic";

test.describe("Admin self-transition", () => {
	test.describe.configure({ mode: "serial" });
	test.skip(
		process.env.RUN_ADMIN_SELF_TEST !== "1",
		"Set RUN_ADMIN_SELF_TEST=1 to run the direct-database self-transition check",
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
	const userId = "107559156";
	const token = env("CLICKUP_TOKEN");
	const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
	const db = createClient({
		url: env("TURSO_DATABASE_URL"),
		authToken: env("TURSO_AUTH_TOKEN"),
	});
	let original: {
		role: PpicRole;
		allowed_status: PpicStatus | null;
		active: 0 | 1;
		updated_by: string;
		updated_at: string;
	} | null = null;

	const readState = async () => {
		const result = await db.execute({
			sql: `
				SELECT role, allowed_status, active, updated_by, updated_at
				FROM ppic_permissions
				WHERE clickup_user_id = ?
			`,
			args: [userId],
		});
		const row = result.rows[0] as Record<string, unknown> | undefined;
		return row
			? {
					role: row.role as PpicRole,
					allowed_status:
						row.allowed_status === null
							? null
							: (row.allowed_status as PpicStatus),
					active: Number(row.active) as 0 | 1,
					updated_by: String(row.updated_by),
					updated_at: String(row.updated_at),
				} 
			: null;
	};

	const setState = async (
		role: PpicRole,
		allowedStatus: PpicStatus,
		active: 0 | 1,
	) => {
		await db.execute({
			sql: `
				UPDATE ppic_permissions
				SET role = ?, allowed_status = ?, active = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
				WHERE clickup_user_id = ?
			`,
			args: [role, allowedStatus, active, userId, userId],
		});
	};

	const authenticate = async (page: Page) => {
		await page.context().addCookies([
			{ name: "clickup_access_token", value: token, url: baseURL },
		]);
	};

	const freshLogin = async (page: Page) => {
		await page.context().clearCookies({ name: "ppic_session" });
		await page.goto("/");
	};

	const expectScan = async (page: Page, status: PpicStatus, expected: number) => {
		const response = await page.request.post("/api/panel/scan", {
			data: { batch_number: "__playwright_missing_batch__", status },
			maxRedirects: 0,
		});
		expect(response.status()).toBe(expected);
	};

	test.beforeAll(async () => {
		test.skip(!token, "CLICKUP_TOKEN is unavailable in .env");
		const userResponse = await fetch("https://api.clickup.com/api/v2/user", {
			headers: clickUpHeaders(token),
		});
		expect(userResponse.ok).toBeTruthy();
		const user = (await userResponse.json()) as { user?: { id?: string | number } };
		expect(String(user.user?.id)).toBe(userId);

		original = await readState();
		expect(original).not.toBeNull();
		expect(original).toMatchObject({ role: "SUPER_ADMIN", active: 1 });
	});

	test.afterAll(async () => {
		if (!original) return;
		await db.execute({
			sql: `
				UPDATE ppic_permissions
				SET role = ?, allowed_status = ?, active = ?, updated_by = ?, updated_at = ?
				WHERE clickup_user_id = ?
			`,
			args: [
				original.role,
				original.allowed_status,
				original.active,
				original.updated_by,
				original.updated_at,
				userId,
			],
		});
	});

	test("107559156 transitions through every member state and returns to Super Admin", async ({ page }) => {
		await authenticate(page);

		await setState("MEMBER", "BARANG_DITERIMA", 0);
		await freshLogin(page);
		await expect(page).toHaveURL(/\/scan-to-find$/);
		await expectScan(page, "BARANG_DITERIMA", 307);

		await setState("MEMBER", "BARANG_DITERIMA", 1);
		await freshLogin(page);
		await expect(page).toHaveURL(/\/barang-diterima$/);
		await page.goto("/sedang-dipacking");
		await expect(page).toHaveURL(/\/unauthorized$/);
		await expectScan(page, "BARANG_DITERIMA", 404);
		await expectScan(page, "SEDANG_DIPACKING", 307);

		await setState("MEMBER", "SEDANG_DIPACKING", 1);
		await freshLogin(page);
		await expect(page).toHaveURL(/\/sedang-dipacking$/);
		await page.goto("/barang-diterima");
		await expect(page).toHaveURL(/\/unauthorized$/);
		await expectScan(page, "SEDANG_DIPACKING", 404);
		await expectScan(page, "BARANG_DITERIMA", 307);

		await setState("MEMBER", "SEDANG_DIPACKING", 0);
		await freshLogin(page);
		await expect(page).toHaveURL(/\/scan-to-find$/);
		await expectScan(page, "SEDANG_DIPACKING", 307);

		await setState(
			original!.role,
			original!.allowed_status ?? "BARANG_DITERIMA",
			original!.active,
		);
		await freshLogin(page);
		await expect(page).toHaveURL(/\/settings$/);
	});
});
