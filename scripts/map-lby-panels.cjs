const assert = require("node:assert/strict");
const fs = require("node:fs");
const { panelGeometry } = require("./lby-panel-geometry.cjs");

// Inspect downloaded responses offline; never persist signed download URLs.
function mapLbyPanels(response, model, includeLocations = false, onMapped = () => {}) {
assert.equal(response.code, 0, "Vendor panel response failed");
assert(Array.isArray(response.data) && response.data.length > 0, "No panels");
assert(Array.isArray(model.value?.docs), "Missing model documents");

const objects = new Map();
for (const doc of model.value.docs) {
	assert(Array.isArray(doc.models), "Missing document models");
	for (const object of doc.models) {
		if (object.className !== "BasePlankModel") continue;
		assert(!objects.has(object.id), `Duplicate model ID: ${object.id}`);
		objects.set(object.id, { doc, object });
	}
}

const barcodes = new Set();
const splitIds = new Set();
const panels = response.data.map((panel) => {
	assert.equal(typeof panel.laberNumber, "string", "Barcode must remain a string");
	assert(panel.laberNumber.trim(), "Empty barcode");
	assert(!barcodes.has(panel.laberNumber), `Duplicate barcode: ${panel.laberNumber}`);
	assert(!splitIds.has(panel.splitId), `Duplicate panel splitId: ${panel.splitId}`);
	barcodes.add(panel.laberNumber);
	splitIds.add(panel.splitId);
	const match = objects.get(panel.splitId);
	assert(match, `No model for barcode ${panel.laberNumber}: ${panel.splitId}`);
	const { doc, object } = match;
	const opening = object.doorOpenType ?? object.userData?.doorOpenType;
	const doorOpenType = ["left", "right", "up", "bottom"].includes(opening) ? opening : undefined;
	for (const [key, count] of [["position", 3], ["quaternion", 4], ["scale", 3]]) {
		assert(Array.isArray(object[key]) && object[key].length === count &&
			object[key].every(Number.isFinite), `Invalid ${key}: ${object.id}`);
	}
	return {
		barcode: panel.laberNumber,
		panelRecordId: panel.id,
		roomName: panel.roomName,
		cabinetName: panel.cabinetName,
		panelName: panel.plankName,
		panelNumber: panel.roomPlankIdx,
		...(doorOpenType ? { doorOpenType } : {}),
		finishedSize: [panel.endLength, panel.endWidth, panel.endThickness],
		model: {
			documentId: doc.id,
			id: object.id,
			parentId: object.parentId,
			name: object.name,
			position: object.position,
			quaternion: object.quaternion,
			scale: object.scale,
			transMatrix: object.transMatrix,
			size: [object.sizeX, object.sizeY, object.sizeZ],
			outlineSegmentCount: object.lineModels?.length ?? 0,
		},
	};
});

onMapped();
const byRoom = {};
for (const panel of panels) byRoom[panel.roomName] = (byRoom[panel.roomName] ?? 0) + 1;
const result = {
	inspectedOn: new Date().toISOString().slice(0, 10),
	orderId: model.value.orderId,
	join: "panel.laberNumber -> panel.splitId = BasePlankModel.id",
	coordinateNote: "Raw vendor transforms; world-space interpretation and rendering are unverified.",
	summary: { panels: panels.length, modelPanels: objects.size, matched: panels.length, byRoom },
	panels,
};
let snapshot;
if (includeLocations) {
	const locationPanels = panels.map((panel) => {
		const { doc, object } = objects.get(panel.model.id);
		const models = new Map(doc.models.map((entry) => [entry.id, entry]));
		const chain = [];
		let current = object;
		while (current) {
			assert(!chain.includes(current), `Cyclic parent: ${current.id}`);
			chain.push(current);
			assert(!current.parentId || models.has(current.parentId), `Missing parent: ${current.parentId}`);
			current = models.get(current.parentId);
		}
		const size = [object.sizeX, object.sizeY, object.sizeZ];
		assert(size.every((n) => Number.isFinite(n) && n > 0), `Invalid size: ${object.id}`);
		const transform = (local) => {
			let point = local;
			for (const ancestor of chain) {
				const position = ancestor.position ?? [0, 0, 0];
				const scale = ancestor.scale ?? [1, 1, 1];
				const q = ancestor.quaternion ?? [0, 0, 0, 1];
				assert(position.length === 3 && position.every(Number.isFinite), "Invalid ancestor position");
				assert(scale.length === 3 && scale.every(Number.isFinite), "Invalid ancestor scale");
				assert(q.length === 4 && q.every(Number.isFinite) && Math.abs(Math.hypot(...q) - 1) < 0.001,
					"Invalid ancestor quaternion");
				const [x, y, z] = point.map((n, axis) => n * scale[axis]);
				const [qx, qy, qz, qw] = q;
				const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
				point = [x + qw * tx + qy * tz - qz * ty, y + qw * ty + qz * tx - qx * tz,
					z + qw * tz + qx * ty - qy * tx].map((n, axis) => n + position[axis]);
			}
			const rounded = point.map((n) => Math.round(n * 10) / 10);
			assert(rounded.every(Number.isFinite), `Invalid world position: ${object.id}`);
			return rounded;
		};
		const corners = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]]
			.map((corner) => transform(corner.map((n, axis) => n * size[axis])));
		const geometry = panelGeometry(object);
		return { barcode: panel.barcode, roomName: panel.roomName, panelNumber: panel.panelNumber,
			...(typeof panel.panelName === "string" ? { panelName: panel.panelName } : {}),
			...(panel.doorOpenType ? { doorOpenType: panel.doorOpenType } : {}), corners,
			...(geometry ? { geometry: { ...geometry, vertices: geometry.vertices.map(transform) } } : {}) };
	});
	const { createHash } = require("node:crypto");
	snapshot = {
		version: createHash("sha256").update(JSON.stringify(locationPanels)).digest("hex").slice(0, 12),
		panels: locationPanels,
	};
}
return { mapping: result, snapshot };
}

module.exports = { mapLbyPanels };
if (require.main === module) {
	const [panelsPath, modelPath, outputPath, locationOutputPath] = process.argv.slice(2);
	assert(panelsPath && modelPath && outputPath,
		"Usage: node scripts/map-lby-panels.cjs <panel-response.json> <model.json> <mapping.json> [location-snapshot.json]");
	const { mapping, snapshot } = mapLbyPanels(JSON.parse(fs.readFileSync(panelsPath, "utf8")),
		JSON.parse(fs.readFileSync(modelPath, "utf8")), Boolean(locationOutputPath));
	fs.writeFileSync(outputPath, `${JSON.stringify(mapping, null, 2)}\n`);
	console.log(JSON.stringify(mapping.summary));
	if (locationOutputPath) {
		fs.writeFileSync(locationOutputPath, `${JSON.stringify(snapshot)}\n`);
		console.log(`Location snapshot: ${snapshot.panels.length} panels, ${fs.statSync(locationOutputPath).size} bytes`);
	}
}
