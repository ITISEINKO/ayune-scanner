import { NextResponse } from "next/server";
import { getPpicAccess, getPpicScanHistory, isPpicSuperAdmin } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { MEMBER_ACTIVITY_PAGE_SIZE } from "@/types/ppic";

export async function GET(request: Request) {
	try {
		const userId = (await getAppSession())?.user_id;
		if (!userId)
			return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
		if (!(await isPpicSuperAdmin(userId)))
			return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

		const params = new URL(request.url).searchParams;
		const memberId = params.get("user_id")?.trim();
		const rawOffset = params.get("offset");
		const offset = Number(rawOffset);
		if (!memberId || rawOffset === null || !Number.isSafeInteger(offset) || offset < 0)
			return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
		if (!(await getPpicAccess(memberId)))
			return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });

		const rows = await getPpicScanHistory(memberId, MEMBER_ACTIVITY_PAGE_SIZE + 1, offset);
		return NextResponse.json(
			{
				history: rows.slice(0, MEMBER_ACTIVITY_PAGE_SIZE),
				hasMore: rows.length > MEMBER_ACTIVITY_PAGE_SIZE,
			},
			{ headers: { "Cache-Control": "private, no-store" } },
		);
	} catch {
		return NextResponse.json({ error: "DATABASE_ERROR" }, { status: 502 });
	}
}
