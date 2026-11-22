import { auth } from "@/lib/auth";

export async function GET(request: Request) {
	const url = new URL(request.url);
	url.pathname = "/api/auth/callback/clickup";
	return auth.handler(new Request(url, { headers: request.headers }));
}
