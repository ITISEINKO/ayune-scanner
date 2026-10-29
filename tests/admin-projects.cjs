// Run after npm run build: node tests/admin-projects.cjs
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { spawn } = require("node:child_process");
const { chromium, expect } = require("@playwright/test");

(async () => {
	const baseURL = "http://127.0.0.1:3348";
	const secret = "local-project-filter-test";
	const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3348"], {
		env: { ...process.env, CLICKUP_CLIENT_SECRET: secret, TURSO_DATABASE_URL: "file::memory:", TURSO_AUTH_TOKEN: "local-test-only" },
		stdio: "pipe", windowsHide: true,
	});
	let browser;
	try {
		for (let attempt = 0; attempt < 100; attempt++) {
			try { if ((await fetch(`${baseURL}/login`)).ok) break; } catch {}
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		browser = await chromium.launch({ headless: true });
		const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
		await context.route("**/*", (route) => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
		const payload = Buffer.from(JSON.stringify({ user_id: "local-admin", role: "SUPER_ADMIN", allowed_status: null, refreshed_at: Date.now() })).toString("base64url");
		await context.addCookies([{ name: "ppic_session", value: `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`, url: baseURL }]);
		const page = await context.newPage();
		let writes = 0;
		let fail = true;
		const reads = [];
		let emptyStatus = null;
		let completedTasks = [{ id: "completed-project", custom_id: "DONE-001", name: "Completed wardrobe" }];
		const projectName = "Todo project · Meja Kerja Studio Contoh dengan lemari penyimpanan tambahan";
		await page.route("**/api/**", async (route) => {
			const request = route.request();
			const url = new URL(request.url());
			if (url.pathname !== "/api/projects") return route.fulfill({ status: 403, json: {} });
			if (request.method() === "POST") {
				writes++;
				assert.deepEqual(request.postDataJSON(), { task_id: "todo-project" });
				return route.fulfill(fail ? { status: 502, json: { error: "CLICKUP_ERROR" } } : { json: { task: { id: "todo-project", custom_id: "DEMO-003", name: projectName } } });
			}
			const status = url.searchParams.get("status");
			reads.push({ status, refresh: url.searchParams.get("refresh") });
			return route.fulfill({ json: { tasks: status === emptyStatus ? [] : status === "complete" ? completedTasks : status === "to do" ? [{ id: "todo-project", custom_id: "DEMO-003", name: projectName }] : [{ id: "ongoing-project", name: "Ongoing project" }] } });
		});
		const selectStatus = async (label) => {
			await page.getByRole("combobox", { name: "Status project" }).click();
			const insets = await page.getByRole("option").first().evaluate(option => {
				const item = option.getBoundingClientRect();
				const popup = option.closest('[data-slot="select-content"]').getBoundingClientRect();
				return { left: item.left - popup.left, right: popup.right - item.right };
			});
			assert.ok(insets.left > 0 && Math.abs(insets.left - insets.right) < 1, "dropdown options have equal left and right insets");
			await page.getByRole("option", { name: label, exact: true }).click();
		};
		await page.goto(`${baseURL}/admin/projects`);
		await expect(page.getByRole("link", { name: /Ongoing project/ })).toHaveAttribute("href", "/admin/project?task_id=ongoing-project");
		await expect(page.getByRole("dialog")).toHaveCount(0);
		assert.equal(reads.some(({ status }) => status === "complete"), false, "completed projects load only when selected");
		await expect(page.getByRole("tab")).toHaveCount(0);
		await selectStatus("Completed");
		await expect(page.getByRole("link", { name: /Completed wardrobe/ })).toHaveAttribute("href", "/admin/project?task_id=completed-project&review=completed");
		await expect(page.getByText("Project yang sudah selesai. Pilih project untuk melihat detail dan riwayatnya.")).toBeVisible();
		await expect(page.getByRole("button", { name: /Mulai project/ })).toHaveCount(0);
		await page.getByRole("searchbox", { name: "Cari project" }).fill("missing");
		await expect(page.getByRole("heading", { name: "Project tidak ditemukan", exact: true })).toBeVisible();
		await expect(page.getByText(/yang cocok dengan “missing”/)).toBeVisible();
		await page.screenshot({ path: "test-results/admin-projects-search-empty.png" });
		await page.getByRole("button", { name: "Hapus pencarian", exact: true }).focus();
		await page.keyboard.press("Enter");
		await expect(page.getByRole("searchbox", { name: "Cari project" })).toHaveValue("");
		await expect(page.getByRole("link", { name: /Completed wardrobe/ })).toBeVisible();
		await page.getByRole("searchbox", { name: "Cari project" }).fill(" done-001 ");
		await expect(page.getByRole("link", { name: /Completed wardrobe/ })).toBeVisible();
		await page.getByRole("searchbox", { name: "Cari project" }).fill("");
		await page.screenshot({ path: "test-results/admin-projects-completed.png" });
		await selectStatus("In progress");
		await expect(page.getByRole("link", { name: /Ongoing project/ })).toBeVisible();
		await expect(page.getByRole("link", { name: /Completed wardrobe/ })).toHaveCount(0);
		await selectStatus("Completed");
		assert.equal(reads.filter(({ status }) => status === "complete").length, 1, "returning to a status reuses its cache");
		completedTasks = [];
		await page.getByRole("button", { name: "Sync", exact: true }).click();
		await expect(page.getByRole("heading", { name: "Belum ada project selesai", exact: true })).toBeVisible();
		await expect(page.getByText("Project yang ditandai selesai akan muncul di sini, lengkap dengan ringkasan dan riwayatnya.")).toBeVisible();
		await expect.poll(() => page.locator('img[src="/empty-projects.svg"]').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
		await page.setViewportSize({ width: 350, height: 750 });
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "illustrated empty state fits narrow mobile screens");
		await page.screenshot({ path: "test-results/admin-projects-completed-empty.png" });
		assert.deepEqual(reads.at(-1), { status: "complete", refresh: "1" }, "Sync refreshes the selected status");
		assert.equal(writes, 0, "viewing completed projects never writes");
		await page.getByRole("button", { name: "Lihat project berjalan", exact: true }).click();
		await expect(page.getByRole("link", { name: /Ongoing project/ })).toBeVisible();
		emptyStatus = "to do";
		await selectStatus("Todo");
		await expect(page.getByRole("heading", { name: "Belum ada project Todo", exact: true })).toBeVisible();
		await page.getByRole("button", { name: "Lihat project berjalan", exact: true }).click();
		emptyStatus = "in progress";
		await page.getByRole("button", { name: "Sync", exact: true }).click();
		await expect(page.getByRole("heading", { name: "Belum ada project berjalan", exact: true })).toBeVisible();
		emptyStatus = null;
		await page.getByRole("button", { name: "Sync", exact: true }).click();
		await expect(page.getByRole("link", { name: /Ongoing project/ })).toBeVisible();
		await selectStatus("Todo");
		await page.getByRole("button", { name: "Sync", exact: true }).click();
		await page.setViewportSize({ width: 350, height: 750 });
		await expect(page.getByText("Belum dimulai", { exact: true })).toBeVisible();
		const projectTitle = page.getByRole("heading", { name: projectName, exact: true });
		await expect(projectTitle).toBeVisible();
		assert.equal(await projectTitle.evaluate((title) => title.scrollHeight <= title.clientHeight && title.scrollWidth <= title.clientWidth), true, "full project title wraps without clipping");
		const startButton = page.getByRole("button", { name: `Mulai project ${projectName}`, exact: true });
		const titleBounds = await projectTitle.boundingBox();
		const buttonBounds = await startButton.boundingBox();
		assert.ok(buttonBounds.y >= titleBounds.y + titleBounds.height && Math.abs(buttonBounds.width - titleBounds.width) < 2, "start button spans card content below the title");
		await expect(startButton).toHaveCSS("color", "rgb(255, 255, 255)");
		await page.screenshot({ path: "test-results/admin-projects-todo.png" });
		await page.getByRole("button", { name: /Todo project/ }).click();
		const dialog = page.getByRole("dialog", { name: `Mulai ${projectName}?` });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText("Status project di ClickUp berubah jadi In Progress.")).toBeVisible();
		await expect(dialog.getByText("Petugas langsung bisa memilih project ini dan mulai scan.")).toBeVisible();
		const mobileDialog = await dialog.boundingBox();
		assert.ok(Math.abs(mobileDialog.y + mobileDialog.height - 750) < 2, "mobile dialog sits at bottom");
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no mobile horizontal overflow");
		await page.screenshot({ path: "test-results/admin-projects-start-mobile.png" });
		await page.setViewportSize({ width: 1024, height: 800 });
		await expect.poll(async () => {
			const bounds = await dialog.boundingBox();
			return Math.abs(bounds.y + bounds.height / 2 - 400);
		}).toBeLessThan(2);
		await page.screenshot({ path: "test-results/admin-projects-start-desktop.png" });
		await page.setViewportSize({ width: 390, height: 844 });
		await dialog.getByRole("button", { name: "Nanti dulu", exact: true }).click();
		assert.equal(writes, 0);
		await page.getByRole("button", { name: /Todo project/ }).click();
		await dialog.getByRole("button", { name: "Ya, mulai", exact: true }).click();
		await expect(dialog.getByRole("alert")).toBeVisible();
		await expect(page).toHaveURL(`${baseURL}/admin/projects`);
		fail = false;
		await dialog.getByRole("button", { name: "Ya, mulai", exact: true }).click();
		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole("combobox", { name: "Status project" })).toContainText("In progress");
		await expect(page.getByRole("link", { name: /Todo project/ })).toHaveAttribute("href", "/admin/project?task_id=todo-project");
		await expect(page.getByRole("link", { name: /Ongoing project/ })).toBeVisible();
		await selectStatus("Todo");
		await expect(page.getByRole("button", { name: /Todo project/ })).toHaveCount(0);
		console.log("Admin status filter, illustrated empty states for all statuses/search, keyboard clear, recovery links, completed fetch/cache/Sync, detail links and Todo confirmation passed.");
	} finally {
		await browser?.close();
		server.kill();
	}
})().catch((error) => { console.error(error); process.exitCode = 1; });
