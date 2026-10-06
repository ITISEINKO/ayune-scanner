import { NextResponse } from "next/server";
import { clickUpHeaders, fieldsByName, optionName } from "@/lib/clickup";
import {
	CF_PANEL,
	PANEL_LIST_ID,
	statusBarangScanOptions,
} from "@/lib/produksiPanel";
import { clickUpToken, requireSuperAdmin } from "@/lib/session";
import type { ClickUpTask } from "@/types/clickup";

const error = (status: number, code: string) =>
	NextResponse.json({ ok: false, error: code }, { status });
const listId = () => process.env.CLICKUP_PPIC_PANEL_LIST_ID || PANEL_LIST_ID;
const statusFieldId = () =>
	process.env.CLICKUP_FIELD_STATUS_BARANG_SCAN || CF_PANEL.STATUS_BARANG_SCAN;

export async function GET(request: Request) {
	await requireSuperAdmin();
	const batchNumber = new URL(request.url).searchParams.get("batch_number")?.trim();
	if (!batchNumber) return error(400, "MISSING_BATCH_NUMBER");
	const token = await clickUpToken();
	if (!token) return error(401, "UNAUTHORIZED");
	const headers = clickUpHeaders(token);
	const query = new URLSearchParams({
		include_closed: "true",
		custom_fields: JSON.stringify([
			{ field_id: CF_PANEL.BATCH_NUMBER, operator: "=", value: batchNumber },
		]),
	});
	const [searchResponse, fields] = await Promise.all([
		fetch(`https://api.clickup.com/api/v2/list/${listId()}/task?${query}`, {
			headers,
			cache: "no-store",
		}),
		fieldsByName(token, listId(), ["STATUS BARANG SCAN"]),
	]);
	if (!searchResponse.ok)
		return error(searchResponse.status === 429 ? 429 : 502, "CLICKUP_ERROR");
	const statusField = fields?.["STATUS BARANG SCAN"];
	if (!statusField || statusField.id !== statusFieldId())
		return error(500, "CLICKUP_FIELD_MISSING");
	const { tasks = [] } = (await searchResponse.json()) as {
		tasks?: ClickUpTask[];
	};
	if (!tasks.length) return error(404, "BATCH_NUMBER_NOT_FOUND");
	if (tasks.length > 1) return error(409, "DUPLICATE_BATCH_NUMBER");
	const task = tasks[0];
	return NextResponse.json({
		ok: true,
		data: {
			task_id: task.id,
			nama: task.name ?? batchNumber,
			batch_number: batchNumber,
			status: optionName(
				statusField,
				task.custom_fields?.find((field) => field.id === statusFieldId())?.value,
			) ?? "BELUM DIATUR",
		},
	});
}

export async function POST(request: Request) {
	await requireSuperAdmin();
	let body: { task_id?: unknown; status?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return error(400, "MISSING_FIELD");
	}
	const taskId = typeof body.task_id === "string" ? body.task_id.trim() : "";
	const target =
		typeof body.status === "string"
			? statusBarangScanOptions.find((option) => option.key === body.status)
			: undefined;
	if (!taskId || !target) return error(400, "INVALID_STATUS");
	const token = await clickUpToken();
	if (!token) return error(401, "UNAUTHORIZED");
	const headers = clickUpHeaders(token);
	const [taskResponse, fields] = await Promise.all([
		fetch(`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}`, {
			headers,
			cache: "no-store",
		}),
		fieldsByName(token, listId(), ["STATUS BARANG SCAN"]),
	]);
	if (!taskResponse.ok)
		return error(taskResponse.status === 429 ? 429 : 502, "CLICKUP_ERROR");
	const task = (await taskResponse.json()) as ClickUpTask;
	if (task.list?.id !== listId()) return error(404, "TASK_NOT_FOUND");
	const statusField = fields?.["STATUS BARANG SCAN"];
	if (!statusField || statusField.id !== statusFieldId())
		return error(500, "CLICKUP_FIELD_MISSING");
	const updateResponse = await fetch(
		`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}/field/${statusFieldId()}`,
		{
			method: "POST",
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify({ value: target.id }),
		},
	);
	if (!updateResponse.ok)
		return error(
			updateResponse.status === 429 ? 429 : 502,
			updateResponse.status === 429 ? "RATE_LIMITED" : "CLICKUP_STATUS_UPDATE_FAILED",
		);
	return NextResponse.json({ ok: true, status: target.label });
}
