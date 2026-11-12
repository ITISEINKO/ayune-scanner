import { NextResponse } from "next/server";
import { db, canImportLby } from "@/lib/db";
import { clickUpToken, ppicSession } from "@/lib/session";
import { parseShareLink } from "../../../../../scripts/import-lby-project.cjs";
import { fetchPublicModel } from "../../../../../scripts/public-model-import.cjs";

export const runtime = "nodejs";
export const maxDuration = 300;

async function allowed() {
	const session = await ppicSession();
	return Boolean(session && await clickUpToken() && await canImportLby(session.user_id));
}

export async function GET() {
	if (!(await allowed())) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
	const result = await db.execute("SELECT m.id, m.name, COUNT(r.id) AS rooms FROM ppic_public_model m LEFT JOIN ppic_public_room r ON r.model_id = m.id GROUP BY m.id, m.name ORDER BY m.name");
	return NextResponse.json({ models: result.rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
	if (!(await allowed())) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
	try {
		if (Number(request.headers.get("content-length")) > 24576) throw new Error("Request too large");
		const raw = await request.text();
		if (Buffer.byteLength(raw) > 24576) throw new Error("Request too large");
		const body = JSON.parse(raw);
		if (typeof body?.url !== "string" || body.url.length > 20000) throw new Error("Invalid link");
		const source = parseShareLink(body.url);
		const existing = await db.execute({ sql: "SELECT id FROM ppic_public_model WHERE id = ?", args: [source.orderId] });
		if (existing.rows.length) return NextResponse.json({ error: "Model ini sudah ada di panel viewer." }, { status: 409 });
		const { rooms, textures } = await fetchPublicModel(source, AbortSignal.any([request.signal, AbortSignal.timeout(240000)]));
		if (!(await allowed())) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
		request.signal.throwIfAborted();
		await db.batch([
			{ sql: "INSERT INTO ppic_public_model (id, name) VALUES (?, ?)", args: [source.orderId, source.name] },
			...textures.map((texture: { id: string; mime: string; image: Buffer }) => ({ sql: "INSERT OR IGNORE INTO ppic_public_texture (id, mime, image) VALUES (?, ?, ?)", args: [texture.id, texture.mime, texture.image] })),
			...rooms.flatMap((room: { id: string; name: string; data: Buffer; matches: { id: string; serial: string; number: string }[] }) => [
				{ sql: "INSERT INTO ppic_public_room (model_id, id, name, geometry) VALUES (?, ?, ?, ?)", args: [source.orderId, room.id, room.name, room.data] },
				...room.matches.map((panel) => ({ sql: "INSERT INTO ppic_public_panel_search (model_id, room_id, panel_id, serial, number) VALUES (?, ?, ?, ?, ?)", args: [source.orderId, room.id, panel.id, panel.serial, panel.number] })),
			]),
		], "write");
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ error: "Import gagal. Periksa link LBY dan coba lagi." }, { status: 400 });
	}
}
