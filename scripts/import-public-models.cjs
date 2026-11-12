const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { gzipSync } = require('node:zlib');
const { DatabaseSync } = require('node:sqlite');
const { parseShareLink, unzipModel } = require('./import-lby-project.cjs');
const { isHinge } = require('./lby-panel-geometry.cjs');
const { Matrix3, Matrix4, Vector3, Quaternion } = require('three');

const folder = path.resolve('.local-backups');

function doorMotion(model, models, opening, hinges = []) {
	if (!model || !opening) return null;
	const world = new Matrix4();
	const seen = new Set();
	let item = model;
	while (item) {
		if (seen.has(item.id) || !['position', 'quaternion', 'scale'].every((key) => Array.isArray(item[key]) && item[key].length === (key === 'quaternion' ? 4 : 3) && item[key].every(Number.isFinite)) || item.scale.some((value) => value === 0) || Math.hypot(...item.quaternion) < 1e-8) return null;
		seen.add(item.id);
		world.premultiply(new Matrix4().compose(new Vector3().fromArray(item.position), new Quaternion().fromArray(item.quaternion).normalize(), new Vector3().fromArray(item.scale)));
		if (item.parentId && !models.has(item.parentId)) return null;
		item = item.parentId ? models.get(item.parentId) : null;
	}
	const horizontal = opening === 'left' || opening === 'right';
	const width = horizontal ? model.sizeX : model.sizeZ;
	let mountDepth = 0;
	if (hinges.length) {
		const inverse = world.clone().invert();
		const mounts = hinges.map((hinge) => new Vector3().setFromMatrixPosition(new Matrix4().fromArray(hinge.matrix)).applyMatrix4(inverse));
		const coordinate = horizontal ? 'x' : 'z';
		if (Number.isFinite(width) && width > 0) {
			const atStart = mounts.every((mount) => Math.abs(mount[coordinate]) <= width * 0.25);
			const atEnd = mounts.every((mount) => Math.abs(mount[coordinate] - width) <= width * 0.25);
			if (atStart || atEnd) {
				opening = horizontal ? (atStart ? 'left' : 'right') : (atStart ? 'bottom' : 'up');
				// shortcut: mounting origins approximate the hinge plane; use joint data when available.
				mountDepth = mounts.reduce((sum, mount) => sum + mount.y, 0) / mounts.length;
			}
		}
	}
	const dimension = opening === 'right' || opening === 'up' ? width : 0;
	if (!Number.isFinite(dimension) || dimension < 0) return null;
	const localPivot = new Vector3(opening === 'right' ? dimension : 0, mountDepth, opening === 'up' ? dimension : 0);
	const pivot = localPivot.applyMatrix4(world);
	const axis = new Vector3(opening === 'up' || opening === 'bottom' ? 1 : 0, 0, opening === 'left' || opening === 'right' ? 1 : 0).applyMatrix3(new Matrix3().getNormalMatrix(world)).multiplyScalar(Math.sign(world.determinant())).normalize();
	return { pivot: pivot.toArray(), axis: axis.toArray(), opening };
}

async function read(url, signal) {
	const response = await fetch(url, { signal, redirect: 'error' });
	assert(response.ok, `HTTP ${response.status}`);
	const chunks = []; let size = 0;
	for await (const chunk of response.body) { size += chunk.length; assert(size <= 64 * 1024 * 1024, 'Response too large'); chunks.push(chunk); }
	return Buffer.concat(chunks);
}

