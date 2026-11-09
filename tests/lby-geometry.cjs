// node tests/lby-geometry.cjs
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { transpileModule, ModuleKind } = require("typescript");
const { panelGeometry, hingeGeometry, isHinge } = require("../scripts/lby-panel-geometry.cjs");
const { mapLbyPanels } = require("../scripts/map-lby-panels.cjs");

const bent = { id: "panel", className: "BasePlankModel", genType: "02", sizeX: 684.76, sizeY: 19, sizeZ: 900,
	position: [10,20,30], quaternion: [0,0,0,1], scale: [1,1,1], plankThickness: 19,
	arcPlankInfo: { arcType: "00", a: 415, b: 20, c: 196, r1: 140, r2: 100, h: 900 } };
const geometry = panelGeometry(bent);
const bounds = (points) => [0,1,2].map((axis) => [Math.min(...points.map(p=>p[axis])), Math.max(...points.map(p=>p[axis]))]);
assert.deepEqual(bounds(geometry.vertices), [[0,179],[0,574],[0,900]], "bent bounds must use the formed shape, not 684.76 x 19 manufacturing dimensions");
assert(geometry.vertices.some(([x,y]) => x>0 && x<140 && y>0 && y<140), "the corner must have intermediate arc samples");
assert(geometry.edges.length < geometry.faces.length*3, "smooth faces must not become vertical stripes");
assert(geometry.faces.flat().every(index=>Number.isInteger(index)&&index>=0&&index<geometry.vertices.length));
const u = panelGeometry({...bent, arcPlankInfo:{...bent.arcPlankInfo,arcType:"02"}});
assert.deepEqual(bounds(u.vertices), [[0,298],[0,574],[0,900]], "U panel must retain its second bend");
const reverseBend = panelGeometry({...bent, arcPlankInfo:{...bent.arcPlankInfo,arcType:"01"}});
assert.deepEqual(reverseBend.vertices, geometry.vertices.map(([x,y,z]) => [179-x,y,z]), "vendor ARC_Y mirrors ARC_Z across the formed width");
assert.deepEqual(reverseBend.faces, geometry.faces);
const amethystBend = panelGeometry({...bent, plankThickness:32, arcPlankInfo:{arcType:"01",a:19,b:19,r1:20,h:200}});
assert.deepEqual(bounds(amethystBend.vertices), [[0,71],[0,71],[0,200]], "AMETHYST reverse bend uses formed dimensions");
assert(amethystBend.vertices.some(([x,y,z]) => x===0 && y===0 && z===0), "reverse bend starts with a horizontal foot at the vendor origin");
assert.throws(()=>panelGeometry({...bent,arcPlankInfo:{...bent.arcPlankInfo,r1:NaN}}), /Invalid bent/);
assert.throws(()=>panelGeometry({...bent,arcPlankInfo:{...bent.arcPlankInfo,arcType:"99"}}), /Unsupported bent/);

const line = (startPoint,endPoint) => ({className:"LineModel",startPoint,endPoint});
const drawn = {...bent, genType:"01", plankThickness:2, lineModels:[
	line([5,10,0],[15,10,0]), line([5,20,0],[5,10,0]),
	{className:"ArcModel",point1:[15,10,0],point2:[12.071067812,17.071067812,0],point3:[5,20,0],centerPoint:[5,10,0]},
]};
const drawnMesh = panelGeometry(drawn);
assert.deepEqual(bounds(drawnMesh.vertices), [[0,10],[0,10],[0,2]], "outlines must normalize their source origin before extrusion");
const reversed = panelGeometry({...drawn,lineModels:[...drawn.lineModels].reverse()});
assert.deepEqual(bounds(reversed.vertices),bounds(drawnMesh.vertices));
assert.throws(()=>panelGeometry({...drawn,lineModels:[line([0,0,0],[1,0,0]),line([5,0,0],[6,0,0])]}),/Disconnected/);
assert.equal(panelGeometry({...bent,genType:"00"}),undefined,"standard template boxes keep the legacy representation");

const parent = {id:"parent", position:[100,200,300], scale:[1,1,1], quaternion:[0,0,Math.SQRT1_2,Math.SQRT1_2]};
const mapped = mapLbyPanels({code:0,data:[{id:"record",laberNumber:"001",splitId:"panel",roomName:"Room",roomPlankIdx:"1"}]},
	{value:{orderId:"order",docs:[{id:"doc",models:[{...bent,parentId:"parent"},parent]}]}},true).snapshot;
assert.deepEqual(bounds(mapped.panels[0].geometry.vertices),[[-494,80],[210,389],[330,1230]],"mesh follows the same parent transform chain as boxes");
assert(!/token|https|materiel|price/i.test(JSON.stringify(mapped)));
const helper = {exports:{}};
runInNewContext(transpileModule(readFileSync("src/lib/panelLocation.ts","utf8"),{compilerOptions:{module:ModuleKind.CommonJS}}).outputText,
	{exports:helper.exports,module:helper,URLSearchParams});
