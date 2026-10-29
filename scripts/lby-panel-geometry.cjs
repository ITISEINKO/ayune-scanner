const assert = require("node:assert/strict");

const finitePoint = (point) => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite);
const subtract = (a, b) => a.map((value, axis) => value - b[axis]);
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

function arcPoints(start, middle, end, center) {
	assert([start, middle, end, center].every(finitePoint), "Invalid arc points");
	const radius = Math.hypot(...subtract(start, center));
	const normal = cross(subtract(middle, start), subtract(end, start));
	const length = Math.hypot(...normal);
	assert(radius > 0 && length > 0, "Degenerate arc");
	const u = subtract(start, center).map((value) => value / radius);
	const v = cross(normal.map((value) => value / length), u);
	const angle = (point) => (Math.atan2(dot(subtract(point, center), v), dot(subtract(point, center), u)) + 2*Math.PI) % (2*Math.PI);
	const finish = angle(end), sweep = angle(middle) <= finish ? finish : finish - 2*Math.PI;
	// shortcut: tessellate curves to 0.25 source units; use analytic curves if fabrication precision is required.
	const steps = Math.ceil(Math.abs(sweep) / Math.min(Math.PI/18, 2*Math.acos(Math.max(-1, 1-0.25/radius))));
	assert(steps > 0 && steps <= 1024, "Arc exceeds geometry limit");
	return Array.from({ length: steps + 1 }, (_, index) => index === steps ? end : center.map((value, axis) =>
		value + radius * (u[axis]*Math.cos(sweep*index/steps) + v[axis]*Math.sin(sweep*index/steps))));
}

function extrude(outline, axis, thickness) {
	assert(outline.length >= 3 && outline.length <= 4096 && outline.every(finitePoint), "Invalid panel outline");
	assert(Number.isFinite(thickness) && thickness > 0, "Invalid panel thickness");
	const count = outline.length;
	const vertices = [...outline, ...outline.map((point) => point.map((value, index) => value + (index === axis ? thickness : 0)))];
	const faces = [outline.map((_, index) => index), outline.map((_, index) => index + count)];
	const edges = [];
	for (let index = 0; index < count; index++) {
		const next = (index + 1) % count;
		faces.push([index, next, next + count, index + count]);
		edges.push([index, next], [index + count, next + count]);
		const before = subtract(outline[index], outline[(index + count - 1) % count]);
		const after = subtract(outline[next], outline[index]);
		// Smooth samples need perimeter edges, not a stripe down every curved face.
		if (dot(before, after) / (Math.hypot(...before)*Math.hypot(...after)) < 0.95) edges.push([index, index + count]);
	}
	return { vertices, faces, edges };
}

function panelGeometry(object) {
	if (object.genType === "02") {
		const arc = object.arcPlankInfo;
		assert(["00", "01", "02"].includes(arc?.arcType), "Unsupported bent panel arc type");
		const { a, b, c, r1: radius, r2, h } = arc, thickness = object.plankThickness;
		assert([a,b,radius,h,thickness].every((value) => Number.isFinite(value) && value > 0), "Invalid bent panel parameters");
		// Vendor GenArcPlankShapeNoFlip: tangent quarter circles, extruded along Z.
		const outer = radius + thickness;
		const outline = [[0, outer+a, 0], [0, outer, 0]];
		const line = (x,y) => outline.push([x,y,0]);
		const quarter = (x,y,cx,cy) => {
			const start = outline[outline.length-1], end = [x,y,0], center = [cx,cy,0];
			const middle = center.map((value, axis) => value + (start[axis]+end[axis]-2*value)/Math.SQRT2);
			outline.push(...arcPoints(start,middle,end,center).slice(1));
		};
		quarter(outer,0,outer,outer); line(outer+b,0);
		if (arc.arcType === "02") {
			assert([c,r2].every((value) => Number.isFinite(value) && value > 0), "Invalid U panel parameters");
			quarter(outer+b+r2+thickness,r2+thickness,outer+b,r2+thickness);
			line(outer+b+r2+thickness,r2+thickness+c); line(outer+b+r2,r2+thickness+c);
			line(outer+b+r2,r2+thickness); quarter(outer+b,thickness,outer+b,r2+thickness);
		} else { line(outer+b,thickness); }
		line(outer,thickness); quarter(thickness,outer,outer,outer); line(thickness,outer+a);
		// Vendor ARC_Y is ARC_Z mirrored across its formed width.
		if (arc.arcType === "01") return extrude(outline.map(([x,y,z]) => [outer+b-x,y,z]), 2, h);
		return extrude(outline, 2, h);
	}
	if (object.genType !== "01" || !object.lineModels?.length) return undefined;
	assert(Array.isArray(object.lineModels) && object.lineModels.length <= 4096, "Panel outline exceeds geometry limit");
	const segments = object.lineModels.map((line) => {
		assert(["LineModel", "ArcModel"].includes(line.className), "Unsupported panel outline curve");
		const points = line.className === "LineModel" ? [line.startPoint, line.endPoint]
			: arcPoints(line.point1, line.point2, line.point3, line.centerPoint);
		assert(points.every(finitePoint), "Invalid panel outline points");
		return points;
	});
	// shortcut: endpoint joining scans at most 4096 edges; index endpoints for larger outlines.
	const outline = segments.shift().slice();
	while (segments.length) {
		const last = outline[outline.length - 1];
		const match = segments.findIndex((points) => Math.hypot(...subtract(points[0], last)) < 0.1 ||
			Math.hypot(...subtract(points[points.length - 1], last)) < 0.1);
		assert(match >= 0, "Disconnected panel outline");
		const points = segments.splice(match, 1)[0];
		if (Math.hypot(...subtract(points[0], last)) >= 0.1) points.reverse();
		outline.push(...points.slice(1));
		assert(outline.length <= 4097, "Panel outline exceeds geometry limit");
	}
	assert(Math.hypot(...subtract(outline[0], outline[outline.length - 1])) < 0.1, "Open panel outline");
	outline.pop();
	const min = [0,1,2].map((axis) => Math.min(...outline.map((point) => point[axis])));
	const ranges = min.map((value, axis) => Math.max(...outline.map((point) => point[axis])) - value);
	const axis = ranges.findIndex((range) => range < 0.01);
	assert(axis >= 0, "Unsupported non-planar panel outline");
	// The vendor normalizes the wire's minimum corner before applying the panel transform.
	return extrude(outline.map((point) => subtract(point, min)), axis, object.plankThickness);
}

module.exports = { panelGeometry };
