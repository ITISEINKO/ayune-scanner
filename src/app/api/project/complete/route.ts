import { NextResponse } from "next/server";
import { completeProject } from "@/lib/projectDashboard";
import { clickUpToken, requireFreshSuperAdmin } from "@/lib/session";

export const maxDuration = 60;

export async function POST(request: Request) {
	const userId = await requireFreshSuperAdmin();
	const token = await clickUpToken();
	if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
	let taskId = "";
	try {
		const body = await request.json();
		taskId = typeof body?.task_id === "string" ? body.task_id.trim() : "";
	} catch {}
	if (!taskId) return NextResponse.json({ error: "INVALID_PROJECT" }, { status: 400 });
	try {
		const { id, custom_id, name, dashboard } = await completeProject(token, taskId, userId);
		return NextResponse.json({ task: { id, custom_id, name }, dashboard });
	} catch (cause) {
		const code = cause instanceof Error ? cause.message : "CLICKUP_ERROR";
		const status = code === "INVALID_PROJECT" ? 404
			: ["PROJECT_HAS_UNSCANNED_SERIALS", "PROJECT_STATUS_CHANGED", "PROJECT_SYNC_IN_PROGRESS", "PROJECT_SYNC_SUPERSEDED"].includes(code) ? 409
			: code === "RATE_LIMITED" ? 429 : 502;
		return NextResponse.json({ error: status === 502 ? "CLICKUP_ERROR" : code }, { status });
	}
}
