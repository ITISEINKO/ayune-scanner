const assert = require('node:assert/strict');
const { gunzipSync } = require('node:zlib');
const { prepare, doorMotion } = require('../scripts/import-public-models.cjs');
const { Vector3, Quaternion } = require('three');
const model = { value: { orderId: '123', docs: [{ houseId: 'room', houseName: 'Room', models: [{ id: 'door', roomPlankIdx: '4', doorOpenType: 'left' }], renderModels: [{ modelId: 'door', geometry: { position: [0,0,0, 1,0,0, 0,1,0], index: { 0: 0, 1: 1, 2: 2 } } }] }] } };
const rooms = prepare(model, '123');
assert.deepEqual(JSON.parse(gunzipSync(rooms[0].data)), [{ id: 'door', position: [0,0,0, 1,0,0, 0,1,0], index: [0,1,2], uv: [], texture: null, color: null, number: '4', doorOpenType: 'left', doorMotion: null, isDoor: true, hinges: [] }]);
assert.deepEqual(prepare(model, '123', [{ orderId: '123', splitId: 'door', laberNumber: '000123' }])[0].matches, [{ id: 'door', serial: '000123', number: '4' }]);
assert.throws(() => prepare(model, '123', [{ orderId: 'other', splitId: 'door', laberNumber: '000123' }]), /Invalid panel mapping/);
const parent = { id: 'parent', position: [10,20,30], quaternion: [0,0,Math.SQRT1_2,Math.SQRT1_2], scale: [1,1,1] };
const door = { id: 'd', parentId: 'parent', position: [2,0,0], quaternion: [0,0,0,1], scale: [1,1,1], sizeX: 100, sizeZ: 200 };
const byId = new Map([[parent.id,parent],[door.id,door]]);
const near = (a,b) => assert(a.every((n,i) => Math.abs(n-b[i]) < 1e-6));
for (const [direction, pivot, axis] of [['left',[10,22,30],[0,0,1]], ['right',[10,122,30],[0,0,1]], ['up',[10,22,230],[0,1,0]], ['bottom',[10,22,30],[0,1,0]]]) {
	const motion = doorMotion(door, byId, direction); near(motion.pivot,pivot); near(motion.axis,axis);
	if (direction === 'left' || direction === 'right') {
		const edge = new Vector3(direction === 'left' ? 1 : -1,0,0).applyQuaternion(new Quaternion().fromArray(parent.quaternion));
		const angle = (direction === 'left' ? -1 : 1) * Math.PI / 2;
		near(edge.applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3().fromArray(motion.axis), angle)).toArray(), [1,0,0]);
	}
}
assert.equal(doorMotion({ ...door, parentId: 'missing' }, byId, 'left'), null);
model.value.docs[0].models[0].textureImage = '12345'; model.value.docs[0].models[0].color = 0x123456;
model.value.docs[0].renderModels[0].geometry.uv = [0,0, 1,0, 0,1];
const textured = JSON.parse(gunzipSync(prepare(model, '123')[0].data))[0];
assert.equal(textured.texture, '12345'); assert.equal(textured.color, 0x123456); assert.deepEqual(textured.uv, [0,0, 1,0, 0,1]);
model.value.docs[0].models.push({ id: 'hinge', parentId: 'door', className: 'BasePlankHardwareModel', name: 'hinge', hardwareFuncFlag: 'Y', objFileId: 'h1', instanceMatrix: [1,0,0,0,0,1,0,0,0,0,1,0,10,20,30,1] });
model.value.docs[0].renderHoleModels = [{ geometryType: 'h1', geometry: { position: [0,0,0,1,0,0,0,1,0], index: [] } }];
const hinge = JSON.parse(gunzipSync(prepare(model, '123')[0].data))[0].hinges[0];
assert.deepEqual(hinge.matrix.slice(12, 15), [10, 20, 30]);
assert.deepEqual(hinge.index, []);
assert.throws(() => prepare(model, '456'));
model.value.docs[0].renderModels[0].geometry.index[2] = 3;
assert.throws(() => prepare(model, '123'));
console.log('Public model import checks passed');
