import { NextRequest, NextResponse } from "next/server";
import { fieldsByName, hasTaskRelation, optionId, optionName } from "@/lib/clickup";
import { CF, KENDALA_LIST_ID, PRODUKSI_LIST_ID, isQcStage, nextTahap, tahapById } from "@/lib/produksi";
import type { ClickUpTask } from "@/types/clickup";

const fieldNames = ["Tahap Produksi", "Progress", "QC Result", "Last Scan", "Material"] as const;
const kendalaFieldNames = ["Produksi Task", "Jenis Kendala", "Tahap Saat Kendala", "Detail Kendala", "PIC"] as const;
const valueOf = (task: ClickUpTask, id: string) => task.custom_fields?.find((field) => field.id === id)?.value;
const textValue = (value: unknown) => typeof value === "string" ? value : null;
const dropdownValue = (task: ClickUpTask, id: string) => {
  const field = task.custom_fields?.find((item) => item.id === id);
  return field?.type_config?.options?.find((option) => option.id === field.value || String(option.orderindex) === String(field.value))?.name ?? null;
};
const dateValue = (value: unknown) => typeof value === "string" || typeof value === "number" ? new Date(Number(value)).toISOString() : null;
const progressValue = (value: unknown) => {
  if (typeof value === "number") return value;
  if (!value || typeof value !== "object") return null;
  const { current, percent_completed } = value as { current?: unknown; percent_completed?: unknown };
  return typeof current === "number" || typeof current === "string" ? Number(current) : typeof percent_completed === "number" ? percent_completed * 100 : null;
};
const labelsValue = (task: ClickUpTask) => {
  const field = task.custom_fields?.find((item) => item.id === CF.MATERIAL);
  const values = Array.isArray(field?.value) ? field.value : [];
  return values.flatMap((value) => {
    const option = field?.type_config?.options?.find((item) => item.id === value);
    return option?.label ?? option?.name ?? [];
  });
};
const userName = (value: unknown) => Array.isArray(value) && typeof value[0] === "object" && value[0] !== null && "username" in value[0] && typeof value[0].username === "string" ? value[0].username : null;
const error = (status: number, code: string, message = code) => NextResponse.json({ ok: false, error: code, message }, { status });

