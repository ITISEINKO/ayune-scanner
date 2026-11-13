import { NextResponse } from "next/server";
import { clickUpHeaders, fieldsByName, optionName } from "@/lib/clickup";
import {
	CF_PANEL,
	PANEL_LIST_ID,
	statusBarangScanOptions,
} from "@/lib/produksiPanel";
import {
	clickUpToken,
	requireFreshSuperAdmin,
	requireSuperAdmin,
} from "@/lib/session";
import { updatePpicComponentStatus } from "@/lib/db";
import { getPanelLocation } from "@/lib/panelLocationSnapshot";
import { serialNumberOf } from "@/lib/projectSerialCache";
import type { ClickUpTask } from "@/types/clickup";
import type { ManualPanelChoice, ManualPanelItem } from "@/types/panelLocation";

const error = (status: number, code: string) =>
	NextResponse.json({ ok: false, error: code }, { status });
const listId = () => process.env.CLICKUP_PPIC_PANEL_LIST_ID || PANEL_LIST_ID;
const statusFieldId = () =>
	process.env.CLICKUP_FIELD_STATUS_BARANG_SCAN || CF_PANEL.STATUS_BARANG_SCAN;

export async function GET(request: Request) {
	await requireSuperAdmin();
	const serialNumber = new URL(request.url).searchParams.get("serial_number")?.trim();
	const selectedTaskId = new URL(request.url).searchParams.get("task_id")?.trim();
	if (!serialNumber) return error(400, "MISSING_SERIAL_NUMBER");
	if (serialNumber.length > 100) return error(400, "INVALID_SERIAL_NUMBER");
	if (selectedTaskId !== undefined && (!selectedTaskId || selectedTaskId.length > 100)) return error(400, "INVALID_TASK_ID");
	const token = await clickUpToken();
	if (!token) return error(401, "UNAUTHORIZED");
	const headers = clickUpHeaders(token);
	const query = new URLSearchParams({
		include_closed: "true",
		subtasks: "true",
		custom_fields: JSON.stringify([
			{ field_id: CF_PANEL.SERIAL_NUMBER, operator: "=", value: serialNumber },
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
	const result = (await searchResponse.json()) as {
		tasks?: ClickUpTask[];
		last_page?: boolean;
	};
	const tasks = result.tasks ?? [];
	let pageResult = result;
	for (let page = 1; pageResult.last_page !== true && (pageResult.tasks?.length ?? 0) >= 100; page++) {
		// shortcut: limit duplicate lookup to 1,000 tasks; add cursor-based selection if that ceiling is reached.
		if (page >= 10) return error(502, "CLICKUP_TOO_MANY_MATCHES");
		query.set("page", String(page));
		const response = await fetch(`https://api.clickup.com/api/v2/list/${listId()}/task?${query}`, { headers, cache: "no-store" });
		if (!response.ok) return error(response.status === 429 ? 429 : 502, "CLICKUP_ERROR");
		pageResult = await response.json() as typeof result;
		tasks.push(...(pageResult.tasks ?? []));
	}
	if (tasks.some((item) => typeof item.id !== "string" || !item.id.trim() || item.id.length > 100) || new Set(tasks.map((item) => item.id)).size !== tasks.length) return error(502, "CLICKUP_ERROR");
	if (tasks.some((item) => serialNumberOf(item)?.trim() !== serialNumber)) return error(502, "INVALID_SERIAL_DATA");
	if (tasks.length && (!statusField || statusField.id !== statusFieldId())) return error(500, "CLICKUP_FIELD_MISSING");
	let choices: ManualPanelChoice[] = [];
	if (tasks.length > 1) {
		const parents = new Map<string, Promise<ClickUpTask | null>>();
		const readParent = (id: string) => {
			if (!parents.has(id)) parents.set(id, Promise.resolve().then(() => fetch(`https://api.clickup.com/api/v2/task/${encodeURIComponent(id)}`, { headers, cache: "no-store", signal: AbortSignal.timeout(5000) })).then(async (response) => response.ok ? await response.json() as ClickUpTask : null).catch(() => null));
			return parents.get(id)!;
		};
		choices = await Promise.all(tasks.map(async (candidate) => {
			let id = candidate.top_level_parent || candidate.parent || null;
			let project: ClickUpTask | null = "parent" in candidate && candidate.parent === null && candidate.list?.id === listId() ? candidate : null;
			const seen = new Set([candidate.id]);
			// shortcut: stop after 12 ancestors; raise the limit if ClickUp adds deeper project hierarchies.
			while (id && seen.size <= 12 && !seen.has(id)) {
				seen.add(id);
				const parent = await readParent(id);
				if (!parent || parent.id !== id || parent.list?.id !== listId() || !("parent" in parent)) break;
				if (!parent.parent) { project = parent; break; }
				id = parent.parent;
			}
			return { task_id: candidate.id, nama: candidate.name ?? "Panel", status: optionName(statusField!, candidate.custom_fields?.find((field) => field.id === statusFieldId())?.value) ?? "BELUM DIATUR", project_name: project?.name ?? null, project_id: project?.id ?? null };
		}));
		if (!selectedTaskId) return NextResponse.json({ ok: false, error: "DUPLICATE_SERIAL_NUMBER", choices }, { status: 409 });
	}
	const task = selectedTaskId ? tasks.find((item) => item.id === selectedTaskId) : tasks[0];
	if (selectedTaskId && !task) return error(409, "TASK_SELECTION_CHANGED");
	let location: ManualPanelItem["location"] = null;
	let locationError: string | undefined;
	try {
		location = await getPanelLocation("", serialNumber);
	} catch (cause) {
		// Location failures must not prevent the existing manual status correction.
		locationError = cause instanceof Error && cause.message === "LOCATION_AMBIGUOUS" ? "LOCATION_AMBIGUOUS" : "LOCATION_UNAVAILABLE";
	}
	if (!task && !location) return error(locationError === "LOCATION_AMBIGUOUS" ? 409 : locationError ? 502 : 404, locationError ?? "SERIAL_NUMBER_NOT_FOUND");
	const panel = location?.panels.find((panel) => panel.barcode === serialNumber);
	return NextResponse.json({
		ok: true,
		data: {
			task_id: task?.id ?? null,
			nama: task?.name ?? (panel?.panelNumber ? `Panel ${panel.panelNumber}` : serialNumber),
			serial_number: serialNumber,
			status: task && statusField ? optionName(
				statusField,
				task.custom_fields?.find((field) => field.id === statusFieldId())?.value,
			) ?? "BELUM DIATUR" : null,
			location,
			...(choices.length ? { project_name: choices.find((item) => item.task_id === task?.id)?.project_name, project_id: choices.find((item) => item.task_id === task?.id)?.project_id } : {}),
			...(locationError ? { location_error: locationError } : {}),
		} satisfies ManualPanelItem,
	});
}

export async function POST(request: Request) {
	await requireFreshSuperAdmin();
	let body: { task_id?: unknown; status?: unknown; serial_number?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return error(400, "MISSING_FIELD");
	}
	const taskId = typeof body.task_id === "string" ? body.task_id.trim() : "";
	const serialNumber = typeof body.serial_number === "string" ? body.serial_number.trim() : "";
	const target =
		typeof body.status === "string"
			? statusBarangScanOptions.find((option) => option.key === body.status)
			: undefined;
	if (!taskId || !target || !serialNumber || serialNumber.length > 100) return error(400, "INVALID_STATUS");
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
	if (task.id !== taskId || task.list?.id !== listId()) return error(404, "TASK_NOT_FOUND");
	if (serialNumberOf(task)?.trim() !== serialNumber) return error(409, "SERIAL_MISMATCH");
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
	await updatePpicComponentStatus(taskId, target.key);
	return NextResponse.json({ ok: true, status: target.label });
}
