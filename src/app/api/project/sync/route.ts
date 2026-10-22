import { NextResponse } from "next/server";
import { getProjectDashboard } from "@/lib/projectDashboard";
import { clickUpToken, requireSuperAdmin } from "@/lib/session";

export const maxDuration = 60;

export async function POST(request: Request) {
	await requireSuperAdmin();
	const token = await clickUpToken();
	if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
	let body: { task_id?: unknown };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "INVALID_PROJECT" }, { status: 400 });
	}
	const taskId = typeof body?.task_id === "string" ? body.task_id.trim() : "";
	if (!taskId) return NextResponse.json({ error: "INVALID_PROJECT" }, { status: 400 });
	try {
		const dashboard = await getProjectDashboard(token, {
			task_id: taskId, name: null, custom_id: null,
		}, true);
		return NextResponse.json({ ok: true, dashboard }, {
			headers: { "Cache-Control": "no-store" },
		});
	} catch (cause) {
		const code = cause instanceof Error ? cause.message : "PROJECT_SYNC_FAILED";
		const status = code === "RATE_LIMITED" ? 429
			: code === "PROJECT_SYNC_IN_PROGRESS" || code === "PROJECT_SYNC_SUPERSEDED" ? 409
				: code === "PROJECT_NOT_AVAILABLE" ? 404 : 502;
		return NextResponse.json({ error: status === 502 ? "PROJECT_SYNC_FAILED" : code }, { status });
	}
}
