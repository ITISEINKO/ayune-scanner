import { NextResponse } from "next/server";
import { getPpicProjectStatusChanges } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	await requireSuperAdmin();
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
