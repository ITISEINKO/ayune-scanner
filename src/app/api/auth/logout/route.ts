import { NextResponse } from "next/server";
import { PPIC_SELECTED_PROJECT_COOKIE, SESSION_COOKIE } from "@/lib/session";
import { auth } from "@/lib/auth";

export async function GET(request: Request) {
	const signOut = await auth.api.signOut({ headers: request.headers, asResponse: true });
	const response = NextResponse.redirect(new URL("/login", request.url));
	for (const cookie of signOut.headers.getSetCookie()) response.headers.append("set-cookie", cookie);
	response.cookies.set("clickup_access_token", "", { path: "/", maxAge: 0 });
	response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
	response.cookies.set(PPIC_SELECTED_PROJECT_COOKIE, "", {
		path: "/",
		maxAge: 0,
	});
	response.cookies.set("clickup_oauth_state", "", {
		path: "/api/auth/clickup/callback",
		maxAge: 0,
	});
	return response;
}
