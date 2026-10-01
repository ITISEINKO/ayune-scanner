import { NextRequest, NextResponse } from "next/server";
import { clearFieldsCache, fieldsByName, type ClickUpField } from "@/lib/clickup";
import { isProductionStep, isReworkStep, moveProduction, type QcResult, type ScanAction } from "@/lib/produksi";

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
type TaskField = { id: string; value?: unknown };
type ClickUpTask = { id: string; custom_fields?: TaskField[] };

const fieldNames = ["Tahap Produksi", "Barcode", "Start Production", "Last Scan", "Progress", "QC Result", "Kendala", "Detail Kendala"] as const;
const actions = new Set<ScanAction>(["advance", "qc", "release_komplain"]);
const fieldValue = (task: ClickUpTask, id: string) => task.custom_fields?.find((field) => field.id === id)?.value;
const option = (field: ClickUpField | undefined, name: string) => field?.type_config?.options?.find((item) => item.name === name);
const error = (status: number, code: string) => NextResponse.json({ error: code, code }, { status });

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
  if (!barcode || !operatorId || !deviceId || !action || !actions.has(action) || Number.isNaN(scannedAt.valueOf())) return error(400, "MISSING_FIELD");
  if (action === "qc" && body.qc_result !== "Pass" && body.qc_result !== "Fail") return error(400, "MISSING_FIELD");

  const token = process.env.CLICKUP_TOKEN || process.env.CLICKUP_API_TOKEN;
  const listId = process.env.LIST_PRODUKSI_ID;
  if (!token || !listId) return error(500, "CLICKUP_NOT_CONFIGURED");

  const fields = await fieldsByName(token, listId, fieldNames);
  const missing = fieldNames.find((name) => !fields?.[name]);
  if (!fields || missing) return error(500, "CLICKUP_FIELD_MISSING");
  const tahap = fields["Tahap Produksi"]!;
  const barcodeField = fields.Barcode!;
  const qcField = fields["QC Result"]!;
  const kendalaField = fields.Kendala!;
  const detailKendalaField = fields["Detail Kendala"]!;

  const query = new URLSearchParams({
    include_closed: "true",
    custom_fields: JSON.stringify([{ field_id: barcodeField.id, operator: "=", value: barcode }]),
  });
  const taskResponse = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task?${query}`, {
    headers: { Authorization: token }, cache: "no-store",
  });
  if (!taskResponse.ok) return error(taskResponse.status === 429 ? 429 : 502, taskResponse.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");
  const { tasks = [] } = (await taskResponse.json()) as { tasks?: ClickUpTask[] };
  if (!tasks.length) return error(404, "BARCODE_NOT_FOUND");
  if (tasks.length > 1) return error(409, "DUPLICATE_BARCODE");

  const task = tasks[0];
  const currentOption = tahap.type_config?.options?.find((item) => item.id === fieldValue(task, tahap.id));
  const current = currentOption?.name;
  if (!current || !isProductionStep(current)) return error(409, "INVALID_TRANSITION");

  if (action === "qc" && body.qc_result === "Fail" && (!body.kendala?.trim() || !body.detail_kendala?.trim())) return error(400, "MISSING_FIELD");
  if (action === "release_komplain") {
    const spvIds = new Set((process.env.CLICKUP_SPV_OPERATOR_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean));
    if (!spvIds.has(operatorId)) return error(403, "ROLE_NOT_ALLOWED");
    if (!body.rework_to || !isReworkStep(body.rework_to)) return error(400, "MISSING_FIELD");
  }

  const movement = moveProduction(current, action, body.qc_result ?? undefined, body.rework_to && isReworkStep(body.rework_to) ? body.rework_to : undefined);
  if (!movement) return error(409, "INVALID_TRANSITION");
  const toOption = option(tahap, movement.to);
  if (!toOption) return error(500, "CLICKUP_FIELD_MISSING");

  const headers = { Authorization: token, "Content-Type": "application/json" };
  const writes: Promise<Response>[] = [
    fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${tahap.id}`, { method: "POST", headers, body: JSON.stringify({ value: toOption.id }) }),
    fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${fields["Last Scan"]!.id}`, { method: "POST", headers, body: JSON.stringify({ value: scannedAt.valueOf(), value_options: { time: true } }) }),
    fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${fields.Progress!.id}`, { method: "POST", headers, body: JSON.stringify({ value: { current: movement.progress } }) }),
  ];
  if (movement.qcResult) {
    const qcOption = option(qcField, movement.qcResult);
    if (!qcOption) return error(500, "CLICKUP_FIELD_MISSING");
    writes.push(fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${qcField.id}`, { method: "POST", headers, body: JSON.stringify({ value: qcOption.id }) }));
  }
  if (body.qc_result === "Fail") {
    const kendalaOption = option(kendalaField, body.kendala!.trim());
    if (!kendalaOption) return error(400, "MISSING_FIELD");
    writes.push(
      fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${kendalaField.id}`, { method: "POST", headers, body: JSON.stringify({ value: kendalaOption.id }) }),
      fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${detailKendalaField.id}`, { method: "POST", headers, body: JSON.stringify({ value: body.detail_kendala!.trim() }) }),
    );
  }
  if (current === "Handover Produksi" && !fieldValue(task, fields["Start Production"]!.id)) {
    writes.push(fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${fields["Start Production"]!.id}`, { method: "POST", headers, body: JSON.stringify({ value: scannedAt.valueOf(), value_options: { time: true } }) }));
  }
  if (movement.to === "Pengiriman") writes.push(fetch(`https://api.clickup.com/api/v2/task/${task.id}`, { method: "PUT", headers, body: JSON.stringify({ status: "complete" }) }));

  const timestamp = scannedAt.toLocaleString("sv-SE", { timeZone: "Asia/Jakarta", hour12: false });
  writes.push(fetch(`https://api.clickup.com/api/v2/task/${task.id}/comment`, { method: "POST", headers, body: JSON.stringify({ comment_text: `[SCAN] ${current} → ${movement.to} | operator: ${operatorId} | device: ${deviceId} | ${timestamp} WIB`, notify_all: false }) }));
  const responses = await Promise.all(writes);
  if (responses.some((response) => !response.ok)) {
    clearFieldsCache(listId);
    return error(responses.some((response) => response.status === 429) ? 429 : 502, responses.some((response) => response.status === 429) ? "RATE_LIMITED" : "CLICKUP_ERROR");
  }

  return NextResponse.json({ task_id: task.id, barcode, from: current, to: movement.to, progress: movement.progress, last_scan: scannedAt.toISOString() });
}