export async function GET(_request: NextRequest, { params }: RouteContext<"/api/produksi/[barcode]">) {
  const { barcode: rawBarcode } = await params;
  const barcode = rawBarcode.trim().toUpperCase();
  const token = process.env.CLICKUP_TOKEN || process.env.CLICKUP_API_TOKEN;
  const listId = process.env.CLICKUP_PRODUKSI_LIST_ID || PRODUKSI_LIST_ID;
  const kendalaListId = process.env.CLICKUP_KENDALA_LIST_ID || process.env.LIST_KENDALA_ID || KENDALA_LIST_ID;
  if (!barcode) return error(400, "MISSING_FIELD");
  if (!token) return error(500, "CLICKUP_NOT_CONFIGURED");

  const headers = { Authorization: token };
  const [fields, kendalaFields] = await Promise.all([
    fieldsByName(token, listId, fieldNames),
    fieldsByName(token, kendalaListId, kendalaFieldNames),
  ]);
  if (!fields || !kendalaFields) return error(502, "CLICKUP_FIELD_REQUEST_FAILED", "Tidak dapat mengambil konfigurasi field dari ClickUp.");
  const missingFields = [...fieldNames.filter((name) => !fields[name]), ...kendalaFieldNames.filter((name) => !kendalaFields[name])];
  if (missingFields.length)
    return NextResponse.json({ ok: false, error: "CLICKUP_FIELD_MISSING", message: `Field ClickUp belum ada: ${missingFields.join(", ")}.`, fields: missingFields }, { status: 500 });

  const query = new URLSearchParams({ include_closed: "true", custom_fields: JSON.stringify([{ field_id: CF.BARCODE, operator: "==", value: barcode }]) });
  const searchResponse = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task?${query}`, { headers, cache: "no-store" });
  if (!searchResponse.ok) return error(searchResponse.status === 429 ? 429 : 502, searchResponse.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");
  const { tasks = [] } = (await searchResponse.json()) as { tasks?: ClickUpTask[] };
  if (!tasks.length) return error(404, "BARCODE_NOT_FOUND");
  if (tasks.length > 1) return error(409, "DUPLICATE_BARCODE");

  const taskResponse = await fetch(`https://api.clickup.com/api/v2/task/${tasks[0].id}`, { headers, cache: "no-store" });
  const kendalaResponse = await fetch(`https://api.clickup.com/api/v2/list/${kendalaListId}/task?include_closed=true`, { headers, cache: "no-store" });
  if (!taskResponse.ok || !kendalaResponse.ok) return error(taskResponse.status === 429 || kendalaResponse.status === 429 ? 429 : 502, taskResponse.status === 429 || kendalaResponse.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");
  const task = (await taskResponse.json()) as ClickUpTask;
  const { tasks: kendalaTasks = [] } = (await kendalaResponse.json()) as { tasks?: ClickUpTask[] };
  const tahapValue = valueOf(task, CF.TAHAP_PRODUKSI);
  if (tahapValue === undefined || tahapValue === null || tahapValue === "")
    return error(409, "TAHAP_PRODUKSI_NOT_SET", "Tahap Produksi belum diisi. Pilih tahap produksi di ClickUp terlebih dahulu.");
  const tahapId = optionId(fields["Tahap Produksi"]!, tahapValue);
  const tahap = tahapById(tahapId)?.name;
  if (!tahap) return error(409, "INVALID_TRANSITION");
  const kendala = kendalaTasks
    .filter((item) => hasTaskRelation(valueOf(item, kendalaFields["Produksi Task"]!.id), task.id))
    .map((item) => ({
      id: item.id,
      nama: item.name ?? null,
      status: item.status?.status ?? null,
      jenis: optionName(kendalaFields["Jenis Kendala"]!, valueOf(item, kendalaFields["Jenis Kendala"]!.id)),
      tahap: optionName(kendalaFields["Tahap Saat Kendala"]!, valueOf(item, kendalaFields["Tahap Saat Kendala"]!.id)),
      detail: textValue(valueOf(item, kendalaFields["Detail Kendala"]!.id)),
      pic: userName(valueOf(item, kendalaFields.PIC!.id)),
      dibuat: item.date_created ? Number(item.date_created) : null,
      selesai: item.date_closed ? Number(item.date_closed) : null,
    }))
    .sort((a, b) => (b.dibuat ?? 0) - (a.dibuat ?? 0));
  const kendalaAktif = kendala.find((item) => item.status !== "resolved") ?? null;
  const bisaLanjut = !kendalaAktif;
  const isQc = isQcStage(tahap);
  const next = nextTahap(tahapId)?.name ?? null;

  return NextResponse.json({
    ok: true,
    data: {
      taskId: task.id,
      nama: task.name ?? null,
      status: task.status?.status ?? null,
      barcode,
      sku: textValue(valueOf(task, CF.SKU)),
      customer: textValue(valueOf(task, CF.CUSTOMER_PROJECT)),
      productType: dropdownValue(task, CF.PRODUCT_TYPE),
      material: labelsValue(task),
      startProduction: dateValue(valueOf(task, CF.START_PRODUCTION)),
      targetSelesai: dateValue(valueOf(task, CF.TARGET_SELESAI)),
      lastScan: dateValue(valueOf(task, CF.LAST_SCAN)),
      progress: progressValue(valueOf(task, CF.PROGRESS)),
      tahapSekarang: tahap,
      tahapBerikutnya: next,
      isQcStage: isQc,
      qcResult: optionName(fields["QC Result"]!, valueOf(task, CF.QC_RESULT)),
      kendalaAktif: kendalaAktif?.jenis ?? null,
      bisaLanjut,
      alasanTidakBisaLanjut: kendalaAktif ? `Masih ada ${kendala.filter((item) => item.status !== "resolved").length} kendala open` : null,
      kendala,
      actions: {
        lanjut: bisaLanjut && !isQc && tahap !== "Pengiriman",
        qcPass: bisaLanjut && isQc,
        qcFail: bisaLanjut && isQc,
        laporKendala: true,
      },
    },
  });
}
