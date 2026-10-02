import { NextResponse } from "next/server";
import { CF } from "@/lib/produksi";
import type { ClickUpTask } from "@/types/clickup";

const error = (status: number, message: string) =>
	NextResponse.json({ error: message }, { status });

export async function GET(request: Request) {
	const code = new URL(request.url).searchParams.get("code")?.trim();
	if (!code) return error(400, "NO_CODE");

	const token = process.env.CLICKUP_TOKEN || process.env.CLICKUP_API_TOKEN;
	const listId = process.env.CLICKUP_PRODUKSI_LIST_ID;
	if (!token || !listId) return error(500, "CLICKUP_NOT_CONFIGURED");

	const query = new URLSearchParams({
		custom_fields: JSON.stringify([
			{ field_id: CF.BARCODE, operator: "=", value: code },
		]),
		include_closed: "true",
	});
	let response: Response;
	try {
		response = await fetch(
			`https://api.clickup.com/api/v2/list/${listId}/task?${query}`,
			{
				headers: { Authorization: token },
				cache: "no-store",
			},
		);
	} catch {
		return error(502, "CLICKUP_ERROR");
	}
	if (!response.ok)
		return error(
			response.status === 429 ? 429 : 502,
			response.status === 429
				? "RATE_LIMITED"
				: `CLICKUP_ERROR_${response.status}`,
		);

	let tasks: ClickUpTask[];
	try {
		({ tasks = [] } = (await response.json()) as { tasks?: ClickUpTask[] });
	} catch {
		return error(502, "CLICKUP_ERROR");
	}
	if (!tasks.length) return error(404, "NOT_FOUND");
	if (!tasks[0].url) return error(502, "CLICKUP_ERROR");

	return NextResponse.json({ url: tasks[0].url, count: tasks.length });
}
