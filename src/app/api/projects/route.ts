import { NextResponse } from "next/server";
import { inProgressProjects } from "@/lib/projects";
import { clickUpToken } from "@/lib/session";

const error = (status: number, message: string) =>
	NextResponse.json({ error: message }, { status });

export async function GET(request: Request) {
	const token = await clickUpToken();
	if (!token) return error(401, "UNAUTHORIZED");

	let tasks;
	try {
		tasks = await inProgressProjects(
			token,
			new URL(request.url).searchParams.get("refresh") === "1",
		);
	} catch (cause) {
		const code = cause instanceof Error ? cause.message : "CLICKUP_ERROR";
		return error(code === "RATE_LIMITED" ? 429 : 502, code);
	}

	return NextResponse.json({
		tasks: tasks.map(({ id, custom_id, name }) => ({ id, custom_id, name })),
	});
}
