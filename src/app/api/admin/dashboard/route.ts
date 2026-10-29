import { NextResponse } from "next/server";
import { getAdminDashboard } from "@/lib/adminDashboard";
import { isPpicSuperAdmin } from "@/lib/db";
import { clickUpToken, ppicSession } from "@/lib/session";

export const maxDuration = 60;

export async function GET(request: Request) {
	try {
		const userId = (await ppicSession())?.user_id;
		const token = await clickUpToken();
		if (!userId || !token)
			return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
		if (!(await isPpicSuperAdmin(userId)))
			return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
		const data = await getAdminDashboard(new URL(request.url).searchParams.get("refresh") === "1" ? "summary" : false);
		return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
	} catch (error) {
		console.error("[GET /api/admin/dashboard] Failed to load dashboard", error);
		return NextResponse.json({ error: "DASHBOARD_UNAVAILABLE" }, { status: 502 });
	}
}
