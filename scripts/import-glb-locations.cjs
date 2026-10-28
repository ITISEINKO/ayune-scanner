const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createHash } = require("node:crypto");

const vector = (value, length) => Array.isArray(value) && value.length === length && value.every(Number.isFinite);
const box = (points) => {
	assert(points.length > 0, "Named panel has no geometry");
	const min = [0,1,2].map((a) => Math.min(...points.map((p) => p[a])));
	const max = [0,1,2].map((a) => Math.max(...points.map((p) => p[a])));
	return [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]]
		.map((p) => p.map((n, a) => n ? max[a] : min[a]));
};

function transform(point, chain) {
	let p = point;
	for (const node of [...chain].reverse()) {
		if (node.matrix) {
			assert(vector(node.matrix, 16), "Invalid node matrix");
			const m = node.matrix;
			p = [0,1,2].map((a) => m[a]*p[0] + m[a+4]*p[1] + m[a+8]*p[2] + m[a+12]);
		} else {
			const s = node.scale ?? [1,1,1], q = node.rotation ?? [0,0,0,1], t = node.translation ?? [0,0,0];
			assert(vector(s, 3) && vector(t, 3) && vector(q, 4) && Math.abs(Math.hypot(...q)-1) < 0.001,
				"Invalid node transform");
			const [x,y,z] = p.map((n,a) => n*s[a]), [qx,qy,qz,qw] = q;
			const tx=2*(qy*z-qz*y), ty=2*(qz*x-qx*z), tz=2*(qx*y-qy*x);
			p = [x+qw*tx+qy*tz-qz*ty, y+qw*ty+qz*tx-qx*tz, z+qw*tz+qx*ty-qy*tx].map((n,a) => n+t[a]);
		}
	}
	assert(p.every(Number.isFinite), "Non-finite transformed point");
	return p;
}

function importGlbLocations(raw, roomName, serials) {
	assert(raw.length >= 20 && raw.toString("ascii",0,4) === "glTF", "Invalid GLB header");
	assert(raw.readUInt32LE(4) === 2 && raw.readUInt32LE(8) === raw.length, "Invalid GLB version/length");
	assert(serials.length > 0 && new Set(serials).size === serials.length && serials.every((s) => typeof s === "string" && s.trim()), "Supply unique serials");
	let doc;
	for (let at=12; at<raw.length;) {
		assert(at+8 <= raw.length, "Truncated GLB chunk");
		const size=raw.readUInt32LE(at), type=raw.readUInt32LE(at+4);
		assert(size % 4 === 0 && at+8+size <= raw.length, "Invalid GLB chunk length");
		if (type === 0x4e4f534a) {
			assert(!doc, "Duplicate GLB JSON chunk");
			doc=JSON.parse(raw.toString("utf8",at+8,at+8+size).trim());
		}
		at+=8+size;
	}
	assert(doc?.asset?.version === "2.0" && Array.isArray(doc.nodes), "Missing glTF 2 scene");
	assert(!doc.skins?.length && !doc.animations?.length, "Only static rigid models are supported");
	const roots=doc.scenes?.[doc.scene ?? 0]?.nodes;
	assert(Array.isArray(roots), "Missing active scene");
	const seen=new Set(), tagged=new Map(), panels=[];
	const output = (id, barcode, corners) => ({
		id: `glb-node-${id}`, barcode, roomName, panelNumber: "",
		// glTF is Y-up in metres; the lightweight viewer is Z-up. Round to 0.1 mm.
		corners: corners.map(([x,y,z]) => [x,-z,y].map((n) => Math.round(n*10000)/10)),
	});
	function visit(index, chain, owner) {
		assert(Number.isInteger(index) && doc.nodes[index] && !seen.has(index), "Invalid, cyclic or multiply-parented node");
		seen.add(index);
		const node=doc.nodes[index], next=[...chain,node];
		const serial=serials.find((s) => node.name === s || node.name?.endsWith(`_${s}`));
		if (serial && owner?.barcode !== serial) {
			assert(!owner, "Different serials nested inside one panel");
			assert(!tagged.has(serial), `Duplicate serial instance: ${serial}`);
			owner={ id:index, barcode:serial, chain:next, points:[] };
			tagged.set(serial,owner);
		}
		if (node.mesh !== undefined) {
			const primitives=doc.meshes?.[node.mesh]?.primitives;
			assert(Array.isArray(primitives) && primitives.length, "Missing mesh primitives");
			const points=primitives.flatMap((primitive) => {
				assert(!primitive.targets?.length, "Morph targets are unsupported");
				const accessor=doc.accessors?.[primitive.attributes?.POSITION];
				assert(accessor?.type === "VEC3" && vector(accessor.min,3) && vector(accessor.max,3) &&
					accessor.min.every((n,a) => n<=accessor.max[a]), "Missing/invalid POSITION bounds");
				return box([accessor.min,accessor.max]);
			});
			if (owner) owner.points.push(...points.map((p) => transform(p,next.slice(owner.chain.length))));
			else panels.push(output(index,null,box(points).map((p) => transform(p,next))));
		}
		for (const child of node.children ?? []) visit(child,next,owner);
	}
	for (const root of roots) visit(root,[],null);
	for (const serial of serials) {
		const owner=tagged.get(serial);
		assert(owner, `Serial not found: ${serial}`);
		panels.push(output(owner.id,serial,box(owner.points).map((p) => transform(p,owner.chain))));
	}
	// shortcut: POSITION bounds give boxes, not cutouts or curved surfaces; use a mesh renderer if those become necessary.
	return { version:createHash("sha256").update(JSON.stringify(panels)).digest("hex").slice(0,12), panels };
}

module.exports={ importGlbLocations };
if (require.main === module) {
	const [input,output,room,...serials]=process.argv.slice(2);
	assert(input && output && room, "Usage: node scripts/import-glb-locations.cjs <input.glb> <output.json> <room> <serial...>");
	const snapshot=importGlbLocations(fs.readFileSync(input),room,serials);
	fs.writeFileSync(output,`${JSON.stringify(snapshot)}\n`);
	console.log(JSON.stringify({version:snapshot.version,boxes:snapshot.panels.length,serials:snapshot.panels.filter((p)=>p.barcode).map((p)=>p.barcode),bytes:fs.statSync(output).size}));
}
