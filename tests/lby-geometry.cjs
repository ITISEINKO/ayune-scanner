// node tests/lby-geometry.cjs
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { transpileModule, ModuleKind } = require("typescript");
const { panelGeometry } = require("../scripts/lby-panel-geometry.cjs");
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
assert(view[1][0] > view[0][0] && view[1][1] < view[0][1], "default long run rises to the right, matching the supplied LBY front view");
assert(view[4][2] < view[0][2], "default camera looks down: upper corners must be closer than lower corners");
assert(view[3][0] < view[0][0] && view[3][1] < view[0][1], "default depth recedes up-left instead of showing the underside");
assert.equal(closed.points.length,geometry.vertices.length,"projection must render mesh vertices instead of eight box corners");
assert.equal(closed.faceIndices.length,geometry.faces.length);
const moving = {...mapped.panels[0],doorOpenType:"left"};
const opened = helper.exports.projectPanelLocations([moving],0.3,0.2,"001",1)[0];
assert(opened.points.flat().every(Number.isFinite));
assert.notDeepEqual(opened.points,helper.exports.projectPanelLocations([moving],0.3,0.2,"001",0)[0].points,"door motion must rotate mesh vertices too");
console.log("LBY geometry passed: formed L/U bends, sampled arcs, origin normalization, transforms, validation, sanitization and mesh door projection.");