const closed = helper.exports.projectPanelLocations(mapped.panels,0,0,"001")[0];
const viewer = readFileSync("src/features/panel-location/PanelLocationViewer.tsx", "utf8");
const yaw = Number(viewer.match(/const INITIAL_YAW = (-?[\d.]+);/)[1]);
const pitch = Number(viewer.match(/const INITIAL_PITCH = (-?[\d.]+);/)[1]);
const orientationBox = { barcode: "orientation", corners: [[0,0,0],[100,0,0],[100,100,0],[0,100,0],[0,0,100],[100,0,100],[100,100,100],[0,100,100]] };
const view = helper.exports.projectPanelLocations([orientationBox], yaw, pitch, "orientation")[0].points;
const assembly = [[-200,0,0], [0,0,0], [200,0,0], [0,-200,0], [0,200,0], [0,0,-200], [0,0,200]]
	.map((offset, index) => ({ ...orientationBox, barcode: String(index),
		corners: orientationBox.corners.map(point => point.map((value, axis) => value + offset[axis])) }));
const selectedExplode = helper.exports.projectPanelLocations(assembly, yaw, pitch, "0");
assert(selectedExplode.slice(1).every(panel => panel.explodeOffset.every(value => value === 0)), "selected mode must leave surrounding panels assembled");
assert(Math.hypot(...selectedExplode[0].explodeOffset) > 0, "selected mode must pull the searched serial");
const allExplode = helper.exports.projectPanelLocations(assembly, yaw, pitch, "0", 0, true);
const allTurned = helper.exports.projectPanelLocations(assembly, 1.1, -0.5, "0", 0, true);
const allOtherSerial = helper.exports.projectPanelLocations(assembly, yaw, pitch, "2", 0, true);
for (const [index, panel] of allExplode.entries()) {
	assert(panel.explodeOffset.every(Number.isFinite));
	assert.deepEqual(panel.points, selectedExplode[index].points, "explode offsets must not deform or mutate source geometry");
	assert.deepEqual(panel.explodeOffset, allOtherSerial[index].explodeOffset, "whole assembly spacing must not depend on which serial is highlighted");
	assert(Math.abs(Math.hypot(...panel.explodeOffset) - Math.hypot(...allTurned[index].explodeOffset)) < 1e-8, "rotation must preserve whole assembly explode distance");
}
assert(Math.hypot(...allExplode[0].explodeOffset) > 160);
assert(Math.hypot(...allExplode[2].explodeOffset) > 160, "whole mode must pull unselected panels along their normals as well as spreading their centres");
assert(allExplode[0].explodeOffset.every((value, axis) => Math.abs(value + allExplode[2].explodeOffset[axis]) < 1e-8), "opposite panels must spread in opposite directions");
const axisExplode = helper.exports.projectPanelLocations(assembly, 0, 0, "0", 0, true);
assert(axisExplode[0].explodeOffset[0] < 0 && axisExplode[2].explodeOffset[0] > 0, "whole explode must separate left and right");
assert(axisExplode[3].explodeOffset[2] < 0 && axisExplode[4].explodeOffset[2] > 0, "whole explode must separate front and back in depth");
assert(axisExplode[5].explodeOffset[1] > 0 && axisExplode[6].explodeOffset[1] < 0, "whole explode must separate below and above");
const thinPanels = [-1, 1].map((direction, index) => ({ ...orientationBox, barcode: String(index),
	corners: orientationBox.corners.map(([x,y,z]) => [x, y * 0.01 + direction, z * 10]) }));
const sideExplode = helper.exports.projectPanelLocations(thinPanels, Math.PI / 2, 0, "0", 0, true);
assert(sideExplode[0].explodeOffset[0] < -200 && sideExplode[1].explodeOffset[0] > 200,
	"front/back panels close to the centre of a tall model must visibly separate horizontally from the side");
assert(helper.exports.projectPanelLocations([orientationBox], yaw, pitch, "orientation", 0, true)[0].explodeOffset.every(value => value === 0), "whole mode must keep a single panel stable");
assert(view[1][0] > view[0][0] && view[1][1] < view[0][1], "default long run rises to the right, matching the supplied LBY front view");
assert(view[4][2] < view[0][2], "default camera looks down: upper corners must be closer than lower corners");
assert(view[3][0] < view[0][0] && view[3][1] < view[0][1], "default depth recedes up-left instead of showing the underside");
assert.equal(closed.points.length,geometry.vertices.length,"projection must render mesh vertices instead of eight box corners");
assert.equal(closed.faceIndices.length,geometry.faces.length);
const moving = {...mapped.panels[0],doorOpenType:"left"};
const opened = helper.exports.projectPanelLocations([moving],0.3,0.2,"001",1)[0];
assert(opened.points.flat().every(Number.isFinite));
assert.notDeepEqual(opened.points,helper.exports.projectPanelLocations([moving],0.3,0.2,"001",0)[0].points,"door motion must rotate mesh vertices too");
const hingeMesh = hingeGeometry("v 0 0 -2\nv 1 0 2\nv 0 1 0\nf -3/1/1 -2/2/1 -1/3/1\n");
assert.deepEqual(hingeMesh.faces, [[0,1,2]], "OBJ relative indices and texture/normal suffixes are supported");
assert.deepEqual(hingeMesh.vertices[0], [0,0,-2], "hinge mesh must preserve its mounting origin");
for (const invalid of ["v NaN 0 0\nf 1 2 3", "v 0 0 0\nf 1 2 3", "v 0 0 0\nf 0 1 1", "v 0 0 0"]) {
	assert.throws(() => hingeGeometry(invalid), /hinge OBJ/);
}
const hinge = {id:"hinge",parentId:"panel",className:"BasePlankHardwareModel",funcType:"07",name:"Test hinge",code:"H-01",objFileId:"123",
	position:[1,2,3],scale:[1,1,1],quaternion:[0,0,0,1],price:123,token:"secret"};
