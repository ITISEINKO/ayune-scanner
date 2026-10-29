// Run after npm run build: node tests/panel-location.cjs
const assert = require("node:assert/strict");
const { readFileSync, writeFileSync, mkdtempSync, mkdirSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { createHmac, createHash } = require("node:crypto");
const { createClient } = require("@libsql/client");
const { chromium, expect } = require("@playwright/test");
const { transpileModule, ModuleKind } = require("typescript");
const { runInNewContext } = require("node:vm");
const { gzipSync } = require("node:zlib");

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
	panel.doorOpenType = "right"; writeFileSync(geometry, JSON.stringify(model));
	assert.equal(generate().status, 0);
	assert.equal(JSON.parse(readFileSync(location)).panels[0].doorOpenType, "right", "import must retain the source opening direction");
	assert.equal(JSON.parse(readFileSync(output)).panels[0].doorOpenType, "right");
	panel.doorOpenType = "unsupported"; writeFileSync(geometry, JSON.stringify(model));
	assert.equal(generate().status, 0);
	assert(!Object.hasOwn(JSON.parse(readFileSync(location)).panels[0], "doorOpenType"), "unsupported openings must not become hinged doors");
	delete panel.doorOpenType;
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
	assert.equal(helper.exports.panelDisplayName("顶板"), "Panel atas");
	assert.equal(helper.exports.panelDisplayName(" 左侧板 "), "Panel samping kiri");
	assert.equal(helper.exports.panelDisplayName("未知面板", "Panel 12"), "Panel 12");
	assert.equal(helper.exports.panelDisplayName("BOX LACI (F)"), "BOX LACI (F)");
	assert.equal(helper.exports.panelDisplayName(undefined), "Panel");
	const snapshot = require("../src/data/panel-locations/z96buhry4p.json");
	assert.equal(snapshot.panels.length, 231);
	assert(!/token|Signature|offer|materiel|texture|price/i.test(JSON.stringify(snapshot)));
	const named = helper.exports.withPanelLocationDetails(snapshot, require("../context/LBY_PANEL_MAPPING.json"));
	const door = named.panels.find(helper.exports.isDoorPanel);
	assert(door, "saved vendor panel names must identify doors");
	assert(!helper.exports.isDoorPanel({ panelName: "前踢脚板", roomName: "ENTRANCE DOOR" }), "door-room structural panels must remain visible");
	assert(!helper.exports.isDoorPanel({}), "unknown panel names must remain visible");
	assert(helper.exports.isDoorPanel({ panelName: "PINTU KIRI" }));
	assert.equal(helper.exports.withPanelLocationDetails(snapshot, { panels: [{ barcode: snapshot.panels[0].barcode, panelName: { invalid: true } }] }).panels[0].panelName, undefined);
	assert.equal(door.doorOpenType, "right", "legacy explicit right-opening door names remain usable");
	const box = { barcode: "door", roomName: "Room", panelNumber: "1", corners: [[0,0,0],[10,0,0],[10,1,0],[0,1,0],[0,0,20],[10,0,20],[10,1,20],[0,1,20]] };
	const distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
	for (const [opening, hinges, corner, expected] of [
		["left", [0,4], 1, [0,-10,0]], ["right", [1,5], 0, [10,-10,0]],
		["up", [4,5], 0, [0,-20,20]], ["bottom", [0,1], 4, [0,-20,0]],
	]) {
		const moving = { ...box, doorOpenType: opening };
		const opened = helper.exports.panelDoorCorners(moving, 1);
		assert(distance(opened[corner], expected) < 1e-8, `${opening} must use the vendor 90-degree direction`);
		for (const index of hinges) assert(distance(opened[index], box.corners[index]) < 1e-8, "hinge edge must stay fixed");
		for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++)
			assert(Math.abs(distance(opened[a], opened[b]) - distance(box.corners[a], box.corners[b])) < 1e-8, "door rotation must preserve every edge/diagonal");
		assert.equal(helper.exports.panelDoorCorners(moving, 0), box.corners, "closed geometry must return exactly to its source");
		const closedProjection = helper.exports.projectPanelLocations([moving], 0.8, -0.4, "door")[0];
		const axes = [0,1].map((axis) => [Math.min(...closedProjection.fitPoints.map((p) => p[axis])), Math.max(...closedProjection.fitPoints.map((p) => p[axis]))]);
		for (const progress of [0,0.1,0.5,0.9,1]) {
			const step = helper.exports.projectPanelLocations([moving], 0.8, -0.4, "door", progress)[0];
			assert(step.points.every((point) => axes.every(([min,max],axis) => point[axis] >= min - 1e-8 && point[axis] <= max + 1e-8)), "fixed fit must contain the entire swing");
		}
	}
	assert.equal(helper.exports.panelDoorCorners(box, 1), box.corners, "unknown opening directions must stay still");
	const rotatedDoor = { ...box, doorOpenType: "left", corners: box.corners.map(([x,y,z]) => [-y + 100, x + 50, z + 30]) };
	const rotatedOpen = helper.exports.panelDoorCorners(rotatedDoor, 1);
	assert(distance(rotatedOpen[1], [110,50,30]) < 1e-8, "hinge motion must follow rotated parent geometry");
	const projection = helper.exports.projectPanelLocations(snapshot.panels, -0.65, 0.35, "15370046376");
	assert(projection.every((p) => p.points.flat().every(Number.isFinite)));
	assert(projection.every((panel) => panel.explodeOffset.every(Number.isFinite)));
	assert(projection.some((panel) => Math.hypot(...panel.explodeOffset) > 0), "explode must separate off-centre panels");
	assert(projection.filter((panel) => panel.barcode !== "15370046376").every((panel) => panel.explodeOffset.every((value) => value === 0)), "surrounding panels must stay assembled");
	const normalProjection = helper.exports.projectPanelLocations(snapshot.panels, 0, 0, "15370046376").find((panel) => panel.barcode === "15370046376");
	assert.equal(normalProjection.explodeOffset.filter((value) => Math.abs(value) > 0.01).length, 1, "axis-aligned panel must pull along its normal, not diagonally");
	const turned = helper.exports.projectPanelLocations(snapshot.panels, 1.1, -0.5, "15370046376");
	projection.forEach((panel, index) => assert(Math.abs(Math.hypot(...panel.explodeOffset) - Math.hypot(...turned[index].explodeOffset)) < 1e-6, "rotating must preserve explode distance"));
	const centred = helper.exports.projectPanelLocations([clean.panels[0]], 0, 0, clean.panels[0].barcode);
	assert(centred[0].explodeOffset.every((value) => value === 0), "a centred single panel must stay stable");
	console.log("Offline checks passed: transform composition, cycle/missing-parent/duplicate rejection, sanitization, URL encoding and projection.");

	const databaseUrl = `file:${join(directory, "access.db").replaceAll("\\", "/")}`;
	const db = createClient({ url: databaseUrl });
	await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT PRIMARY KEY, role TEXT, active INTEGER, allowed_status TEXT)");
	await db.execute("INSERT INTO ppic_permissions VALUES ('viewer-test', 'MEMBER', 1, '[\"BARANG_DITERIMA\"]')");
	await db.execute("ALTER TABLE ppic_permissions ADD COLUMN can_import_lby INTEGER NOT NULL DEFAULT 0 CHECK(can_import_lby IN (0,1))");
	// Existing inactive revisions exercise additive numbering without rewriting their saved payloads.
	await db.execute(`CREATE TABLE ppic_panel_location_revision (project_id TEXT, revision TEXT, metadata_json TEXT,
		snapshot_gzip BLOB, mapping_gzip BLOB, imported_by TEXT, PRIMARY KEY(project_id, revision))`);
	for (const [project, revision] of [["legacy-numbering", "a"], ["legacy-numbering", "b"], ["z96buhr3eu", "c"]])
		await db.execute({ sql: "INSERT INTO ppic_panel_location_revision VALUES (?, ?, ?, ?, ?, ?)", args: [project, revision.repeat(64),
			JSON.stringify({ version: revision.repeat(12) }), gzipSync('{"panels":[]}'), gzipSync('{"panels":[]}'), "viewer-test"] });
	const originalRevisions = (await db.execute("SELECT * FROM ppic_panel_location_revision ORDER BY project_id, revision")).rows;
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
		await page.goto(`${baseURL}/cari-lokasi`); await expect(page).toHaveURL(/\/login/);
		assert.equal((await context.request.get(`${baseURL}/api/panel/location-version?project=z96buhry4p`)).status(), 401);
		const payload = Buffer.from(JSON.stringify({ user_id: "viewer-test", role: "MEMBER", allowed_status: ["BARANG_DITERIMA"], refreshed_at: Date.now() })).toString("base64url");
		const signature = createHmac("sha256", secret).update(payload).digest("base64url");
		await context.addCookies([{ name: "clickup_access_token", value: "local-viewer-test", url: baseURL },
			{ name: "ppic_session", value: `${payload}.${signature}`, url: baseURL }]);
		await page.goto(url);
		const activeVersionResponse = await context.request.get(`${baseURL}/api/panel/location-version?project=z96buhry4p`);
		assert.deepEqual(await activeVersionResponse.json(), { active: { version: snapshot.version, versionNumber: 1 } }, "bundled snapshots are V1");
		assert.deepEqual((await db.execute("SELECT version_number FROM ppic_panel_location_revision ORDER BY project_id, revision")).rows.map((row) => row.version_number), [1, 2, 2], "existing histories get per-model numbers, reserving V1 for bundled snapshots");
		assert.deepEqual((await db.execute("SELECT project_id, revision, metadata_json, snapshot_gzip, mapping_gzip, imported_by FROM ppic_panel_location_revision ORDER BY project_id, revision")).rows, originalRevisions, "numbering must preserve all original revision fields");
		await assert.rejects(db.execute("UPDATE ppic_panel_location_revision SET version_number=1 WHERE project_id='legacy-numbering' AND version_number=2"), /UNIQUE/, "two revisions in one model cannot share a version number");
		const svg = page.locator("svg[data-selected-barcode]");
		await expect(svg).toHaveAttribute("data-selected-barcode", "15370046376");
		await expect(svg).toHaveAttribute("data-panel-count", "15");
		await expect(page.getByRole("button", { name: /^(Putar (kiri|kanan|atas|bawah)|Perbesar|Perkecil)$/ })).toHaveCount(0);
		await expect(page.locator('[aria-label="Kontrol tampilan"]').getByRole("button")).toHaveCount(3);
		await expect(page.getByRole("region", { name: "Panel terpilih" })).toContainText("Panel 9");
		await expect(page.getByRole("region", { name: "Informasi panel", exact: true })).toContainText("Serial: 15370046376");
		await expect(page.getByRole("link", { name: "Kembali ke model", exact: true })).toHaveAttribute("href", "/drafter");
		assert.equal(await svg.locator('polygon[fill="#ef4444"]').count(), 6);
		const initialPoints = await svg.locator("polygon").first().getAttribute("points");
		await svg.focus(); await page.keyboard.press("ArrowRight");
		await expect(svg.locator("polygon").first()).not.toHaveAttribute("points", initialPoints);
		assert.deepEqual(hydrationErrors, [], "direct viewer load must hydrate without recovering from mismatched HTML");
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		await expect(svg.locator("polygon").first()).toHaveAttribute("points", initialPoints);
		await svg.focus(); await page.keyboard.press("ArrowLeft");
		await expect(svg.locator("polygon").first()).not.toHaveAttribute("points", initialPoints);
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		const bounds = await svg.boundingBox();
		await page.mouse.move(bounds.x + 50, bounds.y + 150); await page.mouse.down();
		await page.mouse.move(bounds.x + 100, bounds.y + 170); await page.mouse.up();
		await expect(svg.locator("polygon").first()).not.toHaveAttribute("points", initialPoints);
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		const initialBox = await svg.getAttribute("viewBox");
		const initialTransform = await svg.locator("polygon").first().evaluate((node) => getComputedStyle(node.parentElement).transform);
		const explodeSlider = page.getByRole("slider", { name: "Jarak explode" });
		await explodeSlider.focus(); await explodeSlider.press("Home"); await explodeSlider.press("ArrowRight");
		await expect(svg).toHaveAttribute("data-explode", "1");
		await page.getByRole("button", { name: "Explode panel", exact: true }).click();
		await expect(svg).toHaveAttribute("data-explode", "0");
		await page.getByRole("button", { name: "Explode panel", exact: true }).click();
		await expect(svg).toHaveAttribute("data-explode", "100");
		await expect(page.getByRole("button", { name: "Explode panel", exact: true })).toHaveAttribute("aria-pressed", "true");
		await expect.poll(() => svg.locator("polygon").first().evaluate((node) => getComputedStyle(node.parentElement).transform)).not.toBe(initialTransform);
		await expect(svg).toHaveAttribute("viewBox", initialBox, { timeout: 1000 });
		await expect(svg.locator("line")).toHaveCount(1);
		assert.equal(await svg.locator("g[data-barcode]").evaluateAll((groups) => groups.filter((group) => getComputedStyle(group).transform !== "matrix(1, 0, 0, 1, 0, 0)").length), 1, "only the selected panel moves");
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		await expect(svg).toHaveAttribute("data-explode", "0");
		await svg.focus(); await page.keyboard.press("+");
		await expect(svg).not.toHaveAttribute("viewBox", initialBox);
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		await svg.hover(); await page.mouse.wheel(0, -100);
		await expect.poll(async () => Number((await svg.getAttribute("viewBox")).split(" ")[2])).toBeLessThan(Number(initialBox.split(" ")[2]));
		await page.mouse.wheel(0, 100);
		await expect.poll(async () => Math.abs(Number((await svg.getAttribute("viewBox")).split(" ")[2]) - Number(initialBox.split(" ")[2]))).toBeLessThan(0.01);
		await svg.focus(); await page.keyboard.press("+");
		await expect(svg).not.toHaveAttribute("viewBox", initialBox);
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		// Native multi-touch exercises pointer capture and the transition back to one-finger rotation.
		const touch = await context.newCDPSession(page);
		const touchPoints = [{ x: bounds.x + 100, y: bounds.y + 200, id: 1 }, { x: bounds.x + 200, y: bounds.y + 200, id: 2 }];
		await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints });
		await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touchPoints[0], { ...touchPoints[1], x: bounds.x + 280 }] });
		await expect.poll(async () => Number((await svg.getAttribute("viewBox")).split(" ")[2])).toBeLessThan(Number(initialBox.split(" ")[2]));
		await expect(svg.locator("polygon").first()).toHaveAttribute("points", initialPoints);
		await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [{ ...touchPoints[1], x: bounds.x + 280 }] });
		await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...touchPoints[0], x: bounds.x + 130 }] });
		await expect(svg.locator("polygon").first()).not.toHaveAttribute("points", initialPoints);
		await touch.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
		await touch.detach();
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		mkdirSync("test-results", { recursive: true });
		await page.screenshot({ path: "test-results/panel-location-desktop.png", fullPage: true });
		await page.setViewportSize({ width: 390, height: 844 });
		assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
		const info = await page.getByRole("region", { name: "Informasi panel", exact: true }).boundingBox();
		assert(Math.abs(info.y + info.height - 844) <= 1, "standalone panel details meet the viewport bottom without navigation padding");
		assert((await svg.boundingBox()).height > 500, "standalone viewer fills the available canvas");
		await page.screenshot({ path: "test-results/panel-location-mobile.png", fullPage: true });
		await page.goto(`${baseURL}${helper.exports.panelLocationUrl("z96buhry4p", "15370046368")}`);
		await expect(svg).toHaveAttribute("data-selected-barcode", "15370046368");
		const kitchen = snapshot.panels.find((p) => p.roomName === "KITCHEN SET");
		await page.goto(`${baseURL}${helper.exports.panelLocationUrl("z96buhry4p", kitchen.barcode)}`);
		await expect(svg).toHaveAttribute("data-panel-count", "112");
		assert.equal(await svg.locator("path").count(), 111, "each background panel must render as one path");
		assert.equal(await svg.locator("polygon").count(), 6, "only the selected panel needs separate faces");
		const doors = named.panels.filter((panel) => panel.roomName === kitchen.roomName && panel.barcode !== kitchen.barcode && helper.exports.isDoorPanel(panel));
		const doorToggle = page.getByRole("button", { name: "Sembunyikan pintu", exact: true });
		await doorToggle.click();
		await expect(doorToggle).toHaveAttribute("aria-pressed", "true");
		await expect(svg.locator("path")).toHaveCount(111 - doors.length);
		await expect(svg.locator(`g[data-barcode="${kitchen.barcode}"]`)).toHaveCount(1);
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		await expect(svg.locator("path")).toHaveCount(111);
		const openToggle = page.getByRole("button", { name: "Buka/tutup pintu", exact: true });
		const doorGroup = svg.locator(`g[data-barcode="${doors[0].barcode}"] path`);
		const closedDoorPath = await doorGroup.getAttribute("d");
		const cabinetPath = await svg.locator(`g[data-barcode="${kitchen.barcode}"] polygon`).first().getAttribute("points");
		const closedBox = await svg.getAttribute("viewBox");
		await doorToggle.click();
		await openToggle.click();
		await expect(svg).toHaveAttribute("data-doors-hidden", "false");
		await expect(svg).toHaveAttribute("data-door-progress", "100");
		await expect(openToggle).toHaveAttribute("aria-pressed", "true");
		await expect(doorGroup).not.toHaveAttribute("d", closedDoorPath);
		await expect(svg).toHaveAttribute("viewBox", closedBox);
		await expect(svg.locator(`g[data-barcode="${kitchen.barcode}"] polygon`).first()).toHaveAttribute("points", cabinetPath);
		await page.screenshot({ path: "test-results/panel-location-open-doors-mobile.png", fullPage: true });
		await openToggle.click();
		await expect(svg).toHaveAttribute("data-door-progress", "0");
		await expect(doorGroup).toHaveAttribute("d", closedDoorPath);
		await openToggle.click(); await expect(svg).toHaveAttribute("data-door-progress", "100");
		await openToggle.click();
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		await page.waitForTimeout(100);
		await expect(svg).toHaveAttribute("data-door-progress", "0");
		await openToggle.click(); await openToggle.click();
		await expect(svg).toHaveAttribute("data-door-progress", "0");
		await page.emulateMedia({ reducedMotion: "reduce" });
		await openToggle.click();
		await expect(svg).toHaveAttribute("data-door-progress", "100");
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		await expect(svg).toHaveAttribute("data-door-progress", "0");
		await expect(openToggle).toHaveAttribute("aria-pressed", "false");
		await page.emulateMedia({ reducedMotion: null });
		assert(await svg.locator("path").evaluateAll((paths) => paths.every((path) =>
			path.getAttribute("d").split("M").filter(Boolean).every((face) => {
				const points = face.replace("Z", "").trim().split(/\s+/).map((point) => point.split(",").map(Number));
				return points.reduce((sum, point, index) => sum + point[0] * points[(index + 1) % points.length][1] - point[1] * points[(index + 1) % points.length][0], 0) >= -1e-6;
			}))), "combined paths must keep consistent winding so context fills do not cancel");
		await page.getByRole("button", { name: "Explode panel", exact: true }).click();
		await expect(svg).toHaveAttribute("data-explode", "100");
		await svg.focus(); await page.keyboard.press("ArrowRight");
		await expect.poll(() => svg.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
		await expect(svg.locator("g").first()).toHaveCSS("transition-duration", "0s");
		await explodeSlider.focus(); await explodeSlider.press("ArrowLeft");
		await expect(svg).toHaveAttribute("data-explode", "99");
		await expect(svg.locator("g").first()).toHaveCSS("transition-duration", "0s");
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.getByRole("button", { name: "Explode panel", exact: true }).click();
		await expect(svg).toHaveAttribute("data-explode", "100");
		await expect(svg.locator("g").first()).toHaveCSS("transition-duration", "0s");
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		await page.emulateMedia({ reducedMotion: null });
		await page.goto(`${baseURL}${helper.exports.panelLocationUrl("z96buhry4p", door.barcode)}`);
		await doorToggle.click();
		await expect(svg.locator(`g[data-barcode="${door.barcode}"] polygon`)).toHaveCount(6);
		await page.screenshot({ path: "test-results/panel-location-hidden-doors.png", fullPage: true });
		const catalog = require("../src/data/panel-locations/catalog.json");
		const fiordini = require(`../src/data/panel-locations/${catalog.z96buhr3eu.snapshot}`);
		const fiordiniPanel = fiordini.panels[0];
		await page.goto(`${baseURL}${helper.exports.panelLocationUrl("z96buhr3eu", fiordiniPanel.barcode)}`);
		await expect(page.getByRole("heading", { level: 1 })).toContainText("FIORDINI");
		await expect(svg).toHaveAttribute("data-selected-barcode", fiordiniPanel.barcode);
		await expect(svg).toHaveAttribute("data-panel-count", String(fiordini.panels.filter((p) => p.roomName === fiordiniPanel.roomName).length));
		assert.equal(await svg.locator('polygon[fill="#ef4444"]').count(), 6);
		assert.equal(await svg.locator("circle").count(), 0, "small panels must not be covered by a white marker");
		await svg.focus(); await page.keyboard.press("ArrowRight");
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.screenshot({ path: "test-results/panel-location-fiordini.png", fullPage: true });
		await page.goto(`${baseURL}/panel-location?project=z96buhry4p&barcode=unknown`);
		await expect(page.getByRole("status")).toContainText("Barcode tidak ditemukan");
		assert.equal(await svg.count(), 0);
		assert.equal((await context.request.get(`${baseURL}/panel-location?project=unknown&barcode=15370046376`)).status(), 200, "serial lookup does not depend on the ClickUp project");
		assert.equal((await context.request.get(`${baseURL}/panel-location?project=z96buhry4p&barcode=a&barcode=b`)).status(), 404);
		const memberRequests = [];
		const tracedFiles = JSON.parse(readFileSync(".next/server/app/(member)/cari-lokasi/page.js.nft.json", "utf8")).files;
		assert(tracedFiles.some((file) => file.endsWith("src/data/panel-locations/z96buhry4p.json")), "member search deployment must include bundled models");
		await context.route("**/api/ably/token**", (route) => route.fulfill({ status: 401, json: {} }));
		page.on("request", (request) => memberRequests.push({ method: request.method(), path: new URL(request.url()).pathname }));
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(`${baseURL}/cari-lokasi`);
		await expect(page.getByRole("heading", { name: "Cari lokasi panel", exact: true })).toBeVisible();
		await expect(page.getByText("Status Barang Scan", { exact: true })).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Choose scan status", exact: true })).toHaveCount(0);
		await expect(page.getByText("Pilih project", { exact: true })).toHaveCount(0);
		await page.screenshot({ path: "test-results/member-panel-search.png", fullPage: true });
		await page.getByRole("button", { name: "Keyboard", exact: true }).click();
		await page.getByRole("textbox", { name: "Input scan keyboard" }).fill(" 15370046376 ");
		await expect(page).toHaveURL(`${baseURL}/cari-lokasi?barcode=15370046376`);
		await expect(svg).toHaveAttribute("data-selected-barcode", "15370046376");
		await expect(svg).toHaveAttribute("data-panel-count", "15");
		await expect(page.getByRole("region", { name: "Informasi panel", exact: true })).toContainText("Serial: 15370046376");
		await expect(page.getByRole("button", { name: /Ubah status|Choose scan status/ })).toHaveCount(0);
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Cari", exact: true })).toHaveAttribute("aria-current", "page");
		assert.deepEqual(await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link").allTextContents(), ["Projects", "Cari", "History", "Profile"], "regular members keep member navigation on the result page");
		for (const width of [350, 390, 1024]) {
			await page.setViewportSize({ width, height: 844 });
			assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `member lookup fits ${width}px`);
			const infoBounds = await page.getByRole("region", { name: "Informasi panel", exact: true }).boundingBox();
			const navBounds = await page.getByRole("navigation", { name: "Main navigation" }).boundingBox();
			assert(Math.abs(infoBounds.y + infoBounds.height - navBounds.y) <= 1, "panel information meets bottom navigation without a gap or overlap");
			assert(!/\p{Script=Han}/u.test(await page.getByRole("region", { name: "Informasi panel", exact: true }).innerText()), "panel names display without Chinese characters");
			assert((await svg.boundingBox()).height > 400, "read-only viewer fills the available canvas");
			await page.screenshot({ path: `test-results/member-panel-location-${width}.png`, fullPage: true });
		}
		await page.getByRole("link", { name: "Scan panel lain", exact: true }).click();
		await expect(page).toHaveURL(`${baseURL}/cari-lokasi`);
		await page.getByRole("button", { name: "Keyboard", exact: true }).click();
		await page.getByRole("textbox", { name: "Input scan keyboard" }).fill("000123");
		await expect(page).toHaveURL(`${baseURL}/cari-lokasi?barcode=000123`);
		await expect(page.getByRole("main").getByRole("alert")).toContainText("Lokasi panel untuk serial ini belum tersedia");
		await expect(svg).toHaveCount(0);
		await page.getByRole("link", { name: "Scan panel lain", exact: true }).click();
		await expect(page.getByRole("heading", { name: "Cari lokasi panel", exact: true })).toBeVisible();
		await page.getByRole("button", { name: "Keyboard", exact: true }).click();
		await page.getByRole("textbox", { name: "Input scan keyboard" }).fill("x".repeat(101));
		await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Serial number terlalu panjang." })).toBeVisible();
		await expect(page).toHaveURL(`${baseURL}/cari-lokasi`);
		assert.equal((await context.request.get(`${baseURL}/cari-lokasi?barcode=${"x".repeat(101)}`)).status(), 404);
		assert.equal((await context.request.get(`${baseURL}/cari-lokasi?barcode=a&barcode=b`)).status(), 404);
		assert.deepEqual(memberRequests.filter(({ method, path }) => !["GET", "HEAD"].includes(method) || /^\/api\/(project|projects|panel\/manual)/.test(path)), [], "member location lookup must not select a project or call status APIs");
		await db.execute("UPDATE ppic_permissions SET active=0 WHERE clickup_user_id='viewer-test'");
		assert.equal((await context.request.get(`${baseURL}/api/panel/location-version?project=z96buhry4p`)).status(), 403);
		await page.goto(`${baseURL}/cari-lokasi`); await expect(page).toHaveURL(/\/unauthorized/);
		await page.goto(url); await expect(page).toHaveURL(/\/unauthorized/);
		await db.execute("UPDATE ppic_permissions SET can_import_lby=1 WHERE clickup_user_id='viewer-test'");
		const drafterPayload = Buffer.from(JSON.stringify({ user_id: "viewer-test", role: "MEMBER", allowed_status: null, can_import_lby: true, refreshed_at: Date.now() })).toString("base64url");
		await context.addCookies([{ name: "ppic_session", value: `${drafterPayload}.${createHmac("sha256", secret).update(drafterPayload).digest("base64url")}`, url: baseURL }]);
		const previewSnapshot = JSON.stringify({ ...snapshot, version: "cccccccccccc" });
		const previewMapping = '{"panels":[]}';
		const previewRevision = createHash("sha256").update(previewSnapshot).digest("hex");
		await db.execute({ sql: "UPDATE ppic_panel_location_revision SET revision=?, metadata_json=?, snapshot_gzip=?, mapping_gzip=? WHERE project_id='z96buhr3eu' AND revision=?",
			args: [previewRevision, JSON.stringify({ projectKey: "z96buhr3eu", name: "Candidate preview", version: "cccccccccccc",
				revision: previewRevision, mappingSha256: createHash("sha256").update(previewMapping).digest("hex") }),
				gzipSync(previewSnapshot), gzipSync(previewMapping), "c".repeat(64)] });
		await page.goto(`${baseURL}/panel-location?project=z96buhr3eu&barcode=15370046376&revision=${previewRevision}`);
		await expect(page.getByText("Preview versi V2", { exact: true })).toBeVisible();
		await expect(page.getByRole("heading", { level: 1 })).toContainText("Candidate preview");
		await expect(svg).toHaveAttribute("data-selected-barcode", "15370046376");
		await expect(page.getByRole("region", { name: "Informasi panel", exact: true })).toContainText("Serial: 15370046376");
		for (const width of [768, 1440]) {
			await page.setViewportSize({ width, height: 900 });
			const canvas = await svg.boundingBox();
			const details = await page.getByRole("region", { name: "Informasi panel", exact: true }).boundingBox();
			const slider = await page.getByRole("slider", { name: "Jarak explode" }).boundingBox();
			assert.equal(canvas.width, width, "desktop canvas uses the full viewport width");
			assert.equal(canvas.height, 900, "desktop details float without shrinking the canvas");
			assert(details.x > 0 && details.y + details.height < 900, "desktop panel details float above the viewport edges");
			assert(details.x + details.width < slider.x, "desktop details do not overlap explode controls");
			await expect(page.getByRole("status").filter({ hasText: "Preview versi V2" })).toBeVisible();
			assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
		}
		await page.screenshot({ path: "test-results/panel-location-preview.png", fullPage: true });
		await page.goto(`${baseURL}/cari-lokasi?barcode=15370046376`);
		assert.equal((await context.request.get(`${baseURL}/api/panel/location-version?project=z96buhry4p`)).status(), 200, "import-only users can check versions without scan permission");
		await expect(svg).toHaveAttribute("data-selected-barcode", "15370046376");
		const drafterNav = page.getByRole("navigation", { name: "Main navigation" });
		assert.deepEqual(await drafterNav.getByRole("link").allTextContents(), ["Models", "Cari", "Profile"], "drafter sessions retain their workspace navigation on shared search results");
		await drafterNav.getByRole("link", { name: "Models", exact: true }).click();
		await expect(page).toHaveURL(`${baseURL}/drafter`);
		assert.deepEqual(await drafterNav.getByRole("link").allTextContents(), ["Models", "Cari", "Profile"]);
		await drafterNav.getByRole("link", { name: "Cari", exact: true }).click();
		await expect(page).toHaveURL(`${baseURL}/cari-lokasi`);
		await expect(page.getByRole("heading", { name: "Cari lokasi panel", exact: true })).toBeVisible();
		assert.deepEqual(await drafterNav.getByRole("link").allTextContents(), ["Models", "Cari", "Profile"]);
		await db.execute("UPDATE ppic_permissions SET can_import_lby=0 WHERE clickup_user_id='viewer-test'");
		await page.goto(`${baseURL}/cari-lokasi?barcode=15370046376`); await expect(page).toHaveURL(/\/unauthorized/);
		assert.equal(external.length, 0, "viewer must not request vendor assets or services");
		assert.deepEqual(hydrationErrors, [], "barcode changes and reloads must not cause hydration errors");
		console.log("Browser checks passed: zero hydration errors, room-only viewer, read-only member search without project/status APIs, stable member/drafter navigation, rotate/reset/zoom, mobile fit, invalid inputs, login and fresh grant revocation; no external requests.");
	} catch (error) { console.error(logs); throw error; }
	finally { await browser?.close(); server.kill(); db.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
