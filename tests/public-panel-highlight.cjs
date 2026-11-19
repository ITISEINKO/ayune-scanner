const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { chromium } = require('@playwright/test');
const { Vector3 } = require('three');

(async () => {
	const db = new DatabaseSync('.local-backups/public-models.sqlite', { readOnly: true });
	const room = db.prepare('SELECT model_id, id FROM rooms LIMIT 1').get();
	db.close();
	assert(room, 'Import a model before running this check');
	const browser = await chromium.launch({ headless: true });
	try {
		const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
		const direction = new Vector3(1.5, -1.5, 1).normalize();
		const right = new Vector3().crossVectors(direction, new Vector3(0, 0, 1)).normalize();
		const up = new Vector3().crossVectors(right, direction).normalize();
		const position = [[-1,-1], [1,-1], [1,1], [-1,1]].flatMap(([x,y]) => new Vector3().addScaledVector(right, x).addScaledVector(up, y).toArray());
		const frontPosition = position.map((value, index) => value + direction.toArray()[index % 3] * 0.2);
		await page.route('**/api/public-models/**', route => route.fulfill({ json: [{ id: 'selected', position, index: [0,1,2,0,2,3], number: '', doorOpenType: null, isDoor: false, hinges: [] }, { id: 'front', position: frontPosition, index: [0,1,2,0,2,3], number: '', doorOpenType: null, isDoor: false, hinges: [] }] }));
		await page.goto(`http://localhost:3000/panel-viewer/${encodeURIComponent(room.model_id)}?${new URLSearchParams({ room: room.id, panel: 'selected' })}`);
		await page.locator('canvas').waitFor();
		for (const mode of ['normal', 'X-ray']) {
		if (mode === 'X-ray') await page.getByRole('button', { name: 'X-ray' }).click();
		const screenshot = await page.locator('canvas').screenshot();
		const { redPixels, centerRed } = await page.evaluate(async (data) => {
			const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
			const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
			const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
			const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
			let count = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 180 && pixels[i + 1] > 100 && pixels[i + 1] < 200 && pixels[i + 2] > 100 && pixels[i + 2] < 200) count++;
			const center = (Math.floor(image.height / 2) * image.width + Math.floor(image.width / 2)) * 4;
			return { redPixels: count, centerRed: pixels[center] > pixels[center + 1] + 30 && pixels[center] > pixels[center + 2] + 30 };
		}, screenshot.toString('base64'));
		assert(redPixels > 20, `Occluded selected panel should retain a visible outline in ${mode}`);
		if (mode === 'normal') assert(!centerRed, 'Occluded panel should not tint the center of the panel in front');
		}
		console.log('Occluded selected panel in normal and X-ray views passed');
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