function prepare(model, orderId, panels = []) {
	assert(String(model.value?.orderId) === orderId && !model.value._V_ && Array.isArray(model.value.docs), 'Unsupported or mismatched model');
	const serials = new Map();
	for (const panel of panels) {
		assert(String(panel.orderId) === orderId && typeof panel.laberNumber === 'string' && panel.laberNumber.trim() && typeof panel.splitId === 'string' && !serials.has(panel.splitId), 'Invalid panel mapping');
		serials.set(panel.splitId, panel.laberNumber.trim());
	}
	return model.value.docs.map((doc) => {
		assert(typeof doc.houseId === 'string' && doc.houseId && Array.isArray(doc.renderModels), 'Invalid room');
		const models = new Map((doc.models || []).map((item) => [item.id, item]));
		const hingeMeshes = new Map((doc.renderHoleModels || []).map((mesh) => [mesh.geometryType, mesh.geometry]));
		const matches = [];
		const geometry = doc.renderModels.map(({ modelId, geometry: g }) => {
			assert(Array.isArray(g?.position) && g.position.length % 3 === 0 && g.position.every(Number.isFinite), 'Invalid positions');
			const index = Array.isArray(g.index) ? g.index : Object.values(g.index || {});
			assert(index.length % 3 === 0 && index.every((n) => Number.isInteger(n) && n >= 0 && n < g.position.length / 3), 'Invalid indices');
			const model = models.get(modelId);
			if (typeof modelId === 'string') matches.push({ id: modelId, serial: serials.get(modelId) || '', number: String(model?.roomPlankIdx || '') });
			let doorOpenType = ['left', 'right', 'up', 'bottom'].includes(model?.doorOpenType) ? model.doorOpenType : null;
			const hinges = (doc.models || []).filter((item) => item.parentId === modelId && isHinge(item)).flatMap((item) => {
				const mesh = hingeMeshes.get(item.objFileId);
				if (!Array.isArray(mesh?.position) || !mesh.position.length || mesh.position.length % 3 || !mesh.position.every(Number.isFinite) || !Array.isArray(item.instanceMatrix) || item.instanceMatrix.length !== 16 || !item.instanceMatrix.every(Number.isFinite)) return [];
				const indices = Array.isArray(mesh.index) ? mesh.index : Object.values(mesh.index || {});
				if (indices.length % 3 || !indices.every((n) => Number.isInteger(n) && n >= 0 && n < mesh.position.length / 3)) return [];
				return [{ position: mesh.position, index: indices, matrix: item.instanceMatrix }];
			});
			const uv = Array.isArray(g.uv) && g.uv.length === g.position.length / 3 * 2 && g.uv.every(Number.isFinite) ? g.uv : [];
			const motion = doorMotion(model, models, doorOpenType, hinges);
			if (motion) doorOpenType = motion.opening;
			const texture = uv.length && typeof model?.textureImage === 'string' && /^\d{1,30}$/.test(model.textureImage) ? model.textureImage : null;
			const color = Number.isInteger(model?.color) && model.color >= 0 && model.color <= 0xffffff ? model.color : null;
			return { id: modelId, position: g.position, index, uv, texture, color, number: String(model?.roomPlankIdx || ''), doorOpenType, doorMotion: motion && { pivot: motion.pivot, axis: motion.axis }, isDoor: Boolean(doorOpenType || /门板|門板|\bdoor\b|\bpintu\b/i.test(model?.name || '')), hinges };
		});
		return { id: doc.houseId, name: String(doc.houseName || doc.houseId), data: gzipSync(JSON.stringify(geometry)), matches };
	});
}

