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
		const data = await getAdminDashboard(token, userId, new URL(request.url).searchParams.get("refresh") === "1");
		return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
	} catch {
		return NextResponse.json({ error: "DASHBOARD_UNAVAILABLE" }, { status: 502 });
	}
}
