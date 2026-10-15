import { NextResponse } from "next/server";
import { clickUpHeaders } from "@/lib/clickup";
import { panelListId } from "@/lib/projects";
import { clickUpToken, requireSuperAdmin } from "@/lib/session";

const error = (status: number, code: string) =>
	NextResponse.json({ ok: false, error: code }, { status });

export async function POST(request: Request) {
	await requireSuperAdmin();
	const token = await clickUpToken();
	const teamId = process.env.CLICKUP_TEAM_ID?.trim();
	if (!token || !teamId) return error(401, "UNAUTHORIZED");

	let body: { endpoint?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return error(400, "INVALID_JSON");
	}
	const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
	if (!endpoint || !/^https:\/\//i.test(endpoint))
		return error(400, "INVALID_ENDPOINT");

	try {
		const response = await fetch(
			`https://api.clickup.com/api/v2/team/${encodeURIComponent(teamId)}/webhook`,
			{
				method: "POST",
				headers: {
					...clickUpHeaders(token),
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					endpoint,
					events: ["taskUpdated"],
					list_id: panelListId(),
				}),
				cache: "no-store",
			},
		);
		const data = await response.json().catch(() => null);
		if (!response.ok)
			return NextResponse.json(
				{ ok: false, error: "CLICKUP_ERROR", details: data },
				{ status: response.status === 401 ? 401 : 502 },
			);
		return NextResponse.json({ ok: true, webhook: data });
	} catch {
		return error(502, "CLICKUP_UNREACHABLE");
	}
}
