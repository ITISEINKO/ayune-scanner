import { NextResponse } from "next/server";
import { getPpicAccess, getPpicMemberScanSummary } from "@/lib/db";
import { clickUpUserId, ppicSession } from "@/lib/session";

export async function GET() {
	try {
		const userId = (await ppicSession())?.user_id ?? (await clickUpUserId());
		if (!userId)
			return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
		if ((await getPpicAccess(userId))?.role !== "MEMBER")
			return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
		const summary = await getPpicMemberScanSummary(userId, "7");
		return NextResponse.json(summary, {
			headers: { "Cache-Control": "private, no-store" },
		});
	} catch {
		return NextResponse.json({ error: "DATABASE_ERROR" }, { status: 502 });
	}
}
