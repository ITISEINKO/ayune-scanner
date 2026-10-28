// Run after npm run build: node tests/panel-location.cjs
const assert = require("node:assert/strict");
const { readFileSync, writeFileSync, mkdtempSync, mkdirSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { createHmac } = require("node:crypto");
const { createClient } = require("@libsql/client");
const { chromium, expect } = require("@playwright/test");
const { transpileModule, ModuleKind } = require("typescript");
const { runInNewContext } = require("node:vm");

async function main() {
	const directory = mkdtempSync(join(tmpdir(), "panel-location-test-"));
	const input = join(directory, "panels.json"), geometry = join(directory, "model.json");
	const output = join(directory, "mapping.json"), location = join(directory, "location.json");
	const panel = { id: "panel", className: "BasePlankModel", parentId: "parent", position: [1,0,0],
		quaternion: [0,0,0,1], scale: [1,1,1], sizeX: 4, sizeY: 6, sizeZ: 1 };
	const parent = { id: "parent", position: [10,20,30], scale: [2,2,2], quaternion: [0,0,Math.SQRT1_2,Math.SQRT1_2] };
	const response = { code: 0, data: [{ id: "record", laberNumber: "00123", splitId: "panel", roomName: "Room", roomPlankIdx: "1" }] };
	const model = { value: { orderId: "test-order", docs: [{ id: "doc", models: [panel, parent] }] } };
	writeFileSync(input, JSON.stringify(response)); writeFileSync(geometry, JSON.stringify(model));
	const generate = () => spawnSync(process.execPath, ["scripts/map-lby-panels.cjs", input, geometry, output, location], { encoding: "utf8" });
	assert.equal(generate().status, 0);
	const clean = JSON.parse(readFileSync(location));
	assert.equal(clean.panels[0].barcode, "00123");
	assert.deepEqual(clean.panels[0].corners[0], [10,22,30]);
	assert.deepEqual(clean.panels[0].corners[2], [-2,30,30], "parent rotation, scale and translation compose correctly");
	assert.deepEqual(Object.keys(clean.panels[0]).sort(), ["barcode", "corners", "panelNumber", "roomName"]);
	parent.parentId = "panel"; writeFileSync(geometry, JSON.stringify(model));
	assert.match(generate().stderr, /Cyclic parent/);
	delete parent.parentId; panel.parentId = "missing"; writeFileSync(geometry, JSON.stringify(model));
	assert.match(generate().stderr, /Missing parent/);
	panel.parentId = "parent"; writeFileSync(geometry, JSON.stringify(model));
	response.data.push({ ...response.data[0] }); writeFileSync(input, JSON.stringify(response));
	assert.match(generate().stderr, /Duplicate barcode/);
	const helper = { exports: {} };
	runInNewContext(transpileModule(readFileSync("src/lib/panelLocation.ts", "utf8"), {
		compilerOptions: { module: ModuleKind.CommonJS },
	}).outputText, { exports: helper.exports, module: helper, URLSearchParams });
	assert.equal(helper.exports.panelLocationUrl("project id", "00&1"), "/panel-location?project=project+id&barcode=00%261");
	const snapshot = require("../src/data/panel-locations/z96buhry4p.json");
	assert.equal(snapshot.panels.length, 231);
	assert(!/token|Signature|offer|materiel|texture|price/i.test(JSON.stringify(snapshot)));
	const projection = helper.exports.projectPanelLocations(snapshot.panels, -0.65, 0.35);
	assert(projection.every((p) => p.points.flat().every(Number.isFinite)));
	console.log("Offline checks passed: transform composition, cycle/missing-parent/duplicate rejection, sanitization, URL encoding and projection.");

	const databaseUrl = `file:${join(directory, "access.db").replaceAll("\\", "/")}`;
	const db = createClient({ url: databaseUrl });
	await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT PRIMARY KEY, role TEXT, active INTEGER, allowed_status TEXT)");
	await db.execute("INSERT INTO ppic_permissions VALUES ('viewer-test', 'MEMBER', 1, '[\"BARANG_DITERIMA\"]')");
	const baseURL = "http://127.0.0.1:3349", secret = "panel-viewer-local-test";
	const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3349"], {
		stdio: ["ignore", "pipe", "pipe"],
		env: { ...process.env, TURSO_DATABASE_URL: databaseUrl, TURSO_AUTH_TOKEN: "local-only", CLICKUP_CLIENT_SECRET: secret },
	});
	let logs = "", browser;
	server.stdout.on("data", (chunk) => { logs += chunk; }); server.stderr.on("data", (chunk) => { logs += chunk; });
	try {
		let ready = false;
		for (let i = 0; i < 80; i++) {
			try { await fetch(baseURL, { signal: AbortSignal.timeout(1000) }); ready = true; break; } catch {}
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		assert(ready, logs);
		browser = await chromium.launch();
		const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
		const external = [];
		await context.route("**/*", (route) => {
			if (new URL(route.request().url()).origin !== baseURL) { external.push(route.request().url()); return route.abort(); }
			return route.continue();
		});
		const url = `${baseURL}/panel-location?project=z96buhry4p&barcode=15370046376`;
		const page = await context.newPage();
		const hydrationErrors = [];
		page.on("pageerror", (error) => hydrationErrors.push(error.message));
		page.on("console", (message) => {
			if (message.type() === "error" && /hydration|hydrating|Minified React error #418/i.test(message.text()))
				hydrationErrors.push(message.text());
		});
		await page.goto(url); await expect(page).toHaveURL(/\/login/);
		const payload = Buffer.from(JSON.stringify({ user_id: "viewer-test", role: "MEMBER", allowed_status: ["BARANG_DITERIMA"], refreshed_at: Date.now() })).toString("base64url");
		const signature = createHmac("sha256", secret).update(payload).digest("base64url");
		await context.addCookies([{ name: "clickup_access_token", value: "local-viewer-test", url: baseURL },
			{ name: "ppic_session", value: `${payload}.${signature}`, url: baseURL }]);
		await page.goto(url);
		const svg = page.locator("svg[data-selected-barcode]");
		await expect(svg).toHaveAttribute("data-selected-barcode", "15370046376");
		await expect(svg).toHaveAttribute("data-panel-count", "15");
		await expect(page.getByRole("region", { name: "Panel terpilih" })).toContainText("Panel 9");
		assert.equal(await svg.locator('polygon[fill="#ef4444"]').count(), 6);
		const initialPoints = await svg.locator("polygon").first().getAttribute("points");
		await page.getByRole("button", { name: "Putar kanan", exact: true }).click();
		await expect(svg.locator("polygon").first()).not.toHaveAttribute("points", initialPoints);
		assert.deepEqual(hydrationErrors, [], "direct viewer load must hydrate without recovering from mismatched HTML");
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		await expect(svg.locator("polygon").first()).toHaveAttribute("points", initialPoints);
		await svg.focus(); await page.keyboard.press("ArrowLeft");
		await expect(svg.locator("polygon").first()).not.toHaveAttribute("points", initialPoints);
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		const bounds = await svg.boundingBox();
		await page.mouse.move(bounds.x + 50, bounds.y + 50); await page.mouse.down();
		await page.mouse.move(bounds.x + 100, bounds.y + 70); await page.mouse.up();
		await expect(svg.locator("polygon").first()).not.toHaveAttribute("points", initialPoints);
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		const initialBox = await svg.getAttribute("viewBox");
		await page.getByRole("button", { name: "Perbesar", exact: true }).click();
		await expect(svg).not.toHaveAttribute("viewBox", initialBox);
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		mkdirSync("test-results", { recursive: true });
		await page.screenshot({ path: "test-results/panel-location-desktop.png", fullPage: true });
		await page.setViewportSize({ width: 390, height: 844 });
		assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
		await page.screenshot({ path: "test-results/panel-location-mobile.png", fullPage: true });
		await page.goto(`${baseURL}${helper.exports.panelLocationUrl("z96buhry4p", "15370046368")}`);
		await expect(svg).toHaveAttribute("data-selected-barcode", "15370046368");
		const kitchen = snapshot.panels.find((p) => p.roomName === "KITCHEN SET");
		await page.goto(`${baseURL}${helper.exports.panelLocationUrl("z96buhry4p", kitchen.barcode)}`);
		await expect(svg).toHaveAttribute("data-panel-count", "112");
		const catalog = require("../src/data/panel-locations/catalog.json");
		const fiordini = require(`../src/data/panel-locations/${catalog.z96buhr3eu.snapshot}`);
		const fiordiniPanel = fiordini.panels[0];
		await page.goto(`${baseURL}${helper.exports.panelLocationUrl("z96buhr3eu", fiordiniPanel.barcode)}`);
		await expect(page.getByRole("heading", { level: 1 })).toContainText("FIORDINI");
		await expect(svg).toHaveAttribute("data-selected-barcode", fiordiniPanel.barcode);
		await expect(svg).toHaveAttribute("data-panel-count", String(fiordini.panels.filter((p) => p.roomName === fiordiniPanel.roomName).length));
		assert.equal(await svg.locator('polygon[fill="#ef4444"]').count(), 6);
		assert.equal(await svg.locator("circle").count(), 0, "small panels must not be covered by a white marker");
		await page.getByRole("button", { name: "Putar kanan", exact: true }).click();
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.screenshot({ path: "test-results/panel-location-fiordini.png", fullPage: true });
		await page.goto(`${baseURL}/panel-location?project=z96buhry4p&barcode=unknown`);
		await expect(page.getByRole("status")).toContainText("Barcode tidak ditemukan");
		assert.equal(await svg.count(), 0);
		assert.equal((await context.request.get(`${baseURL}/panel-location?project=unknown&barcode=15370046376`)).status(), 404);
		assert.equal((await context.request.get(`${baseURL}/panel-location?project=z96buhry4p&barcode=a&barcode=b`)).status(), 404);
		await db.execute("UPDATE ppic_permissions SET active=0 WHERE clickup_user_id='viewer-test'");
		await page.goto(url); await expect(page).toHaveURL(/\/unauthorized/);
		assert.equal(external.length, 0, "viewer must not request vendor assets or services");
		assert.deepEqual(hydrationErrors, [], "barcode changes and reloads must not cause hydration errors");
		console.log("Browser checks passed: zero hydration errors, direct auto-selection, room-only data, search, rotate/reset/zoom, mobile fit, invalid inputs, login and fresh member revocation; no external requests.");
	} catch (error) { console.error(logs); throw error; }
	finally { await browser?.close(); server.kill(); db.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
