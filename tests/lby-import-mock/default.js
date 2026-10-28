// Local-only fixture based on the observed LBY response envelopes and single-JSON ZIP format.
const http = require("node:http");
const { deflateRawSync, crc32 } = require("node:zlib");
const orderId = "123456789012345678";
function zip(raw) {
	const name = Buffer.from(`${orderId}.json`), data = deflateRawSync(raw), crc = crc32(raw);
	const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
	local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18);
	local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(name.length, 26);
	const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
	central.writeUInt16LE(8, 10); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20);
	central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(name.length, 28);
	const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
	end.writeUInt32LE(46 + name.length, 12); end.writeUInt32LE(30 + name.length + data.length, 16);
	return Buffer.concat([local, name, data, central, name, end]);
}
http.createServer((req, res) => {
	const url = new URL(req.url, "http://localhost"), mode = req.headers["x-test-mode"];
	if (req.method !== "GET") { res.writeHead(501); res.end(); return; }
	if (mode === "rate-limit") { res.writeHead(429, { "content-type": "application/json" }); res.end('{"code":429}'); return; }
	let data;
	if (url.pathname === `/api/erp/anyTenant/app/getPlankByOrderId/${orderId}`) {
		data = [{ id: "record", orderId, laberNumber: "000123", splitId: mode === "missing-match" ? "missing" : "panel",
			roomName: "Room", roomPlankIdx: "1", plankName: "Test panel" }];
	} else if (url.pathname === `/api/cd/anyTenant/app/getByOrderId/${orderId}`) {
		data = { file: mode === "bad-host" ? "http://127.0.0.1/private" : "https://ali-oss-lby.oss-cn-hangzhou.aliyuncs.com/model.zip" };
	} else if (url.pathname === "/model.zip") {
		const model = { value: { orderId: mode === "wrong-order" ? "999" : orderId, _V_: 0, docs: [{ id: "doc", models: [{
			id: "panel", className: "BasePlankModel", position: [0,0,0], quaternion: [0,0,0,1], scale: [1,1,1],
			sizeX: mode === "invalid-world" ? 1e308 : mode === "changed" ? 30 : 10, sizeY: 20, sizeZ: 1,
		}] }] } };
		const archive = zip(Buffer.from(JSON.stringify(model)));
		if (mode === "bad-crc") archive.writeUInt32LE(0, archive.length - 22 - (46 + Buffer.byteLength(`${orderId}.json`)) + 16);
		const send = () => { res.writeHead(200, { "content-type": "application/zip" }); res.end(archive); };
		if (mode === "slow") setTimeout(send, 21000);
		else send();
		return;
	} else { res.writeHead(501); res.end("Endpoint not modeled"); return; }
	res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ code: 0, msg: "ok", data }));
}).listen(process.env.PORT);
