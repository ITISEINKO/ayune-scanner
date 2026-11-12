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
		await page.route('**/api/public-models/**', route => route.fulfill({ json: [{ id: 'selected', position, index: [0,1,2,0,2,3], number: '', doorOpenType: null, isDoor: false, hinges: [] }] }));
		await page.goto(`http://localhost:3000/panel-viewer/${encodeURIComponent(room.model_id)}?${new URLSearchParams({ room: room.id, panel: 'selected' })}`);
		await page.locator('canvas').waitFor();
		await page.getByRole('button', { name: 'X-ray' }).click();
		const screenshot = await page.locator('canvas').screenshot();
		const redPixels = await page.evaluate(async (data) => {
			const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
			const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
			const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
			const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
			let count = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 180 && pixels[i + 1] < 150 && pixels[i + 2] < 150) count++;
			return count;
		}, screenshot.toString('base64'));
		assert(redPixels > 1000, `Selected panel should stay strongly red in X-ray; got ${redPixels} red pixels`);
		console.log('Selected panel contrast in X-ray passed');
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
