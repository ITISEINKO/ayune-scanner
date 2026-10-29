import { hasPpicAdminAccess } from "@/types/ppic";
import { NextResponse } from "next/server";
import { getAbly } from "@/lib/ably";
import { ppicSession } from "@/lib/session";

export async function GET() {
	const session = await ppicSession();
	if (!session)
		return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

	try {
		return NextResponse.json(
			await getAbly().auth.createTokenRequest({
				clientId: session.user_id,
				capability: {
					[`ppic:member:${session.user_id}`]: ["subscribe"],
					...(hasPpicAdminAccess(session.role)
						? { "ppic:settings": ["subscribe"] }
						: {}),
				},
			}),
		);
	} catch {
		return NextResponse.json({ error: "ABLY_ERROR" }, { status: 502 });
	}
}
