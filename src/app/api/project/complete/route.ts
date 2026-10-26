import { NextResponse } from "next/server";
import { completeProject } from "@/lib/projectDashboard";
import { clickUpToken, requireFreshSuperAdmin } from "@/lib/session";

export const maxDuration = 60;

export async function POST(request: Request) {
	await requireFreshSuperAdmin();
	const token = await clickUpToken();
	if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
	let taskId = "";
	try {
		const body = await request.json();
		taskId = typeof body?.task_id === "string" ? body.task_id.trim() : "";
	} catch {}
	if (!taskId) return NextResponse.json({ error: "INVALID_PROJECT" }, { status: 400 });
	try {
		const { id, custom_id, name } = await completeProject(token, taskId);
		return NextResponse.json({ task: { id, custom_id, name } });
	} catch (cause) {
		const code = cause instanceof Error ? cause.message : "CLICKUP_ERROR";
		const status = code === "INVALID_PROJECT" ? 404
			: code === "PROJECT_HAS_UNSCANNED_SERIALS" || code === "PROJECT_STATUS_CHANGED" ? 409
			: code === "RATE_LIMITED" ? 429 : 502;
		return NextResponse.json({ error: status === 502 ? "CLICKUP_ERROR" : code }, { status });
	}
}
