import { db } from "@/lib/db";
import { clickUpHeaders } from "@/lib/clickup";
import { CF_PANEL, statusBarangScanKey } from "@/lib/produksiPanel";
import { panelListId } from "@/lib/projects";
import { taskProjectScope } from "@/lib/projectScope";
import type { ClickUpTask } from "@/types/clickup";
import type { ProjectSerialCache, ProjectSerialCacheEntry } from "@/types/project";

const CACHE_TTL_MS = 8 * 60 * 60 * 1000;
let schema: Promise<void> | undefined;

const ensureSchema = () =>
	(schema ??= db
		.execute(`
			CREATE TABLE IF NOT EXISTS ppic_project_serial_cache (
				main_task_id TEXT PRIMARY KEY,
				complete INTEGER NOT NULL,
				entries_json TEXT NOT NULL,
				expires_at INTEGER NOT NULL
			)
		`)
		.then(() => undefined));

const fieldValue = (task: ClickUpTask, fieldId: string) => {
	const value = task.custom_fields?.find((field) => field.id === fieldId)?.value;
	return typeof value === "string" || typeof value === "number" ? String(value) : null;
};

export const serialNumberOf = (task: ClickUpTask) =>
	fieldValue(task, CF_PANEL.SERIAL_NUMBER);

export const scanStatusOf = (task: ClickUpTask) =>
	fieldValue(task, CF_PANEL.STATUS_BARANG_SCAN);

export const getScanStatus = (task: ClickUpTask) =>
	statusBarangScanKey(scanStatusOf(task));

const validCache = (value: unknown): value is ProjectSerialCache => {
	if (!value || typeof value !== "object") return false;
	const cache = value as Partial<ProjectSerialCache>;
	return (
		typeof cache.complete === "boolean" &&
		typeof cache.expires_at === "number" &&
		cache.entries !== null &&
		typeof cache.entries === "object"
	);
};

export const projectSerialCache = async (mainTaskId: string) => {
	await ensureSchema();
	const result = await db.execute({
		sql: `SELECT complete, entries_json, expires_at FROM ppic_project_serial_cache WHERE main_task_id = ? LIMIT 1`,
		args: [mainTaskId],
	});
	const row = result.rows[0];
	if (!row || Number(row.expires_at) <= Date.now()) return null;
	try {
		const entries = JSON.parse(String(row.entries_json));
		const cache = {
			complete: Number(row.complete) === 1,
			entries,
			expires_at: Number(row.expires_at),
		};
		return validCache(cache) ? cache : null;
	} catch {
		return null;
	}
};

export const clearProjectSerialCache = async (mainTaskId: string) => {
	await ensureSchema();
	await db.execute({
		sql: "DELETE FROM ppic_project_serial_cache WHERE main_task_id = ?",
		args: [mainTaskId],
	});
};

const saveCache = async (mainTaskId: string, cache: ProjectSerialCache) => {
	await ensureSchema();
	// shortcut: one JSON value per project is suited to current panel counts; normalize serials into rows if projects become too large for a single cache record.
	await db.execute({
		sql: `
			INSERT INTO ppic_project_serial_cache (main_task_id, complete, entries_json, expires_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(main_task_id) DO UPDATE SET
				complete = excluded.complete,
				entries_json = excluded.entries_json,
				expires_at = excluded.expires_at
		`,
		args: [
			mainTaskId,
			cache.complete ? 1 : 0,
			JSON.stringify(cache.entries),
			cache.expires_at,
		],
	});
};

export const rememberSerial = async (
	mainTaskId: string,
	serialNumber: string,
	entry: ProjectSerialCacheEntry,
) => {
	const cached = await projectSerialCache(mainTaskId);
	await saveCache(mainTaskId, {
		complete: cached?.complete ?? false,
		entries: { ...(cached?.entries ?? {}), [serialNumber]: entry },
		expires_at: Date.now() + CACHE_TTL_MS,
	});
};

export const updateCachedSerialStatus = async (
	mainTaskId: string,
	serialNumber: string,
	statusId: string,
) => {
	const cached = await projectSerialCache(mainTaskId);
	const entry = cached?.entries[serialNumber];
	if (!cached || !entry) return;
	await saveCache(mainTaskId, {
		...cached,
		entries: { ...cached.entries, [serialNumber]: { ...entry, status_id: statusId } },
		expires_at: Date.now() + CACHE_TTL_MS,
	});
};

export const preloadProjectSerialCache = async (token: string, project: ClickUpTask) => {
	const relatedOrderNumber = fieldValue(project, CF_PANEL.RELATED_ORDER_NUMBER);
	if (!relatedOrderNumber) return false;
	const entries: Record<string, ProjectSerialCacheEntry> = {};
	const duplicateSerials = new Set<string>();
	let page = 0;
	let sawProjectTask = false;
	for (;;) {
		const query = new URLSearchParams({
			subtasks: "true",
			"statuses[]": "in progress",
			page: String(page),
		});
		const response = await fetch(
			`https://api.clickup.com/api/v2/list/${panelListId()}/task?${query}`,
			{ headers: clickUpHeaders(token), cache: "no-store" },
		);
		if (!response.ok) throw new Error(response.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");
		const data = (await response.json()) as {
			tasks?: ClickUpTask[];
			last_page?: boolean;
		};
		for (const task of data.tasks ?? []) {
			const serialNumber = serialNumberOf(task);
			if (
				!serialNumber ||
				fieldValue(task, CF_PANEL.RELATED_ORDER_NUMBER) !== relatedOrderNumber ||
				taskProjectScope(task, project.id) !== "MATCH"
			)
				continue;
			sawProjectTask = true;
			if (entries[serialNumber]) {
				duplicateSerials.add(serialNumber);
				continue;
			}
			entries[serialNumber] = {
				task_id: task.id,
				name: task.name ?? null,
				status_id: scanStatusOf(task),
			};
		}
		if (data.last_page || !(data.tasks?.length ?? 0)) break;
		page += 1;
	}
	for (const serialNumber of duplicateSerials) delete entries[serialNumber];
	if (!sawProjectTask) return false;
	await saveCache(project.id, {
		complete: true,
		entries,
		expires_at: Date.now() + CACHE_TTL_MS,
	});
	return true;
};
