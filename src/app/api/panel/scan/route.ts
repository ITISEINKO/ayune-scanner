import { NextResponse } from "next/server";
import { clickUpHeaders } from "@/lib/clickup";
import { savePpicScanHistory } from "@/lib/db";
import {
	projectSerialCache,
	rememberSerial,
	scanStatusOf,
	serialNumberOf,
	updateCachedSerialStatus,
} from "@/lib/projectSerialCache";
import { CF_PANEL, PANEL_LIST_ID, STATUS_BARANG_SCAN } from "@/lib/produksiPanel";
import { taskProjectScope } from "@/lib/projectScope";
import {
	clickUpToken,
	ppicSession,
	requireFreshPpicStatusAccess,
	selectedProjectTaskId,
} from "@/lib/session";
import type { ClickUpTask } from "@/types/clickup";

const error = (status: number, code: string) =>
	NextResponse.json({ ok: false, error: code }, { status });

const targetFor = (status: string) =>
	status === "BARANG_DITERIMA"
		? {
				label: "BARANG DITERIMA",
				status: "BARANG_DITERIMA" as const,
				value: STATUS_BARANG_SCAN.BARANG_DITERIMA,
			}
		: status === "SEDANG_DIPACKING"
			? {
					label: "SEDANG DIPACKING",
					status: "SEDANG_DIPACKING" as const,
					value: STATUS_BARANG_SCAN.SEDANG_DIPACKING,
				}
			: status === "TERPASANG_DIGUNAKAN"
				? {
						label: "TERPASANG / DIGUNAKAN",
						status: "TERPASANG_DIGUNAKAN" as const,
						value: STATUS_BARANG_SCAN.TERPASANG_DIGUNAKAN,
					}
				: null;

const findSerial = async (token: string, serialNumber: string) => {
	const query = new URLSearchParams({
		include_closed: "true",
		subtasks: "true",
		custom_fields: JSON.stringify([
			{ field_id: CF_PANEL.SERIAL_NUMBER, operator: "=", value: serialNumber },
		]),
	});
	const response = await fetch(
		`https://api.clickup.com/api/v2/list/${process.env.CLICKUP_PPIC_PANEL_LIST_ID || PANEL_LIST_ID}/task?${query}`,
		{ headers: clickUpHeaders(token), cache: "no-store" },
	);
	if (!response.ok) throw new Error(response.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");
	const { tasks = [] } = (await response.json()) as { tasks?: ClickUpTask[] };
	return tasks;
};

const updateStatus = async (token: string, taskId: string, statusId: string) => {
	const statusFieldId =
		process.env.CLICKUP_FIELD_STATUS_BARANG_SCAN || CF_PANEL.STATUS_BARANG_SCAN;
	const response = await fetch(
		`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}/field/${statusFieldId}`,
		{
			method: "POST",
			headers: { ...clickUpHeaders(token), "Content-Type": "application/json" },
			body: JSON.stringify({ value: statusId }),
		},
	);
	if (!response.ok) throw new Error(response.status === 429 ? "RATE_LIMITED" : "CLICKUP_STATUS_UPDATE_FAILED");
};

export async function POST(request: Request) {
	let body: { serial_number?: unknown; status?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return error(400, "MISSING_SERIAL_NUMBER");
	}
	const serialNumber =
		typeof body.serial_number === "string" ? body.serial_number.trim() : "";
	const status = typeof body.status === "string" ? body.status : "";
	const target = targetFor(status);
	if (!serialNumber) return error(400, "MISSING_SERIAL_NUMBER");
	if (!target) return error(400, "INVALID_STATUS");
	const userId = await requireFreshPpicStatusAccess(status);
	const session = await ppicSession();
	if (session?.role === "SUPER_ADMIN") return error(401, "UNAUTHORIZED");
	const mainTaskId = await selectedProjectTaskId(userId);
	if (!mainTaskId) return error(409, "NO_SELECTED_PROJECT");
	const token = await clickUpToken();
	if (!token) return error(401, "UNAUTHORIZED");

	let taskId: string;
	let name: string | null;
	try {
		const cache = await projectSerialCache(mainTaskId);
		const cached = cache?.entries[serialNumber];
		if (cached) {
			if (cached.status_id === target.value)
				return NextResponse.json({
					ok: true,
					skipped: true,
					task_id: cached.task_id,
					nama: cached.name ?? serialNumber,
					serial_number: serialNumber,
					status: target.label,
				});
			taskId = cached.task_id;
			name = cached.name;
		} else {
			if (cache?.complete) return error(403, "SERIAL_NOT_IN_SELECTED_PROJECT");
			const tasks = await findSerial(token, serialNumber);
			if (!tasks.length) return error(404, "SERIAL_NUMBER_NOT_FOUND");
			if (tasks.length > 1) return error(409, "DUPLICATE_SERIAL_NUMBER");
			const task = tasks[0];
			const scope = taskProjectScope(task, mainTaskId);
			if (scope === "OTHER") return error(403, "SERIAL_NOT_IN_SELECTED_PROJECT");
			if (scope !== "MATCH") return error(422, "INVALID_TASK_HIERARCHY");
			if (serialNumberOf(task) !== serialNumber)
				return error(422, "INVALID_SERIAL_DATA");
			taskId = task.id;
			name = task.name ?? null;
			await rememberSerial(mainTaskId, serialNumber, {
				task_id: task.id,
				name,
				status_id: scanStatusOf(task),
			});
			if (scanStatusOf(task) === target.value)
				return NextResponse.json({
					ok: true,
					skipped: true,
					task_id: task.id,
					nama: name ?? serialNumber,
					serial_number: serialNumber,
					status: target.label,
				});
		}
		await updateStatus(token, taskId, target.value);
		try {
			await savePpicScanHistory(
				userId,
				serialNumber,
				target.status,
				name ?? serialNumber,
			);
		} catch {
			throw new Error("SCAN_HISTORY_SAVE_FAILED");
		}
		await updateCachedSerialStatus(mainTaskId, serialNumber, target.value);
	} catch (cause) {
		const code = cause instanceof Error ? cause.message : "CLICKUP_STATUS_UPDATE_FAILED";
		return error(
			code === "RATE_LIMITED" ? 429 : 502,
			code === "RATE_LIMITED" || code === "SCAN_HISTORY_SAVE_FAILED"
				? code
				: "CLICKUP_STATUS_UPDATE_FAILED",
		);
	}

	return NextResponse.json({
		task_id: taskId,
		nama: name ?? serialNumber,
		serial_number: serialNumber,
		status: target.label,
	});
}
