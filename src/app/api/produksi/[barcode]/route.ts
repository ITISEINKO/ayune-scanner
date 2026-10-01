import { NextRequest, NextResponse } from "next/server";
import { fieldsByName, hasTaskRelation, optionName } from "@/lib/clickup";
import { CF, KENDALA_LIST_ID, PRODUKSI_LIST_ID } from "@/lib/produksi";
import type { ClickUpTask } from "@/types/clickup";

const fieldNames = ["Tahap Produksi", "Progress", "QC Result", "Last Scan"] as const;
const kendalaFieldNames = ["Produksi Task", "Jenis Kendala", "Tahap Saat Kendala", "Detail Kendala"] as const;
const valueOf = (task: ClickUpTask, id: string) => task.custom_fields?.find((field) => field.id === id)?.value;
const dropdownValue = (task: ClickUpTask, id: string) => {
  const field = task.custom_fields?.find((item) => item.id === id);
  return field?.type_config?.options?.find((option) => option.id === field.value || (option.orderindex !== undefined && String(option.orderindex) === String(field.value)))?.name ?? null;
};
const textValue = (value: unknown) => typeof value === "string" ? value : null;
const progressValue = (value: unknown) => {
  if (typeof value === "number") return value;
  if (!value || typeof value !== "object") return null;
  const { current, percent_completed } = value as { current?: unknown; percent_completed?: unknown };
  return typeof percent_completed === "number" ? percent_completed : typeof current === "number" ? current : null;
};
const error = (status: number, code: string) => NextResponse.json({ error: code, code }, { status });
const fieldRequestError = async (token: string, listId: string) => {
  try {
    const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/field`, { headers: { Authorization: token }, cache: "no-store" });
    console.error("ClickUp field request failed", { listId, status: response.status });
    if (response.status === 401) return error(502, "CLICKUP_AUTH");
    if (response.status === 404) return error(502, "CLICKUP_LIST_NOT_FOUND");
    return error(response.status === 429 ? 429 : 502, response.status === 429 ? "RATE_LIMITED" : "CLICKUP_UNREACHABLE");
  } catch (caught) {
    console.error("ClickUp field request failed", { listId, error: caught instanceof Error ? caught.message : String(caught) });
    return error(502, "CLICKUP_UNREACHABLE");
  }
};

export async function GET(_request: NextRequest, { params }: RouteContext<"/api/produksi/[barcode]">) {
  const { barcode: rawBarcode } = await params;
  const barcode = rawBarcode.trim();
  const token = process.env.CLICKUP_TOKEN || process.env.CLICKUP_API_TOKEN;
  const listId = process.env.CLICKUP_PRODUKSI_LIST_ID || PRODUKSI_LIST_ID;
  const kendalaListId = process.env.CLICKUP_KENDALA_LIST_ID || process.env.LIST_KENDALA_ID || KENDALA_LIST_ID;
  if (!barcode) return error(400, "MISSING_FIELD");
  if (!token) return error(500, "CLICKUP_NOT_CONFIGURED");

  let fields: Awaited<ReturnType<typeof fieldsByName>>;
  let kendalaFields: Awaited<ReturnType<typeof fieldsByName>>;
  try {
    [fields, kendalaFields] = await Promise.all([
      fieldsByName(token, listId, fieldNames),
      fieldsByName(token, kendalaListId, kendalaFieldNames),
    ]);
  } catch (caught) {
    console.error("ClickUp field request failed", { listId, kendalaListId, error: caught instanceof Error ? caught.message : String(caught) });
    return error(502, "CLICKUP_UNREACHABLE");
  }
  if (!fields) return fieldRequestError(token, listId);
  if (!kendalaFields) return fieldRequestError(token, kendalaListId);
  const missingFields = [...fieldNames.filter((name) => !fields[name]), ...kendalaFieldNames.filter((name) => !kendalaFields[name])];
  if (missingFields.length) {
    console.error("ClickUp fields missing", { listId, kendalaListId, fields: missingFields });
    return NextResponse.json({ error: "CLICKUP_FIELD_MISSING", code: "CLICKUP_FIELD_MISSING", fields: missingFields }, { status: 500 });
  }
  const query = new URLSearchParams({ include_closed: "true", custom_fields: JSON.stringify([{ field_id: CF.BARCODE, operator: "=", value: barcode }]) });
  const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task?${query}`, { headers: { Authorization: token }, cache: "no-store" });
  if (!response.ok) return error(response.status === 429 ? 429 : 502, response.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");
  const { tasks = [] } = (await response.json()) as { tasks?: ClickUpTask[] };
  if (!tasks.length) return error(404, "BARCODE_NOT_FOUND");
  if (tasks.length > 1) return error(409, "DUPLICATE_BARCODE");

  const task = tasks[0];
  const kendalaResponse = await fetch(`https://api.clickup.com/api/v2/list/${kendalaListId}/task?include_closed=true`, {
    headers: { Authorization: token },
    cache: "no-store",
  });
  if (!kendalaResponse.ok) return error(kendalaResponse.status === 429 ? 429 : 502, kendalaResponse.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");
  const { tasks: kendalaTasks = [] } = (await kendalaResponse.json()) as { tasks?: ClickUpTask[] };
  const kendala = kendalaTasks
    .filter((kendalaTask) => hasTaskRelation(valueOf(kendalaTask, kendalaFields["Produksi Task"]!.id), task.id))
    .map((kendalaTask) => ({
      id: kendalaTask.id,
      nama: kendalaTask.name ?? null,
      status: kendalaTask.status?.status ?? null,
      jenis: optionName(kendalaFields["Jenis Kendala"]!, valueOf(kendalaTask, kendalaFields["Jenis Kendala"]!.id)),
      tahap: optionName(kendalaFields["Tahap Saat Kendala"]!, valueOf(kendalaTask, kendalaFields["Tahap Saat Kendala"]!.id)),
      detail: textValue(valueOf(kendalaTask, kendalaFields["Detail Kendala"]!.id)),
      dibuat: kendalaTask.date_created ? Number(kendalaTask.date_created) : null,
      selesai: kendalaTask.date_closed ? Number(kendalaTask.date_closed) : null,
    }));
  return NextResponse.json({
    task_id: task.id,
    barcode,
    step: optionName(fields["Tahap Produksi"]!, valueOf(task, fields["Tahap Produksi"]!.id)),
    progress: progressValue(valueOf(task, CF.PROGRESS)),
    qc_result: optionName(fields["QC Result"]!, valueOf(task, CF.QC_RESULT)),
    productType: dropdownValue(task, CF.PRODUCT_TYPE),
    kendala,
    bisaLanjut: kendala.every((item) => item.status === "resolved"),
    last_scan: valueOf(task, CF.LAST_SCAN),
  });
}
