import { NextResponse } from "next/server";
import { PPIC_SESSION_COOKIE } from "@/lib/session";

export function GET(request: Request) {
	const response = NextResponse.redirect(new URL("/login", request.url));
	response.cookies.set("clickup_access_token", "", { path: "/", maxAge: 0 });
	response.cookies.set(PPIC_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
	response.cookies.set("clickup_oauth_state", "", {
		path: "/api/auth/clickup/callback",
		maxAge: 0,
	});
	return response;
}
