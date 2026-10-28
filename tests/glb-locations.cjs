// Run: node tests/glb-locations.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { importGlbLocations } = require("../scripts/import-glb-locations.cjs");

function glb(doc) {
	const json=Buffer.from(JSON.stringify(doc));
	const padded=Buffer.alloc(Math.ceil(json.length/4)*4,32); json.copy(padded);
	const header=Buffer.alloc(20); header.write("glTF"); header.writeUInt32LE(2,4);
	header.writeUInt32LE(20+padded.length,8); header.writeUInt32LE(padded.length,12); header.writeUInt32LE(0x4e4f534a,16);
	return Buffer.concat([header,padded]);
}
const source = {
	asset:{version:"2.0"}, scenes:[{nodes:[0]}],
	nodes:[
		{matrix:[1,0,0,0,0,1,0,0,0,0,1,0,10,20,30,1],children:[1,4]},
		{name:"Component#1_00123",translation:[1,0,0],rotation:[0,0,Math.SQRT1_2,Math.SQRT1_2],scale:[2,2,2],children:[2,3]},
		{name:"Geom3D_Component#1_00123",mesh:0},
		{name:"Geom3D_Component#1_00123",mesh:1},
		{name:"unlabelled_1",mesh:0},
	],
	meshes:[{primitives:[{attributes:{POSITION:0}}]},{primitives:[{attributes:{POSITION:1}}]}],
	accessors:[{type:"VEC3",min:[0,0,0],max:[1,2,3]},{type:"VEC3",min:[0,0,0],max:[2,3,4]}],
};
const snapshot=importGlbLocations(glb(source),"Room",["00123"]);
assert.equal(snapshot.panels.length,2,"material/geometry children must merge under the named instance");
const target=snapshot.panels.find((p)=>p.barcode==="00123");
assert.deepEqual(target.corners[0],[11000,-30000,20000]);
assert.deepEqual(target.corners[2],[5000,-30000,24000],"matrix, quaternion, scale, metre conversion and Y-up conversion");
assert.equal(snapshot.panels.filter((p)=>p.barcode===null).length,1,"untagged geometry remains context");
assert.deepEqual(Object.keys(target).sort(),["barcode","corners","id","panelNumber","roomName"]);
assert.throws(()=>importGlbLocations(glb(source),"Room",["missing"]),/Serial not found/);
const duplicate=structuredClone(source);duplicate.nodes[4].name="00123";
assert.throws(()=>importGlbLocations(glb(duplicate),"Room",["00123"]),/Duplicate serial instance/);
const cyclic=structuredClone(source);cyclic.nodes[4].children=[0];
assert.throws(()=>importGlbLocations(glb(cyclic),"Room",["00123"]),/cyclic/);
const invalid=structuredClone(source);delete invalid.accessors[0].min;
assert.throws(()=>importGlbLocations(glb(invalid),"Room",["00123"]),/POSITION bounds/);
assert.throws(()=>importGlbLocations(Buffer.alloc(20),"Room",["00123"]),/GLB header/);
assert.throws(()=>importGlbLocations(glb(source).subarray(0,30),"Room",["00123"]),/version\/length/);
const real=importGlbLocations(fs.readFileSync("public/mimbar-doang.glb"),"MIMBAR",["15370046368","15370046369","15370046370"]);
assert.deepEqual(JSON.parse(JSON.stringify(real)),JSON.parse(fs.readFileSync("src/data/panel-locations/mimbar-glb-trial.json")),"serialized snapshot must match the supplied source file");
assert.deepEqual(real.panels.filter((p)=>p.barcode).map((p)=>p.barcode),["15370046368","15370046369","15370046370"]);
assert(real.panels.every((p)=>p.corners.length===8 && p.corners.flat().every(Number.isFinite)));
assert(!/texture|material|image|data:|https?:/i.test(JSON.stringify(real)));
console.log(`GLB import passed: all 3 serials, ${real.panels.length} boxes, nested transforms, instance grouping, context, validation and sanitized snapshot parity.`);
