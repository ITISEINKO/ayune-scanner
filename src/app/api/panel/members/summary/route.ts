import { NextResponse } from "next/server";
import { getPpicAccess, getPpicMemberScanSummary, isPpicSuperAdmin } from "@/lib/db";
import { ppicSession } from "@/lib/session";

export async function GET(request: Request) {
	try {
		const userId = (await ppicSession())?.user_id;
		if (!userId)
			return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
		if (!(await isPpicSuperAdmin(userId)))
			return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
		const params = new URL(request.url).searchParams;
		const memberId = params.get("user_id")?.trim();
		const period = params.get("period") ?? "7";
		if (!memberId || (period !== "7" && period !== "30" && period !== "month"))
			return NextResponse.json({ error: "INVALID_SUMMARY_FILTER" }, { status: 400 });
		if (!(await getPpicAccess(memberId)))
			return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
		const summary = await getPpicMemberScanSummary(memberId, period);
		return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store" } });
	} catch {
		return NextResponse.json({ error: "DATABASE_ERROR" }, { status: 502 });
	}
}
