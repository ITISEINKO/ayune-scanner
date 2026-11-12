const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');

(async () => {
	const browser = await chromium.launch({ headless: true });
	try {
		const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
		await page.goto('http://localhost:3000/panel-viewer/814606578513608858');
		const canvas = page.locator('canvas'); await canvas.waitFor();
		const door = page.getByRole('button', { name: 'Buka pintu' });
		await door.click(); await page.waitForTimeout(150);
		const midway = Number(await canvas.getAttribute('data-door-progress'));
		assert(midway > 0 && midway < 100, `Expected intermediate progress, got ${midway}`);
		await door.click();
		await page.waitForFunction(() => document.querySelector('canvas')?.dataset.doorProgress === '0');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await door.click();
		await page.waitForFunction(() => document.querySelector('canvas')?.dataset.doorProgress === '100');
		console.log('Door animation, reversal and reduced motion passed');
	} finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
