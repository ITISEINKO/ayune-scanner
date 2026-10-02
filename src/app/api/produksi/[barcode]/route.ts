import { NextRequest, NextResponse } from "next/server";
import { fieldsByName, optionId } from "@/lib/clickup";
import { CF, PRODUKSI_LIST_ID, tahapById } from "@/lib/produksi";
import type { ClickUpTask } from "@/types/clickup";

const error = (status: number, code: string, message = code) =>
	NextResponse.json({ ok: false, error: code, message }, { status });

export async function GET(
	_request: NextRequest,
	{ params }: RouteContext<"/api/produksi/[barcode]">,
) {
	const { barcode: rawBarcode } = await params;
	const barcode = rawBarcode.trim().toUpperCase();
	const token = process.env.CLICKUP_TOKEN || process.env.CLICKUP_API_TOKEN;
	const listId = process.env.CLICKUP_PRODUKSI_LIST_ID || PRODUKSI_LIST_ID;
	if (!barcode) return error(400, "MISSING_FIELD");
	if (!token) return error(500, "CLICKUP_NOT_CONFIGURED");

	const fields = await fieldsByName(token, listId, ["Tahap Produksi"]);
	const tahapField = fields?.["Tahap Produksi"];
	if (!tahapField)
		return error(
			502,
			"CLICKUP_FIELD_REQUEST_FAILED",
			"Field Tahap Produksi tidak dapat diambil dari ClickUp.",
		);
	const query = new URLSearchParams({
		include_closed: "true",
		custom_fields: JSON.stringify([
			{ field_id: CF.BARCODE, operator: "==", value: barcode },
		]),
	});
	const headers = { Authorization: token };
	const searchResponse = await fetch(
		`https://api.clickup.com/api/v2/list/${listId}/task?${query}`,
		{ headers, cache: "no-store" },
	);
	if (!searchResponse.ok)
		return error(
			searchResponse.status === 429 ? 429 : 502,
			searchResponse.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR",
		);
	const { tasks = [] } = (await searchResponse.json()) as {
		tasks?: ClickUpTask[];
	};
	if (!tasks.length) return error(404, "BARCODE_NOT_FOUND");
	if (tasks.length > 1) return error(409, "DUPLICATE_BARCODE");

	const taskResponse = await fetch(
		`https://api.clickup.com/api/v2/task/${tasks[0].id}`,
		{ headers, cache: "no-store" },
	);
	if (!taskResponse.ok)
		return error(
			taskResponse.status === 429 ? 429 : 502,
			taskResponse.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR",
		);
	const task = (await taskResponse.json()) as ClickUpTask;
	const tahapValue = task.custom_fields?.find(
		(field) => field.id === CF.TAHAP_PRODUKSI,
	)?.value;
	if (tahapValue === undefined || tahapValue === null || tahapValue === "")
		return error(
			409,
			"TAHAP_PRODUKSI_NOT_SET",
			"Tahap Produksi belum diisi. Pilih tahap produksi di ClickUp terlebih dahulu.",
		);
	const current = tahapById(optionId(tahapField, tahapValue));
	if (!current) return error(409, "INVALID_TRANSITION");
	return NextResponse.json({
		ok: true,
		data: {
			taskId: task.id,
			nama: task.name ?? null,
			barcode,
			tahapSekarang: current.name,
		},
	});
}
