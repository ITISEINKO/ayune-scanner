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

test.describe("Member project selection", () => {
	test.describe.configure({ mode: "serial" });
	test.skip(
		process.env.RUN_MEMBER_PROJECT_TEST !== "1",
		"Set RUN_MEMBER_PROJECT_TEST=1 to run the live permission fixture",
	);
	test.skip(
		({ browserName }) => browserName !== "chromium",
		"The live permission fixture runs once in Chromium",
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
	const memberId = "-83666467";
	const serialNumber = "15370041508";
	const allowedStatuses = [
		"SEDANG_DIPACKING",
		"TERPASANG_DIGUNAKAN",
		"BARANG_DITERIMA",
	] as const;
	const adminToken = env("CLICKUP_TOKEN");
	const db = createClient({
		url: env("TURSO_DATABASE_URL"),
		authToken: env("TURSO_AUTH_TOKEN"),
	});
	let original:
		| {
				role: string;
				allowedStatus: string;
				active: number;
				updatedBy: string;
				updatedAt: string;
		  }
		| undefined;
	let componentTaskId = "";
	let projectTaskId = "";
	let projectName = "";
	let projectCustomId: string | null = null;
	let originalComponent:
		| { projectTaskId: string; status: string | null; updatedAt: number }
		| undefined;
	let originalCache:
		| { complete: number; entriesJson: string; expiresAt: number }
		| null
		| undefined;
	const testHistoryIds: number[] = [];
	let liveMutationStarted = false;

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

	const authenticateMember = async (page: Page, withProject = false) => {
		const payload = Buffer.from(
			JSON.stringify({
				user_id: memberId,
				role: "MEMBER",
				allowed_status: allowedStatuses,
				refreshed_at: Date.now(),
			}),
		).toString("base64url");
		const signature = createHmac("sha256", env("CLICKUP_CLIENT_SECRET"))
			.update(payload)
			.digest("base64url");
		const cookies = [
			{ name: "clickup_access_token", value: adminToken, url: baseURL },
			{ name: "ppic_session", value: `${payload}.${signature}`, url: baseURL },
		];
		if (withProject) {
			const projectPayload = Buffer.from(
				JSON.stringify({
					user_id: memberId,
					task_id: projectTaskId,
					name: projectName,
					custom_id: projectCustomId,
				}),
			).toString("base64url");
			const projectSignature = createHmac(
				"sha256",
				env("CLICKUP_CLIENT_SECRET"),
			)
				.update(projectPayload)
				.digest("base64url");
			cookies.push({
				name: "ppic_selected_project",
				value: `${projectPayload}.${projectSignature}`,
				url: baseURL,
			});
		}
		await page.context().addCookies(cookies);
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
		const serialResponse = await fetch(
			`https://api.clickup.com/api/v2/list/${env("CLICKUP_PPIC_PANEL_LIST_ID") || PANEL_LIST_ID}/task?${query}`,
			{ headers: clickUpHeaders(adminToken) },
		);
		expect(serialResponse.ok).toBeTruthy();
		const serialTasks = ((await serialResponse.json()) as { tasks?: ClickUpTask[] })
			.tasks;
		expect(serialTasks).toHaveLength(1);
		const component = serialTasks![0];
		componentTaskId = component.id;
		projectTaskId = component.top_level_parent ?? "";
		expect(projectTaskId).not.toBe("");
		expect(
			statusBarangScanKey(
				component.custom_fields?.find(
					(field) =>
						field.id ===
						(process.env.CLICKUP_FIELD_STATUS_BARANG_SCAN ||
							CF_PANEL.STATUS_BARANG_SCAN),
				)?.value,
			),
		).toBe("BARANG_DITERIMA");

		const projectResponse = await fetch(
			`https://api.clickup.com/api/v2/task/${projectTaskId}`,
			{ headers: clickUpHeaders(adminToken) },
		);
		expect(projectResponse.ok).toBeTruthy();
		const project = (await projectResponse.json()) as ClickUpTask;
		projectName = project.name ?? projectTaskId;
		projectCustomId = project.custom_id ?? null;

		const componentResult = await db.execute({
			sql: `
				SELECT project_task_id, status, updated_at
				FROM ppic_component_status
				WHERE component_task_id = ?
			`,
			args: [componentTaskId],
		});
		const componentRow = componentResult.rows[0];
		expect(componentRow).toBeTruthy();
		expect(String(componentRow.project_task_id)).toBe(projectTaskId);
		expect(String(componentRow.status)).toBe("BARANG_DITERIMA");
		originalComponent = {
			projectTaskId: String(componentRow.project_task_id),
			status:
				componentRow.status === null ? null : String(componentRow.status),
			updatedAt: Number(componentRow.updated_at),
		};

		const cacheResult = await db.execute({
			sql: `
				SELECT complete, entries_json, expires_at
				FROM ppic_project_serial_cache
				WHERE main_task_id = ?
			`,
			args: [projectTaskId],
		});
		const cacheRow = cacheResult.rows[0];
		originalCache = cacheRow
			? {
					complete: Number(cacheRow.complete),
					entriesJson: String(cacheRow.entries_json),
					expiresAt: Number(cacheRow.expires_at),
				}
			: null;

		const result = await db.execute({
			sql: `
				SELECT role, allowed_status, active, updated_by, updated_at
				FROM ppic_permissions
				WHERE clickup_user_id = ?
			`,
			args: [memberId],
		});
		const row = result.rows[0];
		expect(row).toBeTruthy();
		original = {
			role: String(row.role),
			allowedStatus: String(row.allowed_status),
			active: Number(row.active),
			updatedBy: String(row.updated_by),
			updatedAt: String(row.updated_at),
		};
		await db.execute({
			sql: `
				UPDATE ppic_permissions
				SET role = 'MEMBER', allowed_status = ?, active = 1,
					updated_by = ?, updated_at = CURRENT_TIMESTAMP
				WHERE clickup_user_id = ?
			`,
			args: [JSON.stringify(allowedStatuses), adminId, memberId],
		});
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

		if (testHistoryIds.length)
			await restore(() =>
				db.execute({
					sql: `DELETE FROM ppic_scan_history WHERE id IN (${testHistoryIds.map(() => "?").join(", ")})`,
					args: testHistoryIds,
				}),
			);

		const componentSnapshot = originalComponent;
		if (componentSnapshot)
			await restore(() =>
				db.execute({
					sql: `
						UPDATE ppic_component_status
						SET project_task_id = ?, status = ?, updated_at = ?
						WHERE component_task_id = ?
					`,
					args: [
						componentSnapshot.projectTaskId,
						componentSnapshot.status,
						componentSnapshot.updatedAt,
						componentTaskId,
					],
				}),
			);

		if (originalCache !== undefined)
			await restore(() =>
				originalCache
					? db.execute({
							sql: `
								INSERT INTO ppic_project_serial_cache (
									main_task_id, complete, entries_json, expires_at
								)
								VALUES (?, ?, ?, ?)
								ON CONFLICT(main_task_id) DO UPDATE SET
									complete = excluded.complete,
									entries_json = excluded.entries_json,
									expires_at = excluded.expires_at
							`,
							args: [
								projectTaskId,
								originalCache.complete,
								originalCache.entriesJson,
								originalCache.expiresAt,
							],
						})
					: db.execute({
							sql: "DELETE FROM ppic_project_serial_cache WHERE main_task_id = ?",
							args: [projectTaskId],
						}),
			);

		const permissionSnapshot = original;
		if (permissionSnapshot)
			await restore(() =>
				db.execute({
					sql: `
						UPDATE ppic_permissions
						SET role = ?, allowed_status = ?, active = ?, updated_by = ?, updated_at = ?
						WHERE clickup_user_id = ?
					`,
					args: [
						permissionSnapshot.role,
						permissionSnapshot.allowedStatus,
						permissionSnapshot.active,
						permissionSnapshot.updatedBy,
						permissionSnapshot.updatedAt,
						memberId,
					],
				}),
			);

		if (errors.length) throw errors[0];
	});

	test("member chooses a project and then a status before scanning", async ({
		page,
	}) => {
		await authenticateMember(page);

		await page.goto("/");
		await expect(page).toHaveURL(/\/projects$/);

		await page.goto("/sedang-dipacking");
		await expect(page).toHaveURL(/\/projects$/);

		const withoutProject = await page.request.post("/api/panel/scan", {
			data: {
				serial_number: "__playwright_missing_serial__",
				status: "SEDANG_DIPACKING",
			},
		});
		expect(withoutProject.status()).toBe(409);
		expect(await withoutProject.json()).toMatchObject({
			error: "NO_SELECTED_PROJECT",
		});

		await page.locator("article").filter({ hasText: projectName }).click();
		await expect(page).toHaveURL(/\/sedang-dipacking$/);
		await expect(
			page.getByRole("button", { name: "Choose scan status" }),
		).toContainText("Pilih status sebelum scan");
		await expect(page.getByRole("button", { name: /Buka scanner/i })).toBeDisabled();
		await expect(page.getByRole("button", { name: "Keyboard" })).toBeDisabled();

		await page.getByRole("button", { name: "Choose scan status" }).click();
		await expect(
			page.getByRole("menuitemradio", { name: "Sedang Dipacking" }),
		).toBeVisible();
		await expect(
			page.getByRole("menuitemradio", { name: "Terpasang / Digunakan" }),
		).toBeVisible();
		await expect(
			page.getByRole("menuitemradio", { name: "Barang Diterima" }),
		).toBeVisible();
		await page
			.getByRole("menuitemradio", { name: "Sedang Dipacking" })
			.click();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("button", { name: "Keyboard" })).toBeEnabled();

		await page.route("**/api/panel/scan", async (route) => {
			expect(route.request().postDataJSON()).toEqual({
				serial_number: "PW-SAFE-SERIAL",
				status: "SEDANG_DIPACKING",
			});
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ nama: "Playwright safe component" }),
			});
		});
		await page.getByRole("button", { name: "Keyboard" }).click();
		await page
			.getByRole("textbox", { name: "Input scan keyboard" })
			.fill("PW-SAFE-SERIAL");
		await expect(
			page.getByRole("heading", { name: "Status berhasil diubah" }),
		).toBeVisible();
	});

	test("real scan updates all three statuses and returns to Barang Diterima", async ({
		page,
	}) => {
		await authenticateMember(page, true);
		const sequence = [
			"SEDANG_DIPACKING",
			"TERPASANG_DIGUNAKAN",
			"BARANG_DITERIMA",
		] as const;

		for (const status of sequence) {
			liveMutationStarted = true;
			const response = await page.request.post("/api/panel/scan", {
				data: { serial_number: serialNumber, status },
			});
			expect(response.status()).toBe(200);
			expect(await response.json()).toMatchObject({
				serial_number: serialNumber,
			});

			await expect.poll(clickUpStatus).toBe(status);
			await expect
				.poll(async () => {
					const result = await db.execute({
						sql: "SELECT status FROM ppic_component_status WHERE component_task_id = ?",
						args: [componentTaskId],
					});
					return result.rows[0]?.status;
				})
				.toBe(status);

			const history = await db.execute({
				sql: `
					SELECT id
					FROM ppic_scan_history
					WHERE clickup_user_id = ?
						AND serial_number = ?
						AND project_task_id = ?
						AND component_task_id = ?
						AND status = ?
					ORDER BY id DESC
					LIMIT 1
				`,
				args: [
					memberId,
					serialNumber,
					projectTaskId,
					componentTaskId,
					status,
				],
			});
			const historyId = Number(history.rows[0]?.id);
			expect(historyId).toBeGreaterThan(0);
			expect(testHistoryIds).not.toContain(historyId);
			testHistoryIds.push(historyId);
		}

		await expect.poll(clickUpStatus).toBe("BARANG_DITERIMA");
	});
});
