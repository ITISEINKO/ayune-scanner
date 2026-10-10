import { NextResponse } from "next/server";
import {
	clickUpUserId,
	encodePpicSession,
	PPIC_SESSION_COOKIE,
	ppicLoginState,
} from "@/lib/session";

export async function GET() {
	const userId = await clickUpUserId();
	if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

	const state = await ppicLoginState(userId);
	const session = encodePpicSession(userId, state.role, state.allowed_status);
	if (!session)
		return NextResponse.json({ ok: false }, { status: 500 });

	const response = NextResponse.json({ ok: true, path: state.path });
	response.headers.set("Cache-Control", "no-store");
	response.cookies.set(PPIC_SESSION_COOKIE, session, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 9 * 60 * 60,
	});
	return response;
}
