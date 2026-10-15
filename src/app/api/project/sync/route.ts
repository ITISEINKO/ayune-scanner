import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { clearPanelTaskCache } from "@/lib/projectDashboard";
import { requireSuperAdmin } from "@/lib/session";

export async function POST() {
	await requireSuperAdmin();
	clearPanelTaskCache();
	revalidateTag("clickup-project-data", { expire: 0 });
	return NextResponse.json({ ok: true });
}
