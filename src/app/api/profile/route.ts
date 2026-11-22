import { NextResponse } from "next/server";
import { getProfile } from "@/features/profile/getProfile";

export async function GET() {
	return NextResponse.json(await getProfile(), { headers: { "Cache-Control": "private, no-store" } });
}
