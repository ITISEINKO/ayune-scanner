import { NextResponse } from "next/server";
import { canImportLby } from "@/lib/db";
import { clickUpToken, ppicSession } from "@/lib/session";
import { activateLbyImport, claimLbyImport, getLbyImportState, lbyProjectForOrder, listLbyImports, releaseLbyImport, saveLbyImport } from "@/lib/panelLocationStore";
import { fetchProject, parseShareLink } from "../../../../../scripts/import-lby-project.cjs";
import type { LbyImportStage } from "@/types/panelLocation";

export const runtime = "nodejs";
export const maxDuration = 300;

const error = (status: number, code: string) => NextResponse.json({ ok: false, error: code }, { status });
const validProject = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value);
const importAccess = async () => {
	const session = await ppicSession(), token = await clickUpToken();
	if (!session || !token) return error(401, "UNAUTHORIZED");
	if (!(await canImportLby(session.user_id))) return error(403, "LBY_IMPORT_REQUIRED");
	return { actor: session.user_id };
};
const failure = (cause: unknown) => {
	const message = cause instanceof Error ? cause.message : "";
	if (["ORDER_MISMATCH", "IMPORT_BUSY", "IMPORT_CONFLICT"].includes(message)) return error(409, message);
	if (message === "MODEL_TOO_LARGE") return error(413, message);
	if (message === "LBY_NO_PANEL_DATA") return error(422, message);
	if (message === "REVISION_NOT_FOUND") return error(404, message);
	if (/expired/i.test(message)) return error(400, "LINK_EXPIRED");
	if (/share link|share token|cadVisitor|Invalid URL|share order|project name in token/i.test(message)) return error(400, "INVALID_LBY_LINK");
	if (/429|RATE_LIMITED/.test(message)) return error(429, "RATE_LIMITED");
	if (/timeout|abort/i.test(message) || (cause instanceof Error && ["TimeoutError", "AbortError"].includes(cause.name))) return error(504, "IMPORT_TIMEOUT");
	if (message === "INVALID_PROJECT") return error(400, message);
	return error(502, "IMPORT_FAILED");
};

export async function GET(request: Request) {
	try {
		const access = await importAccess();
		if (access instanceof Response) return access;
		const project = new URL(request.url).searchParams.get("project");
		if (project === null) return NextResponse.json({ ok: true, states: await listLbyImports() }, { headers: { "Cache-Control": "no-store" } });
		if (!validProject(project)) return error(400, "INVALID_PROJECT");
		return NextResponse.json({ ok: true, state: await getLbyImportState(project) }, { headers: { "Cache-Control": "no-store" } });
	} catch (cause) { return failure(cause); }
}

async function change(request: Request, activate: boolean) {
	let project = "", lease = "";
	try {
		const access = await importAccess();
		if (access instanceof Response) return access;
		if (Number(request.headers.get("content-length")) > 24576) return error(413, "REQUEST_TOO_LARGE");
		const raw = await request.text();
		if (Buffer.byteLength(raw) > 24576) return error(413, "REQUEST_TOO_LARGE");
		let body;
		try { body = JSON.parse(raw); } catch { return error(400, "INVALID_REQUEST"); }
		if (!body || typeof body !== "object") return error(400, "INVALID_REQUEST");
		if (activate) {
			if (!validProject(body.project)) return error(400, "INVALID_PROJECT");
			project = body.project;
			if ((body.revision !== null && (typeof body.revision !== "string" || !/^[a-f0-9]{64}$/.test(body.revision))) ||
				(body.expectedActiveRevision !== null && (typeof body.expectedActiveRevision !== "string" || !/^[a-f0-9]{64}$/.test(body.expectedActiveRevision)))) return error(400, "INVALID_REQUEST");
			if (!(await canImportLby(access.actor))) return error(403, "LBY_IMPORT_REQUIRED");
			await activateLbyImport(project, body.revision, body.expectedActiveRevision);
			return NextResponse.json({ ok: true, state: await getLbyImportState(project) });
		}
		if (typeof body.url !== "string" || !body.url.trim() || body.url.length > 20000) return error(400, "INVALID_LBY_LINK");
		const source = parseShareLink(body.url);
		if (body.project !== undefined && !validProject(body.project)) return error(400, "INVALID_PROJECT");
		project = body.project ?? await lbyProjectForOrder(source.orderId);
		lease = await claimLbyImport(project, source.orderId);
		const cancellation = new AbortController();
		const signal = AbortSignal.any([request.signal, cancellation.signal, AbortSignal.timeout(240000)]);
		const performImport = async (progress: (stage: LbyImportStage) => void) => {
			try {
				const imported = await fetchProject(body.url, project, signal, progress);
				if (!(await canImportLby(access.actor))) return error(403, "LBY_IMPORT_REQUIRED");
				signal.throwIfAborted();
				progress("saving");
				const candidate = await saveLbyImport(project, lease, access.actor, imported);
				return NextResponse.json({ ok: true, candidate, state: await getLbyImportState(project) });
			} catch (cause) { return failure(cause); }
			finally { await releaseLbyImport(project, lease).catch(() => undefined); }
		};
		if (!request.headers.get("accept")?.includes("application/x-ndjson")) return await performImport(() => {});
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			async start(controller) {
				const send = (event: unknown) => {
					if (!cancellation.signal.aborted && !request.signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
				};
				try {
					const result = await performImport((stage) => send({ stage }));
					send(await result.json());
				} finally {
					if (!cancellation.signal.aborted) controller.close();
				}
			},
			cancel() { cancellation.abort(); },
		});
		return new Response(stream, { headers: {
			"Content-Type": "application/x-ndjson",
			"Cache-Control": "no-store, no-transform",
			"X-Accel-Buffering": "no",
		} });
	} catch (cause) { return failure(cause); }
}

export const POST = (request: Request) => change(request, false);
export const PATCH = (request: Request) => change(request, true);
