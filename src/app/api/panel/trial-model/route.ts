import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { listTrialModels, readTrialModel } from "@/lib/trialPublicModels";

export const runtime = "nodejs";

// shortcut: cache one revision per process; use bounded shared storage if traffic spans many models or instances.
let cached: { key: string; snapshot: ReturnType<typeof readTrialModel> } | undefined;

export async function GET(request: Request) {
	const params = new URL(request.url).searchParams;
	const id = params.get("id"), revision = params.get("revision"), room = params.get("room"), texture = params.get("texture");
	if (!id || !/^\d{1,30}$/.test(id) || !revision || !/^[a-f0-9]{64}$/.test(revision) || Boolean(room) === Boolean(texture)) return new Response(null, { status: 400 });
	if (!(await listTrialModels()).some((model) => model.id === id && model.activeRevision === revision)) return new Response(null, { status: 404 });
	const key = `${id}:${revision}`;
	if (cached?.key !== key) {
		const entry = { key, snapshot: readTrialModel(id, revision) };
		cached = entry;
		entry.snapshot.catch(() => { if (cached === entry) cached = undefined; });
	}
	const snapshot = await cached.snapshot;
	if (!snapshot) return new Response(null, { status: 404 });
	const etag = `"${createHash("sha256").update(JSON.stringify([id, revision, room, texture])).digest("hex")}"`;
	const headers = { "Cache-Control": "private, no-cache", ETag: etag, "X-Content-Type-Options": "nosniff" };
	if (room) {
		const item = snapshot.rooms.find((entry) => entry.id === room);
		if (item && request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
		return item ? new Response(gunzipSync(Buffer.from(item.data, "base64"), { maxOutputLength: 64 * 1024 * 1024 }).toString("utf8"), { headers: { ...headers, "Content-Type": "application/json" } }) : new Response(null, { status: 404 });
	}
	const item = snapshot.textures.find((entry) => entry.id === texture);
	if (item && request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
	return item ? new Response(new Uint8Array(Buffer.from(item.image, "base64")), { headers: { ...headers, "Content-Type": item.mime } }) : new Response(null, { status: 404 });
}
