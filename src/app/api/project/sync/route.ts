import { NextResponse } from "next/server";
import { getProjectDashboard } from "@/lib/projectDashboard";
import { isPpicSuperAdmin } from "@/lib/db";
import { clickUpToken, ppicSession } from "@/lib/session";

export const maxDuration = 60;

async function loadProject(request: Request, refresh: boolean) {
	try {
		const userId = (await ppicSession())?.user_id;
		const token = await clickUpToken();
		if (!userId || !token)
			return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
		if (!(await isPpicSuperAdmin(userId)))
			return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
		let taskId: unknown = new URL(request.url).searchParams.get("task_id");
		if (refresh) {
			try { taskId = (await request.json())?.task_id; }
			catch { return NextResponse.json({ error: "INVALID_PROJECT" }, { status: 400 }); }
		}
		if (typeof taskId !== "string" || !taskId.trim())
			return NextResponse.json({ error: "INVALID_PROJECT" }, { status: 400 });
		const dashboard = await getProjectDashboard(token, {
			task_id: taskId.trim(), name: null, custom_id: null,
		}, refresh);
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

export const GET = (request: Request) => loadProject(request, false);
export const POST = (request: Request) => loadProject(request, true);
