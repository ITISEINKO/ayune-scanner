// Run after npm run build: node tests/admin-projects.cjs
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { spawn } = require("node:child_process");
const { chromium, expect } = require("@playwright/test");

(async () => {
	const baseURL = "http://127.0.0.1:3348";
	const secret = "local-project-tabs-test";
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
			return route.fulfill({ json: { tasks: url.searchParams.get("status") === "to do" ? [{ id: "todo-project", custom_id: "DEMO-003", name: projectName }] : [{ id: "ongoing-project", name: "Ongoing project" }] } });
		});
		await page.goto(`${baseURL}/admin/projects`);
		await expect(page.getByRole("link", { name: /Ongoing project/ })).toHaveAttribute("href", "/admin/project?task_id=ongoing-project");
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await page.getByRole("tab", { name: "Todo", exact: true }).click();
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
		await expect(page.getByRole("tab", { name: "In progress", exact: true })).toHaveAttribute("aria-selected", "true");
		await expect(page.getByRole("link", { name: /Todo project/ })).toHaveAttribute("href", "/admin/project?task_id=todo-project");
		await expect(page.getByRole("link", { name: /Ongoing project/ })).toBeVisible();
		await page.getByRole("tab", { name: "Todo", exact: true }).click();
		await expect(page.getByRole("button", { name: /Todo project/ })).toHaveCount(0);
		console.log("Admin tabs, original detail links, cancel, failure, confirmation and list movement passed.");
	} finally {
		await browser?.close();
		server.kill();
	}
})().catch((error) => { console.error(error); process.exitCode = 1; });
