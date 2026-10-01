import { NextRequest, NextResponse } from "next/server";
import { fieldsByName } from "@/lib/clickup";

type Payload = { sku?: string; name?: string; brand?: string; rak?: string; currentStock?: number };
type ClickUpTask = { id: string };
const productFieldNames = ["SKU / Barcode", "Stok Saat Ini", "Lokasi Rak", "Brand"] as const;

export async function POST(request: NextRequest) {
	const { sku, name, brand, rak, currentStock } = (await request.json()) as Payload;
	const token = process.env.CLICKUP_API_TOKEN;
	const listId = process.env.CLICKUP_MASTER_LIST_ID;

	if (!sku?.trim() || !name?.trim() || !brand?.trim() || !rak?.trim() || typeof currentStock !== "number" || !Number.isInteger(currentStock) || currentStock < 0) {
		return NextResponse.json({ error: "Data produk tidak valid." }, { status: 400 });
	}
	if (!token || !listId) return NextResponse.json({ error: "ClickUp is not configured." }, { status: 500 });

	const fields = await fieldsByName(token, listId, productFieldNames);
	if (!fields) return NextResponse.json({ error: "Could not reach ClickUp." }, { status: 502 });
	const missingFields = productFieldNames.filter((field) => !fields[field]);
	if (missingFields.length) return NextResponse.json({ error: `Missing ClickUp fields: ${missingFields.join(", ")}.` }, { status: 500 });

	const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
		method: "POST",
		headers: { Authorization: token, "Content-Type": "application/json" },
		body: JSON.stringify({
			name: name.trim(),
			custom_fields: [
				{ id: fields["SKU / Barcode"]!.id, value: sku.trim() },
				{ id: fields["Stok Saat Ini"]!.id, value: currentStock },
				{ id: fields["Lokasi Rak"]!.id, value: rak.trim() },
				{ id: fields.Brand!.id, value: brand.trim() },
			],
		}),
	});
	if (!response.ok) return NextResponse.json({ error: "ClickUp could not add the product." }, { status: 502 });

	const task = (await response.json()) as ClickUpTask;
	return NextResponse.json({ id: task.id, sku: sku.trim(), name: name.trim(), brand: brand.trim(), rak: rak.trim(), currentStock });
}
