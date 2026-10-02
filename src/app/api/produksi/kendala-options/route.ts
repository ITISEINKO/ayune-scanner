import { NextResponse } from "next/server";
import { fieldsByName } from "@/lib/clickup";
import { clickUpToken } from "@/lib/session";
import { KENDALA_LIST_ID } from "@/lib/produksi";

export async function GET() {
	const token = await clickUpToken();
	const listId =
		process.env.CLICKUP_KENDALA_LIST_ID ||
		process.env.LIST_KENDALA_ID ||
		KENDALA_LIST_ID;
	if (!token)
		return NextResponse.json(
			{ ok: false, error: "UNAUTHORIZED" },
			{ status: 401 },
		);
	const fields = await fieldsByName(token, listId, ["Jenis Kendala"]);
	const field = fields?.["Jenis Kendala"];
	if (!field)
		return NextResponse.json(
			{ ok: false, error: "CLICKUP_FIELD_MISSING" },
			{ status: 500 },
		);
	return NextResponse.json({
		ok: true,
		data:
			field.type_config?.options?.map(({ id, name }) => ({ id, name })) ?? [],
	});
}
