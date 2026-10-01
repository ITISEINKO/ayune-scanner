import { NextRequest, NextResponse } from "next/server";
import { fieldsByName } from "@/lib/clickup";

type ClickUpField = { id: string; value?: string | number | null };
type ClickUpTask = { id: string; name: string; custom_fields?: ClickUpField[] };
const productFieldNames = ["SKU / Barcode", "Stok Saat Ini", "Lokasi Rak", "Brand"] as const;

const valueOf = (fields: ClickUpField[] | undefined, id: string) =>
  fields?.find((field) => field.id === id)?.value;

export async function GET(request: NextRequest) {
  const sku = request.nextUrl.searchParams.get("sku")?.trim();
  const token = process.env.CLICKUP_API_TOKEN;
  const listId = process.env.CLICKUP_MASTER_LIST_ID;

  if (!sku) return NextResponse.json({ error: "SKU is required." }, { status: 400 });
  if (!token || !listId) return NextResponse.json({ error: "ClickUp is not configured." }, { status: 500 });

  const fieldsByLabel = await fieldsByName(token, listId, productFieldNames);
  if (!fieldsByLabel) return NextResponse.json({ error: "Could not reach ClickUp." }, { status: 502 });
  const { "SKU / Barcode": skuField, "Stok Saat Ini": stockField, "Lokasi Rak": rackField, Brand: brandField } = fieldsByLabel;
  const missingFields = productFieldNames.filter((name) => !fieldsByLabel[name]);
  if (!skuField || !stockField || !rackField || !brandField) {
    return NextResponse.json({ error: `Missing ClickUp fields: ${missingFields.join(", ")}.` }, { status: 500 });
  }

  let product: ClickUpTask | undefined;
  for (let page = 0; !product; page += 1) {
    const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task?include_closed=true&page=${page}`, {
      headers: { Authorization: token }, cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "Could not reach ClickUp." }, { status: 502 });
    const result = (await response.json()) as { tasks?: ClickUpTask[]; last_page?: boolean };
    product = result.tasks?.find((task) => String(valueOf(task.custom_fields, skuField.id) ?? "") === sku);
    if (result.last_page || !result.tasks?.length) break;
  }
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const fields = product.custom_fields;
  return NextResponse.json({
    id: product.id,
    name: product.name,
    sku,
    currentStock: Number(valueOf(fields, stockField.id) ?? 0),
    rak: String(valueOf(fields, rackField.id) ?? "-"),
    brand: String(valueOf(fields, brandField.id) ?? "-"),
  });
}
