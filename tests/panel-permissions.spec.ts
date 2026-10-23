import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { expect, test, type Page } from "@playwright/test";
import { clickUpHeaders } from "../src/lib/clickup";
import { ppicStatuses } from "../src/types/ppic";
import type { PpicRole, PpicStatus, PpicStatuses } from "../src/types/ppic";

test.describe("Admin member settings", () => {
	test.describe.configure({ mode: "serial" });
	test.skip(
		process.env.RUN_ADMIN_SETTINGS_TEST !== "1",
		"Set RUN_ADMIN_SETTINGS_TEST=1 to run the live permission fixture",
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
	const adminToken = env("CLICKUP_TOKEN");
	const db = createClient({
		url: env("TURSO_DATABASE_URL"),
		authToken: env("TURSO_AUTH_TOKEN"),
	});
	const statusLabels = {
		BARANG_DITERIMA: "Barang Diterima",
		SEDANG_DIPACKING: "Sedang Dipacking",
		TERPASANG_DIGUNAKAN: "Terpasang / Digunakan",
		DALAM_PROSES_RETUR: "Dalam Proses Retur",
	} as const;
	let memberName = "";
	let original:
		| {
				role: PpicRole;
				allowedStatus: string;
				active: number;
				updatedBy: string;
				updatedAt: string;
		  }
		| undefined;

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

	const readMember = async () => {
		const result = await db.execute({
			sql: `
				SELECT role, allowed_status, active, updated_by, updated_at
				FROM ppic_permissions
				WHERE clickup_user_id = ?
			`,
			args: [memberId],
		});
		return result.rows[0];
	};

	const stateOf = async () => {
		const row = await readMember();
		return {
			role: row?.role,
			active: Number(row?.active),
			statuses: (ppicStatuses(row?.allowed_status) ?? []).toSorted(),
		};
	};

	const openMember = async (page: Page) => {
		await page.getByRole("textbox", { name: "Search by name" }).fill(memberName);
		const card = page.locator("article").filter({ hasText: memberName });
		await expect(card).toBeVisible();
		await card.getByRole("button", { name: "Atur" }).click();
		await expect(page.getByRole("dialog")).toContainText(memberName);
		await page.getByRole("tab", { name: "Akses halaman", exact: true }).click();
		return page.getByRole("dialog");
	};

	const setStatuses = async (page: Page, statuses: PpicStatuses) => {
		for (const [status, label] of Object.entries(statusLabels)) {
			const checkbox = page.getByRole("checkbox", { name: label });
			if (
				(await checkbox.isChecked()) !== statuses.includes(status as PpicStatus)
			)
				await checkbox.click();
		}
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

		const row = await readMember();
		expect(row).toBeTruthy();
		original = {
			role: row.role as PpicRole,
			allowedStatus: String(row.allowed_status),
			active: Number(row.active),
			updatedBy: String(row.updated_by),
			updatedAt: String(row.updated_at),
		};
	});

	test.afterAll(async () => {
		const snapshot = original;
		if (!snapshot) return;
		const errors: unknown[] = [];
		const restore = async (work: () => Promise<unknown>) => {
			try {
				await work();
			} catch (error) {
				errors.push(error);
			}
		};
		const post = async (body: object) => {
			const response = await fetch(`${baseURL}/api/panel/members`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: `clickup_access_token=${adminToken}; ppic_session=${sessionCookie()}`,
				},
				body: JSON.stringify(body),
			});
			if (!response.ok) throw new Error("Realtime permission restore failed");
		};

		await restore(() => post({ user_id: memberId, role: snapshot.role }));
		if (snapshot.role === "MEMBER")
			await restore(() =>
				post({
					user_id: memberId,
					allowed_status: snapshot.active
						? ppicStatuses(snapshot.allowedStatus)
						: null,
				}),
			);
		await restore(() =>
			db.execute({
				sql: `
					UPDATE ppic_permissions
					SET role = ?, allowed_status = ?, active = ?, updated_by = ?, updated_at = ?
					WHERE clickup_user_id = ?
				`,
				args: [
					snapshot.role,
					snapshot.allowedStatus,
					snapshot.active,
					snapshot.updatedBy,
					snapshot.updatedAt,
					memberId,
				],
			}),
		);
		if (errors.length) throw errors[0];
	});

	test("admin changes member statuses and the cache survives reload", async ({
		page,
	}) => {
		await authenticateAdmin(page);
		await page.goto("/admin/settings");
		await expect(
			page.getByRole("heading", { name: "Akses halaman PPIC" }),
		).toBeVisible();

		const membersResponse = await page.request.get("/api/panel/members");
		expect(membersResponse.status()).toBe(200);
		const members = (await membersResponse.json()) as {
			members?: { id: string; name: string }[];
		};
		memberName =
			members.members?.find((member) => member.id === memberId)?.name ?? "";
		expect(memberName).not.toBe("");

		let dialog = await openMember(page);
		await dialog.getByRole("button", { name: "Member", exact: true }).click();
		await setStatuses(page, [
			"BARANG_DITERIMA",
			"SEDANG_DIPACKING",
			"TERPASANG_DIGUNAKAN",
			"DALAM_PROSES_RETUR",
		]);
		await dialog.getByRole("button", { name: "Simpan" }).click();
		await expect(page.getByText("Akses berhasil diperbarui.")).toBeVisible();
		await expect
			.poll(stateOf)
			.toEqual({
				role: "MEMBER",
				active: 1,
				statuses: [
					"BARANG_DITERIMA",
					"SEDANG_DIPACKING",
					"TERPASANG_DIGUNAKAN",
					"DALAM_PROSES_RETUR",
				].toSorted(),
			});

		dialog = await openMember(page);
		for (const label of Object.values(statusLabels))
			await expect(dialog.getByRole("checkbox", { name: label })).toBeChecked();
		await dialog.getByRole("button", { name: "Batal" }).click();

		await page.reload();
		dialog = await openMember(page);
		for (const label of Object.values(statusLabels))
			await expect(dialog.getByRole("checkbox", { name: label })).toBeChecked();
	});

	test("admin promotes and safely demotes a member", async ({ page }) => {
		await authenticateAdmin(page);
		await page.goto("/admin/settings");
		let dialog = await openMember(page);
		await dialog.getByRole("button", { name: "Admin", exact: true }).click();
		for (const label of Object.values(statusLabels))
			await expect(dialog.getByRole("checkbox", { name: label })).toBeDisabled();
		await dialog.getByRole("button", { name: "Simpan" }).click();
		await expect(page.getByText("Akses berhasil diperbarui.")).toBeVisible();
		await expect.poll(stateOf).toMatchObject({ role: "SUPER_ADMIN" });

		const statusForAdmin = await page.request.post("/api/panel/members", {
			data: { user_id: memberId, allowed_status: ["BARANG_DITERIMA"] },
		});
		expect(statusForAdmin.status()).toBe(400);
		expect(await statusForAdmin.json()).toMatchObject({
			error: "INVALID_PERMISSION",
		});
		const conflicting = await page.request.post("/api/panel/members", {
			data: {
				user_id: memberId,
				role: "MEMBER",
				allowed_status: ["BARANG_DITERIMA"],
			},
		});
		expect(conflicting.status()).toBe(400);

		await page.reload();
		dialog = await openMember(page);
		await expect(dialog).toContainText("Admin");
		await dialog.getByRole("button", { name: "Member", exact: true }).click();
		await setStatuses(page, ["TERPASANG_DIGUNAKAN"]);
		await dialog.getByRole("button", { name: "Simpan" }).click();
		await expect(page.getByText("Akses berhasil diperbarui.")).toBeVisible();
		await expect
			.poll(stateOf)
			.toEqual({
				role: "MEMBER",
				active: 1,
				statuses: ["TERPASANG_DIGUNAKAN"],
			});

		await page.reload();
		dialog = await openMember(page);
		await expect(dialog.getByRole("checkbox", { name: "Terpasang / Digunakan" })).toBeChecked();
		await expect(dialog.getByRole("checkbox", { name: "Barang Diterima" })).not.toBeChecked();
		await expect(dialog.getByRole("checkbox", { name: "Sedang Dipacking" })).not.toBeChecked();
	});
});
