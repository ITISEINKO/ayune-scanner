import { after, NextResponse } from "next/server";
import {
	clearProjectSerialCache,
	preloadProjectSerialCache,
} from "@/lib/projectSerialCache";
import { inProgressProjects } from "@/lib/projects";
import { ppicStatusPath } from "@/lib/produksiPanel";
import {
	clickUpUserId,
	clickUpToken,
	encodeSelectedProject,
	PPIC_SELECTED_PROJECT_COOKIE,
	ppicSession,
	selectedProject,
} from "@/lib/session";
import { isPpicSuperAdmin } from "@/lib/db";
import type { SelectedProject } from "@/types/project";

const error = (status: number, code: string) =>
	NextResponse.json({ ok: false, error: code }, { status });

const projectSession = async () => {
	const session = await ppicSession();
	if (session && (session.role === "SUPER_ADMIN" || session.allowed_status)) return session;
	const userId = await clickUpUserId();
	return userId && (await isPpicSuperAdmin(userId))
		? { user_id: userId, role: "SUPER_ADMIN" as const, allowed_status: null }
		: null;
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
	const session = await projectSession();
	if (!session) return error(401, "UNAUTHORIZED");
	return NextResponse.json({ project: await selectedProject(session.user_id) });
}

export async function POST(request: Request) {
	const session = await projectSession();
	if (!session) return error(401, "UNAUTHORIZED");
	let taskId = "";
	const formSubmission = request.headers
		.get("content-type")
		?.includes("application/x-www-form-urlencoded");
	try {
		if (formSubmission) {
			const form = await request.formData();
			taskId = typeof form.get("task_id") === "string" ? String(form.get("task_id")).trim() : "";
		} else {
			const body = (await request.json()) as { task_id?: unknown };
			taskId = typeof body.task_id === "string" ? body.task_id.trim() : "";
		}
	} catch {
		return error(400, "INVALID_PROJECT");
	}
	if (!taskId) return error(400, "INVALID_PROJECT");
	const token = await clickUpToken();
	if (!token) return error(401, "UNAUTHORIZED");
	try {
		const project = (await inProgressProjects(token, true)).find((task) => task.id === taskId);
		if (!project) return error(403, "PROJECT_NOT_AVAILABLE");
		const selection: SelectedProject = {
			task_id: project.id,
			name: project.name ?? null,
			custom_id: project.custom_id ?? null,
		};
		const cookie = encodeSelectedProject(session.user_id, selection);
		if (!cookie) return error(500, "SESSION_ERROR");
		const path =
			session.role === "SUPER_ADMIN"
				? "/admin/project"
				: ppicStatusPath(session.allowed_status![0]);
		const response = formSubmission
			? NextResponse.redirect(new URL(path, request.url), 303)
			: NextResponse.json({ ok: true, project: selection, path });
		selectionCookie(response, cookie);
		if (session.role === "MEMBER")
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
	const session = await projectSession();
	if (!session) return error(401, "UNAUTHORIZED");
	const response = NextResponse.json({ ok: true });
	response.cookies.set(PPIC_SELECTED_PROJECT_COOKIE, "", {
		path: "/",
		maxAge: 0,
	});
	return response;
}
