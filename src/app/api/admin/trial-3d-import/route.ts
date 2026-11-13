import { NextResponse } from "next/server";
import { gunzipSync } from "node:zlib";
import { canImportLby } from "@/lib/db";
import { clickUpToken, ppicSession } from "@/lib/session";
import { parseShareLink } from "../../../../../scripts/import-lby-project.cjs";
import { fetchPublicModel } from "../../../../../scripts/public-model-import.cjs";
import { activateTrialModel, listTrialModels, readTrialModel, saveTrialModel, searchTrialPanels } from "@/lib/trialPublicModels";

export const runtime = "nodejs";
export const maxDuration = 300;

async function allowed() {
	const session = await ppicSession();
	return Boolean(session && await clickUpToken() && await canImportLby(session.user_id));
}

export async function GET(request: Request) {
	if (!(await allowed())) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
	const params = new URL(request.url).searchParams;
	const serial = params.get("serial");
	if (serial !== null) {
		if (!serial.trim() || serial.length > 100) return new Response(null, { status: 400 });
		const matches = await searchTrialPanels(serial.trim(), true);
		const models = await listTrialModels();
		const results = await Promise.all(matches.map(async (item) => {
			const revision = models.find((model) => model.id === item.modelId && model.activeRevision === item.revision)?.activeRevision;
			const snapshot = revision && await readTrialModel(item.modelId, revision);
			return snapshot && revision ? { ...item, revision, rooms: snapshot.rooms.map(({ id, name }) => ({ id, name })) } : null;
		}));
		return NextResponse.json({ results: results.filter(Boolean) }, { headers: { "Cache-Control": "no-store" } });
	}
	const id = params.get("id"), revision = params.get("revision");
	if (id || revision) {
		if (!id || !/^\d{1,30}$/.test(id) || !revision || !/^[a-f0-9]{64}$/.test(revision)) return new Response(null, { status: 400 });
		const snapshot = await readTrialModel(id, revision);
		if (!snapshot) return new Response(null, { status: 404 });
		const texture = params.get("texture"), room = params.get("room");
		if (texture) {
			const image = snapshot.textures.find((item) => item.id === texture);
			return image ? new Response(new Uint8Array(Buffer.from(image.image, "base64")), { headers: { "Content-Type": image.mime, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }) : new Response(null, { status: 404 });
		}
		if (room) {
			const item = snapshot.rooms.find((item) => item.id === room);
			return item ? new Response(gunzipSync(Buffer.from(item.data, "base64"), { maxOutputLength: 64 * 1024 * 1024 }).toString("utf8"), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }) : new Response(null, { status: 404 });
		}
		return NextResponse.json({ name: snapshot.name, rooms: snapshot.rooms.map(({ id, name }) => ({ id, name })) });
	}
	return NextResponse.json({ models: await listTrialModels() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
	if (!(await allowed())) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
	if (!request.headers.get("accept")?.includes("application/x-ndjson")) return importModel(request, () => {}, request.signal);
	const cancellation = new AbortController();
	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		async start(controller) {
			const send = (value: unknown) => { if (!cancellation.signal.aborted && !request.signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`)); };
			try {
				const result = await importModel(request, (stage) => send({ stage }), AbortSignal.any([request.signal, cancellation.signal]));
				send(await result.json());
			} finally { if (!cancellation.signal.aborted) controller.close(); }
		},
		cancel() { cancellation.abort(); },
	});
	return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}

async function importModel(request: Request, progress: (stage: string) => void, signal: AbortSignal) {
	try {
		if (Number(request.headers.get("content-length")) > 24576) throw new Error("Request too large");
		const raw = await request.text();
		if (Buffer.byteLength(raw) > 24576) throw new Error("Request too large");
		const body = JSON.parse(raw);
		if (typeof body?.url !== "string" || body.url.length > 20000) throw new Error("Invalid link");
		const source = parseShareLink(body.url);
		const { rooms, textures } = await fetchPublicModel(source, AbortSignal.any([signal, AbortSignal.timeout(240000)]), () => false, (stage) => { if (stage) progress(stage); });
		const textureIds = new Set(textures.map((texture: { id: string }) => texture.id));
		const referencedTextures = new Set(rooms.flatMap((room: { data: Buffer }) => JSON.parse(gunzipSync(room.data, { maxOutputLength: 64 * 1024 * 1024 }).toString("utf8")).map((part: { texture?: string }) => part.texture).filter(Boolean)));
		if ([...referencedTextures].some((id) => !textureIds.has(String(id))) || !rooms.some((room: { matches: { serial: string }[] }) => room.matches.some((panel) => panel.serial))) throw new Error("INCOMPLETE_MODEL");
		if (!(await allowed())) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
		signal.throwIfAborted();
		progress("saving");
		const result = await saveTrialModel(source.orderId, source.name, rooms, textures);
		return NextResponse.json({ ok: true, id: source.orderId, ...result });
	} catch (error) {
		const message = error instanceof Error ? error.message : "";
		if (message === "MODEL_TOO_LARGE") return NextResponse.json({ error: "Model terlalu besar untuk penyimpanan trial." }, { status: 413 });
		if (message === "INCOMPLETE_MODEL" || message === "DUPLICATE_MODEL_ID") return NextResponse.json({ error: "Data model, texture, atau mapping panel tidak lengkap. Model aktif tidak berubah." }, { status: 422 });
		return NextResponse.json({ error: "Import gagal. Periksa link LBY dan coba lagi." }, { status: 400 });
	}
}

export async function PATCH(request: Request) {
	if (!(await allowed())) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
	try {
		if (Number(request.headers.get("content-length")) > 2048) return NextResponse.json({ error: "Permintaan terlalu besar." }, { status: 413 });
		const raw = await request.text();
		if (Buffer.byteLength(raw) > 2048) return NextResponse.json({ error: "Permintaan terlalu besar." }, { status: 413 });
		const body = JSON.parse(raw);
		if (typeof body.id !== "string" || !/^\d{1,30}$/.test(body.id) || typeof body.revision !== "string" || !/^[a-f0-9]{64}$/.test(body.revision) || !(body.expected === null || (typeof body.expected === "string" && /^[a-f0-9]{64}$/.test(body.expected)))) return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
		if (!await readTrialModel(body.id, body.revision)) return NextResponse.json({ error: "Versi tidak ditemukan." }, { status: 404 });
		if (!await activateTrialModel(body.id, body.revision, body.expected)) return NextResponse.json({ error: "Versi aktif berubah. Muat ulang halaman." }, { status: 409 });
		return NextResponse.json({ ok: true });
	} catch { return NextResponse.json({ error: "Aktivasi gagal." }, { status: 500 }); }
}
