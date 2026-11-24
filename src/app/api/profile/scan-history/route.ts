import { NextResponse } from "next/server";
import { getPpicScanHistory } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { MEMBER_ACTIVITY_PAGE_SIZE } from "@/types/ppic";

export async function GET(request: Request) {
	try {
		const userId = (await getAppSession())?.user_id;
		if (!userId)
			return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

		const rawOffset = new URL(request.url).searchParams.get("offset");
		const offset = Number(rawOffset);
		if (rawOffset === null || !Number.isSafeInteger(offset) || offset < 0)
			return NextResponse.json({ error: "INVALID_OFFSET" }, { status: 400 });

		const rows = await getPpicScanHistory(userId, MEMBER_ACTIVITY_PAGE_SIZE + 1, offset);
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
