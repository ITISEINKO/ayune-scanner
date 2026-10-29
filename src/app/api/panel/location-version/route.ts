import { NextResponse } from "next/server";
import { canImportLby, getPpicAccess } from "@/lib/db";
import { getActivePanelLocationVersion } from "@/lib/panelLocationStore";
import { clickUpToken, ppicSession } from "@/lib/session";
import { hasPpicAdminAccess } from "@/types/ppic";

export async function GET(request: Request) {
	const headers = { "Cache-Control": "private, no-store" };
	const error = (status: number, code: string) => NextResponse.json({ error: code }, { status, headers });
	try {
		const session = await ppicSession();
		if (!session || !(await clickUpToken())) return error(401, "UNAUTHORIZED");
		const access = await getPpicAccess(session.user_id);
		if (!hasPpicAdminAccess(access?.role) && !(access?.role === "MEMBER" && Number(access.active) === 1)
			&& !(await canImportLby(session.user_id))) return error(403, "FORBIDDEN");
		const projects = new URL(request.url).searchParams.getAll("project");
		if (projects.length !== 1 || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(projects[0]))
			return error(400, "INVALID_PROJECT");
		return NextResponse.json({ active: await getActivePanelLocationVersion(projects[0]) }, { headers });
	} catch {
		return error(502, "LOCATION_UNAVAILABLE");
	}
}
