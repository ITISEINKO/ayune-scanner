import { NextResponse } from "next/server";
import { clickUpHeaders } from "@/lib/clickup";
import { CF_PANEL, PANEL_LIST_ID } from "@/lib/produksiPanel";
import { clickUpToken } from "@/lib/session";
import type { ClickUpTask } from "@/types/clickup";

const error = (status: number, message: string) =>
	NextResponse.json({ error: message }, { status });

export async function GET(request: Request) {
	const serialNumber = new URL(request.url).searchParams
		.get("serial_number")
		?.trim();
	if (!serialNumber) return error(400, "NO_SERIAL_NUMBER");

	const token = await clickUpToken();
	const listId = process.env.CLICKUP_PPIC_PANEL_LIST_ID || PANEL_LIST_ID;
	if (!token) return error(401, "UNAUTHORIZED");

	const query = new URLSearchParams({
		subtasks: "true",
		custom_fields: JSON.stringify([
			{
				field_id: CF_PANEL.SERIAL_NUMBER,
				operator: "=",
				value: serialNumber,
			},
		]),
		include_closed: "true",
	});
	let response: Response;
	try {
		response = await fetch(
			`https://api.clickup.com/api/v2/list/${listId}/task?${query}`,
			{
				headers: clickUpHeaders(token),
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

	return NextResponse.json({
		url: tasks[0].url,
		name: tasks[0].name ?? serialNumber,
		count: tasks.length,
	});
}
