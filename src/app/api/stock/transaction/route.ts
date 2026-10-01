import { NextRequest, NextResponse } from "next/server";
import { fieldsByName } from "@/lib/clickup";
import { calculateStock, type TransactionType } from "@/lib/stock";

type Payload = {
  taskId?: string; sku?: string; type?: TransactionType; qty?: number;
  operator?: string; notes?: string; currentStock?: number;
};
const logFieldNames = ["Tipe Transaksi", "Jumlah (Qty)"] as const;
const clickUpError = async (response: Response) => {
  const body = await response.json().catch(() => null) as { err?: unknown; ECODE?: unknown } | null;
  if (typeof body?.err !== "string") return `ClickUp request failed (${response.status}).`;
  return `${body.err}${typeof body.ECODE === "string" ? ` (${body.ECODE})` : ""}`;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Payload;
  const { taskId, sku, type, qty, operator, notes, currentStock } = body;
  const token = process.env.CLICKUP_API_TOKEN;
  const logListId = process.env.CLICKUP_LOG_LIST_ID;
  const masterListId = process.env.CLICKUP_MASTER_LIST_ID;

  if (!taskId || !sku || !operator || !type || typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || typeof currentStock !== "number" || !Number.isFinite(currentStock)) {
    return NextResponse.json({ error: "Invalid transaction data." }, { status: 400 });
  }
  if (!token || !logListId || !masterListId) {
    return NextResponse.json({ error: "ClickUp is not configured." }, { status: 500 });
  }

  const [masterFields, logFields] = await Promise.all([
    fieldsByName(token, masterListId, ["Stok Saat Ini"]),
    fieldsByName(token, logListId, logFieldNames),
  ]);
  if (!masterFields || !logFields) return NextResponse.json({ error: "Could not reach ClickUp." }, { status: 502 });
  const stockField = masterFields["Stok Saat Ini"];
  const transactionTypeField = logFields["Tipe Transaksi"];
  const quantityField = logFields["Jumlah (Qty)"];
  if (!stockField || !transactionTypeField || !quantityField) {
    const missingFields: string[] = logFieldNames.filter((name) => !logFields[name]);
    if (!stockField) missingFields.push("Stok Saat Ini");
    return NextResponse.json({ error: `Missing ClickUp fields: ${missingFields.join(", ")}.` }, { status: 500 });
  }
  const transactionOption = transactionTypeField.type_config?.options?.find((option) => option.name === (type === "IN" ? "Barang Masuk" : "Barang Keluar"));
  if (!transactionOption) return NextResponse.json({ error: "Transaction type options are missing in ClickUp." }, { status: 500 });

  const newStock = calculateStock(currentStock, type, qty);
  if (newStock < 0) return NextResponse.json({ error: "Stock cannot be negative." }, { status: 400 });
  const headers = { Authorization: token, "Content-Type": "application/json" };

  const [logResponse, stockResponse] = await Promise.all([
    fetch(`https://api.clickup.com/api/v2/list/${logListId}/task`, {
      method: "POST", headers,
      body: JSON.stringify({
        name: `${type} ${sku} × ${qty}`,
        description: `Operator: ${operator}${notes ? `\nNotes: ${notes}` : ""}`,
        custom_fields: [
          { id: transactionTypeField.id, value: transactionOption.id },
          { id: quantityField.id, value: qty },
        ],
      }),
    }),
    fetch(`https://api.clickup.com/api/v2/task/${taskId}/field/${stockField.id}`, {
      method: "POST", headers,
      body: JSON.stringify({ value: newStock }),
    }),
  ]);

  if (!logResponse.ok || !stockResponse.ok) {
    const errors = await Promise.all([
      logResponse.ok ? null : clickUpError(logResponse),
      stockResponse.ok ? null : clickUpError(stockResponse),
    ]);
    return NextResponse.json({ error: errors.filter(Boolean).join(" ") }, { status: logResponse.ok ? stockResponse.status : logResponse.status });
  }
  return NextResponse.json({ success: true, newStock });
}
