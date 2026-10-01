import { NextRequest, NextResponse } from "next/server";
import { fieldsByName, hasTaskRelation, optionId, optionName } from "@/lib/clickup";
import { CF, KENDALA_CF, KENDALA_LIST_ID, PRODUKSI_LIST_ID, QC, isQcStage, tahapById } from "@/lib/produksi";
import type { ClickUpTask } from "@/types/clickup";

const error = (status: number, code: string) => NextResponse.json({ ok: false, error: code }, { status });
const valueOf = (task: ClickUpTask, id: string) => task.custom_fields?.find((field) => field.id === id)?.value;

export async function POST(request: NextRequest, { params }: RouteContext<"/api/produksi/[barcode]/kendala">) {
  const { barcode: rawBarcode } = await params;
  const barcode = rawBarcode.trim().toUpperCase();
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error(400, "MISSING_FIELD");
  }
  const jenisId = form.get("jenisId");
  const detail = form.get("detail");
  const picId = form.get("picId");
  const qcFail = form.get("qc_fail") === "true";
  const photos = form.getAll("photos[]").filter((item): item is File => item instanceof File);
  if (!barcode || typeof jenisId !== "string" || typeof detail !== "string" || detail.trim().length < 10 || photos.length < 1 || photos.length > 3)
    return error(400, "MISSING_FIELD");
  if (photos.some((photo) => !photo.type.startsWith("image/") || photo.size > 10 * 1024 * 1024)) return error(400, "INVALID_ATTACHMENT");
  if (picId !== null && (!/^\d+$/.test(String(picId)) || !String(picId))) return error(400, "INVALID_PIC");

  const token = process.env.CLICKUP_TOKEN || process.env.CLICKUP_API_TOKEN;
  const listId = process.env.CLICKUP_PRODUKSI_LIST_ID || PRODUKSI_LIST_ID;
  const kendalaListId = process.env.CLICKUP_KENDALA_LIST_ID || process.env.LIST_KENDALA_ID || KENDALA_LIST_ID;
  if (!token) return error(500, "CLICKUP_NOT_CONFIGURED");
  const headers = { Authorization: token };
  const [produksiFields, kendalaFields] = await Promise.all([
    fieldsByName(token, listId, ["Tahap Produksi", "Kendala"]),
    fieldsByName(token, kendalaListId, ["Produksi Task", "Jenis Kendala", "Tahap Saat Kendala", "PIC"]),
  ]);
  if (!produksiFields || !kendalaFields || !produksiFields["Tahap Produksi"] || !produksiFields.Kendala || !kendalaFields["Produksi Task"] || !kendalaFields["Jenis Kendala"] || !kendalaFields["Tahap Saat Kendala"] || !kendalaFields.PIC)
    return error(500, "CLICKUP_FIELD_MISSING");
  const jenis = optionName(kendalaFields["Jenis Kendala"], jenisId);
  if (!jenis) return error(400, "INVALID_KENDALA_TYPE");

  const query = new URLSearchParams({ include_closed: "true", custom_fields: JSON.stringify([{ field_id: CF.BARCODE, operator: "==", value: barcode }]) });
  const searchResponse = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task?${query}`, { headers, cache: "no-store" });
  if (!searchResponse.ok) return error(searchResponse.status === 429 ? 429 : 502, searchResponse.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");
  const { tasks = [] } = (await searchResponse.json()) as { tasks?: ClickUpTask[] };
  if (!tasks.length) return error(404, "BARCODE_NOT_FOUND");
  if (tasks.length > 1) return error(409, "DUPLICATE_BARCODE");
  const taskResponse = await fetch(`https://api.clickup.com/api/v2/task/${tasks[0].id}`, { headers, cache: "no-store" });
  const logResponse = await fetch(`https://api.clickup.com/api/v2/list/${kendalaListId}/task?include_closed=true`, { headers, cache: "no-store" });
  if (!taskResponse.ok || !logResponse.ok) return error(taskResponse.status === 429 || logResponse.status === 429 ? 429 : 502, taskResponse.status === 429 || logResponse.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");
  const task = (await taskResponse.json()) as ClickUpTask;
  const { tasks: kendalaTasks = [] } = (await logResponse.json()) as { tasks?: ClickUpTask[] };
  const current = tahapById(optionId(produksiFields["Tahap Produksi"], valueOf(task, CF.TAHAP_PRODUKSI)));
  if (!current) return error(409, "INVALID_TRANSITION");
  const openKendala = kendalaTasks.some((item) => hasTaskRelation(valueOf(item, kendalaFields["Produksi Task"]!.id), task.id) && item.status?.status !== "resolved");
  if (qcFail && (!isQcStage(current.name) || openKendala)) return error(409, openKendala ? "OPEN_KENDALA" : "INVALID_TRANSITION");
  const tahapId = kendalaFields["Tahap Saat Kendala"].type_config?.options?.find((option) => option.name === current.name)?.id;
  if (!tahapId) return error(500, "CLICKUP_FIELD_MISSING");

  const createResponse = await fetch(`https://api.clickup.com/api/v2/list/${kendalaListId}/task`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ name: `[${barcode}] ${jenis} - ${current.name}`, description: detail.trim(), status: "open" }),
  });
  if (!createResponse.ok) return error(createResponse.status === 429 ? 429 : 502, createResponse.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");
  const kendalaTask = (await createResponse.json()) as ClickUpTask;
  const writeHeaders = { ...headers, "Content-Type": "application/json" };
  const writes: Promise<Response>[] = [
    fetch(`https://api.clickup.com/api/v2/task/${kendalaTask.id}/field/${KENDALA_CF.PRODUKSI_TASK}`, { method: "POST", headers: writeHeaders, body: JSON.stringify({ value: { add: [task.id], rem: [] } }) }),
    fetch(`https://api.clickup.com/api/v2/task/${kendalaTask.id}/field/${KENDALA_CF.JENIS}`, { method: "POST", headers: writeHeaders, body: JSON.stringify({ value: jenisId }) }),
    fetch(`https://api.clickup.com/api/v2/task/${kendalaTask.id}/field/${KENDALA_CF.TAHAP}`, { method: "POST", headers: writeHeaders, body: JSON.stringify({ value: tahapId }) }),
  ];
  if (picId) writes.push(fetch(`https://api.clickup.com/api/v2/task/${kendalaTask.id}/field/${KENDALA_CF.PIC}`, { method: "POST", headers: writeHeaders, body: JSON.stringify({ value: { add: [String(picId)], rem: [] } }) }));
  const produksiJenisId = produksiFields.Kendala.type_config?.options?.find((option) => option.name === jenis)?.id;
  if (produksiJenisId) writes.push(fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${CF.KENDALA}`, { method: "POST", headers: writeHeaders, body: JSON.stringify({ value: produksiJenisId }) }));
  if (qcFail) writes.push(fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${CF.QC_RESULT}`, { method: "POST", headers: writeHeaders, body: JSON.stringify({ value: QC.FAIL }) }));
  const responses = await Promise.all(writes);
  if (responses.some((response) => !response.ok)) return error(502, "CLICKUP_ERROR");
  for (const photo of photos) {
    const upload = new FormData();
    upload.append("attachment", photo, photo.name);
    const response = await fetch(`https://api.clickup.com/api/v2/task/${kendalaTask.id}/attachment`, { method: "POST", headers, body: upload });
    if (!response.ok) return error(response.status === 429 ? 429 : 502, response.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");
  }
  return NextResponse.json({ ok: true, data: { kendalaId: kendalaTask.id } });
}
