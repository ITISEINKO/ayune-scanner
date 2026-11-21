import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	const result = await auth.api.signInSocial({
		body: { provider: "clickup", callbackURL: "/", errorCallbackURL: "/login?error=clickup" },
		headers: request.headers,
		asResponse: true,
	});
	if (!result.ok) return NextResponse.redirect(new URL("/login?error=clickup", request.url));
	const body = await result.json() as { url?: string };
	if (!body.url) return NextResponse.redirect(new URL("/login?error=clickup", request.url));
	const response = NextResponse.redirect(body.url);
	for (const cookie of result.headers.getSetCookie()) response.headers.append("set-cookie", cookie);
	return response;
}
