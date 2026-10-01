import { NextRequest, NextResponse } from "next/server";
import { fieldsByName, optionId } from "@/lib/clickup";
import {
	CF,
	PRODUKSI_LIST_ID,
	QC,
	isProductionStage,
	isReworkStep,
	moveProduction,
	tahapById,
	type QcResult,
	type ScanAction,
} from "@/lib/produksi";
import type { ClickUpTask } from "@/types/clickup";

type Payload = {
	barcode?: string;
	operator_id?: string;
	device_id?: string;
	action?: ScanAction;
	qc_result?: QcResult | null;
	kendala?: string | null;
	detail_kendala?: string | null;
	rework_to?: string | null;
	scanned_at?: string;
};

const actions = new Set<ScanAction>(["advance", "qc", "release_komplain"]);
const error = (status: number, code: string) => NextResponse.json({ error: code, code }, { status });
const clickUpError = (response: Response) =>
	error(response.status === 429 ? 429 : 502, response.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");

export async function POST(request: NextRequest) {
	let body: Payload;
	try {
		body = (await request.json()) as Payload;
	} catch {
		return error(400, "MISSING_FIELD");
	}

	const barcode = body.barcode?.trim();
	const operatorId = body.operator_id?.trim();
	const deviceId = body.device_id?.trim();
	const action = body.action;
	const scannedAt = body.scanned_at ? new Date(body.scanned_at) : new Date();
	if (!barcode || !operatorId || !deviceId || !action || !actions.has(action) || Number.isNaN(scannedAt.valueOf()))
		return error(400, "MISSING_FIELD");
	if (action === "qc" && body.qc_result !== "Pass" && body.qc_result !== "Fail") return error(400, "MISSING_FIELD");

	const token = process.env.CLICKUP_TOKEN || process.env.CLICKUP_API_TOKEN;
	const listId = process.env.CLICKUP_PRODUKSI_LIST_ID || PRODUKSI_LIST_ID;
	if (!token) return error(500, "CLICKUP_NOT_CONFIGURED");

	const query = new URLSearchParams({
		include_closed: "true",
		custom_fields: JSON.stringify([{ field_id: CF.BARCODE, operator: "=", value: barcode }]),
	});
	const searchResponse = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task?${query}`, {
		headers: { Authorization: token },
		cache: "no-store",
	});
	if (!searchResponse.ok) return clickUpError(searchResponse);
	const { tasks = [] } = (await searchResponse.json()) as { tasks?: ClickUpTask[] };
	if (!tasks.length) return error(404, "BARCODE_NOT_FOUND");
	if (tasks.length > 1) return error(409, "DUPLICATE_BARCODE");

	const taskResponse = await fetch(`https://api.clickup.com/api/v2/task/${tasks[0].id}`, {
		headers: { Authorization: token },
		cache: "no-store",
	});
	if (!taskResponse.ok) return clickUpError(taskResponse);
	const task = (await taskResponse.json()) as ClickUpTask;
	const fields = await fieldsByName(token, listId, ["Tahap Produksi"]);
	const tahap = fields?.["Tahap Produksi"];
	if (!tahap || tahap.id !== CF.TAHAP_PRODUKSI) return error(500, "CLICKUP_FIELD_MISSING");
	const current = tahapById(optionId(tahap, task.custom_fields?.find((field) => field.id === CF.TAHAP_PRODUKSI)?.value))?.name;
	if (!current || !isProductionStage(current)) return error(409, "INVALID_TRANSITION");

	if (action === "qc" && body.qc_result === "Fail" && (!body.kendala?.trim() || !body.detail_kendala?.trim()))
		return error(400, "MISSING_FIELD");
	if (action === "release_komplain") {
		const spvIds = new Set((process.env.CLICKUP_SPV_OPERATOR_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean));
		if (!spvIds.has(operatorId)) return error(403, "ROLE_NOT_ALLOWED");
		if (!body.rework_to || !isReworkStep(body.rework_to)) return error(400, "MISSING_FIELD");
	}

	const movement = moveProduction(current, action, body.qc_result ?? undefined, body.rework_to && isReworkStep(body.rework_to) ? body.rework_to : undefined);
	if (!movement) return error(409, "INVALID_TRANSITION");

	const headers = { Authorization: token, "Content-Type": "application/json" };
	const writes: Promise<Response>[] = [
		fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${CF.TAHAP_PRODUKSI}`, { method: "POST", headers, body: JSON.stringify({ value: tahapById(movement.to)?.id }) }),
		fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${CF.LAST_SCAN}`, { method: "POST", headers, body: JSON.stringify({ value: scannedAt.valueOf() }) }),
		fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${CF.PROGRESS}`, { method: "POST", headers, body: JSON.stringify({ value: { current: movement.progress } }) }),
	];
	if (movement.qcResult) {
		const value = movement.qcResult === "Pass" ? QC.PASS : movement.qcResult === "Fail" ? QC.FAIL : QC.PENDING;
		writes.push(fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${CF.QC_RESULT}`, { method: "POST", headers, body: JSON.stringify({ value }) }));
	}
	if (body.qc_result === "Fail") {
		writes.push(
			fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${CF.KENDALA}`, { method: "POST", headers, body: JSON.stringify({ value: body.kendala!.trim() }) }),
			fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${CF.DETAIL_KENDALA}`, { method: "POST", headers, body: JSON.stringify({ value: body.detail_kendala!.trim() }) }),
		);
	}
	if (current === "Handover Produksi" && !task.custom_fields?.find((field) => field.id === CF.START_PRODUCTION)?.value)
		writes.push(fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${CF.START_PRODUCTION}`, { method: "POST", headers, body: JSON.stringify({ value: scannedAt.valueOf() }) }));
	if (movement.to === "Pengiriman") writes.push(fetch(`https://api.clickup.com/api/v2/task/${task.id}`, { method: "PUT", headers, body: JSON.stringify({ status: "complete" }) }));

	const timestamp = scannedAt.toLocaleString("sv-SE", { timeZone: "Asia/Jakarta", hour12: false });
	writes.push(fetch(`https://api.clickup.com/api/v2/task/${task.id}/comment`, { method: "POST", headers, body: JSON.stringify({ comment_text: `[SCAN] ${current} → ${movement.to} | operator: ${operatorId} | device: ${deviceId} | ${timestamp} WIB`, notify_all: false }) }));
	const responses = await Promise.all(writes);
	if (responses.some((response) => !response.ok)) return clickUpError(responses.find((response) => !response.ok)!);

	return NextResponse.json({ task_id: task.id, barcode, from: current, to: movement.to, progress: movement.progress, last_scan: scannedAt.toISOString() });
}
