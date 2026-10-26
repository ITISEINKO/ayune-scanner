import { NextResponse } from "next/server";
import { projectsByStatus, startProject } from "@/lib/projects";
import { clickUpToken, requireFreshSuperAdmin } from "@/lib/session";

const error = (status: number, message: string) =>
	NextResponse.json({ error: message }, { status });

export async function GET(request: Request) {
	const query = new URL(request.url).searchParams;
	const status = query.get("status") ?? "in progress";
	if (status !== "in progress" && status !== "to do" && status !== "complete") return error(400, "INVALID_STATUS");
	if (status !== "in progress") await requireFreshSuperAdmin();
	const token = await clickUpToken();
	if (!token) return error(401, "UNAUTHORIZED");

	let tasks;
	try {
		tasks = await projectsByStatus(
			token,
			status,
			query.get("refresh") === "1",
		);
	} catch (cause) {
		const code = cause instanceof Error ? cause.message : "CLICKUP_ERROR";
		return error(code === "RATE_LIMITED" ? 429 : 502, code);
	}

	return NextResponse.json({
		tasks: tasks.map(({ id, custom_id, name }) => ({ id, custom_id, name })),
	});
}

export async function POST(request: Request) {
	await requireFreshSuperAdmin();
	const token = await clickUpToken();
	if (!token) return error(401, "UNAUTHORIZED");
	let taskId = "";
	try {
		const body = await request.json();
		taskId = typeof body?.task_id === "string" ? body.task_id.trim() : "";
	} catch {
		return error(400, "INVALID_PROJECT");
	}
	if (!taskId) return error(400, "INVALID_PROJECT");
	try {
		const { id, custom_id, name } = await startProject(token, taskId);
		return NextResponse.json({ task: { id, custom_id, name } });
	} catch (cause) {
		const code = cause instanceof Error ? cause.message : "CLICKUP_ERROR";
		const status = code === "INVALID_PROJECT" ? 404
			: code === "PROJECT_STATUS_CHANGED" ? 409
			: code === "RATE_LIMITED" ? 429 : 502;
		return error(status, code);
	}
}
