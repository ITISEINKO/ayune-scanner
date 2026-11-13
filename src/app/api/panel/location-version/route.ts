import { NextResponse } from "next/server";
import { getActivePanelLocationVersion } from "@/lib/panelLocationStore";

export async function GET(request: Request) {
	const headers = { "Cache-Control": "private, no-store" };
	const error = (status: number, code: string) => NextResponse.json({ error: code }, { status, headers });
	try {
		const projects = new URL(request.url).searchParams.getAll("project");
		if (projects.length !== 1 || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(projects[0]))
			return error(400, "INVALID_PROJECT");
		return NextResponse.json({ active: await getActivePanelLocationVersion(projects[0]) }, { headers });
	} catch {
		return error(502, "LOCATION_UNAVAILABLE");
	}
}
