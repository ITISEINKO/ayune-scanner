import { NextRequest, NextResponse } from "next/server";
import { fieldsByName, hasTaskRelation, optionId } from "@/lib/clickup";
import { CF, KENDALA_LIST_ID, PRODUKSI_LIST_ID, nextTahap, tahapById } from "@/lib/produksi";
import type { ClickUpTask } from "@/types/clickup";

const error = (status: number, code: string) => NextResponse.json({ error: code, code }, { status });
const clickUpError = (response: Response) =>
	error(response.status === 429 ? 429 : 502, response.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");

export async function POST(request: NextRequest) {
	let data: FormData;
	try {
		data = await request.formData();
	} catch {
		return error(400, "MISSING_FIELD");
	}
	const rawTaskId = data.get("task_id");
	const attachment = data.get("attachment");
	if (typeof rawTaskId !== "string" || !rawTaskId.trim() || !(attachment instanceof File)) return error(400, "MISSING_FIELD");
	const taskId = rawTaskId.trim();
	if (!attachment.type.startsWith("image/") || attachment.size > 10 * 1024 * 1024) return error(400, "INVALID_ATTACHMENT");

	const token = process.env.CLICKUP_TOKEN || process.env.CLICKUP_API_TOKEN;
	const listId = process.env.CLICKUP_PRODUKSI_LIST_ID || PRODUKSI_LIST_ID;
	const kendalaListId = process.env.CLICKUP_KENDALA_LIST_ID || process.env.LIST_KENDALA_ID || KENDALA_LIST_ID;
	if (!token) return error(500, "CLICKUP_NOT_CONFIGURED");
	const headers = { Authorization: token };

	const [taskResponse, fields] = await Promise.all([
		fetch(`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}`, { headers, cache: "no-store" }),
		fieldsByName(token, listId, ["Tahap Produksi"]),
	]);
	if (!taskResponse.ok) return clickUpError(taskResponse);
	const tahap = fields?.["Tahap Produksi"];
	if (!tahap || tahap.id !== CF.TAHAP_PRODUKSI) return error(500, "CLICKUP_FIELD_MISSING");
	const task = (await taskResponse.json()) as ClickUpTask;
	if (task.list?.id !== listId) return error(404, "TASK_NOT_FOUND");
	const kendalaFields = await fieldsByName(token, kendalaListId, ["Produksi Task"]);
	const produksiTaskField = kendalaFields?.["Produksi Task"];
	if (!produksiTaskField) return error(500, "CLICKUP_FIELD_MISSING");
	const kendalaResponse = await fetch(`https://api.clickup.com/api/v2/list/${kendalaListId}/task?include_closed=true`, { headers, cache: "no-store" });
	if (!kendalaResponse.ok) return clickUpError(kendalaResponse);
	const { tasks: kendalaTasks = [] } = (await kendalaResponse.json()) as { tasks?: ClickUpTask[] };
	if (kendalaTasks.some((kendala) => hasTaskRelation(kendala.custom_fields?.find((field) => field.id === produksiTaskField.id)?.value, taskId) && kendala.status?.status !== "resolved"))
		return error(409, "OPEN_KENDALA");
	const current = tahapById(optionId(tahap, task.custom_fields?.find((field) => field.id === CF.TAHAP_PRODUKSI)?.value));
	const next = current && nextTahap(current.id);
	if (!current || !next) return error(409, "INVALID_TRANSITION");

	const upload = new FormData();
	upload.append("attachment", attachment, attachment.name);
	const uploadResponse = await fetch(`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}/attachment`, {
		method: "POST",
		headers,
		body: upload,
	});
	if (!uploadResponse.ok) return clickUpError(uploadResponse);

	const writeHeaders = { ...headers, "Content-Type": "application/json" };
	const [stepResponse, scanResponse] = await Promise.all([
		fetch(`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}/field/${CF.TAHAP_PRODUKSI}`, { method: "POST", headers: writeHeaders, body: JSON.stringify({ value: next.id }) }),
		fetch(`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}/field/${CF.LAST_SCAN}`, { method: "POST", headers: writeHeaders, body: JSON.stringify({ value: Date.now() }) }),
	]);
	if (!stepResponse.ok) return clickUpError(stepResponse);
	if (!scanResponse.ok) return clickUpError(scanResponse);

	await fetch(`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}/comment`, {
		method: "POST",
		headers: writeHeaders,
		body: JSON.stringify({ comment_text: `✅ ${current.name} → ${next.name}\nFoto: ${attachment.name}`, notify_all: false }),
	});
	return NextResponse.json({ from: current.name, to: next.name, last_scan: new Date().toISOString() });
}
