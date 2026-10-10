import { NextResponse } from "next/server";
import { clickUpEmail, ppicSession } from "@/lib/session";

export async function GET() {
	const [session, email] = await Promise.all([ppicSession(), clickUpEmail()]);
	return NextResponse.json({
		email,
		role: session?.role ?? null,
		allowedStatus: session?.allowed_status ?? null,
	});
}
