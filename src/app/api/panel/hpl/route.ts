import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { clickUpHeaders } from "@/lib/clickup";
import { panelHpl } from "@/lib/panelHpl";
import { readHpl, saveHpl } from "@/lib/hplStorage";
import { canImportLby } from "@/lib/db";
import { panelListId } from "@/lib/projects";
import { loadDescendantTasks } from "@/lib/projectDashboard";
import { CF_PANEL } from "@/lib/produksiPanel";
import { clickUpToken, getAppSession } from "@/lib/session";
import { listTrialModels, readTrialModel } from "@/lib/trialPublicModels";
import type { ClickUpTask } from "@/types/clickup";

export const maxDuration = 60;

const pending = new Map<string, Promise<{ panels: ReturnType<typeof panelHpl>[]; syncedAt: string }>>();

export const GET = (request: Request) => handle(request, false);
export const POST = (request: Request) => handle(request, true);

async function handle(request: Request, refresh: boolean) {
	const token = await clickUpToken();
	const session = await getAppSession();
	if (refresh && (!token || !session))
		return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
	if (refresh && request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
	if (refresh && session && !await canImportLby(session.user_id)) return new Response(null, { status: 403 });
	const params = new URL(request.url).searchParams;
	const id = params.get("id"),
		revision = params.get("revision"), roomId = params.get("roomId"), panelId = params.get("panelId");
	if (
		!id ||
		!/^\d{1,30}$/.test(id) ||
		!revision ||
		!/^[a-f0-9]{64}$/.test(revision) || (Boolean(panelId) && !roomId)
	)
		return new Response(null, { status: 400 });
	try {
		if (!(await listTrialModels()).some((model) => model.id === id && model.activeRevision === revision))
			return new Response(null, { status: 404 });
		if (!refresh) {
			const stored = await readHpl(id, revision);
			const panels = stored.filter((item) => (!roomId || item.room === roomId) && (!panelId || item.id === panelId));
			return NextResponse.json({ panels, syncedAt: panels.reduce<string | null>((latest, item) => !latest || item.syncedAt > latest ? item.syncedAt : latest, null) }, { headers: { "Cache-Control": "private, no-store" } });
		}
		const snapshot = await readTrialModel(id, revision);
		if (!snapshot) return new Response(null, { status: 404 });
		const rooms = roomId ? snapshot.rooms.filter((room) => room.id === roomId) : snapshot.rooms;
		if (roomId && rooms.length !== 1) return new Response(null, { status: 404 });
		const selection = rooms.flatMap((room) => room.matches.filter((panel) => !panelId || panel.id === panelId).map((panel) => ({ room: room.id, panel })));
		if (panelId && selection.length !== 1) return new Response(null, { status: 404 });
		if (!token || !session) return new Response(null, { status: 401 });
		const scope = [session.user_id, createHash("sha256").update(token).digest("hex"), panelListId(), id, revision];
		const key = JSON.stringify([...scope, roomId, panelId]);
		let work = pending.get(key);
		if (!work) {
		work = (async () => {
		const started = Date.now();
		const tasks = new Map<string, ClickUpTask>();
		const signal = AbortSignal.timeout(45000);
		const serials = [
			...new Set(
				selection.map(({ panel }) => panel.serial.trim())
					.filter(Boolean),
			),
		];
		const batches = Array.from(
			{ length: Math.ceil(serials.length / 50) },
			(_, index) => serials.slice(index * 50, index * 50 + 50),
		);
		for (let offset = 0; offset < batches.length; offset += 4) {
			await Promise.all(
				batches.slice(offset, offset + 4).map(async (batch) => {
					const seen = new Set<string>();
					for (let page = 0; ; page++) {
						const query = new URLSearchParams({
							subtasks: "true",
							include_closed: "true",
							page: String(page),
							custom_fields: JSON.stringify([
								{
									field_id: CF_PANEL.SERIAL_NUMBER,
									operator: "ANY",
									value: batch,
								},
							]),
						});
						const response = await fetch(
							`https://api.clickup.com/api/v2/list/${panelListId()}/task?${query}`,
							{ headers: clickUpHeaders(token), cache: "no-store", signal },
						);
						if (!response.ok) throw new Error("CLICKUP_ERROR");
						const data = (await response.json()) as {
							tasks?: ClickUpTask[];
							last_page?: boolean;
						};
						if (!Array.isArray(data.tasks)) throw new Error("CLICKUP_ERROR");
						for (const task of data.tasks) {
							if (
								typeof task.id !== "string" ||
								!("parent" in task) ||
								seen.has(task.id)
							)
								throw new Error("INVALID_HIERARCHY");
							seen.add(task.id);
							const value = task.custom_fields?.find(
								(field) => field.id === CF_PANEL.SERIAL_NUMBER,
							)?.value;
							if (typeof value === "string" && batch.includes(value.trim()))
								tasks.set(task.id, task);
						}
						if (data.last_page === true || data.tasks.length === 0) break;
					}
				}),
			);
		}
		const matchedTasks = [...tasks.values()];
		const parents = [
			...new Set(
				matchedTasks
					.map((task) => task.parent)
					.filter((parent): parent is string => Boolean(parent)),
			),
		];
		for (let offset = 0; offset < parents.length; offset += 4) {
			await Promise.all(
				parents.slice(offset, offset + 4).map(async (parent) => {
					const [response, descendants] = await Promise.all([
						fetch(
							`https://api.clickup.com/api/v2/task/${encodeURIComponent(parent)}`,
							{ headers: clickUpHeaders(token), cache: "no-store", signal },
						),
						(panelId
							? (async () => {
								const descendants: ClickUpTask[] = [];
								for (const task of matchedTasks) if (task.parent === parent)
									descendants.push(...await loadDescendantTasks(token, task.id, signal));
								return descendants;
							})()
							: loadDescendantTasks(token, parent, signal)
						),
					]);
					if (!response.ok) throw new Error("CLICKUP_ERROR");
					const task = (await response.json()) as ClickUpTask;
					if (task.id !== parent || task.list?.id !== panelListId())
						throw new Error("INVALID_HIERARCHY");
					tasks.set(task.id, task);
					for (const child of descendants) {
						if (typeof child.id !== "string" || !("parent" in child))
							throw new Error("INVALID_HIERARCHY");
						tasks.set(child.id, child);
					}
				}),
			);
		}
		const allTasks = [...tasks.values()];
		// shortcut: scans the task list for each panel; build a serial index if large models make refresh slow.
		const panels = selection.map(({ room, panel }) => ({
				room,
				id: panel.id,
				...panelHpl(allTasks, panel.serial.trim()),
			}));
		if (!(await listTrialModels()).some((model) => model.id === id && model.activeRevision === revision))
			throw new Error("REVISION_CHANGED");
		await saveHpl(id, revision, panels, allTasks, new Date(started).toISOString());
		const stored = await readHpl(id, revision);
		const selected = new Set(selection.map(({ room, panel }) => JSON.stringify([room, panel.id])));
		return { panels: stored.filter((panel) => selected.has(JSON.stringify([panel.room, panel.id]))), syncedAt: new Date().toISOString() };
		})();
		pending.set(key, work);
		work.finally(() => pending.delete(key)).catch(() => {});
		}
		return NextResponse.json(
			await work,
			{ headers: { "Cache-Control": "private, no-store" } },
		);
	} catch (error) {
		if (error instanceof Error && error.message === "REVISION_CHANGED") return new Response(null, { status: 409 });
		return NextResponse.json({ error: "HPL_UNAVAILABLE" }, { status: 502 });
	}
}
