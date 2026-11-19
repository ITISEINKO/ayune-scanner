import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { clickUpHeaders } from "@/lib/clickup";
import { panelHpl } from "@/lib/panelHpl";
import { panelListId } from "@/lib/projects";
import { loadDescendantTasks } from "@/lib/projectDashboard";
import { CF_PANEL } from "@/lib/produksiPanel";
import { clickUpToken, ppicSession } from "@/lib/session";
import { listTrialModels, readTrialModel } from "@/lib/trialPublicModels";
import type { ClickUpTask } from "@/types/clickup";

export const maxDuration = 60;

// shortcut: process-local cache is lost on restart; use shared storage if instances need to share it.
const cache = new Map<string, { expires: number; value: { panels: ReturnType<typeof panelHpl>[]; syncedAt: string } }>();
const pending = new Map<string, Promise<{ panels: ReturnType<typeof panelHpl>[]; syncedAt: string }>>();

export async function GET(request: Request) {
	const token = await clickUpToken();
	const session = await ppicSession();
	if (!token || !session)
		return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
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
		if (
			!(await listTrialModels()).some(
				(model) => model.id === id && model.activeRevision === revision,
			)
		)
			return new Response(null, { status: 404 });
		const snapshot = await readTrialModel(id, revision);
		if (!snapshot) return new Response(null, { status: 404 });
		const rooms = roomId ? snapshot.rooms.filter((room) => room.id === roomId) : snapshot.rooms;
		if (roomId && rooms.length !== 1) return new Response(null, { status: 404 });
		const selection = rooms.flatMap((room) => room.matches.filter((panel) => !panelId || panel.id === panelId).map((panel) => ({ room: room.id, panel })));
		if (panelId && selection.length !== 1) return new Response(null, { status: 404 });
		const scope = [session.user_id, createHash("sha256").update(token).digest("hex"), panelListId(), id, revision];
		const key = JSON.stringify([...scope, roomId, panelId]);
		const cached = cache.get(key);
		if (cached && cached.expires <= Date.now()) cache.delete(key);
		if (cached && cached.expires > Date.now() && params.get("refresh") !== "1")
			return NextResponse.json(cached.value, { headers: { "Cache-Control": "private, no-store" } });
		let work = pending.get(key);
		if (!work) {
		work = (async () => {
		const started = Date.now();
		let pages = 0;
		let parentMs = 0, descendantMs = 0;
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
						pages++;
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
		const serialMs = Date.now() - started;
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
					const parentStarted = Date.now();
					const [response, descendants] = await Promise.all([
						fetch(
							`https://api.clickup.com/api/v2/task/${encodeURIComponent(parent)}`,
							{ headers: clickUpHeaders(token), cache: "no-store", signal },
						).finally(() => { parentMs += Date.now() - parentStarted; }),
						(panelId
							? (async () => {
								const descendants: ClickUpTask[] = [];
								for (const task of matchedTasks) if (task.parent === parent)
									descendants.push(...await loadDescendantTasks(token, task.id, signal));
								return descendants;
							})()
							: loadDescendantTasks(token, parent, signal)
						).finally(() => { descendantMs += Date.now() - parentStarted; }),
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
		if (
			!(await listTrialModels()).some(
				(model) => model.id === id && model.activeRevision === revision,
			)
		)
			throw new Error("REVISION_CHANGED");
		console.info("panel-hpl", { batches: batches.length, pages, serialMs, parents: parents.length, parentMs, descendantMs, durationMs: Date.now() - started });
		const value = { panels, syncedAt: new Date().toISOString() };
		if (cache.size >= 500) cache.delete(cache.keys().next().value!);
		cache.set(key, { expires: Date.now() + 60_000, value });
		if (!panelId) for (const panel of panels) {
			const panelKey = JSON.stringify([...scope, panel.room, panel.id]);
			const existing = cache.get(panelKey);
			if ((!existing || existing.expires - 60_000 <= started) && !pending.has(panelKey)) {
				if (cache.size >= 500) cache.delete(cache.keys().next().value!);
				cache.set(panelKey, { expires: Date.now() + 60_000, value: { panels: [panel], syncedAt: value.syncedAt } });
			}
		}
		return value;
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
