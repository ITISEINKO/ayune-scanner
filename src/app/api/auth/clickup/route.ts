import { NextResponse } from "next/server";
import { clickUpAuthUrl } from "@/lib/clickup";

export function GET() {
	const clientId = process.env.CLICKUP_CLIENT_ID;
	const redirectUri = process.env.CLICKUP_REDIRECT_URI;
	if (!clientId || !redirectUri)
		return new NextResponse("ClickUp OAuth is not configured.", { status: 500 });

	const state = crypto.randomUUID();
	const url = clickUpAuthUrl(clientId, redirectUri, state);

	const response = NextResponse.redirect(url);
	response.cookies.set("clickup_oauth_state", state, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/api/auth/clickup/callback",
		maxAge: 600,
	});
	return response;
}
