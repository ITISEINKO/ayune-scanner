import { NextRequest, NextResponse } from "next/server";
import { fieldsByName, optionName } from "@/lib/clickup";
import { CF, PRODUKSI_LIST_ID } from "@/lib/produksi";
import type { ClickUpTask } from "@/types/clickup";

const fieldNames = ["Tahap Produksi", "Progress", "QC Result", "Kendala", "Last Scan"] as const;
const valueOf = (task: ClickUpTask, id: string) => task.custom_fields?.find((field) => field.id === id)?.value;
const progressValue = (value: unknown) => {
  if (typeof value === "number") return value;
  if (!value || typeof value !== "object") return null;
  const { current, percent_completed } = value as { current?: unknown; percent_completed?: unknown };
  return typeof percent_completed === "number" ? percent_completed : typeof current === "number" ? current : null;
};
const error = (status: number, code: string) => NextResponse.json({ error: code, code }, { status });

export async function GET(_request: NextRequest, { params }: RouteContext<"/api/produksi/[barcode]">) {
  const { barcode: rawBarcode } = await params;
  const barcode = rawBarcode.trim();
  const token = process.env.CLICKUP_TOKEN || process.env.CLICKUP_API_TOKEN;
  const listId = process.env.LIST_PRODUKSI_ID || PRODUKSI_LIST_ID;
  if (!barcode) return error(400, "MISSING_FIELD");
  if (!token) return error(500, "CLICKUP_NOT_CONFIGURED");

  const fields = await fieldsByName(token, listId, fieldNames);
  if (!fields || fieldNames.some((name) => !fields[name])) return error(500, "CLICKUP_FIELD_MISSING");
  const query = new URLSearchParams({ include_closed: "true", custom_fields: JSON.stringify([{ field_id: CF.BARCODE, operator: "=", value: barcode }]) });
  const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task?${query}`, { headers: { Authorization: token }, cache: "no-store" });
  if (!response.ok) return error(response.status === 429 ? 429 : 502, response.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");
  const { tasks = [] } = (await response.json()) as { tasks?: ClickUpTask[] };
  if (!tasks.length) return error(404, "BARCODE_NOT_FOUND");
  if (tasks.length > 1) return error(409, "DUPLICATE_BARCODE");

  const task = tasks[0];
  return NextResponse.json({
    barcode,
    step: optionName(fields["Tahap Produksi"]!, valueOf(task, fields["Tahap Produksi"]!.id)),
    progress: progressValue(valueOf(task, CF.PROGRESS)),
    qc_result: optionName(fields["QC Result"]!, valueOf(task, CF.QC_RESULT)),
    kendala: optionName(fields.Kendala!, valueOf(task, CF.KENDALA)),
    last_scan: valueOf(task, CF.LAST_SCAN),
  });
}
