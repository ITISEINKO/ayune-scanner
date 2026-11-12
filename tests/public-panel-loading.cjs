const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { chromium } = require('@playwright/test');

(async () => {
	const db = new DatabaseSync('.local-backups/public-models.sqlite', { readOnly: true });
	const room = db.prepare('SELECT model_id, id FROM rooms LIMIT 1').get();
	db.close();
	assert(room, 'Import a model before running this check');
	const browser = await chromium.launch({ headless: true });
	try {
		const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
		await page.route('**/api/public-models/**', route => route.fulfill({ json: [{ id: 'panel', position: [-1,-1,0, 1,-1,0, 0,1,0], index: [0,1,2], uv: [0,0, 1,0, 0,1], texture: '123', number: '', doorOpenType: null, isDoor: false, hinges: [] }] }));
		let release;
		const gate = new Promise(resolve => { release = resolve; });
		let started;
		const requested = new Promise(resolve => { started = resolve; });
		await page.route('**/api/public-textures/123', async route => { started(); await gate; await route.fulfill({ status: 404 }); });
		await page.goto(`http://localhost:3000/panel-viewer/${encodeURIComponent(room.model_id)}?${new URLSearchParams({ room: room.id })}`, { waitUntil: 'domcontentloaded' });
		await requested;
		const loader = page.getByRole('status').filter({ hasText: 'Memuat model' });
		await loader.waitFor({ state: 'visible' });
		assert(await loader.evaluate(el => {
			const reference = document.createElement('div'); reference.className = 'bg-background'; document.body.appendChild(reference);
			const opaque = getComputedStyle(el.parentElement).backgroundColor === getComputedStyle(reference).backgroundColor;
			reference.remove(); return opaque;
		}), 'loading overlay must use the opaque background');
		release();
		await loader.waitFor({ state: 'hidden' });
		await page.locator('canvas').waitFor({ state: 'visible' });
		await page.unroute('**/api/public-textures/123');
		await page.route('**/api/public-textures/123', route => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X+X8AAAAASUVORK5CYII=', 'base64') }));
		await page.reload({ waitUntil: 'domcontentloaded' });
		await page.locator('canvas').waitFor();
		await loader.waitFor({ state: 'hidden' });
		console.log('Viewer waits for textures and recovers from a failed texture');
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
