const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { transpileModule, ModuleKind, JsxEmit } = require("typescript");
const loaded = { exports: {} };
const source = transpileModule(readFileSync("src/features/panel-location/PanelLocation3D.tsx", "utf8"), {
	compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
}).outputText;
runInNewContext(source, { module: loaded, exports: loaded.exports, require: (name) => name.startsWith("@/") ? {} : require(name) });
// A concave L face must cover area 5 in any orientation, without filling its missing corner.
const polygon = [[0,0,0],[3,0,0],[3,1,0],[1,1,0],[1,3,0],[0,3,0]];
for (const points of [polygon, polygon.map(([x,y]) => [4,x,y])]) {
	const result = loaded.exports.triangles(points, [[0,1,2,3,4,5]]);
	let area = 0;
	for (let i = 0; i < result.length; i += 9) {
		const a = result.slice(i, i + 3), b = result.slice(i + 3, i + 6), c = result.slice(i + 6, i + 9);
		const u = b.map((v, j) => v - a[j]), v = c.map((n, j) => n - a[j]);
		area += Math.hypot(u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]) / 2;
	}
	assert.equal(area, 5);
}
const placement = loaded.exports.numberPlacement([[0,0,0],[100,0,0],[100,50,0],[0,50,0]], [[0,1,2,3]]);
assert(placement && placement.center.x > 0 && placement.center.x < 100 && -placement.center.y > 0 && -placement.center.y < 50);
assert.equal(placement.center.z, 0, "number must lie on the panel surface");
assert(placement.radius > 0 && Math.abs(placement.normal.length() - 1) < 1e-8);
const shifted = loaded.exports.numberPlacement([[20,30,5],[120,30,5],[120,80,5],[20,80,5]], [[0,1,2,3]]);
assert(Math.abs(shifted.center.x - placement.center.x - 20) < 1e-8 && Math.abs(shifted.center.y - placement.center.y + 30) < 1e-8 && shifted.center.z === 5, "number must follow the panel when it moves");
assert.equal(loaded.exports.numberPlacement([[0,0,0],[1,0,0],[2,0,0]], [[0,1,2]]), null);
console.log("Panel 3D concave triangulation passed");