assert(isHinge(hinge));
assert(!isHinge({...hinge,className:"BasePlankModel"}));
const hingeModel = {value:{orderId:"order",docs:[{id:"doc",models:[{...bent,parentId:"parent",doorOpenType:"left"},parent,hinge]}]}};
const hingeResponse = {code:0,data:[{id:"record",laberNumber:"001",splitId:"panel",roomName:"Room",roomPlankIdx:"1"}]};
assert.throws(() => mapLbyPanels(hingeResponse,hingeModel,true), /Missing hinge mesh/);
const withHinges = mapLbyPanels(hingeResponse,hingeModel,true,undefined,new Map([["123",hingeMesh]]));
const importedHinge = withHinges.snapshot.panels[0].hinges[0];
assert.deepEqual(importedHinge.position,[78,211,333],"hinge mounting position composes hardware, panel and rotated parent transforms");
assert.deepEqual(importedHinge.panelPosition,[1,2,3],"panel-relative mounting coordinates remain available");
assert.deepEqual(importedHinge.geometry.vertices[0],[78,211,331]);
assert.equal(withHinges.mapping.panels[0].hinges[0].code,"H-01");
assert(!/token|price|secret|https/.test(JSON.stringify(withHinges)),"hinges keep only sanitized metadata and mesh");
for (const doorOpenType of ["left", "right", "up", "bottom"]) {
	const panels = withHinges.snapshot.panels.map(panel => ({ ...panel, doorOpenType }));
	const closed = helper.exports.projectPanelLocations(panels,0.3,0.2,"001")[0];
	for (const progress of [0.25, 0.5, 1]) {
		const opened = helper.exports.projectPanelLocations(panels,0.3,0.2,"001",progress)[0];
		assert.deepEqual(opened.hinges[0].points[2], closed.hinges[0].points[2], "the compartment end of the hinge must remain fixed while any door opens");
		assert.notDeepEqual(opened.hinges[0].points[0], closed.hinges[0].points[0], "the door end of the hinge must follow the opening door");
		const movedDoorEnd = helper.exports.panelDoorCorners(panels[0], progress, importedHinge.geometry.vertices)[0];
		assert(Math.abs(Math.hypot(...opened.hinges[0].points[0].map((value, axis) => value - closed.hinges[0].points[0][axis])) -
			Math.hypot(...movedDoorEnd.map((value, axis) => value - importedHinge.geometry.vertices[0][axis]))) < 1e-8,
			"the door attachment must move by the full door rotation, not slide or stay behind");
		assert.notDeepEqual(opened.points, closed.points, "the door must still rotate");
		assert.equal(opened.hinges[0].points.length, importedHinge.geometry.vertices.length, "preserve the imported hinge mesh");
		assert(opened.hinges[0].points.every(point => [0,1].every(axis =>
			point[axis] >= Math.min(...closed.fitPoints.map(p => p[axis])) && point[axis] <= Math.max(...closed.fitPoints.map(p => p[axis])))),
			"fixed camera bounds must contain the connected hinge throughout the swing");
	}
}
assert.notEqual(withHinges.snapshot.version,mapLbyPanels(hingeResponse,{value:{...hingeModel.value,docs:[{id:"doc",models:hingeModel.value.docs[0].models.filter(o=>o!==hinge)}]}},true).snapshot.version);
assert.throws(() => mapLbyPanels(hingeResponse,{value:{...hingeModel.value,docs:[{id:"doc",models:[...hingeModel.value.docs[0].models,hinge]}]}},true), /Duplicate hinge ID/);
assert.throws(() => mapLbyPanels(hingeResponse,{value:{...hingeModel.value,docs:[{id:"doc",models:[bent,{...hinge,parentId:"missing"}]}]}},true), /not attached to an imported panel/);
console.log("LBY geometry passed: formed L/U bends, sampled arcs, origin normalization, transforms, validation, sanitization and mesh door projection.");
