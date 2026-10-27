import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminDashboard, isAdminDashboardComplete } from "@/lib/adminDashboard";

export const maxDuration = 60;

export async function GET(request: Request) {
	const secret = process.env.CRON_SECRET;
	if (!secret) return NextResponse.json({ error: "CRON_NOT_CONFIGURED" }, { status: 503 });
	const actual = Buffer.from(request.headers.get("authorization") ?? "");
	const expected = Buffer.from(`Bearer ${secret}`);
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
		return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
	try {
		const data = await getAdminDashboard("projects");
		if (!isAdminDashboardComplete(data)) throw new Error("DASHBOARD_INCOMPLETE");
		return NextResponse.json({ ok: true, calculatedAt: data.now }, { headers: { "Cache-Control": "private, no-store" } });
	} catch {
		return NextResponse.json({ error: "DASHBOARD_UNAVAILABLE" }, { status: 502 });
	}
}
