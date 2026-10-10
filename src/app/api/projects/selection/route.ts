import { after, NextResponse } from "next/server";
import {
	clearProjectSerialCache,
	preloadProjectSerialCache,
} from "@/lib/projectSerialCache";
import { inProgressProjects } from "@/lib/projects";
import { ppicStatusPath } from "@/lib/produksiPanel";
import {
	clickUpToken,
	encodeSelectedProject,
	PPIC_SELECTED_PROJECT_COOKIE,
	ppicSession,
	selectedProject,
} from "@/lib/session";
import type { SelectedProject } from "@/types/project";

const error = (status: number, code: string) =>
	NextResponse.json({ ok: false, error: code }, { status });

const memberSession = async () => {
	const session = await ppicSession();
	return session?.role === "MEMBER" && session.allowed_status ? session : null;
};

const selectionCookie = (response: NextResponse, value: string) => {
	response.cookies.set(PPIC_SELECTED_PROJECT_COOKIE, value, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 9 * 60 * 60,
	});
};

export async function GET() {
	const session = await memberSession();
	if (!session) return error(401, "UNAUTHORIZED");
	return NextResponse.json({ project: await selectedProject(session.user_id) });
}

export async function POST(request: Request) {
	const session = await memberSession();
	if (!session) return error(401, "UNAUTHORIZED");
	let body: { task_id?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return error(400, "INVALID_PROJECT");
	}
	const taskId = typeof body.task_id === "string" ? body.task_id.trim() : "";
	if (!taskId) return error(400, "INVALID_PROJECT");
	const token = await clickUpToken();
	if (!token) return error(401, "UNAUTHORIZED");
	try {
		const project = (await inProgressProjects(token)).find((task) => task.id === taskId);
		if (!project) return error(403, "PROJECT_NOT_AVAILABLE");
		const selection: SelectedProject = {
			task_id: project.id,
			name: project.name ?? null,
			custom_id: project.custom_id ?? null,
		};
		const cookie = encodeSelectedProject(session.user_id, selection);
		if (!cookie) return error(500, "SESSION_ERROR");
		const response = NextResponse.json({
			ok: true,
			project: selection,
			path: ppicStatusPath(session.allowed_status[0]),
		});
		selectionCookie(response, cookie);
		after(async () => {
			try {
				await clearProjectSerialCache(project.id);
				await preloadProjectSerialCache(token, project);
			} catch (error) {
				console.error("Project serial cache preload failed", {
					projectId: project.id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		});
		return response;
	} catch (cause) {
		const code = cause instanceof Error ? cause.message : "CLICKUP_ERROR";
		return error(code === "RATE_LIMITED" ? 429 : 502, code);
	}
}

export async function DELETE() {
	const session = await memberSession();
	if (!session) return error(401, "UNAUTHORIZED");
	const response = NextResponse.json({ ok: true });
	response.cookies.set(PPIC_SELECTED_PROJECT_COOKIE, "", {
		path: "/",
		maxAge: 0,
	});
	return response;
}
