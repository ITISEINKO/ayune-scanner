import { NextResponse } from "next/server";
import { getPpicMemberScanSummary, isPpicSuperAdmin } from "@/lib/db";
import { clickUpUserId, panelChannelMembers } from "@/lib/session";

export async function GET(request: Request) {
	const userId = await clickUpUserId();
	if (!userId)
		return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
	try {
		if (!(await isPpicSuperAdmin(userId)))
			return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
		const params = new URL(request.url).searchParams;
		const memberId = params.get("user_id")?.trim();
		const period = params.get("period") ?? "7";
		if (!memberId || (period !== "7" && period !== "30" && period !== "month"))
			return NextResponse.json({ error: "INVALID_SUMMARY_FILTER" }, { status: 400 });
		const result = await panelChannelMembers();
		if (!result.ok)
			return NextResponse.json({ error: "MEMBERS_UNAVAILABLE" }, { status: result.status });
		if (!result.members.some((member) => member.id === memberId))
			return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
		const summary = await getPpicMemberScanSummary(memberId, period);
		return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store" } });
	} catch {
		return NextResponse.json({ error: "DATABASE_ERROR" }, { status: 502 });
	}
}