async function run() {
	fs.mkdirSync(folder, { recursive: true });
	const db = new DatabaseSync(path.join(folder, 'public-models.sqlite'));
	db.exec('CREATE TABLE IF NOT EXISTS models (id TEXT PRIMARY KEY, name TEXT NOT NULL); CREATE TABLE IF NOT EXISTS rooms (model_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, geometry BLOB NOT NULL, PRIMARY KEY(model_id,id)); CREATE TABLE IF NOT EXISTS textures (id TEXT PRIMARY KEY, mime TEXT NOT NULL, image BLOB NOT NULL); CREATE TABLE IF NOT EXISTS panel_search (model_id TEXT NOT NULL, room_id TEXT NOT NULL, panel_id TEXT NOT NULL, serial TEXT NOT NULL, number TEXT NOT NULL, PRIMARY KEY(model_id,room_id,panel_id)); CREATE INDEX IF NOT EXISTS panel_search_serial ON panel_search(serial); CREATE INDEX IF NOT EXISTS panel_search_number ON panel_search(number);');
	const links = fs.readFileSync(process.argv[2] || 'docs/lbyerp-cadvisitor-docs/list-link.md', 'utf8').split(/\r?\n/).filter(Boolean);
	const orders = new Map();
	for (const link of links) { try { const source = parseShareLink(link); orders.set(source.orderId, source); } catch (error) { console.error(`Skipped link: ${error.message}`); } }
	let failed = 0;
	for (const [id, source] of orders) {
		try {
			const signal = AbortSignal.timeout(240000);
			const result = JSON.parse(await read(`https://www.lbyerp.com/api/cd/anyTenant/app/getByOrderId/${id}`, signal));
			assert(result.code === 0 && result.data && Object.keys(result.data).length === 1, 'Invalid model response');
			const value = Object.values(result.data)[0]; assert(typeof value === 'string', 'Invalid model value');
			let raw;
			if (value.trimStart().startsWith('{')) raw = value;
			else { const url = new URL(value); assert(url.protocol === 'https:' && !url.username && !url.password && ['www.lbyerp.com', 'ali-oss-lby.oss-cn-hangzhou.aliyuncs.com'].includes(url.hostname), 'Unexpected download host'); raw = unzipModel(await read(url, signal), id); }
			const panelResponse = JSON.parse(await read(`https://www.lbyerp.com/api/erp/anyTenant/app/getPlankByOrderId/${id}`, signal));
			assert(panelResponse.code === 0 && Array.isArray(panelResponse.data) && panelResponse.data.length, 'Invalid panel response');
			const rooms = prepare(JSON.parse(raw), id, panelResponse.data);
			assert(rooms.length && rooms.some((room) => JSON.parse(require('node:zlib').gunzipSync(room.data)).length), 'No panel geometry');
			const ids = [...new Set(rooms.flatMap((room) => JSON.parse(require('node:zlib').gunzipSync(room.data)).map((part) => part.texture).filter(Boolean)))];
			const missing = ids.filter((texture) => !db.prepare('SELECT 1 FROM textures WHERE id = ?').get(texture));
			const textures = [];
			if (missing.length) {
				const response = await fetch('https://www.lbyerp.com/api/base/file/anyTenant/findUrlById', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(missing), signal, redirect: 'error' });
				assert(response.ok, `Texture lookup: HTTP ${response.status}`);
				const lookup = await response.json(); assert(lookup.code === 0 && lookup.data && typeof lookup.data === 'object', 'Texture lookup failed');
				for (const texture of missing) {
					if (!lookup.data[texture]) { console.warn(`Texture unavailable: ${texture}`); continue; }
					const url = new URL(lookup.data[texture]);
					assert(url.protocol === 'https:' && !url.username && !url.password && ['www.lbyerp.com', 'ali-oss-lby.oss-cn-hangzhou.aliyuncs.com'].includes(url.hostname), 'Unexpected texture host');
					const image = await read(url, signal);
					const mime = image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff ? 'image/jpeg' : image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null;
					assert(mime && image.length <= 8 * 1024 * 1024, 'Unsupported or oversized texture'); textures.push({ id: texture, mime, image });
				}
			}
			db.exec('BEGIN');
			try {
				const saveTexture = db.prepare('INSERT OR IGNORE INTO textures(id,mime,image) VALUES(?,?,?)');
				for (const texture of textures) saveTexture.run(texture.id, texture.mime, texture.image);
				db.prepare('INSERT INTO models(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').run(id, source.name);
				db.prepare('DELETE FROM rooms WHERE model_id=?').run(id);
				db.prepare('DELETE FROM panel_search WHERE model_id=?').run(id);
				const insert = db.prepare('INSERT INTO rooms(model_id,id,name,geometry) VALUES(?,?,?,?)');
				const insertPanel = db.prepare('INSERT INTO panel_search(model_id,room_id,panel_id,serial,number) VALUES(?,?,?,?,?)');
				for (const room of rooms) { insert.run(id, room.id, room.name, room.data); for (const panel of room.matches) insertPanel.run(id, room.id, panel.id, panel.serial, panel.number); }
				db.exec('COMMIT');
			} catch (error) { db.exec('ROLLBACK'); throw error; }
			console.log(`Imported ${source.name}: ${rooms.length} rooms`);
		} catch (error) { failed++; console.error(`Failed ${source.name}: ${error.message}`); }
	}
	db.close(); if (failed) process.exitCode = 1;
}
if (require.main === module) run().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { prepare, doorMotion };
