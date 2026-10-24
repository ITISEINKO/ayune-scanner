import { NextResponse } from "next/server";
import { clickUpProfile, ppicSession } from "@/lib/session";

export async function GET() {
	const [session, profile] = await Promise.all([ppicSession(), clickUpProfile()]);
	return NextResponse.json({
		email: profile?.email ?? null,
		displayName: profile?.displayName ?? null,
		role: session?.role ?? null,
		allowedStatuses: session?.allowed_status ?? null,
	});
}
