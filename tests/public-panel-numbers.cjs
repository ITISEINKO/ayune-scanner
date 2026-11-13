const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { Vector3 } = require('three');

(async () => {
	const browser = await chromium.launch({ headless: true });
	try {
		const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
		const direction = new Vector3(1.5, -1.5, 1).normalize();
		const right = new Vector3().crossVectors(direction, new Vector3(0, 0, 1)).normalize();
		const up = new Vector3().crossVectors(right, direction).normalize();
		const panel = (distance, number) => ({
			position: [[-1,-1], [1,-1], [1,1], [-1,1]].flatMap(([x,y]) => direction.clone().multiplyScalar(distance).addScaledVector(right, x).addScaledVector(up, y).toArray()),
			index: [0,1,2,0,2,3], number, doorOpenType: null, isDoor: false, hinges: [],
		});
		let visibleNumber = false;
		await page.route('**/api/public-models/**', route => route.fulfill({ json: [panel(-0.2, '88'), panel(0.2, visibleNumber ? '88' : '')] }));
		async function labelPixels() {
			await page.goto('http://localhost:3000/panel-viewer/814606578513608858');
			await page.locator('canvas').waitFor();
			const slider = page.getByRole('slider', { name: 'Explode' });
			const box = await slider.locator('..').locator('..').boundingBox();
			await page.mouse.move(box.x + 8, box.y + box.height / 2);
			await page.mouse.down();
			await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2, { steps: 5 });
			await page.mouse.up();
			assert(Number(await slider.inputValue()) > 0, 'dragging must update the explode value');
			assert.match(await page.locator('output').innerText(), /^[1-9]\d*%$/, 'explode percentage must remain numeric');
			await slider.focus();
			await page.keyboard.press('Home');
			await page.getByRole('button', { name: 'Nomor panel' }).click();
			const screenshot = await page.locator('canvas').screenshot();
			return page.evaluate(async (data) => {
				const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
				const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
				const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
				const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
				let count = 0; for (let y = canvas.height * 0.3; y < canvas.height * 0.7; y++) for (let x = canvas.width * 0.3; x < canvas.width * 0.7; x++) { const i = (y * canvas.width + x) * 4; if (pixels[i] < 150 && pixels[i + 1] < 150 && pixels[i + 2] < 150) count++; }
				return count;
			}, screenshot.toString('base64'));
		}
		assert.equal(await labelPixels(), 0, 'a number behind an opaque panel must be hidden');
		visibleNumber = true;
		assert(await labelPixels() > 0, 'a number on the visible panel must appear');
		console.log('Panel number occlusion passed');
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
