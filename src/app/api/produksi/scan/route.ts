import { NextRequest, NextResponse } from "next/server";
import { clickUpHeaders, fieldsByName, optionId } from "@/lib/clickup";
import { clickUpToken } from "@/lib/session";
import {
	CF,
	PRODUKSI_LIST_ID,
	TAHAP_TO_STATUS,
	isProductionStage,
	isReworkStep,
	moveProduction,
	tahapById,
	tahapByName,
	type ScanAction,
} from "@/lib/produksi";
import type { ClickUpTask } from "@/types/clickup";

type Payload = {
	barcode?: string;
	operator_id?: string;
	device_id?: string;
	action?: ScanAction;
	kendala?: string | null;
	detail_kendala?: string | null;
	rework_to?: string | null;
	scanned_at?: string;
};

const actions = new Set<ScanAction>(["advance", "release_komplain"]);
const error = (status: number, code: string) =>
	NextResponse.json({ ok: false, error: code }, { status });
const clickUpError = (response: Response) =>
	error(
		response.status === 429 ? 429 : 502,
		response.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR",
	);

export async function POST(request: NextRequest) {
	let body: Payload;
	try {
		body = (await request.json()) as Payload;
	} catch {
		return error(400, "MISSING_FIELD");
	}

	const barcode = body.barcode?.trim();
	const operatorId = body.operator_id?.trim();
	const action = body.action;
	const scannedAt = body.scanned_at ? new Date(body.scanned_at) : new Date();
	if (
		!barcode ||
		!action ||
		!actions.has(action) ||
		Number.isNaN(scannedAt.valueOf())
	)
		return error(400, "MISSING_FIELD");
	const token = await clickUpToken();
	const listId = process.env.CLICKUP_PRODUKSI_LIST_ID || PRODUKSI_LIST_ID;
	if (!token) return error(401, "UNAUTHORIZED");

	const query = new URLSearchParams({
		include_closed: "true",
		custom_fields: JSON.stringify([
			{ field_id: CF.BARCODE, operator: "=", value: barcode },
		]),
	});
	const searchResponse = await fetch(
		`https://api.clickup.com/api/v2/list/${listId}/task?${query}`,
		{
			headers: clickUpHeaders(token),
			cache: "no-store",
		},
	);
	if (!searchResponse.ok) return clickUpError(searchResponse);
	const { tasks = [] } = (await searchResponse.json()) as {
		tasks?: ClickUpTask[];
	};
	if (!tasks.length) return error(404, "BARCODE_NOT_FOUND");
	if (tasks.length > 1) return error(409, "DUPLICATE_BARCODE");

	const taskResponse = await fetch(
		`https://api.clickup.com/api/v2/task/${tasks[0].id}`,
		{
			headers: clickUpHeaders(token),
			cache: "no-store",
		},
	);
	if (!taskResponse.ok) return clickUpError(taskResponse);
	const task = (await taskResponse.json()) as ClickUpTask;
	const fields = await fieldsByName(token, listId, ["Tahap Produksi"]);
	const tahap = fields?.["Tahap Produksi"];
	if (!tahap || tahap.id !== CF.TAHAP_PRODUKSI)
		return error(500, "CLICKUP_FIELD_MISSING");
	const currentValue = task.custom_fields?.find(
		(field) => field.id === CF.TAHAP_PRODUKSI,
	)?.value;
	const current = tahapById(
		optionId(
			tahap,
			currentValue,
		),
	)?.name;
	if (
		(!current && currentValue !== undefined && currentValue !== null && currentValue !== "") ||
		(current && !isProductionStage(current))
	)
		return error(409, "INVALID_TRANSITION");
	if (action === "release_komplain") {
		const spvIds = new Set(
			(process.env.CLICKUP_SPV_OPERATOR_IDS ?? "")
				.split(",")
				.map((id) => id.trim())
				.filter(Boolean),
		);
		if (!operatorId || !spvIds.has(operatorId))
			return error(403, "ROLE_NOT_ALLOWED");
		if (!body.rework_to || !isReworkStep(body.rework_to))
			return error(400, "MISSING_FIELD");
	}

	const movement = moveProduction(
		current,
		action,
		body.rework_to && isReworkStep(body.rework_to) ? body.rework_to : undefined,
	);
	if (!movement) return error(409, "INVALID_TRANSITION");
	const next = tahapByName(movement.to);
	if (!next) return error(409, "INVALID_TRANSITION");

	const headers = {
		...clickUpHeaders(token),
		"Content-Type": "application/json",
	};
	const stepResponse = await fetch(
		`https://api.clickup.com/api/v2/task/${task.id}/field/${CF.TAHAP_PRODUKSI}`,
		{
			method: "POST",
			headers,
			body: JSON.stringify({ value: next.id }),
		},
	);
	if (!stepResponse.ok) {
		console.error("ClickUp Tahap Produksi update failed", {
			status: stepResponse.status,
			body: await stepResponse.text(),
		});
		return error(
			stepResponse.status === 429 ? 429 : 502,
			stepResponse.status === 429
				? "RATE_LIMITED"
				: "CLICKUP_STAGE_UPDATE_FAILED",
		);
	}

	const writes: Promise<Response>[] = [
		fetch(
			`https://api.clickup.com/api/v2/task/${task.id}/field/${CF.LAST_SCAN}`,
			{
				method: "POST",
				headers,
				body: JSON.stringify({
					value: scannedAt.valueOf(),
					value_options: { time: true },
				}),
			},
		),
		fetch(
			`https://api.clickup.com/api/v2/task/${task.id}/field/${CF.PROGRESS}`,
			{
				method: "POST",
				headers,
				body: JSON.stringify({ value: { current: movement.progress } }),
			},
		),
		fetch(`https://api.clickup.com/api/v2/task/${task.id}`, {
			method: "PUT",
			headers,
			body: JSON.stringify({ status: TAHAP_TO_STATUS[movement.to] }),
		}),
	];
	if (
		current === "Handover Produksi" &&
		!task.custom_fields?.find((field) => field.id === CF.START_PRODUCTION)
			?.value
	)
		writes.push(
			fetch(
				`https://api.clickup.com/api/v2/task/${task.id}/field/${CF.START_PRODUCTION}`,
				{
					method: "POST",
					headers,
					body: JSON.stringify({ value: scannedAt.valueOf() }),
				},
			),
		);

	const timestamp = scannedAt.toLocaleString("sv-SE", {
		timeZone: "Asia/Jakarta",
		hour12: false,
	});
	writes.push(
		fetch(`https://api.clickup.com/api/v2/task/${task.id}/comment`, {
			method: "POST",
			headers,
			body: JSON.stringify({
				comment_text: `[SCAN] ${current} → ${movement.to} | ${timestamp} WIB`,
				notify_all: false,
			}),
		}),
	);
	const responses = await Promise.all(writes);
	if (responses.some((response) => !response.ok))
		return clickUpError(responses.find((response) => !response.ok)!);

	return NextResponse.json({
		task_id: task.id,
		nama: task.name ?? barcode,
		barcode,
		from: current,
		to: movement.to,
		progress: movement.progress,
		last_scan: scannedAt.toISOString(),
	});
}
