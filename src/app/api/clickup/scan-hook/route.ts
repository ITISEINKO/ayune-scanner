import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { updatePpicComponentStatus } from "@/lib/db";
import { CF_PANEL, statusBarangScanKey } from "@/lib/produksiPanel";

const unauthorized = () =>
	NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

export async function POST(request: Request) {
	const secret = process.env.CLICKUP_WEBHOOK_SECRET || process.env.SCAN_HOOK_SECRET;
	const received = request.headers.get("x-signature");
	if (!secret || !received) return unauthorized();
	const expectedBytes = createHmac("sha256", secret)
		.update(await request.clone().text())
		.digest("hex");
	const receivedBytes = Buffer.from(received, "hex");
	if (
		Buffer.from(expectedBytes).length !== receivedBytes.length ||
		!timingSafeEqual(Buffer.from(expectedBytes), receivedBytes)
	)
		return unauthorized();

	let body: Record<string, unknown>;
	try {
		body = JSON.parse(await request.text()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
	}
	const taskId = typeof body.task_id === "string" ? body.task_id : "";
	const historyItems = Array.isArray(body.history_items) ? body.history_items : [];
	const statusChange = historyItems.find((item) => {
		if (!item || typeof item !== "object") return false;
		const customField = (item as Record<string, unknown>).custom_field;
		return (
			(item as Record<string, unknown>).field === "custom_field" &&
			customField &&
			typeof customField === "object" &&
			(customField as Record<string, unknown>).id === CF_PANEL.STATUS_BARANG_SCAN
		);
	}) as Record<string, unknown> | undefined;
	if (!taskId || !statusChange) return NextResponse.json({ ignored: true });
	const after = statusChange.after;
	const value =
		after && typeof after === "object" && "value" in after
			? (after as { value?: unknown }).value
			: after;
	const updated = await updatePpicComponentStatus(taskId, statusBarangScanKey(value));
	if (!updated) return NextResponse.json({ ignored: true });
	revalidateTag("clickup-project-data", { expire: 0 });
	return NextResponse.json({ ok: true });
}
