import { NextResponse } from "next/server";
import { clickUpHeaders } from "@/lib/clickup";
import { CF_PANEL, PANEL_LIST_ID, STATUS_BARANG_SCAN } from "@/lib/produksiPanel";
import { clickUpToken, requirePpicStatusAccess } from "@/lib/session";
import type { ClickUpTask } from "@/types/clickup";

const error = (status: number, code: string) =>
	NextResponse.json({ ok: false, error: code }, { status });

export async function POST(request: Request) {
	await requirePpicStatusAccess("BARANG_DITERIMA");

	let body: { batch_number?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return error(400, "MISSING_BATCH_NUMBER");
	}
	const batchNumber =
		typeof body.batch_number === "string" ? body.batch_number.trim() : "";
	if (!batchNumber) return error(400, "MISSING_BATCH_NUMBER");

	const token = await clickUpToken();
	if (!token) return error(401, "UNAUTHORIZED");
	const listId = process.env.CLICKUP_PPIC_PANEL_LIST_ID || PANEL_LIST_ID;
	const statusFieldId =
		process.env.CLICKUP_FIELD_STATUS_BARANG_SCAN || CF_PANEL.STATUS_BARANG_SCAN;
	const headers = clickUpHeaders(token);
	const query = new URLSearchParams({
		include_closed: "true",
		custom_fields: JSON.stringify([
			{ field_id: CF_PANEL.BATCH_NUMBER, operator: "=", value: batchNumber },
		]),
	});

	let searchResponse: Response;
	try {
		searchResponse = await fetch(
			`https://api.clickup.com/api/v2/list/${listId}/task?${query}`,
			{ headers, cache: "no-store" },
		);
	} catch {
		return error(502, "CLICKUP_ERROR");
	}
	if (!searchResponse.ok)
		return error(searchResponse.status === 429 ? 429 : 502, "CLICKUP_ERROR");
	const { tasks = [] } = (await searchResponse.json()) as {
		tasks?: ClickUpTask[];
	};
	if (!tasks.length) return error(404, "BATCH_NUMBER_NOT_FOUND");
	if (tasks.length > 1) return error(409, "DUPLICATE_BATCH_NUMBER");

	let updateResponse: Response;
	try {
		updateResponse = await fetch(
			`https://api.clickup.com/api/v2/task/${encodeURIComponent(tasks[0].id)}/field/${statusFieldId}`,
			{
				method: "POST",
				headers: { ...headers, "Content-Type": "application/json" },
				body: JSON.stringify({ value: STATUS_BARANG_SCAN.BARANG_DITERIMA }),
			},
		);
	} catch {
		return error(502, "CLICKUP_STATUS_UPDATE_FAILED");
	}
	if (!updateResponse.ok) {
		console.error("ClickUp Status Barang Scan update failed", {
			status: updateResponse.status,
			body: await updateResponse.text(),
		});
		return error(
			updateResponse.status === 429 ? 429 : 502,
			updateResponse.status === 429 ? "RATE_LIMITED" : "CLICKUP_STATUS_UPDATE_FAILED",
		);
	}

	return NextResponse.json({
		task_id: tasks[0].id,
		nama: tasks[0].name ?? batchNumber,
		batch_number: batchNumber,
		status: "BARANG DITERIMA",
	});
}
