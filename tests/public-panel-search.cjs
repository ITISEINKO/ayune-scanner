const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { chromium } = require('@playwright/test');

(async () => {
	const db = new DatabaseSync('.local-backups/public-models.sqlite', { readOnly: true });
	const sample = db.prepare("SELECT model_id, room_id, panel_id, serial, number FROM panel_search WHERE serial <> '' AND number <> '' LIMIT 1").get();
	db.close();
	assert(sample, 'Import at least one model with serial mappings before this check');
	const browser = await chromium.launch({ headless: true });
	try {
		const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
		const requests = [];
		page.on('request', request => requests.push(request.url()));
		await page.goto('http://localhost:3000/panel-viewer');
		await page.getByLabel('Serial atau nomor panel').fill(sample.serial);
		await page.getByRole('button', { name: 'Cari', exact: true }).click();
		const link = page.locator('section[aria-label="Hasil pencarian"] a').filter({ hasText: sample.serial }).first();
		await link.waitFor();
		const target = new URL(await link.getAttribute('href'), 'http://localhost:3000');
		assert.equal(target.pathname, `/panel-viewer/${sample.model_id}`);
		assert.equal(target.searchParams.get('room'), sample.room_id);
		assert.equal(target.searchParams.get('panel'), sample.panel_id);
		await link.click();
		await page.locator('canvas').waitFor();
		await page.goto('http://localhost:3000/panel-viewer');
		await page.getByLabel('Serial atau nomor panel').fill(sample.number);
		await page.getByRole('button', { name: 'Cari', exact: true }).click();
		await page.locator('section[aria-label="Hasil pencarian"] a').filter({ hasText: sample.serial }).first().waitFor();
		assert(!requests.some(url => /clickup|find-task|panel\/scan/i.test(url)), 'search must not call ClickUp or the production scan API');
		console.log('Serial search opens the matching model and room without ClickUp');
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
