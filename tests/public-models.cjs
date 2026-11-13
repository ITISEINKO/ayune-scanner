const assert = require('node:assert/strict');
const { gunzipSync } = require('node:zlib');
const { prepare, doorMotion } = require('../scripts/import-public-models.cjs');
const { Vector3, Quaternion } = require('three');
const model = { value: { orderId: '123', docs: [{ houseId: 'room', houseName: 'Room', models: [{ id: 'door', roomPlankIdx: '4', doorOpenType: 'left' }], renderModels: [{ modelId: 'door', geometry: { position: [0,0,0, 1,0,0, 0,1,0], index: { 0: 0, 1: 1, 2: 2 } } }] }] } };
const rooms = prepare(model, '123');
assert.deepEqual(JSON.parse(gunzipSync(rooms[0].data)), [{ id: 'door', position: [0,0,0, 1,0,0, 0,1,0], index: [0,1,2], uv: [], texture: null, color: null, number: '4', doorOpenType: 'left', doorMotion: null, isDoor: true, hinges: [], hingeCount: 0 }]);
assert.deepEqual(prepare(model, '123', [{ orderId: '123', splitId: 'door', laberNumber: '000123' }])[0].matches, [{ id: 'door', serial: '000123', number: '4' }]);
assert.throws(() => prepare(model, '123', [{ orderId: 'other', splitId: 'door', laberNumber: '000123' }]), /Invalid panel mapping/);
assert.throws(() => prepare(model, '123', [{ orderId: '123', splitId: 'missing', laberNumber: '000123' }]), /MISSING_RENDER_MAPPING:1/);
assert.throws(() => prepare(model, '123', [{ orderId: '123', splitId: 'door', laberNumber: '000123' }, { orderId: '123', splitId: 'other', laberNumber: '000123' }]), /DUPLICATE_SERIAL_MAPPING/);
const duplicateRender = structuredClone(model);
duplicateRender.value.docs[0].renderModels.push(duplicateRender.value.docs[0].renderModels[0]);
assert.throws(() => prepare(duplicateRender, '123', [{ orderId: '123', splitId: 'door', laberNumber: '000123' }]), /DUPLICATE_RENDER_MAPPING/);
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
const mirrored = { ...parent, scale: [-1, 1, 1] };
const straightMirror = { ...parent, quaternion: [0,0,0,1], scale: [-1,1,1] };
const straightMotion = doorMotion(door, new Map([[straightMirror.id, straightMirror], [door.id, door]]), 'right');
assert.equal(straightMotion.opening, 'left');
near(straightMotion.pivot, [8,20,30]);
const straightEdge = new Vector3(-1,0,0).applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3().fromArray(straightMotion.axis), -Math.PI / 2));
near(straightEdge.toArray(), [0,-1,0]);
const mirrorMotion = doorMotion(door, new Map([[mirrored.id, mirrored], [door.id, door]]), 'right');
near(mirrorMotion.pivot, [10, -82, 30]);
near(mirrorMotion.axis, [0, 0, -1]);
const mirroredEdge = new Vector3(0, 1, 0).applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3().fromArray(mirrorMotion.axis), Math.PI / 2));
near(mirroredEdge.toArray(), [1, 0, 0]);
assert.equal(doorMotion({ ...door, scale: [0, 1, 1] }, byId, 'right'), null);
const mount = (x, y, z) => ({ matrix: [1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1] });
const straightAnchored = doorMotion(door, new Map([[straightMirror.id, straightMirror], [door.id, door]]), 'right', [mount(-92,20,40)]);
assert.equal(straightAnchored.opening, 'right');
near(straightAnchored.pivot, [-92,20,30]);
near(doorMotion(door, byId, 'left', [mount(7, 27, 40), mount(7, 27, 200)]).pivot, [7,22,30]);
near(doorMotion(door, byId, 'left', [mount(7, 72, 40)]).pivot, [10,22,30]);
const anchored = doorMotion(door, new Map([[mirrored.id, mirrored], [door.id, door]]), 'right', [mount(7, 17, 40), mount(7, 17, 200)]);
assert.equal(anchored.opening, 'left');
near(anchored.pivot, [7, 18, 30]);
const anchoredEdge = new Vector3(0, -1, 0).applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3().fromArray(anchored.axis), -Math.PI / 2));
near(anchoredEdge.toArray(), [1, 0, 0]);
model.value.docs[0].models[0].textureImage = '12345'; model.value.docs[0].models[0].color = 0x123456;
model.value.docs[0].renderModels[0].geometry.uv = [0,0, 1,0, 0,1];
const textured = JSON.parse(gunzipSync(prepare(model, '123')[0].data))[0];
assert.equal(textured.texture, '12345'); assert.equal(textured.color, 0x123456); assert.deepEqual(textured.uv, [0,0, 1,0, 0,1]);
model.value.docs[0].models.push({ id: 'hinge', parentId: 'door', className: 'BasePlankHardwareModel', name: 'hinge', hardwareFuncFlag: 'Y', objFileId: 'h1', instanceMatrix: [1,0,0,0,0,1,0,0,0,0,1,0,10,20,30,1] });
model.value.docs[0].renderHoleModels = [{ geometryType: 'h1', geometry: { position: [0,0,0,1,0,0,0,1,0], index: [] } }];
const hinge = JSON.parse(gunzipSync(prepare(model, '123')[0].data))[0].hinges[0];
assert.deepEqual(hinge.matrix.slice(12, 15), [10, 20, 30]);
assert.deepEqual(hinge.index, []);
assert.equal(JSON.parse(gunzipSync(prepare(model, '123')[0].data))[0].hingeCount, 1);
model.value.docs[0].renderHoleModels = [];
const noMesh = JSON.parse(gunzipSync(prepare(model, '123')[0].data))[0];
assert.equal(noMesh.hingeCount, 1, 'hardware exists even if its render mesh is missing');
assert.equal(noMesh.hinges.length, 0);
model.value.docs[0].renderHoleModels = [{ geometryType: 'h1', geometry: { position: [0,0,0,1,0,0,0,1,0], index: [] } }];
model.value.docs[0].models[1].parentId = 'cabinet';
model.value.docs[0].models[1].relaPlankIds = ['cabinet', 'door'];
assert.equal(JSON.parse(gunzipSync(prepare(model, '123')[0].data))[0].hinges.length, 1, 'linked door must receive its hinge even when it is not the parent');
model.value.docs[0].models.push({ id: 'cabinet' });
model.value.docs[0].renderModels.push({ modelId: 'cabinet', geometry: { position: [0,0,0, 1,0,0, 0,1,0], index: [0,1,2] } });
assert.equal(JSON.parse(gunzipSync(prepare(model, '123')[0].data))[1].hinges.length, 0, 'linked hinge must not also be rendered on its parent cabinet');
const transform = { position: [0,0,0], quaternion: [0,0,0,1], scale: [1,1,1] };
const drawerModel = { value: { orderId: '123', docs: [{ houseId: 'drawer-room', models: [
	{ id: 'group', className: 'BaseModuleGroupModel', moduleType: '06', ...transform, quaternion: [0,0,Math.SQRT1_2,Math.SQRT1_2] },
	{ id: 'nested', parentId: 'group', ...transform },
	{ id: 'drawer', parentId: 'nested', ...transform },
	{ id: 'rail', className: 'BasePlankHardwareModel', funcType: '03', relaPlankIds: ['drawer'], objFileId: 'rail-mesh', instanceMatrix: mount(0,0,0).matrix },
], renderModels: [{ modelId: 'drawer', geometry: { position: [0,0,0,1,0,0,0,1,0], index: [0,1,2] } }], renderHoleModels: [{ geometryType: 'rail-mesh', geometry: { position: [0,0,0,1,0,0,0,1,0], index: [0,1,2] } }] }] } };
const drawer = JSON.parse(gunzipSync(prepare(drawerModel, '123')[0].data))[0];
near(drawer.drawerOffset, [300,0,0]);
assert.equal(drawer.drawerRails.length, 1, 'linked rail must follow the drawer');
drawerModel.value.docs[0].models[1].parentId = 'missing';
assert.equal(JSON.parse(gunzipSync(prepare(drawerModel, '123')[0].data))[0].drawerOffset, undefined, 'unresolved hierarchy must not invent motion');
assert.throws(() => prepare(model, '456'));
model.value.docs[0].renderModels[0].geometry.index[2] = 3;
assert.throws(() => prepare(model, '123'));
console.log('Public model import checks passed');
