import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { expect, test, type Page } from "@playwright/test";
import { clickUpHeaders } from "../src/lib/clickup";
import {
	CF_PANEL,
	PANEL_LIST_ID,
	STATUS_BARANG_SCAN,
	statusBarangScanKey,
} from "../src/lib/produksiPanel";
import type { ClickUpTask } from "../src/types/clickup";

test.describe("Admin manual status scan", () => {
	test.describe.configure({ mode: "serial" });
	test.skip(
		process.env.RUN_ADMIN_MANUAL_TEST !== "1",
		"Set RUN_ADMIN_MANUAL_TEST=1 to run the live ClickUp fixture",
	);
	test.skip(
		({ browserName }) => browserName !== "chromium",
		"The live ClickUp fixture runs once in Chromium",
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
	const env = (name: string) => process.env[name] ?? envFile[name] ?? "";
	const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
	const adminId = "107559156";
	const serialNumber = "15370041508";
	const adminToken = env("CLICKUP_TOKEN");
	const db = createClient({
		url: env("TURSO_DATABASE_URL"),
		authToken: env("TURSO_AUTH_TOKEN"),
	});
	let componentTaskId = "";
	let originalComponent:
		| { projectTaskId: string; status: string | null; updatedAt: number }
		| undefined;
	let liveMutationStarted = false;

	const sessionCookie = () => {
		const payload = Buffer.from(
			JSON.stringify({
				user_id: adminId,
				role: "SUPER_ADMIN",
				allowed_status: null,
				refreshed_at: Date.now(),
			}),
		).toString("base64url");
		const signature = createHmac("sha256", env("CLICKUP_CLIENT_SECRET"))
			.update(payload)
			.digest("base64url");
		return `${payload}.${signature}`;
	};

	const authenticateAdmin = async (page: Page) => {
		await page.context().addCookies([
			{ name: "clickup_access_token", value: adminToken, url: baseURL },
			{ name: "ppic_session", value: sessionCookie(), url: baseURL },
		]);
	};

	const clickUpStatus = async () => {
		const response = await fetch(
			`https://api.clickup.com/api/v2/task/${componentTaskId}`,
			{ headers: clickUpHeaders(adminToken) },
		);
		expect(response.ok).toBeTruthy();
		const task = (await response.json()) as ClickUpTask;
		return statusBarangScanKey(
			task.custom_fields?.find(
				(field) =>
					field.id ===
					(process.env.CLICKUP_FIELD_STATUS_BARANG_SCAN ||
						CF_PANEL.STATUS_BARANG_SCAN),
			)?.value,
		);
	};

	const localStatus = async () => {
		const result = await db.execute({
			sql: "SELECT status FROM ppic_component_status WHERE component_task_id = ?",
			args: [componentTaskId],
		});
		return result.rows[0]?.status;
	};

	test.beforeAll(async () => {
		test.skip(
			!adminToken || !env("CLICKUP_CLIENT_SECRET"),
			"CLICKUP_TOKEN and CLICKUP_CLIENT_SECRET are required",
		);
		const userResponse = await fetch("https://api.clickup.com/api/v2/user", {
			headers: clickUpHeaders(adminToken),
		});
		expect(userResponse.ok).toBeTruthy();
		const user = (await userResponse.json()) as {
			user?: { id?: string | number };
		};
		expect(String(user.user?.id)).toBe(adminId);

		const query = new URLSearchParams({
			include_closed: "true",
			subtasks: "true",
			custom_fields: JSON.stringify([
				{
					field_id: CF_PANEL.SERIAL_NUMBER,
					operator: "=",
					value: serialNumber,
				},
			]),
		});
		const response = await fetch(
			`https://api.clickup.com/api/v2/list/${env("CLICKUP_PPIC_PANEL_LIST_ID") || PANEL_LIST_ID}/task?${query}`,
			{ headers: clickUpHeaders(adminToken) },
		);
		expect(response.ok).toBeTruthy();
		const tasks = ((await response.json()) as { tasks?: ClickUpTask[] }).tasks;
		expect(tasks).toHaveLength(1);
		componentTaskId = tasks![0].id;
		expect(await clickUpStatus()).toBe("BARANG_DITERIMA");

		const result = await db.execute({
			sql: `
				SELECT project_task_id, status, updated_at
				FROM ppic_component_status
				WHERE component_task_id = ?
			`,
			args: [componentTaskId],
		});
		const row = result.rows[0];
		expect(row).toBeTruthy();
		expect(String(row.status)).toBe("BARANG_DITERIMA");
		originalComponent = {
			projectTaskId: String(row.project_task_id),
			status: row.status === null ? null : String(row.status),
			updatedAt: Number(row.updated_at),
		};
	});

	test.afterAll(async () => {
		const errors: unknown[] = [];
		const restore = async (work: () => Promise<unknown>) => {
			try {
				await work();
			} catch (error) {
				errors.push(error);
			}
		};

		if (liveMutationStarted && componentTaskId)
			await restore(async () => {
				const response = await fetch(
					`https://api.clickup.com/api/v2/task/${componentTaskId}/field/${env("CLICKUP_FIELD_STATUS_BARANG_SCAN") || CF_PANEL.STATUS_BARANG_SCAN}`,
					{
						method: "POST",
						headers: {
							...clickUpHeaders(adminToken),
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							value: STATUS_BARANG_SCAN.BARANG_DITERIMA,
						}),
					},
				);
				if (!response.ok) throw new Error("ClickUp status restore failed");
			});

		const snapshot = originalComponent;
		if (snapshot)
			await restore(() =>
				db.execute({
					sql: `
						UPDATE ppic_component_status
						SET project_task_id = ?, status = ?, updated_at = ?
						WHERE component_task_id = ?
					`,
					args: [
						snapshot.projectTaskId,
						snapshot.status,
						snapshot.updatedAt,
						componentTaskId,
					],
				}),
			);
		if (snapshot)
			await restore(async () => {
				await expect.poll(clickUpStatus).toBe("BARANG_DITERIMA");
				const result = await db.execute({
					sql: `
						SELECT project_task_id, status, updated_at
						FROM ppic_component_status
						WHERE component_task_id = ?
					`,
					args: [componentTaskId],
				});
				const row = result.rows[0];
				expect({
					projectTaskId: String(row?.project_task_id),
					status: row?.status === null ? null : String(row?.status),
					updatedAt: Number(row?.updated_at),
				}).toEqual(snapshot);
			});

		if (errors.length) throw errors[0];
	});

	test("admin scans and changes all three statuses", async ({ page }) => {
		await authenticateAdmin(page);
		await page.goto("/admin/ubah-manual");
		await expect(
			page.getByRole("heading", { name: "Ubah status barang" }),
		).toBeVisible();

		await page.getByRole("button", { name: "Keyboard" }).click();
		await page
			.getByRole("textbox", { name: "Input scan keyboard" })
			.fill(serialNumber);
		const dialog = page.getByRole("dialog");
		await expect(dialog).toContainText(`Serial: ${serialNumber}`);
		await expect(dialog).toContainText("BARANG DITERIMA");

		for (const target of [
			{ key: "SEDANG_DIPACKING", label: "SEDANG DIPACKING" },
			{ key: "TERPASANG_DIGUNAKAN", label: "TERPASANG / DIGUNAKAN" },
			{ key: "BARANG_DITERIMA", label: "BARANG DITERIMA" },
		] as const) {
			liveMutationStarted = true;
			await dialog
				.getByRole("button")
				.filter({ hasText: target.label })
				.click();
			await dialog
				.getByRole("button", { name: "Ya, ubah status" })
				.press("Enter");
			await expect(
				page.getByText("Status berhasil diperbarui.").first(),
			).toBeVisible();
			await expect(dialog.getByText(target.label, { exact: true }).first()).toBeVisible();
			await expect.poll(clickUpStatus).toBe(target.key);
			await expect.poll(localStatus).toBe(target.key);
		}
	});
});
