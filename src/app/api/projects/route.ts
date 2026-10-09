import { NextResponse } from "next/server";
import { clickUpHeaders } from "@/lib/clickup";
import { PANEL_LIST_ID } from "@/lib/produksiPanel";
import { clickUpToken } from "@/lib/session";
import type { ClickUpTask } from "@/types/clickup";

const error = (status: number, message: string) =>
	NextResponse.json({ error: message }, { status });

export async function GET() {
	const token = await clickUpToken();
	if (!token) return error(401, "UNAUTHORIZED");

	const query = new URLSearchParams();
	query.append("statuses[]", "in progress");
	let response: Response;
	try {
		response = await fetch(
			`https://api.clickup.com/api/v2/list/${process.env.CLICKUP_PPIC_PANEL_LIST_ID || PANEL_LIST_ID}/task?${query}`,
			{ headers: clickUpHeaders(token), next: { revalidate: 60 } },
		);
	} catch {
		return error(502, "CLICKUP_ERROR");
	}
	if (!response.ok)
		return error(
			response.status === 429 ? 429 : 502,
			response.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR",
		);

	let tasks: ClickUpTask[];
	try {
		({ tasks = [] } = (await response.json()) as { tasks?: ClickUpTask[] });
	} catch {
		return error(502, "CLICKUP_ERROR");
	}

	return NextResponse.json({
		tasks: tasks.map(({ id, custom_id, name }) => ({ id, custom_id, name })),
	});
}
