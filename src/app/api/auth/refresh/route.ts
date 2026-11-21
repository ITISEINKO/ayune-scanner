import { NextResponse } from "next/server";
import {
	getAuthorizationState,
	getClickUpIdentity,
} from "@/lib/session";

export async function GET() {
	const identity = await getClickUpIdentity();
	if (!identity) return NextResponse.json({ ok: false }, { status: 401 });

	const state = await getAuthorizationState(identity.user_id);

	const response = NextResponse.json({ ok: true, path: state.path === "/unauthorized" ? "/profile" : state.path });
	response.headers.set("Cache-Control", "no-store");
	return response;
}
