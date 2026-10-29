import { NextResponse } from "next/server";
import { getPpicProjectStatusChanges, isPpicSuperAdmin } from "@/lib/db";
import { clickUpToken, ppicSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	const userId = (await ppicSession())?.user_id;
	if (!userId || !(await clickUpToken()))
		return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
	if (!(await isPpicSuperAdmin(userId)))
		return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
	const params = new URL(request.url).searchParams;
	const project = params.get("project")?.trim();
	const since = Number(params.get("since"));
	if (!project || !Number.isFinite(since) || since < 0)
		return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

	return NextResponse.json(
		{ changes: await getPpicProjectStatusChanges(project, since) },
		{ headers: { "Cache-Control": "no-store" } },
	);
}
