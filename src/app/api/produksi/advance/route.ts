import { NextRequest, NextResponse } from "next/server";
import { fieldsByName, optionId } from "@/lib/clickup";
import { CF, PRODUKSI_LIST_ID, TAHAP_TO_STATUS, tahapById, tahapByName } from "@/lib/produksi";
import type { ClickUpTask } from "@/types/clickup";

const error = (status: number, code: string) => NextResponse.json({ ok: false, error: code }, { status });
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
	const rawTahap = data.get("tahap");
	const attachment = data.get("attachment");
	if (typeof rawTaskId !== "string" || !rawTaskId.trim()) return error(400, "MISSING_FIELD");
	if (typeof rawTahap !== "string" || !rawTahap.trim()) return error(400, "MISSING_FIELD");
	const taskId = rawTaskId.trim();
	const target = tahapByName(rawTahap.trim());
	if (!target) return error(400, "INVALID_TRANSITION");
	if (attachment instanceof File && (!attachment.type.startsWith("image/") || attachment.size > 10 * 1024 * 1024)) return error(400, "INVALID_ATTACHMENT");

	const token = process.env.CLICKUP_TOKEN || process.env.CLICKUP_API_TOKEN;
	const listId = process.env.CLICKUP_PRODUKSI_LIST_ID || PRODUKSI_LIST_ID;
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
	const current = tahapById(optionId(tahap, task.custom_fields?.find((field) => field.id === CF.TAHAP_PRODUKSI)?.value));
	if (!current || current.id === target.id) return error(409, "INVALID_TRANSITION");
	if (attachment instanceof File) {
		const upload = new FormData();
		upload.append("attachment", attachment, attachment.name);
		const uploadResponse = await fetch(`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}/attachment`, {
			method: "POST",
			headers,
			body: upload,
		});
		if (!uploadResponse.ok) return clickUpError(uploadResponse);
	}

	const writeHeaders = { ...headers, "Content-Type": "application/json" };
	const stepResponse = await fetch(`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}/field/${CF.TAHAP_PRODUKSI}`, { method: "POST", headers: writeHeaders, body: JSON.stringify({ value: target.id }) });
	if (!stepResponse.ok) {
		console.error("ClickUp Tahap Produksi update failed", { status: stepResponse.status, body: await stepResponse.text() });
		return error(stepResponse.status === 429 ? 429 : 502, stepResponse.status === 429 ? "RATE_LIMITED" : "CLICKUP_STAGE_UPDATE_FAILED");
	}
	const [scanResponse, statusResponse] = await Promise.all([
		fetch(`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}/field/${CF.LAST_SCAN}`, { method: "POST", headers: writeHeaders, body: JSON.stringify({ value: Date.now(), value_options: { time: true } }) }),
		fetch(`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}`, { method: "PUT", headers: writeHeaders, body: JSON.stringify({ status: TAHAP_TO_STATUS[target.name] }) }),
	]);
	if (!scanResponse.ok) return clickUpError(scanResponse);
	if (!statusResponse.ok) return clickUpError(statusResponse);
	await fetch(`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}/comment`, {
		method: "POST",
		headers: writeHeaders,
		body: JSON.stringify({ comment_text: `[STATUS] ${current.name} → ${target.name}`, notify_all: false }),
	});
	return NextResponse.json({ from: current.name, to: target.name, last_scan: new Date().toISOString() });
}
