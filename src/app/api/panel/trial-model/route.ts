import { gunzipSync } from "node:zlib";
import { canImportLby, getPpicAccess } from "@/lib/db";
import { clickUpToken, ppicSession } from "@/lib/session";
import { listTrialModels, readTrialModel } from "@/lib/trialPublicModels";
import { hasPpicAdminAccess } from "@/types/ppic";

export const runtime = "nodejs";

export async function GET(request: Request) {
	const session = await ppicSession();
	if (!session || !(await clickUpToken())) return new Response(null, { status: 401 });
	const access = await getPpicAccess(session.user_id);
	if (!hasPpicAdminAccess(access?.role) && !(access?.role === "MEMBER" && Number(access.active) === 1) && !(await canImportLby(session.user_id))) return new Response(null, { status: 403 });
	const params = new URL(request.url).searchParams;
	const id = params.get("id"), revision = params.get("revision"), room = params.get("room"), texture = params.get("texture");
	if (!id || !/^\d{1,30}$/.test(id) || !revision || !/^[a-f0-9]{64}$/.test(revision) || Boolean(room) === Boolean(texture)) return new Response(null, { status: 400 });
	if (!(await listTrialModels()).some((model) => model.id === id && model.activeRevision === revision)) return new Response(null, { status: 404 });
	const snapshot = await readTrialModel(id, revision);
	if (!snapshot) return new Response(null, { status: 404 });
	const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
	if (room) {
		const item = snapshot.rooms.find((entry) => entry.id === room);
		return item ? new Response(gunzipSync(Buffer.from(item.data, "base64"), { maxOutputLength: 64 * 1024 * 1024 }).toString("utf8"), { headers: { ...headers, "Content-Type": "application/json" } }) : new Response(null, { status: 404 });
	}
	const item = snapshot.textures.find((entry) => entry.id === texture);
	return item ? new Response(new Uint8Array(Buffer.from(item.image, "base64")), { headers: { ...headers, "Content-Type": item.mime } }) : new Response(null, { status: 404 });
}
