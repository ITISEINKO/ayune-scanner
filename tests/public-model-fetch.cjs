const assert = require('node:assert/strict');
const { gunzipSync } = require('node:zlib');
const { fetchPublicModel } = require('../scripts/import-public-models.cjs');

const model = { value: { orderId: '123', docs: [{ houseId: 'room', models: [{ id: 'panel', roomPlankIdx: '4' }], renderModels: [{ modelId: 'panel', geometry: { position: [0,0,0,1,0,0,0,1,0], index: [0,1,2] } }] }] } };
const originalFetch = global.fetch;
(async () => {
	global.fetch = async (url) => new Response(JSON.stringify(url.includes('getByOrderId')
		? { code: 0, data: { model: JSON.stringify(model) } }
		: { code: 0, data: [{ orderId: '123', splitId: 'panel', laberNumber: '000123' }] }));
	const stages = [];
	const result = await fetchPublicModel({ orderId: '123' }, AbortSignal.timeout(5000), () => false, (stage) => stages.push(stage));
	assert.deepEqual(stages, ['downloading', 'panels', 'rooms', 'textures']);
	assert.equal(result.rooms[0].matches[0].serial, '000123');
	assert.equal(JSON.parse(gunzipSync(result.rooms[0].data))[0].id, 'panel');
	global.fetch = async () => new Response('', { status: 429 });
	await assert.rejects(fetchPublicModel({ orderId: '123' }, AbortSignal.timeout(5000)), /HTTP 429/);
	console.log('Public model fetch and mapping checks passed');
})().finally(() => { global.fetch = originalFetch; });
