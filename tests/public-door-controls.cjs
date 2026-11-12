const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { chromium } = require('@playwright/test');

(async () => {
	const db = new DatabaseSync('.local-backups/public-models.sqlite', { readOnly: true });
	const rooms = db.prepare('SELECT model_id, id, name FROM rooms WHERE model_id = (SELECT model_id FROM rooms GROUP BY model_id HAVING COUNT(*) > 1 LIMIT 1) LIMIT 2').all();
	db.close(); assert.equal(rooms.length, 2);
	const browser = await chromium.launch({ headless: true });
	try {
		const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
		await page.route('**/api/public-models/**', route => {
			const isDoor = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()) === rooms[0].id;
			return route.fulfill({ json: [{ position: [-1,-1,0, 1,-1,0, 0,1,0], index: [0,1,2], number: '', doorOpenType: isDoor ? 'left' : null, doorMotion: isDoor ? {pivot:[-1,0,0],axis:[0,0,1]} : null, isDoor, hinges: [] }] });
		});
		await page.goto(`http://localhost:3000/panel-viewer/${rooms[0].model_id}?room=${rooms[0].id}`);
		const open = page.getByRole('button', {name:'Buka pintu'}), hide = page.getByRole('button', {name:'Sembunyikan pintu'});
		await page.locator('canvas').waitFor();
		assert(await open.isEnabled() && await hide.isEnabled());
		await open.click(); await hide.click();
		await page.getByRole('combobox', {name:'Ruangan'}).click();
		await page.getByRole('option', {name:rooms[1].name, exact:true}).click();
		await page.waitForFunction(() => document.querySelector('button[aria-label="Buka pintu"]')?.disabled);
		assert(await hide.isDisabled());
		assert.equal(await open.getAttribute('aria-pressed'), 'false');
		assert.equal(await hide.getAttribute('aria-pressed'), 'false');
		await page.getByRole('combobox', {name:'Ruangan'}).click();
		await page.getByRole('option', {name:rooms[0].name, exact:true}).click();
		await page.waitForFunction(() => !document.querySelector('button[aria-label="Buka pintu"]')?.disabled);
		assert(await hide.isEnabled());
		console.log('Door controls follow the selected room');
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
