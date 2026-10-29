import { clickUpHeaders } from "@/lib/clickup";
import {
	encodePpicSession,
	PPIC_SESSION_COOKIE,
	ppicLoginState,
} from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

const loginError = (request: NextRequest, error = "clickup") =>
	NextResponse.redirect(new URL(`/login?error=${error}`, request.url));

const unauthorized = (request: NextRequest) => {
	const response = NextResponse.redirect(new URL("/unauthorized", request.url));
	response.cookies.set("clickup_access_token", "", { path: "/", maxAge: 0 });
	response.cookies.set("clickup_oauth_state", "", {
		path: "/api/auth/clickup/callback",
		maxAge: 0,
	});
	return response;
};

export async function GET(request: NextRequest) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	if (
		!code ||
		!state ||
		state !== request.cookies.get("clickup_oauth_state")?.value
	)
		return loginError(request);

	const clientId = process.env.CLICKUP_CLIENT_ID;
	const clientSecret = process.env.CLICKUP_CLIENT_SECRET;
	const redirectUri = process.env.CLICKUP_REDIRECT_URI;
	const teamId = process.env.CLICKUP_TEAM_ID;
	if (!clientId || !clientSecret || !redirectUri || !teamId)
		return new NextResponse("ClickUp OAuth is not configured.", {
			status: 500,
		});

	let tokenResponse: Response;
	try {
		tokenResponse = await fetch("https://api.clickup.com/api/v2/oauth/token", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				client_id: clientId,
				client_secret: clientSecret,
				code,
				redirect_uri: redirectUri,
			}),
		});
	} catch {
		return loginError(request);
	}
	if (!tokenResponse.ok) return loginError(request);
	const { access_token: token } = (await tokenResponse.json()) as {
		access_token?: unknown;
	};
	if (typeof token !== "string" || !token) return loginError(request);

	const [userResult, teamsResult] = await Promise.allSettled([
		fetch("https://api.clickup.com/api/v2/user", {
			headers: clickUpHeaders(token),
			cache: "no-store",
		}),
		fetch("https://api.clickup.com/api/v2/team", {
			headers: clickUpHeaders(token),
			cache: "no-store",
		}),
	]);
	if (userResult.status === "rejected") return loginError(request);
	const userResponse = userResult.value;
	if (!userResponse.ok) return loginError(request);

	let userId: string | null = null;
	try {
		const body = (await userResponse.json()) as {
			user?: { id?: string | number };
			id?: string | number;
		};
		const id = body.user?.id ?? body.id;
		if (id !== undefined && id !== null) userId = String(id);
	} catch {
		return unauthorized(request);
	}
	if (!userId) return unauthorized(request);

	if (teamsResult.status === "rejected") return unauthorized(request);
	const teamsResponse = teamsResult.value;
	if (!teamsResponse.ok) return unauthorized(request);
	let teams: unknown;
	try {
		({ teams } = (await teamsResponse.json()) as { teams?: unknown });
	} catch {
		return unauthorized(request);
	}
	const hasIseinko =
		Array.isArray(teams) &&
		teams.some(
			(team) =>
				typeof team === "object" &&
				team !== null &&
				"id" in team &&
				String(team.id) === teamId,
		);
	if (!hasIseinko) return unauthorized(request);

	let loginState: Awaited<ReturnType<typeof ppicLoginState>>;
	try {
		loginState = await ppicLoginState(userId);
	} catch {
		return unauthorized(request);
	}

	const response = NextResponse.redirect(new URL(loginState.path, request.url));
	const session = encodePpicSession(
		userId,
		loginState.role,
		loginState.allowed_status,
		loginState.can_import_lby,
	);
	if (session)
		response.cookies.set(PPIC_SESSION_COOKIE, session, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 9 * 60 * 60,
		});
	response.cookies.set("clickup_access_token", token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 9 * 60 * 60,
	});
	response.cookies.set("clickup_oauth_state", "", {
		path: "/api/auth/clickup/callback",
		maxAge: 0,
	});
	return response;
}
