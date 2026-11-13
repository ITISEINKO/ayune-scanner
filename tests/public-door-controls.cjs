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
		let legacy = false;
		let drawerOnly = false;
		await page.route('**/api/public-models/**', route => {
			if (drawerOnly) return route.fulfill({ json: [{ position: [-100,-10,0, 100,-10,0, 0,100,0], index: [0,1,2], number: '', doorOpenType: null, isDoor: false, hinges: [], drawerOffset: [0,-300,0] }] });
			const isDoor = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()) === rooms[0].id;
			return route.fulfill({ json: [{ position: [-1,-1,0, 1,-1,0, 0,1,0], index: [0,1,2], number: '', doorOpenType: isDoor ? 'left' : null, doorMotion: isDoor ? {pivot:[-1,0,0],axis:[0,0,1]} : null, isDoor, hinges: [], ...(legacy ? {} : { hingeCount: 0 }) }] });
		});
		await page.goto(`http://localhost:3000/panel-viewer/${rooms[0].model_id}?room=${rooms[0].id}`);
		const open = page.getByRole('button', {name:'Buka pintu'}), hide = page.getByRole('button', {name:'Sembunyikan pintu'});
		await page.locator('canvas').waitFor();
		assert(await page.getByText(/1 pintu belum memiliki engsel/).isVisible());
		for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
			await page.setViewportSize(viewport);
			const warning = await page.getByText(/1 pintu belum memiliki engsel/).boundingBox();
			const slider = await page.getByRole('slider', { name: 'Explode' }).boundingBox();
			assert(warning && slider && warning.y + warning.height <= slider.y, 'warning must remain above the slider');
			assert(slider.x >= 0 && slider.x + slider.width <= viewport.width && slider.y + slider.height <= viewport.height);
		}
		assert(await open.isEnabled() && await hide.isEnabled());
		await open.click();
		await page.waitForFunction(() => document.querySelector('canvas')?.dataset.doorProgress === '100');
		await hide.click();
		await page.getByRole('combobox', {name:'Ruangan'}).click();
		await page.getByRole('option', {name:rooms[1].name, exact:true}).click();
		await page.waitForFunction(() => document.querySelector('button[aria-label="Buka pintu"]')?.disabled);
		assert.equal(await page.getByText(/pintu belum memiliki engsel/).count(), 0);
		assert(await hide.isDisabled());
		assert.equal(await open.getAttribute('aria-pressed'), 'false');
		assert.equal(await hide.getAttribute('aria-pressed'), 'false');
		await page.getByRole('combobox', {name:'Ruangan'}).click();
		await page.getByRole('option', {name:rooms[0].name, exact:true}).click();
		await page.waitForFunction(() => !document.querySelector('button[aria-label="Buka pintu"]')?.disabled);
		assert(await hide.isEnabled());
		legacy = true;
		await page.reload();
		await page.getByText('Data engsel belum dapat diperiksa. Import ulang model untuk memeriksa.').waitFor();
		assert.equal(await page.getByText(/pintu belum memiliki engsel/).count(), 0);
		drawerOnly = true;
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.reload();
		const drawerButton = page.getByRole('button', { name: 'Buka laci' });
		await drawerButton.waitFor();
		const canvas = page.locator('canvas');
		const closed = await canvas.screenshot();
		await drawerButton.click();
		await page.waitForFunction(() => document.querySelector('canvas')?.dataset.doorProgress === '100');
		const opened = await canvas.screenshot();
		assert(!closed.equals(opened), 'opening must move the drawer');
		await drawerButton.click();
		await page.waitForFunction(() => document.querySelector('canvas')?.dataset.doorProgress === '0');
		assert(!opened.equals(await canvas.screenshot()), 'closing must move the drawer back');
		console.log('Door controls follow the selected room');
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
